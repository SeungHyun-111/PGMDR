import { create } from 'zustand'
import { db, ref, onValue, update } from '../api/firebase'
import { buildPromotionAssignmentUpdates, PROMOTION_NAMES_PATH } from '../utils/promotionAssignment.js'

const usePromotionAssignmentStore = create(() => ({ names: {}, ready: false, error: '' }))
let subscribers = 0
let unsubscribe

export function subscribePromotionAssignments() {
  subscribers += 1
  if (!unsubscribe) {
    usePromotionAssignmentStore.setState({ ready: false, error: '' })
    unsubscribe = onValue(ref(db, PROMOTION_NAMES_PATH), snapshot => {
      usePromotionAssignmentStore.setState({ names: snapshot.val() || {}, ready: true, error: '' })
    }, () => usePromotionAssignmentStore.setState({ ready: false, error: '프로모션 지정 정보를 불러오지 못했습니다. 연결 상태를 확인해주세요.' }))
  }
  return () => {
    subscribers -= 1
    if (!subscribers) {
      unsubscribe?.()
      unsubscribe = undefined
    }
  }
}

export async function savePromotionAssignment({ entryId, sourcePath, name, fallbackName = '' }) {
  const { names, ready } = usePromotionAssignmentStore.getState()
  if (!ready) throw new Error('프로모션 정보 연결을 확인해주세요.')
  const updates = buildPromotionAssignmentUpdates({ entryId, sourcePath, name, currentName: names[entryId] ?? fallbackName })
  if (!updates) return
  // One atomic write: the original name and its small realtime index stay in sync.
  // The listener handles optimistic updates and Firebase's rollback on write failure.
  await update(ref(db), updates)
}

export default usePromotionAssignmentStore
