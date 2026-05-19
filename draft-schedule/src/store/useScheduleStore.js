import { create } from 'zustand'
import { db, ref, set, get, update } from '../api/firebase'

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

const useScheduleStore = create((setState, getState) => ({
  startDate: '',
  endDate: '',
  poolType: 'A',
  isLoaded: false,
  isLoading: false,
  error: null,

  pgmSlots: [],
  proposalItems: [],
  performanceRows: [],
  preScheduleRows: [],
  targetMetrics: null,

  scheduleBlocks: {},
  manualInputs: {},

  loadInitData: async (startDate, poolType) => {
    setState({ isLoading: true, error: null })
    try {
      const weekKey = `${startDate}_${poolType}`
      const snapshot = await get(ref(db, `sessions/${weekKey}`))

      let gasData
      if (snapshot.exists()) {
        gasData = snapshot.val().gasData
      } else {
        const { fetchInitData } = await import('../api/gas')
        gasData = await fetchInitData(startDate, poolType)
        await set(ref(db, `sessions/${weekKey}`), {
          gasData,
          scheduleBlocks: {},
          manualInputs: {},
          createdAt: Date.now()
        })
      }

      const blocksSnap = await get(ref(db, `sessions/${weekKey}/scheduleBlocks`))
      const inputsSnap = await get(ref(db, `sessions/${weekKey}/manualInputs`))

      const pgmSlots = gasData.pgmSlots || []
      const preScheduleRows = gasData.preScheduleRows || []
      const proposalItems = gasData.proposalItems || []

      // 선편성 자동반영
      // Firebase에 저장된 기존 블록 가져오기
      const existingBlocks = blocksSnap.exists() ? blocksSnap.val() : {}

      // slotId 매칭 맵 생성 (dateKey+timeText → slot)
      const slotMap = {}
      pgmSlots.forEach(slot => {
        const key = `${slot.dateKey}_${normalizeTime(slot.timeText)}`
        slotMap[key] = slot
      })

      // 선편성 → 블록 자동 생성 (기존 블록 없는 경우에만)
      const preBlocks = {}
      preScheduleRows.forEach(pre => {
        const parsed = parseDateTime(pre.broadcastDateTime)
        if (!parsed) return
        const key = `${parsed.dateKey}_${normalizeTime(parsed.timeText)}`
        const slot = slotMap[key]
        if (!slot) return
        if (existingBlocks[slot.slotId]) return // 이미 편성된 슬롯은 유지

        // displayValue에서 거래형태 한 글자 추출
        // 패턴: "26/06/01 00:31위[편성코드명]"
        const dvMatch = String(pre.displayValue || '').match(/\d{2}:\d{2}(.)/)
        const dealTypeChar = dvMatch ? dvMatch[1] : ''

        preBlocks[slot.slotId] = {
          slotId: slot.slotId,
          dateKey: slot.dateKey,
          timeText: slot.timeText,
          durationMin: slot.durationMin,
          weightedMin: slot.weightedMin,
          channel: 'CA',
          pgmCodeName: pre.pgmCodeName,
          orgName: pre.orgName,
          dealTypeChar,
          isPreSchedule: true,
          assignedAt: Date.now()
        }
      })

      // 선편성 블록 Firebase 저장
      if (Object.keys(preBlocks).length > 0) {
        await update(ref(db, `sessions/${weekKey}/scheduleBlocks`), preBlocks)
      }

      const mergedBlocks = { ...preBlocks, ...existingBlocks }

      setState({
        startDate,
        endDate: gasData.meta.endDate,
        poolType,
        pgmSlots,
        proposalItems,
        performanceRows: gasData.performanceRows || [],
        preScheduleRows,
        targetMetrics: gasData.targetMetrics || null,
        scheduleBlocks: mergedBlocks,
        manualInputs: inputsSnap.exists() ? inputsSnap.val() : {},
        isLoaded: true,
        isLoading: false,
      })
    } catch (e) {
      setState({ error: e.message, isLoading: false })
    }
  },

  saveBlock: async (slotId, blockData) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await update(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}`), blockData)
    setState(s => ({
      scheduleBlocks: { ...s.scheduleBlocks, [slotId]: { ...s.scheduleBlocks[slotId], ...blockData } }
    }))
  },

  removeBlock: async (slotId) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}`), null)
    setState(s => {
      const next = { ...s.scheduleBlocks }
      delete next[slotId]
      return { scheduleBlocks: next }
    })
  },

  saveManualInput: async (itemId, inputData) => {
    const { startDate, poolType } = getState()
    const weekKey = `${startDate}_${poolType}`
    await update(ref(db, `sessions/${weekKey}/manualInputs/${itemId}`), inputData)
    setState(s => ({
      manualInputs: { ...s.manualInputs, [itemId]: { ...s.manualInputs[itemId], ...inputData } }
    }))
  },

  refreshPerformance: async () => {
    const { startDate, poolType } = getState()
    setState({ isLoading: true })
    try {
      const { fetchRefreshPerformance } = await import('../api/gas')
      const performanceRows = await fetchRefreshPerformance()
      const weekKey = `${startDate}_${poolType}`
      await update(ref(db, `sessions/${weekKey}/gasData`), { performanceRows })
      setState({ performanceRows, isLoading: false })
    } catch (e) {
      setState({ error: e.message, isLoading: false })
    }
  },
}))

export default useScheduleStore