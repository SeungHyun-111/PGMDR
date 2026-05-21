export default function RatioSummaryCards({ stats, totalSlotWeighted, totalTarget, scheduledCount }) {
  const cards = [
    { label: '총 편성 가중분',   value: Math.round(stats.totalWeighted || 0).toLocaleString(), color: 'var(--accent)' },
    { label: '주간 슬롯 가중분', value: Math.round(totalSlotWeighted || 0).toLocaleString(),   color: 'var(--text2)' },
    { label: '전체 달성률',      value: totalTarget > 0 ? `${Math.round(stats.totalWeighted / totalTarget * 100)}%` : '-', color: stats.totalWeighted >= totalTarget && totalTarget > 0 ? 'var(--green)' : 'var(--yellow)' },
    { label: '경쟁 가중분',      value: Math.round(stats.competingWeighted || 0).toLocaleString(), color: 'var(--red)' },
    { label: '편성 완료 슬롯',   value: scheduledCount || 0, color: 'var(--green)' },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {cards.map(card => (
        <div key={card.label} style={{ flex: 1, minWidth: 120, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>{card.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}