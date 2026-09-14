// src/store/actions/refreshActions.js
import { db, ref, set, get, update } from '../../api/firebase'
import { buildPreScheduleBlocks, buildDefaultBlocks, buildSlot, buildProposalItem, encodePerfMap, buildPerfMapFromGas } from '../helpers/blockBuilders'
import { genKey } from '../../utils/uniqueKey'
import { normalizeItemsTeamNames } from '../../utils/teamName'
import { extractEntityFields } from '../../utils/mergeEntity'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'
import { getCompetitionItems } from '../../utils/competition'
import { getCurrentVersionPath } from '../../utils/sessionVersion'
import { encodeKey } from '../../utils/firebaseKey'
import {
  buildHistoryByKeyFromRows,
  buildLatestByKeyFromHistory,
  normalizePerfHistory,
  normalizePerformanceRows,
} from '../../utils/performanceHistory'

function withFreshUniqueKeys(items = []) {
  return items.map(item => ({
    ...item,
    uniqueKey: genKey('1'),
  }))
}

function buildEntityPropUpdates(items) {
  const updates = {}
  ;(items || []).forEach(item => {
    if (!item?.uniqueKey) return
    updates[`entityProps/${item.uniqueKey}`] = extractEntityFields(buildProposalItem(item))
  })
  return updates
}

function buildNextEntityProps(existingEntityProps = {}, scheduleBlocks = {}, freshItems = []) {
  const next = {}
  collectBlockEntityKeys(scheduleBlocks).forEach(key => {
    if (existingEntityProps[key]) next[key] = existingEntityProps[key]
  })
  ;(freshItems || []).forEach(item => {
    if (item?.uniqueKey) next[item.uniqueKey] = extractEntityFields(buildProposalItem(item))
  })
  return next
}

function collectBlockEntityKeys(scheduleBlocks = {}) {
  const keys = new Set()
  Object.values(scheduleBlocks || {}).forEach(block => {
    if (!block) return
    if (block.uniqueKey) keys.add(block.uniqueKey)
    if (block.isCompeting) {
      getCompetitionItems(block).forEach(item => {
        if (item?.uniqueKey) keys.add(item.uniqueKey)
      })
    }
  })
  return keys
}

