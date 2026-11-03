import { assignedPromotionIds } from './promotionAssignment.js'

export function getUncheckedPromotionBroadcasts({ broadcasts, targetCodes, reservations, promotionId, promotions, ids, names }) {
  const reserved = Object.values(reservations).filter(item => item.promotionId === promotionId && item.status !== 'cancelled')
  return broadcasts.flatMap(([id, row]) => {
    const target = targetCodes.has(String(row.pgmCodeName || '').trim())
    const reservation = reserved.some(item => item.appliedEntryIds?.[id] || (
      Number(item.broadcastTimestamp) === Number(row.broadcastTimestamp) &&
      String(item.pgmCodeName || '').trim() === String(row.pgmCodeName || '').trim()
    ))
    if ((!target && !reservation) || assignedPromotionIds(row, ids[id], names[id], promotions).includes(promotionId)) return []
    return [{ id, row, reason: [target && '대상 상품', reservation && '예약방송'].filter(Boolean).join(' · ') }]
  })
}
