import { useMemo } from 'react'

function normalizeDealType(dealType) {
  if (!dealType) return ''
  const dt = String(dealType).trim()
  if (/^\[[위모직혼액률]\]$/.test(dt)) return dt
  if (dt.includes('위수탁') || dt === '위') return '[위]'
  if (dt.includes('모바일광고') || dt === '모') return '[모]'
  if (dt.includes('직매입') || dt === '직') return '[직]'
  if (dt.includes('혼합') || dt === '혼') return '[혼]'
  if (dt.includes('정액') || dt === '액') return '[액]'
  if (dt.includes('정률') || dt === '률') return '[률]'
  return ''
}

export function makePerfKey(dealType, pgmCodeName) {
  if (!pgmCodeName) return ''
  const prefix = normalizeDealType(dealType)
  return prefix + pgmCodeName
}

// 정확히 맵핑되는 것 중 가장 최신, 없으면 null
export function findBestPerf(perfMap, dealType, pgmCodeName) {
  if (!pgmCodeName || !perfMap) return null
  const key = makePerfKey(dealType, pgmCodeName)
  if (!key || !perfMap[key]?.length) return null
  return perfMap[key][0] // 이미 최신순 정렬됨
}

export default function usePerformanceMap(performanceRows) {
  return useMemo(() => {
    const map = {}
    performanceRows.forEach(perf => {
      const key = perf.perfKey
      if (!key) return
      if (!map[key]) map[key] = []
      map[key].push(perf)
    })
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) =>
        String(b.broadcastDate).replace(/\D/g,'')
          .localeCompare(String(a.broadcastDate).replace(/\D/g,''))
      )
    })
    return map
  }, [performanceRows])
}