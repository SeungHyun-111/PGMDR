import * as XLSX from 'xlsx'
import { getGrade, getEffectiveProfit } from './grade'
import { getEffectivePgmSlots } from './effectiveSlots'
import { getBlockTeams, getCompetitionItems } from './competition'
import { getResolvedEntity, getResolvedPerfKey } from './entityKey'
import { exportToBoExcel } from './export/boExcelExport'
import { buildGridSection } from './export/gridExport'
import { buildRatioSection } from './export/ratioExport'
import { buildSimSection } from './export/simulationExport'
import { buildStatusSection } from './export/statusExport'
import { getScheduledBlockPerformance } from './performanceHistory'
import { getEffectiveBlockWeightedMin } from './weightedMin'

// ── 시간 비교 헬퍼 ────────────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ── 엑셀 내보내기 ─────────────────────────────────────────────────────────
function normalizeChannel(ch) {
  if (ch === 'CA') return 'CH1(CA)'
  if (ch === 'IP') return 'CH2(IP)'
  return ''
}

function normalizeDealTypeForExcel(dt) {
  if (!dt) return ''
  const d = dt.trim()
  if (d === '[위]' || d.includes('위수탁') || d.includes('기타')) return ''
  if (d === '[률]' || d.includes('정률') || d.includes('효율'))  return ''
  if (d === '[직]' || d.includes('직매입'))                       return '(직)'
  if (d === '[혼]' || d.includes('혼합') || d.includes('특약'))   return '(혼)'
  if (d === '[모]' || d.includes('모바일광고'))                    return '(광)'
  if (d === '[액]' || d.includes('정액'))                         return '(정)'
  return ''
}

function normalizeNewProductTypeForExcel(npt) {
  if (!npt || npt === '기존') return ''
  if (npt === '재녹화' || npt === '재편집') return '(재)'
  if (npt === '신상품') return '(신)'
  return ''
}

function buildExcelRow(slot, block, ch, slotDuration, options = {}) {
  const { includeEmptySlotMinutes = false, weightedMin } = options
  const empty = !block || block.isDefault
  if (empty) {
    return {
      'DATE': slot.dateKey || '', 'TIME': slot.timeText || '',
      '단순분': includeEmptySlotMinutes ? (slotDuration ?? slot.durationMin ?? '') : '',
      '가중분': includeEmptySlotMinutes ? (weightedMin ?? slot.weightedMin ?? '') : '',
      '팀명': '', '다원방송': normalizeChannel(ch),
      'MD분류': '', '상품명': '', '재/신상품': '', '혼합/직매입': '',
      '대기업/수입여부': '', '메모코드': '', '편성C': '',
    }
  }
  const isComp = block.isCompeting
  const pgmName = isComp
    ? getCompetitionItems(block).map(item => item.pgmCodeName || '').filter(Boolean).join('&')
    : (block.pgmCodeName || '')
  return {
    'DATE':            slot.dateKey || '',
    'TIME':            slot.timeText || '',
    '단순분':          block.durationMin ?? slotDuration ?? '',
    '가중분':          weightedMin ?? block.weightedMin ?? '',
    '팀명':            '',
    '다원방송':        normalizeChannel(block.channel || ch),
    'MD분류':          '',
    '상품명':          pgmName,
    '재/신상품':       normalizeNewProductTypeForExcel(block.newProductType),
    '혼합/직매입':     isComp ? '' : normalizeDealTypeForExcel(block.dealTypeConverted || block.dealType),
    '대기업/수입여부': '',
    '메모코드':        block.memoCode || '',
    '편성C':           block.scheduleComment || '',
  }
}

