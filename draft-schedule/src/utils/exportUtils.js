import * as XLSX from 'xlsx'
import { getGrade, getEffectiveProfit } from './grade'
import { getEffectivePgmSlots } from './effectiveSlots'

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
  if (d === '[액]' || d.includes('정액'))                         return '(액)'
  return ''
}

function normalizeNewProductTypeForExcel(npt) {
  if (!npt || npt === '기존') return ''
  if (npt === '재녹화' || npt === '재편집') return '(재)'
  if (npt === '신상품') return '(신)'
  return ''
}

function buildExcelRow(slot, block, ch, slotDuration) {
  const empty = !block || block.isDefault
  if (empty) {
    return {
      'DATE': slot.dateKey || '', 'TIME': slot.timeText || '',
      '단순분': '', '가중분': '', '팀명': '', '다원방송': normalizeChannel(ch),
      'MD분류': '', '상품명': '', '재/신상품': '', '혼합/직매입': '',
      '대기업/수입여부': '', '메모코드': '', '편성C': '',
    }
  }
  const isComp = block.isCompeting
  const pgmName = isComp && block.item1 && block.item2
    ? `${block.item1.pgmCodeName || ''}&${block.item2.pgmCodeName || ''}`
    : (block.pgmCodeName || '')
  return {
    'DATE':            slot.dateKey || '',
    'TIME':            slot.timeText || '',
    '단순분':          block.durationMin ?? slotDuration ?? '',
    '가중분':          block.weightedMin ?? '',
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
  const { startDate = '', scheduleBlocks = {}, pgmSlots = [], customSlots = {}, splitSlots = {} } = opts

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
      data.push(buildExcelRow(slot, caBlk, 'CA', halfDur))
      data.push(buildExcelRow(slot, ipBlk, 'IP', halfDur))
    } else {
      const blk = scheduleBlocks[slot.slotId]
      data.push(buildExcelRow(slot, blk, 'ALL', slot.durationMin))
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

function calcForecastLocal(block, perfMap, manualInputs) {
  const isDefaultPgmTeam = block.pgmCodeName === '[편성팀]' && block.memoCode === '[전사블록]'
  const manualKey = isDefaultPgmTeam ? 'sim_pgm_team' : block.uniqueKey
  const manual = manualKey ? (manualInputs[manualKey] || {}) : {}
  const lastPerf = block.perfKey ? (perfMap[block.perfKey] || null) : null
  const ms = manual.expectedSalesPerWeightedMin  ?? null
  const mp = manual.expectedProfitPerWeightedMin ?? null
  const sp = ms ?? lastPerf?.salesPerWeightedMin  ?? null
  const pp = mp ?? lastPerf?.profitPerWeightedMin ?? null
  const wm = Number(block.weightedMin || 0)
  return {
    lastPerf,
    salesPerMin: sp, profitPerMin: pp,
    expectedSales:  (sp ?? 0) * wm,
    expectedProfit: (pp ?? 0) * wm,
    missingPerf: !lastPerf && (ms == null || mp == null),
    manualSales: ms, manualProfit: mp,
  }
}

function parseTargetMetrics(raw) {
  if (!raw) return { teamMap: {}, companyTotal: null }
  if (raw.sales && raw.profit) {
    const salesList  = Array.isArray(raw.sales)  ? raw.sales  : []
    const profitList = Array.isArray(raw.profit) ? raw.profit : []
    const salesMap = {}, profitMap = {}
    salesList.forEach(r  => { salesMap[(r.name || '').trim()]  = r.value || 0 })
    profitList.forEach(r => { profitMap[(r.name || '').trim()] = r.value || 0 })
    const totalSales  = salesList.find(r => r.isCompanyTotal)
    const totalProfit = profitList.find(r => r.isCompanyTotal)
    const companyTotal = (totalSales || totalProfit) ? {
      salesPerMin:  totalSales?.value  || 0,
      profitPerMin: totalProfit?.value || 0,
    } : null
    const teamMap = {}
    const allNames = new Set([...Object.keys(salesMap), ...Object.keys(profitMap)])
    allNames.forEach(name => {
      if (!name) return
      const entry = { salesPerMin: salesMap[name] || 0, profitPerMin: profitMap[name] || 0 }
      teamMap[name] = entry
      const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
      teamMap[alt] = entry
    })
    return { teamMap, companyTotal }
  }
  return { teamMap: {}, companyTotal: null }
}

function calcRatioStats(scheduleBlocks, categoryMap, viewType) {
  const group = {}, groupDm = {}
  let totalWeighted = 0, totalDm = 0, competingWeighted = 0
  Object.values(scheduleBlocks).forEach(block => {
    if (!block) return
    const w = block.weightedMin || 0
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

function buildGridSection({ scheduleBlocks, pgmSlots, customSlots, splitSlots, perfMap, unitH = 44, forPrint = false }) {
  const UNIT_H = unitH, TIME_W = 36, COL_W = 160
  const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots || {})

  const slotsByDate = {}
  effectiveSlots.forEach(s => {
    if (!slotsByDate[s.dateKey]) slotsByDate[s.dateKey] = []
    slotsByDate[s.dateKey].push(s)
  })

  const dates = Object.keys(slotsByDate).sort()
  if (!dates.length) return '<div style="padding:24px;color:#8b90ab;font-size:12px">편성된 슬롯이 없습니다.</div>'

  dates.forEach(d => slotsByDate[d].sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText)))

  const maxSlotUnits = Math.max(...dates.map(d =>
    slotsByDate[d].reduce((s, sl) => s + (splitSlots?.[sl.slotId] ? 2 : 1), 0)
  ))
  const totalH    = maxSlotUnits * UNIT_H
  const colW      = TIME_W + COL_W
  const totalSlots = dates.reduce((s, d) => s + slotsByDate[d].length, 0)

  const esc     = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const escAttr = s => String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  // ── renderBlk: ScheduleBlock.jsx와 동일한 색상·뱃지 로직 ────────────────
  const renderBlk = (block, rowH) => {
    if (!block || block.isDefault) return ''

    const npt          = block.newProductType || ''
    const prodTypeChar = npt === '신상품' ? '(신)' : (npt === '재녹화' || npt === '재편집') ? '(재)' : ''
    const dealType     = block.dealTypeConverted || block.dealType || ''
    const isDirect     = dealType.includes('[직]') || dealType.includes('직매입')
    const isPurple     = dealType.includes('[모]') || dealType.includes('모바일광고')
                      || dealType.includes('[혼]') || dealType.includes('혼합')
                      || dealType.includes('[액]') || dealType.includes('정액')
    const hasHash      = !!(block.scheduleComment && block.scheduleComment.includes('#'))
    const isGreenBg    = !isDirect && !isPurple && hasHash
    const isComp       = block.isCompeting
    const isPgmTeam    = block.pgmCodeName === '[편성팀]'

    const bgColor     = isComp ? '#8b0000' : isPgmTeam ? '#f0f1f7' : isDirect ? '#1d4ed8' : isPurple ? '#7c3aed' : isGreenBg ? '#166534' : '#ffffff'
    const borderColor = isComp ? '#ff4444' : isPgmTeam ? '#c8cade' : isDirect ? 'rgba(59,130,246,.5)' : isPurple ? 'rgba(139,92,246,.5)' : isGreenBg ? 'rgba(34,197,94,.5)' : '#e2e4ef'
    const isColored   = isComp || isDirect || isPurple || isGreenBg
    const textColor   = isColored ? '#fff' : '#1a1d2e'
    const fontSize    = rowH > 30 ? 10 : 9
    const badgeSz     = Math.max(7, fontSize - 1)
    const badgeBg     = isColored ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.07)'

    const teamShort = isComp ? '경쟁' : ((block.mdTeam || block.orgName || '').replace('팀', '').slice(0, 2))

    let dealChar = ''
    if (!isComp) {
      const dt = block.dealTypeConverted || block.dealType || ''
      if      (dt.startsWith('[위]') || dt.includes('위수탁'))     dealChar = '위'
      else if (dt.startsWith('[모]') || dt.includes('모바일광고')) dealChar = '모'
      else if (dt.startsWith('[직]') || dt.includes('직매입'))     dealChar = '직'
      else if (dt.startsWith('[혼]') || dt.includes('혼합'))       dealChar = '혼'
      else if (dt.startsWith('[액]') || dt.includes('정액'))       dealChar = '액'
      else if (dt.startsWith('[률]') || dt.includes('정률'))       dealChar = '률'
      else if (dt) dealChar = dt.charAt(0)
    }

    const bs = `font-size:${badgeSz}px;font-weight:700;color:${textColor};background:${badgeBg};padding:0 3px;height:14px;border-radius:2px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center`
    const badges = [
      teamShort ? `<span style="${bs}">${esc(teamShort)}</span>` : '',
      dealChar && !isComp ? `<span style="${bs}">${esc(dealChar)}</span>` : '',
      prodTypeChar && !isComp
        ? `<span style="font-size:${badgeSz}px;font-weight:700;color:${npt==='신상품'?(isColored?'#fef08a':'#92400e'):(isColored?'#93c5fd':'#1e40af')};background:${npt==='신상품'?'rgba(234,179,8,.25)':'rgba(59,130,246,.25)'};padding:0 3px;height:14px;border-radius:2px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center">${esc(prodTypeChar)}</span>`
        : '',
      (block.channel === 'CA' || block.channel === 'IP') && !isComp
        ? `<span style="font-size:${badgeSz}px;font-weight:700;background:${block.channel==='CA'?'#dbeafe':'#ede9fe'};color:${block.channel==='CA'?'#1d4ed8':'#6d28d9'};padding:0 3px;height:14px;border-radius:2px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center">${esc(block.channel)}</span>`
        : '',
    ].filter(Boolean).join('')

    const wmSpan = (block.weightedMin || 0) > 0
      ? `<span style="font-size:${badgeSz}px;color:${isColored?'rgba(255,255,255,.45)':'#8b90ab'};white-space:nowrap;flex-shrink:0">${block.weightedMin}</span>`
      : ''
    const annotCorner = block.annotation
      ? `<div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 8px 8px 0;border-color:transparent #d97706 transparent transparent"></div>`
      : ''
    const hashMark = hasHash
      ? `<div style="position:absolute;bottom:1px;right:3px;font-size:8px;color:rgba(100,220,100,.8);font-weight:700">#</div>`
      : ''

    const lastPerf = (block.perfKey && perfMap) ? (perfMap[block.perfKey] || null) : null
    const tipJson  = JSON.stringify({
      isComp, item1: block.item1 || null, item2: block.item2 || null,
      mdTeam: block.mdTeam || block.orgName || null, channel: block.channel || null,
      dealType: block.dealType || null, newProductType: block.newProductType || null,
      mdCategory: block.mdCategory || null, dateKey: block.dateKey || null,
      timeText: block.timeText || null, durationMin: block.durationMin || null,
      weightedMin: block.weightedMin || null, memoCode: block.memoCode || null,
      scheduleComment: block.scheduleComment || null, annotation: block.annotation || null,
      lastPerf: lastPerf ? { broadcastDate: lastPerf.broadcastDate, spw: lastPerf.salesPerWeightedMin, ppw: lastPerf.profitPerWeightedMin } : null,
    })

    const teamVal = escAttr(block.mdTeam || block.orgName || '')
    return `<div class="blk" style="position:absolute;inset:1px" data-tip="${escAttr(tipJson)}" data-team="${teamVal}"><div style="position:absolute;inset:0;background:${bgColor};border:1px solid ${borderColor};border-radius:3px;overflow:hidden;display:flex;align-items:center;padding:0 4px;gap:3px;box-sizing:border-box">${badges}<span style="font-size:${fontSize}px;font-weight:600;color:${textColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(block.pgmCodeName||'-')}</span>${wmSpan}${annotCorner}${hashMark}</div></div>`
  }

  // ── 헤더 (ScheduleGrid 헤더와 동일) ─────────────────────────────────────
  const headerCols = dates.map((d, di) => {
    const dow = DN[new Date(d).getDay()]
    return `<div style="flex:1;min-width:${colW}px;display:flex${di>0?';border-left:2px solid #c8cade':''}"><div style="width:${TIME_W}px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:12px;font-weight:700;color:#1a1d2e">${esc(dow)} <span style="font-size:10px;font-weight:400;color:#8b90ab">${esc(d.slice(5))}</span></div></div></div>`
  }).join('')

  // ── 바디 ────────────────────────────────────────────────────────────────
  const bodyCols = dates.map((d, di) => {
    const slots = slotsByDate[d] || []
    let timeTop = 0, timeAxisHtml = '', blockHtml = ''

    slots.forEach(slot => {
      const isSplit  = !!(splitSlots?.[slot.slotId])
      const isCustom = !!slot.isCustom
      const rowH     = (isSplit ? 2 : 1) * UNIT_H
      const top      = timeTop
      timeTop       += rowH
      const halfH    = rowH / 2

      const [hh, mm]  = (slot.timeText || '00:00').split(':')
      const timeFsz   = Math.min(11, Math.max(8, rowH * 0.28))
      const timeClr   = isSplit ? '#dc2626' : isCustom ? '#4a6cf7' : '#4a4f6e'
      const timeBdr   = isSplit
        ? 'border:2px double #dc2626;background:rgba(220,38,38,.03)'
        : isCustom
        ? 'border-bottom:1px dashed #4a6cf7;background:rgba(74,108,247,.04)'
        : 'border-bottom:1px solid #e2e4ef'

      timeAxisHtml += `<div style="position:absolute;top:${top}px;left:0;right:0;height:${rowH}px;overflow:hidden;${timeBdr};display:flex;align-items:center;justify-content:center"><span style="font-size:${timeFsz}px;color:${timeClr};font-weight:600;white-space:nowrap;letter-spacing:-0.3px">${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}</span></div>`

      if (isSplit) {
        const caBlk = scheduleBlocks[`${slot.slotId}_CA`]
        const ipBlk = scheduleBlocks[`${slot.slotId}_IP`]
        blockHtml += `<div style="position:absolute;top:${top}px;left:0;right:0;height:${rowH}px;border-bottom:1px solid #e2e4ef"><div style="position:absolute;top:0;left:0;right:0;height:${halfH}px;border-bottom:1px solid #e2e4ef">${caBlk&&!caBlk.isDefault?renderBlk(caBlk,halfH):''}</div><div style="position:absolute;top:${halfH}px;left:0;right:0;height:${halfH}px">${ipBlk&&!ipBlk.isDefault?renderBlk(ipBlk,halfH):''}</div></div>`
      } else {
        const blk = scheduleBlocks[slot.slotId]
        blockHtml += `<div style="position:absolute;top:${top}px;left:0;right:0;height:${rowH}px;border-bottom:1px solid #e2e4ef">${blk&&!blk.isDefault?renderBlk(blk,rowH):''}</div>`
      }
    })

    return `<div style="flex:1;min-width:${colW}px;${di>0?'border-left:2px solid #c8cade;':''}display:flex;position:relative"><div style="width:${TIME_W}px;flex-shrink:0;position:relative;height:${totalH}px;border-right:1px solid #c8cade">${timeAxisHtml}</div><div style="flex:1;position:relative;height:${totalH}px">${blockHtml}</div></div>`
  }).join('')

  const totalMinW = dates.length * colW

  // ── 툴팁 ────────────────────────────────────────────────────────────────
  const tipScript = `<div id="_tip" style="display:none;position:fixed;z-index:9999;background:#f0f1f7;border:1px solid #c8cade;border-radius:6px;padding:8px 10px;min-width:230px;max-width:300px;box-shadow:0 4px 16px rgba(0,0,0,.3);pointer-events:none;font-family:'Malgun Gothic',Arial,sans-serif;font-size:10px;color:#1a1d2e"></div>
<script>
(function(){
var tip=document.getElementById('_tip');
function r(s){return String(s==null?'-':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function row(l,v,c){return'<div style="display:flex;gap:8px;font-size:10px;margin-bottom:2px"><span style="color:#8b90ab;min-width:52px;flex-shrink:0">'+r(l)+'</span><span style="'+(c?'color:'+c+';font-weight:700':'')+';white-space:pre-wrap;word-break:break-all">'+r(v)+'</span></div>'}
function attachTip(el){
  el.addEventListener('mouseenter',function(){
    var d=JSON.parse(el.dataset.tip),h='';
    if(d.isComp){
      h='<div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:8px">⚔ 경쟁 중</div>';
      [d.item1,d.item2].filter(Boolean).forEach(function(it,i){
        h+='<div style="margin-bottom:6px;padding-bottom:6px'+(i===0?';border-bottom:1px solid #e2e4ef':'')+'"><div style="font-size:10px;font-weight:700;color:'+(i===0?'#1d4ed8':'#6d28d9')+';margin-bottom:3px">'+(i===0?'● 기존':'● 신규')+'</div>';
        [['상품',it.pgmCodeName],['팀',it.mdTeam||'-'],['거래형태',it.dealType||'-']].forEach(function(lr){h+='<div style="display:flex;gap:8px;font-size:10px"><span style="color:#8b90ab;min-width:46px">'+r(lr[0])+'</span><span>'+r(lr[1])+'</span></div>'});
        h+='</div>';
      });
    } else {
      [['팀',d.mdTeam],['채널',d.channel],['거래형태',d.dealType],['신상품구분',d.newProductType],['카테고리',d.mdCategory],['방송일시',(d.dateKey||'')+' '+(d.timeText||'')],['방송시간',(d.durationMin||'-')+'분'],['가중분',d.weightedMin],['메모코드',d.memoCode],['편성C',d.scheduleComment]].forEach(function(lr){h+=row(lr[0],lr[1])});
      if(d.annotation)h+=row('첨삭',d.annotation,'#d97706');
      if(d.lastPerf){
        h+='<div style="border-top:1px solid #e2e4ef;margin:6px 0"></div><div style="font-size:10px;font-weight:700;color:#8b90ab;margin-bottom:4px">직전 실적 ('+r(d.lastPerf.broadcastDate)+')</div>';
        h+=row('취급/분',Number(d.lastPerf.spw||0).toLocaleString(),'#4a6cf7');
        h+=row('한익/분',Number(d.lastPerf.ppw||0).toLocaleString(),'#16a34a');
      }
    }
    tip.innerHTML=h;tip.style.display='block';
    var rect=el.getBoundingClientRect();
    var tw=230,ah=d.isComp?150:(d.annotation?290:220);
    var left=rect.right+6+tw>window.innerWidth?rect.left-tw-6:rect.right+6;
    var top=Math.min(rect.top,window.innerHeight-ah-8);
    tip.style.left=left+'px';tip.style.top=top+'px';
  });
  el.addEventListener('mouseleave',function(){tip.style.display='none'});
}
document.querySelectorAll('.blk').forEach(attachTip);

// ── 조직 필터 ────────────────────────────────────────────────────────────
var sel=document.getElementById('_teamSel');
if(sel){
  sel.addEventListener('change',function(){
    var val=sel.value;
    document.querySelectorAll('.blk').forEach(function(el){
      var tm=el.dataset.team||'';
      el.style.opacity=(val===''||tm===val)?'1':'0.1';
    });
  });
}
})();
<\/script>`

  // ── 조직 필터 select ─────────────────────────────────────────────────────
  const allTeams = [...new Set(
    Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault)
      .map(b => b.mdTeam || b.orgName || '')
      .filter(Boolean)
  )].sort()
  const teamOptions = allTeams.map(t => `<option value="${t}">${t}</option>`).join('')
  const toolbar = forPrint ? '' : `<div style="height:36px;display:flex;align-items:center;padding:0 12px;gap:12px;border-bottom:1px solid #e2e4ef;background:#fff">
<span style="font-size:11px;color:#8b90ab">총 ${totalSlots}슬롯 · ${dates.length}일</span>
<div style="display:flex;align-items:center;gap:6px;margin-left:auto">
<label style="font-size:11px;color:#4a4f6e">조직 필터</label>
<select id="_teamSel" style="background:#f0f1f7;border:1px solid #e2e4ef;color:#1a1d2e;padding:3px 8px;border-radius:5px;font-size:11px">
<option value="">전체</option>${teamOptions}
</select>
</div>
</div>`

  return `<div style="border:1px solid #e2e4ef;border-radius:10px;overflow:hidden;background:#f5f6fa;margin-bottom:16px">
${toolbar}
<div style="overflow-x:auto">
<div style="min-width:${totalMinW}px;width:100%">
<div style="display:flex;height:36px;border-bottom:1px solid #e2e4ef;background:#fff">${headerCols}</div>
<div style="display:flex">${bodyCols}</div>
</div>
</div>
</div>
${forPrint ? '' : tipScript}`
}

