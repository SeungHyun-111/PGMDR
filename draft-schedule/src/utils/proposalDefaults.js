import categoryTeamMap from '../data/category-team-map.json'

export const PROPOSAL_DEFAULTS = { dealTypeConverted: '[위]', newProductType: '기존' }

export function proposalCodePatch(text, codes, teamOptions) {
  const item = codes.find(item => item.code === text.trim())
  if (!item) return { pgmCodeName: text }
  const category = item.category
  const mapped = categoryTeamMap[category] || ''
  const team = teamOptions.find(team => team === mapped)
    || teamOptions.find(team => team.replace(/팀$/, '') === mapped.replace(/팀$/, ''))
    || mapped
  return { pgmCodeName: text, mdCategory: category, mdTeam: team }
}
