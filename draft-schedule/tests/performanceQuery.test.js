import assert from 'node:assert/strict'
import test from 'node:test'
import { createPerformanceCache, dateRange, previousThree } from '../src/utils/performanceQuery.js'

test('date range includes both bounds, crosses months, handles empty/future periods', () => {
  assert.deepEqual(dateRange('2026-09-30', '2026-10-02'), ['2026-09-30', '2026-10-01', '2026-10-02'])
  assert.deepEqual(dateRange('', '2026-10-02'), [])
  assert.deepEqual(dateRange('2026-11-01', '2026-10-12'), [])
})

test('three previous distinct broadcasts, excludes current/future, clamps 3 calendar months and excludes late night', () => {
  const rows = [
    { broadcastTimestamp: 202607311031 },
    { broadcastTimestamp: 202608011031 },
    { broadcastTimestamp: 202609011031 },
    { broadcastTimestamp: 202609011031, sourceRow: 10 },
    { broadcastTimestamp: 202610301031 },
    { broadcastTimestamp: 202610311031 },
    { broadcastTimestamp: 202611011031 },
    { broadcastTimestamp: 202610300231, lateNightPgmYn: 'Y' },
  ]
  assert.deepEqual(previousThree(rows, 202610311031).map(row => row.broadcastTimestamp), [202610301031, 202609011031, 202608011031])
  assert.equal(previousThree([{ broadcastTimestamp: 202602281031 }], 202605311031).length, 1)
  assert.equal(previousThree([{ broadcastTimestamp: 202602281030 }], 202605311031).length, 0)
  assert.equal(previousThree([{ broadcastDate: '2026-10-01', broadcastTime: '10:31' }], 202610151031).length, 1)
})

test('cache reuses dates and full product histories, deduplicates requests, refreshes only requested entries', async () => {
  const requests = []
  const cache = createPerformanceCache(async (type, value) => { requests.push([type, value]); return { sample: { type, value } } })
  const [first, second] = await Promise.all([cache.load('date', '2026-10-01'), cache.load('date', '2026-10-01')])
  assert.equal(first, second)
  assert.equal(requests.length, 1)
  await cache.load('date', '2026-10-02')
  await cache.load('product', '[위]상품A')
  await cache.load('product', '[위]상품A')
  assert.equal(requests.length, 3)
  cache.invalidate()
  assert.equal(requests.length, 3)
  await cache.load('date', '2026-10-01')
  assert.equal(requests.length, 4)
  assert.deepEqual(requests.at(-1), ['date', '2026-10-01'])
})

test('failed queries can retry and LRU bounds memory', async () => {
  let count = 0
  const cache = createPerformanceCache(async () => { count += 1; if (count === 1) throw new Error('index missing'); return {} }, { maxDays: 1 })
  await assert.rejects(cache.load('date', 'a'))
  await cache.load('date', 'a')
  await cache.load('date', 'b')
  await cache.load('date', 'a')
  assert.equal(count, 4)
})

test('stale in-flight data is not cached after refresh', async () => {
  let resolveFirst
  let count = 0
  const cache = createPerformanceCache(async () => {
    count += 1
    if (count === 1) return new Promise(resolve => { resolveFirst = resolve })
    return { fresh: true }
  })
  const pending = cache.load('date', '2026-10-01')
  cache.invalidate()
  resolveFirst({ stale: true })
  assert.deepEqual(await pending, { fresh: true })
  assert.deepEqual(await cache.load('date', '2026-10-01'), { fresh: true })
  assert.equal(count, 2)
})
