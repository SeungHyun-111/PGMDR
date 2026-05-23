// src/components/schedule/SlotRow.jsx  ← 신규 분리
import { useState, memo } from 'react'
import ScheduleBlock from './ScheduleBlock'
import useScheduleStore from '../../store/useScheduleStore'
import { splitWeightedMin } from '../../utils/weightedMin'

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

function SlotRow({ slot, top, height, isSplit, block, splitBlock_CA, splitBlock_IP, onDrop, saveBlock, removeBlock, teamFilter = '전체', gridSearch = '' }) {
  const [caHover, setCaHover] = useState(false)
  const [ipHover, setIpHover] = useState(false)
  const halfHeight = height / 2
  const fontSize = Math.min(12, Math.max(9, halfHeight * 0.38))
  const prevent = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const handleDrop = (e, ch) => {
    e.preventDefault()
    const isBlock = e.dataTransfer.getData('isBlock')
    const itemId  = e.dataTransfer.getData('itemId')
    const blockKey = e.dataTransfer.getData('blockKey')

    if (isBlock === 'true' && blockKey) {
      const { scheduleBlocks } = useScheduleStore.getState()
      const draggedBlock = scheduleBlocks[blockKey]
      if (!draggedBlock) return

      const newKey = isSplit ? `${slot.slotId}_${ch}` : slot.slotId
      const targetBlock = scheduleBlocks[newKey]

      let targetWeightedMin = slot.weightedMin
      if (isSplit) {
        const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
        targetWeightedMin = ch === 'CA' ? caWeighted : ipWeighted
      }

      if (targetBlock && !targetBlock.isCompeting && newKey !== blockKey) {
        // 점유된 슬롯에 드래그 → 경쟁 블록 생성
        const brand1 = (targetBlock.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
        const brand2 = (draggedBlock.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
        removeBlock(blockKey)
        saveBlock(newKey, {
          slotId: slot.slotId, blockKey: newKey,
          dateKey: slot.dateKey, timeText: slot.timeText,
          durationMin: slot.durationMin, weightedMin: targetWeightedMin,
          channel: ch, isCompeting: true, isPreSchedule: false,
          pgmCodeName: `[${brand1}*${brand2}]`,
          item1: {
            ...(targetBlock.itemId ? { itemId: targetBlock.itemId } : {}),
            pgmCodeName: targetBlock.pgmCodeName,
            mdTeam: targetBlock.mdTeam,
            orgName: targetBlock.orgName,
            dealType: targetBlock.dealType,
            dealTypeConverted: targetBlock.dealTypeConverted || targetBlock.dealType || '',
            ...(targetBlock.perfKey ? { perfKey: targetBlock.perfKey } : {}),
            weightedMin: targetBlock.weightedMin,
          },
          item2: {
            ...(draggedBlock.itemId ? { itemId: draggedBlock.itemId } : {}),
            pgmCodeName: draggedBlock.pgmCodeName,
            mdTeam: draggedBlock.mdTeam,
            orgName: draggedBlock.orgName,
            dealType: draggedBlock.dealType,
            dealTypeConverted: draggedBlock.dealTypeConverted || draggedBlock.dealType || '',
            ...(draggedBlock.perfKey ? { perfKey: draggedBlock.perfKey } : {}),
            weightedMin: draggedBlock.weightedMin,
          },
          isDefault: false, assignedAt: Date.now(),
        })
      } else {
        removeBlock(blockKey)
        saveBlock(newKey, {
          ...draggedBlock,
          slotId: slot.slotId,
          blockKey: newKey,
          dateKey: slot.dateKey,
          timeText: slot.timeText,
          durationMin: slot.durationMin,
          weightedMin: targetWeightedMin,
          channel: ch,
        })
      }
    } else if (itemId) {
      onDrop(slot, ch, itemId, isSplit)
    }
  }

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height, borderBottom: '1px solid var(--border)' }} data-slot-id={slot.slotId}>
      {isSplit ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: halfHeight, background: caHover ? 'rgba(61,90,138,.2)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'CA')}
            onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}>
            {splitBlock_CA && <ScheduleBlock block={splitBlock_CA} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(splitBlock_CA, teamFilter, gridSearch)} />}
          </div>
          <div style={{ position: 'absolute', top: halfHeight, left: 0, right: 0, height: halfHeight, background: ipHover ? 'rgba(106,61,138,.2)' : 'transparent', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'IP')}
            onDragEnter={() => setIpHover(true)} onDragLeave={() => setIpHover(false)}>
            {splitBlock_IP && <ScheduleBlock block={splitBlock_IP} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(splitBlock_IP, teamFilter, gridSearch)} />}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: caHover ? 'rgba(74,108,247,.06)' : 'transparent', transition: 'background .1s' }}
          onDragOver={prevent} onDrop={e => handleDrop(e, 'ALL')}
          onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}>
          {block && <ScheduleBlock block={block} height={height} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} dimmed={isDimmed(block, teamFilter, gridSearch)} />}
        </div>
      )}
    </div>
  )
}
export default memo(SlotRow)