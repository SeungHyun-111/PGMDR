import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TEAM_COLORS = [
  '#4a6cf7', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
  '#ea580c', '#6366f1', '#14b8a6', '#f43f5e',
]

export { TEAM_COLORS }

const RADIAN = Math.PI / 180
const INNER_LABEL_MIN_PCT = 5
const OUTER_LABEL_MIN_PCT = 10
const SHORT = name => (name || '').replace(/팀$/, '')

const renderInnerLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
  if (!pct || pct < INNER_LABEL_MIN_PCT) return null
  const cos = Math.cos(-midAngle * RADIAN)
  const sin = Math.sin(-midAngle * RADIAN)
  const pctStr = pct.toFixed(1) + '%'
  const shortName = SHORT(name)

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

const renderOuterLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
  if (!pct || pct < OUTER_LABEL_MIN_PCT) return null
  const cos = Math.cos(-midAngle * RADIAN)
  const sin = Math.sin(-midAngle * RADIAN)
  const pctStr = pct.toFixed(1) + '%'
  const shortName = SHORT(name)

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

export default function RatioDonutChart({ chartData }) {
  if (!chartData || chartData.length === 0) return null

  const totalTarget = chartData.reduce((acc, d) => acc + (d.target || 0), 0)
  const totalActual = chartData.reduce((acc, d) => acc + (d.actual || 0), 0)
  const sortedData = chartData

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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.95fr) minmax(360px, 1.05fr)', gap: 28, alignItems: 'center' }}>
        <div style={{ height: 380, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 18px', alignItems: 'start' }}>
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
