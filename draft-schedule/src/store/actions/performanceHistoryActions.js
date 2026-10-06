import { db, ref, get } from '../../api/firebase'
import { decodeKey, encodeKey } from '../../utils/firebaseKey'
import {
  buildHistoryByKeyFromRows,
  buildLatestByKeyFromHistory,
  collectPerfKeys,
  decodeHistoryByKey,
  normalizePerfEntry,
  normalizePerfHistory,
} from '../../utils/performanceHistory'

const GLOBAL_HISTORY_PATH = 'performanceHistory'
const GLOBAL_LATEST_PATH = 'latestPerfMap'
const GLOBAL_ENTRIES_PATH = 'performanceEntries'
const LEGACY_ROWS_PATH = 'performanceRows'
const GLOBAL_META_PATH = 'performanceMeta'

export function createPerformanceHistoryActions(setState, getState) {
  return {
    async loadGlobalPerformanceData(options = {}) {
      const force = !!options.force
      const state = getState()
      if (!force && state.performanceGlobalLoaded) return

      setState({ isLoadingPerformanceKeys: true })
      try {
        const [entriesSnap, legacyRowsSnap, latestSnap, historySnap, metaSnap] = await Promise.all([
          get(ref(db, GLOBAL_ENTRIES_PATH)),
          get(ref(db, LEGACY_ROWS_PATH)),
          get(ref(db, GLOBAL_LATEST_PATH)),
          get(ref(db, GLOBAL_HISTORY_PATH)),
          get(ref(db, GLOBAL_META_PATH)),
        ])
        const performanceRows = {
          ...(legacyRowsSnap.exists() ? legacyRowsSnap.val() : {}),
          ...(entriesSnap.exists() ? entriesSnap.val() : {}),
        }
        const rowHistoryByKey = buildHistoryByKeyFromRows(performanceRows)
        const storedHistoryByKey = decodeHistoryByKey(historySnap.exists() ? historySnap.val() : {})
        const performanceHistoryByKey = Object.keys(rowHistoryByKey).length ? rowHistoryByKey : storedHistoryByKey
        const latestPerfByKey = Object.keys(rowHistoryByKey).length
          ? buildLatestByKeyFromHistory(performanceHistoryByKey)
          : decodeLatestMap(latestSnap.exists() ? latestSnap.val() : {})
        setState({
          performanceRows,
          performanceMeta: metaSnap.exists() ? metaSnap.val() : null,
          latestPerfByKey,
          performanceHistoryByKey,
          performanceGlobalLoaded: true,
          loadedPerfKeys: {},
          isLoadingPerformanceKeys: false,
        })
      } catch (e) {
        setState({ error: e.message, isLoadingPerformanceKeys: false })
      }
    },

    async ensurePerformanceKeys(perfKeys = [], options = {}) {
      if (getState().performanceGlobalLoaded) return
      const keys = collectPerfKeys(perfKeys.map(perfKey => ({ perfKey })))
      if (!keys.length) return
      const wantLatest = options.latest !== false
      const wantHistory = !!options.history
      const state = getState()
      const missingLatest = wantLatest
        ? keys.filter(key => !state.loadedPerfKeys?.[key]?.latest)
        : []
      const missingHistory = wantHistory
        ? keys.filter(key => !state.loadedPerfKeys?.[key]?.history)
        : []
      if (!missingLatest.length && !missingHistory.length) return

      setState({ isLoadingPerformanceKeys: true })
      try {
        const latestPairs = await Promise.all(missingLatest.map(async perfKey => {
          const snap = await get(ref(db, `${GLOBAL_LATEST_PATH}/${encodeKey(perfKey)}`))
          return [perfKey, snap.exists() ? normalizePerfEntry(snap.val(), perfKey) : null]
        }))
        const historyPairs = await Promise.all(missingHistory.map(async perfKey => {
          const snap = await get(ref(db, `${GLOBAL_HISTORY_PATH}/${encodeKey(perfKey)}`))
          return [perfKey, snap.exists() ? normalizePerfHistory(snap.val(), perfKey) : []]
        }))
        const now = Date.now()
        setState(s => {
          const latestPerfByKey = { ...(s.latestPerfByKey || {}) }
          const performanceHistoryByKey = { ...(s.performanceHistoryByKey || {}) }
          const loadedPerfKeys = { ...(s.loadedPerfKeys || {}) }
          latestPairs.forEach(([perfKey, entry]) => {
            if (entry) latestPerfByKey[perfKey] = entry
            loadedPerfKeys[perfKey] = { ...(loadedPerfKeys[perfKey] || {}), latest: true, loadedAt: now }
          })
          historyPairs.forEach(([perfKey, history]) => {
            if (history.length > 0) performanceHistoryByKey[perfKey] = history
            loadedPerfKeys[perfKey] = { ...(loadedPerfKeys[perfKey] || {}), history: true, loadedAt: now }
          })
          return {
            latestPerfByKey,
            performanceHistoryByKey,
            loadedPerfKeys,
            isLoadingPerformanceKeys: false,
          }
        })
      } catch (e) {
        setState({ error: e.message, isLoadingPerformanceKeys: false })
      }
    },

    seedPerformanceFromPerfMap(perfMap = {}) {
      setState(s => {
        const latestPerfByKey = { ...(s.latestPerfByKey || {}) }
        const performanceHistoryByKey = { ...(s.performanceHistoryByKey || {}) }
        const loadedPerfKeys = { ...(s.loadedPerfKeys || {}) }
        Object.entries(perfMap || {}).forEach(([perfKey, perf]) => {
          const entry = normalizePerfEntry({ ...perf, perfKey }, perfKey)
          if (!entry) return
          latestPerfByKey[perfKey] = latestPerfByKey[perfKey] || entry
          performanceHistoryByKey[perfKey] = performanceHistoryByKey[perfKey] || [entry]
          loadedPerfKeys[perfKey] = {
            ...(loadedPerfKeys[perfKey] || {}),
            legacySeed: true,
            seededAt: Date.now(),
          }
        })
        return { latestPerfByKey, performanceHistoryByKey, loadedPerfKeys }
      })
    },

    invalidatePerformanceKeys(perfKeys = null) {
      if (!perfKeys) {
        setState({ loadedPerfKeys: {}, performanceGlobalLoaded: false })
        return
      }
      const keySet = new Set(perfKeys)
      setState(s => {
        const loadedPerfKeys = { ...(s.loadedPerfKeys || {}) }
        keySet.forEach(key => { delete loadedPerfKeys[key] })
        return { loadedPerfKeys }
      })
    },
  }
}

function decodeLatestMap(raw = {}) {
  const result = {}
  Object.entries(raw || {}).forEach(([encodedKey, value]) => {
    const perfKey = decodeKey(encodedKey)
    const entry = normalizePerfEntry(value, perfKey)
    if (entry) result[perfKey] = entry
  })
  return result
}
