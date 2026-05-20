import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const TEAM_COLORS = [
  '#4a6cf7', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#be185d', '#65a30d',
  '#ea580c', '#6366f1', '#14b8a6', '#f43f5e'
]

export { TEAM_COLORS }

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

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
  if (pct < 4) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700}>
      {name.replace('팀', '')}
    </text>
  )
}

export default function RatioDonutChart({ chartData }) {
  if (!chartData || chartData.length === 0) return null

  const totalTarget = chartData.reduce((acc, d) => acc + (d.target || 0), 0)
  const totalActual = chartData.reduce((acc, d) => acc + (d.actual || 0), 0)

  // 바깥 원: 목표 기준 정렬 (목표 없는 항목은 뒤로)
  const outerOrder = [...chartData].sort((a, b) => (b.target || 0) - (a.target || 0))

  // 안쪽 원: 바깥 원과 동일한 순서 유지
  // 목표 없는 팀(편성팀, 경쟁 등)은 안쪽 원 끝에 추가
  const outerNames = new Set(outerOrder.map(d => d.name))
  const innerOnly = chartData.filter(d => !outerNames.has(d.name) || d.target === 0)
  const innerOrder = [
    ...outerOrder.map(d => chartData.find(c => c.name === d.name)).filter(Boolean),
    ...innerOnly.filter(d => !outerOrder.find(o => o.name === d.name))
  ]

  const outerData = outerOrder
    .filter(d => (d.target || 0) > 0)
    .map(d => ({ ...d, value: d.target, pct: totalTarget > 0 ? d.target / totalTarget * 100 : 0 }))

  const innerData = innerOrder
    .filter(d => (d.actual || 0) > 0)
    .map(d => ({ ...d, value: d.actual, pct: totalActual > 0 ? d.actual / totalActual * 100 : 0 }))

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>팀별 편성비중 비교</div>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text3)' }} />
            <span>바깥: 목표</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 8, borderRadius: 2, background: 'var(--text2)' }} />
            <span>안쪽: 실제</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <ResponsiveContainer width="55%" height={320}>
          <PieChart>
            <Pie
              data={outerData}
              cx="50%" cy="50%"
              startAngle={90} endAngle={-270}
              innerRadius={95} outerRadius={135}
              dataKey="value"
              paddingAngle={1}
              labelLine={false}
              label={renderCustomLabel}
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
              label={renderCustomLabel}
            >
              {innerData.map((entry, i) => (
                <Cell key={`inner-${i}`} fill={entry.color} opacity={1} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* 범례 - 바깥 원 순서 기준 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {outerOrder.map(d => {
            const achievePct = d.target > 0 ? Math.round(d.actual / d.target * 100) : null
            const barWidth = d.target > 0 ? Math.min(d.actual / d.target * 100, 100) : 0
            const barColor = achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : d.color
            return (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{d.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : 'var(--red)' }}>
                      {achievePct !== null ? `${achievePct}%` : '-'}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${barWidth}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                    실 {d.actual.toLocaleString()} / 목 {d.target.toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
          {/* 목표 없는 항목 (편성팀, 경쟁 등) */}
          {chartData.filter(d => !d.target).map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{d.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{d.actual.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}