import { db, ref, set, get, update } from '../../api/firebase'
import { buildSlot, buildPreScheduleBlocks, buildProposalItem, decodePerfMap, encodePerfMap } from '../helpers/blockBuilders'
import { subscribeRealtimePaths, unsubscribeAll } from '../helpers/firebaseSubscribe'
import { normalizeBlocksTeamNames, normalizeItemsTeamNames } from '../../utils/teamName'
import { genKey } from '../../utils/uniqueKey'
import { extractEntityFields, applyEntityProps } from '../../utils/mergeEntity'
import { getCompetitionItems } from '../../utils/competition'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'
import { makePerfKey, normalizeDealType } from '../../hooks/usePerformanceMap'
import {
  VERSION_DRAFT,
  VERSION_OPS,
  VERSION_SALES,
  VERSION_DATA_KEYS,
  buildVersionSnapshot,
  getVersionPath,
} from '../../utils/sessionVersion'

const createPgmTeamItems = () => Array.from({ length: 10 }, (_, i) => ({
  itemId: `pgmteam_default_${i + 1}`,
  uniqueKey: genKey('0'),
  pgmCodeName: '[편성팀]',
  mdTeam: '편성팀',
  orgName: '편성팀',
  mdCategory: '전사',
  dealType: '[위]',
  dealTypeConverted: '[위]',
  dealTypeChar: '위',
  memoCode: '[전사블록]',
}))

