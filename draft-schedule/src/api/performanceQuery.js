import { createPerformanceCache } from '../utils/performanceQuery.js'

const BASE = 'https://pgmdr-87328-default-rtdb.asia-southeast1.firebasedatabase.app'

async function fetchRows(type, value) {
  const field = type === 'date' ? '$key' : 'perfKey'
  // Existing entry IDs start with YYYYMMDDHHmm. $key is indexed by RTDB already.
  const prefix = value.replaceAll('-', '')
  const params = new URLSearchParams(type === 'date'
    ? { orderBy: JSON.stringify(field), startAt: JSON.stringify(`${prefix}0000`), endAt: JSON.stringify(`${prefix}2359\uf8ff`) }
    : { orderBy: JSON.stringify(field), equalTo: JSON.stringify(value) })
  const response = await fetch(`${BASE}/performanceEntries.json?${params}`)
  const data = await response.json()
  if (!response.ok || data?.error) {
    if (/index.*not.*defined/i.test(data?.error || '')) throw new Error(`RTDB 검색 인덱스(${field}) 설정이 필요합니다. 전체 실적 다운로드는 실행하지 않았습니다.`)
    throw new Error('실적을 불러오지 못했습니다. 연결 상태를 확인해주세요.')
  }
  return data || {}
}

export const performanceQueryCache = createPerformanceCache(fetchRows)
