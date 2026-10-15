import { db, ref, get } from '../../api/firebase'
import { performanceQueryCache } from '../../api/performanceQuery'
import { receivePerformanceMeta } from '../usePerformanceQueryStore'
import { encodeKey } from '../../utils/firebaseKey'
import {
  collectPerfKeys,
  normalizePerfEntry,
  normalizePerfHistory,
} from '../../utils/performanceHistory'

const GLOBAL_LATEST_PATH = 'latestPerfMap'
const GLOBAL_META_PATH = 'performanceMeta'

export function createPerformanceHistoryActions(setState, getState) {
  return {
    async loadGlobalPerformanceData(options = {}) {
      const force = !!options.force
      const state = getState()
      if (!force && state.performanceGlobalLoaded) return

      setState({ isLoadingPerformanceKeys: true })
      try {
        // Compatibility entry point: metadata only. Rows are queried by date/perfKey.
        const metaSnap = await get(ref(db, GLOBAL_META_PATH))
        receivePerformanceMeta(metaSnap.val())
        setState({
          performanceMeta: metaSnap.exists() ? metaSnap.val() : null,
          performanceGlobalLoaded: true,
          isLoadingPerformanceKeys: false,
        })
      } catch (e) {
        setState({ error: e.message, isLoadingPerformanceKeys: false })
      }
    },

    async ensurePerformanceKeys(perfKeys = [], options = {}) {
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
        const latestResults = await Promise.allSettled(missingLatest.map(async perfKey => {
          const snap = await get(ref(db, `${GLOBAL_LATEST_PATH}/${encodeKey(perfKey)}`))
          return [perfKey, snap.exists() ? normalizePerfEntry(snap.val(), perfKey) : null]
        }))
        const historyResults = await Promise.allSettled(missingHistory.map(async perfKey => {
          const rows = await performanceQueryCache.load('product', perfKey)
          return [perfKey, normalizePerfHistory(rows, perfKey)]
        }))
        const latestPairs = latestResults.filter(result => result.status === 'fulfilled').map(result => result.value)
        const historyPairs = historyResults.filter(result => result.status === 'fulfilled').map(result => result.value)
        const failure = [...latestResults, ...historyResults].find(result => result.status === 'rejected')
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
            performanceHistoryByKey[perfKey] = history
            loadedPerfKeys[perfKey] = { ...(loadedPerfKeys[perfKey] || {}), history: true, loadedAt: now }
          })
          return {
            latestPerfByKey,
            performanceHistoryByKey,
            loadedPerfKeys,
            isLoadingPerformanceKeys: false,
            error: failure ? failure.reason.message : null,
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

    async refreshLoadedPerformanceKeys() {
      const loaded = getState().loadedPerfKeys || {}
      const latest = Object.keys(loaded).filter(key => loaded[key].latest)
      const history = Object.keys(loaded).filter(key => loaded[key].history)
      setState({ loadedPerfKeys: {} })
      await Promise.all([
        getState().ensurePerformanceKeys(latest, { latest: true }),
        getState().ensurePerformanceKeys(history, { latest: false, history: true }),
      ])
    },
  }
}
