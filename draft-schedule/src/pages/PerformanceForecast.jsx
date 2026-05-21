import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import usePerformanceMap, { findBestPerf } from '../hooks/usePerformanceMap'

function calcForecast(block, perfMap, manualInputs) {
  const manual   = manualInputs[block.itemId] || {}
  const lastPerf = findBestPerf(perfMap, block.dealType, block.pgmCodeName)

  const salesPerMin  = manual.expectedSalesPerWeightedMin
    || block.expectedSalesPerWeightedMin
    || lastPerf?.salesPerWeightedMin
    || 0

  const profitPerMin = manual.expectedProfitPerWeightedMin
    || block.expectedProfitPerWeightedMin
    || lastPerf?.profitPerWeightedMin
    || 0

  const w = block.weightedMin || 0

  return {
    expectedSales:  Math.round(Number(salesPerMin)  * w),
    expectedProfit: Math.round(Number(profitPerMin) * w),
    salesPerMin:    Number(salesPerMin),
    profitPerMin:   Number(profitPerMin),
    isManual:       !!(manual.expectedSalesPerWeightedMin || block.expectedSalesPerWeightedMin),
    hasPerf:        !!lastPerf,
    weightedMin:    w,
  }
}

const fmt = (n) => n >= 100000000
  ? `${(n / 100000000).toFixed(1)}억`
  : n >= 10000
  ? `${(n / 10000).toFixed(0)}만`
  : n.toLocaleString()

export default function PerformanceForecast() {
  const { scheduleBlocks, proposalItems, performanceRows, manualInputs, starred } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems, performanceRows)
  const perfMap     = usePerformanceMap(performanceRows)
  const [groupBy, setGroupBy]             = useState('team')
  const [filterStarred, setFilterStarred] = useState(false)

  const forecastBlocks = useMemo(() => {
    return Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault && !b.isCompeting)
      .map(b => ({
        ...b,
        category: categoryMap[b.pgmCodeName] || '미입력',
        ...calcForecast(b, perfMap, manualInputs),
      }))
      .sort((a, b) => a.dateKey !== b.dateKey
        ? a.dateKey.localeCompare(b.dateKey)
        : (a.timeText || '').localeCompare(b.timeText || ''))
  }, [scheduleBlocks, categoryMap, perfMap, manualInputs])

  const total = useMemo(() => ({
    weightedMin:    forecastBlocks.reduce((a, b) => a + b.weightedMin, 0),
    expectedSales:  forecastBlocks.reduce((a, b) => a + b.expectedSales, 0),
    expectedProfit: forecastBlocks.reduce((a, b) => a + b.expectedProfit, 0),
    slotCount:      forecastBlocks.length,
    noPerf:         forecastBlocks.filter(b => !b.hasPerf && !b.isManual).length,
  }), [forecastBlocks])

  const grouped = useMemo(() => {
    const map = {}
    forecastBlocks.forEach(b => {
      const key = groupBy === 'team'     ? (b.mdTeam || b.orgName || '미지정')
                : groupBy === 'date'     ? b.dateKey
                : b.category
      if (!map[key]) map[key] = { key, blocks: [], weightedMin: 0, expectedSales: 0, expectedProfit: 0 }
      map[key].blocks.push(b)
      map[key].weightedMin    += b.weightedMin
      map[key].expectedSales  += b.expectedSales
      map[key].expectedProfit += b.expectedProfit
    })
    return Object.values(map).sort((a, b) => b.expectedSales - a.expectedSales)
  }, [forecastBlocks, groupBy])

  const displayBlocks = filterStarred
    ? forecastBlocks.filter(b => starred[b.itemId])
    : forecastBlocks

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: '편성 슬롯',     value: total.slotCount,                    color: 'var(--text)' },
          { label: '총 가중분',     value: total.weightedMin.toLocaleString(),  color: 'var(--accent)' },
          { label: '예상 취급고',   value: fmt(total.expectedSales),            color: 'var(--green)' },
          { label: '예상 한계이익', value: fmt(total.expectedProfit),           color: 'var(--accent2)' },
          { label: '실적 미입력',   value: `${total.noPerf}건`,                 color: total.noPerf > 0 ? 'var(--yellow)' : 'var(--text3)' },
        ].map(card => (
          <div key={card.label} style={{ flex: 1, minWidth: 130, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '.4px' }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 + 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {[
          { id: 'team',     label: '팀별' },
          { id: 'date',     label: '날짜별' },
          { id: 'category', label: '카테고리별' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setGroupBy(tab.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid',
            borderColor: groupBy === tab.id ? 'var(--accent)' : 'var(--border)',
            background:  groupBy === tab.id ? 'var(--accent)' : 'var(--bg2)',
            color:       groupBy === tab.id ? '#fff' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>{tab.label}</button>
        ))}
        <label style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={filterStarred} onChange={e => setFilterStarred(e.target.checked)} />
          별표만 보기
        </label>
      </div>

      {/* 그룹 요약 테이블 */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
              {['구분','슬롯','가중분','예상 취급고','예상 한계이익','이익률'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === '구분' ? 'left' : 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((g, i) => {
              const marginRate = g.expectedSales > 0 ? (g.expectedProfit / g.expectedSales * 100) : 0
              return (
                <tr key={g.key} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{g.key}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>{g.blocks.length}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>{g.weightedMin.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmt(g.expectedSales)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(g.expectedProfit)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: marginRate >= 30 ? 'var(--green)' : marginRate >= 20 ? 'var(--yellow)' : 'var(--red)' }}>
                    {marginRate.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg3)', fontWeight: 700 }}>
              <td style={{ padding: '10px 14px' }}>합계</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>{total.slotCount}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>{total.weightedMin.toLocaleString()}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--green)' }}>{fmt(total.expectedSales)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--accent)' }}>{fmt(total.expectedProfit)}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>
                {total.expectedSales > 0 ? (total.expectedProfit / total.expectedSales * 100).toFixed(1) + '%' : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 상세 목록 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>상세 목록</div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
              {['★','날짜','시간','채널','팀','편성코드명','가중분','분당취급액','분당한계이익','예상취급고','예상한계이익','비고'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBlocks.map((block, i) => (
              <tr key={block.blockKey || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '6px 10px', color: starred[block.itemId] ? 'var(--yellow)' : 'var(--border2)', fontSize: 12 }}>
                  {starred[block.itemId] ? '★' : '☆'}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.dateKey}</td>
                <td style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{block.timeText}</td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                    background: block.channel === 'CA' ? 'var(--ca)' : block.channel === 'IP' ? 'var(--ip)' : 'var(--all)',
                    color: block.channel === 'CA' ? 'var(--ca-t)' : block.channel === 'IP' ? 'var(--ip-t)' : 'var(--all-t)' }}>
                    {block.channel}
                  </span>
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.mdTeam || '-'}</td>
                <td style={{ padding: '6px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={block.pgmCodeName}>
                  {block.pgmCodeName}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)' }}>{block.weightedMin}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)' }}>
                  {block.salesPerMin > 0 ? block.salesPerMin.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text2)' }}>
                  {block.profitPerMin > 0 ? block.profitPerMin.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                  {block.expectedSales > 0 ? fmt(block.expectedSales) : '-'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                  {block.expectedProfit > 0 ? fmt(block.expectedProfit) : '-'}
                </td>
                <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                  {block.isManual ? '✏ 수동' : block.hasPerf ? '실적' : '⚠ 미입력'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}