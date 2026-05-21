import { create } from 'zustand'
import { db, ref, set, get, update, onValue, off } from '../api/firebase'

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return null
  const str = String(dateTimeStr).trim()
  const match = str.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/)
  if (!match) return null
  return { dateKey: match[1], timeText: match[2] }
}

function normalizeTime(timeText) {
  if (!timeText) return ''
  const [h, m] = String(timeText).split(':')
  return `${parseInt(h)}:${m}`
}

export function makeDefaultBlock(slot, channel = 'ALL') {
  const blockKey = channel === 'ALL' ? slot.slotId : `${slot.slotId}_${channel}`
  return {
    slotId: slot.slotId, blockKey,
    dateKey: slot.dateKey, timeText: slot.timeText,
    durationMin: slot.durationMin, weightedMin: slot.weightedMin,
    channel, pgmCodeName: '[편성팀]', orgName: '편성팀', mdTeam: '편성팀',
    memoCode: '[전사블록]', isDefault: true, assignedAt: Date.now()
  }
}

function buildPreScheduleBlocks(pgmSlots, preScheduleRows, existingBlocks) {
  const slotMap = {}
  pgmSlots.forEach(slot => {
    const key = `${slot.dateKey}_${normalizeTime(slot.timeText)}`
    slotMap[key] = slot
  })
  const preBlocks = {}
  preScheduleRows.forEach(pre => {
    const parsed = parseDateTime(pre.broadcastDateTime)
    if (!parsed) return
    const key = `${parsed.dateKey}_${normalizeTime(parsed.timeText)}`
    const slot = slotMap[key]
    if (!slot) return
    if (existingBlocks[slot.slotId]) return
    const dvMatch = String(pre.displayValue || '').match(/\d{2}:\d{2}(.)/)
    const dealTypeChar = dvMatch ? dvMatch[1] : ''
    preBlocks[slot.slotId] = {
      slotId: slot.slotId, blockKey: slot.slotId,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin: slot.weightedMin,
      channel: 'ALL',
      pgmCodeName: pre.pgmCodeName, orgName: pre.orgName, mdTeam: pre.orgName,
      dealTypeChar, isPreSchedule: true, isDefault: false, assignedAt: Date.now()
    }
  })
  return preBlocks
}

function buildDefaultBlocks(pgmSlots, existingBlocks) {
  const missing = {}
  pgmSlots.forEach(slot => {
    if (!existingBlocks[slot.slotId]) missing[slot.slotId] = makeDefaultBlock(slot, 'ALL')
  })
  return missing
}

// Firebase 실시간 구독 관리
const subscriptions = {}

function subscribe(weekKey, path, callback) {
  const key = `${weekKey}/${path}`
  if (subscriptions[key]) off(ref(db, `sessions/${key}`))
  const r = ref(db, `sessions/${key}`)
  onValue(r, callback)
  subscriptions[key] = r
}

function unsubscribeAll() {
  Object.values(subscriptions).forEach(r => off(r))
  Object.keys(subscriptions).forEach(k => delete subscriptions[k])
}

