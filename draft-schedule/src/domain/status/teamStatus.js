import { getGrade, getEffectiveProfit, getEffectiveMetrics } from '../../utils/grade'
import { competitionItemToBlock, getCompetitionItems } from '../../utils/competition'

const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 }

export function buildTeamStatusRows({
  scheduledRows = [],
  competingRows = [],
  unscheduledRows = [],
  perfMap = {},
  manualInputs = {},
  performanceHistoryByKey = {},
} = {}) {
  const scheduled = scheduledRows.map(item => {
    const metrics = getEffectiveMetrics(item, perfMap, manualInputs, performanceHistoryByKey)
    return {
      ...item,
      _status: '편성',
      _statusOrder: 0,
      _teamName: item._team || item.mdTeam || item.orgName || '미지정',
      _gradeValue: item._grade || getGrade(getEffectiveProfit(item, perfMap, manualInputs, performanceHistoryByKey)),
      _salesPerMin: metrics.salesPerMin,
      _profitPerMin: metrics.profitPerMin,
      _displayMin: Number(item.weightedMin || 0),
    }
  })

  const competing = competingRows.flatMap(block =>
    getCompetitionItems(block).map((item, index) => {
      const row = competitionItemToBlock(item, block)
      const metrics = getEffectiveMetrics(row, perfMap, manualInputs, performanceHistoryByKey)
      return {
        ...row,
        isCompeting: true,
        _status: '경쟁',
        _statusOrder: 0,
        _teamName: row.mdTeam || row.orgName || '미지정',
        _gradeValue: '',
        _salesPerMin: metrics.salesPerMin,
        _profitPerMin: metrics.profitPerMin,
        _displayMin: Number(block.weightedMin || row.weightedMin || 0),
        blockKey: `${block.blockKey || block.slotId || 'competing'}_${item.uniqueKey || item.itemId || index}`,
      }
    })
  )

  const unscheduled = unscheduledRows.map(item => {
    const metrics = getEffectiveMetrics(item, perfMap, manualInputs)
    return {
      ...item,
      _status: '미편성',
      _statusOrder: 1,
      _teamName: item._team || item.mdTeam || item.team || '미지정',
      _gradeValue: item._grade || getGrade(getEffectiveProfit(item, perfMap, manualInputs)),
      _salesPerMin: metrics.salesPerMin,
      _profitPerMin: metrics.profitPerMin,
      _displayMin: Number(item.availableWeightedMin1 || 0),
    }
  })

  return [...scheduled, ...competing, ...unscheduled].sort((a, b) => {
    const statusCmp = a._statusOrder - b._statusOrder
    if (statusCmp) return statusCmp
    const gradeCmp = (GRADE_ORDER[a._gradeValue] ?? 9) - (GRADE_ORDER[b._gradeValue] ?? 9)
    if (gradeCmp) return gradeCmp
    const profitCmp = (b._profitPerMin || 0) - (a._profitPerMin || 0)
    if (profitCmp) return profitCmp
    return String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko', { numeric: true })
  })
}
