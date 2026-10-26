import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchMeetingShares } from '../src/api/competitorMeetingShares.js'

test('meeting shares reuse the selected company current week, excluding previous-day carry', async () => {
  const original = globalThis.fetch
  const dataQueries = []
  globalThis.fetch = async input => {
    const url = new URL(input)
    if (url.pathname.endsWith('updatedAt.json')) return { ok: true, json: async () => 'version-1' }
    dataQueries.push(url)
    return { ok: true, json: async () => ({ 0: { date: '2026-10-12', hour: 9, weightedMin: 20, org: 'A' } }) }
  }
  try {
    const summary = await fetchMeetingShares('SSG', '2026-10-19', undefined, { company: 'SSG', rows: [
      { date: '2026-10-18', weightedMin: 900, org: 'A' },
      { date: '2026-10-19', weightedMin: 10, org: 'A' },
      { date: '2026-10-25', weightedMin: 20, org: 'A' },
    ] })
    assert.equal(summary.current.total, 30)
    assert.equal(summary.previous.total, 20)
    assert.equal(dataQueries.length, 1)
    assert.equal(JSON.parse(dataQueries[0].searchParams.get('startAt')), '2026-10-12')
    assert.equal(JSON.parse(dataQueries[0].searchParams.get('endAt')), '2026-10-18')
  } finally { globalThis.fetch = original }
})
