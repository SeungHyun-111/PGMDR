import { getEffectivePgmSlots } from '../effectiveSlots'
import { getBlockTeams, getCompetitionItems } from '../competition'
import { getEffectiveBlockWeightedMin } from '../weightedMin'

const HC = {
  ca: '#dbeafe', caT: '#1d4ed8',
  ip: '#ede9fe', ipT: '#6d28d9',
  all: '#dcfce7', allT: '#15803d',
}
const DN = ['일', '월', '화', '수', '목', '금', '토']

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function calcReportLayout(maxRows, dateCount, pageWmm = 400, pageHmm = 285) {
  const PAGE_W_MM = pageWmm
  const PAGE_H_MM = pageHmm
  const HEADER_MM = 8
  const FOOTER_MM = 0
  const availableH = PAGE_H_MM - HEADER_MM - FOOTER_MM
  const rowH = Math.max(2.6, availableH / Math.max(maxRows, 1))
  const dayW = PAGE_W_MM / Math.max(dateCount, 1)
  const fontK = Math.max(0.62, Math.min(1, rowH / 5.5))
  return { PAGE_W_MM, PAGE_H_MM, rowH, fontK, dayW }
}
export function buildGridSection({ scheduleBlocks, pgmSlots, customSlots, splitSlots, perfMap, unitH = 44, forPrint = false }) {
  let UNIT_H = unitH, TIME_W = 36, COL_W = 160
  let FONT_K = 1
  let GRID_TOOLBAR_H = 36
  let GRID_HEADER_H = 36
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
  let htmlGridPageW = null
  let htmlGridPageH = null
  const isHtmlA3 = !forPrint
  if (isHtmlA3) {
    const PX_PER_MM = 3.7795275591
    const bodyPadPx = 24
    const reportChromePx = 26 + 38 + 62
    htmlGridPageW = 400 * PX_PER_MM - bodyPadPx * 2
    htmlGridPageH = 285 * PX_PER_MM - bodyPadPx * 2 - reportChromePx
    GRID_TOOLBAR_H = 12 * PX_PER_MM
    GRID_HEADER_H = 3 * PX_PER_MM
    const gridChromePx = GRID_TOOLBAR_H + GRID_HEADER_H + 2
    const bodyGridH = Math.max(1, htmlGridPageH - gridChromePx)
    const layout = calcReportLayout(
      maxSlotUnits,
      dates.length,
      htmlGridPageW / PX_PER_MM,
      bodyGridH / PX_PER_MM
    )
    const dayW = layout.dayW * PX_PER_MM
    TIME_W = 7.5 * PX_PER_MM
    COL_W = Math.max(40, dayW - TIME_W)
    UNIT_H = layout.rowH * PX_PER_MM
    FONT_K = layout.fontK
  }
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
    const isGreenBg    = hasHash
    const isComp       = block.isCompeting
    const isPgmTeam    = block.pgmCodeName === '[편성팀]'

    const bgColor     = isComp ? '#8b0000' : isPgmTeam ? '#f0f1f7' : isGreenBg ? '#166534' : isDirect ? '#1d4ed8' : isPurple ? '#7c3aed' : '#ffffff'
    const borderColor = isComp ? '#ff4444' : isPgmTeam ? '#c8cade' : isGreenBg ? 'rgba(34,197,94,.5)' : isDirect ? 'rgba(59,130,246,.5)' : isPurple ? 'rgba(139,92,246,.5)' : '#e2e4ef'
    const isColored   = isComp || isDirect || isPurple || isGreenBg
    const textColor   = isColored ? '#fff' : '#1a1d2e'
    const fontSize    = Math.max(7, (rowH > 30 ? 10 : 9) * FONT_K)
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

    const badgeH = Math.max(10, 14 * FONT_K)
    const bs = `font-size:${badgeSz}px;font-weight:700;color:${textColor};background:${badgeBg};padding:0 ${Math.max(2, 3 * FONT_K)}px;height:${badgeH}px;border-radius:2px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center`
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

    const blockWeightedMin = getEffectiveBlockWeightedMin(block)
    const wmSpan = blockWeightedMin > 0
      ? `<span style="font-size:${badgeSz}px;color:${isColored?'rgba(255,255,255,.45)':'#8b90ab'};white-space:nowrap;flex-shrink:0">${blockWeightedMin}</span>`
      : ''
    const annotCorner = block.annotation
      ? `<div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 8px 8px 0;border-color:transparent #d97706 transparent transparent"></div>`
      : ''
    const hashMark = hasHash
      ? `<div style="position:absolute;bottom:1px;right:3px;font-size:8px;color:rgba(100,220,100,.8);font-weight:700">#</div>`
      : ''

    const lastPerf = (block.perfKey && perfMap) ? (perfMap[block.perfKey] || null) : null
    const tipJson  = JSON.stringify({
      isComp, items: isComp ? getCompetitionItems(block) : [],
      item1: block.item1 || null, item2: block.item2 || null,
      mdTeam: block.mdTeam || block.orgName || null, channel: block.channel || null,
      dealType: block.dealType || null, newProductType: block.newProductType || null,
      mdCategory: block.mdCategory || null, dateKey: block.dateKey || null,
      timeText: block.timeText || null, durationMin: block.durationMin || null,
      weightedMin: blockWeightedMin || null, memoCode: block.memoCode || null, memoCode2: block.memoCode2 || null,
      scheduleComment: block.scheduleComment || null, requestNote: block.requestNote || null, annotation: block.annotation || null,
      lastPerf: lastPerf ? { broadcastDate: lastPerf.broadcastDate, spw: lastPerf.salesPerWeightedMin, ppw: lastPerf.profitPerWeightedMin } : null,
    })

    const teamVal = escAttr(getBlockTeams(block).join('|'))
    return `<div class="blk" style="position:absolute;inset:1px" data-tip="${escAttr(tipJson)}" data-team="${teamVal}"><div style="position:absolute;inset:0;background:${bgColor};border:1px solid ${borderColor};border-radius:3px;overflow:hidden;display:flex;align-items:center;padding:0 4px;gap:3px;box-sizing:border-box">${badges}<span style="font-size:${fontSize}px;font-weight:600;color:${textColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${esc(block.pgmCodeName||'-')}</span>${wmSpan}${annotCorner}${hashMark}</div></div>`
  }

  // ── 헤더 (ScheduleGrid 헤더와 동일) ─────────────────────────────────────
  const headerCols = dates.map((d, di) => {
    const dow = DN[new Date(d).getDay()]
    return `<div style="flex:1;min-width:${colW}px;display:flex${di>0?';border-left:2px solid #c8cade':''}"><div style="width:${TIME_W}px;flex-shrink:0"></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:${Math.max(8, 12 * FONT_K)}px;font-weight:700;color:#1a1d2e">${esc(dow)} <span style="font-size:${Math.max(7, 10 * FONT_K)}px;font-weight:400;color:#8b90ab">${esc(d.slice(5))}</span></div></div></div>`
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
      (d.items || [d.item1,d.item2]).filter(Boolean).forEach(function(it,i){
        h+='<div style="margin-bottom:6px;padding-bottom:6px'+(i===0?';border-bottom:1px solid #e2e4ef':'')+'"><div style="font-size:10px;font-weight:700;color:'+(i===0?'#1d4ed8':'#6d28d9')+';margin-bottom:3px">'+(i===0?'● 기존':'● 신규')+'</div>';
        [['상품',it.pgmCodeName],['팀',it.mdTeam||'-'],['거래형태',it.dealType||'-']].forEach(function(lr){h+='<div style="display:flex;gap:8px;font-size:10px"><span style="color:#8b90ab;min-width:46px">'+r(lr[0])+'</span><span>'+r(lr[1])+'</span></div>'});
        h+='</div>';
      });
    } else {
      [['팀',d.mdTeam],['채널',d.channel],['거래형태',d.dealType],['신상품구분',d.newProductType],['카테고리',d.mdCategory],['방송일시',(d.dateKey||'')+' '+(d.timeText||'')],['방송시간',(d.durationMin||'-')+'분'],['가중분',d.weightedMin],['메모코드',d.memoCode],['메모코드2',d.memoCode2],['편성C',d.scheduleComment],['기타요청',d.requestNote]].forEach(function(lr){h+=row(lr[0],lr[1])});
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
      var teams=(el.dataset.team||'').split('|');
      var selected=(val!==''&&teams.indexOf(val)!==-1);
      el.style.opacity=(val===''||selected)?'1':'0.001';
      el.style.zIndex=selected?'5':'';
      el.style.filter=selected?'saturate(1.15) contrast(1.08)':'';
      el.style.outline=selected?'2px solid #f59e0b':'';
      el.style.outlineOffset=selected?'1px':'';
      el.style.boxShadow=selected?'0 0 0 2px rgba(245,158,11,.28), 0 4px 10px rgba(15,23,42,.22)':'';
    });
  });
}
})();
<\/script>`

  // ── 조직 필터 select ─────────────────────────────────────────────────────
  const allTeams = [...new Set(
    Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault)
      .flatMap(b => getBlockTeams(b))
      .filter(Boolean)
  )].sort()
  const teamOptions = allTeams.map(t => `<option value="${t}">${t}</option>`).join('')
  const toolbar = forPrint ? '' : `<div style="height:${GRID_TOOLBAR_H}px;display:flex;align-items:center;padding:0 12px;gap:12px;border-bottom:1px solid #e2e4ef;background:#fff">
<span style="font-size:11px;color:#8b90ab">총 ${totalSlots}슬롯 · ${dates.length}일</span>
<div style="display:flex;align-items:center;gap:6px;margin-left:auto">
<label style="font-size:11px;color:#4a4f6e">조직 필터</label>
<select id="_teamSel" style="background:#f0f1f7;border:1px solid #e2e4ef;color:#1a1d2e;padding:3px 8px;border-radius:5px;font-size:11px">
<option value="">전체</option>${teamOptions}
</select>
</div>
</div>`

  const gridContent = `<div style="border:1px solid #e2e4ef;border-radius:10px;overflow:hidden;background:#f5f6fa;margin-bottom:16px">
${toolbar}
<div style="overflow-x:auto">
<div style="min-width:${totalMinW}px;width:100%">
<div style="display:flex;height:${GRID_HEADER_H}px;border-bottom:1px solid #e2e4ef;background:#fff">${headerCols}</div>
<div style="display:flex">${bodyCols}</div>
</div>
</div>
</div>
${forPrint ? '' : tipScript}`

  if (isHtmlA3) {
    return `<div class="grid-a3-page" style="width:${htmlGridPageW}px;height:${htmlGridPageH}px">
${gridContent}
</div>`
  }
  return gridContent
}

