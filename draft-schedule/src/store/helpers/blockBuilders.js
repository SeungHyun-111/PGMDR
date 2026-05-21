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
  return {
    slotId: slot.slotId, blockKey,
    dateKey: slot.dateKey, timeText: slot.timeText,
    durationMin: slot.durationMin || 0,
    weightedMin: slot.weightedMin || 0,
    channel,
    pgmCodeName: '[편성팀]', orgName: '편성팀', mdTeam: '편성팀',
    isDefault: true, assignedAt: Date.now(),
  }
}

export function buildProposalItem(row) {
  const pgmCodeName = row.pgmCodeName || ''
  const dealTypeConverted = row.dealTypeConverted || row.dealType || ''
  return {
    ...row,
    pgmCodeName,
    dealTypeConverted,
    perfKey: dealTypeConverted ? `${dealTypeConverted}${pgmCodeName}` : null,
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
    blocks[slot.slotId] = {
      slotId: slot.slotId, blockKey: slot.slotId,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin: slot.weightedMin,
      channel: 'ALL',
      pgmCodeName: pre.pgmCodeName, orgName: pre.orgName, mdTeam: pre.orgName,
      dealType: pre.dealType || null, dealTypeChar: pre.dealTypeChar || '',
      perfKey: pre.perfKey || null,
      isPreSchedule: true, isDefault: false, assignedAt: Date.now(),
    }
  })
  return blocks
}

export function buildDefaultBlocks(pgmSlots, existingBlocks) {
  const result = {}
  pgmSlots.forEach(slot => {
    if (!existingBlocks[slot.slotId]) result[slot.slotId] = makeDefaultBlock(slot, 'ALL')
  })
  return result
}

export function encodePerfMap(perfMap) {
  if (!perfMap) return {}
  const encoded = {}
  Object.entries(perfMap).forEach(([k, v]) => {
    encoded[k.replace(/\[/g, '__LB__').replace(/\]/g, '__RB__')] = { ...v, perfKey: k }
  })
  return encoded
}

export function decodePerfMap(encoded) {
  if (!encoded) return {}
  const result = {}
  Object.entries(encoded).forEach(([k, v]) => {
    const decoded = k.replace(/__LB__/g, '[').replace(/__RB__/g, ']')
    result[decoded] = v
  })
  return result
}