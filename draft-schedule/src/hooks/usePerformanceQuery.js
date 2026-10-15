import { useEffect, useState } from 'react'
import { performanceQueryCache } from '../api/performanceQuery'
import usePerformanceQueryStore from '../store/usePerformanceQueryStore'

export default function usePerformanceQuery(type, value, enabled = true) {
  const revision = usePerformanceQueryStore(state => state.revision)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ token: '', rows: {}, error: '' })
  const token = enabled && value ? `${revision}/${attempt}/${type}/${value}` : ''
  useEffect(() => {
    if (!token) return
    let cancelled = false
    performanceQueryCache.load(type, value).then(rows => {
      if (!cancelled) setResult({ token, rows, error: '' })
    }).catch(error => { if (!cancelled) setResult({ token, rows: {}, error: error.message }) })
    return () => { cancelled = true }
  }, [token, type, value])
  const retry = () => setAttempt(value => value + 1)
  if (!token) return { rows: {}, loading: false, error: '', retry }
  return result.token === token ? { ...result, loading: false, retry } : { rows: {}, loading: true, error: '', retry }
}
