import { useMemo } from 'react'
import useScheduleStore from '../../store/useScheduleStore'

const CH_ORDER = ['CA', 'IP', 'ALL']
const CH_BG    = { CA: 'var(--ca)', IP: 'var(--ip)', ALL: 'var(--all)' }
const CH_TEXT  = { CA: 'var(--ca-t)', IP: 'var(--ip-t)', ALL: 'var(--all-t)' }
const DT_ORDER = ['[위]', '[직]', '[혼]', '[모]', '[액]', '[률]']

function blockMatches(block, kw) {
  return [block.pgmCodeName, block.mdTeam, block.orgName, block.mdCategory, block.dealTypeConverted, block.dealType]
    .join(' ').toLowerCase().includes(kw)
}

function itemMatches(item, kw) {
  return [item.pgmCodeName, item.mdTeam, item.mdCategory, item.dealTypeConverted, item.dealType]
    .join(' ').toLowerCase().includes(kw)
}

function groupBlocks(blocks, keyFn, perfMap, manualInputs, totalWm) {
  const map = {}
  blocks.forEach(b => {
    const k  = keyFn(b)
    const wm = b.weightedMin || 0
    const pk = b.perfKey
    const m  = pk ? (manualInputs?.[pk] || {}) : {}
    const p  = pk ? (perfMap?.[pk]      || {}) : {}
    const sp = Number(m.expectedSalesPerWeightedMin  ?? p.salesPerWeightedMin  ?? 0)
    const pp = Number(m.expectedProfitPerWeightedMin ?? p.profitPerWeightedMin ?? 0)
    if (!map[k]) map[k] = { count: 0, wm: 0, perfWm: 0, sales: 0, profit: 0, perfCount: 0 }
    map[k].count  += 1
    map[k].wm     += wm
    if (sp > 0 || pp > 0) { map[k].perfWm += wm; map[k].sales += wm * sp; map[k].profit += wm * pp; map[k].perfCount += 1 }
  })
  return Object.entries(map).map(([key, v]) => ({
    key,
    count:  v.count,
    wm:     v.wm,
    pct:    totalWm > 0 ? (v.wm / totalWm * 100).toFixed(1) : '0.0',
    avgSp:  v.perfWm > 0 ? Math.round(v.sales  / v.perfWm) : 0,
    avgPp:  v.perfWm > 0 ? Math.round(v.profit / v.perfWm) : 0,
    perfCount: v.perfCount,
  }))
}

