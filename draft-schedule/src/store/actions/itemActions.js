import { db, ref, set, update, get } from '../../api/firebase'
import { buildProposalItem } from '../helpers/blockBuilders'
import { genKey } from '../../utils/uniqueKey'
import { normalizeItemsTeamNames } from '../../utils/teamName'
import { applyEntityProps, extractEntityFields } from '../../utils/mergeEntity'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'
import { getCurrentVersionPath } from '../../utils/sessionVersion'

export function createItemActions(setState, getState) {
  return {

    async loadProposals() {
      const { startDate, poolType, proposalLoaded } = getState()
      if (proposalLoaded) return
      setState({ isLoadingProposals: true })
      try {
        const weekKey = `${startDate}_${poolType}`
        const versionPath = getCurrentVersionPath(getState, weekKey)
        const snap = await get(ref(db, `${versionPath}/proposalItems`))
        const raw  = snap.exists() ? snap.val() : []
        const entries = Array.isArray(raw)
          ? raw.map((v, i) => ({ ...v, _fbIdx: i }))
          : Object.entries(raw).map(([k, v]) => ({ ...v, _fbIdx: k }))
        const uniqueKeyUpdates = {}
        const normalizedEntries = entries.map(item => {
          if (item.uniqueKey) return item
          const uniqueKey = genKey('1')
          const next = { ...item, uniqueKey }
          uniqueKeyUpdates[`proposalItems/${item._fbIdx}/uniqueKey`] = uniqueKey
          uniqueKeyUpdates[`entityProps/${uniqueKey}`] = extractEntityFields(buildProposalItem(next))
          return next
        })
        if (Object.keys(uniqueKeyUpdates).length > 0) {
          await update(ref(db, versionPath), uniqueKeyUpdates)
        }
        const { weightedMinTargets, entityProps, scheduledItemIds, scheduledUniqueKeys } = getState()
        const items = applyEntityProps(
          normalizeItemsTeamNames(normalizedEntries.map(buildProposalItem), weightedMinTargets),
          entityProps
        )
        setState({
          allProposalItems:   items,
          proposalItems:      filterUnscheduledItems(items, scheduledItemIds, scheduledUniqueKeys),
          proposalLoaded:     true,
          isLoadingProposals: false,
        })
      } catch (e) {
        setState({ error: e.message, isLoadingProposals: false })
      }
    },

    async updateProposalItem(itemId, fbIdx, patch, uniqueKey) {
      const { startDate, poolType, allProposalItems, proposalItems } = getState()
      // fbIdx가 없으면 현재 state 순서로 보정
      const matches = item => uniqueKey ? item.uniqueKey === uniqueKey : item.itemId === itemId
      const stateItem = allProposalItems.find(matches) || proposalItems.find(matches)
      const stateIdx = allProposalItems.findIndex(matches)
      const visibleIdx = proposalItems.findIndex(matches)
      const resolvedIdx = (fbIdx !== undefined && fbIdx !== null)
        ? fbIdx
        : stateItem?._fbIdx ?? (stateIdx >= 0 ? stateIdx : visibleIdx)
      if (resolvedIdx < 0) return
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const before = stateItem ? stripRuntimeFields(stateItem) : null
      const after = before ? { ...before, ...patch } : patch
      await update(ref(db, `${versionPath}/proposalItems/${resolvedIdx}`), patch)
      getState().recordUndoChange('사이드바 상품 수정 되돌리기', {
        path: `${versionPath}/proposalItems/${resolvedIdx}`,
        before,
        after,
        description: `상품 수정: ${after?.pgmCodeName || itemId || uniqueKey}`,
      })
      getState()._writeLog('수정', '', stateItem || null, { ...(stateItem || {}), ...patch }, {
        scope: 'sidebar',
        detail: Object.keys(patch).map(key => `${key}: ${stateItem?.[key] ?? '-'} → ${patch[key] ?? '-'}`).join(', '),
      })
      setState(s => {
        const allProposalItems = s.allProposalItems.map(p =>
          matches(p) ? buildProposalItem({ ...p, ...patch }) : p
        )
        return {
          allProposalItems,
          proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
        }
      })
    },

    async addProposalItem(itemData) {
      const { startDate, poolType, allProposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const fbIdx = allProposalItems.length
      // _fbIdx는 내부 메타 — Firebase에는 저장하지 않음
      const newItem = { ...itemData, itemId: `manual_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `${versionPath}/proposalItems/${fbIdx}`), newItem)
      getState().recordUndoChange('사이드바 상품 추가 되돌리기', {
        path: `${versionPath}/proposalItems/${fbIdx}`,
        before: null,
        after: newItem,
        description: `상품 추가 취소: ${newItem.pgmCodeName || newItem.itemId}`,
      })
      getState()._writeLog('추가', '', null, newItem, {
        scope: 'sidebar',
        detail: '사이드바 상품 추가',
      })
      setState(s => {
        const allProposalItems = [...s.allProposalItems, buildProposalItem({ ...newItem, _fbIdx: fbIdx })]
        return {
          allProposalItems,
          proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
        }
      })
    },

    async deleteProposalItem(itemId, uniqueKey) {
      const { startDate, poolType, allProposalItems, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const matches = item => uniqueKey ? item.uniqueKey === uniqueKey : item.itemId === itemId
      const item = allProposalItems.find(matches) || proposalItems.find(matches)
      if (!item) return
      if (item._fbIdx !== undefined && item._fbIdx !== null) {
        await set(ref(db, `${versionPath}/proposalItems/${item._fbIdx}`), null)
        getState().recordUndoChange('사이드바 상품 삭제 되돌리기', {
          path: `${versionPath}/proposalItems/${item._fbIdx}`,
          before: stripRuntimeFields(item),
          after: null,
          description: `상품 복원: ${item.pgmCodeName || item.itemId}`,
        })
      }
      getState()._writeLog('삭제', '', item, null, {
        scope: 'sidebar',
        detail: '사이드바 상품 삭제',
      })
      setState(s => {
        const allProposalItems = s.allProposalItems.filter(p => !matches(p))
        return {
          allProposalItems,
          proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
        }
      })
    },

    async duplicateProposalItem(itemId, uniqueKey) {
      const { startDate, poolType, allProposalItems, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const matches = item => uniqueKey ? item.uniqueKey === uniqueKey : item.itemId === itemId
      const orig = allProposalItems.find(matches) || proposalItems.find(matches)
      if (!orig) return
      const fbIdx = allProposalItems.length
      const rest = { ...orig }
      delete rest._fbIdx
      const newItem = { ...rest, itemId: `dup_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `${versionPath}/proposalItems/${fbIdx}`), newItem)
      getState().recordUndoChange('사이드바 상품 복사 되돌리기', {
        path: `${versionPath}/proposalItems/${fbIdx}`,
        before: null,
        after: newItem,
        description: `복사 상품 삭제: ${newItem.pgmCodeName || newItem.itemId}`,
      })
      getState()._writeLog('복사', '', orig, newItem, {
        scope: 'sidebar',
        detail: `원본: ${orig.pgmCodeName || '-'}`,
      })
      setState(s => {
        const allProposalItems = [...s.allProposalItems, buildProposalItem({ ...newItem, _fbIdx: fbIdx })]
        return {
          allProposalItems,
          proposalItems: filterUnscheduledItems(allProposalItems, s.scheduledItemIds, s.scheduledUniqueKeys),
        }
      })
    },

    async scheduleItem(itemId, uniqueKey) {
      const { startDate, poolType, allProposalItems, proposalItems } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const item = [...allProposalItems, ...proposalItems].find(p => uniqueKey ? p.uniqueKey === uniqueKey : p.itemId === itemId)
      if (itemId) {
        await set(ref(db, `${versionPath}/scheduledItemIds/${itemId}`), true)
        getState().recordUndoChange('상품 편성 체크 되돌리기', {
          path: `${versionPath}/scheduledItemIds/${itemId}`,
          before: null,
          after: true,
          description: `편성 체크 취소: ${item?.pgmCodeName || itemId}`,
        })
      }
      if (uniqueKey) {
        await set(ref(db, `${versionPath}/scheduledUniqueKeys/${uniqueKey}`), true)
        getState().recordUndoChange('상품 편성 체크 되돌리기', {
          path: `${versionPath}/scheduledUniqueKeys/${uniqueKey}`,
          before: null,
          after: true,
          description: `편성 키 취소: ${item?.pgmCodeName || uniqueKey}`,
        })
      }
      if (item) {
        getState()._writeLog('편성', '', item, item, {
          scope: 'sidebar',
          detail: '편성 처리: 사이드바 목록에서 제외',
        })
      }
      setState(s => {
        const scheduledItemIds = itemId ? { ...s.scheduledItemIds, [itemId]: true } : s.scheduledItemIds
        const scheduledUniqueKeys = uniqueKey ? { ...s.scheduledUniqueKeys, [uniqueKey]: true } : s.scheduledUniqueKeys
        return {
          scheduledItemIds,
          scheduledUniqueKeys,
          proposalItems: filterUnscheduledItems(s.allProposalItems, scheduledItemIds, scheduledUniqueKeys),
        }
      })
    },

    async toggleSplitSlot(slotId) {
      const { startDate, poolType, splitSlots, pgmSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const slot = pgmSlots.find(s => s.slotId === slotId) || { slotId }
      const nextSplit = !splitSlots[slotId]
      await set(ref(db, `${versionPath}/splitSlots/${slotId}`), nextSplit ? true : null)
      getState().recordUndoChange('채널 분리/합치기 되돌리기', {
        path: `${versionPath}/splitSlots/${slotId}`,
        before: splitSlots[slotId] || null,
        after: nextSplit ? true : null,
        description: `${nextSplit ? '채널 나누기' : '채널 합치기'} 취소: ${slotId}`,
      })
      getState()._writeLog(nextSplit ? '채널나누기' : '채널합치기', slotId, slot, { ...slot, channel: nextSplit ? 'CA/IP' : 'ALL' }, {
        scope: 'schedule',
        detail: nextSplit ? '채널나누기: ALL → CA/IP' : '채널합치기: CA/IP → ALL',
      })
    },

    async toggleStarred(itemId) {
      const { startDate, poolType, starred } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const next = starred[itemId] ? null : true
      await set(ref(db, `${versionPath}/starred/${itemId}`), next)
      getState().recordUndoChange('즐겨찾기 변경 되돌리기', {
        path: `${versionPath}/starred/${itemId}`,
        before: starred[itemId] || null,
        after: next,
        description: `즐겨찾기 변경 취소: ${itemId}`,
      })
    },

    async saveEntityProps(uniqueKey, data) {
      if (!uniqueKey) return
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const before = getState().entityProps?.[uniqueKey] || null
      const after = { ...(before || {}), ...data }
      await update(ref(db, `${versionPath}/entityProps/${uniqueKey}`), data)
      getState().recordUndoChange('상품 속성 수정 되돌리기', {
        path: `${versionPath}/entityProps/${uniqueKey}`,
        before,
        after,
        description: `상품 속성 복원: ${after.pgmCodeName || uniqueKey}`,
      })
    },

    async saveManualInput(uniqueKey, data) {
      const { startDate, poolType } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const before = getState().manualInputs?.[uniqueKey] || null
      const after = { ...(before || {}), ...data }
      await update(ref(db, `${versionPath}/manualInputs/${uniqueKey}`), data)
      getState().recordUndoChange('수기 입력 수정 되돌리기', {
        path: `${versionPath}/manualInputs/${uniqueKey}`,
        before,
        after,
        description: `수기 입력 복원: ${uniqueKey}`,
      })
    },

    setUserName(name) {
      localStorage.setItem('userName', name)
      setState({ userName: name })
    },
  }
}

function stripRuntimeFields(item) {
  if (!item) return null
  const { _fbIdx, _grade, _team, ...rest } = item
  return rest
}
