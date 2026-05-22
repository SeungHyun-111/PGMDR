// src/components/sidebar/ProductCard.jsx
import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductTooltip from './ProductTooltip'

const DEAL_TYPE_COLORS = {
  '[위]': 'rgba(74,108,247,.75)',
  '[직]': 'rgba(50,180,90,.75)',
  '[혼]': 'rgba(180,100,245,.75)',
  '[모]': 'rgba(245,180,40,.85)',
  '[액]': 'rgba(245,120,50,.75)',
  '[률]': 'rgba(40,200,200,.75)',
}
function dealTypeBg(dt) { return DEAL_TYPE_COLORS[dt] || 'rgba(130,130,130,.5)' }

export function buildDragGhost(item) {
  const s = getComputedStyle(document.documentElement)
  const bg     = s.getPropertyValue('--bg3').trim()
  const accent = s.getPropertyValue('--accent').trim()
  const text   = s.getPropertyValue('--text').trim()
  const dt = item.dealTypeConverted || item.dealType || ''

  const ghost = document.createElement('div')
  Object.assign(ghost.style, {
    position: 'fixed', top: '-9999px', left: '-9999px',
    width: '210px',
    background: bg,
    border: `2px solid ${accent}`,
    borderRadius: '8px',
    padding: '9px 13px',
    boxShadow: '0 10px 32px rgba(0,0,0,.5)',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  })
  ghost.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
      ${dt ? `<span style="font-size:9px;padding:1px 7px;border-radius:3px;background:${accent};color:#fff;font-weight:700;letter-spacing:.03em">${dt}</span>` : ''}
      <span style="font-size:10px;color:${text};opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${item.mdTeam || ''}</span>
    </div>
    <div style="font-size:12px;font-weight:700;color:${text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.pgmCodeName || ''}</div>
  `
  return ghost
}

export default function ProductCard({ item, perfMap }) {
  const [hover, setHover]           = useState(false)
  const [dragging, setDragging]     = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)
  const { starred, toggleStarred } = useScheduleStore()
  const isStarred = !!starred[item.itemId]
  const lastPerf = item.perfKey ? (perfMap[item.perfKey] || null) : null
  const isNew = !!item.newProductType

  const handleDragStart = (e) => {
    setDragging(true)
    e.dataTransfer.setData('itemId', item.itemId)
    e.dataTransfer.effectAllowed = 'move'

    const ghost = buildDragGhost(item)
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 105, 28)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }

  const handleDragEnd = () => setDragging(false)

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.top })
    setHover(true)
  }

  const handleMouseLeave = () => {
    setHover(false)
    setTooltipPos(null)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-item-id={item.itemId}
      style={{
        position: 'relative',
        background: isNew ? 'rgba(245,200,66,.06)' : 'var(--bg3)',
        border: `1px solid ${isNew ? 'rgba(245,200,66,.35)' : 'var(--border)'}`,
        borderRadius: 6,
        padding: '7px 9px',
        marginBottom: 5,
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: dragging ? 0.45 : 1,
        transition: 'opacity .1s',
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

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }}>
        {(item.dealTypeConverted || item.dealType) && (
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: dealTypeBg(item.dealTypeConverted || item.dealType), color: '#fff', fontWeight: 700, flexShrink: 0 }}>
            {item.dealTypeConverted || item.dealType}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{item.mdCategory || '-'}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{item.mdTeam || item.team || '-'}</span>
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

      {hover && tooltipPos && <ProductTooltip item={item} perfMap={perfMap} pos={tooltipPos} />}
    </div>
  )
}