import { useState, useRef, useEffect } from 'react'
import BlockEditModal from '../modal/BlockEditModal'
import useScheduleStore from '../../store/useScheduleStore'

function getDealTypeChar(block) {
  if (block.dealTypeChar) return block.dealTypeChar
  if (!block.dealType) return ''
  if (block.dealType.includes('모바일광고')) return '광'
  return block.dealType.charAt(0)
}

function getTeamShort(name) {
  if (!name) return ''
  return name.length > 2 ? name.slice(0, 2) : name
}

export default function ScheduleBlock({ block, height, fontSize = 9, removeBlock, saveBlock }) {
  const [hover, setHover] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [annotationPopup, setAnnotationPopup] = useState(false)
  const [annotationText, setAnnotationText] = useState(block.annotation || '')
  const menuRef = useRef(null)
  const { copyBlockToSidebar } = useScheduleStore()

  useEffect(() => {
    const handler = () => setContextMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const isDefault = block.isDefault
  const isCompeting = block.isCompeting
  const isIP = block.channel === 'IP'
  const isAll = block.channel === 'ALL'

  const bgColor = isCompeting
    ? '#8b0000'
    : isDefault ? '#111318'
    : isIP ? 'var(--ip2)'
    : isAll ? 'var(--all2)'
    : 'var(--ca2)'

  const borderColor = isCompeting
    ? '#ff4444'
    : isDefault ? 'var(--border2)'
    : isIP ? 'rgba(196,126,245,.35)'
    : isAll ? 'rgba(127,212,127,.35)'
    : 'rgba(126,179,245,.35)'

  const textColor = isCompeting ? '#ffd700' : '#fff'
  const teamShort = isCompeting ? '경쟁' : getTeamShort(block.orgName || block.mdTeam)
  const dealChar = isCompeting ? '' : getDealTypeChar(block)
  const pgmName = block.pgmCodeName || ''
  const weightedMin = block.weightedMin || 0
  const badgeFontSize = Math.max(7, fontSize - 1)
  const hasAnnotation = !!block.annotation

  const handleDragStart = (e) => {
    if (isDefault || isCompeting) { e.preventDefault(); return }
    e.stopPropagation()
    e.dataTransfer.setData('blockKey', block.blockKey || block.slotId)
    e.dataTransfer.setData('itemId', block.itemId || '')
    e.dataTransfer.setData('isBlock', 'true')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    removeBlock(block.blockKey || block.slotId)
    setContextMenu(null)
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    copyBlockToSidebar(block)
    setContextMenu(null)
  }

  const handleSaveAnnotation = () => {
    saveBlock(block.blockKey || block.slotId, { annotation: annotationText })
    setAnnotationPopup(false)
  }

  const menuItems = [
    { label: '수정', action: () => { setEditModal(true); setContextMenu(null) } },
    { label: hasAnnotation ? '첨삭 수정' : '첨삭 추가', action: () => { setAnnotationText(block.annotation || ''); setAnnotationPopup(true); setContextMenu(null) } },
    ...(!isDefault && !isCompeting ? [
      { label: '복사 → 사이드바', action: handleCopy },
      { label: '삭제 (디폴트 복원)', action: handleDelete, danger: true },
    ] : []),
    ...(isCompeting ? [
      { label: '경쟁 해제 (삭제)', action: handleDelete, danger: true },
    ] : []),
  ]

  return (
    <div
      style={{ position: 'absolute', inset: '1px' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 블록 본체 */}
      <div
        draggable={!isDefault && !isCompeting}
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
        onDoubleClick={() => setEditModal(true)}
        style={{ position: 'absolute', inset: 0, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 3, overflow: 'hidden', cursor: isDefault ? 'default' : 'grab', display: 'flex', alignItems: 'center', padding: '0 4px', gap: 3, opacity: block.isPreSchedule ? 0.85 : 1 }}
      >
        {teamShort && (
          <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: textColor, background: 'rgba(0,0,0,.3)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {teamShort}
          </span>
        )}
        {!isDefault && !isCompeting && dealChar && (
          <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.3)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {dealChar}
          </span>
        )}
        <span style={{ fontSize: fontSize, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {pgmName}
        </span>
        {weightedMin > 0 && (
          <span style={{ fontSize: badgeFontSize, color: isCompeting ? 'rgba(255,215,0,.6)' : 'rgba(255,255,255,.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {weightedMin}
          </span>
        )}
        {/* 첨삭 클립 아이콘 */}
        {hasAnnotation && (
          <span style={{ fontSize: badgeFontSize + 1, flexShrink: 0, opacity: 0.85 }} title={block.annotation}>📎</span>
        )}
      </div>

      {/* 툴팁 */}
      {hover && !contextMenu && !annotationPopup && (
        <div style={{ position: 'absolute', left: '105%', top: 0, zIndex: 999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', minWidth: 200, maxWidth: 300, boxShadow: '0 4px 16px rgba(0,0,0,.5)', pointerEvents: 'none' }}>
          {isCompeting ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚔ 경쟁 중</div>
              {[block.item1, block.item2].filter(Boolean).map((item, i) => (
                <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? 'var(--ca-t)' : 'var(--ip-t)', marginBottom: 3 }}>
                    {i === 0 ? '● 기존' : '● 신규'}
                  </div>
                  {[
                    ['상품', item.pgmCodeName],
                    ['팀', item.mdTeam || item.orgName || '-'],
                    ['거래형태', item.dealType || '-'],
                    ['가중분', item.weightedMin || '-'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                      <span style={{ color: 'var(--text3)', minWidth: 46 }}>{label}</span>
                      <span style={{ color: 'var(--text)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>방송일시: {block.dateKey} {block.timeText}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{pgmName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  ['팀', block.orgName || block.mdTeam || '-'],
                  ['채널', block.channel || '-'],
                  ['거래형태', block.dealType || block.dealTypeChar || '-'],
                  ['방송일시', `${block.dateKey} ${block.timeText}`],
                  ['방송시간', `${block.durationMin}분`],
                  ['가중분', weightedMin || '-'],
                  ['메모코드', block.memoCode || '-'],
                  ['편성C', block.scheduleComment || '-'],
                  ['선편성', block.isPreSchedule ? '✓' : '-'],
                  ...(hasAnnotation ? [['첨삭', block.annotation]] : []),
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                    <span style={{ color: 'var(--text3)', minWidth: 52 }}>{label}</span>
                    <span style={{ color: label === '첨삭' ? 'var(--yellow)' : 'var(--text)', whiteSpace: 'pre-wrap' }}>{val}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 우클릭 메뉴 */}
      {contextMenu && (
        <div ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 0', minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
          {menuItems.map(item => (
            <button key={item.label} onClick={item.action}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', background: 'transparent', border: 'none', color: item.danger ? 'var(--red)' : 'var(--text)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{item.label}</button>
          ))}
        </div>
      )}

      {/* 첨삭 팝업 */}
      {annotationPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setAnnotationPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📎 첨삭</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pgmName}</div>
            <textarea
              value={annotationText}
              onChange={e => setAnnotationText(e.target.value)}
              rows={5}
              placeholder="첨삭 내용을 입력하세요..."
              autoFocus
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 5, fontSize: 12, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {block.annotation && (
                <button onClick={() => { saveBlock(block.blockKey || block.slotId, { annotation: '' }); setAnnotationPopup(false) }}
                  style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>삭제</button>
              )}
              <button onClick={() => setAnnotationPopup(false)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={handleSaveAnnotation} style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editModal && (
        <BlockEditModal
          block={block}
          onSave={(updated) => { saveBlock(block.blockKey || block.slotId, updated); setEditModal(false) }}
          onClose={() => setEditModal(false)}
        />
      )}
    </div>
  )
}