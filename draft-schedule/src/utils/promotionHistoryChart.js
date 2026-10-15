import { summarizePerformance } from './promotionStatistics.js'

// Equal spacing compares broadcasts rather than the number of days between them.
export function buildPromotionHistoryChart(row, previous) {
  const average = summarizePerformance(previous)
  return [previous[2], previous[1], previous[0], row].map((entry, index) => {
    const metrics = summarizePerformance(entry ? [entry] : [])
    return {
      date: new Date(2000, 0, index + 1),
      label: ['P-3', 'P-2', 'P-1', '프로모션'][index],
      broadcastDate: entry?.broadcastDate || '',
      channel: entry?.multiChannel || entry?.channel || '',
      missing: !entry,
      salesPerMin: metrics.salesPerMin || 0,
      profitPerMin: metrics.profitPerMin || 0,
      preorderRatio: (metrics.preorderShare || 0) * 100,
      avgSalesPerMin: average.salesPerMin || 0,
      avgProfitPerMin: average.profitPerMin || 0,
      avgPreorderRatio: (average.preorderShare || 0) * 100,
    }
  })
}
