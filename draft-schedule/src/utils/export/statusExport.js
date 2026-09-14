import { getGrade, getEffectiveProfit } from '../grade'

const hf = v => Math.round(Number(v || 0)).toLocaleString()
const hfs = v => {
  const n = Math.round(Number(v || 0))
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
  if (n >= 10000) return (n / 10000).toFixed(1) + '만'
  return n.toLocaleString()
}
const GC = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f97316', D: '#6b7280' }
const GB = { S: 'rgba(245,158,11,.15)', A: 'rgba(16,185,129,.15)', B: 'rgba(59,130,246,.15)', C: 'rgba(249,115,22,.15)', D: 'rgba(107,114,128,.12)' }
const gBadge = g => {
  const c = GC[g] || '#6b7280', bg = GB[g] || 'transparent'
  return `<span style="font-size:11px;font-weight:800;padding:2px 7px;border-radius:4px;background:${bg};color:${c};border:1px solid ${c}40">${g}</span>`
}
export function buildStatusSection({ scheduleBlocks, proposalItems, perfMap, performanceHistoryByKey, manualInputs, categoryMap }) {
  const GRADES = ['S', 'A', 'B', 'C', 'D']

  // enrichedBlocks (경쟁 제외)
  const enrichedBlocks = Object.values(scheduleBlocks)
    .filter(b => !b.isDefault && !b.isCompeting)
    .map(b => ({
      ...b,
      mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
      _grade: getGrade(getEffectiveProfit(b, perfMap, manualInputs, performanceHistoryByKey)),
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
    const grade = block._grade || getGrade(getEffectiveProfit(block, perfMap, manualInputs, performanceHistoryByKey))
    const statusBadge = isCompeting
      ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#fef2f2;color:#dc2626;font-weight:700">경쟁</span>`
      : block.isPreSchedule
      ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#e8eaf2;color:#8b90ab;font-weight:700">선편성</span>`
      : `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#f0fdf4;color:#16a34a;font-weight:700">편성</span>`
    const rowBg = i % 2 !== 0 ? 'background:#fafafa' : ''
    const weightedMin = getEffectiveBlockWeightedMin(block)
    return `<tr style="${rowBg}">
      <td class="c">${!isCompeting ? gBadge(grade) : '-'}</td>
      <td style="color:#4a4f6e">${block.dateKey||'-'}</td>
      <td style="font-weight:600">${block.timeText||'-'}</td>
      <td class="c">${chBadge(block.channel||'ALL')}</td>
      <td style="color:#4a4f6e">${block.mdTeam||block.orgName||'-'}</td>
      <td style="color:#8b90ab;font-size:11px">${block.mdCategory||'-'}</td>
      <td style="${isCompeting?'color:#dc2626;font-weight:700':''}max-width:200px;overflow:hidden;text-overflow:ellipsis">${isCompeting?'⚔ ':''}${block.pgmCodeName||'-'}</td>
      <td class="r" style="font-weight:700;color:#4a6cf7">${hf(weightedMin)}</td>
      <td style="color:#8b90ab;font-size:11px">${block.memoCode||'-'}</td>
      <td style="color:#8b90ab;font-size:11px">${block.memoCode2||'-'}</td>
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
      <th>메모코드</th><th>메모코드2</th><th>편성C</th><th class="c">상태</th>
    </tr></thead>
    <tbody>${scheduledRows || noRow(12, '편성된 항목이 없습니다.')}</tbody>
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
