import assert from 'node:assert/strict'
import test from 'node:test'
import { getPromotionSortValue, sortPromotionResults } from '../src/utils/promotionResultsSort.js'

const key = row => row.perfKey
const org = row => row.mdTeam || '미분류'
const entries = [
  ['a', { perfKey: 'A', broadcastTimestamp: 202610031031, expectedSales: 9, contributionProfit: -5, pgmCodeName: '상품10', mdTeam: '식품팀' }],
  ['b', { perfKey: 'B', broadcastTimestamp: 202610021031, expectedSales: 100, contributionProfit: 10, pgmCodeName: '상품2', mdTeam: '뷰티팀' }],
]
const ids = (column, direction = 'asc', previous = {}) => sortPromotionResults(entries, { column, direction }, previous, key, org).map(([id]) => id)

test('default date ascending and descending; numeric, negative amounts and Korean text sorting', () => {
  assert.deepEqual(ids(0), ['b', 'a'])
  assert.deepEqual(ids(0, 'desc'), ['a', 'b'])
  assert.deepEqual(ids(7), ['a', 'b'])
  assert.deepEqual(ids(7, 'desc'), ['b', 'a'])
  assert.deepEqual(ids(8), ['a', 'b'])
  assert.deepEqual(ids(4), ['b', 'a'])
  assert.deepEqual(ids(13), ['b', 'a'])
  assert.equal(entries[0][0], 'a')
})

test('each P-1/P-2/P-3 header reads its own historical slot and missing slots sort as displayed zero', () => {
  const previous = {
    A: [{ broadcastTimestamp: 202609011031, targetSales: 100 }, { broadcastTimestamp: 202608011031, targetSales: 10 }, { broadcastTimestamp: 202607011031, weightedMin: 25 }],
    B: [{ broadcastTimestamp: 202609021031, targetSales: 10 }, { broadcastTimestamp: 202608021031, targetSales: 100 }],
  }
  assert.deepEqual(ids(15, 'asc', previous), ['a', 'b'])
  assert.deepEqual(ids(16, 'asc', previous), ['b', 'a'])
  assert.deepEqual(ids(24, 'asc', previous), ['a', 'b'])
  assert.deepEqual(ids(38, 'asc', previous), ['b', 'a'])
  assert.equal(getPromotionSortValue(entries[0][1], 31, previous.A, org), 202607011031)
})

test('equal values use chronological tie-break and timestamps can be derived from date/time', () => {
  const rows = [['later', { broadcastDate: '2026-10-03', broadcastTime: '10:31', expectedSales: 100 }], ['earlier', { broadcastDate: '2026-10-02', broadcastTime: '10:31', expectedSales: 100 }]]
  assert.deepEqual(sortPromotionResults(rows, { column: 7, direction: 'desc' }, {}, key, org).map(([id]) => id), ['earlier', 'later'])
})
