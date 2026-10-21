import * as XLSX from 'xlsx'
import { getEffectivePgmSlots } from '../effectiveSlots'
import { MEMO_CODES } from '../../data/memoCodes'

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minToTime(totalMin) {
  const min = ((Number(totalMin) || 0) % 1440 + 1440) % 1440
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatBoDate(dateKey) {
  return String(dateKey || '').replace(/-/g, '/')
}

function formatBoTime(timeText) {
  const m = String(timeText || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : ''
}

function getBoDealType(block) {
  return String(block?.dealTypeConverted || block?.dealType || '').trim()
}

function isBoDirectPurchase(block) {
  const dealType = getBoDealType(block)
  return dealType.includes('[직]') || dealType.includes('직매입')
}

function isBoContract(block) {
  const dealType = getBoDealType(block)
  return dealType.includes('[액]') || dealType.includes('정액')
    || dealType.includes('[혼]') || dealType.includes('혼합')
}

function isBoMobileAd(block) {
  const dealType = getBoDealType(block)
  return dealType.includes('[모]') || dealType.includes('모바일광고')
}

function normalizeMemoCode(raw) {
  const value = String(raw || '').trim()
  return /^\d+$/.test(value) ? value.padStart(3, '0') : value
}

function getBoMemoCode(block, field = 'memoCode', memoCodes = MEMO_CODES) {
  const storedCode = normalizeMemoCode(block?.[`${field}Code`])
  if (storedCode) return storedCode

  const raw = String(block?.[field] || '').trim()
  if (!raw) return ''
  if (/^\d+$/.test(raw)) return raw.padStart(3, '0')
  const source = Array.isArray(memoCodes) && memoCodes.length ? memoCodes : MEMO_CODES
  const row = source.find(item => item.name === raw || item.code === raw)
  return row?.code ? String(row.code).padStart(3, '0') : ''
}

function buildBoExcelRow(slot, block, slotDuration, memoCodes = MEMO_CODES) {
  const duration = Number(block?.durationMin ?? slotDuration ?? slot?.durationMin ?? 0)
  const startMin = timeToMin(slot?.timeText || block?.timeText || '')
  return {
    '방송일자': formatBoDate(slot?.dateKey || block?.dateKey || ''),
    '시작시간': formatBoTime(slot?.timeText || block?.timeText || ''),
    '종료시간': minToTime(startMin + duration),
    '편성코드': String(block?.pgmCodeName || ''),
    '직매입여부': isBoDirectPurchase(block) ? '1' : '0',
    '약정여부': isBoContract(block) ? '1' : '0',
    '메모코드1': getBoMemoCode(block, 'memoCode', memoCodes),
    '메모코드2': getBoMemoCode(block, 'memoCode2', memoCodes),
    '모바일광고비여부': isBoMobileAd(block) ? '1' : '0',
  }
}

function forceWorksheetText(ws) {
  if (!ws?.['!ref']) return
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) ws[addr] = { t: 's', v: '', z: '@' }
      ws[addr].t = 's'
      ws[addr].v = String(ws[addr].v ?? '')
      ws[addr].w = ws[addr].v
      ws[addr].z = '@'
    }
  }
}

export function buildBoExportData(opts = {}) {
  if (!Array.isArray(opts.cultureCodes)) throw new Error('상선위정보를 불러온 후 BO용 Excel을 내려받아주세요.')
  const knownCodes = new Set(opts.cultureCodes.map(item => String(item.code || '').trim()).filter(Boolean))
  const { startDate = '', scheduleBlocks = {}, pgmSlots = [], customSlots = {}, splitSlots = {}, memoCodes = MEMO_CODES } = opts
  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots)
  effectiveSlots.sort((a, b) =>
    a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : timeToMin(a.timeText) - timeToMin(b.timeText)
  )

  const data = []
  const missing = []
  const addBlock = (slot, block, duration, channel) => {
    if (channel === 'CA' || block?.channel === 'CA') return
    if (!block || block.isDefault || block.isCompeting) return
    if (!knownCodes.has(String(block.pgmCodeName || '').trim())) {
      missing.push({
        broadcastDateTime: `${slot.dateKey || block.dateKey || ''} ${formatBoTime(slot.timeText || block.timeText)}`.trim(),
        channel: channel === 'ALL' ? (block.channel || 'ALL') : channel,
        pgmCodeName: block.pgmCodeName || '(편성코드명 없음)',
      })
      return
    }
    data.push(buildBoExcelRow(slot, block, duration, memoCodes))
  }
  effectiveSlots.forEach(slot => {
    if (splitSlots[slot.slotId]) {
      const halfDur = slot.durationMin != null ? Math.round(slot.durationMin / 2) : ''
      ;['IP'].forEach(channel => {
        const block = scheduleBlocks[`${slot.slotId}_${channel}`]
        addBlock(slot, block, halfDur, channel)
      })
      return
    }
    const block = scheduleBlocks[slot.slotId]
    addBlock(slot, block, slot.durationMin, block?.channel || 'ALL')
  })
  return { data, missing, startDate }
}

export function exportToBoExcel(opts = {}) {
  const { data, missing, startDate } = buildBoExportData(opts)
  if (missing.length) {
    window.alert(`상선위정보에 없어 BO용 Excel에서 제외된 편성 ${missing.length}건\n\n방송일시 | 채널명 | 편성코드명\n${missing.map(row => `${row.broadcastDateTime} | ${row.channel === 'ALL' ? '전체' : row.channel} | ${row.pgmCodeName}`).join('\n')}`)
  }
  if (!data.length) {
    window.alert('BO용 Excel로 내려받을 편성이 없습니다. CA와 상선위정보에 없는 편성은 제외됩니다.')
    return { exportedCount: 0, missing }
  }

  const headers = ['방송일자', '시작시간', '종료시간', '편성코드', '직매입여부', '약정여부', '메모코드1', '메모코드2', '모바일광고비여부']
  const ws = XLSX.utils.json_to_sheet(data, { header: headers })
  forceWorksheetText(ws)
  ws['!cols'] = headers.map(header => ({ wch: Math.max(header.length + 2, 12) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `TimeBlockUpload_${startDate || new Date().toISOString().slice(0, 10)}.xls`, { bookType: 'xls' })
  return { exportedCount: data.length, missing }
}
