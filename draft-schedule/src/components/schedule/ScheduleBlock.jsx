import { useState, useRef, useEffect } from 'react'
import BlockEditModal from '../modal/BlockEditModal'
import useScheduleStore from '../../store/useScheduleStore'

// dealType에서 뱃지 문자 추출
function getDealTypeChar(block) {
  if (block.dealTypeChar) return block.dealTypeChar
  const dt = block.dealType || ''
  if (dt.includes('모바일광고')) return '광'
  if (dt.includes('위수탁') || dt.includes('위탁')) return '위'
  if (dt.includes('직매입')) return '직'
  if (dt.includes('구매')) return '구'
  if (dt.includes('특약')) return '특'
  return dt.charAt(0) || ''
}

function getTeamShort(name) {
  if (!name) return ''
  return name.replace('팀', '').slice(0, 3)
}

export default function ScheduleBlock({ block, height, saveBlock, removeBlock }) {
  const [hover, setHover] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [annotationPopup, setAnnotationPopup] = useState(false)
  const [annotationText, setAnnotationText] = useState('')
  const menuRef = useRef(null)
  const { copyBlockToSidebar } = useScheduleStore()

  useEffect(() => {
    const handler = () => setContextMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const isDefault   = block.isDefault
  const isCompeting = block.isCompeting
  const hasAnnotation = !!block.annotation

  // 편성C에 # 포함 여부
  const hasHashComment = block.scheduleComment && block.scheduleComment.includes('#')

  // 배경색
  const bgColor = isCompeting
    ? '#8b0000'
    : isDefault
    ? (hasHashComment ? '#1a2a1a' : '#111318')
    : block.channel === 'IP'
    ? 'var(--ip2)'
    : block.channel === 'CA'
    ? 'var(--ca2)'
    : hasHashComment
    ? '#1a2a3a'
    : 'var(--all2)'

  const borderColor = isCompeting
    ? '#ff4444'
    : isDefault
    ? (hasHashComment ? '#2d4a2d' : 'var(--border2)')
    : block.channel === 'IP'
    ? 'rgba(196,126,245,.35)'
    : block.channel === 'CA'
    ? 'rgba(126,179,245,.35)'
    : 'rgba(127,212,127,.35)'

  // # 포함 시 초록빛 틴트
  const hashTint = hasHashComment
    ? { boxShadow: 'inset 0 0 0 1px rgba(100,200,100,.3)' }
    : {}

  const textColor = isCompeting ? '#ffd700' : '#fff'
  const teamShort = isCompeting ? '경쟁' : getTeamShort(block.orgName || block.mdTeam)
  const dealChar  = isCompeting ? '' : getDealTypeChar(block)
  const weightedMin = block.weightedMin || 0
  const fontSize = height > 30 ? 10 : 9
  const badgeFontSize = Math.max(7, fontSize - 1)

  // 블록 드래그 (편성표 → 사이드바 또는 다른 슬롯)
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
        style={{
          position: 'absolute', inset: 0,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 3, overflow: 'hidden',
          cursor: isDefault ? 'default' : 'grab',
          display: 'flex', alignItems: 'center',
          padding: '0 4px', gap: 3,
          ...hashTint
        }}
      >
        {teamShort && (
          <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: textColor, background: 'rgba(0,0,0,.3)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {teamShort}
          </span>
        )}
        {!isDefault && !isCompeting && dealChar && (
          <span style={{ fontSize: badgeFontSize, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,.25)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {dealChar}
          </span>
        )}
        <span style={{ fontSize, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {block.pgmCodeName}
        </span>
        {weightedMin > 0 && (
          <span style={{ fontSize: badgeFontSize, color: isCompeting ? 'rgba(255,215,0,.6)' : 'rgba(255,255,255,.5)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {weightedMin}
          </span>
        )}
            {/* 첨삭 코너 마크 */}
      {hasAnnotation && (
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: 0, height: 0,
          borderStyle: 'solid',
          borderWidth: '0 15px 15px 0',
          borderColor: `transparent var(--yellow) transparent transparent`,
          zIndex: 2
        }} />
      )}
        {/* # 편성C 마크 */}
        {hasHashComment && (
          <div style={{ position: 'absolute', bottom: 0, right: 2, fontSize: 8, color: 'rgba(100,220,100,.8)', fontWeight: 700 }}>#</div>
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
                  {[['상품', item.pgmCodeName], ['팀', item.mdTeam || item.orgName || '-'], ['거래형태', item.dealType || '-'], ['가중분', item.weightedMin || '-']].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                      <span style={{ color: 'var(--text3)', minWidth: 46 }}>{label}</span>
                      <span style={{ color: 'var(--text)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{block.pgmCodeName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  ['팀', block.orgName || block.mdTeam || '-'],
                  ['채널', block.channel || '-'],
                  ['거래형태', block.dealType || '-'],
                  ['카테고리', block.mdCategory || '-'],
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
                    <span style={{ color: label === '첨삭' ? 'var(--yellow)' : label === '편성C' && String(val).includes('#') ? 'rgba(100,220,100,.9)' : 'var(--text)', whiteSpace: 'pre-wrap' }}>{val}</span>
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
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{block.pgmCodeName}</div>
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
          onSave={(updated) => {
            // dealTypeChar 재계산
            const dealChar = updated.dealType
              ? updated.dealType.includes('모바일광고') ? '광'
              : updated.dealType.includes('위수탁') || updated.dealType.includes('위탁') ? '위'
              : updated.dealType.includes('직매입') ? '직'
              : updated.dealType.includes('구매') ? '구'
              : updated.dealType.includes('특약') ? '특'
              : updated.dealType.charAt(0)
              : ''
            saveBlock(block.blockKey || block.slotId, { ...updated, dealTypeChar: dealChar })
            setEditModal(false)
          }}
          onClose={() => setEditModal(false)}
        />
      )}
    </div>
  )
}