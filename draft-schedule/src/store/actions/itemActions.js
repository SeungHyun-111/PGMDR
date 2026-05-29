import { db, ref, set, update, get } from '../../api/firebase'
import { buildProposalItem } from '../helpers/blockBuilders'
import { genKey } from '../../utils/uniqueKey'
import { normalizeItemsTeamNames } from '../../utils/teamName'
import { applyEntityProps, extractEntityFields } from '../../utils/mergeEntity'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'

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
        const uniqueKeyUpdates = {}
        const normalizedEntries = entries.map(item => {
          if (item.uniqueKey) return item
          const uniqueKey = genKey('1')
          const next = { ...item, uniqueKey }
          uniqueKeyUpdates[`gasData/proposalItems/${item._fbIdx}/uniqueKey`] = uniqueKey
          uniqueKeyUpdates[`entityProps/${uniqueKey}`] = extractEntityFields(buildProposalItem(next))
          return next
        })
        if (Object.keys(uniqueKeyUpdates).length > 0) {
          await update(ref(db, `sessions/${weekKey}`), uniqueKeyUpdates)
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
      await update(ref(db, `sessions/${weekKey}/gasData/proposalItems/${resolvedIdx}`), patch)
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
      const fbIdx = allProposalItems.length
      // _fbIdx는 내부 메타 — Firebase에는 저장하지 않음
      const newItem = { ...itemData, itemId: `manual_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${fbIdx}`), newItem)
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
      const matches = item => uniqueKey ? item.uniqueKey === uniqueKey : item.itemId === itemId
      const item = allProposalItems.find(matches) || proposalItems.find(matches)
      if (!item) return
      if (item._fbIdx !== undefined && item._fbIdx !== null) {
        await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${item._fbIdx}`), null)
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
      const matches = item => uniqueKey ? item.uniqueKey === uniqueKey : item.itemId === itemId
      const orig = allProposalItems.find(matches) || proposalItems.find(matches)
      if (!orig) return
      const fbIdx = allProposalItems.length
      const rest = { ...orig }
      delete rest._fbIdx
      const newItem = { ...rest, itemId: `dup_${Date.now()}`, uniqueKey: genKey('1') }
      await set(ref(db, `sessions/${weekKey}/gasData/proposalItems/${fbIdx}`), newItem)
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
      const item = [...allProposalItems, ...proposalItems].find(p => uniqueKey ? p.uniqueKey === uniqueKey : p.itemId === itemId)
      if (itemId) await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${itemId}`), true)
      if (uniqueKey) await set(ref(db, `sessions/${weekKey}/scheduledUniqueKeys/${uniqueKey}`), true)
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
      const slot = pgmSlots.find(s => s.slotId === slotId) || { slotId }
      const nextSplit = !splitSlots[slotId]
      await set(ref(db, `sessions/${weekKey}/splitSlots/${slotId}`), nextSplit ? true : null)
      getState()._writeLog(nextSplit ? '채널나누기' : '채널합치기', slotId, slot, { ...slot, channel: nextSplit ? 'CA/IP' : 'ALL' }, {
        scope: 'schedule',
        detail: nextSplit ? '채널나누기: ALL → CA/IP' : '채널합치기: CA/IP → ALL',
      })
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