const useScheduleStore = create((setState, getState) => ({
  startDate: '', endDate: '', poolType: 'A',
  isLoaded: false, isLoading: false,
  isLoadingProposals: false, isLoadingPerformance: false,
  error: null,

  pgmSlots: [], targetMetrics: null, weightedMinTargets: [],
  scheduleBlocks: {}, manualInputs: {},
  splitSlots: {},      // CA/IP 분리 상태 (Firebase 실시간)
  starred: {},         // 별표 상태 (Firebase 실시간)
  scheduledItemIds: {}, // 편성 완료된 itemId (Firebase 실시간)

  proposalItems: [], proposalLoaded: false,
  performanceRows: [], performanceLoaded: false,
  preScheduleRows: [], preScheduleLoaded: false,
  lastUpdated: null,
  userName: localStorage.getItem('userName') || '',

  setUserName: (name) => {
    localStorage.setItem('userName', name)
    setState({ userName: name })
  },

  // 로그 저장
  writeLog: async (action, blockKey, before, after) => {
    const { startDate, poolType, userName } = getState()
    const weekKey = `${startDate}_${poolType}`
    const logKey = `log_${Date.now()}`
    await set(ref(db, `sessions/${weekKey}/logs/${logKey}`), {
      timestamp: Date.now(), action, blockKey,
      pgmCodeName: after?.pgmCodeName || before?.pgmCodeName || '',
      dateKey: after?.dateKey || before?.dateKey || '',
      timeText: after?.timeText || before?.timeText || '',
      userName: userName || '익명',
      before: before || null,
      after: after || null,
    })
  },

  // 세션 초기화
  resetSession: async (startDate, poolType) => {
    setState({ isLoading: true, error: null, isLoaded: false })
    try {
      const weekKey = `${startDate}_${poolType}`
      await set(ref(db, `sessions/${weekKey}`), null)
      unsubscribeAll()
      setState({
        scheduleBlocks: {}, manualInputs: {},
        splitSlots: {}, starred: {}, scheduledItemIds: {},
        proposalItems: [], performanceRows: [], preScheduleRows: [],
        proposalLoaded: false, performanceLoaded: false, preScheduleLoaded: false,
        lastUpdated: null, weightedMinTargets: [],
      })
      await getState().loadInitData(startDate, poolType)
    } catch (e) {
      setState({ error: e.message, isLoading: false })
    }
  },

  loadInitData: async (startDate, poolType) => {
    setState({ isLoading: true, error: null })
    try {
      const weekKey = `${startDate}_${poolType}`
      const metaSnap = await get(ref(db, `sessions/${weekKey}/gasData/meta`))

      if (!metaSnap.exists()) {
        const { fetchInitData } = await import('../api/gas')
        const gasData = await fetchInitData(startDate, poolType)
        const now = Date.now()
        await set(ref(db, `sessions/${weekKey}`), {
          gasData, scheduleBlocks: {}, manualInputs: {},
          splitSlots: {}, starred: {}, scheduledItemIds: {},
          createdAt: now,
          lastUpdated: { pgm: now, proposal: now, performance: now, preSchedule: now }
        })
        const pgmSlots = gasData.pgmSlots || []
        const preScheduleRows = gasData.preScheduleRows || []
        const preBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, {})
        const defaultBlocks = buildDefaultBlocks(pgmSlots, preBlocks)
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks`), { ...defaultBlocks, ...preBlocks })
      }

      // 초기 데이터 로드
      const [pgmSnap, targetSnap, weightedSnap, blocksSnap, inputsSnap, lastUpdatedSnap,
             splitSnap, starredSnap, scheduledSnap] = await Promise.all([
        get(ref(db, `sessions/${weekKey}/gasData/pgmSlots`)),
        get(ref(db, `sessions/${weekKey}/gasData/targetMetrics`)),
        get(ref(db, `sessions/${weekKey}/gasData/weightedMinTargets`)),
        get(ref(db, `sessions/${weekKey}/scheduleBlocks`)),
        get(ref(db, `sessions/${weekKey}/manualInputs`)),
        get(ref(db, `sessions/${weekKey}/lastUpdated`)),
        get(ref(db, `sessions/${weekKey}/splitSlots`)),
        get(ref(db, `sessions/${weekKey}/starred`)),
        get(ref(db, `sessions/${weekKey}/scheduledItemIds`)),
      ])

      const pgmSlots = pgmSnap.exists() ? pgmSnap.val() : []
      let scheduleBlocks = blocksSnap.exists() ? blocksSnap.val() : {}

      // 누락된 디폴트 블록 보충
      const missing = buildDefaultBlocks(pgmSlots, scheduleBlocks)
      if (Object.keys(missing).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), missing)
        scheduleBlocks = { ...scheduleBlocks, ...missing }
      }

      const meta = metaSnap.exists() ? metaSnap.val() : {}

      setState({
        startDate, endDate: meta.endDate || '', poolType,
        pgmSlots,
        targetMetrics: targetSnap.exists() ? targetSnap.val() : null,
        weightedMinTargets: weightedSnap.exists() ? Object.values(weightedSnap.val()) : [],
        scheduleBlocks,
        manualInputs: inputsSnap.exists() ? inputsSnap.val() : {},
        lastUpdated: lastUpdatedSnap.exists() ? lastUpdatedSnap.val() : null,
        splitSlots: splitSnap.exists() ? splitSnap.val() : {},
        starred: starredSnap.exists() ? starredSnap.val() : {},
        scheduledItemIds: scheduledSnap.exists() ? scheduledSnap.val() : {},
        isLoaded: true, isLoading: false,
        proposalLoaded: false, performanceLoaded: false, preScheduleLoaded: false,
      })

      // 실시간 구독 시작
      getState()._subscribeAll(weekKey)

    } catch (e) {
      setState({ error: e.message, isLoading: false })
    }
  },

  _subscribeAll: (weekKey) => {
    unsubscribeAll()

    const paths = {
      scheduleBlocks: snap => setState({ scheduleBlocks: snap.exists() ? snap.val() : {} }),
      splitSlots:     snap => setState({ splitSlots:     snap.exists() ? snap.val() : {} }),
      starred:        snap => setState({ starred:        snap.exists() ? snap.val() : {} }),
      scheduledItemIds: snap => setState({ scheduledItemIds: snap.exists() ? snap.val() : {} }),
      manualInputs:   snap => setState({ manualInputs:   snap.exists() ? snap.val() : {} }),
    }

    Object.entries(paths).forEach(([path, handler]) => {
      const r = ref(db, `sessions/${weekKey}/${path}`)
      onValue(r, handler)
      subscriptions[`${weekKey}/${path}`] = r
    })
  },

  loadProposals: async () => {
    const { startDate, poolType, proposalLoaded, scheduledItemIds } = getState()
    if (proposalLoaded) return
    setState({ isLoadingProposals: true })
    try {
      const weekKey = `${startDate}_${poolType}`
      const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
      const all = snap.exists() ? snap.val() : []
      // 이미 편성된 아이템 제외
      const items = all.filter(p => !scheduledItemIds[p.itemId])
      setState({ proposalItems: items, proposalLoaded: true, isLoadingProposals: false })
    } catch (e) {
      setState({ error: e.message, isLoadingProposals: false })
    }
  },

  loadPerformance: async () => {
    const { startDate, poolType, performanceLoaded } = getState()
    if (performanceLoaded) return
    setState({ isLoadingPerformance: true })
    try {
      const weekKey = `${startDate}_${poolType}`
      const snap = await get(ref(db, `sessions/${weekKey}/gasData/performanceRows`))
      setState({ performanceRows: snap.exists() ? snap.val() : [], performanceLoaded: true, isLoadingPerformance: false })
    } catch (e) {
      setState({ error: e.message, isLoadingPerformance: false })
    }
  },

  loadPreSchedule: async () => {
    const { startDate, poolType, preScheduleLoaded } = getState()
    if (preScheduleLoaded) return
    try {
      const weekKey = `${startDate}_${poolType}`
      const snap = await get(ref(db, `sessions/${weekKey}/gasData/preScheduleRows`))
      setState({ preScheduleRows: snap.exists() ? snap.val() : [], preScheduleLoaded: true })
    } catch (e) {
      setState({ error: e.message })
    }
  },

  // 블록 저장
  saveBlock: async (blockKey, blockData) => {
    const { startDate, poolType, scheduleBlocks, writeLog } = getState()
    const weekKey = `${startDate}_${poolType}`
    const before = scheduleBlocks[blockKey] || null
    await update(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), blockData)
    if (!blockData.isDefault) {
      await writeLog(before ? '수정' : '편성', blockKey, before, { ...before, ...blockData })
    }
  },

  // 블록 삭제 → 디폴트 복원
  removeBlock: async (blockKey) => {
    const { startDate, poolType, pgmSlots, scheduleBlocks, writeLog } = getState()
    const weekKey = `${startDate}_${poolType}`
    const block = scheduleBlocks[blockKey]

    const isSimpleSlot = !blockKey.includes('_CA') && !blockKey.includes('_IP')
    const slotId = isSimpleSlot ? blockKey : blockKey.replace('_CA','').replace('_IP','')
    const slot = pgmSlots.find(s => s.slotId === slotId)
    const channel = isSimpleSlot ? 'ALL' : (blockKey.includes('_CA') ? 'CA' : 'IP')

    // 편성 아이템이면 scheduledItemIds에서 제거
    if (block && !block.isDefault && !block.isCompeting && block.itemId) {
      await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${block.itemId}`), null)
    }

    if (block && !block.isDefault) {
      await writeLog('삭제', blockKey, block, null)
    }

    if (slot) {
      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), makeDefaultBlock(slot, channel))
    } else {
      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), null)
    }
  },

  // 편성 아이템 사이드바에서 제거 + Firebase 기록
  scheduleItem: async (itemId) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${itemId}`), true)
    setState(s => ({ proposalItems: s.proposalItems.filter(p => p.itemId !== itemId) }))
  },

  // 사이드바로 복귀
  removeFromSidebar: async (itemId) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${itemId}`), true)
    setState(s => ({ proposalItems: s.proposalItems.filter(p => p.itemId !== itemId) }))
  },

  copyBlockToSidebar: async (block) => {
    const { startDate, poolType, proposalItems } = getState()
    if (!block.itemId) return
    const weekKey = `${startDate}_${poolType}`
    // scheduledItemIds에서 제거 → 다시 사이드바로
    await set(ref(db, `sessions/${weekKey}/scheduledItemIds/${block.itemId}`), null)
    const gasSnap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
    const allItems = gasSnap.exists() ? gasSnap.val() : []
    const originalItem = allItems.find(p => p.itemId === block.itemId)
    if (originalItem && !proposalItems.some(p => p.itemId === block.itemId)) {
      setState(s => ({ proposalItems: [...s.proposalItems, originalItem] }))
    }
  },

  // CA/IP 분리 토글
  toggleSplitSlot: async (slotId) => {
    const { startDate, poolType, splitSlots } = getState()
    const weekKey = `${startDate}_${poolType}`
    const current = !!splitSlots[slotId]
    await set(ref(db, `sessions/${weekKey}/splitSlots/${slotId}`), current ? null : true)
  },

  // 별표 토글
  toggleStarred: async (itemId) => {
    const { startDate, poolType, starred } = getState()
    const weekKey = `${startDate}_${poolType}`
    const current = !!starred[itemId]
    await set(ref(db, `sessions/${weekKey}/starred/${itemId}`), current ? null : true)
  },

  saveManualInput: async (itemId, inputData) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await update(ref(db, `sessions/${weekKey}/manualInputs/${itemId}`), inputData)
    setState(s => ({ manualInputs: { ...s.manualInputs, [itemId]: { ...s.manualInputs[itemId], ...inputData } } }))
  },

  refreshPerformance: async () => {
    const { startDate, poolType } = getState()
    setState({ isLoadingPerformance: true })
    try {
      const { fetchRefreshPerformance } = await import('../api/gas')
      const performanceRows = await fetchRefreshPerformance()
      const weekKey = `${startDate}_${poolType}`
      const now = Date.now()
      await update(ref(db, `sessions/${weekKey}/gasData`), { performanceRows })
      await update(ref(db, `sessions/${weekKey}/lastUpdated`), { performance: now })
      setState(s => ({ performanceRows, performanceLoaded: true, isLoadingPerformance: false, lastUpdated: { ...s.lastUpdated, performance: now } }))
    } catch (e) {
      setState({ error: e.message, isLoadingPerformance: false })
    }
  },

  refreshProposals: async () => {
    const { startDate, poolType } = getState()
    setState({ isLoadingProposals: true })
    try {
      const { fetchInitData } = await import('../api/gas')
      const data = await fetchInitData(startDate, poolType)
      const weekKey = `${startDate}_${poolType}`
      const now = Date.now()
      await update(ref(db, `sessions/${weekKey}/gasData`), { proposalItems: data.proposalItems })
      await update(ref(db, `sessions/${weekKey}/lastUpdated`), { proposal: now })
      const { scheduledItemIds } = getState()
      const items = data.proposalItems.filter(p => !scheduledItemIds[p.itemId])
      setState(s => ({ proposalItems: items, proposalLoaded: true, isLoadingProposals: false, lastUpdated: { ...s.lastUpdated, proposal: now } }))
    } catch (e) {
      setState({ error: e.message, isLoadingProposals: false })
    }
  },

  refreshPreSchedule: async () => {
    const { startDate, poolType, pgmSlots, scheduleBlocks } = getState()
    try {
      const { fetchInitData } = await import('../api/gas')
      const data = await fetchInitData(startDate, poolType)
      const weekKey = `${startDate}_${poolType}`
      const now = Date.now()
      const preScheduleRows = data.preScheduleRows || []
      await update(ref(db, `sessions/${weekKey}/gasData`), { preScheduleRows })
      await update(ref(db, `sessions/${weekKey}/lastUpdated`), { preSchedule: now })
      const preBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, scheduleBlocks)
      if (Object.keys(preBlocks).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), preBlocks)
      }
      setState(s => ({ preScheduleRows, preScheduleLoaded: true, lastUpdated: { ...s.lastUpdated, preSchedule: now } }))
    } catch (e) {
      setState({ error: e.message })
    }
  },

  addCustomProposalItem: async (itemData) => {
    const { startDate, poolType, proposalItems } = getState()
    const weekKey = `${startDate}_${poolType}`
    const customItem = { ...itemData, itemId: `CUSTOM_${Date.now()}`, isCustom: true }
    setState({ proposalItems: [...proposalItems, customItem] })
    await set(ref(db, `sessions/${weekKey}/customProposalItems/${customItem.itemId}`), customItem)
  },
}))

export default useScheduleStore