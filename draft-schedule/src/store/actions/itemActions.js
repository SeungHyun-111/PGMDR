import { db, ref, set, update, get } from '../../api/firebase'
import { buildProposalItem } from '../helpers/blockBuilders'

export function createItemActions(setState, getState) {
  return {

    async loadProposals() {
      const { startDate, poolType, proposalLoaded, scheduledItemIds } = getState()
      if (proposalLoaded) return
      setState({ isLoadingProposals: true })
      try {
        const weekKey = `${startDate}_${poolType}`
        const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
        const all  = snap.exists() ? snap.val() : []
        setState({
          proposalItems:      all.filter(p => !scheduledItemIds[p.itemId]).map(buildProposalItem),
          proposalLoaded:     true,
          isLoadingProposals: false,
        })
      } catch (e) {
        setState({ error: e.message, isLoadingProposals: false })
      }
    },

    async scheduleItem(itemId) {
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${itemId}`), true)
      setState(s => ({ proposalItems: s.proposalItems.filter(p => p.itemId !== itemId) }))
    },

    async toggleSplitSlot(slotId) {
      const { startDate, poolType, splitSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}/splitSlots/${slotId}`), splitSlots[slotId] ? null : true)
    },

    async toggleStarred(itemId) {
      const { startDate, poolType, starred } = getState()
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}/starred/${itemId}`), starred[itemId] ? null : true)
    },

    async saveManualInput(perfKey, data) {
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      await update(ref(db, `sessions/${weekKey}/manualInputs/${perfKey}`), data)
    },

    setUserName(name) {
      localStorage.setItem('userName', name)
      setState({ userName: name })
    },

    loadStarred() {},
  }
}