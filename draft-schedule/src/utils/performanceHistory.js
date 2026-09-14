import { encodeKey, decodeKey } from './firebaseKey'

const DATE_RE = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/
const TIME_RE = /^(\d{1,2})(?::(\d{1,2}))?/

export function normalizePerfDate(value) {
  if (!value) return ''
  const raw = String(value).trim()
  const m = raw.match(DATE_RE)
  if (!m) return raw
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

export function normalizePerfTime(value) {
  if (!value) return '00:00'
  const raw = String(value).trim()
  const m = raw.match(TIME_RE)
  if (!m) return '00:00'
  const hh = String(Math.min(23, Math.max(0, Number(m[1]) || 0))).padStart(2, '0')
  const mm = String(Math.min(59, Math.max(0, Number(m[2] || 0) || 0))).padStart(2, '0')
  return `${hh}:${mm}`
}

export function makeBroadcastTimestamp(dateKey, timeText = '00:00') {
  const date = normalizePerfDate(dateKey)
  if (!date) return null
  const time = normalizePerfTime(timeText)
  return Number(`${date.replace(/\D/g, '')}${time.replace(/\D/g, '')}`)
}

export function makeBlockTimestamp(block) {
  return makeBroadcastTimestamp(block?.dateKey, block?.timeText)
}

export function normalizePerfEntry(entry, fallbackPerfKey = '') {
  if (!entry) return null
  const broadcastDate = normalizePerfDate(entry.broadcastDate || entry.dateKey)
  const broadcastTime = normalizePerfTime(entry.broadcastStartTime || entry.startTime || entry.broadcastTime || entry.timeText)
  const broadcastTimestamp = Number(entry.broadcastTimestamp || makeBroadcastTimestamp(broadcastDate, broadcastTime))
  if (!Number.isFinite(broadcastTimestamp)) return null
  return {
    ...entry,
    perfKey: entry.perfKey || fallbackPerfKey,
    broadcastDate,
    broadcastTime,
    broadcastTimestamp,
    salesPerWeightedMin: toNullableNumber(entry.salesPerWeightedMin),
    profitPerWeightedMin: toNullableNumber(entry.profitPerWeightedMin),
    sourceRow: Number(entry.sourceRow || 0),
  }
}

export function normalizePerfHistory(raw, fallbackPerfKey = '') {
  const entries = Array.isArray(raw)
    ? raw
    : Object.entries(raw || {}).map(([, value]) => value)
  return entries
    .map(entry => normalizePerfEntry(entry, fallbackPerfKey))
    .filter(Boolean)
    .sort(comparePerfEntries)
}

export function decodeHistoryByKey(raw = {}) {
  const result = {}
  Object.entries(raw || {}).forEach(([encodedKey, value]) => {
    const perfKey = decodeKey(encodedKey)
    result[perfKey] = normalizePerfHistory(value, perfKey)
  })
  return result
}

export function normalizePerformanceRows(raw = []) {
  const rows = Array.isArray(raw)
    ? raw
    : Object.entries(raw || {}).map(([rowId, value]) => ({ rowId, ...value }))
  return rows
    .map((row, index) => normalizePerfEntry({
      ...row,
      perfKey: row.perfKey || row.key || row.Key,
      sourceRow: row.sourceRow || row.rowNumber || index + 2,
    }, row.perfKey || row.key || row.Key || ''))
    .filter(Boolean)
    .sort(comparePerfEntries)
}

export function buildHistoryByKeyFromRows(rawRows = []) {
  const result = {}
  normalizePerformanceRows(rawRows).forEach(entry => {
    if (!entry.perfKey) return
    if (!result[entry.perfKey]) result[entry.perfKey] = []
    result[entry.perfKey].push(entry)
  })
  Object.keys(result).forEach(perfKey => {
    result[perfKey].sort(comparePerfEntries)
  })
  return result
}

export function buildLatestByKeyFromHistory(historyByKey = {}) {
  const result = {}
  Object.entries(historyByKey || {}).forEach(([perfKey, history]) => {
    const normalized = normalizePerfHistory(history, perfKey)
    if (normalized.length > 0) result[perfKey] = normalized[normalized.length - 1]
  })
  return result
}

export function encodeHistoryEntries(perfKey, entries = []) {
  const encodedKey = encodeKey(perfKey)
  const result = {}
  normalizePerfHistory(entries, perfKey).forEach(entry => {
    result[`${encodedKey}/${entry.broadcastTimestamp}`] = entry
  })
  return result
}

export function getSameBroadcastPerf(perfKey, blockTimestamp, historyByKey) {
  if (!perfKey || !blockTimestamp) return null
  const history = historyByKey?.[perfKey] || []
  return findLastBy(history, entry => entry.broadcastTimestamp === blockTimestamp)
}

export function getLastPerfBefore(perfKey, blockTimestamp, historyByKey) {
  if (!perfKey || !blockTimestamp) return null
  const history = historyByKey?.[perfKey] || []
  return findLastBy(history, entry => entry.broadcastTimestamp < blockTimestamp && entry.lateNightPgmYn !== 'Y')
}

export function getLatestPerf(perfKey, latestPerfByKey, fallbackPerfMap) {
  if (!perfKey) return null
  const latest = latestPerfByKey?.[perfKey] || fallbackPerfMap?.[perfKey] || null
  return normalizePerfEntry(latest, perfKey)
}

export function getScheduledBlockPerformance(block, {
  performanceHistoryByKey = {},
  manualInputs = {},
  fallbackPerfMap = {},
} = {}) {
  if (!block) return makeEmptyPerformance()
  const perfKey = block.perfKey || null
  const blockTimestamp = makeBlockTimestamp(block)
  const manualKey = getManualInputKey(block)
  const manual = manualKey ? (manualInputs?.[manualKey] || {}) : {}
  const sameBroadcastPerf = getSameBroadcastPerf(perfKey, blockTimestamp, performanceHistoryByKey)
  const previousPerf = getLastPerfBefore(perfKey, blockTimestamp, performanceHistoryByKey)
  const legacyPerf = normalizePerfEntry(fallbackPerfMap?.[perfKey], perfKey)
  const legacyPreviousPerf = legacyPerf
    && blockTimestamp
    && legacyPerf.broadcastTimestamp <= blockTimestamp
    && legacyPerf.lateNightPgmYn !== 'Y'
    ? legacyPerf
    : null
  const lastPerf = previousPerf || legacyPreviousPerf
  const manualSales = normalizeManualNumber(manual.expectedSalesPerWeightedMin)
  const manualProfit = normalizeManualNumber(manual.expectedProfitPerWeightedMin)
  const hasAnyManual = manualSales != null || manualProfit != null
  const hasCompleteManual = manualSales != null && manualProfit != null

  const salesPerMin = sameBroadcastPerf?.salesPerWeightedMin
    ?? manualSales
    ?? lastPerf?.salesPerWeightedMin
    ?? 0
  const profitPerMin = sameBroadcastPerf?.profitPerWeightedMin
    ?? manualProfit
    ?? lastPerf?.profitPerWeightedMin
    ?? 0

  return {
    sameBroadcastPerf,
    lastPerf,
    appliedPerf: sameBroadcastPerf || null,
    manual,
    manualSales,
    manualProfit,
    salesPerMin: Number(salesPerMin || 0),
    profitPerMin: Number(profitPerMin || 0),
    source: sameBroadcastPerf ? 'broadcast'
      : hasCompleteManual ? 'manual'
        : lastPerf ? 'previous'
          : 'missing',
    missingPerf: !sameBroadcastPerf && !lastPerf && !hasCompleteManual,
    hasManual: hasAnyManual,
  }
}

export function getSidebarPerformance(item, { latestPerfByKey = {}, fallbackPerfMap = {} } = {}) {
  const perf = getLatestPerf(item?.perfKey, latestPerfByKey, fallbackPerfMap)
  return perf
}

export function collectPerfKeys(items = []) {
  return [...new Set(
    (items || [])
      .map(item => item?.perfKey)
      .filter(Boolean)
  )]
}

function comparePerfEntries(a, b) {
  if (a.broadcastTimestamp !== b.broadcastTimestamp) return a.broadcastTimestamp - b.broadcastTimestamp
  return Number(a.sourceRow || 0) - Number(b.sourceRow || 0)
}

function findLastBy(list, predicate) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) return list[i]
  }
  return null
}

function normalizeManualNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function makeEmptyPerformance() {
  return {
    sameBroadcastPerf: null,
    lastPerf: null,
    appliedPerf: null,
    manual: {},
    manualSales: null,
    manualProfit: null,
    salesPerMin: 0,
    profitPerMin: 0,
    source: 'missing',
    missingPerf: true,
    hasManual: false,
  }
}

function getManualInputKey(item) {
  if (!item) return null
  return item?.pgmCodeName === '[편성팀]' && item?.memoCode === '[전사블록]'
    ? 'sim_pgm_team'
    : item.uniqueKey || null
}