// ── 시뮬레이션 ────────────────────────────────────────────────────────────
// PerformanceForecast.jsx 구조를 그대로 복제

function buildSimSection({ scheduleBlocks, pgmSlots, customSlots, splitSlots, perfMap, manualInputs, categoryMap, targetMetrics, weightedMinTargets }) {
  const { teamMap: teamTargetMap, companyTotal } = parseTargetMetrics(targetMetrics)

  const rows = Object.values(scheduleBlocks)
    .filter(b => b)
    .map(b => ({
      ...b,
      mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
      mdTeam: b.mdTeam || b.orgName || '미지정',
      ...calcForecastLocal(b, perfMap, manualInputs),
    }))
    .sort((a, b) => a.dateKey !== b.dateKey
      ? (a.dateKey || '').localeCompare(b.dateKey || '')
      : timeToMin(a.timeText) - timeToMin(b.timeText))

  const effectiveSlots = getEffectivePgmSlots(pgmSlots || [], customSlots || {})
  const totalSlotWm    = effectiveSlots.reduce((a, sl) => a + (sl.weightedMin || 0), 0)
  const totalSlotCount = effectiveSlots.reduce((sum, sl) => sum + (splitSlots?.[sl.slotId] ? 2 : 1), 0)

  const summary = rows.reduce((acc, r) => ({
    sales:  acc.sales  + r.expectedSales,
    profit: acc.profit + r.expectedProfit,
    wm:     acc.wm     + Number(r.weightedMin || 0),
  }), { sales: 0, profit: 0, wm: 0 })
  summary.salesPerMin  = summary.wm > 0 ? summary.sales  / summary.wm : 0
  summary.profitPerMin = summary.wm > 0 ? summary.profit / summary.wm : 0
  summary.missingCount = rows.filter(r => r.missingPerf).length
  summary.perfEnteredCount = rows.filter(r => !r.missingPerf).length
  summary.count = rows.length
  summary.totalSlotWm = totalSlotWm
  summary.scheduleRate = totalSlotWm > 0 ? (summary.wm / totalSlotWm * 100) : 0
  summary.perfRate = rows.length > 0 ? (summary.perfEnteredCount / rows.length * 100) : 0

  const salesAchieve  = companyTotal?.salesPerMin  > 0 ? summary.salesPerMin  / companyTotal.salesPerMin  * 100 : null
  const profitAchieve = companyTotal?.profitPerMin > 0 ? summary.profitPerMin / companyTotal.profitPerMin * 100 : null

  function effBarHtml(pct, color) {
    const clamp = Math.min(Math.max(pct || 0, 0), 100)
    const c = clamp >= 90 ? '#16a34a' : clamp >= 65 ? '#d97706' : '#dc2626'
    return `<div class="eff-bar-wrap"><div class="eff-bar-bg"><div class="eff-bar-fill" style="width:${clamp}%;background:${color||c}"></div></div><span class="eff-pct">${Math.round(clamp)}%</span></div>`
  }

  // HeroCards
  const heroSalesNote = salesAchieve != null
    ? `전사 목표 ${hf(companyTotal.salesPerMin)} · 달성률 ${Math.round(salesAchieve)}%`
    : `실적 입력률 ${Math.round(summary.perfRate)}% · 미입력 ${summary.missingCount}건`
  const heroProfitNote = profitAchieve != null
    ? `전사 목표 ${hf(companyTotal.profitPerMin)} · 달성률 ${Math.round(profitAchieve)}%`
    : `가중분 ${hf(summary.wm)} / 슬롯 ${summary.count}개`

  const heroCards = `<div class="hero-cards">
  <div class="hero">
    <div class="hero-lbl">분당 취급고 (예상)</div>
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
      <span class="hero-big" style="color:#4a6cf7">${hf(summary.salesPerMin)}</span>
      <span class="hero-sm">원/분</span>
    </div>
    <div class="hero-sub">총 ${hfs(summary.sales)} 취급고 예상</div>
    ${salesAchieve != null ? effBarHtml(salesAchieve, '#4a6cf7') : ''}
    <div class="hero-note">${heroSalesNote}</div>
  </div>
  <div class="hero">
    <div class="hero-lbl">분당 한계이익 (예상)</div>
    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
      <span class="hero-big" style="color:#16a34a">${hf(summary.profitPerMin)}</span>
      <span class="hero-sm">원/분</span>
    </div>
    <div class="hero-sub">총 ${hfs(summary.profit)} 한익 예상</div>
    ${profitAchieve != null ? effBarHtml(profitAchieve, '#16a34a') : ''}
    <div class="hero-note">${heroProfitNote}</div>
  </div>
</div>`

  // StatCards
  const tgtSales  = companyTotal?.salesPerMin  > 0 ? companyTotal.salesPerMin  * totalSlotWm : null
  const tgtProfit = companyTotal?.profitPerMin > 0 ? companyTotal.profitPerMin * totalSlotWm : null
  const salesPct  = tgtSales  > 0 ? summary.sales  / tgtSales  * 100 : null
  const profitPct = tgtProfit > 0 ? summary.profit / tgtProfit * 100 : null

  const statCards = `<div class="cards">
  <div class="card"><div class="cl">총 예상취급고</div><div class="cv" style="color:#4a6cf7">${hfs(summary.sales)}</div>${salesPct != null ? `<div class="cs">목표 ${hfs(tgtSales)} · ${Math.round(salesPct)}%</div>` : ''}</div>
  <div class="card"><div class="cl">총 예상한익</div><div class="cv" style="color:#16a34a">${hfs(summary.profit)}</div>${profitPct != null ? `<div class="cs">목표 ${hfs(tgtProfit)} · ${Math.round(profitPct)}%</div>` : ''}</div>
  <div class="card"><div class="cl">편성 슬롯</div><div class="cv">${summary.count} / ${totalSlotCount}</div><div class="cs">가중분 ${hf(summary.wm)}</div></div>
  <div class="card"><div class="cl">실적 입력</div><div class="cv">${summary.perfEnteredCount}건</div><div class="cs">${Math.round(summary.perfRate)}%</div></div>
  <div class="card ${summary.missingCount > 0 ? 'warn' : ''}"><div class="cl ${summary.missingCount > 0 ? 'warn' : ''}">미입력 실적</div><div class="cv" style="color:${summary.missingCount > 0 ? '#dc2626' : '#1a1d2e'}">${summary.missingCount}건</div><div class="cs">직전 실적 없음</div></div>
</div>`

  // 팀별 볼륨 바
  const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316','#84cc16','#94a3b8']
  const teamAgg = {}
  rows.forEach(r => {
    const t = r.mdTeam
    if (!teamAgg[t]) teamAgg[t] = { name: t, sales: 0, profit: 0, wm: 0, count: 0 }
    teamAgg[t].sales  += r.expectedSales
    teamAgg[t].profit += r.expectedProfit
    teamAgg[t].wm     += Number(r.weightedMin || 0)
    teamAgg[t].count  += 1
  })
  const teams = Object.values(teamAgg).sort((a, b) => b.sales - a.sales).filter(g => g.sales > 0 || g.profit > 0)
  const totalSalesVol  = teams.reduce((s, g) => s + g.sales, 0)
  const totalProfitVol = teams.reduce((s, g) => s + g.profit, 0)

  let volBarHtml = ''
  if (teams.length) {
    const makeSeg = (getValue, total) => teams.map((g, i) => {
      const v = getValue(g), pct = total > 0 ? v / total * 100 : 0
      return `<div title="${g.name}: ${hfs(v)} (${pct.toFixed(1)}%)" style="flex:${v||0};background:${COLORS[i%COLORS.length]};display:flex;align-items:center;justify-content:center;overflow:hidden">${pct > 6 ? `<span style="font-size:8px;color:#fff;font-weight:700;white-space:nowrap;padding:0 3px">${g.name.replace('팀','')}</span>` : ''}</div>`
    }).join('')
    const legendItems = teams.map((g, i) => `<span style="font-size:8px;color:#8b90ab;display:flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:2px;background:${COLORS[i%COLORS.length]};display:inline-block"></span>${g.name}</span>`).join('')

    volBarHtml = `<div style="margin-bottom:20px">
  <div style="font-size:11px;font-weight:700;color:#8b90ab;letter-spacing:.3px;margin-bottom:8px">팀별 볼륨 비중</div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="background:#fff;border:1px solid #e2e4ef;border-radius:10px;padding:10px 14px">
      <div style="font-size:10px;font-weight:700;color:#4a6cf7;margin-bottom:8px">취급고</div>
      <div style="display:flex;height:22px;border-radius:4px;overflow:hidden;gap:1px">${makeSeg(g=>g.sales, totalSalesVol)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:6px">${legendItems}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e4ef;border-radius:10px;padding:10px 14px">
      <div style="font-size:10px;font-weight:700;color:#16a34a;margin-bottom:8px">한계이익</div>
      <div style="display:flex;height:22px;border-radius:4px;overflow:hidden;gap:1px">${makeSeg(g=>g.profit, totalProfitVol)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:6px">${legendItems}</div>
    </div>
  </div>
</div>`
  }

  // 일자별 테이블 (BarChart 대체)
  const dailyMap = {}
  rows.forEach(r => {
    const d = r.dateKey || '?'
    if (!dailyMap[d]) dailyMap[d] = { date: d, sales: 0, profit: 0, wm: 0 }
    dailyMap[d].sales  += r.expectedSales
    dailyMap[d].profit += r.expectedProfit
    dailyMap[d].wm     += Number(r.weightedMin || 0)
  })
  const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
  const avgDailySpm  = dailyData.reduce((s, d) => s + (d.wm > 0 ? d.sales  / d.wm * d.wm : 0), 0) / Math.max(dailyData.reduce((s, d) => s + d.wm, 0), 1)
  const avgDailyPpm  = dailyData.reduce((s, d) => s + (d.wm > 0 ? d.profit / d.wm * d.wm : 0), 0) / Math.max(dailyData.reduce((s, d) => s + d.wm, 0), 1)

  const dailyRows = dailyData.map(d => {
    const spm = d.wm > 0 ? Math.round(d.sales  / d.wm) : 0
    const ppm = d.wm > 0 ? Math.round(d.profit / d.wm) : 0
    return `<tr>
      <td>${d.date}</td>
      <td class="r" style="color:#4a6cf7;font-weight:600">${hf(spm)}</td>
      <td class="r" style="color:#16a34a;font-weight:600">${hf(ppm)}</td>
      <td class="r">${hfs(d.sales)}</td>
      <td class="r">${hfs(d.profit)}</td>
      <td class="r" style="color:#8b90ab">${hf(d.wm)}</td>
    </tr>`
  }).join('')

  // 팀별 관점 테이블 (BarChart 대체)
  const wmTargetMap = {}
  ;(weightedMinTargets || []).forEach(t => {
    const n = (t.teamName || '').trim()
    if (n) { wmTargetMap[n] = t.weeklyTarget; wmTargetMap[n.endsWith('팀') ? n.slice(0,-1) : n + '팀'] = t.weeklyTarget }
  })
  const avgGroupSpm  = summary.wm > 0 ? Math.round(Object.values(teamAgg).reduce((s, g) => s + g.sales,  0) / summary.wm) : 0
  const avgGroupPpm  = summary.wm > 0 ? Math.round(Object.values(teamAgg).reduce((s, g) => s + g.profit, 0) / summary.wm) : 0

  const teamRows = Object.values(teamAgg)
    .sort((a, b) => b.sales - a.sales)
    .map(g => {
      const spm = g.wm > 0 ? Math.round(g.sales  / g.wm) : 0
      const ppm = g.wm > 0 ? Math.round(g.profit / g.wm) : 0
      const tgt = teamTargetMap[g.name] || {}
      const effSpm = tgt.salesPerMin  > 0 ? tgt.salesPerMin  : (companyTotal?.salesPerMin  || avgGroupSpm)
      const effPpm = tgt.profitPerMin > 0 ? tgt.profitPerMin : (companyTotal?.profitPerMin || avgGroupPpm)
      const sAch = effSpm > 0 ? Math.round(spm / effSpm * 100) : null
      const pAch = effPpm > 0 ? Math.round(ppm / effPpm * 100) : null
      return `<tr>
        <td style="font-weight:600">${g.name}</td>
        <td class="r">${g.count}</td>
        <td class="r" style="color:#8b90ab">${hf(g.wm)}</td>
        <td class="r" style="color:#4a6cf7;font-weight:600">${hf(spm)}</td>
        <td class="r" style="color:#8b90ab">${effSpm > 0 ? hf(effSpm) : '-'}</td>
        <td class="r" style="color:${sAch != null ? (sAch >= 100 ? '#16a34a' : '#dc2626') : '#8b90ab'};font-weight:700">${sAch != null ? sAch + '%' : '-'}</td>
        <td class="r" style="color:#16a34a;font-weight:600">${hf(ppm)}</td>
        <td class="r" style="color:#8b90ab">${effPpm > 0 ? hf(effPpm) : '-'}</td>
        <td class="r" style="color:${pAch != null ? (pAch >= 100 ? '#16a34a' : '#dc2626') : '#8b90ab'};font-weight:700">${pAch != null ? pAch + '%' : '-'}</td>
        <td class="r">${hfs(g.sales)}</td>
        <td class="r">${hfs(g.profit)}</td>
      </tr>`
    }).join('')

  // 미입력 실적 테이블
  const missingRows2 = rows.filter(r => r.missingPerf)
  const missingSection = missingRows2.length > 0 ? `
<div style="background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.3);border-radius:10px;overflow:hidden;margin-bottom:16px">
  <div style="padding:10px 16px;border-bottom:1px solid rgba(220,38,38,.2)">
    <span style="font-size:12px;font-weight:700;color:#dc2626">⚠ 직전 실적 미확인 ${missingRows2.length}건</span>
    <span style="font-size:10px;color:#8b90ab;margin-left:8px">예상값이 0으로 계산됩니다</span>
  </div>
  <table>
    <thead><tr>
      <th>일자</th><th>시간</th><th class="c">채널</th><th>팀</th><th>편성코드명</th><th>거래형태</th><th>신상품구분</th><th class="r">가중분</th>
    </tr></thead>
    <tbody>${missingRows2.map(r => `<tr>
      <td>${r.dateKey}</td><td>${r.timeText}</td><td class="c">${chBadge(r.channel)}</td>
      <td style="font-weight:600">${r.mdTeam}</td><td>${r.pgmCodeName||'-'}</td>
      <td>${r.dealTypeConverted||r.dealType||'-'}</td><td>${r.newProductType||'기존'}</td>
      <td class="r">${hf(r.weightedMin)}</td>
    </tr>`).join('')}</tbody>
  </table>
</div>` : ''

  // 상세 테이블
  const detailRows = rows.map(r => {
    const cls = r.missingPerf ? ' class="missing-row"' : ''
    return `<tr${cls}>
      <td>${r.dateKey}</td>
      <td>${r.timeText}</td>
      <td class="c">${chBadge(r.channel)}</td>
      <td style="color:#8b90ab">${r.mdCategory}</td>
      <td style="font-weight:600">${r.mdTeam}</td>
      <td>${r.missingPerf ? '<span style="font-size:9px;background:#dc2626;color:#fff;padding:1px 4px;border-radius:3px;margin-right:3px">미입력</span>' : ''}${r.pgmCodeName||'-'}</td>
      <td>${r.dealTypeConverted||r.dealType||'-'}</td>
      <td>${r.newProductType||'기존'}</td>
      <td class="r">${hf(r.weightedMin)}</td>
      <td class="r" style="color:#8b90ab">${r.lastPerf ? hf(r.lastPerf.salesPerWeightedMin) : '<span style="color:#dc2626;font-size:10px">없음</span>'}</td>
      <td class="r" style="color:#8b90ab">${r.lastPerf ? hf(r.lastPerf.profitPerWeightedMin) : '<span style="color:#dc2626;font-size:10px">없음</span>'}</td>
      <td class="r" style="color:#4a6cf7;font-weight:600">${r.salesPerMin != null ? hf(r.salesPerMin) : '-'}</td>
      <td class="r" style="color:#16a34a;font-weight:600">${r.profitPerMin != null ? hf(r.profitPerMin) : '-'}</td>
      <td class="r" style="font-weight:700">${hfs(r.expectedSales)}</td>
      <td class="r" style="font-weight:700">${hfs(r.expectedProfit)}</td>
    </tr>`
  }).join('')

  return `${heroCards}
${statCards}
${volBarHtml}
<div class="sec">
  <div class="sec-title">전사 일자별 분당취급고 / 분당한익 <span style="font-size:10px;font-weight:400;color:#8b90ab">— 평균(취급 ${hf(avgDailySpm)} / 한익 ${hf(avgDailyPpm)})</span></div>
  <table>
    <thead><tr>
      <th>일자</th><th class="r">분당취급고</th><th class="r">분당한익</th><th class="r">예상취급고</th><th class="r">예상한익</th><th class="r">가중분</th>
    </tr></thead>
    <tbody>${dailyRows || '<tr><td colspan="6" style="text-align:center;color:#8b90ab;padding:12px">데이터 없음</td></tr>'}</tbody>
  </table>
</div>
<div class="sec">
  <div class="sec-title">팀별 관점 <span style="font-size:10px;font-weight:400;color:#8b90ab">— 편성 vs 목표(미설정→전사목표)</span></div>
  <table>
    <thead><tr>
      <th>팀</th><th class="r">슬롯</th><th class="r">가중분</th>
      <th class="r">분당취급고</th><th class="r">목표</th><th class="r">달성률</th>
      <th class="r">분당한익</th><th class="r">목표</th><th class="r">달성률</th>
      <th class="r">예상취급고</th><th class="r">예상한익</th>
    </tr></thead>
    <tbody>${teamRows || '<tr><td colspan="11" style="text-align:center;color:#8b90ab;padding:12px">데이터 없음</td></tr>'}</tbody>
  </table>
</div>
${missingSection}
<div class="sec">
  <div class="sec-title">편성별 실적 상세</div>
  <table>
    <thead><tr>
      <th>일자</th><th>시간</th><th class="c">채널</th><th>카테고리</th><th>팀</th>
      <th>편성코드명</th><th>거래형태</th><th>신상품구분</th><th class="r">가중분</th>
      <th class="r">직전취급/분</th><th class="r">직전한익/분</th>
      <th class="r">예상취급/분</th><th class="r">예상한익/분</th>
      <th class="r">예상취급고</th><th class="r">예상한익</th>
    </tr></thead>
    <tbody>${detailRows || '<tr><td colspan="15" style="text-align:center;color:#8b90ab;padding:12px">데이터 없음</td></tr>'}</tbody>
  </table>
</div>`
}

