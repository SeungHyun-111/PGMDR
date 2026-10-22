import { ref, serverTimestamp, set } from 'firebase/database'
import { ensureCultureAuth, getCultureDatabase } from './cultureFirebase'

export const CULTURE_DATABASE_URL = (import.meta.env?.VITE_CULTURE_DATABASE_URL || 'https://broadcast-schedule-6c97d-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, '')
export const CULTURE_MASTER_PATH = (import.meta.env?.VITE_FIREBASE_CULTURE_CODE_MASTER_PATH || 'cultureCodeMaster').replace(/^\/+|\/+$/g, '')
const DEFAULT_REFRESH_URL = 'https://script.google.com/macros/s/AKfycbzL9ixCDjIIJZ_m73z2MiyIhLDcb1Qi_sisUpqy52qCQZPtV4XwISVz90RjxXH7efSD6g/exec'

export async function refreshCultureCodeMaster(updatedBy = '') {
  await ensureCultureAuth()
  const url = new URL(import.meta.env?.VITE_CULTURE_CODE_MASTER_REFRESH_URL || DEFAULT_REFRESH_URL)
  url.searchParams.set('action', 'codeMasterRows')
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`편성코드 GAS 조회 실패 (${response.status})`)
  let payload
  try { payload = await response.json() }
  catch { throw new Error('GAS 응답을 읽지 못했습니다. 배포 버전과 접근 권한을 확인해주세요.') }
  if (payload?.ok !== true || !Array.isArray(payload.items)) {
    throw new Error(payload?.error || '편성코드 GAS 응답 형식이 올바르지 않습니다.')
  }
  const items = payload.items.map((row, index) => {
    if (!row || typeof row.code !== 'string' || typeof row.category !== 'string') {
      throw new Error('편성코드 데이터 형식이 올바르지 않습니다.')
    }
    return { id: String(index + 1).padStart(5, '0'), code: row.code.trim(), category: row.category.trim() }
  }).filter(row => row.code)
  if (!items.length) throw new Error('원본 편성코드가 비어 있어 기존 DB를 유지합니다.')
  await ensureCultureAuth()
  await set(ref(getCultureDatabase(), CULTURE_MASTER_PATH), {
    items, count: items.length, updatedAt: serverTimestamp(), updatedBy: updatedBy.trim() || '전역',
  })
  return items
}
