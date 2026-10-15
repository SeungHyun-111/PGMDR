import mdNameTeamMap from '../data/md-name-team-map.json'
import { getLateNightPgmYn } from '../utils/lateNight'

const MAIN_GAS_URL = 'https://script.google.com/macros/s/AKfycbzlnzcV5DkCNwAZcOrdtJnCfGpCLmu5-tA9eF8N2Rs4hS15N61p0h8m7BQqTVxwX7g3/exec'
const OPS_GAS_URL = 'https://script.google.com/macros/s/AKfycbz9e0_2L6wX3Lm7uKWLfReZrm-LNRFxg8f_EeHVKwqaLZrx0neyHss9fORPhhvFppIA/exec'
const REVIEW_PERFORMANCE_GAS_URL = 'https://script.google.com/macros/s/AKfycbzown3_TLEz75-NGQHpuXpdPkeg2jbuinjtDWxA8OFliwBy8p3cDqVwjXmttwErbFVY/exec'

const PERFORMANCE_COLUMNS = [
  'broadcastDate',
  'dayOfWeek',
  'broadcastTime',
  'multiChannel',
  'programName',
  'onAirContributionProfit',
  'videoName',
  'price',
  'pgmCodeName',
  'mdCategory',
  'exposureMin',
  'weightedMin',
  'targetSales',
  'expectedSales',
  'expectedSalesVMinus',
  'salesPerWeightedMin',
  'targetGrossProfit',
  'expectedGrossProfitVMinus',
  'grossProfitPerWeightedMin',
  'expectedGrossProfitRate',
  'targetContributionProfit',
  'contributionProfit',
  'contributionProfitPerWeightedMin',
  'contributionProfitRate',
  'linkedExpectedSales',
  'preorderExpectedSales',
  'unlinkedExpectedSales',
  'dealType',
  'fixedFee',
  'mdName',
  'newProductType',
  'companyType',
  'pdName',
]

const NUMBER_FIELDS = new Set([
  'onAirContributionProfit',
  'price',
  'exposureMin',
  'weightedMin',
  'targetSales',
  'expectedSales',
  'expectedSalesVMinus',
  'salesPerWeightedMin',
  'targetGrossProfit',
  'expectedGrossProfitVMinus',
  'grossProfitPerWeightedMin',
  'expectedGrossProfitRate',
  'targetContributionProfit',
  'contributionProfit',
  'contributionProfitPerWeightedMin',
  'contributionProfitRate',
  'linkedExpectedSales',
  'preorderExpectedSales',
  'unlinkedExpectedSales',
  'fixedFee',
])

