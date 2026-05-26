export const GRADES = ['S', 'A', 'B', 'C', 'D']

export const GRADE_META = {
  S: { min: 500000, color: '#f59e0b', bg: 'rgba(245,158,11,.18)' },
  A: { min: 450000, color: '#10b981', bg: 'rgba(16,185,129,.18)' },
  B: { min: 400000, color: '#3b82f6', bg: 'rgba(59,130,246,.18)' },
  C: { min: 350000, color: '#f97316', bg: 'rgba(249,115,22,.18)' },
  D: { min: -Infinity, color: '#6b7280', bg: 'rgba(107,114,128,.14)' },
}

export function getGrade(profitPerMin) {
  if (profitPerMin === null || profitPerMin === undefined || isNaN(Number(profitPerMin))) return 'D'
  const v = Number(profitPerMin)
  if (v >= 500000) return 'S'
  if (v >= 450000) return 'A'
  if (v >= 400000) return 'B'
  if (v >= 350000) return 'C'
  return 'D'
}

export function getEffectiveProfit(item, perfMap, manualInputs) {
  if (!item) return null
  const manual = item.uniqueKey ? ((manualInputs || {})[item.uniqueKey] || {}) : {}
  const perf   = item.perfKey   ? ((perfMap     || {})[item.perfKey]   || {}) : {}
  const v = manual.expectedProfitPerWeightedMin ?? perf.profitPerWeightedMin ?? null
  return v === null ? null : Number(v)
}

export function calcGradeDist(items, perfMap, manualInputs) {
  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  items.forEach(item => {
    counts[getGrade(getEffectiveProfit(item, perfMap, manualInputs))]++
  })
  return counts
}