export function createSessionActions(setState, getState) {
  return {

    async loadInitData(startDate, poolType, versionId = getState().currentVersionId || VERSION_DRAFT) {
      setState({ isLoading: true, error: null })
      try {
        const weekKey = `${startDate}_${poolType}`
        const metaSnap = await get(ref(db, `sessions/${weekKey}/gasData/meta`))

        if (!metaSnap.exists()) {
          const { fetchInitData } = await import('../../api/gas')
          const gasData = await fetchInitData(startDate, poolType)
          const now = Date.now()
          const proposalItems = [
            ...(gasData.proposalItems || []).map(item => ({ ...item, uniqueKey: genKey('1') })),
            ...createPgmTeamItems(),
          ]
          await set(ref(db, `sessions/${weekKey}/gasData`), {
            ...gasData,
            proposalItems,
            perfMap: encodePerfMap(gasData.perfMap || {}),
          })
          await set(ref(db, `sessions/${weekKey}/lastUpdated`), {
            pgm: now, proposal: now, performance: now, preSchedule: now
          })
          const pgmSlots = (gasData.pgmSlots || []).map(buildSlot)
          const preBlocks = buildPreScheduleBlocks(pgmSlots, gasData.preScheduleRows || [], {})

          // entityProps 초기화 — 모든 아이템(제안상품 + 선편성블록)의 엔티티 속성 기록
          // buildProposalItem()을 통과시켜 dealTypeConverted 등 정규화된 값으로 저장
          const entityProps = {}
          proposalItems.forEach(item => {
            if (item.uniqueKey) entityProps[item.uniqueKey] = extractEntityFields(buildProposalItem(item))
          })
          Object.values(preBlocks).forEach(block => {
            if (block?.uniqueKey) entityProps[block.uniqueKey] = extractEntityFields(block)
          })
          await set(ref(db, getVersionPath(weekKey, VERSION_DRAFT)), {
            pgmSlots,
            proposalItems,
            scheduleBlocks: preBlocks,
            entityProps,
            splitSlots: {},
            customSlots: {},
            starred: {},
            scheduledItemIds: {},
            scheduledUniqueKeys: {},
            manualInputs: {},
            createdAt: now,
          })
        }

        await getState()._loadFromFirebase(startDate, poolType, versionId)
      } catch (e) {
        setState({ error: e.message, isLoading: false })
      }
    },

    async _loadFromFirebase(startDate, poolType, versionId = getState().currentVersionId || VERSION_DRAFT) {
      const weekKey = `${startDate}_${poolType}`
      const resolvedVersionId = await ensureVersionData(weekKey, versionId)
      const versionPath = getVersionPath(weekKey, resolvedVersionId)
      const [
        metaSnap, pgmSnap, perfMapSnap, preSnap, weightedSnap, targetSnap, versionSnap, versionMetaSnap, updatedSnap
      ] = await Promise.all([
        get(ref(db, `sessions/${weekKey}/gasData/meta`)),
        get(ref(db, `sessions/${weekKey}/gasData/pgmSlots`)),
        get(ref(db, `sessions/${weekKey}/gasData/perfMap`)),
        get(ref(db, `sessions/${weekKey}/gasData/preScheduleRows`)),
        get(ref(db, `sessions/${weekKey}/gasData/weightedMinTargets`)),
        get(ref(db, `sessions/${weekKey}/gasData/targetMetrics`)),
        get(ref(db, versionPath)),
        get(ref(db, `sessions/${weekKey}/versionMeta`)),
        get(ref(db, `sessions/${weekKey}/lastUpdated`)),
      ])

      const meta = metaSnap.exists() ? metaSnap.val() : {}
      const versionData = versionSnap.exists() ? versionSnap.val() : {}
      const rawBlocks      = versionData.scheduleBlocks || {}
      const splitSlots     = versionData.splitSlots || {}
      const customSlots    = versionData.customSlots || {}
      const entityProps    = versionData.entityProps || {}
      const pgmSlots = resolveVersionSlots(versionData, pgmSnap.exists() ? pgmSnap.val() : [], rawBlocks, splitSlots)

      const perfMap = perfMapSnap.exists() ? decodePerfMap(perfMapSnap.val()) : {}
      const weightedMinTargets = weightedSnap.exists() ? Object.values(weightedSnap.val()) : []

      const normalizedBlocks = normalizeBlocksTeamNames(rawBlocks, weightedMinTargets)
      const storedScheduledUniqueKeys = versionData.scheduledUniqueKeys || {}
      const scheduledUniqueKeys = { ...storedScheduledUniqueKeys }
      Object.values(rawBlocks).forEach(block => {
        if (!block || block.isDefault) return
        if (block.isCompeting) {
          getCompetitionItems(block).forEach(item => {
            if (item?.uniqueKey) scheduledUniqueKeys[item.uniqueKey] = true
          })
          return
        }
        if (block.uniqueKey) scheduledUniqueKeys[block.uniqueKey] = true
      })
      if (Object.keys(scheduledUniqueKeys).length > Object.keys(storedScheduledUniqueKeys).length) {
        await set(ref(db, `${versionPath}/scheduledUniqueKeys`), scheduledUniqueKeys)
      }
      const rawProposalItems = versionData.proposalItems || []
      const proposalEntries = Array.isArray(rawProposalItems)
        ? rawProposalItems.flatMap((v, i) => v ? [{ ...v, _fbIdx: i }] : [])
        : Object.entries(rawProposalItems).flatMap(([k, v]) => v ? [{ ...v, _fbIdx: k }] : [])
      const allProposalItems = applyEntityProps(
        normalizeItemsTeamNames(proposalEntries.map(buildProposalItem), weightedMinTargets),
        entityProps
      )

      const versionMeta = versionMetaSnap.exists() ? versionMetaSnap.val() : {}
      const shouldUseViewerMode = shouldDefaultToViewerMode(resolvedVersionId, versionMeta)
      if (shouldUseViewerMode) localStorage.setItem('isViewerMode', 'true')

      setState({
        startDate, endDate: meta.endDate || '', poolType,
        currentVersionId: resolvedVersionId,
        versionMeta,
        ...(shouldUseViewerMode ? { isViewerMode: true } : {}),
        pgmSlots,
        perfMap,
        preScheduleRows:    preSnap.exists()      ? preSnap.val()      : [],
        weightedMinTargets,
        targetMetrics:      targetSnap.exists()   ? targetSnap.val()   : null,
        _rawBlocks:         rawBlocks,
        scheduleBlocks:     applyEntityProps(normalizedBlocks, entityProps),
        entityProps,
        splitSlots,
        customSlots,
        starred:            versionData.starred || {},
        scheduledItemIds:   versionData.scheduledItemIds || {},
        scheduledUniqueKeys,
        manualInputs:       versionData.manualInputs || {},
        allProposalItems,
        proposalItems:      filterUnscheduledItems(allProposalItems, versionData.scheduledItemIds || {}, scheduledUniqueKeys),
        lastUpdated:        updatedSnap.exists()  ? updatedSnap.val()               : null,
        isLoaded: true, isLoading: false, proposalLoaded: true,
      })

      // 기존 세션에서 perfMap이 인코딩 없이 저장돼 유실된 경우 자동 복구
      if (Object.keys(perfMap).length === 0) {
        getState().refreshPerformance()
      }

      subscribeRealtimePaths(weekKey, resolvedVersionId, setState, getState)
    },

    async setSessionVersion(versionId) {
      const { startDate, poolType } = getState()
      if (!startDate || !poolType) return
      localStorage.setItem('currentVersionId', versionId)
      await getState()._loadFromFirebase(startDate, poolType, versionId)
    },

    async syncOpsVersionFromGas() {
      const { startDate, endDate, poolType, userName, weightedMinTargets } = getState()
      if (!startDate || !poolType) throw new Error('먼저 세션을 선택하세요.')

      const { syncOpsVersion } = await import('../../api/gas')
      const payload = await syncOpsVersion({
        startDate,
        endDate: endDate || getFallbackEndDate(startDate),
        poolType,
        userName,
        sheetName: 'PGM',
      })
      const weekKey = `${startDate}_${poolType}`
      const updatedAt = Date.now()
      const updatedBy = userName || ''
      const rawBlocks = payload.scheduleBlocks || {}
      const scheduleBlocks = {}
      const entityProps = {}
      const scheduledUniqueKeys = {}

      Object.entries(rawBlocks).forEach(([blockKey, block]) => {
        if (!block) return
        const uniqueKey = block.uniqueKey || genKey('2')
        const withKey = normalizeOpsBlockBeforeSave({ ...block, uniqueKey })
        const normalizedTeamBlock = normalizeBlocksTeamNames({ [blockKey]: withKey }, weightedMinTargets)?.[blockKey] || withKey
        const dealType = normalizeDealType(normalizedTeamBlock.dealTypeConverted || normalizedTeamBlock.dealType)
        const nextBlock = {
          ...normalizedTeamBlock,
          dealType,
          dealTypeConverted: dealType,
          dealTypeChar: getDealTypeChar(dealType),
          perfKey: makePerfKey(dealType, normalizedTeamBlock.pgmCodeName),
        }
        scheduleBlocks[blockKey] = nextBlock
        entityProps[uniqueKey] = extractEntityFields(nextBlock)
        scheduledUniqueKeys[uniqueKey] = true
      })

      await set(ref(db, getVersionPath(weekKey, VERSION_OPS)), {
        pgmSlots: (payload.pgmSlots || []).map(buildSlot),
        proposalItems: [],
        scheduleBlocks,
        entityProps,
        splitSlots: payload.splitSlots || {},
        customSlots: {},
        starred: {},
        scheduledItemIds: {},
        scheduledUniqueKeys,
        manualInputs: {},
        updatedAt,
        updatedBy,
        sourceVersionId: 'ops_sheet',
      })
      await set(ref(db, `sessions/${weekKey}/versionMeta/${VERSION_OPS}`), {
        updatedAt,
        updatedBy,
        sourceVersionId: 'ops_sheet',
        sheetName: payload.sheetName || 'PGM',
      })
      await update(ref(db, `sessions/${weekKey}/gasData/meta`), {
        startDate: payload.startDate || startDate,
        endDate: payload.endDate || endDate || getFallbackEndDate(startDate),
        poolType,
        opsSyncedAt: updatedAt,
        opsSyncedBy: updatedBy,
        opsSlotCount: (payload.pgmSlots || []).length,
      })

      localStorage.setItem('currentVersionId', VERSION_OPS)
      await getState()._loadFromFirebase(startDate, poolType, VERSION_OPS)
      return payload
    },

    async publishSalesVersion() {
      const { startDate, poolType, userName } = getState()
      if (!startDate || !poolType) return
      setState({ isPublishingSales: true })
      try {
        const weekKey = `${startDate}_${poolType}`
        const snapshot = buildVersionSnapshot(getState())
        const publishedAt = snapshot.publishedAt
        await set(ref(db, getVersionPath(weekKey, VERSION_SALES)), snapshot)
        await set(ref(db, `sessions/${weekKey}/versionMeta/${VERSION_SALES}`), {
          publishedAt,
          publishedBy: userName || '',
          sourceVersionId: VERSION_DRAFT,
        })
        await writePublishLogs(weekKey, {
          timestamp: publishedAt,
          userName,
          before: null,
          after: {
            publishedAt,
            sourceVersionId: VERSION_DRAFT,
            targetVersionId: VERSION_SALES,
          },
        })
        setState(s => ({
          isPublishingSales: false,
          isViewerMode: true,
          versionMeta: {
            ...(s.versionMeta || {}),
            [VERSION_SALES]: {
              ...((s.versionMeta || {})[VERSION_SALES] || {}),
              publishedAt,
              publishedBy: userName || '',
              sourceVersionId: VERSION_DRAFT,
            },
          },
        }))
        localStorage.setItem('isViewerMode', 'true')
      } catch (e) {
        setState({ error: e.message, isPublishingSales: false })
      }
    },

    async resetSession(startDate, poolType) {
      unsubscribeAll()
      setState({
        isLoading: true, isLoaded: false, error: null,
        startDate: '', endDate: '', poolType: 'A',
        currentVersionId: VERSION_DRAFT, versionMeta: {}, isPublishingSales: false,
        pgmSlots: [], perfMap: {}, preScheduleRows: [],
        weightedMinTargets: [], targetMetrics: null,
        scheduleBlocks: {}, _rawBlocks: {}, entityProps: {},
        splitSlots: {}, customSlots: {}, starred: {},
        scheduledItemIds: {}, scheduledUniqueKeys: {}, manualInputs: {}, lastUpdated: null,
        allProposalItems: [], proposalItems: [], proposalLoaded: false,
      })
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}`), null)
      await getState().loadInitData(startDate, poolType)

      const { userName } = getState()
      const sessionMeta = { weekKey, startDate, poolType, createdAt: Date.now(), createdBy: userName || '' }
      await set(ref(db, `activeSessions/${weekKey}`), sessionMeta)
    },

    async deleteSession(weekKey) {
      await Promise.all([
        set(ref(db, `sessions/${weekKey}`), null),
        set(ref(db, `activeSessions/${weekKey}`), null),
      ])
    },
  }
}

function shouldDefaultToViewerMode(versionId, versionMeta) {
  return versionId === VERSION_DRAFT && !!versionMeta?.[VERSION_SALES]?.publishedAt
}

function getFallbackEndDate(startDate) {
  if (!startDate) return ''
  const d = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function getDealTypeChar(dealType) {
  return String(dealType || '').match(/\[(.)\]/)?.[1] || '위'
}

function normalizeOpsBlockBeforeSave(block) {
  const mdTeam = normalizeOpsTeamName(block.mdTeam || block.orgName || '')
  return {
    ...block,
    mdTeam,
    orgName: mdTeam,
    newProductType: normalizeOpsNewProductType(block.newProductType),
  }
}

function normalizeOpsTeamName(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.endsWith('팀') ? raw : `${raw}팀`
}

function normalizeOpsNewProductType(value) {
  const raw = String(value || '').trim()
  if (raw === '(재)' || raw === '재녹화') return '재녹화'
  if (raw === '(신)' || raw === '신상품') return '신상품'
  return '기존'
}

function resolveVersionSlots(versionData, fallbackSlots, rawBlocks, splitSlots) {
  if (Array.isArray(versionData.pgmSlots) && versionData.pgmSlots.length) {
    return versionData.pgmSlots.map(buildSlot)
  }

  const fallback = Array.isArray(fallbackSlots) ? fallbackSlots.map(buildSlot) : []
  const fallbackIds = new Set(fallback.map(slot => slot.slotId))
  const blockSlotIds = new Set(
    Object.values(rawBlocks || {})
      .filter(block => block?.slotId)
      .map(block => block.slotId)
  )
  const allBlocksMatchFallback = blockSlotIds.size === 0 || [...blockSlotIds].every(slotId => fallbackIds.has(slotId))
  if (fallback.length && allBlocksMatchFallback) return fallback

  const bySlot = {}
  Object.values(rawBlocks || {}).forEach(block => {
    if (!block?.slotId || !block.dateKey || !block.timeText) return
    const existing = bySlot[block.slotId]
    const weightedMin = Number(block.weightedMin || 0)
    if (!existing) {
      bySlot[block.slotId] = {
        slotId: block.slotId,
        dateKey: block.dateKey,
        timeText: block.timeText,
        durationMin: Number(block.durationMin || 0),
        weightedMin,
        channel: 'ALL',
      }
      return
    }
    if (splitSlots?.[block.slotId]) existing.weightedMin += weightedMin
    else existing.weightedMin = Math.max(existing.weightedMin || 0, weightedMin)
    existing.durationMin = Math.max(existing.durationMin || 0, Number(block.durationMin || 0))
  })

  const rebuilt = Object.values(bySlot)
  return rebuilt.length ? rebuilt.map(buildSlot) : fallback
}

async function writePublishLogs(weekKey, { timestamp, userName, before, after }) {
  const baseLog = {
    timestamp,
    action: '공유본 갱신',
    blockKey: '',
    pgmCodeName: '',
    dateKey: '',
    timeText: '',
    channel: '',
    userName: userName || '익명',
    before,
    after,
    scope: 'schedule',
    detail: '담당 작성본을 영업팀 공유본으로 갱신',
  }
  await Promise.all([
    set(ref(db, `sessions/${weekKey}/logs/log_${timestamp}_${VERSION_DRAFT}`), {
      ...baseLog,
      versionId: VERSION_DRAFT,
    }),
    set(ref(db, `sessions/${weekKey}/logs/log_${timestamp}_${VERSION_SALES}`), {
      ...baseLog,
      versionId: VERSION_SALES,
    }),
  ])
}

async function ensureVersionData(weekKey, versionId) {
  const targetSnap = await get(ref(db, getVersionPath(weekKey, versionId)))
  if (targetSnap.exists()) return versionId

  if (versionId === VERSION_SALES) {
    const draftSnap = await get(ref(db, getVersionPath(weekKey, VERSION_DRAFT)))
    if (draftSnap.exists()) return VERSION_DRAFT
  }

  if (versionId === VERSION_OPS) {
    return VERSION_OPS
  }

  const snaps = await Promise.all([
    get(ref(db, `sessions/${weekKey}/gasData/proposalItems`)),
    ...VERSION_DATA_KEYS
      .filter(key => key !== 'proposalItems')
      .map(key => get(ref(db, `sessions/${weekKey}/${key}`))),
  ])
  const hasLegacyData = snaps.some(snap => snap.exists())
  if (!hasLegacyData) return versionId

  const [proposalSnap, ...dataSnaps] = snaps
  const migrated = {
    pgmSlots: dataSnaps[0]?.exists() ? dataSnaps[0].val() : [],
    proposalItems: proposalSnap.exists() ? proposalSnap.val() : [],
    migratedAt: Date.now(),
  }
  VERSION_DATA_KEYS.filter(key => key !== 'proposalItems').forEach((key, i) => {
    migrated[key] = dataSnaps[i].exists() ? dataSnaps[i].val() : {}
  })
  await set(ref(db, getVersionPath(weekKey, VERSION_DRAFT)), migrated)
  return VERSION_DRAFT
}
