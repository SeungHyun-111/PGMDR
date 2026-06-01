// src/store/actions/refreshActions.js
import { db, ref, set, update } from '../../api/firebase'
import { buildPreScheduleBlocks, buildDefaultBlocks, buildSlot, buildProposalItem, encodePerfMap, buildPerfMapFromGas } from '../helpers/blockBuilders'
import { genKey } from '../../utils/uniqueKey'
import { normalizeItemsTeamNames } from '../../utils/teamName'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'
import { getCurrentVersionPath } from '../../utils/sessionVersion'

function withStableUniqueKeys(items, previousItems = []) {
  const itemIdCounts = previousItems.reduce((counts, item) => {
    if (!item?.itemId) return counts
    counts[item.itemId] = (counts[item.itemId] || 0) + 1
    return counts
  }, {})
  const singlePreviousByItemId = new Map(
    previousItems
      .filter(item => item?.itemId && itemIdCounts[item.itemId] === 1)
      .map(item => [item.itemId, item])
  )

  return items.map((item, i) => ({
    ...item,
    uniqueKey: item.uniqueKey
      || previousItems[i]?.uniqueKey
      || singlePreviousByItemId.get(item.itemId)?.uniqueKey
      || genKey('1'),
  }))
}

export function createRefreshActions(setState, getState) {
  return {

    async refreshPerformance() {
      const { startDate, poolType } = getState()
      setState({ isLoadingPerformance: true })
      try {
        const { fetchRefreshPerformance } = await import('../../api/gas')
        const rawData = await fetchRefreshPerformance()
        // GAS가 { perfMap: {...} } 래핑 형태로 반환하는 경우 unwrap
        const rawPerfMap = (rawData && rawData.perfMap) ? rawData.perfMap : rawData
        // buildPerfMapFromGas: 배열/map-of-arrays/flat-map 모두 처리 + 연도 포함 최신값 선택
        const perfMap = buildPerfMapFromGas(rawPerfMap)
        const encoded = encodePerfMap(rawPerfMap)
        const weekKey = `${startDate}_${poolType}`
        const now = Date.now()
        await update(ref(db, `sessions/${weekKey}/gasData`), { perfMap: encoded })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { performance: now })
        setState(s => ({
          perfMap,
          isLoadingPerformance: false,
          lastUpdated: { ...s.lastUpdated, performance: now },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingPerformance: false })
      }
    },

    async refreshProposals() {
      const { startDate, poolType } = getState()
      setState({ isLoadingProposals: true })
      try {
        const { fetchRefreshProposals } = await import('../../api/gas')
        const data = await fetchRefreshProposals(poolType)
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()
        const { weightedMinTargets, allProposalItems, scheduledItemIds, scheduledUniqueKeys } = getState()
        const proposalItemsRaw = withStableUniqueKeys(data.proposalItems || [], allProposalItems)
        await update(ref(db, versionPath), { proposalItems: proposalItemsRaw })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { proposal: now })
        const allItems = normalizeItemsTeamNames(
          proposalItemsRaw.map((item, i) => buildProposalItem({ ...item, _fbIdx: i })),
          weightedMinTargets
        )
        setState(s => ({
          allProposalItems:   allItems,
          proposalItems:      filterUnscheduledItems(allItems, scheduledItemIds, scheduledUniqueKeys),
          proposalLoaded:     true,
          isLoadingProposals: false,
          lastUpdated: { ...s.lastUpdated, proposal: now },
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
      const { startDate, poolType, scheduleBlocks, allProposalItems, scheduledItemIds, scheduledUniqueKeys } = getState()
      setState({ isLoadingGasAll: true })
      try {
        const { fetchInitData } = await import('../../api/gas')
        const gasData = await fetchInitData(startDate, poolType)
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()

        // gasData 전체를 정규화하여 Firebase에 덮어씀
        const proposalItemsRaw = withStableUniqueKeys(gasData.proposalItems || [], allProposalItems)
        await set(ref(db, `sessions/${weekKey}/gasData`), {
          ...gasData,
          proposalItems: proposalItemsRaw,
          perfMap: encodePerfMap(gasData.perfMap || {}),
        })
        await update(ref(db, versionPath), { proposalItems: proposalItemsRaw })
        await set(ref(db, `sessions/${weekKey}/lastUpdated`), {
          pgm: now, proposal: now, performance: now, preSchedule: now,
        })

        // 사용자 직접 편성 블록은 유지, default·선편성 블록은 재생성
        const pgmSlotsNew = (gasData.pgmSlots || []).map(buildSlot)
        const protectedBlocks = Object.fromEntries(
          Object.entries(scheduleBlocks).filter(([, b]) => b && !b.isDefault && !b.isPreSchedule)
        )
        const preBlocks = buildPreScheduleBlocks(pgmSlotsNew, gasData.preScheduleRows || [], protectedBlocks)
        const defBlocks = buildDefaultBlocks(pgmSlotsNew, { ...protectedBlocks, ...preBlocks })
        await update(ref(db, `${versionPath}/scheduleBlocks`), { ...defBlocks, ...preBlocks })

        const proposalItems = normalizeItemsTeamNames(
          proposalItemsRaw.map((item, i) => buildProposalItem({ ...item, _fbIdx: i })),
          getState().weightedMinTargets
        )

        const perfMap = buildPerfMapFromGas(gasData.perfMap || {})
        setState(s => ({
          pgmSlots:        pgmSlotsNew,
          perfMap,
          preScheduleRows: gasData.preScheduleRows || [],
          allProposalItems: proposalItems,
          proposalItems: filterUnscheduledItems(proposalItems, scheduledItemIds, scheduledUniqueKeys),
          proposalLoaded:  true,
          isLoadingGasAll: false,
          lastUpdated: { ...s.lastUpdated, pgm: now, proposal: now, performance: now, preSchedule: now },
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
      const { startDate, poolType, pgmSlots, scheduleBlocks } = getState()
      setState({ isLoadingPreSchedule: true })
      try {
        const { fetchRefreshPreSchedule } = await import('../../api/gas')
        const data = await fetchRefreshPreSchedule()
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const now = Date.now()
        const preScheduleRows = data.preScheduleRows || []
        await update(ref(db, `sessions/${weekKey}/gasData`), { preScheduleRows })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { preSchedule: now })
        // 사용자가 직접 편성한 블록(isDefault도 isPreSchedule도 아닌)만 보호
        // default·기존선편성 블록은 새 데이터로 덮어씀 (정규화 반영)
        const protectedBlocks = Object.fromEntries(
          Object.entries(scheduleBlocks).filter(([, b]) => b && !b.isDefault && !b.isPreSchedule)
        )
        const newBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, protectedBlocks)
        if (Object.keys(newBlocks).length > 0) {
          await update(ref(db, `${versionPath}/scheduleBlocks`), newBlocks)
        }
        setState(s => ({
          preScheduleRows,
          isLoadingPreSchedule: false,
          lastUpdated: { ...s.lastUpdated, preSchedule: now },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingPreSchedule: false })
      }
    },
  }
}
