import { useMemo } from 'react'

export default function useRatioStats(scheduleBlocks, categoryMap, orgFilter) {
  return useMemo(() => {
    const team = {}
    const category = {}
    const channel = { CA: 0, IP: 0, ALL: 0, 경쟁: 0 }
    let totalWeighted = 0
    let competingWeighted = 0

    Object.values(scheduleBlocks).forEach(block => {
      if (!block) return
      if (orgFilter && (block.mdTeam || block.orgName) !== orgFilter) return

      const w = block.weightedMin || 0
      totalWeighted += w

      if (block.isCompeting) {
        channel['경쟁'] = (channel['경쟁'] || 0) + w
        competingWeighted += w
        team['경쟁'] = (team['경쟁'] || 0) + w
        category['경쟁'] = (category['경쟁'] || 0) + w
        return
      }

      const ch = block.channel || 'ALL'
      channel[ch] = (channel[ch] || 0) + w

      const t = block.isDefault ? '편성팀' : (block.mdTeam || block.orgName || '미지정')
      team[t] = (team[t] || 0) + w

      const cat = categoryMap[block.pgmCodeName] || '미입력'
      category[cat] = (category[cat] || 0) + w
    })

    return { team, category, channel, totalWeighted, competingWeighted }
  }, [scheduleBlocks, categoryMap, orgFilter])
}