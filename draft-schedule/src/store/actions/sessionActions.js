import { db, ref, set, get, update } from '../../api/firebase'
import { buildSlot, buildDefaultBlocks, buildPreScheduleBlocks, decodePerfMap, encodePerfMap } from '../helpers/blockBuilders'
import { subscribeRealtimePaths, unsubscribeAll } from '../helpers/firebaseSubscribe'

function decodeMapKeys(obj) {
  if (!obj) return {}
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/__LB__/g, '[').replace(/__RB__/g, ']'), v])
  )
}

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
          await set(ref(db, `sessions/${weekKey}/gasData`), {
            ...gasData,
            perfMap: encodePerfMap(gasData.perfMap || {}),
          })
          await set(ref(db, `sessions/${weekKey}/lastUpdated`), {
            pgm: now, proposal: now, performance: now, preSchedule: now
          })
          const pgmSlots = (gasData.pgmSlots || []).map(buildSlot)
          const preBlocks = buildPreScheduleBlocks(pgmSlots, gasData.preScheduleRows || [], {})
          const defaultBlocks = buildDefaultBlocks(pgmSlots, preBlocks)
          await set(ref(db, `sessions/${weekKey}/scheduleBlocks`), { ...defaultBlocks, ...preBlocks })
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
        blocksSnap, splitSnap, starredSnap, scheduledSnap, inputsSnap, updatedSnap
      ] = await Promise.all([
        get(ref(db, `sessions/${weekKey}/gasData/meta`)),
        get(ref(db, `sessions/${weekKey}/gasData/pgmSlots`)),
        get(ref(db, `sessions/${weekKey}/gasData/perfMap`)),
        get(ref(db, `sessions/${weekKey}/gasData/preScheduleRows`)),
        get(ref(db, `sessions/${weekKey}/gasData/weightedMinTargets`)),
        get(ref(db, `sessions/${weekKey}/gasData/targetMetrics`)),
        get(ref(db, `sessions/${weekKey}/scheduleBlocks`)),
        get(ref(db, `sessions/${weekKey}/splitSlots`)),
        get(ref(db, `sessions/${weekKey}/starred`)),
        get(ref(db, `sessions/${weekKey}/scheduledItemIds`)),
        get(ref(db, `sessions/${weekKey}/manualInputs`)),
        get(ref(db, `sessions/${weekKey}/lastUpdated`)),
      ])

      const meta = metaSnap.exists() ? metaSnap.val() : {}
      const pgmSlots = (pgmSnap.exists() ? pgmSnap.val() : []).map(buildSlot)
      let scheduleBlocks = blocksSnap.exists() ? blocksSnap.val() : {}
      const splitSlots = splitSnap.exists() ? splitSnap.val() : {}

      // 분리 슬롯에 ghost default 블록(slotId 키)이 남아있으면 제거
      const ghostKeys = Object.keys(splitSlots).filter(id => scheduleBlocks[id]?.pgmCodeName === '[편성팀]')
      if (ghostKeys.length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`),
          Object.fromEntries(ghostKeys.map(id => [id, null])))
        ghostKeys.forEach(id => delete scheduleBlocks[id])
      }

      const missing = buildDefaultBlocks(pgmSlots, scheduleBlocks, splitSlots)
      if (Object.keys(missing).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), missing)
        scheduleBlocks = { ...scheduleBlocks, ...missing }
      }

      const perfMap = perfMapSnap.exists() ? decodePerfMap(perfMapSnap.val()) : {}

      setState({
        startDate, endDate: meta.endDate || '', poolType,
        pgmSlots,
        perfMap,
        preScheduleRows:    preSnap.exists()      ? preSnap.val()                   : [],
        weightedMinTargets: weightedSnap.exists() ? Object.values(weightedSnap.val()): [],
        targetMetrics:      targetSnap.exists()   ? targetSnap.val()                : null,
        scheduleBlocks,
        splitSlots,
        starred:            starredSnap.exists()  ? starredSnap.val()               : {},
        scheduledItemIds:   scheduledSnap.exists()? scheduledSnap.val()             : {},
        manualInputs:       inputsSnap.exists()   ? decodeMapKeys(inputsSnap.val()) : {},
        lastUpdated:        updatedSnap.exists()  ? updatedSnap.val()               : null,
        isLoaded: true, isLoading: false, proposalLoaded: false,
      })

      // 기존 세션에서 perfMap이 인코딩 없이 저장돼 유실된 경우 자동 복구
      if (Object.keys(perfMap).length === 0) {
        getState().refreshPerformance()
      }

      subscribeRealtimePaths(weekKey, setState)
    },

    async resetSession(startDate, poolType) {
      unsubscribeAll()
      // 먼저 UI를 완전 초기 상태로 리셋 (스토어 잔존 데이터 즉시 제거)
      setState({
        isLoading: true, isLoaded: false, error: null,
        startDate: '', endDate: '', poolType: 'A',
        pgmSlots: [], perfMap: {}, preScheduleRows: [],
        weightedMinTargets: [], targetMetrics: null,
        scheduleBlocks: {}, splitSlots: {}, starred: {},
        scheduledItemIds: {}, manualInputs: {}, lastUpdated: null,
        proposalItems: [], proposalLoaded: false,
      })
      // Firebase 해당 세션 완전 삭제 → loadInitData가 GAS 강제 호출
      await set(ref(db, `sessions/${startDate}_${poolType}`), null)
      await getState().loadInitData(startDate, poolType)
      // 새 편성 시작 완료 → 협업 포인터 갱신 (다른 접속자 자동 합류 트리거)
      await set(ref(db, 'activeSession'), {
        weekKey: `${startDate}_${poolType}`,
        startDate,
        poolType,
        setAt: Date.now(),
      })
    },
  }
}