import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TEAM_COLORS = [
  '#4a6cf7', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
  '#ea580c', '#6366f1', '#14b8a6', '#f43f5e'
]

export { TEAM_COLORS }

const RADIAN = Math.PI / 180
const SHORT = name => (name || '').replace(/팀$/, '')

// 안쪽 링(실제): 크면 팀명+% 2줄 내부 표기, 작으면 → 중심 홀 방향 지시선
const renderInnerLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
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

  // 홀 안쪽으로 지시선 — 바깥 링 지시선과 같은 각도 축
  const sx = cx + (innerRadius - 1) * cos
  const sy = cy + (innerRadius - 1) * sin
  const lx = cx + 28 * cos
  const ly = cy + 28 * sin
  return (
    <g>
      <line x1={sx} y1={sy} x2={lx} y2={ly} stroke="var(--text3)" strokeWidth={0.8} />
      <text textAnchor="middle" fontSize={7} fontWeight={600} fill="var(--text3)">
        <tspan x={lx} y={ly - 4}>{shortName}</tspan>
        <tspan x={lx} y={ly + 5}>{pctStr}</tspan>
      </text>
    </g>
  )
}

// 바깥 링(목표): 크면 팀명+% 2줄 내부 표기, 작으면 → 차트 외부 꺾임 지시선
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
      <div style={{ color: 'var(--text2)' }}>{d.value?.toLocaleString()} 분 ({d.payload?.pct?.toFixed(1)}%)</div>
    </div>
  )
}

export default function RatioDonutChart({ chartData }) {
  if (!chartData || chartData.length === 0) return null

  const totalTarget = chartData.reduce((acc, d) => acc + (d.target || 0), 0)
  const totalActual = chartData.reduce((acc, d) => acc + (d.actual || 0), 0)

  const sortedData = [...chartData].sort((a, b) => {
    const hasA = (a.target || 0) > 0
    const hasB = (b.target || 0) > 0
    if (hasA !== hasB) return hasB ? 1 : -1
    return hasA ? (b.target - a.target) : (b.actual - a.actual)
  })

  const outerData = sortedData
    .filter(d => (d.target || 0) > 0)
    .map(d => ({ ...d, value: d.target, pct: totalTarget > 0 ? d.target / totalTarget * 100 : 0 }))

  const innerData = sortedData
    .filter(d => (d.actual || 0) > 0)
    .map(d => ({ ...d, value: d.actual, pct: totalActual > 0 ? d.actual / totalActual * 100 : 0 }))

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>팀별 편성비중 비교</div>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text3)', opacity: 0.5 }} />
            <span>바깥: 목표</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text2)' }} />
            <span>안쪽: 실제</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ResponsiveContainer width="55%" height={360}>
          <PieChart margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
            <Pie
              data={outerData}
              cx="50%" cy="50%"
              startAngle={90} endAngle={-270}
              innerRadius={95} outerRadius={135}
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
              innerRadius={50} outerRadius={90}
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
                    <span style={{ fontSize: 11, fontWeight: 600, color: hasTarget ? 'var(--text)' : 'var(--text3)' }}>{d.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : hasTarget ? 'var(--red)' : 'var(--text3)' }}>
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
