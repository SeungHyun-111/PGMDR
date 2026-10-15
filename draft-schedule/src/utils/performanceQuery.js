import { getLateNightPgmYn } from './lateNight.js'

export function dateRange(start, end) {
  if (!start || !end || start > end) return []
  const result = []
  const date = new Date(`${start}T00:00:00Z`)
  while (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) <= end) {
    result.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return result
}

export function previousThree(rows, cutoff) {
  if (!cutoff) return []
  const text = String(cutoff)
  const year = Number(text.slice(0, 4))
  const month = Number(text.slice(4, 6)) - 1
  const day = Number(text.slice(6, 8))
  const lower = new Date(Date.UTC(year, month - 3, 1))
  const lastDay = new Date(Date.UTC(lower.getUTCFullYear(), lower.getUTCMonth() + 1, 0)).getUTCDate()
  lower.setUTCDate(Math.min(day, lastDay))
  const min = Number(`${lower.toISOString().slice(0, 10).replaceAll('-', '')}${text.slice(8).padEnd(4, '0')}`)
  const seen = new Set()
  return Object.values(rows || {}).filter(Boolean).map(row => ({ ...row,
    broadcastTimestamp: Number(row.broadcastTimestamp || `${String(row.broadcastDate || '').replaceAll('-', '')}${String(row.broadcastTime || '00:00').replace(':', '')}`),
  })).filter(row => Number.isFinite(row.broadcastTimestamp) && row.broadcastTimestamp >= min && row.broadcastTimestamp < Number(cutoff) && getLateNightPgmYn(row) !== 'Y')
    .sort((a, b) => b.broadcastTimestamp - a.broadcastTimestamp || Number(b.sourceRow || 0) - Number(a.sourceRow || 0))
    .filter(row => { const key = row.broadcastTimestamp; if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 3)
}

// Retain only requested dates/products; deduplicate concurrent requests and ignore stale responses.
export function createPerformanceCache(fetchRows, { maxDays = 60, maxProducts = 150 } = {}) {
  let revision = 0
  const days = new Map()
  const products = new Map()
  const pending = new Map()
  async function load(type, value) {
    const cache = type === 'date' ? days : products
    if (cache.has(value)) {
      const rows = cache.get(value)
      cache.delete(value); cache.set(value, rows)
      return rows
    }
    const key = `${revision}/${type}/${value}`
    if (pending.has(key)) return pending.get(key)
    const generation = revision
    const request = fetchRows(type, value).then(rows => {
      if (generation !== revision) return load(type, value)
      cache.set(value, rows)
      const max = type === 'date' ? maxDays : maxProducts
      if (cache.size > max) cache.delete(cache.keys().next().value)
      return rows
    }).finally(() => pending.delete(key))
    pending.set(key, request)
    return request
  }
  return { load, invalidate() { revision += 1; days.clear(); products.clear() } }
}
