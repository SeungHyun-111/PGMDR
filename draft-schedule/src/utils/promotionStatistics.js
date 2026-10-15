import { getLateNightPgmYn } from './lateNight.js'

export const totalFields = ['weightedMin', 'targetSales', 'targetContributionProfit', 'expectedSales', 'contributionProfit', 'preorderExpectedSales', 'linkedExpectedSales']
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0
const divide = (a, b) => b > 0 ? a / b : null

export function summarizePerformance(rows) {
  const total = Object.fromEntries(totalFields.map(field => [field, 0]))
  rows.forEach(row => totalFields.forEach(field => { total[field] += numeric(row[field]) }))
  const salesAchievement = divide(total.expectedSales, total.targetSales)
  const profitAchievement = divide(total.contributionProfit, total.targetContributionProfit)
  return { ...total, count: rows.length,
    salesPerMin: divide(total.expectedSales, total.weightedMin),
    profitPerMin: divide(total.contributionProfit, total.weightedMin),
    salesAchievement, profitAchievement,
    preorderShare: divide(total.preorderExpectedSales, total.targetSales),
    overallAchievement: salesAchievement !== null && profitAchievement !== null ? (salesAchievement + profitAchievement) / 2 : null,
  }
}

export function percentChange(current, baseline) {
  return current !== null && baseline !== null && baseline !== 0 ? (current - baseline) / Math.abs(baseline) : null
}

export function formatPreorderShare(value) {
  if (!Number.isFinite(value)) return '—'
  const scaled = value * 1000
  const truncated = Math.trunc(scaled + Math.sign(scaled) * 1e-9) / 10
  return `${truncated.toFixed(1)}%`
}

export function formatPercentagePointDifference(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return '—'
  const difference = (current - baseline) * 100
  const value = Math.trunc(difference * 10 + Math.sign(difference) * 1e-9) / 10
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%p`
}

export function summarizePreviousSlots(rows, byKey, getKey) {
  const slots = [[], [], []]
  rows.forEach(row => (byKey[getKey(row)] || []).forEach((previous, index) => { if (index < 3) slots[index].push(previous) }))
  return { slots: slots.map(summarizePerformance), average: summarizePerformance(slots.flat()) }
}

export const getPerformanceCategory = row => String(row.mdCategory || '').trim() || '미분류'

export function filterPerformanceRows(entries, { excludeLateNight, excludeIntangible = false, organizations, categories }, getOrganization) {
  return entries.filter(([, row]) => (!excludeLateNight || getLateNightPgmYn(row) !== 'Y')
    && (!excludeIntangible || getOrganization(row) !== '문화서비스팀')
    && (!organizations.length || organizations.includes(getOrganization(row)))
    && (!categories.length || categories.includes(getPerformanceCategory(row))))
}

export const getPerformanceVideoType = row => String(row.newProductType || '').trim() || '미분류'

export function summarizeVideoTypes(rows, byKey, getKey) {
  const groups = new Map()
  rows.forEach(row => {
    const type = getPerformanceVideoType(row)
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(row)
  })
  const priority = ['재녹화', '재편집', '기존', '신상품', '미분류']
  return [...groups].sort(([a], [b]) => {
    const aRank = priority.includes(a) ? priority.indexOf(a) : priority.length
    const bRank = priority.includes(b) ? priority.indexOf(b) : priority.length
    return aRank - bRank || a.localeCompare(b, 'ko')
  }).map(([type, group]) => ({ type,
    current: summarizePerformance(group),
    previous: summarizePreviousSlots(group, byKey, getKey).average,
    missingHistory: group.some(row => byKey[getKey(row)] === undefined),
  }))
}
