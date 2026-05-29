// src/components/sidebar/ProductCard.jsx
import { useState, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductTooltip from './ProductTooltip'
import ConfirmActionModal from '../common/ConfirmActionModal'
import { getLastPerf } from '../../utils/entityKey'

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
  const dt = item.dealTypeConverted 

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
  const [ctxMenu, setCtxMenu]       = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const { starred, toggleStarred, deleteProposalItem, duplicateProposalItem, entityProps } = useScheduleStore()
  const isStarred = !!starred[item.itemId]
  const lastPerf = getLastPerf(item, entityProps, perfMap)
  const isNew = !!item.newProductType

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [ctxMenu])

  const handleDragStart = (e) => {
    setDragging(true)
    e.dataTransfer.setData('itemId', item.itemId)
    if (item.uniqueKey) e.dataTransfer.setData('uniqueKey', item.uniqueKey)
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

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setHover(false)
    setTooltipPos(null)
    const x = e.clientX + 130 > window.innerWidth ? e.clientX - 130 : e.clientX
    const y = e.clientY + 80  > window.innerHeight ? e.clientY - 80  : e.clientY
    setCtxMenu({ x, y })
  }

  return (
    <>
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
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
        {item.dealTypeConverted && (
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: dealTypeBg(item.dealTypeConverted), color: '#fff', fontWeight: 700, flexShrink: 0 }}>
            {item.dealTypeConverted}
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
        {item.memoCode && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(74,108,247,.16)', color: 'var(--accent)', fontWeight: 700 }}>
            {item.memoCode}
          </span>
        )}
        {item.scheduleComment && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(22,163,74,.14)', color: 'var(--green)', fontWeight: 700, maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.scheduleComment}
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

      {hover && tooltipPos && <ProductTooltip item={item} perfMap={perfMap} entityProps={entityProps} pos={tooltipPos} />}
    </div>

    {ctxMenu && (
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.4)', padding: '4px 0', minWidth: 120 }}>
        <button
          onClick={() => { duplicateProposalItem(item.itemId, item.uniqueKey); setCtxMenu(null) }}
          style={{ display: 'block', width: '100%', padding: '7px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
          복사
        </button>
        <button
          onClick={() => { setDeleteConfirm(true); setCtxMenu(null) }}
          style={{ display: 'block', width: '100%', padding: '7px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, color: 'var(--red, #f55)', cursor: 'pointer' }}>
          삭제
        </button>
      </div>
    )}
    {deleteConfirm && (
      <ConfirmActionModal
        title="제안상품 삭제"
        description={`[${item.pgmCodeName || '-'}]을 제안상품 목록에서 삭제할까요?`}
        confirmText="삭제"
        danger
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={() => {
          setDeleteConfirm(false)
          deleteProposalItem(item.itemId, item.uniqueKey)
        }}
      />
    )}
    </>
  )
}
