function normalizeDealType(dealType) {
  if (!dealType) return ''
  const dt = String(dealType).trim()
  if (/^\[[위모직혼액률]\]$/.test(dt)) return dt
  if (dt.includes('위수탁')    || dt === '위') return '[위]'
  if (dt.includes('모바일광고') || dt === '모') return '[모]'
  if (dt.includes('직매입')    || dt === '직') return '[직]'
  if (dt.includes('혼합')      || dt === '혼') return '[혼]'
  if (dt.includes('정액')      || dt === '액') return '[액]'
  if (dt.includes('효율')      || dt === '률') return '[률]'
  return dt.startsWith('[') ? dt : `[${dt}]`
}

// dealType + pgmCodeName 정확히 일치할 때만 반환, 아니면 null
export function makePerfKey(dealType, pgmCodeName) {
  if (!dealType || !pgmCodeName) return null
  const dt = normalizeDealType(dealType)
  if (!dt) return null
  return `${dt}${pgmCodeName}`
}

export function findBestPerf(perfMap, dealType, pgmCodeName) {
  if (!perfMap || !dealType || !pgmCodeName) return null
  const key = makePerfKey(dealType, pgmCodeName)
  if (!key) return null
  return perfMap[key] || null
}

export function getPerfDisplay(perf) {
  return {
    salesText:  Number(perf?.salesPerWeightedMin  || 0).toLocaleString(),
    profitText: Number(perf?.profitPerWeightedMin || 0).toLocaleString(),
    dateText:   perf?.broadcastDate || '-',
    timeText:   perf?.broadcastTime || '-',
  }
}