export function createRefreshActions(setState, getState) {
  return {

    async refreshPerformance() {
      const { startDate, poolType, userName } = getState()
      setState({ isLoadingPerformance: true })
      try {
        const { fetchRefreshPerformance } = await import('../../api/gas')
        const cursor = await getGlobalPerformanceCursor()
        const rawData = await fetchRefreshPerformance({ afterDate: cursor.latestDate || '' })
        // GAS가 { perfMap: {...} } 래핑 형태로 반환하는 경우 unwrap
        const rawPerfMap = (rawData && rawData.perfMap) ? rawData.perfMap : rawData
        // buildPerfMapFromGas: 배열/map-of-arrays/flat-map 모두 처리 + 연도 포함 최신값 선택
        const perfMap = buildPerfMapFromGas(rawPerfMap)
        const hasPerformanceRows = normalizePerformanceRows(getPerformanceRowsSource(rawData, rawPerfMap)).length > 0
        const nextPerfMap = Object.keys(perfMap).length ? perfMap : (getState().perfMap || {})
        const encoded = encodePerfMap(rawPerfMap)
        const weekKey = `${startDate}_${poolType}`
        const now = Date.now()
        if (hasPerformanceRows) {
          await update(ref(db, `sessions/${weekKey}/gasData`), {
            perfMap: encoded,
          })
        }
        await writeGlobalPerformanceData(rawData, rawPerfMap, userName)
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { performance: now, performanceBy: userName || '' })
        getState().seedPerformanceFromPerfMap?.(perfMap)
        getState().invalidatePerformanceKeys?.()
        getState().loadGlobalPerformanceData?.({ force: true })
        setState(s => ({
          perfMap: nextPerfMap,
          performanceMeta: {
            ...(s.performanceMeta || {}),
            updatedAt: now,
            updatedBy: userName || '',
          },
          ...buildPerformanceStateFromRaw(rawData, rawPerfMap, s),
          isLoadingPerformance: false,
          lastUpdated: { ...s.lastUpdated, performance: now, performanceBy: userName || '' },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingPerformance: false })
      }
    },

    async refreshProposals() {
      const { startDate, poolType, userName } = getState()
      setState({ isLoadingProposals: true })
      try {
        const { fetchRefreshProposals } = await import('../../api/gas')
        const data = await fetchRefreshProposals(poolType)
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()
        const { weightedMinTargets, scheduleBlocks, scheduledItemIds, scheduledUniqueKeys, entityProps } = getState()
        const proposalItemsRaw = withFreshUniqueKeys(data.proposalItems || [])
        await update(ref(db, versionPath), {
          proposalItems: proposalItemsRaw,
          entityProps: buildNextEntityProps(entityProps, scheduleBlocks, proposalItemsRaw),
        })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { proposal: now, proposalBy: userName || '' })
        const allItems = normalizeItemsTeamNames(
          proposalItemsRaw.map((item, i) => buildProposalItem({ ...item, _fbIdx: i })),
          weightedMinTargets
        )
        setState(s => ({
          allProposalItems:   allItems,
          proposalItems:      filterUnscheduledItems(allItems, scheduledItemIds, scheduledUniqueKeys),
          proposalLoaded:     true,
          isLoadingProposals: false,
          lastUpdated: { ...s.lastUpdated, proposal: now, proposalBy: userName || '' },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingProposals: false })
      }
    },

    // ── 갱신 로그 기록 ────────────────────────────────────
    async _writeRefreshLog(action, details) {
      const { startDate, poolType, userName } = getState()
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}/refreshLogs/log_${Date.now()}`), {
        timestamp: Date.now(), action, details, user: userName || '익명',
      })
    },

    // ── GAS 전체 재동기화 ─────────────────────────────────
    async refreshAllGasData() {
      const { startDate, poolType, scheduleBlocks, scheduledItemIds, scheduledUniqueKeys, userName, entityProps } = getState()
      setState({ isLoadingGasAll: true })
      try {
        const { fetchInitData } = await import('../../api/gas')
        const gasData = await fetchInitData(startDate, poolType)
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()

        // gasData 전체를 정규화하여 Firebase에 덮어씀
        const proposalItemsRaw = withFreshUniqueKeys(gasData.proposalItems || [])
        const pgmSlotsNew = (gasData.pgmSlots || []).map(buildSlot)
        await set(ref(db, `sessions/${weekKey}/gasData`), {
          ...gasData,
          proposalItems: proposalItemsRaw,
          perfMap: encodePerfMap(gasData.perfMap || {}),
        })
        await writeGlobalPerformanceData(gasData, gasData.perfMap || {}, userName)
        await update(ref(db, versionPath), {
          pgmSlots: pgmSlotsNew,
          proposalItems: proposalItemsRaw,
          entityProps: buildNextEntityProps(entityProps, scheduleBlocks, proposalItemsRaw),
        })
        await set(ref(db, `sessions/${weekKey}/lastUpdated`), {
          pgm: now, proposal: now, performance: now, preSchedule: now,
          pgmBy: userName || '', proposalBy: userName || '', performanceBy: userName || '', preScheduleBy: userName || '',
        })

        // 사용자 직접 편성 블록은 유지, default·선편성 블록은 재생성
        const protectedBlocks = Object.fromEntries(
          Object.entries(scheduleBlocks).filter(([, b]) => b && !b.isDefault && !b.isPreSchedule)
        )
        const preBlocks = buildPreScheduleBlocks(pgmSlotsNew, gasData.preScheduleRows || [], protectedBlocks)
        const defBlocks = buildDefaultBlocks(pgmSlotsNew, { ...protectedBlocks, ...preBlocks })
        const blockUpdates = Object.fromEntries(
          Object.entries({ ...defBlocks, ...preBlocks }).map(([key, block]) => [`scheduleBlocks/${key}`, block])
        )
        await update(ref(db, versionPath), {
          ...blockUpdates,
          ...buildEntityPropUpdates(Object.values(preBlocks)),
        })

        const proposalItems = normalizeItemsTeamNames(
          proposalItemsRaw.map((item, i) => buildProposalItem({ ...item, _fbIdx: i })),
          getState().weightedMinTargets
        )

        const perfMap = buildPerfMapFromGas(gasData.perfMap || {})
        getState().seedPerformanceFromPerfMap?.(perfMap)
        getState().invalidatePerformanceKeys?.()
        getState().loadGlobalPerformanceData?.({ force: true })
        setState(s => ({
          pgmSlots:        pgmSlotsNew,
          perfMap,
          performanceMeta: {
            ...(s.performanceMeta || {}),
            updatedAt: now,
            updatedBy: userName || '',
          },
          ...buildPerformanceStateFromRaw(gasData, gasData.perfMap || {}, s),
          preScheduleRows: gasData.preScheduleRows || [],
          allProposalItems: proposalItems,
          proposalItems: filterUnscheduledItems(proposalItems, scheduledItemIds, scheduledUniqueKeys),
          proposalLoaded:  true,
          isLoadingGasAll: false,
          lastUpdated: {
            ...s.lastUpdated,
            pgm: now, proposal: now, performance: now, preSchedule: now,
            pgmBy: userName || '', proposalBy: userName || '', performanceBy: userName || '', preScheduleBy: userName || '',
          },
        }))

        getState()._writeRefreshLog('GAS 전체 재동기화', [
          `슬롯 ${pgmSlotsNew.length}개`,
          `제안상품 ${(gasData.proposalItems || []).length}건`,
          `실적키 ${Object.keys(perfMap).length}건`,
          `선편성 ${(gasData.preScheduleRows || []).length}행`,
        ].join(' · '))

      } catch (e) {
        setState({ error: e.message, isLoadingGasAll: false })
      }
    },

    async refreshPreSchedule() {
      const { startDate, poolType, pgmSlots, scheduleBlocks, userName, entityProps } = getState()
      setState({ isLoadingPreSchedule: true })
      try {
        const { fetchRefreshPreSchedule } = await import('../../api/gas')
        const data = await fetchRefreshPreSchedule()
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()
        const preScheduleRows = data.preScheduleRows || []
        await update(ref(db, `sessions/${weekKey}/gasData`), { preScheduleRows })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { preSchedule: now, preScheduleBy: userName || '' })
        // 사용자가 직접 편성한 블록(isDefault도 isPreSchedule도 아닌)만 보호
        // default·기존선편성 블록은 새 데이터로 덮어씀 (정규화 반영)
        const protectedBlocks = Object.fromEntries(
          Object.entries(scheduleBlocks).filter(([, b]) => b && !b.isDefault && !b.isPreSchedule)
        )
        const newBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, protectedBlocks)
        if (Object.keys(newBlocks).length > 0) {
          const updates = Object.fromEntries(
            Object.entries(newBlocks).map(([key, block]) => [`scheduleBlocks/${key}`, block])
          )
          await update(ref(db, versionPath), {
            ...updates,
            ...buildEntityPropUpdates(Object.values(newBlocks)),
          })
        }
        setState(s => ({
          preScheduleRows,
          isLoadingPreSchedule: false,
          lastUpdated: { ...s.lastUpdated, preSchedule: now, preScheduleBy: userName || '' },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingPreSchedule: false })
      }
    },
  }
}

async function writeGlobalPerformanceData(rawData, rawPerfMap, userName = '') {
  const updates = {}
  const performanceRows = getPerformanceRowsSource(rawData, rawPerfMap)
  const normalizedRows = normalizePerformanceRows(performanceRows)
  normalizedRows.forEach(entry => {
    updates[`performanceEntries/${makePerformanceEntryId(entry)}`] = entry
  })

  const historyByKey = buildHistoryByKeyFromRows(normalizedRows)
  const latestByKey = buildLatestByKeyFromHistory(historyByKey)
  Object.entries(latestByKey).forEach(([perfKey, entry]) => {
    updates[`latestPerfMap/${encodeKey(perfKey)}`] = entry
  })

  if (Object.keys(updates).length > 0) {
    const latestEntry = getLatestEntry(normalizedRows)
    if (latestEntry) {
      updates.performanceMeta = {
        latestTimestamp: latestEntry.broadcastTimestamp,
        latestDate: latestEntry.broadcastDate || '',
        latestTime: latestEntry.broadcastTime || '',
        latestPerfKey: latestEntry.perfKey || '',
        updatedAt: Date.now(),
        updatedBy: userName || '',
      }
    }
    await update(ref(db), updates)
  }
}

async function getGlobalPerformanceCursor() {
  const metaSnap = await get(ref(db, 'performanceMeta'))
  if (metaSnap.exists()) {
    const meta = metaSnap.val() || {}
    return {
      latestDate: getPreviousDate(meta.latestDate || ''),
    }
  }

  const entriesSnap = await get(ref(db, 'performanceEntries'))
  const legacyRowsSnap = entriesSnap.exists() ? null : await get(ref(db, 'performanceRows'))
  const rows = normalizePerformanceRows(entriesSnap.exists()
    ? entriesSnap.val()
    : legacyRowsSnap?.exists()
      ? legacyRowsSnap.val()
      : {})
  const latestEntry = getLatestEntry(rows)
  return {
    latestDate: getPreviousDate(latestEntry?.broadcastDate || ''),
  }
}

function getPreviousDate(value) {
  const dateText = String(value || '').trim()
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dateText
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() - 1)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getLatestEntry(rows = []) {
  return (rows || []).reduce((latest, entry) => {
    if (!entry) return latest
    if (!latest) return entry
    const entryDate = normalizeDateKey(entry.broadcastDate)
    const latestDate = normalizeDateKey(latest.broadcastDate)
    if (entryDate !== latestDate) {
      return entryDate > latestDate ? entry : latest
    }
    if (entry.broadcastTimestamp !== latest.broadcastTimestamp) {
      return entry.broadcastTimestamp > latest.broadcastTimestamp ? entry : latest
    }
    return latest
  }, null)
}

function normalizeDateKey(value) {
  return String(value || '').replace(/\D/g, '')
}

function makePerformanceEntryId(entry) {
  return `${entry.broadcastTimestamp}_${encodeKey(entry.perfKey || '')}`
}

function buildPerformanceStateFromRaw(rawData, rawPerfMap, state) {
  const rows = normalizePerformanceRows(getPerformanceRowsSource(rawData, rawPerfMap))
  if (!rows.length) return {}
  const historyByKey = buildHistoryByKeyFromRows(rows)
  const latestByKey = buildLatestByKeyFromHistory(historyByKey)
  return {
    performanceRows: Object.fromEntries(rows.map(entry => [makePerformanceEntryId(entry), entry])),
    performanceHistoryByKey: {
      ...(state.performanceHistoryByKey || {}),
      ...historyByKey,
    },
    latestPerfByKey: {
      ...(state.latestPerfByKey || {}),
      ...latestByKey,
    },
  }
}

function getPerformanceRowsSource(rawData, rawPerfMap) {
  if (rawData?.performanceRows) return rawData.performanceRows
  if (rawData?.perfRows) return rawData.perfRows
  if (rawData?.rows) return rawData.rows
  if (rawData?.perfHistory) return flattenHistory(rawData.perfHistory)
  if (rawData?.performanceHistory) return flattenHistory(rawData.performanceHistory)
  const source = rawData?.perfMap || rawPerfMap || {}
  const rows = []
  Object.entries(source || {}).forEach(([perfKey, value]) => {
    if (Array.isArray(value)) {
      value.forEach(row => rows.push({ ...row, perfKey: row?.perfKey || perfKey }))
    } else if (value && typeof value === 'object') {
      rows.push({ ...value, perfKey: value.perfKey || perfKey })
    }
  })
  return rows
}

function flattenHistory(history = {}) {
  const rows = []
  Object.entries(history || {}).forEach(([perfKey, entries]) => {
    normalizePerfHistory(entries, perfKey).forEach(entry => rows.push(entry))
  })
  return rows
}
