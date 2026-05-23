import { db, ref, set, get, update } from '../../api/firebase'
import { buildProposalItem } from '../helpers/blockBuilders'
import { splitWeightedMin } from '../../utils/weightedMin'

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
      const { startDate, poolType, scheduleBlocks } = getState()
      const weekKey = `${startDate}_${poolType}`
      const block = scheduleBlocks[blockKey]

      if (block?.isCompeting) {
        // 경쟁 해제: item1/item2 양쪽 scheduledItemIds 제거 + 사이드바 복원
        const compItems = [block.item1, block.item2].filter(Boolean)
        for (const it of compItems) {
          if (it.itemId) {
            await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${it.itemId}`), null)
          }
        }
        const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
        const raw  = snap.exists() ? snap.val() : {}
        const allItems = Array.isArray(raw) ? raw : Object.values(raw)
        setState(s => {
          const toAdd = []
          for (const it of compItems) {
            if (s.proposalItems.some(p => p.itemId === it.itemId)) continue
            const orig = it.itemId ? allItems.filter(Boolean).find(p => p.itemId === it.itemId) : null
            if (orig) {
              toAdd.push(buildProposalItem(orig))
            } else if (it.pgmCodeName) {
              // 선편성 등 proposalItems에 없는 경우 내장 데이터로 복원
              toAdd.push(buildProposalItem({
                ...it,
                itemId: it.itemId || `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              }))
            }
          }
          return toAdd.length ? { proposalItems: [...s.proposalItems, ...toAdd] } : s
        })
      } else if (block?.itemId && !block.isDefault) {
        await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${block.itemId}`), null)
      }

      if (block && !block.isDefault) {
        getState()._writeLog('삭제', blockKey, block, null)
      }

      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), null)
    },

    // 채널 변경 + 그리드 분리/합치기 동시 처리
    async changeBlockChannel(block, newChannel, patch) {
      const { startDate, poolType, splitSlots, pgmSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
      const slotId  = block.slotId
      const slot    = pgmSlots.find(s => s.slotId === slotId)
      if (!slot) return

      const origChannel = block.blockKey?.endsWith('_CA') ? 'CA'
        : block.blockKey?.endsWith('_IP') ? 'IP' : 'ALL'
      const isSplit = !!splitSlots[slotId]

      if (newChannel !== 'ALL' && !isSplit) {
        // ── ALL → CA or IP : 슬롯 분리 ──────────────────
        const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
        const wm     = newChannel === 'CA' ? caWeighted : ipWeighted
        const newKey = `${slotId}_${newChannel}`
        await update(ref(db, `sessions/${weekKey}`), {
          [`splitSlots/${slotId}`]: true,
          [`scheduleBlocks/${slotId}`]: null,
          [`scheduleBlocks/${newKey}`]: { ...block, ...patch, blockKey: newKey, channel: newChannel, weightedMin: wm, isDefault: false },
        })

      } else if (newChannel === 'ALL' && isSplit) {
        // ── CA/IP → ALL : 슬롯 합치기 ───────────────────
        const otherCh = origChannel === 'CA' ? 'IP' : 'CA'
        await update(ref(db, `sessions/${weekKey}`), {
          [`scheduleBlocks/${slotId}_${otherCh}`]: null,
          [`scheduleBlocks/${block.blockKey}`]: null,
          [`splitSlots/${slotId}`]: null,
          [`scheduleBlocks/${slotId}`]: { ...block, ...patch, blockKey: slotId, channel: 'ALL', weightedMin: slot.weightedMin, isDefault: false },
        })

      } else {
        // ── 구조 변경 없음 (이미 분리 상태에서 CA↔IP 등) ──
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks/${block.blockKey}`),
          { ...patch, channel: newChannel })
      }

      getState()._writeLog('채널변경', block.blockKey, block, { ...block, ...patch, channel: newChannel })
    },

    // 반환된 아이템의 effectiveItemId를 리턴 (pinnedReturn 위치 지정에 사용)
    async returnBlockToSidebar(block) {
      if (block.isCompeting) return null
      await getState().removeBlock(block.blockKey || block.slotId)

      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`

      if (block.itemId) {
        // 일반/수동추가 블록: gasData/proposalItems 원본 복원
        // Firebase는 배열도 객체로 반환하므로 Object.values 로 정규화
        const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
        const raw  = snap.exists() ? snap.val() : {}
        const all  = Array.isArray(raw) ? raw : Object.values(raw)
        const orig = all.filter(Boolean).find(p => p.itemId === block.itemId)

        setState(s => {
          if (s.proposalItems.some(p => p.itemId === block.itemId)) return s
          // orig 못 찾으면 블록 데이터로 fallback (수동 추가/편집된 아이템)
          const item = orig ?? {
            itemId:            block.itemId,
            pgmCodeName:       block.pgmCodeName       || '',
            mdTeam:            block.mdTeam             || block.orgName || '',
            orgName:           block.orgName            || block.mdTeam  || '',
            mdCategory:        block.mdCategory         || '',
            dealType:          block.dealTypeConverted  || block.dealType || '',
            dealTypeConverted: block.dealTypeConverted  || block.dealType || '',
            dealTypeChar:      block.dealTypeChar       || '',
            perfKey:           block.perfKey            || null,
          }
          return { proposalItems: [...s.proposalItems, buildProposalItem(item)] }
        })
        return block.itemId
      } else {
        // 선편성 블록: itemId 없음 → 블록 데이터로 새 proposalItem 생성
        const newItemId = `pre_${block.slotId}_${Date.now()}`
        const itemData = {
          itemId:            newItemId,
          pgmCodeName:       block.pgmCodeName       || '',
          mdTeam:            block.mdTeam             || block.orgName || '',
          orgName:           block.orgName            || block.mdTeam  || '',
          mdCategory:        block.mdCategory         || '',
          dealType:          block.dealTypeConverted  || block.dealType || '',
          dealTypeConverted: block.dealTypeConverted  || block.dealType || '',
          dealTypeChar:      block.dealTypeChar       || '',
          perfKey:           block.perfKey            || null,
        }
        const { proposalItems } = getState()
        const fbIdx = proposalItems.length
        await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${fbIdx}`), itemData)
        setState(s => ({
          proposalItems: [...s.proposalItems, buildProposalItem({ ...itemData, _fbIdx: fbIdx })],
        }))
        return newItemId
      }
    },
  }
}