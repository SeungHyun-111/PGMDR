import { db, ref, get, update, query, orderByKey, startAt, endAt, runTransaction } from './firebase'
import { CULTURE_DATABASE_URL, CULTURE_MASTER_PATH } from './cultureCodeMaster'
import { buildReservationApplicationUpdates, reservationTimestamp, PROMOTION_RESERVATIONS_PATH, PROMOTION_IDS_PATH, PROMOTION_NAMES_PATH } from '../utils/promotionAssignment'
import { refreshPerformanceQueries } from '../store/usePerformanceQueryStore'

export async function applyReservationBatch({ reservations, rows, promotions }) {
  for (const [id, original] of Object.entries(reservations || {})) {
    const reservation = original.status === 'applying' ? { ...original, status: 'pending' } : original
    const updates = buildReservationApplicationUpdates({ reservations: { [id]: reservation }, rows, promotions })
    if (!Object.keys(updates).length) continue
    const claimId = crypto.randomUUID()
    const target = ref(db, `${PROMOTION_RESERVATIONS_PATH}/${id}`)
    const claim = await runTransaction(target, current => {
      // Firebase may first call with null before the server value is cached.
      // Return null to let it compare/retry; undefined would abort immediately.
      if (!current) return null
      if (current.status !== 'pending' && !(current.status === 'applying' && current.claimedAt < Date.now() - 120000)) return
      return { ...current, status: 'applying', claimId, claimedAt: Date.now() }
    }, { applyLocally: false })
    if (!claim.committed || claim.snapshot.val()?.claimId !== claimId) continue
    try {
      // Claim prevents cancellation racing an automatic application. Assignment
      // leaves and completion status are committed together.
      updates[`${PROMOTION_RESERVATIONS_PATH}/${id}/claimId`] = null
      updates[`${PROMOTION_RESERVATIONS_PATH}/${id}/claimedAt`] = null
      await update(ref(db), updates)
    } catch (error) {
      await runTransaction(target, current => current?.claimId === claimId
        ? { ...current, status: 'pending', claimId: null, claimedAt: null } : undefined, { applyLocally: false })
      throw error
    }
  }
}

export async function applyExistingReservation(reservationId) {
  const reservationSnapshot = await get(ref(db, `${PROMOTION_RESERVATIONS_PATH}/${reservationId}`))
  const reservation = reservationSnapshot.val()
  if (!reservation || !['pending', 'applying'].includes(reservation.status)) return
  const prefix = reservation.broadcastDateTime.slice(0, 10).replaceAll('-', '')
  const [rowsSnapshot, promotionsSnapshot, idsSnapshot, namesSnapshot] = await Promise.all([
    get(query(ref(db, 'performanceEntries'), orderByKey(), startAt(`${prefix}0000`), endAt(`${prefix}2359\uf8ff`))),
    get(ref(db, 'global/promotions')), get(ref(db, PROMOTION_IDS_PATH)), get(ref(db, PROMOTION_NAMES_PATH)),
  ])
  const rows = Object.fromEntries(Object.entries(rowsSnapshot.val() || {}).map(([id, row]) => [id, {
    ...row, promotionIds: idsSnapshot.val()?.[id] ?? row.promotionIds,
    promotionName: namesSnapshot.val()?.[id] ?? row.promotionName,
  }]))
  await applyReservationBatch({ reservations: { [reservationId]: reservation }, rows, promotions: promotionsSnapshot.val() })
  refreshPerformanceQueries()
}

async function preparePromotionReservation({ promotionId, broadcastDateTime, pgmCodeName }) {
  const broadcastTimestamp = reservationTimestamp(broadcastDateTime)
  const code = String(pgmCodeName || '').trim()
  const [masterResponse, promotionSnapshot] = await Promise.all([
    fetch(`${CULTURE_DATABASE_URL}/${CULTURE_MASTER_PATH}/items.json`, { cache: 'no-store', signal: AbortSignal.timeout(20000) }),
    get(ref(db, `global/promotions/${promotionId}`)),
  ])
  if (!masterResponse.ok) throw new Error('편성코드 목록을 확인하지 못했습니다.')
  const master = await masterResponse.json()
  if (!code || !Object.values(master || {}).some(item => String(item?.code || '').trim() === code)) throw new Error('RTDB에 등록된 편성코드명을 선택해주세요.')
  const promotion = promotionSnapshot.val()
  const date = broadcastDateTime.slice(0, 10)
  if (!promotion?.startDate || !promotion.endDate || date < promotion.startDate || date > promotion.endDate) throw new Error('프로모션 기간 안의 방송일시를 입력해주세요.')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([promotionId, broadcastTimestamp, code])))
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return { id, promotionId, broadcastDateTime, broadcastTimestamp, pgmCodeName: code }
}

export async function savePromotionReservation({ userName = '', ...input }) {
  const { id, ...fields } = await preparePromotionReservation(input)
  // Identical reservations share one ID; a repeated click cannot reset an applied reservation.
  await runTransaction(ref(db, `${PROMOTION_RESERVATIONS_PATH}/${id}`), current => current && current.status !== 'cancelled' ? current : {
    ...fields,
    status: 'pending', createdAt: Date.now(), createdBy: userName,
  }, { applyLocally: false })
  try { await applyExistingReservation(id) } catch {
    throw new Error('예약은 저장했지만 기존 실적 확인에 실패했습니다. 예약 목록에서 적용 재시도를 눌러주세요.')
  }
  return id
}

export async function editPromotionReservation(reservationId, input) {
  const { id, ...fields } = await preparePromotionReservation(input)
  // Rename the deterministic key and update fields atomically. A refresh claim
  // or another user's edit cannot leave both the old and new reservation active.
  const result = await runTransaction(ref(db, PROMOTION_RESERVATIONS_PATH), current => {
    if (!current) return null
    const original = current?.[reservationId]
    if (!original || original.status !== 'pending') return
    if (id !== reservationId && current[id] && current[id].status !== 'cancelled') return
    const next = { ...current }
    delete next[reservationId]
    next[id] = { ...original, ...fields, updatedAt: Date.now(), status: 'pending' }
    return next
  }, { applyLocally: false })
  if (!result.committed || !result.snapshot.val()?.[id]) throw new Error('대기 중인 예약만 수정할 수 있습니다. 동일한 예약이 있는지도 확인해주세요.')
  await applyExistingReservation(id)
  return id
}

export async function cancelPromotionReservation(id) {
  const result = await runTransaction(ref(db, `${PROMOTION_RESERVATIONS_PATH}/${id}`), current => {
    if (!current) return null
    if (current.status !== 'pending') return
    return { ...current, status: 'cancelled', cancelledAt: Date.now() }
  }, { applyLocally: false })
  if (!result.committed || result.snapshot.val()?.status !== 'cancelled') throw new Error('대기 중인 예약만 취소할 수 있습니다. 적용된 방송은 실적 선정에서 해제해주세요.')
}
