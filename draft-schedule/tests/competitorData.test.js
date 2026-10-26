import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompetitorRepository } from '../src/api/competitorRepository.js'
import { createRequestQueue } from '../src/api/competitorRequestQueue.js'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
function fixture() {
  const entries = new Map(), requests = []
  const revisions = { '202609': 'sep-1', '202610': 'oct-1' }
  let afterRead, indexMissing = false, abortedReads = 0
  const cache = {
    async read(keys, versions) { return new Map(keys.filter(key => versions.get(key) != null && entries.get(key)?.revision === versions.get(key)).map(key => [key, entries.get(key).rows])) },
    async write(records, isCurrent) { if (!isCurrent()) return; for (const entry of records) if (entry.revision != null) entries.set(entry.key, entry) },
    async clear() { entries.clear() },
  }
  const readJson = async (path, signal) => {
    signal?.throwIfAborted()
    const url = new URL(path), month = url.pathname.split('/')[3]
    if (url.pathname.endsWith('/updatedAt.json')) return revisions[month] ?? null
    requests.push(url)
    if (indexMissing) throw new Error('Index not defined')
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve() }, 15)
      const cancel = () => { clearTimeout(timer); abortedReads++; reject(signal.reason) }
      signal?.addEventListener('abort', cancel, { once: true })
    })
    const start = JSON.parse(url.searchParams.get('startAt')), end = JSON.parse(url.searchParams.get('endAt'))
    const data = {}
    for (let date = new Date(`${start}T00:00:00Z`); date.toISOString().slice(0, 10) <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = date.toISOString().slice(0, 10)
      data[day.replaceAll('-', '')] = { date: day, hour: 9, minute: 0, revenue: revisions[month] }
    }
    afterRead?.()
    return data
  }
  return { repository: createCompetitorRepository({ readJson, cache }), entries, requests, revisions,
    changeDuringRead(callback) { afterRead = callback }, missingIndex() { indexMissing = true }, get abortedReads() { return abortedReads } }
}

test('daily disk records reuse overlapping ranges and revalidate monthly revisions', async () => {
  const f = fixture()
  const rows = await f.repository.load('SSG', ['2026-10-19', '2026-10-20'])
  assert.equal(rows.length, 2)
  assert.equal(f.requests.length, 1)
  await f.repository.load('SSG', ['2026-10-20'])
  assert.equal(f.requests.length, 1)
  await f.repository.load('SSG', ['2026-10-20', '2026-10-21'])
  assert.equal(f.requests.length, 2)
  assert.equal(JSON.parse(f.requests.at(-1).searchParams.get('startAt')), '2026-10-21')
  f.revisions['202610'] = 'oct-2'
  const fresh = await f.repository.load('SSG', ['2026-10-20'])
  assert.equal(f.requests.length, 3)
  assert.equal(fresh[0].revenue, 'oct-2')
  assert.equal(f.repository.pendingCount, 0)
})

test('cross-month requests invalidate only changed months and isolate channels', async () => {
  const f = fixture(), dates = ['2026-09-30', '2026-10-01']
  await f.repository.load('SSG', dates)
  assert.equal(f.requests.length, 2)
  f.revisions['202609'] = 'sep-2'
  const rows = await f.repository.load('SSG', dates)
  assert.equal(f.requests.length, 3)
  assert.equal(rows[0].revenue, 'sep-2')
  assert.equal(rows[1].revenue, 'oct-1')
  await f.repository.load('K', dates)
  assert.equal(f.requests.length, 5)
})

test('simultaneous overlapping consumers share days and one cancellation preserves others', async () => {
  const f = fixture(), controller = new AbortController()
  const first = f.repository.load('SSG', ['2026-10-19', '2026-10-20'], controller.signal)
  const checked = assert.rejects(first, { name: 'AbortError' })
  const second = f.repository.load('SSG', ['2026-10-20', '2026-10-21'])
  await pause(3)
  controller.abort()
  await checked
  assert.equal((await second).length, 2)
  const covering20 = f.requests.filter(url => JSON.parse(url.searchParams.get('startAt')) <= '2026-10-20' && JSON.parse(url.searchParams.get('endAt')) >= '2026-10-20')
  assert.equal(covering20.length, 1)
  assert.equal(f.repository.pendingCount, 0)
})

test('all consumers cancelling aborts transport without caching and releases in-flight entries', async () => {
  const f = fixture(), controller = new AbortController()
  const result = assert.rejects(f.repository.load('SSG', ['2026-10-19'], controller.signal), { name: 'AbortError' })
  await pause(3)
  controller.abort()
  await result
  await pause(3)
  assert.equal(f.entries.size, 0)
  assert.equal(f.abortedReads, 1)
  assert.equal(f.repository.pendingCount, 0)
})

test('source changes during download retry once and never cache a mixed revision', async () => {
  const f = fixture()
  f.changeDuringRead(() => { f.revisions['202610'] = 'oct-2'; f.changeDuringRead(null) })
  const rows = await f.repository.load('SSG', ['2026-10-19'])
  assert.equal(f.requests.length, 2)
  assert.equal(rows[0].revenue, 'oct-2')
  assert.equal(f.entries.get('SSG:2026-10-19').revision, 'oct-2')
})

test('manual cache invalidation aborts old work; absent versions never become permanent cache hits', async () => {
  const f = fixture()
  const old = assert.rejects(f.repository.load('SSG', ['2026-10-19']), { name: 'AbortError' })
  await pause(3)
  await f.repository.clear()
  await old
  const rows = await f.repository.load('SSG', ['2026-10-19'])
  assert.equal(rows.length, 1)
  delete f.revisions['202610']
  await f.repository.load('SSG', ['2026-10-19'])
  await f.repository.load('SSG', ['2026-10-19'])
  assert.equal(f.requests.length, 4)
})

test('missing date indexes fail without monthly key-scan fallback', async () => {
  const f = fixture()
  f.missingIndex()
  await assert.rejects(f.repository.load('SSG', ['2026-10-19']), /date/)
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].searchParams.get('orderBy'), '"date"')
  assert.equal(f.entries.size, 0)
})

test('request queue bounds global concurrency and removes cancelled queued reads', async () => {
  const queue = createRequestQueue(2), controller = new AbortController()
  let active = 0, max = 0, cancelledStarted = false
  const task = () => queue(async () => { active++; max = Math.max(max, active); await pause(5); active-- })
  const first = task(), second = task()
  const cancelled = assert.rejects(queue(() => { cancelledStarted = true }, controller.signal), { name: 'AbortError' })
  controller.abort()
  await Promise.all([first, second, cancelled, ...Array.from({ length: 10 }, task)])
  assert.equal(max, 2)
  assert.equal(cancelledStarted, false)
})
