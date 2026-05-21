// src/store/actions/refreshActions.js
import { db, ref, update } from '../../api/firebase'
import { buildPreScheduleBlocks, buildProposalItem, encodePerfMap } from '../helpers/blockBuilders'

export function createRefreshActions(setState, getState) {
  return {

    async refreshPerformance() {
      const { startDate, poolType } = getState()
      setState({ isLoadingPerformance: true })
      try {
        const { fetchRefreshPerformance } = await import('../../api/gas')
        const rawPerfMap = await fetchRefreshPerformance()
        const encoded = encodePerfMap(rawPerfMap)
        const weekKey = `${startDate}_${poolType}`
        const now = Date.now()
        await update(ref(db, `sessions/${weekKey}/gasData`), { perfMap: encoded })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { performance: now })
        setState(s => ({
          perfMap: rawPerfMap,
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
        const { fetchInitData } = await import('../../api/gas')
        const data = await fetchInitData(startDate, poolType)
        const weekKey = `${startDate}_${poolType}`
        const now = Date.now()
        await update(ref(db, `sessions/${weekKey}/gasData`), { proposalItems: data.proposalItems })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { proposal: now })
        // ↓ getState()로 최신 scheduledItemIds 참조 (클로저 버그 수정)
        const { scheduledItemIds } = getState()
        setState(s => ({
          proposalItems:      data.proposalItems.filter(p => !scheduledItemIds[p.itemId]).map(buildProposalItem),
          proposalLoaded:     true,
          isLoadingProposals: false,
          lastUpdated: { ...s.lastUpdated, proposal: now },
        }))
      } catch (e) {
        setState({ error: e.message, isLoadingProposals: false })
      }
    },

    async refreshPreSchedule() {
      const { startDate, poolType, pgmSlots, scheduleBlocks } = getState()
      try {
        const { fetchInitData } = await import('../../api/gas')
        const data = await fetchInitData(startDate, poolType)
        const weekKey = `${startDate}_${poolType}`
        const now = Date.now()
        const preScheduleRows = data.preScheduleRows || []
        await update(ref(db, `sessions/${weekKey}/gasData`), { preScheduleRows })
        await update(ref(db, `sessions/${weekKey}/lastUpdated`), { preSchedule: now })
        const newBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, scheduleBlocks)
        if (Object.keys(newBlocks).length > 0) {
          await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), newBlocks)
        }
        setState(s => ({
          preScheduleRows,
          lastUpdated: { ...s.lastUpdated, preSchedule: now },
        }))
      } catch (e) {
        setState({ error: e.message })
      }
    },
  }
}