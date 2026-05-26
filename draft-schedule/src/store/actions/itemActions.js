import { db, ref, set, update, get } from '../../api/firebase'
import { buildProposalItem } from '../helpers/blockBuilders'
import { genKey } from '../../utils/uniqueKey'
import { normalizeItemsTeamNames } from '../../utils/teamName'
import { applyEntityProps } from '../../utils/mergeEntity'

export function createItemActions(setState, getState) {
  return {

    async loadProposals() {
      const { startDate, poolType, proposalLoaded } = getState()
      if (proposalLoaded) return
      setState({ isLoadingProposals: true })
      try {
        const weekKey = `${startDate}_${poolType}`
        const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
        const raw  = snap.exists() ? snap.val() : []
        const entries = Array.isArray(raw)
          ? raw.map((v, i) => ({ ...v, _fbIdx: i }))
          : Object.entries(raw).map(([k, v]) => ({ ...v, _fbIdx: k }))
        const { weightedMinTargets, entityProps } = getState()
        const items = applyEntityProps(
          normalizeItemsTeamNames(entries.map(buildProposalItem), weightedMinTargets),
          entityProps
        )
        setState({
          proposalItems:      items,
          proposalLoaded:     true,
          isLoadingProposals: false,
        })
      } catch (e) {
        setState({ error: e.message, isLoadingProposals: false })
      }
    },

    async updateProposalItem(itemId, fbIdx, patch) {
      const { startDate, poolType, proposalItems } = getState()
      // fbIdx가 없으면 현재 state 순서로 보정
      const resolvedIdx = (fbIdx !== undefined && fbIdx !== null)
        ? fbIdx
        : proposalItems.findIndex(p => p.itemId === itemId)
      if (resolvedIdx < 0) return
      const weekKey = `${startDate}_${poolType}`
      await update(ref(db, `sessions/${weekKey}/gasData/proposalItems/${resolvedIdx}`), patch)
      setState(s => ({
        proposalItems: s.proposalItems.map(p =>
          p.itemId === itemId ? buildProposalItem({ ...p, ...patch }) : p
        ),
      }))
    },

    async addProposalItem(itemData) {
      const { startDate, poolType, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const fbIdx = proposalItems.length
      // _fbIdx는 내부 메타 — Firebase에는 저장하지 않음
      const newItem = { ...itemData, itemId: `manual_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${fbIdx}`), newItem)
      setState(s => ({
        proposalItems: [...s.proposalItems, buildProposalItem({ ...newItem, _fbIdx: fbIdx })],
      }))
    },

    async deleteProposalItem(itemId) {
      const { startDate, poolType, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const item = proposalItems.find(p => p.itemId === itemId)
      if (!item) return
      if (item._fbIdx !== undefined && item._fbIdx !== null) {
        await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${item._fbIdx}`), null)
      }
      setState(s => ({ proposalItems: s.proposalItems.filter(p => p.itemId !== itemId) }))
    },

    async duplicateProposalItem(itemId) {
      const { startDate, poolType, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const orig = proposalItems.find(p => p.itemId === itemId)
      if (!orig) return
      const fbIdx = proposalItems.length
      const { _fbIdx, ...rest } = orig
      const newItem = { ...rest, itemId: `dup_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${fbIdx}`), newItem)
      setState(s => ({ proposalItems: [...s.proposalItems, buildProposalItem({ ...newItem, _fbIdx: fbIdx })] }))
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

    async saveEntityProps(uniqueKey, data) {
      if (!uniqueKey) return
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      await update(ref(db, `sessions/${weekKey}/entityProps/${uniqueKey}`), data)
    },

    async saveManualInput(uniqueKey, data) {
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      await update(ref(db, `sessions/${weekKey}/manualInputs/${uniqueKey}`), data)
    },

    setUserName(name) {
      localStorage.setItem('userName', name)
      setState({ userName: name })
    },
  }
}