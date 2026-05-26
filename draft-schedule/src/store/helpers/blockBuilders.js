import { normalizeDealType, makePerfKey } from '../../hooks/usePerformanceMap'
import { splitWeightedMin } from '../../utils/weightedMin'
import { encodeKey, decodeKey } from '../../utils/firebaseKey'

function normalizeTime(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':')
  return `${parseInt(h)}:${String(m || '00').padStart(2, '0')}`
}

function parseDateTime(str) {
  if (!str) return null
  const m = String(str).trim().match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/)
  return m ? { dateKey: m[1], timeText: m[2] } : null
}

function safeNumber(v) {
  const n = Number(String(v || '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function makeDefaultBlock(slot, channel = 'ALL') {
  const blockKey = channel === 'ALL' ? slot.slotId : `${slot.slotId}_${channel}`
  const fullWm = slot.weightedMin || 0
  let weightedMin = fullWm
  if (channel === 'CA' || channel === 'IP') {
    const { caWeighted, ipWeighted } = splitWeightedMin(fullWm, slot.dateKey, slot.timeText)
    weightedMin = channel === 'CA' ? caWeighted : ipWeighted
  }
  return {
    slotId: slot.slotId, blockKey,
    dateKey: slot.dateKey, timeText: slot.timeText,
    durationMin: slot.durationMin || 0,
    weightedMin,
    channel,
    pgmCodeName: '[편성팀]', orgName: '편성팀', mdTeam: '편성팀',
    memoCode: '[전사블록]',
    perfKey: makePerfKey('', '[편성팀]'),
    uniqueKey: `0_${blockKey}`,
    isDefault: false, assignedAt: Date.now(),
  }
}

export function buildProposalItem(row) {
  const pgmCodeName = row.pgmCodeName || ''
  // raw dealType(GAS 원본)을 우선 사용 - Firebase 캐시된 dealTypeConverted는 구버전 오염 가능
  const raw = row.dealType || row.dealTypeConverted || ''
  const dealTypeConverted = normalizeDealType(raw) // 미인식 값 포함 항상 정규화
  return {
    ...row,
    pgmCodeName,
    dealTypeConverted,
    perfKey: pgmCodeName ? makePerfKey(dealTypeConverted, pgmCodeName) : null,
  }
}

export function buildSlot(row) {
  return {
    slotId:      row.slotId,
    dateKey:     row.dateKey,
    timeText:    row.timeText,
    durationMin: safeNumber(row.durationMin),
    weightedMin: safeNumber(row.weightedMin),
    channel:     'ALL',
  }
}

export function buildPreScheduleBlocks(pgmSlots, preScheduleRows, existingBlocks) {
  const slotMap = {}
  pgmSlots.forEach(s => {
    slotMap[`${s.dateKey}_${normalizeTime(s.timeText)}`] = s
  })
  const blocks = {}
  preScheduleRows.forEach(pre => {
    const parsed = parseDateTime(pre.broadcastDateTime)
    if (!parsed) return
    const slot = slotMap[`${parsed.dateKey}_${normalizeTime(parsed.timeText)}`]
    if (!slot || existingBlocks[slot.slotId]) return
    const dealTypeConverted = normalizeDealType(pre.dealType)
    const pgmCodeName = pre.pgmCodeName || ''
    blocks[slot.slotId] = {
      slotId: slot.slotId, blockKey: slot.slotId,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin: slot.weightedMin,
      channel: 'ALL',
      pgmCodeName, orgName: pre.orgName, mdTeam: pre.mdTeam || pre.orgName,
      dealType: dealTypeConverted,
      dealTypeConverted,
      dealTypeChar: pre.dealTypeChar || '',
      mdCategory: pre.mdCategory || '',
      perfKey: pgmCodeName ? makePerfKey(dealTypeConverted, pgmCodeName) : null,
      uniqueKey: `2_${slot.slotId}`,
      isPreSchedule: true, isDefault: false, assignedAt: Date.now(),
    }
  })
  return blocks
}

// splitSlots를 받아 분리된 슬롯에 default 블록 재생성하지 않음
// (분리 슬롯은 slotId 키가 Firebase에 없어서 누락 판정되는 버그 방지)
export function buildDefaultBlocks(pgmSlots, existingBlocks, splitSlots = {}) {
  const result = {}
  pgmSlots.forEach(slot => {
    if (!existingBlocks[slot.slotId] && !splitSlots[slot.slotId]) {
      result[slot.slotId] = makeDefaultBlock(slot, 'ALL')
    }
  })
  return result
}

// ── 날짜 파싱 헬퍼 ──────────────────────────────────────────────────────
// GAS에서 오는 broadcastDate 형식이 "MM/DD", "YYYY-MM-DD", "M/D/YYYY" 등 혼재
// broadcastYear 별도 필드가 있으면 우선 사용, 없으면 현재 날짜 기준으로 연도 추론
// GAS broadcastDate 형식: "yyyy.m.d" (예: "2025.1.10", "2024.12.5")
// 구분자(. - /)로 split → 연/월/일 추출 → Date 반환
function parseBroadcastDate(row) {
  const rawDate = String(row.broadcastDate || '').trim()

  // "MM/DD 요일" 형식 처리 (실적DB broadcastDate: "12/08 월", "05/10 일" 등 — 연도 없음)
  const mmdd = rawDate.match(/^(\d{1,2})\/(\d{1,2})/)
  if (mmdd) {
    const m = parseInt(mmdd[1], 10), d = parseInt(mmdd[2], 10)
    const now = new Date()
    const ty = now.getFullYear(), tm = now.getMonth() + 1, td = now.getDate()
    // 해당 월/일이 올해 이미 지났거나 오늘이면 올해, 아직 오지 않았으면 작년
    const year = (m < tm || (m === tm && d <= td)) ? ty : ty - 1
    return new Date(year, m - 1, d)
  }

  // "yyyy.m.d" / "yyyy-mm-dd" 형식
  const parts = rawDate.split(/[.\-/]/)
  if (parts.length === 3) {
    const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2])
    if (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d)
    }
  }

  return new Date(rawDate)
}

