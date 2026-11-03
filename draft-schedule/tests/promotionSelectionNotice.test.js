import test from 'node:test'
import assert from 'node:assert/strict'
import { getUncheckedPromotionBroadcasts } from '../src/utils/promotionSelectionNotice.js'

test('counts target or reserved broadcasts once and respects selected promotion and realtime overrides', () => {
  const input = {
    broadcasts: [
      ['both', { pgmCodeName: 'A', broadcastTimestamp: 202611031200 }],
      ['reserved', { pgmCodeName: 'B', broadcastTimestamp: 202611031300 }],
      ['checked', { pgmCodeName: 'A', promotionIds: { p: true } }],
      ['other', { pgmCodeName: 'A', promotionIds: { other: true } }],
      ['legacy', { pgmCodeName: 'A', promotionName: '행사' }],
      ['cancelled', { pgmCodeName: 'C', broadcastTimestamp: 202611031400 }],
    ],
    targetCodes: new Set(['A']), promotionId: 'p', promotions: [['p', { name: '행사' }]], ids: {}, names: {},
    reservations: {
      a: { promotionId: 'p', pgmCodeName: 'A', broadcastTimestamp: 202611031200, status: 'pending' },
      b: { promotionId: 'p', pgmCodeName: 'B', broadcastTimestamp: 202611031300, status: 'applied' },
      c: { promotionId: 'p', pgmCodeName: 'C', broadcastTimestamp: 202611031400, status: 'cancelled' },
    },
  }
  const result = getUncheckedPromotionBroadcasts(input)
  assert.deepEqual(result.map(item => item.id), ['both', 'reserved', 'other'])
  assert.equal(result[0].reason, '대상 상품 · 예약방송')
  input.ids = { both: { p: true }, checked: { _v: true } }
  assert.deepEqual(getUncheckedPromotionBroadcasts(input).map(item => item.id), ['reserved', 'checked', 'other'])
})
