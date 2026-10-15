export const PROMOTION_NAMES_PATH = 'performancePromotionNames'

export function buildPromotionAssignmentUpdates({ entryId, sourcePath, name, currentName }) {
  if (typeof name !== 'string') throw new Error('프로모션명을 확인해주세요.')
  if (name === currentName) return null
  if (!entryId || ['.', '#', '$', '[', ']', '/'].some(character => entryId.includes(character)) || !['performanceEntries', 'performanceRows'].includes(sourcePath)) {
    throw new Error('실적 경로를 확인할 수 없습니다. 실적을 다시 불러와주세요.')
  }
  return {
    [`${sourcePath}/${entryId}/promotionName`]: name,
    [`${PROMOTION_NAMES_PATH}/${entryId}`]: name,
  }
}
