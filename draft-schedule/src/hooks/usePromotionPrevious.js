import { useEffect, useMemo, useState } from 'react'
import { performanceQueryCache } from '../api/performanceQuery'
import usePerformanceQueryStore from '../store/usePerformanceQueryStore'
import { getPromotionPreviousThree } from '../utils/promotionResults'
import { makePerfKey } from './usePerformanceMap'

export const getPerformanceKey = row => row.perfKey || makePerfKey(row.dealTypeConverted || row.dealType2 || row.dealType, row.pgmCodeName)

export default function usePromotionPrevious(rows, start, enabled) {
  const revision = usePerformanceQueryStore(state => state.revision)
  const [attempt, setAttempt] = useState(0)
  const keysJson = JSON.stringify([...new Set(rows.map(([, row]) => getPerformanceKey(row)).filter(Boolean))].sort())
  const token = enabled ? `${revision}/${attempt}/${start}/${keysJson}` : ''
  const [result, setResult] = useState({ token: '', byKey: {}, errors: [] })
  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      const keys = JSON.parse(keysJson)
      const byKey = {}
      const errors = []
      for (let index = 0; index < keys.length; index += 4) {
        if (cancelled) return
        await Promise.all(keys.slice(index, index + 4).map(async key => {
          try { byKey[key] = getPromotionPreviousThree(await performanceQueryCache.load('product', key), start, key) }
          catch (error) { errors.push(`${key}: ${error.message}`) }
        }))
      }
      if (!cancelled) setResult({ token, byKey, errors })
    }
    load()
    return () => { cancelled = true }
  }, [token, keysJson, start])
  const pending = enabled && result.token !== token
  const current = useMemo(() => result.token === token ? result : { byKey: {}, errors: [] }, [result, token])
  return { ...current, loading: pending, retry: () => setAttempt(value => value + 1) }
}
