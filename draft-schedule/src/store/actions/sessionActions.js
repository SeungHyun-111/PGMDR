import { db, ref, set, get } from '../../api/firebase'
import { buildSlot, buildPreScheduleBlocks, buildProposalItem, decodePerfMap, encodePerfMap } from '../helpers/blockBuilders'
import { subscribeRealtimePaths, unsubscribeAll } from '../helpers/firebaseSubscribe'
import { normalizeBlocksTeamNames } from '../../utils/teamName'
import { genKey } from '../../utils/uniqueKey'
import { extractEntityFields, applyEntityProps } from '../../utils/mergeEntity'

const PGM_TEAM_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  itemId: `pgmteam_default_${i + 1}`,
  uniqueKey: `0_pgmteam_${i + 1}`,
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

    async loadInitData(startDate, poolType) {
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
            ...PGM_TEAM_ITEMS,
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
          await set(ref(db, `sessions/${weekKey}/scheduleBlocks`), preBlocks)

          // entityProps 초기화 — 모든 아이템(제안상품 + 선편성블록)의 엔티티 속성 기록
          // buildProposalItem()을 통과시켜 dealTypeConverted 등 정규화된 값으로 저장
          const entityProps = {}
          proposalItems.forEach(item => {
            if (item.uniqueKey) entityProps[item.uniqueKey] = extractEntityFields(buildProposalItem(item))
          })
          Object.values(preBlocks).forEach(block => {
            if (block?.uniqueKey) entityProps[block.uniqueKey] = extractEntityFields(block)
          })
          await set(ref(db, `sessions/${weekKey}/entityProps`), entityProps)
        }

        await getState()._loadFromFirebase(startDate, poolType)
      } catch (e) {
        setState({ error: e.message, isLoading: false })
      }
    },

    async _loadFromFirebase(startDate, poolType) {
      const weekKey = `${startDate}_${poolType}`
      const [
        metaSnap, pgmSnap, perfMapSnap, preSnap, weightedSnap, targetSnap,
        blocksSnap, splitSnap, customSlotsSnap, starredSnap, scheduledSnap, inputsSnap, entitySnap, updatedSnap
      ] = await Promise.all([
        get(ref(db, `sessions/${weekKey}/gasData/meta`)),
        get(ref(db, `sessions/${weekKey}/gasData/pgmSlots`)),
        get(ref(db, `sessions/${weekKey}/gasData/perfMap`)),
        get(ref(db, `sessions/${weekKey}/gasData/preScheduleRows`)),
        get(ref(db, `sessions/${weekKey}/gasData/weightedMinTargets`)),
        get(ref(db, `sessions/${weekKey}/gasData/targetMetrics`)),
        get(ref(db, `sessions/${weekKey}/scheduleBlocks`)),
        get(ref(db, `sessions/${weekKey}/splitSlots`)),
        get(ref(db, `sessions/${weekKey}/customSlots`)),
        get(ref(db, `sessions/${weekKey}/starred`)),
        get(ref(db, `sessions/${weekKey}/scheduledItemIds`)),
        get(ref(db, `sessions/${weekKey}/manualInputs`)),
        get(ref(db, `sessions/${weekKey}/entityProps`)),
        get(ref(db, `sessions/${weekKey}/lastUpdated`)),
      ])

      const meta = metaSnap.exists() ? metaSnap.val() : {}
      const pgmSlots = (pgmSnap.exists() ? pgmSnap.val() : []).map(buildSlot)
      const rawBlocks      = blocksSnap.exists()      ? blocksSnap.val()      : {}
      const splitSlots     = splitSnap.exists()        ? splitSnap.val()        : {}
      const customSlots    = customSlotsSnap.exists()  ? customSlotsSnap.val()  : {}
      const entityProps    = entitySnap.exists()       ? entitySnap.val()       : {}

      const perfMap = perfMapSnap.exists() ? decodePerfMap(perfMapSnap.val()) : {}
      const weightedMinTargets = weightedSnap.exists() ? Object.values(weightedSnap.val()) : []

      const normalizedBlocks = normalizeBlocksTeamNames(rawBlocks, weightedMinTargets)

      setState({
        startDate, endDate: meta.endDate || '', poolType,
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
        starred:            starredSnap.exists()  ? starredSnap.val()               : {},
        scheduledItemIds:   scheduledSnap.exists()? scheduledSnap.val()             : {},
        manualInputs:       inputsSnap.exists()   ? inputsSnap.val() : {},
        lastUpdated:        updatedSnap.exists()  ? updatedSnap.val()               : null,
        isLoaded: true, isLoading: false, proposalLoaded: false,
      })

      // 기존 세션에서 perfMap이 인코딩 없이 저장돼 유실된 경우 자동 복구
      if (Object.keys(perfMap).length === 0) {
        getState().refreshPerformance()
      }

      subscribeRealtimePaths(weekKey, setState, getState)
    },

    async resetSession(startDate, poolType) {
      unsubscribeAll()
      setState({
        isLoading: true, isLoaded: false, error: null,
        startDate: '', endDate: '', poolType: 'A',
        pgmSlots: [], perfMap: {}, preScheduleRows: [],
        weightedMinTargets: [], targetMetrics: null,
        scheduleBlocks: {}, _rawBlocks: {}, entityProps: {},
        splitSlots: {}, customSlots: {}, starred: {},
        scheduledItemIds: {}, manualInputs: {}, lastUpdated: null,
        proposalItems: [], proposalLoaded: false,
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