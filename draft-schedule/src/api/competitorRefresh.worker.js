import { buildCompetitorSearchIndex } from '../utils/competitorSearchIndex'

self.onmessage = async ({ data: { month, payload } }) => {
  try {
    if (String(payload?.month) !== month || !payload?.data ||
      !['SSG', 'K', 'SK'].every(company => Array.isArray(payload.data[company])) ||
      !Object.values(payload.data).some(rows => rows.length)) {
      throw new Error('원본 데이터의 월 또는 채널 형식이 올바르지 않아 저장하지 않았습니다.')
    }
    const counts = Object.fromEntries(Object.entries(payload.data).map(([company, rows]) => [company, rows.length]))
    const updates = {
      [`competitorInfo/monthly/${month}`]: payload,
      [`competitorInfo/searchIndex/${month}`]: buildCompetitorSearchIndex(payload),
      [`metadata/competitorInfo/monthly/${month}`]: {
        month, updatedAt: payload.updatedAt || new Date().toISOString(), counts,
        rowCount: Object.values(counts).reduce((sum, count) => sum + count, 0), meta: 'broadcasts',
      },
    }
    const response = await fetch('https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app/.json?print=silent', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error(`RTDB 저장 실패 (${response.status}): ${await response.text()}`)
    self.postMessage({ ok: true, counts })
  } catch (error) {
    self.postMessage({ ok: false, error: error.message })
  }
}
