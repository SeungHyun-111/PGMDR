import { getScheduledBlockPerformance } from '../../utils/performanceHistory'
import { getEffectiveBlockWeightedMin } from '../../utils/weightedMin'
import { getEffectivePgmSlots } from '../../utils/effectiveSlots'

export function resolveForecastMetrics(block, {
  perfMap = {},
  performanceHistoryByKey = {},
  manualInputs = {},
} = {}) {
  const perfState = getScheduledBlockPerformance(block, {
    performanceHistoryByKey,
    manualInputs,
    fallbackPerfMap: perfMap,
  })
  const weightedMin = getEffectiveBlockWeightedMin(block)
  const salesPerMin = perfState.salesPerMin
  const profitPerMin = perfState.profitPerMin
  const broadcastTotals = getBroadcastTotals(perfState.sameBroadcastPerf)
  const appliedWeightedMin = broadcastTotals?.weightedMin ?? weightedMin
  const expectedSales = broadcastTotals?.sales ?? (salesPerMin ?? 0) * weightedMin
  const expectedProfit = broadcastTotals?.profit ?? (profitPerMin ?? 0) * weightedMin

  return {
    lastPerf: perfState.lastPerf,
    sameBroadcastPerf: perfState.sameBroadcastPerf,
    salesPerMin,
    profitPerMin,
    manualSales: perfState.manualSales,
    manualProfit: perfState.manualProfit,
    scheduledWeightedMin: weightedMin,
    weightedMin: appliedWeightedMin,
    expectedSales,
    expectedProfit,
    missingPerf: perfState.missingPerf,
    hasManual: perfState.hasManual,
    perfSource: perfState.source,
    usesBroadcastTotals: !!broadcastTotals,
  }
}

function getBroadcastTotals(perf) {
  if (!perf) return null
  const sales = toFiniteNumber(perf.expectedSales)
  const profit = toFiniteNumber(perf.contributionProfit)
  const weightedMin = toFiniteNumber(perf.weightedMin)
  if (sales == null || profit == null || weightedMin == null || weightedMin <= 0) return null
  return { sales, profit, weightedMin }
}

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function buildForecastSummary(rows = [], {
  pgmSlots = [],
  customSlots = {},
  splitSlots = {},
} = {}) {
  const totals = rows.reduce((acc, row) => ({
    sales: acc.sales + Number(row.expectedSales || 0),
    profit: acc.profit + Number(row.expectedProfit || 0),
    wm: acc.wm + Number(row.weightedMin || 0),
  }), { sales: 0, profit: 0, wm: 0 })

  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots)
  const totalSlotWm = effectiveSlots.reduce((sum, slot) => sum + Number(slot.weightedMin || 0), 0)
  const totalSlotCount = effectiveSlots.reduce((sum, slot) => sum + (splitSlots[slot.slotId] ? 2 : 1), 0)
  const perfEnteredCount = rows.filter(row => !row.missingPerf).length
  const missingCount = rows.length - perfEnteredCount

  return {
    ...totals,
    salesPerMin: totals.wm > 0 ? totals.sales / totals.wm : 0,
    profitPerMin: totals.wm > 0 ? totals.profit / totals.wm : 0,
    missingCount,
    perfEnteredCount,
    count: rows.length,
    totalSlotCount,
    totalSlotWm,
    scheduleRate: totalSlotWm > 0 ? totals.wm / totalSlotWm * 100 : 0,
    perfRate: rows.length > 0 ? perfEnteredCount / rows.length * 100 : 0,
  }
}

export function buildDailyForecast(rows = []) {
  const map = {}
  rows.forEach(row => {
    const date = row.dateKey || '?'
    if (!map[date]) map[date] = { date, label: date.slice(5).replace('-', '/'), sales: 0, profit: 0, wm: 0 }
    map[date].sales += Number(row.expectedSales || 0)
    map[date].profit += Number(row.expectedProfit || 0)
    map[date].wm += Number(row.weightedMin || 0)
  })
  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      ...day,
      salesPerMin: day.wm > 0 ? Math.round(day.sales / day.wm) : 0,
      profitPerMin: day.wm > 0 ? Math.round(day.profit / day.wm) : 0,
    }))
}

