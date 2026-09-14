import { getGrade, getEffectiveProfit } from '../grade'
import { getScheduledBlockPerformance } from '../performanceHistory'
import { getEffectiveBlockWeightedMin } from '../weightedMin'

const HC = {
  ca: '#dbeafe', caT: '#1d4ed8',
  ip: '#ede9fe', ipT: '#6d28d9',
  all: '#dcfce7', allT: '#15803d',
}
const GC = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f97316', D: '#6b7280' }
const GB = { S: 'rgba(245,158,11,.15)', A: 'rgba(16,185,129,.15)', B: 'rgba(59,130,246,.15)', C: 'rgba(249,115,22,.15)', D: 'rgba(107,114,128,.12)' }
const hf = v => Math.round(Number(v || 0)).toLocaleString()
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
    group[key] = (group[key] || 0) + w
    groupDm[key] = (groupDm[key] || 0) + d
  })
  return { group, groupDm, totalWeighted, totalDm, competingWeighted }
}
export function buildRatioSection({ scheduleBlocks, pgmSlots, weightedMinTargets, categoryMap, perfMap, performanceHistoryByKey, manualInputs }) {
  const totalSlotWeighted = (pgmSlots || []).reduce((s, sl) => s + (sl.weightedMin || 0), 0)

  const enrichedBlocks = {}
  Object.entries(scheduleBlocks).forEach(([key, block]) => {
    enrichedBlocks[key] = { ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류' }
  })

  // 팀별 / 카테고리별 stats
  const statsTeam = calcRatioStats(enrichedBlocks, categoryMap, 'team')

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
    const perf = getScheduledBlockPerformance(b, {
      performanceHistoryByKey,
      manualInputs,
      fallbackPerfMap: perfMap,
    })
    const sp = Number(perf.salesPerMin || 0)
    const pp = Number(perf.profitPerMin || 0)
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
      const wm = getEffectiveBlockWeightedMin(b)
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
      ${buildPivotTable('거래형태별', DT_ORDER, b => b.dealTypeConverted || b.dealType || '미지정', null)}
      ${buildPivotTable('채널별', CH_ORDER, b => CH_ORDER.includes(b.channel) ? b.channel : 'ALL', chRenderer)}
      ${buildPivotTable('영상구분별', VS_ORDER, b => b.newProductType || '기존', null)}
    </div>
  </div>`

  return `${summaryCards}
<div class="sec" style="margin-bottom:16px">
  <div class="sec-title">팀별 편성비중</div>
  ${buildRatioTable(statsTeam, true)}
</div>
${pgmCountSection}`
}

