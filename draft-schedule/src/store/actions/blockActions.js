import { db, ref, set, get, update } from '../../api/firebase'
import { makeDefaultBlock, buildProposalItem } from '../helpers/blockBuilders'

export function createBlockActions(setState, getState) {
  return {

    async saveBlock(blockKey, patch) {
      const { startDate, poolType, scheduleBlocks } = getState()
      const weekKey = `${startDate}_${poolType}`
      const before = scheduleBlocks[blockKey] || null
      await update(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), patch)
      if (patch.isDefault !== true) {
        getState()._writeLog(before ? '수정' : '편성', blockKey, before, { ...before, ...patch })
      }
    },

    async removeBlock(blockKey) {
      const { startDate, poolType, pgmSlots, scheduleBlocks } = getState()
      const weekKey = `${startDate}_${poolType}`
      const block = scheduleBlocks[blockKey]

      if (block?.itemId && !block.isDefault && !block.isCompeting) {
        await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${block.itemId}`), null)
      }
      if (block && !block.isDefault) {
        getState()._writeLog('삭제', blockKey, block, null)
      }

      const isCA   = blockKey.endsWith('_CA')
      const isIP   = blockKey.endsWith('_IP')
      const slotId = isCA || isIP ? blockKey.slice(0, -3) : blockKey
      const ch     = isCA ? 'CA' : isIP ? 'IP' : 'ALL'
      const slot   = pgmSlots.find(s => s.slotId === slotId)

      await set(
        ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`),
        slot ? makeDefaultBlock(slot, ch) : null
      )
    },

    async copyBlockToSidebar(block) {
      const { startDate, poolType, proposalItems } = getState()
      if (!block.itemId) return
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${block.itemId}`), null)
      const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
      const all  = snap.exists() ? snap.val() : []
      const orig = all.find(p => p.itemId === block.itemId)
      if (orig && !proposalItems.some(p => p.itemId === block.itemId)) {
        setState(s => ({ proposalItems: [...s.proposalItems, buildProposalItem(orig)] }))
      }
    },
  }
}