const thS = { padding: '5px 8px', fontSize: 9, fontWeight: 700, color: 'var(--text3)', textAlign: 'right', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', whiteSpace: 'nowrap' }
const tdS = { padding: '5px 8px', fontSize: 10, textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

function StatsTable({ rows, colType }) {
  if (!rows.length) return <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 8px' }}>-</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...thS, textAlign: 'left' }}>구분</th>
          <th style={thS}>건수</th>
          <th style={thS}>가중분</th>
          <th style={thS}>비중</th>
          <th style={thS}>취급/이익</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ ...tdS, textAlign: 'left', fontWeight: 600 }}>
              {colType === 'channel'
                ? <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 700, background: CH_BG[r.key] || 'var(--bg4)', color: CH_TEXT[r.key] || 'var(--text)' }}>{r.key}</span>
                : r.key}
            </td>
            <td style={{ ...tdS, fontWeight: 700, color: 'var(--accent)' }}>{r.count}</td>
            <td style={tdS}>{r.wm.toLocaleString()}</td>
            <td style={{ ...tdS, color: 'var(--text2)' }}>{r.pct}%</td>
            <td style={{ ...tdS, color: r.avgSp > 0 ? 'var(--green)' : 'var(--border2)', fontWeight: r.avgSp > 0 ? 600 : 400 }}>
              {r.avgSp > 0 || r.avgPp > 0
                ? `${r.avgSp.toLocaleString()} / ${r.avgPp.toLocaleString()}`
                : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SearchPanel({ isOpen, onToggle }) {
  const { gridSearch, setGridSearch, scheduleBlocks, proposalItems, perfMap, manualInputs } = useScheduleStore()

  const kw = gridSearch.trim().toLowerCase()

  const { matchedBlocks, totalScheduledWm, dealRows, chRows } = useMemo(() => {
    const allBlocks     = Object.values(scheduleBlocks).filter(b => b && !b.isDefault)
    const totalScheduledWm = allBlocks.reduce((s, b) => s + (b.weightedMin || 0), 0)
    const matchedBlocks = kw ? allBlocks.filter(b => blockMatches(b, kw)) : allBlocks

    const dtPresent = new Set(matchedBlocks.map(b => b.dealTypeConverted || b.dealType || '미지정'))
    const dtExtra   = [...dtPresent].filter(k => !DT_ORDER.includes(k))
    const dtOrder   = [...DT_ORDER.filter(k => dtPresent.has(k)), ...dtExtra]
    const rawDt     = groupBlocks(matchedBlocks, b => b.dealTypeConverted || b.dealType || '미지정', perfMap, manualInputs, totalScheduledWm)
    const dealRows  = dtOrder.map(k => rawDt.find(r => r.key === k)).filter(Boolean)

    const rawCh  = groupBlocks(matchedBlocks, b => CH_ORDER.includes(b.channel) ? b.channel : 'ALL', perfMap, manualInputs, totalScheduledWm)
    const chRows = CH_ORDER.map(k => rawCh.find(r => r.key === k)).filter(Boolean)

    return { matchedBlocks, totalScheduledWm, dealRows, chRows }
  }, [scheduleBlocks, kw, perfMap, manualInputs])

  const matchedItems = useMemo(
    () => kw ? proposalItems.filter(i => itemMatches(i, kw)) : proposalItems,
    [proposalItems, kw]
  )

  const sectionLabel = (label, count) => (
    <div style={{ padding: '8px 12px 5px', fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.05em', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center' }}>
      {label}
      <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 11 }}>{count}</span>
      <span style={{ color: 'var(--text3)', fontWeight: 400 }}>건</span>
    </div>
  )

  if (!isOpen) return null

  return (
    <div style={{ width: 300, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* 헤더 */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>🔍</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{gridSearch}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>검색 결과</span>
      </div>

      {/* 결과 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* 편성 리스트 */}
        {sectionLabel('편성 리스트', matchedBlocks.length)}

        <div style={{ padding: '0 0 4px' }}>
          <div style={{ padding: '4px 12px 2px', fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em' }}>거래형태별</div>
          <StatsTable rows={dealRows} colType="deal" />
        </div>

        <div style={{ padding: '0 0 4px' }}>
          <div style={{ padding: '4px 12px 2px', fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em' }}>채널별</div>
          <StatsTable rows={chRows} colType="channel" />
        </div>

        {/* 미편성 리스트 */}
        {sectionLabel('미편성 리스트', matchedItems.length)}

        <div style={{ padding: '4px 8px' }}>
          {matchedItems.length === 0
            ? <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 4px' }}>-</div>
            : matchedItems.map(item => {
                const perf = item.perfKey ? (perfMap[item.perfKey] || null) : null
                return (
                  <div key={item.itemId} style={{ padding: '6px 8px', marginBottom: 4, background: 'var(--bg3)', borderRadius: 5, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.pgmCodeName}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {(item.dealTypeConverted || item.dealType) && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--accent)', color: '#fff', fontWeight: 700 }}>
                          {item.dealTypeConverted || item.dealType}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: 'var(--text3)' }}>{item.mdTeam || '-'}</span>
                      {perf && (
                        <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>
                          {Number(perf.salesPerWeightedMin || 0).toLocaleString()} / {Number(perf.profitPerWeightedMin || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>
    </div>
  )
}
