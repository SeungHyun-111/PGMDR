// src/components/schedule/ScheduleBlock.jsx
import { useState, useEffect } from 'react'
import BlockEditModal from '../modal/BlockEditModal'
import useScheduleStore from '../../store/useScheduleStore'
import { getDealTypeChar } from '../../constants/dealTypes'

export default function ScheduleBlock({ block, height, saveBlock, removeBlock, dimmed = false }) {
  const [hover, setHover]               = useState(false)
  const [tooltipPos, setTooltipPos]     = useState(null)
  const [contextMenu, setContextMenu]   = useState(null)
  const [editModal, setEditModal]       = useState(false)
  const [annotationPopup, setAnnotationPopup] = useState(false)
  const [annotationText, setAnnotationText]   = useState('')
  const { returnBlockToSidebar, perfMap } = useScheduleStore()

  // 클릭 시 context menu 닫기 + hover 상태도 함께 초기화 (tooltip 잔류 방지)
  useEffect(() => {
    const handler = () => {
      setContextMenu(null)
      setHover(false)
      setTooltipPos(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const isDefault   = block.isDefault
  const isCompeting = block.isCompeting
  const hasAnnotation = !!block.annotation
  const hasHash = !!(block.scheduleComment && block.scheduleComment.includes('#'))

  const npt = block.newProductType || ''
  const prodTypeChar = npt === '신상품' ? '(신)' : (npt === '재녹화' || npt === '재편집') ? '(재)' : ''

  const dealType  = block.dealTypeConverted || block.dealType || ''
  const isDirect  = dealType.includes('[직]') || dealType.includes('직매입')
  const isPurple  = dealType.includes('[모]') || dealType.includes('모바일광고')
                 || dealType.includes('[혼]') || dealType.includes('혼합')
                 || dealType.includes('[액]') || dealType.includes('정액')
  const isGreenBg = !isDirect && !isPurple && hasHash

  const teamShort = isCompeting
    ? '경쟁'
    : ((block.mdTeam || block.orgName || '').replace('팀', '').slice(0, 2))

  const dealChar = isCompeting ? '' : getDealTypeChar(block.dealType || block.dealTypeChar || '')

  const isPgmTeam = block.pgmCodeName === '[편성팀]'

  const bgColor = isCompeting ? '#8b0000'
    : isPgmTeam  ? 'var(--bg3)'
    : isDirect   ? '#1d4ed8'
    : isPurple   ? '#7c3aed'
    : isGreenBg  ? '#166534'
    : 'var(--bg2)'

  const borderColor = isCompeting ? '#ff4444'
    : isPgmTeam  ? 'var(--text3)'
    : isDirect   ? 'rgba(59,130,246,.5)'
    : isPurple   ? 'rgba(139,92,246,.5)'
    : isGreenBg  ? 'rgba(34,197,94,.5)'
    : 'var(--border)'

  const isColored = isCompeting || isDirect || isPurple || isGreenBg
  const textColor = isColored ? '#fff' : 'var(--text)'
  const fontSize  = height > 30 ? 10 : 9
  const badgeSz   = Math.max(7, fontSize - 1)
  const badgeBg   = isColored ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.07)'

  const handleDragStart = (e) => {
    if (isCompeting) { e.preventDefault(); return }
    setHover(false)
    setTooltipPos(null)
    e.stopPropagation()
    e.dataTransfer.setData('blockKey', block.blockKey || block.slotId)
    e.dataTransfer.setData('itemId', block.itemId || '')
    e.dataTransfer.setData('isBlock', 'true')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleMouseEnter = (e) => {
    if (contextMenu || editModal || annotationPopup) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.right + 6, y: rect.top })
    setHover(true)
  }

  const handleMouseLeave = () => {
    setHover(false)
    setTooltipPos(null)
  }

  const handleSaveAnnotation = () => {
    saveBlock(block.blockKey || block.slotId, { annotation: annotationText })
    setAnnotationPopup(false)
  }

  const menuItems = [
    { label: '수정', action: () => setEditModal(true) },
    { label: hasAnnotation ? '첨삭 수정' : '첨삭 추가', action: () => { setAnnotationText(block.annotation || ''); setAnnotationPopup(true) } },
    ...(!isCompeting ? [
      { label: '사이드바로 반환', action: () => returnBlockToSidebar(block) },
      { label: '삭제', action: () => removeBlock(block.blockKey || block.slotId), danger: true },
    ] : []),
    ...(isCompeting ? [
      { label: '경쟁 해제', action: () => removeBlock(block.blockKey || block.slotId), danger: true },
    ] : []),
  ]

  const lastPerf = block.perfKey ? (perfMap[block.perfKey] || null) : null

  return (
    <div style={{ position: 'absolute', inset: '1px', opacity: dimmed ? 0.12 : 1, transition: 'opacity .15s' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        draggable={!isCompeting}
        onDragStart={handleDragStart}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          // 화면 경계 벗어남 방지
          const approxH = menuItems.length * 34 + 10
          const approxW = 170
          const y = e.clientY + approxH > window.innerHeight ? e.clientY - approxH : e.clientY
          const x = e.clientX + approxW > window.innerWidth  ? e.clientX - approxW : e.clientX
          setContextMenu({ x, y })
        }}
        onDoubleClick={() => setEditModal(true)}
        style={{ position: 'absolute', inset: 0, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 3, overflow: 'hidden', cursor: isCompeting ? 'default' : 'grab', display: 'flex', alignItems: 'center', padding: '0 4px', gap: 3 }}
      >
        {teamShort && (
          <span style={{ fontSize: badgeSz, fontWeight: 700, color: textColor, background: badgeBg, padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {teamShort}
          </span>
        )}
        {dealChar && !isCompeting && (
          <span style={{ fontSize: badgeSz, fontWeight: 700, color: textColor, background: badgeBg, padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {dealChar}
          </span>
        )}
        {prodTypeChar && !isCompeting && (
          <span style={{ fontSize: badgeSz, fontWeight: 700, color: npt === '신상품' ? '#fef08a' : '#93c5fd', background: npt === '신상품' ? 'rgba(234,179,8,.25)' : 'rgba(59,130,246,.25)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {prodTypeChar}
          </span>
        )}
        {(block.channel === 'CA' || block.channel === 'IP') && !isCompeting && (
          <span style={{ fontSize: badgeSz, fontWeight: 700, color: block.channel === 'CA' ? 'var(--ca-t)' : 'var(--ip-t)', background: block.channel === 'CA' ? 'var(--ca)' : 'var(--ip)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {block.channel}
          </span>
        )}
        <span style={{ fontSize, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {block.pgmCodeName}
        </span>
        {(block.weightedMin || 0) > 0 && (
          <span style={{ fontSize: badgeSz, color: isColored ? 'rgba(255,255,255,.45)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {block.weightedMin}
          </span>
        )}
        {hasAnnotation && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 8px 8px 0', borderColor: `transparent var(--yellow) transparent transparent` }} />
        )}
        {hasHash && (
          <div style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 8, color: 'rgba(100,220,100,.8)', fontWeight: 700 }}>#</div>
        )}
      </div>

      {/* 툴팁: contextMenu/editModal/annotationPopup 없을 때만 표시 */}
      {hover && tooltipPos && !contextMenu && !editModal && !annotationPopup && (
        <BlockTooltip block={block} lastPerf={lastPerf} pos={tooltipPos} />
      )}

      {contextMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 0', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
          {menuItems.map(item => (
            <button key={item.label}
              onClick={() => { item.action(); setContextMenu(null) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', background: 'transparent', border: 'none', color: item.danger ? 'var(--red)' : 'var(--text)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{item.label}</button>
          ))}
        </div>
      )}

      {annotationPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setAnnotationPopup(false) }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>📎 첨삭 — {block.pgmCodeName}</div>
            <textarea value={annotationText} onChange={e => setAnnotationText(e.target.value)} rows={5} autoFocus
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 5, fontSize: 12, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {block.annotation && (
                <button onClick={() => { saveBlock(block.blockKey || block.slotId, { annotation: '' }); setAnnotationPopup(false) }}
                  style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>삭제</button>
              )}
              <button onClick={() => setAnnotationPopup(false)}
                style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={handleSaveAnnotation}
                style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <BlockEditModal
          block={block}
          onClose={() => setEditModal(false)}
          saveBlock={saveBlock}
        />
      )}
    </div>
  )
}

function BlockTooltip({ block, lastPerf, pos }) {
  // 화면 오른쪽/아래 잘림 방지
  const tooltipW = 230
  const approxH  = block.isCompeting ? 150 : (block.annotation ? 290 : 220)
  const left = pos.x + tooltipW > window.innerWidth ? pos.x - tooltipW - 12 : pos.x
  const top  = Math.min(pos.y, window.innerHeight - approxH - 8)

  const rows = [
    ['팀',       block.mdTeam || block.orgName || '-'],
    ['채널',     block.channel || '-'],
    ['거래형태', block.dealType || '-'],
    ['신상품구분', block.newProductType || '-'],
    ['카테고리', block.mdCategory || '-'],
    ['방송일시', `${block.dateKey} ${block.timeText}`],
    ['방송시간', `${block.durationMin}분`],
    ['가중분',   block.weightedMin || '-'],
    ['메모코드', block.memoCode || '-'],
    ['편성C',    block.scheduleComment || '-'],
    ...(block.annotation ? [['첨삭', block.annotation]] : []),
  ]

  return (
    <div style={{ position: 'fixed', left, top, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', minWidth: tooltipW, maxWidth: 300, boxShadow: '0 4px 16px rgba(0,0,0,.3)', pointerEvents: 'none' }}>
      {block.isCompeting ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚔ 경쟁 중</div>
          {[block.item1, block.item2].filter(Boolean).map((item, i) => (
            <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? 'var(--ca-t)' : 'var(--ip-t)', marginBottom: 3 }}>{i === 0 ? '● 기존' : '● 신규'}</div>
              {[['상품', item.pgmCodeName], ['팀', item.mdTeam || '-'], ['거래형태', item.dealType || '-']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 46 }}>{l}</span>
                  <span style={{ color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
              <span style={{ color: label === '첨삭' ? 'var(--yellow)' : 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{val}</span>
            </div>
          ))}
          {lastPerf && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>직전 실적 ({lastPerf.broadcastDate})</div>
              {[
                ['취급/분', Number(lastPerf.salesPerWeightedMin  || 0).toLocaleString(), 'var(--accent)'],
                ['한익/분', Number(lastPerf.profitPerWeightedMin || 0).toLocaleString(), 'var(--green)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
