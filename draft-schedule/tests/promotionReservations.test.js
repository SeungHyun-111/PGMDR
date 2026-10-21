import assert from 'node:assert/strict'
import test from 'node:test'
import { assignedPromotionIds, buildPromotionIdUpdates, buildReservationApplicationUpdates, reservationTimestamp } from '../src/utils/promotionAssignment.js'
import { getPromotionResultRows } from '../src/utils/promotionResults.js'

const promotions = {
  internal: { name: '내부', startDate: '2026-10-01', endDate: '2026-10-31' },
  special: { name: '스패페', startDate: '2026-10-01', endDate: '2026-10-31' },
}
const row = { pgmCodeName: '상품A', broadcastDate: '2026-10-20', broadcastTimestamp: 202610201031, promotionName: '내부' }
const reservation = { promotionId: 'special', pgmCodeName: '상품A', broadcastTimestamp: 202610201031, broadcastDateTime: '2026-10-20T10:31', status: 'pending' }

test('legacy selection survives adding another promotion; clearing does not revive old name', () => {
  assert.deepEqual(assignedPromotionIds(row, undefined, undefined, Object.entries(promotions)), ['internal'])
  const updates = buildPromotionIdUpdates({ entryId: 'a', promotionId: 'special', assigned: true, currentIds: ['internal'] })
  assert.equal(updates['performanceEntries/a/promotionIds/internal'], true)
  assert.equal(updates['performancePromotionIds/a/special'], true)
  const removal = buildPromotionIdUpdates({ entryId: 'a', promotionId: 'special', assigned: false })
  assert.equal(removal['performancePromotionIds/a/special'], null)
  assert.equal(removal['performancePromotionIds/a/internal'], undefined)
  assert.deepEqual(assignedPromotionIds(row, { _v: true }, undefined, Object.entries(promotions)), [])
})

test('same broadcast counts once in each promotion and follows IDs after rename', () => {
  const rows = { a: row }
  const ids = { a: { _v: true, internal: true, special: true } }
  for (const [id, promotion] of Object.entries(promotions)) {
    assert.equal(getPromotionResultRows(rows, {}, { ...promotion, name: '변경한 이름' }, '2026-10-31', ids, id).length, 1)
  }
  assert.equal(Object.keys(rows).length, 1)
})

test('reservation requires exact date/time and code, adds to existing assignment atomically', () => {
  const updates = buildReservationApplicationUpdates({ reservations: { r: reservation }, rows: { a: row }, promotions, now: 123 })
  assert.equal(updates['performancePromotionIds/a/internal'], true)
  assert.equal(updates['performancePromotionIds/a/special'], true)
  assert.equal(updates['promotionReservations/r/status'], 'applied')
  assert.equal(updates['promotionReservations/r/appliedAt'], 123)
  for (const changed of [{ ...row, broadcastTimestamp: 202610211031 }, { ...row, pgmCodeName: '상품B' }]) {
    assert.deepEqual(buildReservationApplicationUpdates({ reservations: { r: reservation }, rows: { a: changed }, promotions }), {})
  }
})

test('overlapping reservations both apply; completed/cancelled or deleted promotions do not reapply', () => {
  const reservations = { first: reservation, second: { ...reservation, promotionId: 'internal' } }
  const updates = buildReservationApplicationUpdates({ reservations, rows: { a: row }, promotions })
  assert.equal(updates['performancePromotionIds/a/internal'], true)
  assert.equal(updates['performancePromotionIds/a/special'], true)
  for (const status of ['applied', 'cancelled']) {
    assert.deepEqual(buildReservationApplicationUpdates({ reservations: { r: { ...reservation, status } }, rows: { a: row }, promotions }), {})
  }
  assert.deepEqual(buildReservationApplicationUpdates({ reservations, rows: { a: row }, promotions: {} }), {})
})

test('Korea broadcast time validates calendar dates, minutes and midnight', () => {
  assert.equal(reservationTimestamp('2026-10-20T00:00'), 202610200000)
  assert.equal(reservationTimestamp('2026-10-20T23:59'), 202610202359)
  for (const invalid of ['2026-02-30T10:31', '2026-10-20T24:00', '2026-10-20T10:60', '2026-10-20']) assert.throws(() => reservationTimestamp(invalid))
})
