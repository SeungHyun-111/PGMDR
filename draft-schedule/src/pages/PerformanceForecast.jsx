import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { findBestPerf } from '../hooks/usePerformanceMap'

function calcForecast(block, perfMap, manualInputs) {
  const manual   = manualInputs[block.perfKey] || manualInputs[block.itemId] || {}
  const lastPerf = block.perfKey
    ? (perfMap[block.perfKey] || null)
    : findBestPerf(perfMap, block.dealType, block.pgmCodeName)

  const salesPerMin  = manual.expectedSalesPerWeightedMin  ?? lastPerf?.salesPerWeightedMin  ?? 0
  const profitPerMin = manual.expectedProfitPerWeightedMin ?? lastPerf?.profitPerWeightedMin ?? 0
  const wm = Number(block.weightedMin || 0)

  return { lastPerf, salesPerMin, profitPerMin, expectedSales: salesPerMin * wm, expectedProfit: profitPerMin * wm }
}

const fmt = v => Number(v || 0).toLocaleString()

export default function PerformanceForecast() {
  const { scheduleBlocks, proposalItems, perfMap, manualInputs } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const [teamFilter, setTeamFilter]         = useState('전체')

  const blocks = useMemo(() => Object.values(scheduleBlocks).filter(b => !b.isDefault), [scheduleBlocks])

  const categories = useMemo(() =>
    ['전체', ...new Set(blocks.map(b => b.mdCategory || categoryMap[b.pgmCodeName]).filter(Boolean))]
  , [blocks, categoryMap])

  const teams = useMemo(() =>
    ['전체', ...new Set(blocks.map(b => b.mdTeam || b.orgName).filter(Boolean))]
  , [blocks])

  const rows = useMemo(() =>
    blocks
      .map(block => ({
        ...block,
        mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '',
        ...calcForecast(block, perfMap, manualInputs),
      }))
      .filter(r => categoryFilter === '전체' || r.mdCategory === categoryFilter)
      .filter(r => teamFilter    === '전체' || (r.mdTeam || r.orgName) === teamFilter)
  , [blocks, perfMap, manualInputs, categoryMap, categoryFilter, teamFilter])

  const summary = useMemo(() =>
    rows.reduce((acc, r) => ({
      weightedMin:    acc.weightedMin    + Number(r.weightedMin    || 0),
      expectedSales:  acc.expectedSales  + r.expectedSales,
      expectedProfit: acc.expectedProfit + r.expectedProfit,
    }), { weightedMin: 0, expectedSales: 0, expectedProfit: 0 })
  , [rows])

  const selStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5, fontSize: 12 }
  const thStyle  = { padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, background: 'var(--bg3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={selStyle}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={selStyle}>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 16, marginLeft: 8, fontSize: 12, color: 'var(--text2)' }}>
          <span>가중분 <strong style={{ color: 'var(--text)' }}>{fmt(summary.weightedMin)}</strong></span>
          <span>예상취급고 <strong style={{ color: 'var(--accent)' }}>{fmt(summary.expectedSales)}</strong></span>
          <span>예상한익 <strong style={{ color: 'var(--green)' }}>{fmt(summary.expectedProfit)}</strong></span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['일자','시간','채널','카테고리','팀','상품','거래형태','가중분','최근취급/분','최근한익/분','예상취급고','예상한익'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.blockKey || i} style={{ borderBottom: '1px solid var(--border)' }}>
              {[
                [r.dateKey],
                [r.timeText],
                [r.channel],
                [r.mdCategory || '-'],
                [r.mdTeam || r.orgName || '-'],
                [r.pgmCodeName],
                [r.dealTypeConverted || r.dealType || '-'],
                [fmt(r.weightedMin), true],
                [fmt(r.lastPerf?.salesPerWeightedMin), true, 'var(--text2)'],
                [fmt(r.lastPerf?.profitPerWeightedMin), true, 'var(--text2)'],
                [fmt(r.expectedSales), true, 'var(--accent)'],
                [fmt(r.expectedProfit), true, 'var(--green)'],
              ].map(([val, right, color], ci) => (
                <td key={ci} style={{ padding: '5px 10px', fontSize: 11, textAlign: right ? 'right' : 'left', color: color || 'var(--text)', borderBottom: '1px solid var(--border)' }}>{val}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}