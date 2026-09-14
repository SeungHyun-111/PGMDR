import {
  buildDailyForecast,
  buildForecastGroups,
  buildForecastSummary,
  enrichForecastGroups,
  resolveForecastMetrics,
  weightedAveragePerMin,
} from '../../domain/performance/forecast'
import { parseTargetMetrics } from '../../domain/performance/targets'

const hf = v => Math.round(Number(v || 0)).toLocaleString()
const hfs = v => {
  const n = Math.round(Number(v || 0))
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
  if (n >= 10000) return (n / 10000).toFixed(1) + '만'
  return n.toLocaleString()
}
const chBadge = ch => {
  const [bg, c] = ch === 'CA' ? ['#dbeafe', '#1d4ed8'] : ch === 'IP' ? ['#ede9fe', '#6d28d9'] : ['#dcfce7', '#15803d']
  return `<span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;background:${bg};color:${c}">${ch}</span>`
}
function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export function buildSimSection({ scheduleBlocks, pgmSlots, customSlots, splitSlots, perfMap, performanceHistoryByKey, manualInputs, categoryMap, targetMetrics, weightedMinTargets }) {
  const { teamMap: teamTargetMap, companyTotal } = parseTargetMetrics(targetMetrics)

  const rows = Object.values(scheduleBlocks)
    .filter(b => b)
    .map(b => ({
      ...b,
      mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
      mdTeam: b.mdTeam || b.orgName || '미지정',
      ...resolveForecastMetrics(b, { perfMap, manualInputs, performanceHistoryByKey }),
    }))
    .sort((a, b) => a.dateKey !== b.dateKey
      ? (a.dateKey || '').localeCompare(b.dateKey || '')
      : timeToMin(a.timeText) - timeToMin(b.timeText))

  const summary = buildForecastSummary(rows, { pgmSlots, customSlots, splitSlots })

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
  const tgtSales  = companyTotal?.salesPerMin  > 0 ? companyTotal.salesPerMin  * summary.totalSlotWm : null
  const tgtProfit = companyTotal?.profitPerMin > 0 ? companyTotal.profitPerMin * summary.totalSlotWm : null
  const salesPct  = tgtSales  > 0 ? summary.sales  / tgtSales  * 100 : null
  const profitPct = tgtProfit > 0 ? summary.profit / tgtProfit * 100 : null

  const statCards = `<div class="cards">
  <div class="card"><div class="cl">총 예상취급고</div><div class="cv" style="color:#4a6cf7">${hfs(summary.sales)}</div>${salesPct != null ? `<div class="cs">목표 ${hfs(tgtSales)} · ${Math.round(salesPct)}%</div>` : ''}</div>
  <div class="card"><div class="cl">총 예상한익</div><div class="cv" style="color:#16a34a">${hfs(summary.profit)}</div>${profitPct != null ? `<div class="cs">목표 ${hfs(tgtProfit)} · ${Math.round(profitPct)}%</div>` : ''}</div>
  <div class="card"><div class="cl">편성 슬롯</div><div class="cv">${summary.count} / ${summary.totalSlotCount}</div><div class="cs">가중분 ${hf(summary.wm)}</div></div>
  <div class="card"><div class="cl">실적 입력</div><div class="cv">${summary.perfEnteredCount}건</div><div class="cs">${Math.round(summary.perfRate)}%</div></div>
  <div class="card ${summary.missingCount > 0 ? 'warn' : ''}"><div class="cl ${summary.missingCount > 0 ? 'warn' : ''}">미입력 실적</div><div class="cv" style="color:${summary.missingCount > 0 ? '#dc2626' : '#1a1d2e'}">${summary.missingCount}건</div><div class="cs">직전 실적 없음</div></div>
</div>`

  // 팀별 볼륨 바
  const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316','#84cc16','#94a3b8']
  const groupData = buildForecastGroups(rows, {
    groupBy: 'team',
    weightedMinTargets,
    teamTargetMap,
    totalWm: summary.wm,
  })
  const avgGroupSpm = weightedAveragePerMin(groupData, 'salesPerMin')
  const avgGroupPpm = weightedAveragePerMin(groupData, 'profitPerMin')
  const enrichedGroupData = enrichForecastGroups(groupData, {
    companyTotal,
    avgSalesPerMin: avgGroupSpm,
    avgProfitPerMin: avgGroupPpm,
  })
  const teams = enrichedGroupData.filter(g => g.sales > 0 || g.profit > 0)
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
  const dailyData = buildDailyForecast(rows)
  const avgDailySpm = weightedAveragePerMin(dailyData, 'salesPerMin')
  const avgDailyPpm = weightedAveragePerMin(dailyData, 'profitPerMin')

  const dailyRows = dailyData.map(d => {
    return `<tr>
      <td>${d.date}</td>
      <td class="r" style="color:#4a6cf7;font-weight:600">${hf(d.salesPerMin)}</td>
      <td class="r" style="color:#16a34a;font-weight:600">${hf(d.profitPerMin)}</td>
      <td class="r">${hfs(d.sales)}</td>
      <td class="r">${hfs(d.profit)}</td>
      <td class="r" style="color:#8b90ab">${hf(d.wm)}</td>
    </tr>`
  }).join('')

  // 팀별 관점 테이블 (BarChart 대체)
  const teamRows = enrichedGroupData
    .map(g => {
      const effSpm = g.effectiveTargetSalesPerMin
      const effPpm = g.effectiveTargetProfitPerMin
      const sAch = effSpm > 0 ? Math.round(g.salesPerMin / effSpm * 100) : null
      const pAch = effPpm > 0 ? Math.round(g.profitPerMin / effPpm * 100) : null
      return `<tr>
        <td style="font-weight:600">${g.name}</td>
        <td class="r">${g.count}</td>
        <td class="r" style="color:#8b90ab">${hf(g.wm)}</td>
        <td class="r" style="color:#4a6cf7;font-weight:600">${hf(g.salesPerMin)}</td>
        <td class="r" style="color:#8b90ab">${effSpm > 0 ? hf(effSpm) : '-'}</td>
        <td class="r" style="color:${sAch != null ? (sAch >= 100 ? '#16a34a' : '#dc2626') : '#8b90ab'};font-weight:700">${sAch != null ? sAch + '%' : '-'}</td>
        <td class="r" style="color:#16a34a;font-weight:600">${hf(g.profitPerMin)}</td>
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

