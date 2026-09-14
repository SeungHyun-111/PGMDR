export function EffBar({ pct, color, height = 6 }) {
  const clamp = Math.min(Math.max(pct || 0, 0), 100)
  const c = clamp >= 90 ? '#16a34a' : clamp >= 65 ? '#d97706' : '#dc2626'
  return (
    <div style={{ height, background: 'var(--bg4)', borderRadius: height / 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${clamp}%`, height: '100%', background: color || c, borderRadius: height / 2, transition: 'width .4s' }} />
    </div>
  )
}

export function HeroCard({ label, big, small, sub, color, pct, note }) {
  return (
    <div style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{big}</span>
        {small && <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{small}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>{sub}</div>}
      {pct != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <EffBar pct={pct} color={color} height={5} />
          <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 34, textAlign: 'right' }}>{Math.round(pct)}%</span>
        </div>
      )}
      {note && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, color, warn }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: 'var(--bg2)', border: `1px solid ${warn ? 'rgba(220,38,38,.5)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: warn ? 'var(--red)' : 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function ChartCard({ title, sub, right, children }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
        {sub && <span style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 700 }}>{sub}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  )
}
