import { Fragment } from 'react'

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color, marginBottom: 2 }}>{p.name}: <strong>{Math.round(p.value || 0).toLocaleString()}</strong></div>
      ))}
    </div>
  )
}

// ── daily chart tooltip (팀별 비중+효율) ──────────────────────────────────

export function DailyTeamTip({ active, payload, dailyTeamData, metric }) {
  if (!active || !payload?.length) return null
  const dateKey = payload[0]?.payload?.date
  const teamsMap = dateKey && dailyTeamData[dateKey]
  if (!teamsMap) return null
  const teams = Object.values(teamsMap).sort((a, b) => {
    if (a.name === '편성팀') return 1
    if (b.name === '편성팀') return -1
    return metric === 'sales' ? b.salesPerMin - a.salesPerMin : b.profitPerMin - a.profitPerMin
  })
  const color = metric === 'sales' ? 'var(--accent)' : 'var(--green)'
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.18)', minWidth: 220 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{dateKey}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '2px 10px', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>팀</span>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'right' }}>
          {metric === 'sales' ? '취급효율' : '한익효율'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'right' }}>비중</span>
        {teams.map(t => (
          <Fragment key={t.name}>
            <span style={{ color: 'var(--text2)' }}>{t.name}</span>
            <span style={{ color, fontWeight: 700, textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesPerMin : t.profitPerMin).toLocaleString()}
            </span>
            <span style={{ color: 'var(--text3)', textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesShare : t.profitShare).toFixed(1)}%
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

