import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductTooltip from './ProductTooltip'
import { findBestPerf } from '../../hooks/usePerformanceMap'

export default function ProductCard({ item, perfMap, index }) {
  const [hover, setHover] = useState(false)
  const { starred, toggleStarred } = useScheduleStore()
  const isStarred = !!starred[item.itemId]
  const lastPerf = findBestPerf(perfMap, item.dealType, item.pgmCodeName)
  const isNew = !!item.newProductType

  const handleDragStart = (e) => {
    e.dataTransfer.setData('itemId', item.itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', marginBottom: 4 }}
    >
      <div style={{
        background: isStarred ? 'rgba(245,200,66,.08)' : 'var(--bg3)',
        border: `1px solid ${isStarred ? 'rgba(245,200,66,.4)' : hover ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 5, padding: '6px 8px', cursor: 'grab',
        userSelect: 'none', transition: 'all .15s'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 3 }}>
          <button
            onClick={e => { e.stopPropagation(); toggleStarred(item.itemId) }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, fontSize: 11, color: isStarred ? 'var(--yellow)' : 'var(--border2)', lineHeight: 1 }}>
            {isStarred ? '★' : '☆'}
          </button>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.pgmCodeName || '-'}
          </div>
          <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'var(--ca)', color: 'var(--ca-t)', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {item.mdTeam || '-'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {item.dealType && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{item.dealType}</span>}
          {isNew && <span style={{ fontSize: 9, color: 'var(--yellow)', fontWeight: 700 }}>NEW</span>}
          {lastPerf?.profitPerWeightedMin != null ? (
            <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700 }}>
              {Number(lastPerf.profitPerWeightedMin).toLocaleString()}
            </span>
          ) : (
            <span style={{ fontSize: 9, color: 'var(--red)' }}>실적없음</span>
          )}
          {item.availableWeightedMin1 > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>가용 {item.availableWeightedMin1}</span>
          )}
        </div>
      </div>
      {hover && <ProductTooltip item={item} perfMap={perfMap} />}
    </div>
  )
}