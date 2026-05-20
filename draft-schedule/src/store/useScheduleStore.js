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
    slotId: slot.slotId,
    blockKey,
    dateKey: slot.dateKey,
    timeText: slot.timeText,
    durationMin: slot.durationMin,
    weightedMin: slot.weightedMin,
    channel,
    pgmCodeName: '[편성팀]',
    orgName: '편성팀',
    mdTeam: '편성팀',
    memoCode: '[전사블록]',
    isDefault: true,
    assignedAt: Date.now()
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
      slotId: slot.slotId,
      blockKey: slot.slotId,
      dateKey: slot.dateKey,
      timeText: slot.timeText,
      durationMin: slot.durationMin,
      weightedMin: slot.weightedMin,
      channel: 'CA',
      pgmCodeName: pre.pgmCodeName,
      orgName: pre.orgName,
      mdTeam: pre.orgName,
      dealTypeChar,
      isPreSchedule: true,
      isDefault: false,
      assignedAt: Date.now()
    }
  })
  return preBlocks
}

function buildDefaultBlocks(pgmSlots, existingBlocks) {
  const missing = {}
  pgmSlots.forEach(slot => {
    if (!existingBlocks[slot.slotId]) {
      missing[slot.slotId] = makeDefaultBlock(slot, 'ALL')
    }
  })
  return missing
}

