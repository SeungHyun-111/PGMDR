import { create } from 'zustand'
import { db, ref, onValue } from '../api/firebase'
import { performanceQueryCache } from '../api/performanceQuery'

const usePerformanceQueryStore = create(() => ({ meta: null, metaReady: false, revision: 0, error: '' }))
let count = 0
let stop

export function receivePerformanceMeta(meta) {
  const previous = usePerformanceQueryStore.getState().meta
  const changed = previous && meta?.updatedAt && previous.updatedAt !== meta.updatedAt
  if (changed) performanceQueryCache.invalidate()
  usePerformanceQueryStore.setState(state => ({ meta, metaReady: true, error: '', revision: state.revision + (changed ? 1 : 0) }))
}

export function watchPerformanceMeta() {
  count += 1
  if (!stop) stop = onValue(ref(db, 'performanceMeta'), snapshot => receivePerformanceMeta(snapshot.val()), () => {
    usePerformanceQueryStore.setState({ metaReady: true, error: '실적 갱신 정보를 불러오지 못했습니다.' })
  })
  return () => { count -= 1; if (!count) { stop?.(); stop = undefined } }
}

export default usePerformanceQueryStore
