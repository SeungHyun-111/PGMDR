// weightedMinTargets 기준으로 팀명 접미사 "팀" 불일치 정규화
export function normalizeTeamName(name, weightedMinTargets) {
  if (!name || !weightedMinTargets?.length) return name
  const teamNames = weightedMinTargets.map(t => t.teamName).filter(Boolean)
  if (teamNames.includes(name)) return name
  const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
  return teamNames.includes(alt) ? alt : name
}

// scheduleBlocks 전체의 mdTeam / orgName 일괄 정규화 (로드 시 1회)
export function normalizeBlocksTeamNames(scheduleBlocks, weightedMinTargets) {
  if (!weightedMinTargets?.length || !scheduleBlocks) return scheduleBlocks
  const result = {}
  Object.entries(scheduleBlocks).forEach(([key, block]) => {
    if (!block) { result[key] = block; return }
    const mdTeam  = normalizeTeamName(block.mdTeam,  weightedMinTargets)
    const orgName = normalizeTeamName(block.orgName, weightedMinTargets)
    result[key] = (mdTeam !== block.mdTeam || orgName !== block.orgName)
      ? { ...block, mdTeam, orgName }
      : block
  })
  return result
}

// proposalItems 배열의 팀명 단일화 (mdTeam || orgName || team → mdTeam 정규화)
export function normalizeItemsTeamNames(items, weightedMinTargets) {
  if (!items?.length) return items
  return items.map(item => {
    const raw = item.mdTeam || item.orgName || item.team || ''
    const mdTeam = normalizeTeamName(raw, weightedMinTargets)
    return mdTeam !== item.mdTeam ? { ...item, mdTeam } : item
  })
}
