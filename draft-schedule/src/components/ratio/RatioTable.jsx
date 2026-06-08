import { useCallback, useMemo, useState } from 'react'

const MIN_COL_WIDTH = 64

const DEFAULT_WIDTHS = {
  name: 150,
  weighted: 110,
  duration: 110,
  avgRate: 120,
  ratio: 90,
  target: 120,
  targetRatio: 100,
  achieve: 220,
  competingWeighted: 150,
  competingAchieve: 220,
}

export default function RatioTable({ data, groupDm = {}, stats, targetMap, totalSlotWeighted, totalTarget, showTarget, chartData, scheduledWeighted, competingIncludedData, previousComparison }) {
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS)

  const sorted = Object.entries(data).sort((a, b) => {
    if (a[0] === '편성팀') return 1
    if (b[0] === '편성팀') return -1
    if (a[0] === '미편성') return 1
    if (b[0] === '미편성') return -1
    return b[1] - a[1]
  })

  const getTeamColor = name => chartData?.find(d => d.name === name)?.color || 'var(--text3)'
  const showCompetingIncluded = showTarget && competingIncludedData
  const competingIncludedTotal = showCompetingIncluded
    ? sorted.reduce((sum, [name]) => sum + (targetMap[name] > 0 ? Number(competingIncludedData[name] || 0) : 0), 0)
    : 0

  const columns = useMemo(() => {
    const base = [
      { key: 'name', label: '구분', align: 'left' },
      { key: 'weighted', label: '가중분', align: 'right' },
      { key: 'duration', label: '순수분', align: 'right' },
      { key: 'avgRate', label: '평균 가중률', align: 'right' },
      { key: 'ratio', label: '비중', align: 'right' },
    ]
    if (showTarget) {
      base.push(
        { key: 'target', label: '목표 가중분', align: 'right' },
        { key: 'targetRatio', label: '목표 비중', align: 'right' },
        { key: 'achieve', label: '달성률', align: 'left' },
      )
    }
    if (showCompetingIncluded) {
      base.push(
        { key: 'competingWeighted', label: '(경쟁포함)가중분', align: 'right', assumed: true },
        { key: 'competingAchieve', label: '(경쟁포함)달성률', align: 'left' },
      )
    }
    return base
  }, [showTarget, showCompetingIncluded])

  const tableWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (colWidths[col.key] || DEFAULT_WIDTHS[col.key] || MIN_COL_WIDTH), 0),
    [columns, colWidths]
  )

  const startColumnResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[key] || DEFAULT_WIDTHS[key] || MIN_COL_WIDTH
    const onMove = mv => {
      const nextW = Math.max(MIN_COL_WIDTH, startW + mv.clientX - startX)
      setColWidths(prev => ({ ...prev, [key]: nextW }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths])

  const resizeHandle = key => (
    <span
      onMouseDown={e => startColumnResize(e, key)}
      onClick={e => e.stopPropagation()}
      title="컬럼 폭 조절"
      style={{
        position: 'absolute',
        top: 0,
        right: -7,
        width: 14,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 2,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      <span style={{ width: 1, height: '100%', background: 'var(--border2)', opacity: 0.95, pointerEvents: 'none' }} />
    </span>
  )

  const cellStyle = (key, extra = {}) => ({
    padding: '10px 14px',
    width: colWidths[key] || DEFAULT_WIDTHS[key] || MIN_COL_WIDTH,
    minWidth: colWidths[key] || DEFAULT_WIDTHS[key] || MIN_COL_WIDTH,
    maxWidth: colWidths[key] || DEFAULT_WIDTHS[key] || MIN_COL_WIDTH,
    borderRight: '1px solid var(--border)',
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ...extra,
  })

  const headerStyle = col => cellStyle(col.key, {
    position: 'relative',
    textAlign: col.align || 'left',
    fontSize: 11,
    color: 'var(--text2)',
    fontWeight: 600,
    userSelect: 'none',
    borderLeft: col.assumed ? '3px dashed var(--border2)' : undefined,
  })

  const barCell = (pct, color, weight = 700) => {
    if (pct == null) return '-'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? 'var(--green)' : pct >= 80 ? 'var(--yellow)' : color, transition: 'width .4s' }} />
        </div>
        <span style={{ fontSize: 11, minWidth: 40, textAlign: 'right', fontWeight: weight, color: pct >= 100 ? 'var(--green)' : pct >= 80 ? 'var(--yellow)' : 'var(--red)' }}>
          {Math.round(pct)}%
        </span>
      </div>
    )
  }

  const formatSignedNumber = value => {
    const rounded = Math.round(Number(value || 0))
    return rounded > 0 ? `+${rounded.toLocaleString()}` : rounded.toLocaleString()
  }

  const formatSignedPctPoint = value => {
    const rounded = Number(value || 0).toFixed(1)
    return Number(rounded) > 0 ? `+${rounded}` : rounded
  }

  const metricWithDelta = (main, delta, unit, fontSize) => (
    <>
      {main}
      <span style={{ fontSize, marginLeft: 4, fontWeight: 600 }}>
        ({unit === '분' ? formatSignedNumber(delta) : formatSignedPctPoint(delta)}{unit})
      </span>
    </>
  )

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: tableWidth, minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12 }}>
          <colgroup>
            {columns.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] || DEFAULT_WIDTHS[col.key] || MIN_COL_WIDTH }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
              {columns.map(col => (
                <th key={col.key} style={headerStyle(col)}>
                  {col.label}
                  {resizeHandle(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, weighted], i) => {
              const target = showTarget ? (targetMap[name] || 0) : 0
              const competingIncludedWeighted = showCompetingIncluded ? Number(competingIncludedData[name] || 0) : 0
              const competingIncludedPct = target > 0 ? (competingIncludedWeighted / target * 100) : null
              const totalPct = stats.totalWeighted > 0 ? (weighted / stats.totalWeighted * 100) : 0
              const previousWeighted = previousComparison ? Number(previousComparison.weighted?.[name] || 0) : weighted
              const previousPct = previousComparison ? Number(previousComparison.ratio?.[name] || 0) : totalPct
              const weightedDelta = previousComparison ? weighted - previousWeighted : 0
              const ratioDelta = previousComparison ? totalPct - previousPct : 0
              const targetPct = totalSlotWeighted > 0 && target > 0 ? (target / totalSlotWeighted * 100) : 0
              const achievePct = target > 0 ? (weighted / target * 100) : null
              const isDefault = name === '편성팀'
              const isCompeting = name === '경쟁'
              const isUnscheduled = name === '미편성'
              const teamColor = getTeamColor(name)
              const dm = groupDm[name] || 0
              const avgRate = dm > 0 ? (weighted / dm * 100).toFixed(1) + '%' : '-'

              return (
                <tr key={name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={cellStyle('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isDefault && !isCompeting && (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor, flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: 600, color: isCompeting ? 'var(--red)' : isDefault || isUnscheduled ? 'var(--text3)' : 'var(--text)' }}>
                        {name}
                      </span>
                    </div>
                  </td>
                  <td style={cellStyle('weighted', { textAlign: 'right', fontWeight: 700, color: isDefault || isUnscheduled ? 'var(--text3)' : teamColor })}>
                    {metricWithDelta(Math.round(weighted).toLocaleString(), weightedDelta, '분', 10)}
                  </td>
                  <td style={cellStyle('duration', { textAlign: 'right', color: 'var(--text2)' })}>
                    {dm > 0 ? dm.toLocaleString() : '-'}
                  </td>
                  <td style={cellStyle('avgRate', { textAlign: 'right', color: 'var(--text3)', fontSize: 11 })}>
                    {avgRate}
                  </td>
                  <td style={cellStyle('ratio', { textAlign: 'right', color: 'var(--text2)', fontSize: 11 })}>
                    {metricWithDelta(`${totalPct.toFixed(1)}%`, ratioDelta, '%p', 9)}
                  </td>
                  {showTarget && <>
                    <td style={cellStyle('target', { textAlign: 'right', color: 'var(--text2)' })}>
                      {target > 0 ? Math.round(target).toLocaleString() : '-'}
                    </td>
                    <td style={cellStyle('targetRatio', { textAlign: 'right', color: 'var(--text2)', fontSize: 11 })}>
                      {targetPct > 0 ? targetPct.toFixed(1) + '%' : '-'}
                    </td>
                    <td style={cellStyle('achieve')}>
                      {barCell(achievePct, teamColor)}
                    </td>
                  </>}
                  {showCompetingIncluded && <>
                    <td style={cellStyle('competingWeighted', { textAlign: 'right', fontWeight: 800, color: isDefault || isUnscheduled ? 'var(--text3)' : teamColor, borderLeft: '3px dashed var(--border2)' })}>
                      {target > 0 ? Math.round(competingIncludedWeighted).toLocaleString() : '-'}
                    </td>
                    <td style={cellStyle('competingAchieve')}>
                      {barCell(competingIncludedPct, teamColor, 800)}
                    </td>
                  </>}
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg3)' }}>
              <td style={cellStyle('name', { fontWeight: 700 })}>합계</td>
              <td style={cellStyle('weighted', { textAlign: 'right', fontWeight: 700, color: 'var(--accent)' })}>
                {metricWithDelta(
                  Math.round(stats.totalWeighted).toLocaleString(),
                  previousComparison ? stats.totalWeighted - Number(previousComparison.totalWeighted || 0) : 0,
                  '분',
                  10
                )}
              </td>
              <td style={cellStyle('duration', { textAlign: 'right', fontWeight: 700, color: 'var(--text2)' })}>{(stats.totalDm || 0) > 0 ? stats.totalDm.toLocaleString() : '-'}</td>
              <td style={cellStyle('avgRate', { textAlign: 'right', fontWeight: 700, color: 'var(--text2)', fontSize: 11 })}>
                {(stats.totalDm || 0) > 0 ? (stats.totalWeighted / stats.totalDm * 100).toFixed(1) + '%' : '-'}
              </td>
              <td style={cellStyle('ratio', { textAlign: 'right', fontWeight: 700, color: 'var(--text2)' })}>
                {metricWithDelta('100%', 0, '%p', 10)}
              </td>
              {showTarget && <>
                <td style={cellStyle('target', { textAlign: 'right', fontWeight: 700, color: 'var(--text2)' })}>
                  {totalTarget > 0 ? Math.round(totalTarget).toLocaleString() : '-'}
                </td>
                <td style={cellStyle('targetRatio', { textAlign: 'right', fontWeight: 700, color: 'var(--text2)' })}>
                  {totalSlotWeighted > 0 && totalTarget > 0 ? (totalTarget / totalSlotWeighted * 100).toFixed(1) + '%' : '-'}
                </td>
                <td style={cellStyle('achieve')}>
                  {totalTarget > 0 ? barCell((scheduledWeighted || 0) / totalTarget * 100, 'var(--accent)') : '-'}
                </td>
              </>}
              {showCompetingIncluded && <>
                <td style={cellStyle('competingWeighted', { textAlign: 'right', fontWeight: 800, color: 'var(--accent)', borderLeft: '3px dashed var(--border2)' })}>
                  {Math.round(competingIncludedTotal).toLocaleString()}
                </td>
                <td style={cellStyle('competingAchieve')}>
                  {totalTarget > 0 ? barCell(competingIncludedTotal / totalTarget * 100, 'var(--accent)', 800) : '-'}
                </td>
              </>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
