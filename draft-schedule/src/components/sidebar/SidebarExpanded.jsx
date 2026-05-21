import useScheduleStore from '../../store/useScheduleStore'
import usePerformanceMap from '../../hooks/usePerformanceMap'

export default function SidebarExpanded({ items, onClose }) {
  const { performanceRows, starred, toggleStarred } = useScheduleStore()
  const perfMap = usePerformanceMap(performanceRows)

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 280, background: 'var(--bg2)', borderTop: '2px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
          제안상품 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{items.length}건</span>
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕ 접기</button>
      </div>

      {/* 가로 스크롤 카드 목록 */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 8, padding: '8px 12px', alignItems: 'flex-start' }}>
        {items.map(item => {
          const lastPerf = perfMap[item.pgmCodeName]?.[0] || null
          const isStarred = !!starred[item.itemId]

          const handleDragStart = (e) => {
            e.dataTransfer.setData('itemId', item.itemId)
            e.dataTransfer.effectAllowed = 'move'
          }

          return (
            <div key={item.itemId} draggable onDragStart={handleDragStart}
              style={{ flexShrink: 0, width: 160, background: isStarred ? 'rgba(245,200,66,.08)' : 'var(--bg3)', border: `1px solid ${isStarred ? 'rgba(245,200,66,.4)' : 'var(--border)'}`, borderRadius: 6, padding: '8px 10px', cursor: 'grab', userSelect: 'none' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                <button onClick={() => toggleStarred(item.itemId)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: isStarred ? 'var(--yellow)' : 'var(--border2)', flexShrink: 0 }}>
                  {isStarred ? '★' : '☆'}
                </button>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.pgmCodeName}
                </div>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{item.mdTeam || '-'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {item.dealType && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{item.dealType}</span>}
                {item.newProductType && <span style={{ fontSize: 9, color: 'var(--yellow)', fontWeight: 700 }}>NEW</span>}
                {lastPerf?.profitPerWeightedMin != null && (
                  <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>
                    {Number(lastPerf.profitPerWeightedMin).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}