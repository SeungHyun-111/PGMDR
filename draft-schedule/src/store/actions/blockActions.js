import { db, ref, set, get, update } from '../../api/firebase'
import { buildProposalItem, makeDefaultBlock } from '../helpers/blockBuilders'
import { resolveEntity } from '../../utils/mergeEntity'
import { splitWeightedMin } from '../../utils/weightedMin'
import { normalizeTeamName } from '../../utils/teamName'
import { genKey } from '../../utils/uniqueKey'
import { competitionItemKey, competitionItemToBlock, getCompetitionItems, makeCompetitionBlock } from '../../utils/competition'
import { filterUnscheduledItems, upsertByItemId } from '../../utils/proposalVisibility'
import { getCurrentVersionPath } from '../../utils/sessionVersion'

export function createBlockActions(setState, getState) {
  return {

    async saveBlock(blockKey, patch) {
      const { startDate, poolType, scheduleBlocks, weightedMinTargets } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const before = scheduleBlocks[blockKey] || null
      const skipLog = !!patch.__skipLog
      const { __skipLog, ...cleanPatch } = patch
      const normalizedPatch = {
        ...cleanPatch,
        ...(cleanPatch.mdTeam  !== undefined && { mdTeam:  normalizeTeamName(cleanPatch.mdTeam,  weightedMinTargets) }),
        ...(cleanPatch.orgName !== undefined && { orgName: normalizeTeamName(cleanPatch.orgName, weightedMinTargets) }),
      }
      getState().recordUndoChange('블록 저장 되돌리기', {
        path: `${versionPath}/scheduleBlocks/${blockKey}`,
        before,
        after: { ...before, ...normalizedPatch },
        description: `${before ? '블록 수정' : '블록 편성'}: ${normalizedPatch.pgmCodeName || before?.pgmCodeName || blockKey}`,
      })
      await update(ref(db, `${versionPath}/scheduleBlocks/${blockKey}`), normalizedPatch)
      if (!skipLog && cleanPatch.isDefault !== true) {
        getState()._writeLog(before ? '수정' : '편성', blockKey, before, { ...before, ...cleanPatch })
      }
    },

    async removeBlock(blockKey, options = {}) {
      const { startDate, poolType, scheduleBlocks } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const block = scheduleBlocks[blockKey]
      const undoChanges = []
      const ownsUndoBatch = !getState()._undoBatch
      if (ownsUndoBatch) getState().beginUndoBatch('블록 삭제/반환 되돌리기')

      try {
      if (block?.isCompeting) {
        // 경쟁 해제: item1/item2 양쪽 scheduledItemIds 제거 + 사이드바 복원
        const compItems = getCompetitionItems(block)
        for (const it of compItems) {
          if (it.itemId) {
            undoChanges.push({
              path: `${versionPath}/scheduledItemIds/${it.itemId}`,
              before: true,
              after: null,
              description: `편성 체크 해제: ${it.pgmCodeName || it.itemId}`,
            })
            await set(ref(db, `${versionPath}/scheduledItemIds/${it.itemId}`), null)
          }
          if (it.uniqueKey) {
            undoChanges.push({
              path: `${versionPath}/scheduledUniqueKeys/${it.uniqueKey}`,
              before: true,
              after: null,
              description: `편성 키 해제: ${it.pgmCodeName || it.uniqueKey}`,
            })
            await set(ref(db, `${versionPath}/scheduledUniqueKeys/${it.uniqueKey}`), null)
          }
        }
        const snap = await get(ref(db, `${versionPath}/proposalItems`))
        const raw  = snap.exists() ? snap.val() : {}
        const allItems = Array.isArray(raw) ? raw : Object.values(raw)
        setState(s => {
          const toAdd = []
          for (const it of compItems) {
            if (s.allProposalItems.some(p => it.uniqueKey ? p.uniqueKey === it.uniqueKey : p.itemId === it.itemId)) continue
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
          if (!toAdd.length) {
            return {
              proposalItems: filterUnscheduledItems(s.allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
            }
          }
          const allProposalItems = toAdd.reduce((list, item) => upsertByItemId(list, item), s.allProposalItems)
          return {
            allProposalItems,
            proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
          }
        })
      } else if (block?.itemId && !block.isDefault) {
        undoChanges.push({
          path: `${versionPath}/scheduledItemIds/${block.itemId}`,
          before: true,
          after: null,
          description: `편성 체크 해제: ${block.pgmCodeName || block.itemId}`,
        })
        await set(ref(db, `${versionPath}/scheduledItemIds/${block.itemId}`), null)
        if (block.uniqueKey) {
          undoChanges.push({
            path: `${versionPath}/scheduledUniqueKeys/${block.uniqueKey}`,
            before: true,
            after: null,
            description: `편성 키 해제: ${block.pgmCodeName || block.uniqueKey}`,
          })
          await set(ref(db, `${versionPath}/scheduledUniqueKeys/${block.uniqueKey}`), null)
        }
      }

      if (!options.skipLog && block && !block.isDefault) {
        getState()._writeLog('삭제', blockKey, block, null)
      }

      await set(ref(db, `${versionPath}/scheduleBlocks/${blockKey}`), null)
      if (block) {
        getState().recordUndoChange('블록 삭제/반환 되돌리기', {
          path: `${versionPath}/scheduleBlocks/${blockKey}`,
          before: block,
          after: null,
          description: `블록 복원: ${block.pgmCodeName || blockKey}`,
        })
        undoChanges.forEach(change => getState().recordUndoChange('블록 삭제/반환 되돌리기', change))
      }
      if (ownsUndoBatch) getState().endUndoBatch()
      } catch (e) {
        if (ownsUndoBatch) getState().cancelUndoBatch()
        throw e
      }
    },

    // 채널 변경 + 그리드 분리/합치기 동시 처리
    async releaseCompetition(blockKey, { mode, selectedKey } = {}) {
      const { startDate, poolType, scheduleBlocks } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const block = scheduleBlocks[blockKey]
      if (!block?.isCompeting) return

      const items = getCompetitionItems(block)
      const selectedIndex = items.findIndex((item, i) => competitionItemKey(item, i) === selectedKey)
      const selectedItem = mode === 'select' ? items[selectedIndex] : null
      const restoreItems = selectedItem
        ? items.filter((_, i) => i !== selectedIndex)
        : items

      const ownsUndoBatch = !getState()._undoBatch
      if (ownsUndoBatch) getState().beginUndoBatch('경쟁 해제 되돌리기')

      try {
        await restoreCompetitionItems({ setState, getState, versionPath, items: restoreItems })

        const updates = { [`scheduleBlocks/${blockKey}`]: null }
        if (selectedItem) {
          updates[`scheduleBlocks/${blockKey}`] = competitionItemToBlock(selectedItem, block)
          if (selectedItem.itemId) updates[`scheduledItemIds/${selectedItem.itemId}`] = true
          if (selectedItem.uniqueKey) updates[`scheduledUniqueKeys/${selectedItem.uniqueKey}`] = true
        } else if (mode === 'default') {
          const sourceChannel = blockKey.endsWith('_CA') ? 'CA' : blockKey.endsWith('_IP') ? 'IP' : 'ALL'
          updates[`scheduleBlocks/${blockKey}`] = {
            ...makeDefaultBlock(block, sourceChannel),
            uniqueKey: genKey('0'),
          }
        }

        recordVersionPatchUndo(getState, versionPath, '경쟁 해제 되돌리기', updates)
        await update(ref(db, versionPath), updates)
        getState()._writeLog('경쟁해제', blockKey, block, updates[`scheduleBlocks/${blockKey}`] || null)
        if (ownsUndoBatch) getState().endUndoBatch()
      } catch (e) {
        if (ownsUndoBatch) getState().cancelUndoBatch()
        throw e
      }
    },

    async changeBlockChannel(block, newChannel, patch, options = {}) {
      const { startDate, poolType, splitSlots, pgmSlots, scheduleBlocks, weightedMinTargets } = getState()
      patch = {
        ...patch,
        ...(patch.mdTeam  !== undefined && { mdTeam:  normalizeTeamName(patch.mdTeam,  weightedMinTargets) }),
        ...(patch.orgName !== undefined && { orgName: normalizeTeamName(patch.orgName, weightedMinTargets) }),
      }
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const slotId  = block.slotId
      const slot    = pgmSlots.find(s => s.slotId === slotId)
      if (!slot) return

      const fromKey = block.blockKey || block.slotId
      const origChannel = fromKey?.endsWith('_CA') ? 'CA'
        : fromKey?.endsWith('_IP') ? 'IP' : 'ALL'
      const isSplit = !!splitSlots[slotId]
      const { mode } = options

      if (newChannel !== 'ALL' && !isSplit) {
        // ── ALL → CA or IP : 슬롯 분리 ──────────────────
        const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
        const wm     = newChannel === 'CA' ? caWeighted : ipWeighted
        const newKey = `${slotId}_${newChannel}`
        const targetBlock = scheduleBlocks[newKey]
        if (targetBlock && targetBlock !== block && !mode) {
          return makeChannelConflict({ kind: 'target', block, targetBlock, fromChannel: origChannel, toChannel: newChannel, canSwap: false })
        }
        if (targetBlock && mode === 'sidebar') {
          await getState().returnBlockToSidebar(targetBlock)
        } else if (targetBlock && mode === 'compete') {
          const items = [...getCompetitionItems(targetBlock), ...getCompetitionItems({ ...block, ...patch })]
          await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
            [`splitSlots/${slotId}`]: true,
            [`scheduleBlocks/${slotId}`]: null,
            [`scheduleBlocks/${newKey}`]: makeCompetitionBlock({ slot, blockKey: newKey, channel: newChannel, weightedMin: wm, items }),
          })
          getState()._writeLog('채널변경', fromKey, block, { ...block, ...patch, channel: newChannel })
          return { ok: true }
        }
        await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
          [`splitSlots/${slotId}`]: true,
          [`scheduleBlocks/${slotId}`]: null,
          [`scheduleBlocks/${newKey}`]: { ...block, ...patch, blockKey: newKey, channel: newChannel, weightedMin: wm, isDefault: false },
        })

      } else if (newChannel === 'ALL' && isSplit) {
        // ── CA/IP → ALL : 슬롯 합치기 ───────────────────
        const otherCh = origChannel === 'CA' ? 'IP' : 'CA'
        const otherBlock = scheduleBlocks[`${slotId}_${otherCh}`]
        if (otherBlock && !mode) {
          return makeChannelConflict({ kind: 'merge', block, targetBlock: otherBlock, fromChannel: origChannel, toChannel: newChannel, canSwap: false })
        }
        if (otherBlock && mode === 'sidebar') {
          await getState().returnBlockToSidebar(otherBlock)
        } else if (otherBlock && mode === 'compete') {
          const items = [...getCompetitionItems(otherBlock), ...getCompetitionItems({ ...block, ...patch })]
          await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
            [`scheduleBlocks/${slotId}_${otherCh}`]: null,
            [`scheduleBlocks/${fromKey}`]: null,
            [`splitSlots/${slotId}`]: null,
            [`scheduleBlocks/${slotId}`]: makeCompetitionBlock({ slot, blockKey: slotId, channel: 'ALL', weightedMin: slot.weightedMin, items }),
          })
          getState()._writeLog('채널변경', fromKey, block, { ...block, ...patch, channel: newChannel })
          return { ok: true }
        }
        await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
          [`scheduleBlocks/${slotId}_${otherCh}`]: null,
          [`scheduleBlocks/${fromKey}`]: null,
          [`splitSlots/${slotId}`]: null,
          [`scheduleBlocks/${slotId}`]: { ...block, ...patch, blockKey: slotId, channel: 'ALL', weightedMin: slot.weightedMin, isDefault: false },
        })

      } else if (newChannel !== 'ALL' && isSplit && origChannel !== newChannel) {
        // ── CA ↔ IP : 실제 half-slot key 이동 ─────────────
        const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
        const wm = newChannel === 'CA' ? caWeighted : ipWeighted
        const origWm = origChannel === 'CA' ? caWeighted : ipWeighted
        const newKey = `${slotId}_${newChannel}`
        const targetBlock = scheduleBlocks[newKey]
        if (targetBlock && !mode) {
          return makeChannelConflict({ kind: 'target', block, targetBlock, fromChannel: origChannel, toChannel: newChannel, canSwap: true })
        }
        if (targetBlock && mode === 'sidebar') {
          await getState().returnBlockToSidebar(targetBlock)
        } else if (targetBlock && mode === 'compete') {
          const items = [...getCompetitionItems(targetBlock), ...getCompetitionItems({ ...block, ...patch })]
          await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
            [`scheduleBlocks/${fromKey}`]: null,
            [`scheduleBlocks/${newKey}`]: makeCompetitionBlock({ slot, blockKey: newKey, channel: newChannel, weightedMin: wm, items }),
          })
          getState()._writeLog('채널변경', fromKey, block, { ...block, ...patch, channel: newChannel })
          return { ok: true }
        } else if (targetBlock && mode === 'swap') {
          await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
            [`scheduleBlocks/${fromKey}`]: { ...targetBlock, blockKey: fromKey, channel: origChannel, weightedMin: origWm, isDefault: false },
            [`scheduleBlocks/${newKey}`]: { ...block, ...patch, blockKey: newKey, channel: newChannel, weightedMin: wm, isDefault: false },
          })
          getState()._writeLog('채널변경', fromKey, block, { ...block, ...patch, channel: newChannel })
          return { ok: true }
        }
        await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
          [`scheduleBlocks/${fromKey}`]: null,
          [`scheduleBlocks/${newKey}`]: { ...block, ...patch, blockKey: newKey, channel: newChannel, weightedMin: wm, isDefault: false },
        })

      } else {
        // ── 구조 변경 없음 (이미 분리 상태에서 CA↔IP 등) ──
        await updateVersionPatch(getState, versionPath, '채널 변경 되돌리기', {
          [`scheduleBlocks/${fromKey}`]: { ...patch, channel: newChannel },
        })
      }

      getState()._writeLog('채널변경', fromKey, block, { ...block, ...patch, channel: newChannel })
      return { ok: true }
    },

    // 반환된 아이템의 effectiveItemId를 리턴 (pinnedReturn 위치 지정에 사용)
    async returnBlockToSidebar(block, options = {}) {
      if (block.isCompeting) return null
      await getState().removeBlock(block.blockKey || block.slotId, options)

      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)

      if (block.itemId) {
        // 일반/수동추가 블록: gasData/proposalItems 원본 복원
        // Firebase는 배열도 객체로 반환하므로 Object.values 로 정규화
        const snap = await get(ref(db, `${versionPath}/proposalItems`))
        const raw  = snap.exists() ? snap.val() : {}
        const all  = Array.isArray(raw) ? raw : Object.values(raw)
        const orig = all.filter(Boolean).find(p => p.itemId === block.itemId)

        const { entityProps } = getState()
        setState(s => {
          if (s.allProposalItems.some(p => block.uniqueKey ? p.uniqueKey === block.uniqueKey : p.itemId === block.itemId)) {
            return {
              proposalItems: filterUnscheduledItems(s.allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
            }
          }
          // orig에 entityProps 머지 (편집된 속성 반영), 없으면 블록 데이터로 fallback
          const item = orig ? resolveEntity(orig, entityProps) : {
            itemId:            block.itemId,
            uniqueKey:         block.uniqueKey          || genKey('1'),
            pgmCodeName:       block.pgmCodeName        || '',
            mdTeam:            block.mdTeam             || block.orgName || '',
            orgName:           block.orgName            || block.mdTeam  || '',
            mdCategory:        block.mdCategory         || '',
            dealType:          block.dealTypeConverted  || block.dealType || '',
            dealTypeConverted: block.dealTypeConverted  || block.dealType || '',
            dealTypeChar:      block.dealTypeChar       || '',
            memoCode:          block.memoCode           || '',
            requestNote:       block.requestNote        || '',
            newProductType:    block.newProductType     || '',
            perfKey:           block.perfKey            || null,
          }
          const allProposalItems = upsertByItemId(s.allProposalItems, buildProposalItem(item))
          return {
            allProposalItems,
            proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
          }
        })
        return block.itemId
      } else {
        // 선편성 블록: itemId 없음 → 블록 데이터로 새 proposalItem 생성
        const newItemId = `pre_${block.slotId}_${Date.now()}`
        const itemData = {
          itemId:            newItemId,
          uniqueKey:         genKey('1'),
          pgmCodeName:       block.pgmCodeName        || '',
          mdTeam:            block.mdTeam             || block.orgName || '',
          orgName:           block.orgName            || block.mdTeam  || '',
          mdCategory:        block.mdCategory         || '',
          dealType:          block.dealTypeConverted  || block.dealType || '',
          dealTypeConverted: block.dealTypeConverted  || block.dealType || '',
          dealTypeChar:      block.dealTypeChar       || '',
          memoCode:          block.memoCode           || '',
          requestNote:       block.requestNote        || '',
          newProductType:    block.newProductType     || '',
          perfKey:           block.perfKey            || null,
        }
        getState().recordUndoChange('사이드바 반환 되돌리기', {
          path: `${versionPath}/proposalItems/${newItemId}`,
          before: null,
          after: itemData,
          description: `제안상품 생성 취소: ${itemData.pgmCodeName || newItemId}`,
        })
        await set(ref(db, `${versionPath}/proposalItems/${newItemId}`), itemData)
        setState(s => {
          const allProposalItems = upsertByItemId(s.allProposalItems, buildProposalItem({ ...itemData, _fbIdx: newItemId }))
          return {
            allProposalItems,
            proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
          }
        })
        return newItemId
      }
    },
  }
}