// ── 편성비중 ──────────────────────────────────────────────────────────────
// ScheduleRatio → RatioSummaryCards + RatioTable + RatioPgmCount 구조 복제

function buildRatioSection({ scheduleBlocks, pgmSlots, weightedMinTargets, categoryMap, perfMap, manualInputs }) {
  const totalSlotWeighted = (pgmSlots || []).reduce((s, sl) => s + (sl.weightedMin || 0), 0)

  const enrichedBlocks = {}
  Object.entries(scheduleBlocks).forEach(([key, block]) => {
    enrichedBlocks[key] = { ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류' }
  })

  // 팀별 / 카테고리별 stats
  const statsTeam = calcRatioStats(enrichedBlocks, categoryMap, 'team')
  const statsCat  = calcRatioStats(enrichedBlocks, categoryMap, 'category')

  const targetMap = {}
  ;(weightedMinTargets || []).forEach(t => {
    const name = (t.teamName || '').trim()
    targetMap[name] = t.weeklyTarget
    const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
    targetMap[alt] = t.weeklyTarget
  })
  const totalTarget = totalSlotWeighted

  const scheduledCount = Object.values(scheduleBlocks).filter(b => !b.isDefault).length

  // ── RatioSummaryCards (5개) ─────────────────────────────────────────────
  const achievePct = totalTarget > 0 ? Math.round(statsTeam.totalWeighted / totalTarget * 100) : null
  const achieveColor = statsTeam.totalWeighted >= totalTarget && totalTarget > 0 ? '#16a34a' : '#d97706'

  const summaryCards = `<div class="cards">
  <div class="card"><div class="cl">총 편성 가중분</div><div class="cv" style="color:#4a6cf7">${hf(statsTeam.totalWeighted)}</div></div>
  <div class="card"><div class="cl">주간 슬롯 가중분</div><div class="cv" style="color:#4a4f6e">${hf(totalSlotWeighted)}</div></div>
  <div class="card"><div class="cl">전체 달성률</div><div class="cv" style="color:${achieveColor}">${achievePct != null ? achievePct + '%' : '-'}</div></div>
  <div class="card"><div class="cl">경쟁 가중분</div><div class="cv" style="color:#dc2626">${hf(statsTeam.competingWeighted)}</div></div>
  <div class="card"><div class="cl">편성 완료 슬롯</div><div class="cv" style="color:#16a34a">${scheduledCount}</div></div>
</div>`

  // ── RatioTable 함수 ─────────────────────────────────────────────────────
  const TEAM_COLORS_HTML = ['#818cf8','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#4ade80','#f87171','#fbbf24','#2dd4bf']

  function buildRatioTable(stats, showTarget) {
    const sorted = Object.entries(stats.group).sort((a, b) => {
      if (a[0] === '편성팀') return 1
      if (b[0] === '편성팀') return -1
      return b[1] - a[1]
    })
    const colorMap = {}
    sorted.forEach(([name], i) => {
      colorMap[name] = name === '편성팀' ? '#94a3b8' : name === '경쟁' ? '#dc2626' : TEAM_COLORS_HTML[i % TEAM_COLORS_HTML.length]
    })

    const extraTh = showTarget ? '<th class="r">목표 가중분</th><th class="r">목표 비중</th><th style="min-width:180px">달성률</th>' : ''
    const rows = sorted.map(([name, weighted], i) => {
      const target     = showTarget ? (targetMap[name] || 0) : 0
      const totalPct   = stats.totalWeighted > 0 ? (weighted / stats.totalWeighted * 100) : 0
      const targetPct  = totalSlotWeighted > 0 && target > 0 ? (target / totalSlotWeighted * 100) : 0
      const achievePct2 = target > 0 ? (weighted / target * 100) : null
      const isDefault  = name === '편성팀'
      const isCompeting = name === '경쟁'
      const teamColor  = colorMap[name]
      const dm         = stats.groupDm[name] || 0
      const avgRate    = dm > 0 ? (weighted / dm * 100).toFixed(1) + '%' : '-'
      const rowBg      = i % 2 === 0 ? '' : 'background:#fafafa'

      const dot = (!isDefault && !isCompeting)
        ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${teamColor};margin-right:8px;vertical-align:middle"></span>`
        : ''
      const nameSpan = `<span style="font-weight:600;color:${isCompeting?'#dc2626':isDefault?'#8b90ab':'#1a1d2e'}">${isCompeting?'⚔ ':isDefault?'◻ ':''}${name}</span>`

      let achieveCell = ''
      if (showTarget) {
        if (achievePct2 !== null) {
          const barColor = achievePct2 >= 100 ? '#16a34a' : achievePct2 >= 80 ? '#d97706' : teamColor
          const textColor = achievePct2 >= 100 ? '#16a34a' : achievePct2 >= 80 ? '#d97706' : '#dc2626'
          achieveCell = `<td>
            <div class="bar-wrap">
              <div class="bar-bg"><div style="width:${Math.min(achievePct2,100)}%;height:100%;border-radius:3px;background:${barColor}"></div></div>
              <span style="font-size:11px;min-width:40px;text-align:right;font-weight:700;color:${textColor}">${Math.round(achievePct2)}%</span>
            </div>
          </td>`
        } else {
          achieveCell = '<td>-</td>'
        }
      }

      return `<tr style="${rowBg}">
        <td>${dot}${nameSpan}</td>
        <td class="r" style="font-weight:700;color:${isDefault?'#8b90ab':teamColor}">${hf(weighted)}</td>
        <td class="r" style="color:#4a4f6e">${dm > 0 ? dm.toLocaleString() : '-'}</td>
        <td class="r" style="color:#8b90ab">${avgRate}</td>
        <td class="r" style="color:#4a4f6e">${totalPct.toFixed(1)}%</td>
        ${showTarget ? `<td class="r">${target > 0 ? hf(target) : '-'}</td><td class="r">${targetPct > 0 ? targetPct.toFixed(1)+'%' : '-'}</td>${achieveCell}` : ''}
      </tr>`
    }).join('')

    const totalAchievePct = showTarget && totalTarget > 0 ? (stats.totalWeighted / totalTarget * 100) : null
    const totalAchieveCell = showTarget ? (totalAchievePct !== null ? `<td>
      <div class="bar-wrap">
        <div class="bar-bg"><div style="width:${Math.min(totalAchievePct,100)}%;height:100%;border-radius:3px;background:#4a6cf7"></div></div>
        <span style="font-size:11px;min-width:40px;text-align:right;font-weight:700;color:${stats.totalWeighted>=totalTarget?'#16a34a':'#d97706'}">${Math.round(totalAchievePct)}%</span>
      </div>
    </td>` : '<td>-</td>') : ''

    const totalRow = `<tr class="total-row">
      <td>합계</td>
      <td class="r" style="color:#4a6cf7">${hf(stats.totalWeighted)}</td>
      <td class="r">${(stats.totalDm||0) > 0 ? stats.totalDm.toLocaleString() : '-'}</td>
      <td class="r">${(stats.totalDm||0) > 0 ? (stats.totalWeighted/stats.totalDm*100).toFixed(1)+'%' : '-'}</td>
      <td class="r">100%</td>
      ${showTarget ? `<td class="r">${totalTarget > 0 ? hf(totalTarget) : '-'}</td><td class="r">${totalSlotWeighted > 0 && totalTarget > 0 ? (totalTarget/totalSlotWeighted*100).toFixed(1)+'%' : '-'}</td>${totalAchieveCell}` : ''}
    </tr>`

    return `<table>
      <thead><tr>
        <th>구분</th><th class="r">편성 가중분</th><th class="r">단순분</th><th class="r">평균 가중률</th><th class="r">편성 비중</th>
        ${extraTh}
      </tr></thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>`
  }

  // ── RatioPgmCount (3개 피벗 테이블) ────────────────────────────────────
  const allBlocks = Object.values(enrichedBlocks).filter(b => b && !b.isDefault)

  function getExpectedForBlock(b) {
    const key = b.perfKey
    if (!key) return { sp: 0, pp: 0, hasPerf: false }
    const m  = (manualInputs || {})[key] || {}
    const p  = (perfMap || {})[key]      || {}
    const sp = Number(m.expectedSalesPerWeightedMin  ?? p.salesPerWeightedMin  ?? 0)
    const pp = Number(m.expectedProfitPerWeightedMin ?? p.profitPerWeightedMin ?? 0)
    return { sp, pp, hasPerf: sp > 0 || pp > 0 }
  }

  function buildPivotTable(title, colLabel, colKeyFn, colRenderer) {
    const piv = {}
    allBlocks.forEach(b => {
      const rk = b.mdTeam || b.orgName || '미지정'
      const ck = colKeyFn(b)
      if (!piv[rk])     piv[rk]     = {}
      if (!piv[rk][ck]) piv[rk][ck] = { count: 0, wm: 0, perfWm: 0, sales: 0, profit: 0, perfCount: 0 }
      const { sp, pp, hasPerf } = getExpectedForBlock(b)
      const wm = b.weightedMin || 0
      piv[rk][ck].count += 1
      piv[rk][ck].wm    += wm
      if (hasPerf) {
        piv[rk][ck].perfWm    += wm
        piv[rk][ck].sales     += wm * sp
        piv[rk][ck].profit    += wm * pp
        piv[rk][ck].perfCount += 1
      }
    })

    const present = new Set(Object.values(piv).flatMap(r => Object.keys(r)))
    const extra   = [...present].filter(k => !colLabel.includes(k))
    const allCols = [...colLabel.filter(c => present.has(c)), ...extra]

    const rowOrder = Object.keys(piv).sort((a, b) =>
      Object.values(piv[b]).reduce((s, v) => s + v.count, 0) -
      Object.values(piv[a]).reduce((s, v) => s + v.count, 0)
    )

    const sum = (col, key) => rowOrder.reduce((s, r) => s + (piv[r]?.[col]?.[key] || 0), 0)
    const colTotals = allCols.map(c => {
      const count = sum(c, 'count'), wm = sum(c, 'wm'), perfWm = sum(c, 'perfWm')
      const sales = sum(c, 'sales'), profit = sum(c, 'profit'), perfCount = sum(c, 'perfCount')
      return { count, wm, perfWm, sales, profit, perfCount,
        avgSp: perfWm > 0 ? Math.round(sales  / perfWm) : 0,
        avgPp: perfWm > 0 ? Math.round(profit / perfWm) : 0,
      }
    })

    const grandCount = colTotals.reduce((s, t) => s + t.count, 0)
    const grandWm    = colTotals.reduce((s, t) => s + t.wm, 0)
    const grandPerfWm    = colTotals.reduce((s, t) => s + t.perfWm, 0)
    const grandSales     = colTotals.reduce((s, t) => s + t.sales, 0)
    const grandProfit    = colTotals.reduce((s, t) => s + t.profit, 0)
    const grandPerfCount = colTotals.reduce((s, t) => s + t.perfCount, 0)
    const grand = {
      count: grandCount, wm: grandWm, perfCount: grandPerfCount,
      avgSp: grandPerfWm > 0 ? Math.round(grandSales  / grandPerfWm) : 0,
      avgPp: grandPerfWm > 0 ? Math.round(grandProfit / grandPerfWm) : 0,
    }
    const showPerf = grandSales > 0 || grandProfit > 0

    function cellHtml(count, wm, avgSp, avgPp, showPerf) {
      if (count === 0) return `<div style="text-align:center;color:#e2e4ef">-</div>`
      return `<div style="text-align:center;line-height:1.6">
        <div style="font-weight:700;font-size:12px">${count}건</div>
        <div style="font-size:9px;color:#8b90ab">${wm.toLocaleString()}분</div>
        ${showPerf ? `<div style="font-size:9px;color:${avgSp>0||avgPp>0?'#16a34a':'#e2e4ef'};font-weight:${avgSp>0?600:400}">${avgSp>0||avgPp>0?`${avgSp.toLocaleString()} / ${avgPp.toLocaleString()}`:'-'}</div>` : ''}
      </div>`
    }

    function rowCellHtml(row, col) {
      const d = piv[row]?.[col]
      if (!d) return cellHtml(0, 0, 0, 0, showPerf)
      const avgSp = d.perfWm > 0 ? Math.round(d.sales  / d.perfWm) : 0
      const avgPp = d.perfWm > 0 ? Math.round(d.profit / d.perfWm) : 0
      return cellHtml(d.count, d.wm, avgSp, avgPp, showPerf)
    }

    const thStyle = 'padding:8px 12px;font-size:11px;font-weight:700;color:#1a1d2e;text-align:center;background:#e8eaf2;border-bottom:2px solid #4a6cf7;border-right:1px solid #e2e4ef;white-space:nowrap'
    const headerRow = `<tr>
      <th style="${thStyle};text-align:left;padding-left:16px;min-width:80px">팀</th>
      ${allCols.map(c => `<th style="${thStyle};min-width:90px">${colRenderer ? colRenderer(c) : c}</th>`).join('')}
      <th style="${thStyle};background:rgba(74,108,247,.18);color:#4a6cf7;border-right:none">합계</th>
    </tr>`

    const bodyRows = rowOrder.map((row, i) => {
      const rs = { count: 0, wm: 0, perfWm: 0, sales: 0, profit: 0, perfCount: 0 }
      allCols.forEach(c => {
        const d = piv[row]?.[c]
        if (d) { rs.count += d.count; rs.wm += d.wm; rs.perfWm += d.perfWm; rs.sales += d.sales; rs.profit += d.profit; rs.perfCount += d.perfCount }
      })
      const rsAvgSp = rs.perfWm > 0 ? Math.round(rs.sales  / rs.perfWm) : 0
      const rsAvgPp = rs.perfWm > 0 ? Math.round(rs.profit / rs.perfWm) : 0
      const stripe = i % 2 === 1 ? 'background:#f8f9ff' : ''
      return `<tr style="${stripe};border-bottom:1px solid #e2e4ef">
        <td style="padding:6px 16px;font-weight:600;color:#1a1d2e;white-space:nowrap;vertical-align:middle;border-right:2px solid #e2e4ef">${row}</td>
        ${allCols.map(c => `<td style="padding:4px 8px;vertical-align:middle;border-right:1px solid #e2e4ef">${rowCellHtml(row, c)}</td>`).join('')}
        <td style="padding:4px 8px;vertical-align:middle;background:rgba(74,108,247,.06)">${cellHtml(rs.count, rs.wm, rsAvgSp, rsAvgPp, showPerf)}</td>
      </tr>`
    }).join('')

    const totalRow = `<tr style="border-top:2px solid #4a6cf7;background:#e8eaf2">
      <td style="padding:6px 16px;font-weight:800;font-size:11px;border-right:2px solid #e2e4ef">합 계</td>
      ${colTotals.map(t => `<td style="padding:4px 8px;vertical-align:middle;border-right:1px solid #e2e4ef">${cellHtml(t.count, t.wm, t.avgSp, t.avgPp, showPerf)}</td>`).join('')}
      <td style="padding:4px 8px;vertical-align:middle;background:rgba(74,108,247,.08)">${cellHtml(grand.count, grand.wm, grand.avgSp, grand.avgPp, showPerf)}</td>
    </tr>`

    const headerBig = `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:${showPerf?'5px':'0'}">
      <span style="font-size:13px;font-weight:800;color:#1a1d2e">${title}</span>
      <span style="font-size:22px;font-weight:800;color:#4a6cf7;line-height:1">${grand.count}</span>
      <span style="font-size:11px;color:#8b90ab">건</span>
    </div>`
    const headerPerf = showPerf ? `<div style="font-size:11px;color:#16a34a;font-weight:700">취급/분 ${grand.avgSp.toLocaleString()} · 이익/분 ${grand.avgPp.toLocaleString()} <span style="font-size:10px;color:#4a6cf7;font-weight:600;margin-left:8px">실적 입력 ${grand.perfCount}건 기준</span><span style="font-size:10px;color:#8b90ab;margin-left:4px">/ 미입력 ${grand.count-grand.perfCount}건</span></div>` : ''

    return `<div style="background:#fff;border:1px solid #e2e4ef;border-radius:10px;overflow:hidden;margin-bottom:12px">
      <div style="padding:12px 16px;background:#f0f1f7;border-bottom:2px solid #4a6cf7">${headerBig}${headerPerf}</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>${headerRow}</thead>
          <tbody>${bodyRows}${totalRow}</tbody>
        </table>
      </div>
    </div>`
  }

  const CH_ORDER = ['CA', 'IP', 'ALL']
  const DT_ORDER = ['[위]', '[직]', '[혼]', '[모]', '[액]', '[률]']
  const VS_ORDER = ['기존', '재녹화', '재편집', '신상품']

  const chRenderer = c => {
    const bg = c==='CA'?HC.ca:c==='IP'?HC.ip:HC.all
    const col = c==='CA'?HC.caT:c==='IP'?HC.ipT:HC.allT
    return `<span style="font-size:10px;padding:1px 7px;border-radius:3px;font-weight:700;background:${bg};color:${col}">${c}</span>`
  }

  const pgmCountSection = `<div style="margin-top:20px;border:1px solid #e2e4ef;border-radius:10px;overflow:hidden">
    <div style="padding:9px 16px;background:#fff;border-bottom:1px solid #e2e4ef">
      <span style="font-size:11px;font-weight:700">PGM 건수 현황</span>
      <span style="font-size:12px;font-weight:800;color:#4a6cf7;margin-left:8px">${allBlocks.length}</span>
      <span style="font-size:10px;color:#8b90ab">건</span>
    </div>
    <div style="padding:12px 16px;background:#f5f6fa;display:flex;flex-direction:column;gap:12px">
      ${buildPivotTable('채널별', CH_ORDER, b => CH_ORDER.includes(b.channel) ? b.channel : 'ALL', chRenderer)}
      ${buildPivotTable('거래형태별', DT_ORDER, b => b.dealTypeConverted || b.dealType || '미지정', null)}
      ${buildPivotTable('영상구분별', VS_ORDER, b => b.newProductType || '기존', null)}
    </div>
  </div>`

  return `${summaryCards}
<div class="sec" style="margin-bottom:16px">
  <div class="sec-title">팀별 편성비중</div>
  ${buildRatioTable(statsTeam, true)}
</div>
<div class="sec" style="margin-bottom:16px">
  <div class="sec-title">카테고리별 편성비중</div>
  ${buildRatioTable(statsCat, false)}
</div>
${pgmCountSection}`
}

// ── 편성현황 ──────────────────────────────────────────────────────────────
// ScheduleStatus → GradeDonutChart(→ grade summary table) + StatusScheduled + StatusUnscheduled

function buildStatusSection({ scheduleBlocks, proposalItems, perfMap, manualInputs, categoryMap }) {
  const GRADES = ['S', 'A', 'B', 'C', 'D']

  // enrichedBlocks (경쟁 제외)
  const enrichedBlocks = Object.values(scheduleBlocks)
    .filter(b => !b.isDefault && !b.isCompeting)
    .map(b => ({
      ...b,
      mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
      _grade: getGrade(getEffectiveProfit(b, perfMap, manualInputs)),
      _team:  b.mdTeam || b.orgName || '미지정',
    }))
    .sort((a, b) => a.dateKey !== b.dateKey
      ? (a.dateKey || '').localeCompare(b.dateKey || '')
      : timeToMin(a.timeText) - timeToMin(b.timeText))

  const competingBlocks = Object.values(scheduleBlocks)
    .filter(b => !b.isDefault && b.isCompeting)

  const enrichedItems = (proposalItems || []).map(i => ({
    ...i,
    _grade: getGrade(getEffectiveProfit(i, perfMap, manualInputs)),
    _team:  i.mdTeam || i.team || '미지정',
  }))

  // 등급 요약 (도넛 → 테이블로 대체)
  const allForChart = [...enrichedBlocks, ...enrichedItems]
  const gradeSummaryRows = GRADES.map(g => {
    const inAll  = allForChart.filter(i => i._grade === g)
    const inSch  = enrichedBlocks.filter(i => i._grade === g)
    const inUns  = enrichedItems.filter(i => i._grade === g)
    return `<tr>
      <td>${gBadge(g)}</td>
      <td class="c" style="font-weight:700;color:${GC[g]||'#6b7280'}">${inAll.length}</td>
      <td class="c">${inSch.length}</td>
      <td class="c">${inUns.length}</td>
    </tr>`
  }).join('')

  const gradeSection = `<div class="sec" style="margin-bottom:16px">
  <div class="sec-title">전체 상품 등급 분포 <span style="font-size:10px;font-weight:400;color:#8b90ab">— 한계이익/가중분 기준</span></div>
  <table style="max-width:360px">
    <thead><tr>
      <th>등급</th><th class="c">전체</th><th class="c">편성완료</th><th class="c">미편성</th>
    </tr></thead>
    <tbody>${gradeSummaryRows}</tbody>
    <tfoot><tr class="total-row">
      <td>합계</td>
      <td class="c">${allForChart.length}</td>
      <td class="c">${enrichedBlocks.length}</td>
      <td class="c">${enrichedItems.length}</td>
    </tr></tfoot>
  </table>
</div>`

  // ── StatusScheduled ──────────────────────────────────────────────────────
  const allScheduled = [...enrichedBlocks, ...competingBlocks]
  const scheduledRows = allScheduled.map((block, i) => {
    const isCompeting = block.isCompeting
    const grade = block._grade || getGrade(getEffectiveProfit(block, perfMap, manualInputs))
    const statusBadge = isCompeting
      ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#dc2626;font-weight:700">경쟁</span>`
      : block.isPreSchedule
      ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#e8eaf2;color:#8b90ab;font-weight:700">선편성</span>`
      : `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#f0fdf4;color:#16a34a;font-weight:700">편성</span>`
    const rowBg = i % 2 !== 0 ? 'background:#fafafa' : ''
    return `<tr style="${rowBg}">
      <td class="c">${!isCompeting ? gBadge(grade) : '-'}</td>
      <td style="color:#4a4f6e">${block.dateKey||'-'}</td>
      <td style="font-weight:600">${block.timeText||'-'}</td>
      <td class="c">${chBadge(block.channel||'ALL')}</td>
      <td style="color:#4a4f6e">${block.mdTeam||block.orgName||'-'}</td>
      <td style="color:#8b90ab;font-size:11px">${block.mdCategory||'-'}</td>
      <td style="${isCompeting?'color:#dc2626;font-weight:700':''}max-width:200px;overflow:hidden;text-overflow:ellipsis">${isCompeting?'⚔ ':''}${block.pgmCodeName||'-'}</td>
      <td class="r" style="font-weight:700;color:#4a6cf7">${hf(block.weightedMin)}</td>
      <td style="color:#8b90ab;font-size:11px">${block.memoCode||'-'}</td>
      <td style="color:#8b90ab;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${block.scheduleComment||'-'}</td>
      <td class="c">${statusBadge}</td>
    </tr>`
  }).join('')

  // ── StatusUnscheduled ────────────────────────────────────────────────────
  const unscheduledRows = enrichedItems.map((item, i) => {
    const grade = item._grade
    const nptBadge = item.newProductType
      ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef9c3;color:#854d0e;font-weight:700">${item.newProductType}</span>`
      : '-'
    const rowBg = i % 2 !== 0 ? 'background:#fafafa' : ''
    return `<tr style="${rowBg}">
      <td class="c">${gBadge(grade)}</td>
      <td style="color:#4a4f6e">${item.mdTeam||item.team||'-'}</td>
      <td style="color:#8b90ab;font-size:11px">${item.mdCategory||'-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${item.pgmCodeName||'-'}</td>
      <td style="color:#8b90ab;font-size:11px">${item.dealTypeConverted||item.dealType||'-'}</td>
      <td>${nptBadge}</td>
      <td class="r" style="color:#4a6cf7;font-weight:600">${hf(item.availableWeightedMin1)}</td>
      <td class="r">${item.remainingSchedule||'-'}</td>
    </tr>`
  }).join('')

  const noRow = (n, msg) => `<tr><td colspan="${n}" style="text-align:center;color:#8b90ab;padding:24px">${msg}</td></tr>`

  return `${gradeSection}
<div style="font-size:11px;font-weight:700;color:#4a4f6e;margin:10px 0 6px">편성완료 ${allScheduled.length}건</div>
<div class="sec" style="padding:0;margin-bottom:16px">
  <table>
    <thead><tr>
      <th class="c">등급</th><th>날짜</th><th>시간</th><th class="c">채널</th>
      <th>팀</th><th>카테고리</th><th>편성코드명</th><th class="r">가중분</th>
      <th>메모코드</th><th>편성C</th><th class="c">상태</th>
    </tr></thead>
    <tbody>${scheduledRows || noRow(11, '편성된 항목이 없습니다.')}</tbody>
  </table>
</div>
<div style="font-size:11px;font-weight:700;color:#4a4f6e;margin:14px 0 6px">미편성 ${enrichedItems.length}건</div>
<div class="sec" style="padding:0;margin-bottom:16px">
  <table>
    <thead><tr>
      <th class="c">등급</th><th>팀</th><th>카테고리</th><th>편성코드명</th>
      <th>거래형태</th><th>신상품구분</th><th class="r">가용가중분</th><th class="r">잔여편성</th>
    </tr></thead>
    <tbody>${unscheduledRows || noRow(8, '미편성 항목이 없습니다.')}</tbody>
  </table>
</div>`
}

// ── 메인 내보내기 함수 ────────────────────────────────────────────────────
export function exportToHtmlSections(sections, data) {
  const { startDate = '', endDate = '' } = data
  const parts = []

  if (sections.grid)       parts.push(`<h2>편성표</h2>` + buildGridSection(data))
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
