// src/components/schedule/SlotRow.jsx  ← 신규 분리
import { useState } from 'react'
import ScheduleBlock from './ScheduleBlock'
import useScheduleStore from '../../store/useScheduleStore'
import { splitWeightedMin } from '../../utils/weightedMin'

export default function SlotRow({ slot, top, height, isSplit, block, splitBlock_CA, splitBlock_IP, onDrop, saveBlock, removeBlock }) {
  const [caHover, setCaHover] = useState(false)
  const [ipHover, setIpHover] = useState(false)
  const halfHeight = height / 2
  const fontSize = Math.min(10, halfHeight * 0.38)
  const prevent = e => e.preventDefault()

  const handleDrop = (e, ch) => {
    e.preventDefault()
    const isBlock = e.dataTransfer.getData('isBlock')
    const itemId  = e.dataTransfer.getData('itemId')
    const blockKey = e.dataTransfer.getData('blockKey')

    if (isBlock === 'true' && blockKey) {
      const { scheduleBlocks } = useScheduleStore.getState()
      const existingBlock = scheduleBlocks[blockKey]
      if (!existingBlock) return

      removeBlock(blockKey)
      const newKey = isSplit ? `${slot.slotId}_${ch}` : slot.slotId

      // split 상태에 따라 weightedMin 재계산 ← 버그 수정
      let targetWeightedMin = slot.weightedMin
      if (isSplit) {
        const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
        targetWeightedMin = ch === 'CA' ? caWeighted : ipWeighted
      }

      saveBlock(newKey, {
        ...existingBlock,
        slotId: slot.slotId,
        blockKey: newKey,
        dateKey: slot.dateKey,
        timeText: slot.timeText,
        durationMin: slot.durationMin,
        weightedMin: targetWeightedMin,  // ← 수정된 부분
        channel: ch,
      })
    } else if (itemId) {
      onDrop(slot, ch, itemId, isSplit)
    }
  }

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height, borderBottom: '1px solid var(--border)' }}>
      {isSplit ? (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: halfHeight, background: caHover ? 'rgba(61,90,138,.2)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'CA')}
            onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}>
            {splitBlock_CA && <ScheduleBlock block={splitBlock_CA} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
          </div>
          <div style={{ position: 'absolute', top: halfHeight, left: 0, right: 0, height: halfHeight, background: ipHover ? 'rgba(106,61,138,.2)' : 'transparent', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'IP')}
            onDragEnter={() => setIpHover(true)} onDragLeave={() => setIpHover(false)}>
            {splitBlock_IP && <ScheduleBlock block={splitBlock_IP} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
          </div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: caHover ? 'rgba(74,108,247,.06)' : 'transparent', transition: 'background .1s' }}
          onDragOver={prevent} onDrop={e => handleDrop(e, 'ALL')}
          onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}>
          {block && <ScheduleBlock block={block} height={height} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
        </div>
      )}
    </div>
  )
}