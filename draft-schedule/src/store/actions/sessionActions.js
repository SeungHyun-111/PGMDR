import { db, ref, set, get, update } from '../../api/firebase'
import { buildSlot, buildDefaultBlocks, buildPreScheduleBlocks, decodePerfMap } from '../helpers/blockBuilders'
import { subscribeRealtimePaths, unsubscribeAll } from '../helpers/firebaseSubscribe'

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
          await set(ref(db, `sessions/${weekKey}/gasData`), gasData)
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

      const missing = buildDefaultBlocks(pgmSlots, scheduleBlocks)
      if (Object.keys(missing).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), missing)
        scheduleBlocks = { ...scheduleBlocks, ...missing }
      }

      setState({
        startDate, endDate: meta.endDate || '', poolType,
        pgmSlots,
        perfMap:            perfMapSnap.exists() ? decodePerfMap(perfMapSnap.val()) : {},
        preScheduleRows:    preSnap.exists()      ? preSnap.val()                   : [],
        weightedMinTargets: weightedSnap.exists() ? Object.values(weightedSnap.val()): [],
        targetMetrics:      targetSnap.exists()   ? targetSnap.val()                : null,
        scheduleBlocks,
        splitSlots:         splitSnap.exists()    ? splitSnap.val()                 : {},
        starred:            starredSnap.exists()  ? starredSnap.val()               : {},
        scheduledItemIds:   scheduledSnap.exists()? scheduledSnap.val()             : {},
        manualInputs:       inputsSnap.exists()   ? inputsSnap.val()                : {},
        lastUpdated:        updatedSnap.exists()  ? updatedSnap.val()               : null,
        isLoaded: true, isLoading: false, proposalLoaded: false,
      })

      subscribeRealtimePaths(weekKey, setState)
    },

    async resetSession(startDate, poolType) {
      setState({ isLoading: true, error: null, isLoaded: false })
      unsubscribeAll()
      await set(ref(db, `sessions/${startDate}_${poolType}`), null)
      setState({
        scheduleBlocks: {}, splitSlots: {}, starred: {},
        scheduledItemIds: {}, manualInputs: {}, lastUpdated: null,
        proposalItems: [], proposalLoaded: false,
        pgmSlots: [], perfMap: {}, preScheduleRows: [],
      })
      await getState().loadInitData(startDate, poolType)
    },
  }
}