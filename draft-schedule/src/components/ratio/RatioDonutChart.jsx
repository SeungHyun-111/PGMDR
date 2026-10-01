import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TEAM_COLORS = [
  '#4a6cf7', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
  '#ea580c', '#6366f1', '#14b8a6', '#f43f5e',
]

export { TEAM_COLORS }

const RADIAN = Math.PI / 180
const SHORT = name => (name || '').replace(/팀$/, '')

const makeInnerLabelRenderer = isLarge => {
  const labelSlots = { left: [], right: [] }

  const placeLabelY = (desiredY, side) => {
    if (!isLarge) return desiredY
    const minGap = 28
    const minY = 36
    const maxY = 324
    const clamp = value => Math.max(minY, Math.min(maxY, value))
    const baseY = clamp(desiredY)
    const offsets = [0, 28, -28, 56, -56, 84, -84, 112, -112, 140, -140]
    let y = baseY

    for (const offset of offsets) {
      const candidate = clamp(baseY + offset)
      if (!labelSlots[side].some(existing => Math.abs(existing - candidate) < minGap)) {
        y = candidate
        break
      }
    }
    labelSlots[side].push(y)
    return y
  }

  return ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name, payload }) => {
  if (!pct || pct < 0.5) return null
  const cos = Math.cos(-midAngle * RADIAN)
  const sin = Math.sin(-midAngle * RADIAN)
  const pctStr = pct.toFixed(1) + '%'
  const shortName = SHORT(name)
  const mainFontSize = isLarge ? 9.2 : 8
  const subFontSize = isLarge ? 8.1 : 7

  if (pct >= 5) {
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * cos
    const y = cy + r * sin
    return (
      <text textAnchor="middle" fontSize={mainFontSize} fontWeight={700} fill="#fff">
        <tspan x={x} y={y - 5}>{shortName}</tspan>
        <tspan x={x} y={y + 6}>{pctStr}</tspan>
      </text>
    )
  }

  const sx = cx + (isLarge ? outerRadius + 4 : innerRadius - 1) * cos
  const sy = cy + (isLarge ? outerRadius + 4 : innerRadius - 1) * sin
  const mx = cx + (isLarge ? outerRadius + 18 : 28) * cos
  const my = cy + (isLarge ? outerRadius + 18 : 28) * sin
  const isRight = cos >= 0
  const side = isRight ? 'right' : 'left'
  const lx = isLarge ? mx + (isRight ? 34 : -34) : mx
  const ly = payload?.calloutY ?? placeLabelY(my, side)
  return (
    <g>
      {isLarge ? (
        <polyline points={`${sx},${sy} ${mx},${my} ${lx},${ly}`} fill="none" stroke="var(--text3)" strokeWidth={0.8} />
      ) : (
        <line x1={sx} y1={sy} x2={lx} y2={ly} stroke="var(--text3)" strokeWidth={0.8} />
      )}
      <text textAnchor={isLarge ? (isRight ? 'start' : 'end') : 'middle'} fontSize={subFontSize} fontWeight={600} fill="var(--text3)">
        <tspan x={lx} y={ly - 4}>{shortName}</tspan>
        <tspan x={lx} y={ly + 5}>{pctStr}</tspan>
      </text>
    </g>
  )
}
}

const renderOuterLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
  if (!pct || pct < 0.5) return null
  const cos = Math.cos(-midAngle * RADIAN)
  const sin = Math.sin(-midAngle * RADIAN)
  const pctStr = pct.toFixed(1) + '%'
  const shortName = SHORT(name)

  if (pct >= 5) {
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * cos
    const y = cy + r * sin
    return (
      <text textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
        <tspan x={x} y={y - 5}>{shortName}</tspan>
        <tspan x={x} y={y + 6}>{pctStr}</tspan>
      </text>
    )
  }

  const sx = cx + (outerRadius + 2) * cos
  const sy = cy + (outerRadius + 2) * sin
  const mx = cx + (outerRadius + 16) * cos
  const my = cy + (outerRadius + 16) * sin
  const isRight = cos >= 0
  const ex = mx + (isRight ? 10 : -10)
  const ey = my
  const textX = ex + (isRight ? 3 : -3)
  return (
    <g>
      <circle cx={sx} cy={sy} r={1.5} fill="var(--text3)" />
      <polyline points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
        fill="none" stroke="var(--text3)" strokeWidth={0.8} />
      <text x={textX} y={ey} fill="var(--text2)"
        textAnchor={isRight ? 'start' : 'end'} dominantBaseline="central" fontSize={8}>
        {shortName} {pctStr}
      </text>
    </g>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{d.name}</div>
      <div style={{ color: 'var(--text2)' }}>{d.value?.toLocaleString()}분 ({d.payload?.pct?.toFixed(1)}%)</div>
    </div>
  )
}

