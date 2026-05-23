import { useMemo } from 'react'

export default function useRatioStats(scheduleBlocks, categoryMap, viewType) {
  return useMemo(() => {
    const group = {}
    const groupDm = {}
    let totalWeighted = 0
    let totalDm = 0
    let competingWeighted = 0
    const channel = { CA: 0, IP: 0, ALL: 0, 경쟁: 0 }

    Object.values(scheduleBlocks).forEach(block => {
      if (!block) return
      const w = block.weightedMin || 0
      const d = block.durationMin || 0
      totalWeighted += w
      totalDm += d

      const ch = block.channel || 'ALL'
      if (block.isCompeting) {
        channel['경쟁'] = (channel['경쟁'] || 0) + w
        competingWeighted += w
      } else {
        channel[ch] = (channel[ch] || 0) + w
      }

      const key = viewType === 'category'
        ? (block.isDefault ? '편성팀' : (block.mdCategory || categoryMap[block.pgmCodeName] || '미분류'))
        : (block.isCompeting ? '경쟁' : block.isDefault ? '편성팀' : (block.mdTeam || block.orgName || '미지정'))

      group[key]   = (group[key]   || 0) + w
      groupDm[key] = (groupDm[key] || 0) + d
    })

    return { group, groupDm, channel, totalWeighted, totalDm, competingWeighted }
  }, [scheduleBlocks, categoryMap, viewType])
}