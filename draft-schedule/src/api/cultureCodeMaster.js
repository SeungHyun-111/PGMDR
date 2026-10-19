export const CULTURE_DATABASE_URL = (import.meta.env?.VITE_CULTURE_DATABASE_URL || 'https://broadcast-schedule-6c97d-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, '')
export const CULTURE_MASTER_PATH = (import.meta.env?.VITE_FIREBASE_CULTURE_CODE_MASTER_PATH || 'cultureCodeMaster').replace(/^\/+|\/+$/g, '')
const DEFAULT_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbzL9ixCDjIIJZ_m73z2MiyIhLDcb1Qi_sisUpqy52qCQZPtV4XwISVz90RjxXH7efSD6g/exec'

async function readMaster(path) {
  const response = await fetch(`${CULTURE_DATABASE_URL}/${CULTURE_MASTER_PATH}${path}.json`, {
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`편성코드 RTDB 조회 실패 (${response.status})`)
  return response.json()
}

export async function refreshCultureCodeMaster() {
  const previousVersion = await readMaster('/updatedAt')
  const url = new URL(import.meta.env?.VITE_CULTURE_CODE_MASTER_REFRESH_URL || DEFAULT_REFRESH_URL)
  url.searchParams.set('action', 'refresh')
  url.searchParams.set('_', String(Date.now()))
  // GAS returns an opaque response in browsers; verify completion through RTDB.
  await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(60000) })
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    const version = await readMaster('/updatedAt')
    if (version && version !== previousVersion) {
      const payload = await readMaster('')
      if (!payload?.updatedAt || !payload.items) throw new Error('갱신된 편성코드 데이터가 올바르지 않습니다.')
      return payload.items
    }
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
  throw new Error('GAS 갱신 완료를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.')
}
