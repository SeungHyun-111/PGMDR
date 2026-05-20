export default function ProductCard({ item, perfList = [], manualInput }) {
  const lastPerf = perfList.length > 0 ? perfList[perfList.length - 1] : null
  const salesPerf = manualInput?.salesPerWeightedMin ?? lastPerf?.salesPerWeightedMin ?? null
  const isManual = !!manualInput?.salesPerWeightedMin

  const teamColor = item.mdTeam?.includes('IP') ? 'var(--ip-t)' : 'var(--ca-t)'
  const teamBg = item.mdTeam?.includes('IP') ? 'var(--ip)' : 'var(--ca)'

  const handleDragStart = (e) => {
    e.dataTransfer.setData('itemId', item.itemId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 5, padding: '6px 8px', marginBottom: 4,
        cursor: 'grab', userSelect: 'none', transition: 'border-color .15s'
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {item.pgmCodeName || item.programName || '상품명 없음'}
        </div>
        <div style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: teamBg, color: teamColor, fontWeight: 700, flexShrink: 0 }}>
          {item.mdTeam || '-'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {item.dealType && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{item.dealType}</span>}
        {item.newProductType && <span style={{ fontSize: 9, color: 'var(--yellow)', fontWeight: 700 }}>NEW</span>}
        {salesPerf != null ? (
          <span style={{ fontSize: 9, color: isManual ? 'var(--orange)' : 'var(--green)', fontWeight: 700 }}>
            {isManual ? '✏ ' : ''}{Number(salesPerf).toLocaleString()}원
          </span>
        ) : (
          <span style={{ fontSize: 9, color: 'var(--red)' }}>실적없음</span>
        )}
        {item.availableWeightedMin1 > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text3)' }}>가용 {item.availableWeightedMin1}분</span>
        )}
      </div>
    </div>
  )
}