import { normalizePromotionDate } from './promotionDate.js'

export function getPromotionPerformanceDates(rows, promotion, today) {
  if (!promotion?.startDate || !promotion?.endDate || promotion.startDate > promotion.endDate) return []
  const end = promotion.endDate < today ? promotion.endDate : today
  return [...new Set(Object.values(rows || {}).map(row => normalizePromotionDate(row?.broadcastDate))
    .filter(date => date && date >= promotion.startDate && date <= end))].sort()
}

export function getPromotionBroadcasts(rows, promotion, date, registeredOnly = false) {
  const codes = new Set(Object.values(promotion?.products || {}).map(product => String(product.pgmCodeName || '').trim()).filter(Boolean))
  if (!date || !promotion?.startDate || !promotion?.endDate || date < promotion.startDate || date > promotion.endDate) return []
  return Object.entries(rows || {}).filter(([, row]) => normalizePromotionDate(row?.broadcastDate) === date && (!registeredOnly || codes.has(String(row.pgmCodeName || '').trim())))
    .sort(([idA, a], [idB, b]) => String(a.broadcastTime || '').localeCompare(String(b.broadcastTime || '')) || idA.localeCompare(idB))
}
