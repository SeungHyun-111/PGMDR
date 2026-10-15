import { useEffect, useState } from 'react'
import { performanceQueryCache } from '../api/performanceQuery'
import { dateRange } from '../utils/performanceQuery'
import usePerformanceQueryStore, { watchPerformanceMeta } from '../store/usePerformanceQueryStore'

export default function usePerformanceRange(start, end, enabled = true) {
  const revision = usePerformanceQueryStore(state => state.revision)
  const token = enabled ? `${revision}/${start}/${end}` : ''
  const [result, setResult] = useState({ token: '', rows: {}, error: '' })
  useEffect(() => { if (enabled) return watchPerformanceMeta() }, [enabled])
  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      const dates = dateRange(start, end)
      const rows = {}
      for (let i = 0; i < dates.length; i += 4) {
        if (cancelled) return
        const batch = await Promise.all(dates.slice(i, i + 4).map(date => performanceQueryCache.load('date', date)))
        batch.forEach(day => Object.assign(rows, day))
      }
      if (!cancelled) setResult({ token, rows, error: '' })
    }
    load().catch(error => { if (!cancelled) setResult({ token, rows: {}, error: error.message }) })
    return () => { cancelled = true }
  }, [start, end, token])
  if (!enabled) return { rows: {}, loading: false, error: '' }
  return result.token === token ? { ...result, loading: false } : { rows: {}, loading: true, error: '' }
}