async function gasGet(url, params) {
  if (!url) throw new Error('편성운영 GAS 웹앱 URL이 설정되지 않았습니다.')
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${url}?${qs}`)
  const json = await res.json()
  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(json.error || 'GAS 호출 실패')
  }
  if (json.success !== true && json.ok !== true) {
    throw new Error(json.error || 'GAS 응답 형식을 확인할 수 없습니다.')
  }
  return json.data
}

export const fetchInitData            = (startDate, poolType = 'A') => gasGet(MAIN_GAS_URL, { action: 'init',               startDate, poolType })
export const fetchRefreshPerformance  = async ({ afterDate = '' } = {}) => {
  const data = await gasGet(REVIEW_PERFORMANCE_GAS_URL, {
    action: 'rawAfterDate',
    afterDate: normalizeGasAfterDate(afterDate),
  })
  return normalizeReviewPerformanceGas(data)
}
export const fetchRefreshProposals    = (poolType = 'A')             => gasGet(MAIN_GAS_URL, { action: 'refreshProposals',   poolType            })
export const fetchRefreshPreSchedule  = ()                           => gasGet(MAIN_GAS_URL, { action: 'refreshPreSchedule'                      })
export const syncOpsVersion           = ({ startDate, endDate = '', poolType = 'A', userName = '', sheetName = 'PGM' }) =>
  gasGet(OPS_GAS_URL, { action: 'syncSheetToOps', startDate, endDate, poolType, userName, sheetName })

function normalizeReviewPerformanceGas(data = {}) {
  const meta = data.meta || {}
  const rows = (data.rows || [])
    .map((row, index) => normalizeReviewPerformanceRow(row, meta, index))
    .filter(row => row.broadcastDate && row.perfKey)

  const perfMap = {}
  rows.forEach(row => {
    const prev = perfMap[row.perfKey]
    if (!prev || (row.broadcastTimestamp || 0) > (prev.broadcastTimestamp || 0)) {
      perfMap[row.perfKey] = row
    }
  })

  return {
    performanceRows: rows,
    perfMap,
    meta: {
      ...meta,
      source: 'review-rawAfterDate',
      savedRows: rows.length,
    },
  }
}

function normalizeReviewPerformanceRow(values = [], meta = {}, index = 0) {
  const record = {}
  PERFORMANCE_COLUMNS.forEach((field, columnIndex) => {
    const value = values[columnIndex]
    if (field === 'broadcastDate') record[field] = normalizeDate(value)
    else if (field === 'broadcastTime') record[field] = normalizeTime(value)
    else if (NUMBER_FIELDS.has(field)) record[field] = toNumber(value)
    else record[field] = String(value || '').trim()
  })

  const dealTypeConverted = normalizeDealType(record.dealType)
  const sourceRow = Number(meta.foundRow || 2) + index
  const broadcastTimestamp = toBroadcastTimestamp(record.broadcastDate, record.broadcastTime)

  return {
    ...record,
    dealTypeConverted,
    mdTeam: record.mdTeam || getTeamByMdName(record.mdName),
    perfKey: record.pgmCodeName ? `${dealTypeConverted}${record.pgmCodeName}` : '',
    broadcastTimestamp,
    lateNightPgmYn: getLateNightPgmYn(record.broadcastTime),
    sourceRow,
    profitPerWeightedMin: record.contributionProfitPerWeightedMin,
    totalAchievementRate: calculateTotalAchievementRate(record),
    source: {
      type: 'review-raw-gas',
      sheetName: meta.sheetName || 'raw',
      rowNumber: sourceRow,
    },
  }
}

function normalizeGasAfterDate(value) {
  const normalized = normalizeDate(value)
  return normalized ? normalized.replace(/-/g, '/') : ''
}

function normalizeDate(value) {
  if (!value) return ''
  const raw = String(value).trim()
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const match = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (!match) return raw
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeTime(value) {
  if (!value) return '00:00'
  const raw = String(value).trim()
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?/)
  if (!match) return '00:00'
  const hour = String(Math.min(23, Math.max(0, Number(match[1]) || 0))).padStart(2, '0')
  const minute = String(Math.min(59, Math.max(0, Number(match[2] || 0) || 0))).padStart(2, '0')
  return `${hour}:${minute}`
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim())
  return Number.isFinite(number) ? number : null
}

function toBroadcastTimestamp(dateText, timeText) {
  const dateKey = String(dateText || '').replace(/\D/g, '')
  const timeKey = String(timeText || '00:00').replace(/\D/g, '').padEnd(4, '0').slice(0, 4)
  return Number(`${dateKey}${timeKey}`) || 0
}

function getTeamByMdName(mdName) {
  return mdNameTeamMap[String(mdName || '').trim()] || ''
}

function normalizeDealType(value) {
  const raw = String(value || '').trim()
  if (!raw) return '[??]'
  if (/^\[[^\]]+\]$/.test(raw)) return raw
  if (raw.includes('위수탁') || raw === '위' || raw === '기타') return '[위]'
  if (raw.includes('직매입') || raw === '직') return '[직]'
  if (raw.includes('모바일광고') || raw === '모') return '[모]'
  if (raw.includes('혼합') || raw === '혼') return '[혼]'
  if (raw.includes('정액') || raw === '액') return '[액]'
  if (raw.includes('정률') || raw.includes('효율') || raw === '률') return '[률]'
  return `[${raw.charAt(0)}]`
}

function calculateTotalAchievementRate(row) {
  const salesRate = divide(row.expectedSales, row.targetSales)
  const profitRate = divide(row.contributionProfit, row.targetContributionProfit)
  if (salesRate == null || profitRate == null) return null
  return (salesRate + profitRate) / 2
}

function divide(value, target) {
  const numerator = Number(value || 0)
  const denominator = Number(target || 0)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  return numerator / denominator
}