function spreadSmallLabelY(data, outerRadius) {
  const minGap = 28
  const minY = 36
  const maxY = 324
  const centerY = 180
  const radius = outerRadius + 18
  const total = data.reduce((acc, item) => acc + Number(item.value || 0), 0)
  if (total <= 0) return data

  let cursor = 90
  const withAngles = data.map(item => {
    const angle = Number(item.value || 0) / total * 360
    const midAngle = cursor - angle / 2
    cursor -= angle
    const sin = Math.sin(-midAngle * RADIAN)
    const cos = Math.cos(-midAngle * RADIAN)
    return {
      ...item,
      _desiredY: Math.max(minY, Math.min(maxY, centerY + radius * sin)),
      _side: cos >= 0 ? 'right' : 'left',
    }
  })

  const assigned = new Map()
  ;['left', 'right'].forEach(side => {
    const labels = withAngles
      .filter(item => item.pct > 0 && item.pct < 5 && item._side === side)
      .sort((a, b) => a._desiredY - b._desiredY)

    labels.forEach((item, index) => {
      const prev = index > 0 ? assigned.get(labels[index - 1].name) : null
      const y = Math.max(item._desiredY, prev == null ? minY : prev + minGap)
      assigned.set(item.name, y)
    })

    const overflow = labels.length ? (assigned.get(labels[labels.length - 1].name) || 0) - maxY : 0
    if (overflow > 0) {
      labels.forEach(item => assigned.set(item.name, Math.max(minY, (assigned.get(item.name) || item._desiredY) - overflow)))
    }
  })

  return withAngles.map(item => ({
    ...item,
    calloutY: assigned.get(item.name),
  }))
}

export default function RatioDonutChart({ chartData, sizeMode = 'normal' }) {
  if (!chartData || chartData.length === 0) return null

  const isLarge = sizeMode === 'large'
  const chartHeight = 360
  const chartWidth = '55%'
  const outerInnerRadius = isLarge ? 143 : 95
  const outerOuterRadius = isLarge ? 203 : 135
  const innerInnerRadius = isLarge ? 75 : 50
  const innerOuterRadius = isLarge ? 135 : 90
  const renderInnerLabel = makeInnerLabelRenderer(isLarge)

  const totalTarget = chartData.reduce((acc, d) => acc + (d.target || 0), 0)
  const totalActual = chartData.reduce((acc, d) => acc + (d.actual || 0), 0)
  const sortedData = chartData

  const outerData = sortedData
    .filter(d => (d.target || 0) > 0)
    .map(d => ({ ...d, value: d.target, pct: totalTarget > 0 ? d.target / totalTarget * 100 : 0 }))

  const innerBaseData = sortedData
    .filter(d => (d.actual || 0) > 0)
    .map(d => ({ ...d, value: d.actual, pct: totalActual > 0 ? d.actual / totalActual * 100 : 0 }))
  const innerData = isLarge ? spreadSmallLabelY(innerBaseData, innerOuterRadius) : innerBaseData

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>팀별 편성비중 비교</div>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 11, color: 'var(--text2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text3)', opacity: 0.7 }} />
            <span>바깥원: 목표</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text2)' }} />
            <span>안쪽원: 실제 + 미편성</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ResponsiveContainer width={chartWidth} height={chartHeight}>
          <PieChart margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
            <Pie
              data={outerData}
              cx="50%" cy="50%"
              startAngle={90} endAngle={-270}
              innerRadius={outerInnerRadius} outerRadius={outerOuterRadius}
              dataKey="value"
              paddingAngle={1}
              labelLine={false}
              label={renderOuterLabel}
            >
              {outerData.map((entry, i) => (
                <Cell key={`outer-${i}`} fill={entry.color} opacity={0.5} stroke="none" />
              ))}
            </Pie>
            <Pie
              data={innerData}
              cx="50%" cy="50%"
              startAngle={90} endAngle={-270}
              innerRadius={innerInnerRadius} outerRadius={innerOuterRadius}
              dataKey="value"
              paddingAngle={1}
              labelLine={false}
              label={renderInnerLabel}
            >
              {innerData.map((entry, i) => (
                <Cell key={`inner-${i}`} fill={entry.color} opacity={1} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedData.map(d => {
            const hasTarget = (d.target || 0) > 0
            const achievePct = hasTarget ? Math.round(d.actual / d.target * 100) : null
            const barWidth = hasTarget ? Math.min(d.actual / d.target * 100, 100) : 0
            const barColor = achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : d.color
            return (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasTarget ? 3 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: d.name === '미편성' ? '#64748b' : hasTarget ? 'var(--text)' : 'var(--text3)' }}>{d.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : hasTarget ? 'var(--red)' : d.color }}>
                      {achievePct !== null ? `${achievePct}%` : d.actual.toLocaleString()}
                    </span>
                  </div>
                  {hasTarget && <>
                    <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                      실 {d.actual.toLocaleString()} / 목 {d.target.toLocaleString()}
                    </div>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
