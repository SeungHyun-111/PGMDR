// 거래형태 목록 - 직접 관리
export const DEAL_TYPES = [
  '[위]',
  '[모]',
  '[직]',
  '[혼]',
  '[액]',
  '[률]',
]

// 거래형태 → 뱃지 한글자
export function getDealTypeChar(dealType) {
  if (!dealType) return ''
  if (dealType.startsWith('[위]') || dealType.includes('위수탁')) return '위'
  if (dealType.startsWith('[모]') || dealType.includes('모바일광고')) return '모'
  if (dealType.startsWith('[직]') || dealType.includes('직매입')) return '직'
  if (dealType.startsWith('[혼]') || dealType.includes('혼합')) return '혼'
  if (dealType.startsWith('[액]') || dealType.includes('정액')) return '액'
  if (dealType.startsWith('[률]') || dealType.includes('정률')) return '률'
  return dealType.charAt(0)
}

// perfKey에서 거래형태 뱃지 제거 → pgmCodeName과 매칭용
// "[위][꾸띄르]컬러샴푸" → "[꾸띄르]컬러샴푸"
export function stripDealTypePrefix(perfKey) {
  if (!perfKey) return ''
  return String(perfKey).replace(/^\[[위모직혼액률]\]/, '').trim()
}