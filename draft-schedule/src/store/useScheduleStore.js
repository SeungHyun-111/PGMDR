import { create } from 'zustand'
import { db, ref, set } from '../api/firebase'
import { createSessionActions }  from './actions/sessionActions'
import { createBlockActions }    from './actions/blockActions'
import { createItemActions }     from './actions/itemActions'
import { createRefreshActions }  from './actions/refreshActions'
import { createTimeSlotActions } from './actions/timeSlotActions'
import { createPerformanceHistoryActions } from './actions/performanceHistoryActions'
import { VERSION_DRAFT } from '../utils/sessionVersion'

export { makeDefaultBlock } from './helpers/blockBuilders'

const MAX_UNDO_STACK = 50
const compactValue = value => value === undefined ? null : value

const useScheduleStore = create((setState, getState) => ({
  // ── 상태 ──────────────────────────────
  isLoaded:   false,
  isLoading:  false,
  error:      null,

  startDate: '', endDate: '', poolType: 'A',
  currentVersionId: localStorage.getItem('currentVersionId') || VERSION_DRAFT,
  versionMeta: {},
  isPublishingSales: false,
  userName:  localStorage.getItem('userName') || '',

  pgmSlots:           [],
  allProposalItems:   [],
  proposalItems:      [],
  preScheduleRows:    [],
  weightedMinTargets: [],
  targetMetrics:      null,
  perfMap:            {},
  latestPerfByKey:    {},
  performanceHistoryByKey: {},
  performanceRows:    {},
  performanceMeta:    null,
  loadedPerfKeys:     {},
  performanceGlobalLoaded: false,

  scheduleBlocks:   {},
  _rawBlocks:       {},  // Firebase 원본 (entityProps 머지 전)
  entityProps:      {},  // uniqueKey → 엔티티 속성 단일 저장소
  splitSlots:       {},
  customSlots:      {},
  starred:          {},
  scheduledItemIds: {},
  scheduledUniqueKeys: {},
  manualInputs:     {},
  opsOverlay:       {},
  opsSyncConflicts: [],
  opsSyncResult:    null,
  lastUpdated:      null,
  undoStack:        [],
  pendingUndo:      null,
  _undoBatch:       null,

  isViewerMode: localStorage.getItem('isViewerMode') === 'true',
  setViewerMode: (v) => {
    const next = typeof v === 'function' ? v(getState().isViewerMode) : v
    localStorage.setItem('isViewerMode', String(next))
    setState({ isViewerMode: next })
  },

  gridSearch: '',
  setGridSearch: (q) => setState({ gridSearch: q }),
  searchPanelOpen: false,
  setSearchPanelOpen: (v) => setState({ searchPanelOpen: typeof v === 'function' ? v(getState().searchPanelOpen) : v }),

  beginUndoBatch(label) {
    setState({ _undoBatch: { label, changes: [], createdAt: Date.now() } })
  },

  endUndoBatch() {
    const batch = getState()._undoBatch
    if (!batch) return
    setState({ _undoBatch: null })
    if (batch.changes.length > 0) getState()._pushUndoEntry(batch)
  },

  cancelUndoBatch() {
    setState({ _undoBatch: null })
  },

  async runUndoBatch(label, fn) {
    const hadBatch = !!getState()._undoBatch
    if (!hadBatch) getState().beginUndoBatch(label)
    try {
      const result = await fn()
      if (!hadBatch) getState().endUndoBatch()
      return result
    } catch (e) {
      if (!hadBatch) getState().cancelUndoBatch()
      throw e
    }
  },

  _pushUndoEntry(entry) {
    if (!entry?.changes?.length) return
    setState(s => ({
      undoStack: [
        {
          ...entry,
          id: entry.id || `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          createdAt: entry.createdAt || Date.now(),
        },
        ...s.undoStack,
      ].slice(0, MAX_UNDO_STACK),
    }))
  },

  recordUndoChange(label, change) {
    if (!change?.path) return
    const normalized = {
      ...change,
      before: compactValue(change.before),
      after: compactValue(change.after),
    }
    if (JSON.stringify(normalized.before) === JSON.stringify(normalized.after)) return
    const batch = getState()._undoBatch
    if (batch) {
      setState({ _undoBatch: { ...batch, changes: [...batch.changes, normalized] } })
      return
    }
    getState()._pushUndoEntry({
      label,
      changes: [normalized],
      createdAt: Date.now(),
    })
  },

  requestUndo() {
    const entry = getState().undoStack[0]
    if (!entry) return false
    setState({ pendingUndo: entry })
    return true
  },

  cancelUndo() {
    setState({ pendingUndo: null })
  },

  async confirmUndo() {
    const entry = getState().pendingUndo
    if (!entry) return
    setState({ pendingUndo: null })
    for (const change of [...entry.changes].reverse()) {
      await set(ref(db, change.path), compactValue(change.before))
    }
    await getState()._writeUndoLogs(entry)
    setState(s => ({
      undoStack: s.undoStack.filter(item => item.id !== entry.id),
    }))
  },

  async _writeUndoLogs(entry) {
    const groups = groupUndoChangesForLogs(entry?.changes || [])
    await Promise.all(groups.map(group => {
      const representative = getUndoLogRepresentative(group.changes)
      const before = representative.after || null
      const after = representative.before || null
      const blockKey = getUndoLogBlockKey(representative)
      return getState()._writeLog('되돌리기', blockKey, before, after, {
        scope: group.scope,
        detail: group.detail,
        undoId: entry.id || '',
        undoLabel: entry.label || '',
        undoChangeCount: group.changes.length,
      })
    }))
  },

  proposalLoaded:         false,
  isLoadingProposals:     false,
  isLoadingPerformance:   false,
  isLoadingPreSchedule:   false,
  isLoadingGasAll:        false,
  isLoadingPerformanceKeys: false,

  // ── 로그 (내부용) ─────────────────────
  async _writeLog(action, blockKey, before, after, meta = {}) {
    const { startDate, poolType, userName, currentVersionId } = getState()
    await set(ref(db, `sessions/${startDate}_${poolType}/logs/log_${Date.now()}`), {
      timestamp: Date.now(), action, blockKey,
      pgmCodeName: after?.pgmCodeName || before?.pgmCodeName || '',
      dateKey:     after?.dateKey     || before?.dateKey     || '',
      timeText:    after?.timeText    || before?.timeText    || '',
      channel:     after?.channel     || before?.channel     || '',
      userName:    userName || '익명',
      versionId:   currentVersionId || VERSION_DRAFT,
      before: before || null,
      after:  after  || null,
      scope: meta.scope || 'schedule',
      ...meta,
    })
  },

  // ── actions 주입 ──────────────────────
  ...createSessionActions(setState, getState),
  ...createBlockActions(setState, getState),
  ...createItemActions(setState, getState),
  ...createRefreshActions(setState, getState),
  ...createTimeSlotActions(setState, getState),
  ...createPerformanceHistoryActions(setState, getState),
}))

export default useScheduleStore

function groupUndoChangesForLogs(changes) {
  const grouped = { schedule: [], sidebar: [] }
  changes.forEach(change => {
    const scope = getUndoChangeScope(change)
    if (!scope) return
    grouped[scope].push(change)
  })
  return Object.entries(grouped)
    .filter(([, list]) => list.length > 0)
    .map(([scope, list]) => ({
      scope,
      changes: list,
      detail: makeUndoLogDetail(scope, list),
    }))
}

function getUndoChangeScope(change) {
  const path = change?.path || ''
  if (
    path.includes('/scheduleBlocks/')
    || path.includes('/splitSlots/')
    || path.includes('/customSlots/')
  ) return 'schedule'
  if (
    path.includes('/proposalItems/')
    || path.includes('/scheduledItemIds/')
    || path.includes('/scheduledUniqueKeys/')
    || path.includes('/entityProps/')
    || path.includes('/manualInputs/')
    || path.includes('/starred/')
  ) return 'sidebar'
  return null
}

function makeUndoLogDetail(scope, changes) {
  const label = scope === 'schedule' ? '편성표' : '사이드바 상품'
  return `${label} 되돌리기 (${changes.length.toLocaleString()}건)`
}

function getUndoLogRepresentative(changes) {
  return changes.find(change => isObjectLogValue(change?.after) || isObjectLogValue(change?.before))
    || changes[0]
    || {}
}

function isObjectLogValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getUndoLogBlockKey(change) {
  const path = change?.path || ''
  const match = path.match(/\/scheduleBlocks\/([^/]+)/)
  return match?.[1] || ''
}
