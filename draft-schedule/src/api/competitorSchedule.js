const BASE = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app/competitorInfo/monthly'
const PAGE_SIZE = 160

async function read(path, params, signal) {
  const response = await fetch(`${BASE}/${path}.json?${new URLSearchParams(params)}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error || `조회 실패 (${response.status})`)
  return data
}

export async function fetchScheduleMonths(signal) {
  const response = await fetch(`${BASE}.json?shallow=true`, { signal })
  if (!response.ok) throw new Error('저장된 월을 불러오지 못했습니다.')
  return Object.keys(await response.json() || {}).sort()
}

export async function fetchScheduleWeek(company, dates, signal, onRow) {
  if (!['SSG', 'K'].includes(company)) throw new Error('지원하지 않는 채널입니다.')
  const months = [...new Set(dates.map(date => date.slice(0, 7).replace('-', '')))]
  const wanted = new Set(dates)
  const rows = []
  const collect = (row, id) => {
    if (onRow) onRow(row)
    else rows.push({ ...row, id })
  }
  for (const month of months) {
    const path = `${month}/data/${company}`
    let indexed
    try {
      indexed = await read(path, { orderBy: JSON.stringify('date'), startAt: JSON.stringify(dates[0]), endAt: JSON.stringify(dates.at(-1)) }, signal)
    } catch (error) {
      if (!/Index not defined/i.test(error.message)) throw error
    }
    if (indexed !== undefined) {
      for (const [key, row] of Object.entries(indexed || {})) {
        if (row && wanted.has(row.date)) collect(row, `${month}-${key}`)
      }
      continue
    }
    // Without a date index, bound each response and retain only the requested week.
    // Do not cache monthly payloads or attach persistent realtime listeners.
    let cursor
    while (true) {
      const params = { orderBy: JSON.stringify('$key'), limitToFirst: String(PAGE_SIZE) }
      if (cursor !== undefined) params.startAt = JSON.stringify(cursor)
      const page = await read(path, params, signal)
      const entries = Object.entries(page || {}).filter(([, row]) => row != null)
      if (!entries.length) break
      entries.sort(([a], [b]) => Number(a) - Number(b))
      for (const [key, row] of entries) {
        if (key === cursor) continue
        if (wanted.has(row.date)) collect(row, `${month}-${key}`)
      }
      const next = entries.at(-1)[0]
      if (entries.length < PAGE_SIZE || next === cursor) break
      cursor = next
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.minute - b.minute)
}
