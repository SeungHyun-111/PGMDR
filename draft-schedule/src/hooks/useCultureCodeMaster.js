import { useCallback, useEffect, useState } from 'react'
import { getApp } from 'firebase/app'
import { getDatabase, onValue, ref } from 'firebase/database'
import { CULTURE_DATABASE_URL, CULTURE_MASTER_PATH, refreshCultureCodeMaster } from '../api/cultureCodeMaster'

function normalizeCodes(data) {
  return Object.entries(data || {}).filter(([, item]) => item?.code).map(([id, item]) => {
    const code = String(item.code).trim()
    const category = String(item.category || '').trim()
    return { id, code, category, searchText: `${code} ${category}`.toLowerCase() }
  })
}

export default function useCultureCodeMaster() {
  const [codes, setCodes] = useState([])
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshError('')
    try {
      const data = await refreshCultureCodeMaster()
      // Only the realtime listener writes codes, avoiding stale request races.
      return normalizeCodes(data).length
    } catch (error) {
      setRefreshError(error.message || '편성코드 갱신에 실패했습니다. 연결 상태를 확인해주세요.')
      return null
    } finally {
      setRefreshing(false)
    }
  }, [])
  useEffect(() => {
    // Retire the old cache; every open tab now follows the shared database.
    try { sessionStorage.removeItem('pgmdr-culture-code-master-v1') } catch { /* Storage may be disabled. */ }
    const database = getDatabase(getApp(), CULTURE_DATABASE_URL)
    return onValue(ref(database, `${CULTURE_MASTER_PATH}/items`), snapshot => {
      setCodes(normalizeCodes(snapshot.val()))
      setError('')
      setLoaded(true)
    }, () => {
      setError('편성코드 목록을 불러오지 못했습니다. 연결 상태를 확인해주세요.')
      setLoaded(false)
    })
  }, [])
  return { codes, error, loaded, refreshing, refresh, refreshError }
}
