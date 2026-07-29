// unknownFallback: 인식 불가 값에 적용할 기본값 (기본 '[위]')
// - 선편성처럼 엄격히 처리할 때는 기본값 그대로 사용
// - 제안상품처럼 원값을 보존하려면 unknownFallback에 원값을 전달
export function normalizeDealType(dealType, unknownFallback = '[위]') {
  if (!dealType) return '[위]'
  const dt = String(dealType).trim()
  if (!dt) return '[위]'
  // 이미 정규화된 값 그대로 통과
  if (/^\[[위모직혼액률]\]$/.test(dt)) return dt
  const parenMatch = dt.match(/\((.)\)/)
  if (parenMatch) {
    const map = { 위: '[위]', 모: '[모]', 직: '[직]', 혼: '[혼]', 액: '[액]', 률: '[률]' }
    if (map[parenMatch[1]]) return map[parenMatch[1]]
  }
  // 위수탁 계열
  if (dt.includes('위수탁') || dt === '위' || dt === '기타') return '[위]'
  // 직매입
  if (dt.includes('직매입') || dt === '직') return '[직]'
  // 모바일광고
  if (dt.includes('모바일광고') || dt === '모') return '[모]'
  // 혼합 계열 (혼합수수료, 특약매입)
  if (dt.includes('혼합') || dt.includes('특약매입') || dt.includes('특약') || dt === '혼') return '[혼]'
  // 정액
  if (dt.includes('정액') || dt === '액') return '[액]'
  // 정률 / 효율
  if (dt.includes('정률') || dt.includes('효율') || dt === '률') return '[률]'
  // 인식 불가 → unknownFallback
  return unknownFallback
}

// perfKey는 정규화된 dealType + pgmCodeName의 조합만 허용
// pgmCodeName 없으면 null → 실적 0으로 표시 (2안 fallback 없음)
export function makePerfKey(dealType, pgmCodeName) {
  const cleanName = String(pgmCodeName || '').trim()
  if (!cleanName) return null
  return `${normalizeDealType(dealType)}${cleanName}`
}

export function getPerfDisplay(perf) {
  return {
    salesText:  Number(perf?.salesPerWeightedMin  || 0).toLocaleString(),
    profitText: Number(perf?.profitPerWeightedMin || 0).toLocaleString(),
    dateText:   perf?.broadcastDate || '-',
    timeText:   perf?.broadcastTime || '-',
  }
}
