import { db, ref, onValue, set } from './firebase'

const pathFor = promotionId => {
  if (!promotionId || ['.', '#', '$', '[', ']', '/'].some(character => promotionId.includes(character))) throw new Error('프로모션을 선택해주세요.')
  return `global/promotionPerformanceComments/${promotionId}`
}

export function subscribePromotionComment(promotionId, onData, onError) {
  return onValue(ref(db, pathFor(promotionId)), snapshot => onData(snapshot.val() || {}), onError)
}

const writes = new Map()
export function savePromotionComment(promotionId, text, userName) {
  const path = pathFor(promotionId)
  const write = (writes.get(path) || Promise.resolve()).catch(() => {}).then(() => set(ref(db, path), {
    text, updatedBy: userName || '', updatedAt: Date.now(),
  }))
  writes.set(path, write)
  const clean = () => { if (writes.get(path) === write) writes.delete(path) }
  write.then(clean, clean)
  return write
}