export function exportToExcel(rows, opts = {}) {
  if (opts.excelTarget === 'bo') {
    return exportToBoExcel(opts)
  }

  const { startDate = '', scheduleBlocks = {}, pgmSlots = [], customSlots = {}, splitSlots = {} } = opts
  const isGoogleExcel = opts.excelTarget !== 'bo'

  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots)
  effectiveSlots.sort((a, b) =>
    a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : timeToMin(a.timeText) - timeToMin(b.timeText)
  )

  const data = []
  effectiveSlots.forEach(slot => {
    const isSplit = !!(splitSlots[slot.slotId])
    if (isSplit) {
      const halfDur = slot.durationMin != null ? Math.round(slot.durationMin / 2) : ''
      const caBlk   = scheduleBlocks[`${slot.slotId}_CA`]
      const ipBlk   = scheduleBlocks[`${slot.slotId}_IP`]
      data.push(buildExcelRow(slot, caBlk, 'CA', halfDur, {
        includeEmptySlotMinutes: isGoogleExcel,
        weightedMin: isGoogleExcel ? slot.weightedMin : undefined,
      }))
      data.push(buildExcelRow(slot, ipBlk, 'IP', halfDur, {
        includeEmptySlotMinutes: isGoogleExcel,
        weightedMin: isGoogleExcel ? slot.weightedMin : undefined,
      }))
    } else {
      const blk = scheduleBlocks[slot.slotId]
      data.push(buildExcelRow(slot, blk, 'ALL', slot.durationMin, {
        includeEmptySlotMinutes: isGoogleExcel,
      }))
    }
  })

  if (!data.length) return

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '편성표')

  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, `편성표_${startDate || new Date().toISOString().slice(0, 10)}.xlsx`)
}

const reportEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const reportNum = v => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && v !== '' && v != null ? n.toLocaleString() : '-'
}
const reportMillion = v => {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && v !== '' && v != null ? (n / 1000000).toFixed(2) : ''
}
const reportShortDate = v => {
  if (!v) return '-'
  const s = String(v)
  const m = s.match(/(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  return m ? `${String(m[2]).padStart(2, '0')}/${String(m[3]).padStart(2, '0')}` : s.slice(0, 5)
}
const reportDow = ['일', '월', '화', '수', '목', '금', '토']
const reportDateObj = v => {
  if (!v) return null
  const s = String(v)
  const m = s.match(/(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const y = Number(m[1].length === 4 ? m[1] : new Date().getFullYear())
  const d = new Date(y, Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
const reportTime = v => {
  if (!v) return ''
  const m = String(v).match(/(\d{1,2}):(\d{2})/)
  return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : String(v)
}
const reportChannel = v => {
  const s = String(v || '').trim()
  if (!s || s === 'ALL') return ''
  if (s.includes('CA')) return 'CA'
  if (s.includes('IP')) return 'IP'
  return s
}
const reportPerfSub = time => String(time || '').trim()
const reportTeam = v => String(v || '').replace(/팀$/, '').slice(0, 2)
const reportVideoMark = v => {
  const s = String(v || '')
  if (!s || s === '기존') return ''
  if (s.includes('재')) return '(재)'
  if (s.includes('신')) return '(신)'
  return ''
}
const reportProductParts = v => {
  const name = String(v || '').trim()
  const m = name.match(/^\[([^\]]+)\]\s*(.*)$/)
  return m ? { brand: `[${m[1]}]`, itemName: m[2] || '' } : { brand: name, itemName: '' }
}

function getReportBlock(scheduleBlocks, slot, channel, splitSlots) {
  if (!slot) return null
  if (splitSlots?.[slot.slotId]) return scheduleBlocks[`${slot.slotId}_${channel}`] || null
  return scheduleBlocks[slot.slotId] || null
}

function getReportItem(block) {
  if (!block) return null
  if (!block.isCompeting) return block
  return getCompetitionItems(block)[0] || block
}

function getReportPerf(block, entityProps, perfMap, performanceHistoryByKey, manualInputs) {
  const item = getReportItem(block)
  if (!item) return null
  const perfKey = getResolvedPerfKey(item, entityProps) || item.perfKey
  if (!perfKey) return null
  return getScheduledBlockPerformance(
    { ...item, dateKey: block?.dateKey, timeText: block?.timeText, perfKey },
    { performanceHistoryByKey, manualInputs, fallbackPerfMap: perfMap }
  )
}

function getReportName(block) {
  if (!block) return ''
  if (!block.isCompeting) return block.pgmCodeName || ''
  return getCompetitionItems(block).map(item => item.pgmCodeName || '').filter(Boolean).join(' / ') || block.pgmCodeName || ''
}

function buildReportRow({ slot, block, channel, entityProps, perfMap, performanceHistoryByKey, manualInputs }) {
  const item = getReportItem(block)
  const resolved = item ? getResolvedEntity(item, entityProps) : item
  const perf = getReportPerf(block, entityProps, perfMap, performanceHistoryByKey, manualInputs)
  const lastPerf = perf?.lastPerf || perf?.sameBroadcastPerf || null
  const isEmpty = !block || block.isDefault
  const product = reportProductParts(isEmpty ? '' : getReportName(block))
  const rowChannel = reportChannel(channel === 'ALL' ? block?.channel : channel)
  return {
    timeText: slot?.timeText || block?.timeText || '',
    channel: rowChannel,
    team: reportTeam(resolved?.mdTeam || resolved?.orgName || block?.mdTeam || block?.orgName),
    brand: product.brand,
    itemName: product.itemName,
    memoCode: block?.memoCode || '',
    memoCode2: block?.memoCode2 || '',
    hasHash: String(block?.scheduleComment || '').includes('#'),
    durationMin: block?.durationMin ?? slot?.durationMin ?? '',
    weightedMin: block?.weightedMin ?? slot?.weightedMin ?? '',
    prevDate: lastPerf?.broadcastDate || '',
    prevTime: lastPerf?.broadcastTime || '',
    salesPerMin: perf?.salesPerMin,
    profitPerMin: perf?.profitPerMin,
    hasPerf: !!perf && !perf.missingPerf,
    dealType: resolved?.dealTypeConverted || resolved?.dealType || block?.dealTypeConverted || block?.dealType || '',
    videoType: reportVideoMark(resolved?.newProductType || resolved?.videoStatus || block?.newProductType || block?.videoStatus || ''),
    isEmpty,
  }
}

function buildReportRowsByDate({ scheduleBlocks, pgmSlots, customSlots, splitSlots, entityProps, perfMap, performanceHistoryByKey, manualInputs }) {
  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots || {})
  effectiveSlots.sort((a, b) =>
    a.dateKey !== b.dateKey
      ? a.dateKey.localeCompare(b.dateKey)
      : timeToMin(a.timeText) - timeToMin(b.timeText)
  )

  const byDate = {}
  effectiveSlots.forEach(slot => {
    if (!byDate[slot.dateKey]) byDate[slot.dateKey] = []
    if (splitSlots?.[slot.slotId]) {
      ;['CA', 'IP'].forEach(channel => {
        byDate[slot.dateKey].push(buildReportRow({
          slot,
          channel,
          block: getReportBlock(scheduleBlocks, slot, channel, splitSlots),
          entityProps,
          perfMap,
          performanceHistoryByKey,
          manualInputs,
        }))
      })
    } else {
      byDate[slot.dateKey].push(buildReportRow({
        slot,
        channel: 'ALL',
        block: getReportBlock(scheduleBlocks, slot, 'ALL', splitSlots),
        entityProps,
        perfMap,
        performanceHistoryByKey,
        manualInputs,
      }))
    }
  })
  return byDate
}

function reportDensity(maxRows) {
  if (maxRows <= 30) return 'normal'
  if (maxRows <= 42) return 'compact'
  if (maxRows <= 56) return 'dense'
  return 'ultra'
}

function getReportMaxRows(rowsByDate) {
  const dates = Object.keys(rowsByDate)
  return Math.max(...dates.map(d => rowsByDate[d].length), 1)
}

function calcReportLayout(maxRows, dateCount, pageWmm = 400, pageHmm = 285) {
  const PAGE_W_MM = pageWmm // A3 landscape 420mm - horizontal margins 10mm * 2
  const PAGE_H_MM = pageHmm // A3 landscape 297mm - vertical margins 6mm * 2
  const TOP_H_MM = 12
  const TOP_MB_MM = 1.5
  const DAY_HEAD_H_MM = 3
  const DEFAULT_ROW_H_MM = 7.5
  const MIN_ROW_H_MM = 4.6

  const availableRowsH = PAGE_H_MM - TOP_H_MM - TOP_MB_MM - DAY_HEAD_H_MM
  const rowH = Math.max(MIN_ROW_H_MM, Math.min(DEFAULT_ROW_H_MM, availableRowsH / maxRows))
  const fontK = Math.max(0.62, rowH / DEFAULT_ROW_H_MM)
  const dayW = Math.min(60, PAGE_W_MM / Math.max(dateCount, 1))

  return { PAGE_W_MM, PAGE_H_MM, rowH, fontK, dayW }
}

export function printReportSchedule(rows, opts = {}) {
  const {
    startDate = '', endDate = '', scheduleBlocks = {}, pgmSlots = [],
    customSlots = {}, splitSlots = {}, perfMap = {}, performanceHistoryByKey = {}, manualInputs = {}, entityProps = {}, profitThreshold = null,
  } = opts

  const rowsByDate = buildReportRowsByDate({ scheduleBlocks, pgmSlots, customSlots, splitSlots, entityProps, perfMap, performanceHistoryByKey, manualInputs })
  const dates = Object.keys(rowsByDate).sort()
  const maxRows = getReportMaxRows(rowsByDate)
  const density = reportDensity(maxRows)
  const scheduledCount = Object.values(scheduleBlocks).filter(b => b && !b.isDefault).length
  const { PAGE_W_MM, PAGE_H_MM, rowH, fontK, dayW } = calcReportLayout(maxRows, dates.length)

  const dateHeader = d => {
    const date = new Date(d)
    const dow = Number.isNaN(date.getTime()) ? '' : reportDow[date.getDay()]
    return `${reportEsc(d.slice(5))}${dow ? ` (${dow})` : ''}`
  }

  const body = dates.map(d => `
    <section class="day-col">
      <div class="day-head">${dateHeader(d)}</div>
      <div class="rows">
        ${[...rowsByDate[d], ...Array.from({ length: Math.max(0, maxRows - rowsByDate[d].length) }, () => ({ isEmpty: true }))].map(row => {
          const profit = Number(String(row.profitPerMin ?? '').replace(/,/g, ''))
          const belowProfit = row.hasPerf && profitThreshold != null && Number.isFinite(profit) && profit < profitThreshold
          return `
          <div class="report-row ${row.isEmpty ? 'empty' : ''} ${belowProfit ? 'below-profit' : ''}">
            <div class="time"><span>${reportEsc(reportTime(row.timeText))}</span><span class="ch">${reportEsc(row.channel || '')}</span></div>
            <div class="team"><span>${reportEsc(row.team || '')}</span><span class="video">${reportEsc(row.videoType || '')}</span></div>
            <div class="main">
              <div class="name">${reportEsc([row.dealType, row.brand, row.memoCode, row.memoCode2].filter(Boolean).join(' '))}</div>
              <div class="meta"><span>${reportEsc(row.itemName || '')}</span>${row.hasHash ? '<span class="hash">#</span>' : ''}</div>
            </div>
            <div class="min">${row.isEmpty || row.weightedMin === '' || row.weightedMin == null ? '' : `${reportEsc(row.weightedMin)}분`}</div>
            <div class="perf">
              <span class="perf-line"></span>
              ${row.hasPerf ? `
                <div class="perf-date">${reportShortDate(row.prevDate)}</div>
                <div class="perf-sales">${reportMillion(row.salesPerMin)}</div>
                <div class="perf-sub">${reportEsc(reportPerfSub(row.prevTime))}</div>
                <div class="perf-profit">${reportMillion(row.profitPerMin)}</div>
              ` : ''}
            </div>
          </div>
        `}).join('')}
      </div>
    </section>
  `).join('')

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>보고용 편성표 ${startDate} ~ ${endDate}</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#000;font-family:'Malgun Gothic','Apple SD Gothic Neo',Arial,sans-serif}
    @page{size:A3 landscape;margin:6mm 10mm}
    @media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    .page{width:${PAGE_W_MM}mm;height:${PAGE_H_MM}mm;padding:0;overflow:hidden}
    .sheet{width:${(dayW * Math.max(dates.length, 1)).toFixed(2)}mm;transform-origin:top center}
    .top{height:12mm;display:flex;align-items:center;border-bottom:0.5mm solid #000;margin-bottom:1.5mm}
    .title{font-size:12px;font-weight:800;margin-right:4mm}
    .range,.count{font-size:8px;color:#111}
    .count{margin-left:auto}
    .grid{width:100%;display:grid;grid-template-columns:repeat(${Math.max(dates.length, 1)}, ${dayW.toFixed(2)}mm);border-left:0.35mm solid #000;border-top:0.35mm solid #000}
    .day-col{position:relative;min-width:0;border-right:0}
    .day-col:after{content:"";position:absolute;top:0;right:0;bottom:0;width:0.35mm;background:#000;z-index:30;pointer-events:none}
    .day-head{height:3mm;display:flex;align-items:center;justify-content:center;border-bottom:0.35mm solid #000;font-size:8px;font-weight:800;line-height:1;padding:1px 0;overflow:hidden}
    .rows{display:grid;grid-auto-rows:var(--row-h)}
    .report-row{position:relative;height:100%;min-height:0;display:grid;grid-template-columns:7.5mm 7mm minmax(0,1fr) var(--min-w) 10.5mm;overflow:hidden}
    .report-row:after{content:"";position:absolute;left:0;right:0;bottom:0;border-bottom:0.12mm solid #aaa;z-index:8;pointer-events:none}
    .report-row>div{position:relative;min-width:0;border-right:0;padding:0.35mm 0.55mm;line-height:1.1;overflow:hidden;box-shadow:none}
    .report-row>div:not(.perf):after{content:"";position:absolute;top:0;right:0;bottom:0;width:0.1mm;background:#c6c6c6;z-index:20;pointer-events:none}
    .time{font-weight:800;font-size:var(--time-fs);white-space:nowrap;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
    .time .ch{font-size:var(--ch-fs);font-weight:700;line-height:1}
    .team{font-size:var(--team-fs);white-space:nowrap;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;font-weight:400}
    .team .video{font-size:var(--ch-fs);font-weight:400;line-height:1}
    .main{display:flex;flex-direction:column;justify-content:center;gap:0.05mm;padding:0 0.55mm}
    .name,.meta{font-size:var(--name-fs);line-height:1.18;white-space:nowrap;overflow:hidden}
    .name{font-weight:700}
    .meta{font-weight:600;display:flex;align-items:center;gap:0.8mm}
    .meta span:first-child{min-width:0;overflow:hidden}
    .meta .hash{margin-left:auto;font-weight:900}
    .min{font-size:var(--min-fs);font-weight:400;text-align:center;white-space:nowrap;display:flex;align-items:center;justify-content:center}
    .perf{position:relative;font-size:var(--perf-fs);display:grid;grid-template-columns:50% 50%;grid-template-rows:1fr 1fr;align-items:stretch;padding:0;box-shadow:none}
    .perf:before{content:"";position:absolute;top:0.1mm;bottom:0.1mm;left:50%;width:1px;background:#e5e5e5;opacity:.55;transform:translateX(-50%) scaleX(.35);transform-origin:center;z-index:7;pointer-events:none}
    .perf:after{content:"";position:absolute;left:0.45mm;right:0.45mm;top:50%;height:1px;background:#e5e5e5;opacity:.55;transform:translateY(-50%) scaleY(.35);transform-origin:center;z-index:7;pointer-events:none}
    .perf-line{position:absolute;top:0;left:0;bottom:0;width:0.35mm;background:#000;z-index:25;pointer-events:none}
    .perf-date,.perf-sub,.perf-sales,.perf-profit{position:relative;z-index:1;font-size:var(--perf-fs);font-weight:400;white-space:nowrap;line-height:1;display:flex;align-items:center;padding:0.1mm 0.55mm}
    .perf-date,.perf-sub{padding-left:0.15mm;padding-right:0.2mm}
    .perf-sales,.perf-profit{padding-left:0.85mm}
    .perf-date,.perf-sub{justify-content:flex-start;text-align:left}
    .perf-sales,.perf-profit{justify-content:flex-end;text-align:right}
    .empty .name,.empty .meta,.empty .perf{color:transparent}
    .below-profit{color:#f00;font-style:italic;font-weight:800}
    .below-profit>div{background:#ffff00;background-clip:padding-box}
    .below-profit .name,.below-profit .meta,.below-profit .time,.below-profit .team,.below-profit .min,.below-profit .perf-date,.below-profit .perf-sub,.below-profit .perf-sales,.below-profit .perf-profit{font-weight:800;font-style:italic}
    .normal,.compact,.dense,.ultra{--row-h:${rowH.toFixed(2)}mm;--min-w:5.8mm;--time-fs:${(8 * fontK).toFixed(2)}px;--ch-fs:${(6.8 * fontK).toFixed(2)}px;--team-fs:${(7.3 * fontK).toFixed(2)}px;--name-fs:${(7.8 * fontK).toFixed(2)}px;--min-fs:${(7.4 * fontK).toFixed(2)}px;--sub-fs:${(5.3 * fontK).toFixed(2)}px;--perf-fs:${(5.8 * fontK).toFixed(2)}px}
    .ultra .meta{display:none}
  </style>
</head>
<body>
  <div class="page">
    <div id="sheet" class="sheet ${density}">
      <header class="top">
        <div class="title">보고용 편성표</div>
        <div class="range">${reportEsc(startDate)} ~ ${reportEsc(endDate)}</div>
        <div class="count">${scheduledCount}건 · 직전실적 기준</div>
      </header>
      <main class="grid">${body || '<div style="padding:8mm;font-size:10px">편성 데이터가 없습니다.</div>'}</main>
    </div>
  </div>
  <script>
    window.onload=function(){
      var page=document.querySelector('.page');
      var sheet=document.getElementById('sheet');
      sheet.style.margin='0 auto';
      function fitText(el,min){
        if(!el) return;
        var base=parseFloat(getComputedStyle(el).fontSize)||7;
        var size=base;
        while((el.scrollWidth>el.clientWidth || el.scrollHeight>el.clientHeight) && size>min){
          size-=0.2;
          el.style.fontSize=size+'px';
        }
      }
      document.querySelectorAll('.name,.meta span:first-child,.time span,.team span,.min,.perf-date,.perf-sub,.perf-sales,.perf-profit').forEach(function(el){
        fitText(el,3);
      });
      document.querySelectorAll('.main').forEach(function(main){
        var lines=main.querySelectorAll('.name,.meta');
        var size=Math.min.apply(null, Array.from(lines).map(function(el){return parseFloat(getComputedStyle(el).fontSize)||7;}));
        while(main.scrollHeight>main.clientHeight && size>3){
          size-=0.2;
          lines.forEach(function(el){el.style.fontSize=size+'px';});
        }
      });
      setTimeout(function(){window.print();window.close()},450);
    };
  <\/script>
</body>
</html>`)
  win.document.close()
}

// ── 인쇄 ─────────────────────────────────────────────────────────────────
export function printSchedule(rows, opts = {}) {
  const { startDate = '', endDate = '', scheduleBlocks = {}, pgmSlots = [], customSlots = {}, splitSlots = {} } = opts

  // 슬롯 수 계산 (높이 채우기용)
  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots)
  const slotsByDate = {}
  effectiveSlots.forEach(s => {
    if (!slotsByDate[s.dateKey]) slotsByDate[s.dateKey] = []
    slotsByDate[s.dateKey].push(s)
  })
  const numDates = Object.keys(slotsByDate).length || 1
  const maxSlotUnits = Math.max(...Object.values(slotsByDate).map(slots =>
    slots.reduce((sum, sl) => sum + (splitSlots[sl.slotId] ? 2 : 1), 0)
  ), 1)

  // A4 가로 기준 (8mm 여백 적용) — 너비·높이 모두 꽉 채우도록 unitH 역산
  const TIME_W = 36, COL_W = 160
  const PAGE_W = 1046, PAGE_H = 700
  const FIXED_H = 85  // 제목(~44) + 그리드헤더(36) + 여백·보더 (toolbar 제외됨)
  const naturalW = numDates * (TIME_W + COL_W)
  const zoom = Math.min(1, PAGE_W / naturalW)
  const unitH = Math.max(20, Math.floor((PAGE_H / zoom - FIXED_H) / maxSlotUnits))

  const scheduledCount = Object.values(scheduleBlocks).filter(b => b && !b.isDefault).length
  const gridHtml = buildGridSection({ scheduleBlocks, pgmSlots, customSlots, splitSlots, perfMap: {}, unitH, forPrint: true })

  const win = window.open('', '_blank')
  win.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>편성표 ${startDate} ~ ${endDate}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Malgun Gothic','Apple SD Gothic Neo',Arial,sans-serif;background:#fff;padding:6px 10px}
    @page{size:A4 landscape;margin:8mm}
    @media print{
      html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      #_teamSel,label{display:none}
    }
  </style>
</head>
<body>
  <div id="root">
    <div style="display:flex;align-items:baseline;gap:10px;padding-bottom:6px;border-bottom:2px solid #1a1d2e;margin-bottom:8px">
      <span style="font-size:13px;font-weight:800;color:#1a1d2e">초안 편성표</span>
      <span style="font-size:10px;color:#8b90ab">${startDate} ~ ${endDate}</span>
      <span style="font-size:10px;color:#4a4f6e;margin-left:auto">${scheduledCount}건 편성</span>
    </div>
    ${gridHtml}
  </div>
  <script>
  window.onload=function(){
    var root=document.getElementById('root');
    var s=Math.min(1, 1046/root.scrollWidth);
    if(s<1) root.style.zoom=s;
    setTimeout(function(){window.print();window.close()},400);
  };
  <\/script>
</body>
</html>`)
  win.document.close()
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML 다중 섹션 내보내기
// ═══════════════════════════════════════════════════════════════════════════

// 라이트 테마 하드코딩 (CSS 변수 미지원 환경)
const HC = {
  bg: '#f5f6fa', bg2: '#fff', bg3: '#f0f1f7', bg4: '#e8eaf2',
  border: '#e2e4ef', text: '#1a1d2e', text2: '#4a4f6e', text3: '#8b90ab',
  accent: '#4a6cf7', green: '#16a34a', red: '#dc2626', yellow: '#d97706',
  ca: '#dbeafe', caT: '#1d4ed8', ip: '#ede9fe', ipT: '#6d28d9',
  all: '#dcfce7', allT: '#15803d',
}
const GC = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f97316', D: '#6b7280' }
const GB = { S: 'rgba(245,158,11,.15)', A: 'rgba(16,185,129,.15)', B: 'rgba(59,130,246,.15)', C: 'rgba(249,115,22,.15)', D: 'rgba(107,114,128,.12)' }
const DN = ['일', '월', '화', '수', '목', '금', '토']

const hf  = v => Math.round(Number(v || 0)).toLocaleString()
const hfs = v => {
  const n = Math.round(Number(v || 0))
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
  if (n >= 10000) return (n / 10000).toFixed(1) + '만'
  return n.toLocaleString()
}
const chBadge = ch => {
  const [bg, c] = ch === 'CA' ? [HC.ca, HC.caT] : ch === 'IP' ? [HC.ip, HC.ipT] : [HC.all, HC.allT]
  return `<span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;background:${bg};color:${c}">${ch}</span>`
}
const gBadge = g => {
  const c = GC[g] || '#6b7280', bg = GB[g] || 'transparent'
  return `<span style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:4px;background:${bg};color:${c};border:1px solid ${c}40">${g}</span>`
}

function calcRatioStats(scheduleBlocks, categoryMap, viewType) {
  const group = {}, groupDm = {}
  let totalWeighted = 0, totalDm = 0, competingWeighted = 0
  Object.values(scheduleBlocks).forEach(block => {
    if (!block) return
    const w = getEffectiveBlockWeightedMin(block)
    const d = block.durationMin || 0
    totalWeighted += w
    totalDm += d
    if (block.isCompeting) competingWeighted += w
    const key = viewType === 'category'
      ? (block.isDefault ? '편성팀' : (block.mdCategory || categoryMap[block.pgmCodeName] || '미분류'))
      : (block.isCompeting ? '경쟁' : block.isDefault ? '편성팀' : (block.mdTeam || block.orgName || '미지정'))
    group[key]   = (group[key]   || 0) + w
    groupDm[key] = (groupDm[key] || 0) + d
  })
  return { group, groupDm, totalWeighted, totalDm, competingWeighted }
}

// ── 공통 HTML 틀 ──────────────────────────────────────────────────────────

function htmlBase(title, subtitle, body) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',Arial,sans-serif;font-size:12px;color:#1a1d2e;background:#f5f6fa;margin:0;padding:24px}
h1{font-size:18px;font-weight:800;margin:0 0 4px}
h2{font-size:13px;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e4ef}
.sub{font-size:11px;color:#8b90ab;margin:0 0 24px}
.sec{background:#fff;border:1px solid #e2e4ef;border-radius:10px;padding:16px 20px;margin-bottom:16px;overflow-x:auto}
.sec-title{font-size:12px;font-weight:700;margin-bottom:10px;color:#4a4f6e}
.cards{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.card{background:#fff;border:1px solid #e2e4ef;border-radius:10px;padding:14px 16px;flex:1;min-width:120px}
.card.warn{border-color:rgba(220,38,38,.5);background:rgba(220,38,38,.03)}
.cl{font-size:10px;color:#8b90ab;font-weight:600;margin-bottom:6px}
.cl.warn{color:#dc2626}
.cv{font-size:20px;font-weight:700}
.cs{font-size:9px;color:#8b90ab;margin-top:2px}
.hero-cards{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.hero{flex:1;min-width:180px;background:#fff;border:1px solid #e2e4ef;border-radius:10px;padding:16px 18px}
.hero-lbl{font-size:10px;color:#8b90ab;font-weight:700;letter-spacing:.5px;margin-bottom:8px}
.hero-big{font-size:28px;font-weight:800;line-height:1}
.hero-sm{font-size:12px;font-weight:600;color:#4a4f6e}
.hero-sub{font-size:10px;color:#8b90ab;margin-top:4px;margin-bottom:8px}
.hero-note{font-size:9px;color:#8b90ab;margin-top:4px}
.eff-bar-wrap{display:flex;align-items:center;gap:8px;margin-top:6px}
.eff-bar-bg{flex:1;height:5px;background:#e8eaf2;border-radius:3px;overflow:hidden}
.eff-bar-fill{height:100%;border-radius:3px;transition:width .4s}
.eff-pct{font-size:10px;color:#8b90ab;min-width:34px;text-align:right}
table{border-collapse:collapse;width:100%;font-size:11px}
th{background:#f0f1f7;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#4a4f6e;border-bottom:2px solid #e2e4ef;white-space:nowrap}
th.r,td.r{text-align:right}
th.c,td.c{text-align:center}
td{padding:7px 12px;border-bottom:1px solid #f0f1f7;color:#1a1d2e;white-space:nowrap}
tr:nth-child(even) td{background:#fafafa}
.missing-row td{background:rgba(220,38,38,.04)!important}
.total-row td{background:#f0f1f7;font-weight:700;border-top:2px solid #e2e4ef}
.bar-wrap{display:flex;align-items:center;gap:8px;min-width:120px}
.bar-bg{flex:1;height:6px;background:#e8eaf2;border-radius:3px;overflow:hidden;min-width:60px}
.bar-fill{height:100%;border-radius:3px;background:#4a6cf7}
.grid-a3-page{width:400mm;height:285mm;background:#fff;border:1px solid #e2e4ef;border-radius:10px;overflow:hidden;margin-bottom:16px}
@page{size:A3 landscape;margin:6mm 10mm}
@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.grid-a3-page{page-break-after:always;border:none;border-radius:0}}
</style>
</head>
<body>
<h1>${title}</h1>
<p class="sub">${subtitle}</p>
${body}
</body>
</html>`
}

// ── 편성표 그리드 ─────────────────────────────────────────────────────────

// ── 시뮬레이션 ────────────────────────────────────────────────────────────

// ── 편성비중 ──────────────────────────────────────────────────────────────
// ScheduleRatio → RatioSummaryCards + RatioTable + RatioPgmCount 구조 복제

// ── 편성현황 ──────────────────────────────────────────────────────────────
// ScheduleStatus → GradeDonutChart(→ grade summary table) + StatusScheduled + StatusUnscheduled

function filterGridBlocksByTeams(scheduleBlocks = {}, teamFilter = null) {
  if (!Array.isArray(teamFilter)) return scheduleBlocks
  const allow = new Set(teamFilter)
  return Object.fromEntries(
    Object.entries(scheduleBlocks || {}).filter(([, block]) => {
      if (!block || block.isDefault) return true
      return getBlockTeams(block).some(team => allow.has(team))
    })
  )
}

export function exportToHtmlSections(sections, data) {
  const { startDate = '', endDate = '' } = data
  const parts = []

  if (sections.grid) {
    const gridData = {
      ...data,
      scheduleBlocks: filterGridBlocksByTeams(data.scheduleBlocks, data.gridTeamFilter),
    }
    parts.push(`<h2>편성표</h2>` + buildGridSection(gridData))
  }
  if (sections.simulation) parts.push(`<h2>시뮬레이션 (실적 예상값)</h2>` + buildSimSection(data))
  if (sections.ratio)      parts.push(`<h2>편성비중</h2>` + buildRatioSection(data))
  if (sections.status)     parts.push(`<h2>편성현황</h2>` + buildStatusSection(data))

  const title    = `편성 리포트 ${startDate} ~ ${endDate}`
  const subtitle = `${startDate} ~ ${endDate} · 생성 ${new Date().toLocaleString('ko-KR')}`
  const html     = htmlBase(title, subtitle, parts.join('\n'))

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `편성리포트_${startDate}_${endDate}.html`
  a.click()
  URL.revokeObjectURL(url)
}
