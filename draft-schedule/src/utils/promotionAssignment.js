export const PROMOTION_NAMES_PATH = 'performancePromotionNames'

export function buildPromotionAssignmentUpdates({ entryId, sourcePath, name, currentName }) {
  if (typeof name !== 'string') throw new Error('프로모션명을 확인해주세요.')
  if (name === currentName) return null
  if (!entryId || ['.', '#', '$', '[', ']', '/'].some(character => entryId.includes(character)) || !['performanceEntries', 'performanceRows'].includes(sourcePath)) {
    throw new Error('실적 경로를 확인할 수 없습니다. 실적을 다시 불러와주세요.')
  }
  return {
    [`${sourcePath}/${entryId}/promotionName`]: name,
    [`${PROMOTION_NAMES_PATH}/${entryId}`]: name,
  }
}

export const PROMOTION_IDS_PATH = 'performancePromotionIds'
export const PROMOTION_RESERVATIONS_PATH = 'promotionReservations'

export function assignedPromotionIds(row = {}, ids, legacyName, promotions = []) {
  const value = ids ?? row.promotionIds
  if (value) return Object.keys(value).filter(id => id !== '_v' && value[id] === true)
  const name = String(legacyName ?? row.promotionName ?? '').trim()
  return name ? promotions.filter(([, promotion]) => String(promotion.name || '').trim() === name).map(([id]) => id) : []
}

export function buildPromotionIdUpdates({ entryId, sourcePath = 'performanceEntries', promotionId, assigned, currentIds = [] }) {
  for (const key of [entryId, promotionId]) {
    if (!key || ['.', '#', '$', '[', ']', '/'].some(character => key.includes(character)) || key === '_v') throw new Error('프로모션 지정 경로를 확인해주세요.')
  }
  if (!['performanceEntries', 'performanceRows'].includes(sourcePath)) throw new Error('실적 경로를 확인해주세요.')
  const updates = {}
  for (const root of [`${sourcePath}/${entryId}/promotionIds`, `${PROMOTION_IDS_PATH}/${entryId}`]) {
    updates[`${root}/_v`] = true
    for (const id of currentIds) updates[`${root}/${id}`] = true
    updates[`${root}/${promotionId}`] = assigned ? true : null
  }
  return updates
}

export function reservationTimestamp(dateTime) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime)) throw new Error('방송일시를 분 단위로 입력해주세요.')
  const date = new Date(`${dateTime}:00+09:00`)
  if (!Number.isFinite(date.getTime()) || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) !== dateTime.slice(0, 10) || Number(dateTime.slice(11, 13)) > 23 || Number(dateTime.slice(14)) > 59) throw new Error('방송일시를 확인해주세요.')
  return Number(dateTime.replace(/\D/g, ''))
}

export function buildReservationApplicationUpdates({ reservations, rows, promotions, now = Date.now() }) {
  const updates = {}
  for (const [reservationId, reservation] of Object.entries(reservations || {})) {
    if (reservation.status !== 'pending') continue
    const promotion = promotions?.[reservation.promotionId]
    if (!promotion || !promotion.startDate || !promotion.endDate) continue
    const date = String(reservation.broadcastDateTime || '').slice(0, 10)
    if (date < promotion.startDate || date > promotion.endDate) continue
    const matches = Object.entries(rows || {}).filter(([, row]) => Number(row.broadcastTimestamp) === Number(reservation.broadcastTimestamp) && String(row.pgmCodeName || '').trim() === reservation.pgmCodeName)
    if (!matches.length) continue
    for (const [entryId, row] of matches) {
      const currentIds = row.promotionIds ? [] : assignedPromotionIds(row, undefined, undefined, Object.entries(promotions))
      Object.assign(updates, buildPromotionIdUpdates({ entryId, promotionId: reservation.promotionId, assigned: true, currentIds }))
      updates[`${PROMOTION_RESERVATIONS_PATH}/${reservationId}/appliedEntryIds/${entryId}`] = true
    }
    updates[`${PROMOTION_RESERVATIONS_PATH}/${reservationId}/status`] = 'applied'
    updates[`${PROMOTION_RESERVATIONS_PATH}/${reservationId}/appliedAt`] = now
  }
  return updates
}