export function buildDailyTeamForecast(rows = []) {
  const map = {}
  rows.forEach(row => {
    const date = row.dateKey || '?'
    const team = row.mdTeam || '미지정'
    if (!map[date]) map[date] = {}
    if (!map[date][team]) map[date][team] = { name: team, sales: 0, profit: 0, wm: 0 }
    map[date][team].sales += Number(row.expectedSales || 0)
    map[date][team].profit += Number(row.expectedProfit || 0)
    map[date][team].wm += Number(row.weightedMin || 0)
  })
  Object.values(map).forEach(teams => {
    const totalSales = Object.values(teams).reduce((sum, team) => sum + team.sales, 0)
    const totalProfit = Object.values(teams).reduce((sum, team) => sum + team.profit, 0)
    Object.values(teams).forEach(team => {
      team.salesPerMin = team.wm > 0 ? Math.round(team.sales / team.wm) : 0
      team.profitPerMin = team.wm > 0 ? Math.round(team.profit / team.wm) : 0
      team.salesShare = totalSales > 0 ? team.sales / totalSales * 100 : 0
      team.profitShare = totalProfit > 0 ? team.profit / totalProfit * 100 : 0
    })
  })
  return map
}

export function weightedAveragePerMin(rows = [], metricKey) {
  const totalWm = rows.reduce((sum, row) => sum + Number(row.wm || 0), 0)
  return totalWm > 0
    ? Math.round(rows.reduce((sum, row) => sum + Number(row[metricKey] || 0) * Number(row.wm || 0), 0) / totalWm)
    : 0
}

export function buildForecastGroups(rows = [], {
  groupBy = 'team',
  weightedMinTargets = [],
  teamTargetMap = {},
  totalWm = 0,
} = {}) {
  const map = {}
  rows.forEach(row => {
    const key = groupBy === 'team' ? row.mdTeam : row.mdCategory
    if (!map[key]) map[key] = { name: key, sales: 0, profit: 0, wm: 0, count: 0, missing: 0 }
    map[key].sales += Number(row.expectedSales || 0)
    map[key].profit += Number(row.expectedProfit || 0)
    map[key].wm += Number(row.weightedMin || 0)
    map[key].count += 1
    if (row.missingPerf) map[key].missing += 1
  })

  const wmTargetMap = {}
  if (groupBy === 'team') {
    weightedMinTargets.forEach(target => {
      const name = String(target.teamName || '').trim()
      if (!name) return
      wmTargetMap[name] = target.weeklyTarget
      wmTargetMap[name.endsWith('팀') ? name.slice(0, -1) : `${name}팀`] = target.weeklyTarget
    })
  }

  const list = Object.values(map)
    .map(group => {
      const target = teamTargetMap[group.name] || {}
      return {
        ...group,
        salesPerMin: group.wm > 0 ? Math.round(group.sales / group.wm) : 0,
        profitPerMin: group.wm > 0 ? Math.round(group.profit / group.wm) : 0,
        targetSalesPerMin: target.salesPerMin || 0,
        targetProfitPerMin: target.profitPerMin || 0,
        targetWm: wmTargetMap[group.name] || 0,
        wmShare: totalWm > 0 ? group.wm / totalWm * 100 : 0,
      }
    })
    .sort((a, b) => b.salesPerMin - a.salesPerMin)

  const maxSpm = Math.max(...list.map(group => group.salesPerMin), 1)
  return list.map((group, index) => ({ ...group, rank: index + 1, effPct: group.salesPerMin / maxSpm * 100 }))
}

export function enrichForecastGroups(groups = [], {
  companyTotal = null,
  avgSalesPerMin = 0,
  avgProfitPerMin = 0,
} = {}) {
  return groups.map(group => ({
    ...group,
    effectiveTargetSalesPerMin: group.targetSalesPerMin > 0
      ? group.targetSalesPerMin
      : (companyTotal?.salesPerMin || avgSalesPerMin),
    effectiveTargetProfitPerMin: group.targetProfitPerMin > 0
      ? group.targetProfitPerMin
      : (companyTotal?.profitPerMin || avgProfitPerMin),
  }))
}
