import assert from 'node:assert/strict'
import test from 'node:test'
import { getPromotionBaseline, getPromotionPreviousThree, getPromotionResultRows } from '../src/utils/promotionResults.js'

test('P-1 uses promotion start, excludes all promotion-period broadcasts and matches perfKey', () => {
  const rows = [
    { perfKey: '[위]A', broadcastTimestamp: 202610051031 },
    { perfKey: '[위]A', broadcastTimestamp: 202610010000 },
    { perfKey: '[직]A', broadcastTimestamp: 202609302331 },
    { perfKey: '[위]A', broadcastTimestamp: 202609300459 },
    { perfKey: '[위]A', broadcastTimestamp: 202609292331, targetSales: 123 },
    { perfKey: '[위]A', broadcastTimestamp: 202606302331 },
  ]
  assert.equal(getPromotionBaseline(rows, '2026-10-01', '[위]A').targetSales, 123)
  assert.equal(getPromotionBaseline(rows, '2026-10-01', '[위]B'), null)
  assert.equal(getPromotionBaseline([{ perfKey: '[위]A', broadcastTimestamp: 202606302331 }], '2026-10-01', '[위]A'), null)
})

test('P-1 includes exact 3-month boundary and returns no baseline when none exists', () => {
  assert.ok(getPromotionBaseline([{ perfKey: 'A', broadcastTimestamp: 202607010000 }], '2026-10-01', 'A'))
  assert.equal(getPromotionBaseline([], '2026-10-01', 'A'), null)
})

test('October 2 and 3 share the same pre-promotion three; October 2 is never a baseline', () => {
  const rows = [202610031031, 202610021031, 202610010000, 202609302331, 202609292331, 202609282331, 202606302331].map(broadcastTimestamp => ({ perfKey: '[위]A', broadcastTimestamp }))
  const expected = [202609302331, 202609292331, 202609282331]
  for (const broadcast of ['2026-10-02', '2026-10-03']) {
    const history = getPromotionPreviousThree(rows, '2026-10-01', '[위]A')
    assert.deepEqual(history.map(row => row.broadcastTimestamp), expected, broadcast)
    assert.equal(getPromotionBaseline(rows, '2026-10-01', '[위]A').broadcastTimestamp, expected[0])
  }
})

test('results use assigned name, respect dates and realtime clearing overrides old stored names', () => {
  const rows = {
    a: { broadcastDate: '2026-10-01', promotionName: '행사', broadcastTimestamp: 202610011031 },
    b: { broadcastDate: '2026-10-02', promotionName: '행사', broadcastTimestamp: 202610021031 },
    c: { broadcastDate: '2026-10-03', promotionName: '다른 행사', broadcastTimestamp: 202610031031 },
    d: { broadcastDate: '2026-09-30', promotionName: '행사' },
  }
  const result = getPromotionResultRows(rows, { a: '', c: '행사' }, { name: '행사', startDate: '2026-10-01' }, '2026-10-12')
  assert.deepEqual(result.map(([id]) => id), ['b', 'c'])
})