const useScheduleStore = create((setState, getState) => ({
  startDate: '',
  endDate: '',
  poolType: 'A',
  isLoaded: false,
  isLoading: false,
  isLoadingProposals: false,
  isLoadingPerformance: false,
  error: null,

  pgmSlots: [],
  targetMetrics: null,
  scheduleBlocks: {},
  manualInputs: {},

  proposalItems: [],
  proposalLoaded: false,
  performanceRows: [],
  performanceLoaded: false,
  preScheduleRows: [],
  preScheduleLoaded: false,

  lastUpdated: null,

  // 세션 초기화 후 새로 로드
  resetSession: async (startDate, poolType) => {
    setState({ isLoading: true, error: null, isLoaded: false })
    try {
      const weekKey = `${startDate}_${poolType}`
      // 기존 세션 완전 삭제
      await set(ref(db, `sessions/${weekKey}`), null)
      // 구독 해제
      const prev = getState()._blocksUnsubscribe
      if (prev) prev()
      // 상태 초기화
      setState({
        scheduleBlocks: {},
        manualInputs: {},
        proposalItems: [],
        performanceRows: [],
        preScheduleRows: [],
        proposalLoaded: false,
        performanceLoaded: false,
        preScheduleLoaded: false,
        lastUpdated: null,
      })
      // 새로 로드
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
          gasData,
          scheduleBlocks: {},
          manualInputs: {},
          createdAt: now,
          lastUpdated: { pgm: now, proposal: now, performance: now, preSchedule: now }
        })
        const pgmSlots = gasData.pgmSlots || []
        const preScheduleRows = gasData.preScheduleRows || []
        const preBlocks = buildPreScheduleBlocks(pgmSlots, preScheduleRows, {})
        const defaultBlocks = buildDefaultBlocks(pgmSlots, preBlocks)
        const allBlocks = { ...defaultBlocks, ...preBlocks }
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks`), allBlocks)
      }

      const pgmSnap = await get(ref(db, `sessions/${weekKey}/gasData/pgmSlots`))
      const pgmSlots = pgmSnap.exists() ? pgmSnap.val() : []

      const targetSnap = await get(ref(db, `sessions/${weekKey}/gasData/targetMetrics`))
      const targetMetrics = targetSnap.exists() ? targetSnap.val() : null

      const meta = metaSnap.exists() ? metaSnap.val() : {}

      const blocksSnap = await get(ref(db, `sessions/${weekKey}/scheduleBlocks`))
      let scheduleBlocks = blocksSnap.exists() ? blocksSnap.val() : {}

      const missing = buildDefaultBlocks(pgmSlots, scheduleBlocks)
      if (Object.keys(missing).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), missing)
        scheduleBlocks = { ...scheduleBlocks, ...missing }
      }

      const inputsSnap = await get(ref(db, `sessions/${weekKey}/manualInputs`))
      const manualInputs = inputsSnap.exists() ? inputsSnap.val() : {}

      const lastUpdatedSnap = await get(ref(db, `sessions/${weekKey}/lastUpdated`))
      const lastUpdated = lastUpdatedSnap.exists() ? lastUpdatedSnap.val() : null

      setState({
        startDate,
        endDate: meta.endDate || '',
        poolType,
        pgmSlots,
        targetMetrics,
        scheduleBlocks,
        manualInputs,
        lastUpdated,
        isLoaded: true,
        isLoading: false,
        proposalLoaded: false,
        performanceLoaded: false,
        preScheduleLoaded: false,
      })

      getState()._subscribeBlocks(weekKey)

    } catch (e) {
      setState({ error: e.message, isLoading: false })
    }
  },

  _blocksUnsubscribe: null,
  _subscribeBlocks: (weekKey) => {
    const prev = getState()._blocksUnsubscribe
    if (prev) prev()
    const blocksRef = ref(db, `sessions/${weekKey}/scheduleBlocks`)
    onValue(blocksRef, snap => {
      setState({ scheduleBlocks: snap.exists() ? snap.val() : {} })
    })
    setState({ _blocksUnsubscribe: () => off(blocksRef) })
  },

  loadProposals: async () => {
    const { startDate, poolType, proposalLoaded } = getState()
    if (proposalLoaded) return
    setState({ isLoadingProposals: true })
    try {
      const weekKey = `${startDate}_${poolType}`
      const snap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
      setState({ proposalItems: snap.exists() ? snap.val() : [], proposalLoaded: true, isLoadingProposals: false })
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

  saveBlock: async (blockKey, blockData) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await update(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), blockData)
  },

  removeBlock: async (blockKey) => {
    const { startDate, poolType, pgmSlots, scheduleBlocks, proposalItems } = getState()
    const weekKey = `${startDate}_${poolType}`
    const block = scheduleBlocks[blockKey]

    const isSimpleSlot = !blockKey.includes('_CA') && !blockKey.includes('_IP')
    const slotId = isSimpleSlot ? blockKey : blockKey.replace('_CA', '').replace('_IP', '')
    const slot = pgmSlots.find(s => s.slotId === slotId)
    const channel = isSimpleSlot ? 'ALL' : (blockKey.includes('_CA') ? 'CA' : 'IP')

    if (block && !block.isDefault && !block.isCompeting && block.itemId) {
      const alreadyIn = proposalItems.some(p => p.itemId === block.itemId)
      if (!alreadyIn) {
        const gasSnap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
        const allItems = gasSnap.exists() ? gasSnap.val() : []
        const originalItem = allItems.find(p => p.itemId === block.itemId)
        if (originalItem) setState(s => ({ proposalItems: [...s.proposalItems, originalItem] }))
      }
    }

    if (slot) {
      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), makeDefaultBlock(slot, channel))
    } else {
      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${blockKey}`), null)
    }
  },

  removeFromSidebar: (itemId) => {
    setState(s => ({ proposalItems: s.proposalItems.filter(p => p.itemId !== itemId) }))
  },

  copyBlockToSidebar: async (block) => {
    const { startDate, poolType, proposalItems } = getState()
    if (!block.itemId) return
    const weekKey = `${startDate}_${poolType}`
    const gasSnap = await get(ref(db, `sessions/${weekKey}/gasData/proposalItems`))
    const allItems = gasSnap.exists() ? gasSnap.val() : []
    const originalItem = allItems.find(p => p.itemId === block.itemId)
    if (originalItem) {
      const alreadyIn = proposalItems.some(p => p.itemId === block.itemId)
      if (!alreadyIn) setState(s => ({ proposalItems: [...s.proposalItems, originalItem] }))
    }
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
      setState(s => ({ proposalItems: data.proposalItems, proposalLoaded: true, isLoadingProposals: false, lastUpdated: { ...s.lastUpdated, proposal: now } }))
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
    const customItem = { ...itemData, itemId: `CUSTOM_${Date.now()}`, isCustom: true, source: { type: 'custom' } }
    setState({ proposalItems: [...proposalItems, customItem] })
    await set(ref(db, `sessions/${weekKey}/customProposalItems/${customItem.itemId}`), customItem)
  },
}))

export default useScheduleStore