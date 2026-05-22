import { create } from 'zustand'
import { db, ref, set } from '../api/firebase'
import { createSessionActions } from './actions/sessionActions'
import { createBlockActions }   from './actions/blockActions'
import { createItemActions }    from './actions/itemActions'
import { createRefreshActions } from './actions/refreshActions'

export { makeDefaultBlock } from './helpers/blockBuilders'

const useScheduleStore = create((setState, getState) => ({
  // ── 상태 ──────────────────────────────
  isLoaded:   false,
  isLoading:  false,
  error:      null,

  startDate: '', endDate: '', poolType: 'A',
  userName:  localStorage.getItem('userName') || '',

  pgmSlots:           [],
  proposalItems:      [],
  preScheduleRows:    [],
  weightedMinTargets: [],
  targetMetrics:      null,
  perfMap:            {},

  scheduleBlocks:   {},
  splitSlots:       {},
  starred:          {},
  scheduledItemIds: {},
  manualInputs:     {},
  lastUpdated:      null,

  proposalLoaded:         false,
  isLoadingProposals:     false,
  isLoadingPerformance:   false,
  isLoadingPreSchedule:   false,
  isLoadingGasAll:        false,

  // ── 로그 (내부용) ─────────────────────
  async _writeLog(action, blockKey, before, after) {
    const { startDate, poolType, userName } = getState()
    await set(ref(db, `sessions/${startDate}_${poolType}/logs/log_${Date.now()}`), {
      timestamp: Date.now(), action, blockKey,
      pgmCodeName: after?.pgmCodeName || before?.pgmCodeName || '',
      dateKey:     after?.dateKey     || before?.dateKey     || '',
      timeText:    after?.timeText    || before?.timeText    || '',
      userName:    userName || '익명',
      before: before || null,
      after:  after  || null,
    })
  },

  // ── actions 주입 ──────────────────────
  ...createSessionActions(setState, getState),
  ...createBlockActions(setState, getState),
  ...createItemActions(setState, getState),
  ...createRefreshActions(setState, getState),
}))

export default useScheduleStore