async function restoreCompetitionItems({ setState, getState, versionPath, items }) {
  for (const it of items) {
    if (it.itemId) {
      const path = `scheduledItemIds/${it.itemId}`
      getState?.().recordUndoChange('경쟁 해제 되돌리기', {
        path: `${versionPath}/${path}`,
        before: readStatePath(getState(), path),
        after: null,
        description: path,
      })
      await set(ref(db, `${versionPath}/${path}`), null)
    }
    if (it.uniqueKey) {
      const path = `scheduledUniqueKeys/${it.uniqueKey}`
      getState?.().recordUndoChange('경쟁 해제 되돌리기', {
        path: `${versionPath}/${path}`,
        before: readStatePath(getState(), path),
        after: null,
        description: path,
      })
      await set(ref(db, `${versionPath}/${path}`), null)
    }
  }

  const snap = await get(ref(db, `${versionPath}/proposalItems`))
  const raw  = snap.exists() ? snap.val() : {}
  const allItems = Array.isArray(raw) ? raw : Object.values(raw)

  setState(s => {
    const toAdd = []
    for (const it of items) {
      if (s.allProposalItems.some(p => it.uniqueKey ? p.uniqueKey === it.uniqueKey : p.itemId === it.itemId)) continue
      const orig = it.itemId ? allItems.filter(Boolean).find(p => p.itemId === it.itemId) : null
      if (orig) {
        toAdd.push(buildProposalItem(orig))
      } else if (it.pgmCodeName) {
        toAdd.push(buildProposalItem({
          ...it,
          itemId: it.itemId || `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }))
      }
    }
    if (!toAdd.length) {
      return {
        proposalItems: filterUnscheduledItems(s.allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
      }
    }
    const allProposalItems = toAdd.reduce((list, item) => upsertByItemId(list, item), s.allProposalItems)
    return {
      allProposalItems,
      proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
    }
  })
}

function makeChannelConflict({ kind, block, targetBlock, fromChannel, toChannel, canSwap }) {
  return {
    conflict: true,
    kind,
    fromChannel,
    toChannel,
    canSwap,
    sourceName: block?.pgmCodeName || '-',
    targetName: targetBlock?.pgmCodeName || '-',
    targetBlockKey: targetBlock?.blockKey || targetBlock?.slotId || '',
  }
}

async function updateVersionPatch(getState, versionPath, label, updates) {
  recordVersionPatchUndo(getState, versionPath, label, updates)
  await update(ref(db, versionPath), updates)
}

function recordVersionPatchUndo(getState, versionPath, label, updates) {
  Object.entries(updates || {}).forEach(([relativePath, after]) => {
    getState().recordUndoChange(label, {
      path: `${versionPath}/${relativePath}`,
      before: readStatePath(getState(), relativePath),
      after,
      description: relativePath,
    })
  })
}

function readStatePath(state, relativePath) {
  const [root, ...parts] = relativePath.split('/')
  let value = state[root]
  for (const part of parts) {
    if (value == null) return null
    value = value[part]
  }
  return value === undefined ? null : value
}
