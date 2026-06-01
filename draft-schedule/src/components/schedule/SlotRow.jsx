// src/components/schedule/SlotRow.jsx
import { useState, useEffect, memo } from 'react'
import ScheduleBlock from './ScheduleBlock'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import { splitWeightedMin } from '../../utils/weightedMin'
import { getCompetitionItems, makeCompetitionBlock } from '../../utils/competition'
import { genKey } from '../../utils/uniqueKey'

function blockMatches(block, keyword) {
  if (!keyword) return true
  const kw = keyword.trim().toLowerCase()
  return [block.pgmCodeName, block.mdTeam, block.orgName, block.mdCategory, block.dealTypeConverted, block.dealType]
    .join(' ').toLowerCase().includes(kw)
}

function isDimmed(block, teamFilter, gridSearch) {
  if (!block) return false
  if (teamFilter !== '전체' && (block.mdTeam || block.orgName || '') !== teamFilter) return true
  if (gridSearch && !blockMatches(block, gridSearch)) return true
  return false
}

function SlotRow({ slot, top, height, isSplit, block, splitBlock_CA, splitBlock_IP, onDrop, saveBlock, removeBlock, teamFilter = '전체', gridSearch = '', readOnly = false }) {
  const [caHover, setCaHover] = useState(false)
  const [ipHover, setIpHover] = useState(false)
  const [dropTarget, setDropTarget] = useState(null)
  const [dropConfirm, setDropConfirm] = useState(null)
  const halfHeight = height / 2
  const fontSize = Math.min(12, Math.max(9, halfHeight * 0.38))

  const prevent = e => {
    if (readOnly) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const getStableDropChannel = (e, ch) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const edge = rect.height * 0.2
    if (y < edge || y > rect.height - edge) return dropTarget
    return ch
  }

  const handleDragOver = (e, ch) => {
    prevent(e)
    const next = getStableDropChannel(e, ch)
    if (next) setDropTarget(next)
  }

  const handleDragLeave = (setter) => (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setter(false)
      setDropTarget(null)
    }
  }

  const buildDropContext = (ch) => {
    const newKey = isSplit ? `${slot.slotId}_${ch}` : slot.slotId
    let targetWeightedMin = slot.weightedMin
    if (isSplit) {
      const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
      targetWeightedMin = ch === 'CA' ? caWeighted : ipWeighted
    }
    return { newKey, targetWeightedMin }
  }

  const moveBlock = async ({ blockKey, ch, mode }) => {
    const { scheduleBlocks, returnBlockToSidebar, _writeLog } = useScheduleStore.getState()
    const draggedBlock = scheduleBlocks[blockKey]
    if (!draggedBlock) return

    const { newKey, targetWeightedMin } = buildDropContext(ch)
    const targetBlock = scheduleBlocks[newKey]
    if (newKey === blockKey) return
    const sourceKey = blockKey
    const sourceChannel = sourceKey.endsWith('_CA') ? 'CA' : sourceKey.endsWith('_IP') ? 'IP' : 'ALL'
    const sourceWeightedMin = draggedBlock.weightedMin || 0

    const fillSourceWithDefault = async () => {
      if (!dropConfirm?.fillSource) return
      await saveBlock(blockKey, {
        ...makeDefaultBlock(draggedBlock, sourceChannel),
        uniqueKey: genKey('0'),
        __skipLog: true,
      })
    }

    if (targetBlock && !targetBlock.isDefault && mode === 'compete') {
      const items = [
        ...getCompetitionItems(targetBlock),
        ...getCompetitionItems(draggedBlock),
      ]
      const competitionBlock = makeCompetitionBlock({ slot, blockKey: newKey, channel: ch, weightedMin: targetWeightedMin, items })
      await removeBlock(blockKey, { skipLog: true })
      await saveBlock(newKey, {
        ...competitionBlock,
        __skipLog: true,
      })
      await fillSourceWithDefault()
      await _writeLog('경쟁생성', newKey, targetBlock, competitionBlock, {
        scope: 'schedule',
        detail: `${draggedBlock.dateKey || ''} ${draggedBlock.timeText || ''} ${draggedBlock.channel || ''} 상품을 ${slot.dateKey} ${slot.timeText} ${ch} 슬롯의 경쟁으로 이동`,
      })
      return
    }

    if (targetBlock && !targetBlock.isDefault && mode === 'swap') {
      const movedBlock = {
        ...draggedBlock,
        slotId: slot.slotId,
        blockKey: newKey,
        dateKey: slot.dateKey,
        timeText: slot.timeText,
        durationMin: slot.durationMin,
        weightedMin: targetWeightedMin,
        channel: ch,
      }
      const swappedBlock = {
        ...targetBlock,
        slotId: draggedBlock.slotId,
        blockKey: sourceKey,
        dateKey: draggedBlock.dateKey,
        timeText: draggedBlock.timeText,
        durationMin: draggedBlock.durationMin,
        weightedMin: sourceWeightedMin,
        channel: sourceChannel,
      }

      await saveBlock(sourceKey, { ...swappedBlock, __skipLog: true })
      await saveBlock(newKey, { ...movedBlock, __skipLog: true })

      const sourceLabel = `${draggedBlock.dateKey || ''} ${draggedBlock.timeText || ''} ${draggedBlock.channel || ''}`.trim()
      const targetLabel = `${slot.dateKey} ${slot.timeText} ${ch}`.trim()
      await _writeLog('맞교환', newKey, targetBlock, movedBlock, {
        scope: 'schedule',
        detail: `맞교환: ${draggedBlock.pgmCodeName || '-'} ${sourceLabel} → ${targetLabel}, ${targetBlock.pgmCodeName || '-'} ${targetLabel} → ${sourceLabel}`,
      })
      return
    }

    if (targetBlock && !targetBlock.isDefault && mode === 'replace') {
      await returnBlockToSidebar(targetBlock, { skipLog: true })
    }

    const movedBlock = {
      ...draggedBlock,
      slotId: slot.slotId,
      blockKey: newKey,
      dateKey: slot.dateKey,
      timeText: slot.timeText,
      durationMin: slot.durationMin,
      weightedMin: targetWeightedMin,
      channel: ch,
    }

    await removeBlock(blockKey, { skipLog: true })
    await saveBlock(newKey, {
      ...movedBlock,
      __skipLog: true,
    })
    await fillSourceWithDefault()

    const sourceLabel = `${draggedBlock.dateKey || ''} ${draggedBlock.timeText || ''} ${draggedBlock.channel || ''}`.trim()
    const targetLabel = `${slot.dateKey} ${slot.timeText} ${ch}`.trim()
    const detail = targetBlock && !targetBlock.isDefault
      ? `편성변경: ${sourceLabel} → ${targetLabel}, 기존상품 처리: 사이드바 이동${dropConfirm?.fillSource ? ', 원 슬롯 [편성팀] 생성' : ''}`
      : `이동슬롯: ${sourceLabel} → ${targetLabel}${dropConfirm?.fillSource ? ', 원 슬롯 [편성팀] 생성' : ''}`
    await _writeLog(targetBlock && !targetBlock.isDefault ? '편성변경' : '이동', newKey, targetBlock || draggedBlock, movedBlock, {
      scope: 'schedule',
      detail,
    })
  }

  const executeConfirmedDrop = async (action) => {
    if (!dropConfirm) return
    const pending = dropConfirm
    setDropConfirm(null)
    const { runUndoBatch } = useScheduleStore.getState()

    await runUndoBatch(`${pending.kind === 'item' ? '상품 편성' : '블록 이동'} 되돌리기: ${pending.sourceName || '-'}`, async () => {
      if (pending.kind === 'item') {
        await onDrop(slot, pending.ch, pending.itemId, isSplit, action, pending.uniqueKey)
        return
      }
      await moveBlock({ blockKey: pending.blockKey, ch: pending.ch, mode: action })
    })
  }

  useEffect(() => {
    if (!dropConfirm) return
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setDropConfirm(null)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        executeConfirmedDrop(dropConfirm.defaultAction)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropConfirm])

  const handleDrop = (e, ch) => {
    e.preventDefault()
    if (readOnly) return
    const stableCh = getStableDropChannel(e, ch) || ch
    setDropTarget(null)
    ch = stableCh
    const isBlock = e.dataTransfer.getData('isBlock')
    const itemId = e.dataTransfer.getData('itemId')
    const uniqueKey = e.dataTransfer.getData('uniqueKey')
    const blockKey = e.dataTransfer.getData('blockKey')
    const { newKey } = buildDropContext(ch)
    const { scheduleBlocks, proposalItems } = useScheduleStore.getState()
    const targetBlock = scheduleBlocks[newKey]

    if (isBlock === 'true' && blockKey) {
      const draggedBlock = scheduleBlocks[blockKey]
      if (!draggedBlock || newKey === blockKey) return

      if (targetBlock && !targetBlock.isDefault) {
        setDropConfirm({
          kind: 'block',
          variant: 'occupied',
          ch,
          blockKey,
          sourceName: draggedBlock.pgmCodeName || '-',
          targetName: targetBlock.pgmCodeName || '-',
          slotLabel: `${slot.dateKey} ${slot.timeText}`,
          defaultAction: 'swap',
          fillSource: false,
        })
      } else {
        setDropConfirm({
          kind: 'block',
          variant: 'empty',
          ch,
          blockKey,
          sourceName: draggedBlock.pgmCodeName || '-',
          slotLabel: `${slot.dateKey} ${slot.timeText}`,
          defaultAction: 'move',
          fillSource: false,
        })
      }
    } else if (itemId) {
      const item = proposalItems.find(p => uniqueKey ? p.uniqueKey === uniqueKey : p.itemId === itemId)
      if (!item) return
      if (targetBlock && !targetBlock.isDefault) {
        setDropConfirm({
          kind: 'item',
          variant: 'occupied',
          ch,
          itemId: item.itemId,
          uniqueKey: item.uniqueKey,
          sourceName: item?.pgmCodeName || '-',
          targetName: targetBlock.pgmCodeName || '-',
          slotLabel: `${slot.dateKey} ${slot.timeText}`,
          defaultAction: 'replace',
        })
      } else {
        onDrop(slot, ch, item.itemId, isSplit, 'compete', item.uniqueKey)
      }
    }
  }

  const { caWeighted, ipWeighted } = isSplit
    ? splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
    : { caWeighted: 0, ipWeighted: 0 }
  const wmStyle = { position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: Math.max(10, fontSize + 1), color: '#000', pointerEvents: 'none', fontWeight: 800, lineHeight: 1, userSelect: 'none' }
  const dropHintStyle = {
    position: 'absolute',
    inset: 2,
    border: '2px solid var(--accent)',
    borderRadius: 5,
    background: 'rgba(74,108,247,.16)',
    pointerEvents: 'none',
    zIndex: 5,
  }
  const previewBlockStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 'min(92%, 260px)',
    height: Math.max(24, Math.min(44, height * 0.72)),
    transform: 'translate(-50%, -50%) scale(1.5)',
    transformOrigin: 'center',
    zIndex: 45,
    pointerEvents: 'none',
    background: 'var(--accent)',
    border: '1px solid #fff',
    borderRadius: 4,
    boxShadow: '0 8px 18px rgba(0,0,0,.35)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 6px',
    overflow: 'hidden',
  }

  return (
    <div
      style={{ position: 'absolute', top, left: 0, right: 0, height, borderBottom: '1px solid var(--border)' }}
      data-slot-id={slot.slotId}
      onDragEnd={() => setDropTarget(null)}
    >
      {isSplit ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: halfHeight, background: caHover ? 'rgba(61,90,138,.2)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
            onDragOver={e => handleDragOver(e, 'CA')} onDrop={e => handleDrop(e, 'CA')}
            onDragEnter={() => setCaHover(true)} onDragLeave={handleDragLeave(setCaHover)}>
            {dropTarget === 'CA' && <DropHint style={dropHintStyle} />}
            {dropTarget === 'CA' && splitBlock_CA && !splitBlock_CA.isDefault && <DropPreviewBlock block={splitBlock_CA} style={previewBlockStyle} />}
            {splitBlock_CA && !splitBlock_CA.isDefault
              ? <ScheduleBlock block={splitBlock_CA} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(splitBlock_CA, teamFilter, gridSearch)} readOnly={readOnly} />
              : caWeighted != null && <span style={wmStyle}>{caWeighted}</span>}
          </div>
          <div style={{ position: 'absolute', top: halfHeight, left: 0, right: 0, height: halfHeight, background: ipHover ? 'rgba(106,61,138,.2)' : 'transparent', transition: 'background .1s' }}
            onDragOver={e => handleDragOver(e, 'IP')} onDrop={e => handleDrop(e, 'IP')}
            onDragEnter={() => setIpHover(true)} onDragLeave={handleDragLeave(setIpHover)}>
            {dropTarget === 'IP' && <DropHint style={dropHintStyle} />}
            {dropTarget === 'IP' && splitBlock_IP && !splitBlock_IP.isDefault && <DropPreviewBlock block={splitBlock_IP} style={previewBlockStyle} />}
            {splitBlock_IP && !splitBlock_IP.isDefault
              ? <ScheduleBlock block={splitBlock_IP} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(splitBlock_IP, teamFilter, gridSearch)} readOnly={readOnly} />
              : ipWeighted != null && <span style={wmStyle}>{ipWeighted}</span>}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: caHover ? 'rgba(74,108,247,.06)' : 'transparent', transition: 'background .1s' }}
          onDragOver={e => handleDragOver(e, 'ALL')} onDrop={e => handleDrop(e, 'ALL')}
          onDragEnter={() => setCaHover(true)} onDragLeave={handleDragLeave(setCaHover)}>
          {dropTarget === 'ALL' && <DropHint style={dropHintStyle} />}
          {dropTarget === 'ALL' && block && !block.isDefault && <DropPreviewBlock block={block} style={previewBlockStyle} />}
          {block && !block.isDefault
            ? <ScheduleBlock block={block} height={height} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(block, teamFilter, gridSearch)} readOnly={readOnly} />
            : slot.weightedMin != null && <span style={wmStyle}>{slot.weightedMin}</span>}
        </div>
      )}
      {dropConfirm && (
        <DropConfirmModal
          data={dropConfirm}
          onCancel={() => setDropConfirm(null)}
          onApply={executeConfirmedDrop}
          onChange={setDropConfirm}
        />
      )}
    </div>
  )
}
export default memo(SlotRow)

