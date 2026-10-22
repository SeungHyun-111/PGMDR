import { create } from 'zustand'
import { onValue, ref } from 'firebase/database'
import { CULTURE_MASTER_PATH, refreshCultureCodeMaster } from '../api/cultureCodeMaster'
import { ensureCultureAuth, getCultureDatabase } from '../api/cultureFirebase'

function normalizeCodes(data) {
  return Object.entries(data || {}).filter(([, item]) => item?.code).map(([id, item]) => {
    const code = String(item.code).trim()
    const category = String(item.category || '').trim()
    return { id, code, category, searchText: `${code} ${category}`.toLowerCase() }
  })
}

let refreshPromise
let unsubscribe
let subscribing
let disposed = false
let historySubscription

const useCultureCodeMasterStore = create(() => ({
  codes: [], loaded: false, error: '', refreshing: false, refreshError: '',
  updatedAt: null, updatedBy: '', historyError: '',
  refresh(updatedBy = '') {
    if (refreshPromise) return refreshPromise
    useCultureCodeMasterStore.setState({ refreshing: true, refreshError: '' })
    refreshPromise = (async () => {
      try {
        const data = await refreshCultureCodeMaster(updatedBy)
        // The shared realtime listener owns codes, avoiding stale refresh races.
        return normalizeCodes(data).length
      } catch (error) {
        useCultureCodeMasterStore.setState({ refreshError: error.message || '편성코드 갱신에 실패했습니다. 연결 상태를 확인해주세요.' })
        return null
      } finally {
        useCultureCodeMasterStore.setState({ refreshing: false })
        refreshPromise = undefined
      }
    })()
    return refreshPromise
  },
}))

// Keep one listener and its data for this browser tab's lifetime, even when
// all consuming dialogs close. StrictMode remounts reuse the same listener.
export function ensureCultureCodeSubscription() {
  if (unsubscribe || subscribing || disposed) return
  try { sessionStorage.removeItem('pgmdr-culture-code-master-v1') } catch { /* Storage may be disabled. */ }
  subscribing = ensureCultureAuth().then(() => {
    if (disposed) return
    unsubscribe = onValue(ref(getCultureDatabase(), `${CULTURE_MASTER_PATH}/items`), snapshot => {
      useCultureCodeMasterStore.setState({ codes: normalizeCodes(snapshot.val()), loaded: true, error: '' })
    }, () => {
      unsubscribe = undefined
      useCultureCodeMasterStore.setState({ loaded: false, error: '편성코드 목록을 불러오지 못했습니다. 연결 상태를 확인해주세요.' })
    })
  }).catch(error => {
    useCultureCodeMasterStore.setState({ loaded: false, error: error.message })
  }).finally(() => { subscribing = undefined })
}

// History needs only two small fields, not the full autocomplete list.
export function ensureCultureHistorySubscription() {
  if (historySubscription || disposed) return
  const stops = []
  historySubscription = { stops }
  ensureCultureAuth().then(() => {
    if (disposed) return
    const database = getCultureDatabase()
    for (const field of ['updatedAt', 'updatedBy']) {
      stops.push(onValue(ref(database, `${CULTURE_MASTER_PATH}/${field}`), snapshot => {
        useCultureCodeMasterStore.setState({ [field]: snapshot.val(), historyError: '' })
      }, () => {
        stops.forEach(stop => stop())
        historySubscription = undefined
        useCultureCodeMasterStore.setState({ historyError: '편성코드 갱신이력을 불러오지 못했습니다.' })
      }))
    }
  }).catch(error => {
    stops.forEach(stop => stop())
    historySubscription = undefined
    useCultureCodeMasterStore.setState({ historyError: error.message })
  })
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true
    unsubscribe?.()
    historySubscription?.stops.forEach(stop => stop())
  })
}

export default useCultureCodeMasterStore
