// src/components/schedule/ScheduleBlock.jsx
import { useState, useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import BlockEditModal from '../modal/BlockEditModal'
import ConfirmActionModal from '../common/ConfirmActionModal'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import { getDealTypeChar } from '../../constants/dealTypes'
import { competitionItemKey, getCompetitionItems } from '../../utils/competition'
import { genKey } from '../../utils/uniqueKey'
import { resolveEntity } from '../../utils/mergeEntity'
import { getScheduledBlockPerformance } from '../../utils/performanceHistory'

function ScheduleBlock({ block, height, saveBlock, removeBlock: removeBlockRaw, dimmed = false, highlighted = false, readOnly = false }) {
  const [hover, setHover]               = useState(false)
  const [tooltipPos, setTooltipPos]     = useState(null)
  const [contextMenu, setContextMenu]   = useState(null)
  const [editModal, setEditModal]       = useState(false)
  const [returnConfirm, setReturnConfirm] = useState(false)
  const [fillReturnSlot, setFillReturnSlot] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [competitionSelect, setCompetitionSelect] = useState(null)
  const [annotationPopup, setAnnotationPopup] = useState(false)
  const [annotationText, setAnnotationText]   = useState('')
  const { returnBlockToSidebar: returnBlockToSidebarRaw, releaseCompetition, perfMap, manualInputs, performanceHistoryByKey, runUndoBatch, saveEntityProps, entityProps } = useScheduleStore()
  const returnBlockToSidebar = async (targetBlock) => {
    await runUndoBatch(`사이드바 반환 되돌리기: ${targetBlock.pgmCodeName || targetBlock.blockKey || targetBlock.slotId}`, async () => {
    await returnBlockToSidebarRaw(targetBlock)
    if (!fillReturnSlot) return
    const blockKey = targetBlock.blockKey || targetBlock.slotId
    const sourceChannel = blockKey.endsWith('_CA') ? 'CA' : blockKey.endsWith('_IP') ? 'IP' : 'ALL'
    await saveBlock(blockKey, {
      ...makeDefaultBlock(targetBlock, sourceChannel),
      uniqueKey: genKey('0'),
    })
    setFillReturnSlot(false)
    })
  }
  const removeBlock = (blockKey) => {
    setDeleteConfirm({ blockKey, type: block.isCompeting ? 'releaseCompetition' : 'delete' })
  }

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

  const isCompeting = block.isCompeting
  const competitionItems = isCompeting
    ? getCompetitionItems(block).map(item => resolveEntity(item, entityProps))
    : []
  const hasAnnotation = !!block.annotation
  const hasHash = !!(block.scheduleComment && block.scheduleComment.includes('#'))

  const npt = block.newProductType || ''
  const prodTypeChar = npt === '신상품' ? '(신)' : (npt === '재녹화' || npt === '재편집') ? '(재)' : ''

  const dealType  = block.dealTypeConverted || block.dealType || ''
  const isDirect  = dealType.includes('[직]') || dealType.includes('직매입')
  const isPurple  = dealType.includes('[모]') || dealType.includes('모바일광고')
                 || dealType.includes('[혼]') || dealType.includes('혼합')
                 || dealType.includes('[액]') || dealType.includes('정액')
  const isGreenBg = hasHash

  const teamShort = isCompeting
    ? '경쟁'
    : ((block.mdTeam || block.orgName || '').replace('팀', '').slice(0, 2))

  const dealChar = isCompeting ? '' : getDealTypeChar(dealType || block.dealTypeChar || '')

  const isPgmTeam = block.pgmCodeName === '[편성팀]'

  const isPreScheduleMemo = block.memoCode2 === '[선편성]'

  const bgColor = isCompeting ? '#8b0000'
    : isPreScheduleMemo ? '#374151'
    : isPgmTeam  ? 'var(--bg3)'
    : isGreenBg  ? '#166534'
    : isDirect   ? '#1d4ed8'
    : isPurple   ? '#7c3aed'
    : 'var(--bg2)'

  const borderColor = isCompeting ? '#ff4444'
    : isPreScheduleMemo ? '#111827'
    : isPgmTeam  ? 'var(--text3)'
    : isGreenBg  ? 'rgba(34,197,94,.5)'
    : isDirect   ? 'rgba(59,130,246,.5)'
    : isPurple   ? 'rgba(139,92,246,.5)'
    : 'var(--border)'

  const isColored = isCompeting || isPreScheduleMemo || isDirect || isPurple || isGreenBg
  const textColor = isColored ? '#fff' : 'var(--text)'
  const fontSize  = height > 30 ? 10 : 9
  const badgeSz   = Math.max(7, fontSize - 1)
  const badgeBg   = isColored ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.07)'

  const handleDragStart = (e) => {
    if (readOnly) { e.preventDefault(); return }
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
    setTooltipPos({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
    setHover(true)
  }

  const handleMouseLeave = () => {
    setHover(false)
    setTooltipPos(null)
  }

  const handleSaveAnnotation = () => {
    if (readOnly) return
    if (block.uniqueKey) saveEntityProps(block.uniqueKey, { annotation: annotationText })
    else saveBlock(block.blockKey || block.slotId, { annotation: annotationText })
    setAnnotationPopup(false)
  }

  const togglePreSchedule = async () => {
    if (readOnly) return
    const nextOn = !isPreScheduleMemo
    const patch = nextOn
      ? { memoCode2: '[선편성]', memoCode2Code: '037' }
      : { memoCode2: '', memoCode2Code: '' }
    await runUndoBatch(`${nextOn ? '[선편성] 지정' : '[선편성] 해제'} 되돌리기: ${block.pgmCodeName || block.blockKey || block.slotId}`, async () => {
      if (block.uniqueKey) await saveEntityProps(block.uniqueKey, patch)
      else await saveBlock(block.blockKey || block.slotId, patch)
    })
  }

  const menuItems = readOnly ? [] : [
    { label: '수정', action: () => setEditModal(true) },
    { label: hasAnnotation ? '첨삭 수정' : '첨삭 추가', action: () => { setAnnotationText(block.annotation || ''); setAnnotationPopup(true) } },
    ...(!isCompeting ? [
      { label: isPreScheduleMemo ? '[선편성] 해제' : '[선편성]', action: togglePreSchedule },
      { label: '사이드바로 반환', action: () => setReturnConfirm(true) },
      { label: '삭제', action: () => removeBlock(block.blockKey || block.slotId), danger: true },
    ] : []),
    ...(isCompeting ? [
      { label: '경쟁 해제', action: () => removeBlock(block.blockKey || block.slotId), danger: true },
    ] : []),
  ]

  const perfState = getScheduledBlockPerformance(block, {
    performanceHistoryByKey,
    manualInputs,
    fallbackPerfMap: perfMap,
  })
  const lastPerf = perfState.lastPerf
  const sameBroadcastPerf = perfState.sameBroadcastPerf
  const isDefaultPgmTeam = block.pgmCodeName === '[편성팀]' && block.memoCode === '[전사블록]'
  const manualKey = isDefaultPgmTeam ? 'sim_pgm_team' : block.uniqueKey
  const manual = manualKey ? (manualInputs[manualKey] || {}) : {}

  return (
    <div style={{
      position: 'absolute',
      inset: '1px',
      opacity: dimmed ? 0.1 : 1,
      zIndex: highlighted ? 5 : undefined,
      outline: highlighted ? '2px solid #f59e0b' : undefined,
      outlineOffset: highlighted ? 1 : undefined,
      boxShadow: highlighted ? '0 0 0 2px rgba(245,158,11,.28), 0 4px 10px rgba(15,23,42,.22)' : undefined,
      transition: 'opacity .15s, box-shadow .15s',
    }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        draggable={!readOnly && !isCompeting}
        onDragStart={handleDragStart}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          if (readOnly) return
          // 화면 경계 벗어남 방지
          const approxH = menuItems.length * 34 + 10
          const approxW = 170
          const y = e.clientY + approxH > window.innerHeight ? e.clientY - approxH : e.clientY
          const x = e.clientX + approxW > window.innerWidth  ? e.clientX - approxW : e.clientX
          setContextMenu({ x, y })
        }}
        onDoubleClick={() => { if (!readOnly) setEditModal(true) }}
        style={{ position: 'absolute', inset: 0, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 3, overflow: 'hidden', cursor: readOnly || isCompeting ? 'default' : 'grab', display: 'flex', alignItems: 'center', padding: '0 4px', gap: 3, filter: highlighted ? 'saturate(1.15) contrast(1.08)' : undefined, transition: 'filter .15s' }}
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
          <span style={{ fontSize: badgeSz, fontWeight: 700, color: npt === '신상품' ? (isColored ? '#fef08a' : '#92400e') : (isColored ? '#93c5fd' : '#1e40af'), background: npt === '신상품' ? 'rgba(234,179,8,.25)' : 'rgba(59,130,246,.25)', padding: '0 3px', height: 14, borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
        {(hasHash || block.weightedMin != null) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: badgeSz + 2, color: '#000', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 800 }}>
            {hasHash && <span>#</span>}
            {block.weightedMin != null && <span>{block.weightedMin}</span>}
          </span>
        )}
        {hasAnnotation && (
          <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 8px 8px 0', borderColor: `transparent var(--yellow) transparent transparent` }} />
        )}
      </div>

      {/* 툴팁: contextMenu/editModal/annotationPopup 없을 때만 표시 */}
      {hover && tooltipPos && !contextMenu && !editModal && !annotationPopup && createPortal(
        <BlockTooltip block={block} lastPerf={lastPerf} sameBroadcastPerf={sameBroadcastPerf} manual={manual} pos={tooltipPos} competitionItems={competitionItems} />
        ,
        document.body
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
                <button onClick={() => {
                  if (block.uniqueKey) saveEntityProps(block.uniqueKey, { annotation: '' })
                  else saveBlock(block.blockKey || block.slotId, { annotation: '' })
                  setAnnotationPopup(false)
                }}
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

      {editModal && createPortal(
        <BlockEditModal
          block={block}
          onClose={() => setEditModal(false)}
          saveBlock={saveBlock}
        />,
        document.body
      )}
      {returnConfirm && (
        <ConfirmActionModal
          title="사이드바로 반환"
          description={`[${block.pgmCodeName || '-'}]을 편성표에서 빼고 사이드바로 반환할까요?`}
          confirmText="반환"
          onCancel={() => setReturnConfirm(false)}
          onConfirm={() => {
            setReturnConfirm(false)
            returnBlockToSidebar(block)
          }}
        >
          <ReturnSlotChoice value={fillReturnSlot} onChange={setFillReturnSlot} />
        </ConfirmActionModal>
      )}
      {deleteConfirm?.type === 'releaseCompetition' && (
        <CompetitionReleaseModal
          block={block}
          onCancel={() => setDeleteConfirm(null)}
          onPickProduct={() => {
            setCompetitionSelect(deleteConfirm)
            setDeleteConfirm(null)
          }}
          onEmpty={async () => {
            const pending = deleteConfirm
            setDeleteConfirm(null)
            await releaseCompetition(pending.blockKey, { mode: 'empty' })
          }}
          onDefault={async () => {
            const pending = deleteConfirm
            setDeleteConfirm(null)
            await releaseCompetition(pending.blockKey, { mode: 'default' })
          }}
        />
      )}
      {competitionSelect && (
        <CompetitionProductSelectModal
          items={competitionItems}
          onCancel={() => setCompetitionSelect(null)}
          onSelect={async (item, index) => {
            const pending = competitionSelect
            setCompetitionSelect(null)
            await releaseCompetition(pending.blockKey, {
              mode: 'select',
              selectedKey: competitionItemKey(item, index),
            })
          }}
        />
      )}
      {deleteConfirm && deleteConfirm.type !== 'releaseCompetition' && (
        <ConfirmActionModal
          title={deleteConfirm.type === 'releaseCompetition' ? '경쟁 해제' : '편성 블록 삭제'}
          description={deleteConfirm.type === 'releaseCompetition'
            ? '경쟁 편성을 해제할까요? 두 상품은 편성표에서 제거되고 사이드바로 복원됩니다.'
            : `[${block.pgmCodeName || '-'}]을 편성표에서 삭제할까요?`}
          confirmText={deleteConfirm.type === 'releaseCompetition' ? '해제' : '삭제'}
          danger
          onCancel={() => {
            setDeleteConfirm(null)
            setFillReturnSlot(false)
          }}
          onConfirm={async () => {
            const pending = deleteConfirm
            setDeleteConfirm(null)
            await removeBlockRaw(pending.blockKey)
            if (pending.type === 'releaseCompetition' && fillReturnSlot) {
              const sourceChannel = pending.blockKey.endsWith('_CA') ? 'CA' : pending.blockKey.endsWith('_IP') ? 'IP' : 'ALL'
              await saveBlock(pending.blockKey, {
                ...makeDefaultBlock(block, sourceChannel),
                uniqueKey: genKey('0'),
              })
            }
            setFillReturnSlot(false)
          }}
        >
          {deleteConfirm.type === 'releaseCompetition' && (
            <ReturnSlotChoice value={fillReturnSlot} onChange={setFillReturnSlot} />
          )}
        </ConfirmActionModal>
      )}
    </div>
  )
}

export default memo(ScheduleBlock)

function CompetitionReleaseModal({ block, onCancel, onPickProduct, onEmpty, onDefault }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 380, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '18px 20px', boxShadow: '0 16px 48px rgba(0,0,0,.45)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>경쟁 해제</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 14 }}>
          [{block.pgmCodeName || '-'}] 경쟁 슬롯을 어떻게 처리할까요?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <ChoiceButton onClick={onPickProduct} label="상품 선택하기" />
          <ChoiceButton onClick={onEmpty} label="슬롯 비우기" danger />
          <ChoiceButton onClick={onDefault} label="[편성팀] [전사블록] 채우기" />
        </div>
        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          취소
        </button>
      </div>
    </div>
  )
}

function CompetitionProductSelectModal({ items, onCancel, onSelect }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 420, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '18px 20px', boxShadow: '0 16px 48px rgba(0,0,0,.45)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>남길 상품 선택</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 14 }}>
          경쟁 상품 중 편성표에 남길 상품 하나를 선택하세요.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {items.map((item, index) => (
            <button
              key={competitionItemKey(item, index)}
              type="button"
              onClick={() => onSelect(item, index)}
              style={{ padding: '10px 12px', textAlign: 'left', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>{item.pgmCodeName || '-'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {[item.mdTeam || item.orgName, item.dealTypeConverted || item.dealType, item.memoCode, item.memoCode2].filter(Boolean).join(' · ') || '-'}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          취소
        </button>
      </div>
    </div>
  )
}

function ChoiceButton({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 12px',
        textAlign: 'left',
        background: danger ? 'rgba(220,38,38,.10)' : 'var(--bg3)',
        border: `1px solid ${danger ? 'var(--red)' : 'var(--border)'}`,
        color: danger ? 'var(--red)' : 'var(--text)',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function ReturnSlotChoice({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: '8px 10px',
          textAlign: 'left',
          background: !value ? 'rgba(74,108,247,.10)' : 'var(--bg3)',
          border: `1px solid ${!value ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text)',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        기존 슬롯 비우기
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: '8px 10px',
          textAlign: 'left',
          background: value ? 'rgba(74,108,247,.10)' : 'var(--bg3)',
          border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text)',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        [편성팀] [전사블록]으로 채우기
      </button>
    </div>
  )
}

function BlockTooltip({ block, lastPerf, sameBroadcastPerf, manual, pos, competitionItems }) {
  // 화면 오른쪽/아래 잘림 방지
  const tooltipW = 230
  const gap = 8
  const margin = 8
  const hasManual = manual && (manual.expectedSalesPerWeightedMin != null || manual.expectedProfitPerWeightedMin != null)
  const compItems = competitionItems || getCompetitionItems(block)
  const perfSectionCount = [sameBroadcastPerf, hasManual, lastPerf].filter(Boolean).length
  const approxH  = block.isCompeting ? Math.min(360, 60 + compItems.length * 62) : (block.annotation ? 290 : 220) + (perfSectionCount * 60)
  const viewportW = window.innerWidth || 0
  const viewportH = window.innerHeight || 0
  const preferRight = (pos.right || 0) + gap + tooltipW <= viewportW - margin
  const rawLeft = preferRight
    ? (pos.right || 0) + gap
    : (pos.left || 0) - tooltipW - gap
  const left = Math.max(margin, Math.min(rawLeft, viewportW - tooltipW - margin))
  const belowTop = pos.top || 0
  const aboveTop = (pos.top || 0) - approxH - gap
  const rawTop = belowTop + approxH <= viewportH - margin
    ? belowTop
    : aboveTop >= margin
      ? aboveTop
      : viewportH - approxH - margin
  const top = Math.max(margin, Math.min(rawTop, viewportH - approxH - margin))

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
    ['메모코드2', block.memoCode2 || '-'],
    ['편성C',    block.scheduleComment || '-'],
    ['기타요청', block.requestNote || '-'],
    ...(block.annotation ? [['첨삭', block.annotation]] : []),
  ]

  return (
    <div style={{ position: 'fixed', left, top, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', minWidth: tooltipW, maxWidth: 300, boxShadow: '0 4px 16px rgba(0,0,0,.3)', pointerEvents: 'none' }}>
      {block.isCompeting ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚔ 경쟁 중</div>
          {compItems.map((item, i) => (
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
          {sameBroadcastPerf && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>해당PGM실적 ({sameBroadcastPerf.broadcastDate} {sameBroadcastPerf.broadcastTime || ''})</div>
              {[
                ['취급/분', Number(sameBroadcastPerf.salesPerWeightedMin  || 0).toLocaleString(), 'var(--accent)'],
                ['한익/분', Number(sameBroadcastPerf.profitPerWeightedMin || 0).toLocaleString(), 'var(--green)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </>
          )}
          {hasManual && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>수기실적</div>
              {[
                ['취급/분', manual.expectedSalesPerWeightedMin,  'var(--accent)'],
                ['한익/분', manual.expectedProfitPerWeightedMin, 'var(--green)'],
              ].filter(([, v]) => v != null).map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{Number(val).toLocaleString()}</span>
                </div>
              ))}
            </>
          )}
          {lastPerf && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>직전실적 ({lastPerf.broadcastDate} {lastPerf.broadcastTime || ''})</div>
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
