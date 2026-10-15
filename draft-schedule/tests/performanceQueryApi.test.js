import assert from 'node:assert/strict'
import test from 'node:test'
import { performanceQueryCache } from '../src/api/performanceQuery.js'

test('date query uses existing key range and cached navigation makes no further request', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original; performanceQueryCache.invalidate() })
  const calls = []
  globalThis.fetch = async url => {
    calls.push(new URL(url))
    return { ok: true, json: async () => ({ '202610011031_item': { broadcastDate: '2026-10-01' } }) }
  }
  performanceQueryCache.invalidate()
  await performanceQueryCache.load('date', '2026-10-01')
  await performanceQueryCache.load('date', '2026-10-01')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].pathname, '/performanceEntries.json')
  assert.equal(JSON.parse(calls[0].searchParams.get('orderBy')), '$key')
  assert.equal(JSON.parse(calls[0].searchParams.get('startAt')), '202610010000')
  assert.equal(JSON.parse(calls[0].searchParams.get('endAt')), '202610012359\uf8ff')
})

test('product query uses existing perfKey; missing index errors without downloading root', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original; performanceQueryCache.invalidate() })
  const calls = []
  globalThis.fetch = async url => {
    calls.push(new URL(url))
    return { ok: false, json: async () => ({ error: 'Index not defined, add .indexOn: perfKey' }) }
  }
  performanceQueryCache.invalidate()
  await assert.rejects(performanceQueryCache.load('product', '[위]상품A'), /검색 인덱스/)
  assert.equal(calls.length, 1)
  assert.equal(JSON.parse(calls[0].searchParams.get('orderBy')), 'perfKey')
  assert.equal(JSON.parse(calls[0].searchParams.get('equalTo')), '[위]상품A')
})
