// src/components/sidebar/ProductCard.jsx
import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductTooltip from './ProductTooltip'

export default function ProductCard({ item, perfMap }) {
  const [hover, setHover] = useState(false)
  const { starred, toggleStarred } = useScheduleStore()
  const isStarred = !!starred[item.itemId]
  const lastPerf = perfMap[item.perfKey] || null
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
      style={{
        position: 'relative',
        background: isNew ? 'rgba(245,200,66,.06)' : 'var(--bg3)',
        border: `1px solid ${isNew ? 'rgba(245,200,66,.35)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 9px',
        marginBottom: 5,
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleStarred(item.itemId) }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: isStarred ? 'var(--yellow)' : 'var(--border2)', flexShrink: 0, lineHeight: 1 }}
        >
          {isStarred ? '★' : '☆'}
        </button>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {item.pgmCodeName}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{item.mdCategory || '-'}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{item.mdTeam || item.team || '-'}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{item.dealTypeConverted || item.dealType || '-'}</span>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
        {item.brand && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{item.brand}</span>}
        {item.newProductType && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,200,66,.2)', color: 'var(--yellow)', fontWeight: 700 }}>
            {item.newProductType}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
        <span style={{ color: 'var(--text3)' }}>취급/분</span>
        <strong style={{ color: 'var(--accent)' }}>
          {lastPerf ? Number(lastPerf.salesPerWeightedMin || 0).toLocaleString() : '-'}
        </strong>
        <span style={{ color: 'var(--text3)' }}>한익/분</span>
        <strong style={{ color: 'var(--green)' }}>
          {lastPerf ? Number(lastPerf.profitPerWeightedMin || 0).toLocaleString() : '-'}
        </strong>
      </div>

      {hover && <ProductTooltip item={item} perfMap={perfMap} />}
    </div>
  )
}