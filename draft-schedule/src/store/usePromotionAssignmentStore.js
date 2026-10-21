import { create } from 'zustand'
import { db, ref, onValue, update, runTransaction } from '../api/firebase'
import { buildPromotionAssignmentUpdates, PROMOTION_NAMES_PATH, PROMOTION_IDS_PATH, assignedPromotionIds, buildPromotionIdUpdates } from '../utils/promotionAssignment.js'

const usePromotionAssignmentStore = create(() => ({ names: {}, ids: {}, ready: false, error: '' }))
let subscribers = 0
let unsubscribe

export function subscribePromotionAssignments() {
  subscribers += 1
  if (!unsubscribe) {
    usePromotionAssignmentStore.setState({ ready: false, error: '' })
    const received = new Set()
    const stops = [[PROMOTION_NAMES_PATH, 'names'], [PROMOTION_IDS_PATH, 'ids']].map(([path, field]) =>
      onValue(ref(db, path), snapshot => {
        received.add(field)
        usePromotionAssignmentStore.setState({ [field]: snapshot.val() || {}, ready: received.size === 2, error: '' })
      }, () => {
        received.delete(field)
        usePromotionAssignmentStore.setState({ ready: false, error: '프로모션 지정 정보를 불러오지 못했습니다. 연결 상태를 확인해주세요.' })
      }))
    unsubscribe = () => stops.forEach(stop => stop())
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

export async function migrateLegacyPromotionAssignments(promotions) {
  const { names, ids, ready } = usePromotionAssignmentStore.getState()
  if (!ready) return
  const missing = Object.entries(names).filter(([entryId, name]) => name && !ids[entryId])
  for (let offset = 0; offset < missing.length; offset += 8) {
    await Promise.all(missing.slice(offset, offset + 8).map(async ([entryId, name]) => {
      const matchingIds = assignedPromotionIds({}, undefined, name, promotions)
      if (!matchingIds.length) return
      // The index is authoritative. A transaction preserves edits made while
      // migrating; legacy text is retained for older data and unknown names.
      await runTransaction(ref(db, `${PROMOTION_IDS_PATH}/${entryId}`), current => current || {
        _v: true, ...Object.fromEntries(matchingIds.map(id => [id, true])),
      }, { applyLocally: false })
    }))
  }
}

export async function togglePromotionAssignment({ entryId, sourcePath, promotionId, assigned, row, promotions }) {
  const { ids, names, ready } = usePromotionAssignmentStore.getState()
  if (!ready) throw new Error('프로모션 정보 연결을 확인해주세요.')
  // Seed legacy assignments only on the first edit. Later edits change one ID,
  // so concurrent selections of different promotions cannot replace each other.
  const currentIds = ids[entryId] ? [] : assignedPromotionIds(row, undefined, names[entryId], promotions)
  await update(ref(db), buildPromotionIdUpdates({ entryId, sourcePath, promotionId, assigned, currentIds }))
}
