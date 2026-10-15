import { useEffect, useState } from 'react'
import { getApp } from 'firebase/app'
import { getDatabase, get, ref } from 'firebase/database'

const CULTURE_DATABASE_URL = 'https://broadcast-schedule-6c97d-default-rtdb.asia-southeast1.firebasedatabase.app'
const CACHE_KEY = 'pgmdr-culture-code-master-v1'
let pendingCodes

function normalizeCodes(items) {
  return items.map(({ id, code, category }) => ({ id, code, category, searchText: `${code} ${category}`.toLowerCase() }))
}

function loadCodes() {
  if (pendingCodes) return pendingCodes
  pendingCodes = (async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
      if (Array.isArray(cached) && cached.every(item => item && typeof item.id === 'string' && typeof item.code === 'string' && typeof item.category === 'string')) {
        return normalizeCodes(cached)
      }
    } catch {
      // Unavailable storage falls back to one request per app lifetime.
    }
    const database = getDatabase(getApp(), CULTURE_DATABASE_URL)
    const snapshot = await get(ref(database, 'cultureCodeMaster/items'))
    const items = Object.entries(snapshot.val() || {}).filter(([, item]) => item?.code).map(([id, item]) => ({
      id, code: String(item.code).trim(), category: String(item.category || '').trim(),
    }))
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items)) } catch { /* Keep the memory cache if storage is full. */ }
    return normalizeCodes(items)
  })().catch(error => {
    pendingCodes = undefined
    throw error
  })
  return pendingCodes
}

export default function useCultureCodeMaster() {
  const [codes, setCodes] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    loadCodes().then(items => {
      if (!cancelled) { setCodes(items); setError('') }
    }).catch(() => {
      if (!cancelled) setError('편성코드 목록을 불러오지 못했습니다.')
    })
    return () => { cancelled = true }
  }, [])
  return { codes, error }
}