function DropHint({ style }) {
  return <div style={style} />
}

function DropPreviewBlock({ block, style }) {
  const teamShort = ((block.mdTeam || block.orgName || '').replace('팀', '').slice(0, 2))
  return (
    <div style={style}>
      {teamShort && (
        <span style={{ fontSize: 8, fontWeight: 800, background: 'rgba(0,0,0,.24)', borderRadius: 2, padding: '0 3px', height: 14, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {teamShort}
        </span>
      )}
      <span style={{ fontSize: 10, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {block.pgmCodeName}
      </span>
    </div>
  )
}

function DropConfirmModal({ data, onCancel, onApply, onChange }) {
  const isOccupied = data.variant === 'occupied'
  const isBlockMove = data.kind === 'block'
  const isSwap = isOccupied && isBlockMove
  const title = isOccupied ? '이미 편성된 슬롯입니다' : '편성 블록을 이동할까요?'
  const description = isSwap
    ? `[${data.sourceName}]와 [${data.targetName}]의 방송 위치를 맞교환합니다.`
    : isOccupied
    ? `[${data.targetName}] 슬롯에 [${data.sourceName}]을 적용합니다.`
    : `[${data.sourceName}]을 ${data.slotLabel} 슬롯으로 이동합니다. 기존 슬롯은 비워집니다.`

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 360, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '18px 20px', boxShadow: '0 16px 48px rgba(0,0,0,.45)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 10 }}>{description}</div>
        {isOccupied && (
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 16 }}>
            {isSwap
              ? '경쟁은 두 상품을 함께 표시하고, 맞교환은 두 상품의 슬롯 위치를 서로 바꿉니다.'
              : '경쟁은 두 상품을 함께 표시하고, 변경은 기존 편성을 사이드바로 돌린 뒤 새 상품으로 바꿉니다.'}
          </div>
        )}
        {isBlockMove && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 16, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={!!data.fillSource}
              onChange={e => onChange(prev => ({ ...prev, fillSource: e.target.checked }))}
            />
            <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
              비워지는 기존 슬롯을 [편성팀] [전사블록]으로 채우기
            </span>
          </label>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            취소
          </button>
          {isOccupied && (
            <button onClick={() => onApply('compete')}
              style={{ flex: 1, padding: '8px 0', background: 'var(--yellow)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              경쟁
            </button>
          )}
          <button onClick={() => onApply(data.defaultAction)}
            autoFocus
            style={{ flex: 1, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {isSwap ? '맞교환' : isOccupied ? '변경' : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}
