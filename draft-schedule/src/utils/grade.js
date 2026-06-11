import { getScheduledBlockPerformance } from './performanceHistory'

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

export function isPgmTeamBlock(item) {
  return item?.pgmCodeName === '[편성팀]' && item?.memoCode === '[전사블록]'
}

export function getManualInputKey(item) {
  if (!item) return null
  return isPgmTeamBlock(item) ? 'sim_pgm_team' : item.uniqueKey || null
}

export function getEffectiveProfit(item, perfMap, manualInputs, performanceHistoryByKey = {}) {
  if (!item) return null
  if (item.dateKey && item.timeText) {
    return getScheduledBlockPerformance(item, {
      performanceHistoryByKey,
      manualInputs,
      fallbackPerfMap: perfMap,
    }).profitPerMin
  }
  const manualKey = getManualInputKey(item)
  const manual = manualKey ? ((manualInputs || {})[manualKey] || {}) : {}
  const perf   = item.perfKey   ? ((perfMap     || {})[item.perfKey]   || {}) : {}
  const v = manual.expectedProfitPerWeightedMin ?? perf.profitPerWeightedMin ?? null
  return v === null ? null : Number(v)
}

export function getEffectiveMetrics(item, perfMap, manualInputs, performanceHistoryByKey = {}) {
  if (!item) return { salesPerMin: 0, profitPerMin: 0, source: 'missing' }
  if (item.dateKey && item.timeText) {
    const perf = getScheduledBlockPerformance(item, {
      performanceHistoryByKey,
      manualInputs,
      fallbackPerfMap: perfMap,
    })
    return {
      salesPerMin: perf.salesPerMin,
      profitPerMin: perf.profitPerMin,
      source: perf.source,
    }
  }
  const manualKey = getManualInputKey(item)
  const manual = manualKey ? ((manualInputs || {})[manualKey] || {}) : {}
  const perf = item.perfKey ? ((perfMap || {})[item.perfKey] || {}) : {}
  const hasManualSales = manual.expectedSalesPerWeightedMin !== undefined && manual.expectedSalesPerWeightedMin !== null && manual.expectedSalesPerWeightedMin !== ''
  const hasManualProfit = manual.expectedProfitPerWeightedMin !== undefined && manual.expectedProfitPerWeightedMin !== null && manual.expectedProfitPerWeightedMin !== ''
  const hasPerfSales = perf.salesPerWeightedMin !== undefined && perf.salesPerWeightedMin !== null && perf.salesPerWeightedMin !== ''
  const hasPerfProfit = perf.profitPerWeightedMin !== undefined && perf.profitPerWeightedMin !== null && perf.profitPerWeightedMin !== ''
  return {
    salesPerMin: Number(hasManualSales ? manual.expectedSalesPerWeightedMin : hasPerfSales ? perf.salesPerWeightedMin : 0),
    profitPerMin: Number(hasManualProfit ? manual.expectedProfitPerWeightedMin : hasPerfProfit ? perf.profitPerWeightedMin : 0),
    source: hasManualSales || hasManualProfit ? 'manual' : hasPerfSales || hasPerfProfit ? 'perf' : 'missing',
  }
}

export function calcGradeDist(items, perfMap, manualInputs, performanceHistoryByKey = {}) {
  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0 }
  items.forEach(item => {
    counts[getGrade(getEffectiveProfit(item, perfMap, manualInputs, performanceHistoryByKey))]++
  })
  return counts
}
