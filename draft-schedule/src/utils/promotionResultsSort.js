const currentFields = ['broadcastDateTime', 'multiChannel', 'weightedMin', 'dealType', 'pgmCodeName', 'targetSales', 'targetContributionProfit', 'expectedSales', 'contributionProfit', 'preorderExpectedSales', 'linkedExpectedSales', 'salesPerWeightedMin', 'profitPerWeightedMin', 'organization', 'mdName']
const previousFields = ['broadcastDateTime', 'targetSales', 'targetContributionProfit', 'expectedSales', 'contributionProfit', 'preorderExpectedSales', 'linkedExpectedSales', 'weightedMin']
const textFields = new Set(['multiChannel', 'dealType', 'pgmCodeName', 'organization', 'mdName'])
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
const timestamp = row => number(row?.broadcastTimestamp || `${String(row?.broadcastDate || '').replaceAll('-', '')}${String(row?.broadcastTime || '00:00').replace(':', '')}`)

export function getPromotionSortValue(row, column, previous, getOrganization) {
  const baseline = column >= currentFields.length
  const field = baseline ? previousFields[(column - currentFields.length) % previousFields.length] : currentFields[column]
  const entry = baseline ? previous[Math.floor((column - currentFields.length) / previousFields.length)] : row
  if (field === 'broadcastDateTime') return timestamp(entry)
  if (field === 'organization') return getOrganization(entry)
  if (field === 'dealType') return String(entry?.dealTypeConverted || entry?.dealType2 || entry?.dealType || '')
  if (field === 'profitPerWeightedMin') return number(entry?.contributionProfitPerWeightedMin ?? entry?.profitPerWeightedMin)
  return textFields.has(field) ? String(entry?.[field] || '') : number(entry?.[field])
}

export function sortPromotionResults(entries, sort, byKey, getKey, getOrganization) {
  const direction = sort.direction === 'desc' ? -1 : 1
  return [...entries].sort(([idA, a], [idB, b]) => {
    const av = getPromotionSortValue(a, sort.column, byKey[getKey(a)] || [], getOrganization)
    const bv = getPromotionSortValue(b, sort.column, byKey[getKey(b)] || [], getOrganization)
    const difference = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko', { numeric: true })
    return difference * direction || timestamp(a) - timestamp(b) || idA.localeCompare(idB)
  })
}
