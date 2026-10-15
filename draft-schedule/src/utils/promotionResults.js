import { previousThree } from './performanceQuery.js'

export function getPromotionPreviousThree(rows, promotionStart, perfKey) {
  if (!promotionStart || !perfKey) return []
  const matching = Object.values(rows || {}).filter(row => row?.perfKey === perfKey)
  return previousThree(matching, Number(`${promotionStart.replaceAll('-', '')}0000`))
}

export function getPromotionBaseline(rows, promotionStart, perfKey) {
  return getPromotionPreviousThree(rows, promotionStart, perfKey)[0] || null
}

export function getPromotionResultRows(rows, names, promotion, end) {
  const name = String(promotion?.name || '').trim()
  if (!name || !promotion?.startDate || !end) return []
  return Object.entries(rows || {}).filter(([id, row]) =>
    row?.broadcastDate >= promotion.startDate && row.broadcastDate <= end
    && String(names[id] ?? row.promotionName ?? '').trim() === name,
  ).sort(([aId, a], [bId, b]) => Number(a.broadcastTimestamp || 0) - Number(b.broadcastTimestamp || 0) || aId.localeCompare(bId))
}