// GAS rawData → 제품별 최신 실적 1건 선택 → flat perfMap 반환
// rawData 형식 지원:
//   A. flat map:  { perfKey → perfEntry }        ← GAS가 이미 1건 선택해서 반환
//   B. map-array: { perfKey → [entry1, entry2] } ← GAS가 전 이력을 배열로 반환
//   C. row array: [ { perfKey, broadcastDate, ... }, ... ] ← GAS raw rows
export function buildPerfMapFromGas(rawData) {
  if (!rawData) return {}

  // Case C: 최상위가 배열 → perfKey 필드 기준으로 그룹핑
  if (Array.isArray(rawData)) {
    const grouped = {}
    rawData.forEach(row => {
      const key = row.perfKey || ''
      if (!key) return
      if (!grouped[key]) { grouped[key] = []; }
      grouped[key].push(row)
    })
    const result = {}
    Object.entries(grouped).forEach(([k, rows]) => {
      result[k] = selectMostRecent(rows)
    })
    return result
  }

  // Case A / B: 객체
  const result = {}
  Object.entries(rawData).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      // Case B: 배열이면 최신 1건 선택
      if (v.length > 0) result[k] = selectMostRecent(v)
    } else if (v && typeof v === 'object') {
      // Case A: 이미 단일 엔트리
      result[k] = v
    }
  })
  return result
}

function selectMostRecent(rows) {
  if (rows.length === 1) return rows[0]
  return rows.reduce((best, row) => {
    const dBest = parseBroadcastDate(best)
    const dRow  = parseBroadcastDate(row)
    if (!dRow || isNaN(dRow.getTime())) return best
    if (!dBest || isNaN(dBest.getTime())) return row
    return dRow > dBest ? row : best
  })
}

export function encodePerfMap(rawData) {
  const perfMap = buildPerfMapFromGas(rawData)
  if (!perfMap) return {}
  const encoded = {}
  Object.entries(perfMap).forEach(([k, v]) => {
    encoded[encodeKey(k)] = { ...v, perfKey: k }
  })
  return encoded
}

export function decodePerfMap(encoded) {
  if (!encoded) return {}
  const result = {}
  Object.entries(encoded).forEach(([k, v]) => {
    result[decodeKey(k)] = v
  })
  return result
}