import { useMemo, useState, useRef, useEffect } from 'react'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import ScheduleBlock from './ScheduleBlock'
import { splitWeightedMin } from '../../utils/weightedMin'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const TIME_COL_WIDTH = 34
const HEADER_HEIGHT = 36
const TOOLBAR_HEIGHT = 32
const ROW_HEIGHT = 28

function timeToMin(timeText) {
  if (!timeText) return 0
  const [h, m] = String(timeText).split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleGrid({ onBlockDrop }) {
  const { pgmSlots, scheduleBlocks, saveBlock, removeBlock } = useScheduleStore()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [splitSlots, setSplitSlots] = useState({})
  const [splitPopup, setSplitPopup] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const handler = () => setSplitPopup(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const dates = useMemo(() => {
    const seen = new Set()
    const result = []
    pgmSlots.forEach(s => { if (!seen.has(s.dateKey)) { seen.add(s.dateKey); result.push(s.dateKey) } })
    return result.sort()
  }, [pgmSlots])

  const slotsByDate = useMemo(() => {
    const map = {}
    pgmSlots.forEach(s => {
      if (!map[s.dateKey]) map[s.dateKey] = []
      map[s.dateKey].push(s)
    })
    Object.keys(map).forEach(date => map[date].sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText)))
    return map
  }, [pgmSlots])

  const getRowHeight = (slotId) => splitSlots[slotId] ? ROW_HEIGHT * 2 : ROW_HEIGHT

  const totalHeight = useMemo(() => {
    return Math.max(...dates.map(date => {
      const slots = slotsByDate[date] || []
      return slots.reduce((acc, s) => acc + getRowHeight(s.slotId), 0)
    }))
  }, [slotsByDate, dates, splitSlots])

  const colWidth = useMemo(() => {
    return (containerWidth - TIME_COL_WIDTH * dates.length) / dates.length
  }, [containerWidth, dates.length])

  const handleTimeAxisRightClick = (e, slot) => {
    e.preventDefault()
    e.stopPropagation()
    const isSplit = !!splitSlots[slot.slotId]
    const singleBlock = scheduleBlocks[slot.slotId]
    const caBlock = scheduleBlocks[`${slot.slotId}_CA`]
    const ipBlock = scheduleBlocks[`${slot.slotId}_IP`]
    setSplitPopup({ slotId: slot.slotId, slot, mode: isSplit ? 'merge' : 'split', singleBlock, caBlock, ipBlock, x: e.clientX, y: e.clientY })
  }

  const handleSplitConfirm = async (choice) => {
    const { slotId, slot, mode, singleBlock, caBlock, ipBlock } = splitPopup
    const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)

    if (mode === 'split') {
      setSplitSlots(prev => ({ ...prev, [slotId]: true }))
      if (singleBlock && !singleBlock.isDefault) {
        // 기존 실제 블록 → 선택 채널에 배치, 나머지는 디폴트
        await removeBlock(slotId)
        const keepKey = `${slotId}_${choice}`
        const otherChannel = choice === 'CA' ? 'IP' : 'CA'
        const otherKey = `${slotId}_${otherChannel}`
        await saveBlock(keepKey, { ...singleBlock, blockKey: keepKey, channel: choice, weightedMin: choice === 'CA' ? caWeighted : ipWeighted })
        await saveBlock(otherKey, makeDefaultBlock(slot, otherChannel))
      } else {
        // 디폴트 블록 → 둘 다 디폴트로 분리
        await removeBlock(slotId)
        await saveBlock(`${slotId}_CA`, makeDefaultBlock(slot, 'CA'))
        await saveBlock(`${slotId}_IP`, makeDefaultBlock(slot, 'IP'))
      }
    } else {
      // 분리 → 일원
      setSplitSlots(prev => ({ ...prev, [slotId]: false }))
      const keepBlock = choice === 'CA' ? caBlock : ipBlock
      const removeChannel = choice === 'CA' ? 'IP' : 'CA'
      await removeBlock(`${slotId}_${removeChannel}`)
      if (keepBlock && !keepBlock.isDefault) {
        await removeBlock(`${slotId}_${choice}`)
        await saveBlock(slotId, { ...keepBlock, blockKey: slotId, channel: choice, weightedMin: slot.weightedMin })
      } else {
        await removeBlock(`${slotId}_${choice}`)
        await saveBlock(slotId, makeDefaultBlock(slot, 'ALL'))
      }
    }
    setSplitPopup(null)
  }

  if (!pgmSlots.length) return null

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* 툴바 */}
      <div style={{ height: TOOLBAR_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 {pgmSlots.length}슬롯 · {dates.length}일 · 시간축 우클릭 → CA/IP 분리</div>
        {Object.values(splitSlots).some(Boolean) && (
          <button onClick={() => setSplitSlots({})} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 4, cursor: 'pointer' }}>분리 전체 해제</button>
        )}
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', flexShrink: 0, height: HEADER_HEIGHT, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', zIndex: 20 }}>
        {dates.map((date, di) => (
          <div key={date} style={{ display: 'flex', flexShrink: 0, width: TIME_COL_WIDTH + colWidth, borderLeft: di === 0 ? 'none' : '2px solid var(--border2)' }}>
            <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                {DAY_LABELS[di]} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)' }}>{date.slice(5)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 바디 */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex' }}>
        {dates.map((date, di) => {
          const slots = slotsByDate[date] || []
          let top = 0
          return (
            <div key={date} style={{ display: 'flex', flexShrink: 0, width: TIME_COL_WIDTH + colWidth, borderLeft: di === 0 ? 'none' : '2px solid var(--border2)', position: 'relative', height: totalHeight }}>

              {/* 시간축 */}
              <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative', height: totalHeight, borderRight: '1px solid var(--border2)' }}>
                {slots.map(slot => {
                  const rowH = getRowHeight(slot.slotId)
                  const t = top
                  top += rowH
                  const [h, m] = slot.timeText.split(':')
                  const isSplit = !!splitSlots[slot.slotId]
                  return (
                    <div
                      key={slot.slotId}
                      style={{ position: 'absolute', top: t, left: 0, right: 0, height: rowH, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 3, cursor: 'context-menu', background: isSplit ? 'rgba(74,108,247,.05)' : 'transparent' }}
                      onContextMenu={e => handleTimeAxisRightClick(e, slot)}
                    >
                      <span style={{ fontSize: Math.min(10, rowH * 0.38), color: isSplit ? 'var(--accent2)' : 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 슬롯 컬럼 */}
              <div style={{ flex: 1, position: 'relative', height: totalHeight }}>
                {(() => {
                  let t = 0
                  return slots.map(slot => {
                    const rowH = getRowHeight(slot.slotId)
                    const isSplit = !!splitSlots[slot.slotId]
                    const singleBlock = scheduleBlocks[slot.slotId]
                    const caBlock = scheduleBlocks[`${slot.slotId}_CA`]
                    const ipBlock = scheduleBlocks[`${slot.slotId}_IP`]
                    const el = (
                      <SlotRow
                        key={slot.slotId}
                        slot={slot}
                        top={t}
                        rowHeight={rowH}
                        halfHeight={ROW_HEIGHT}
                        isSplit={isSplit}
                        singleBlock={singleBlock}
                        caBlock={caBlock}
                        ipBlock={ipBlock}
                        onDrop={onBlockDrop}
                        saveBlock={saveBlock}
                        removeBlock={removeBlock}
                      />
                    )
                    t += rowH
                    return el
                  })
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* 분리/일원 팝업 */}
      {splitPopup && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: splitPopup.x, top: splitPopup.y, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '12px 16px', minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          {splitPopup.mode === 'split' ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>CA / IP 분리</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                {splitPopup.singleBlock && !splitPopup.singleBlock.isDefault
                  ? 'CA/IP 분리 시 현재 블록을 어느 채널에 남기겠습니까?'
                  : '빈 슬롯을 CA/IP로 분리합니다.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {splitPopup.singleBlock && !splitPopup.singleBlock.isDefault ? (
                  <>
                    <button onClick={() => handleSplitConfirm('CA')} style={{ flex: 1, padding: '7px 0', background: 'var(--ca2)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CA 유지</button>
                    <button onClick={() => handleSplitConfirm('IP')} style={{ flex: 1, padding: '7px 0', background: 'var(--ip2)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>IP 유지</button>
                  </>
                ) : (
                  <button onClick={() => handleSplitConfirm('CA')} style={{ flex: 1, padding: '7px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>분리</button>
                )}
                <button onClick={() => setSplitPopup(null)} style={{ flex: 1, padding: '7px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>취소</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>전채널(일원) 변경</div>
              <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 12, lineHeight: 1.5 }}>
                ⚠ CA/IP 중 선택한 하나만 남기고 나머지는 삭제됩니다.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(splitPopup.caBlock && !splitPopup.caBlock.isDefault) && (
                  <button onClick={() => handleSplitConfirm('CA')} style={{ flex: 1, padding: '7px 0', background: 'var(--ca2)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CA 유지</button>
                )}
                {(splitPopup.ipBlock && !splitPopup.ipBlock.isDefault) && (
                  <button onClick={() => handleSplitConfirm('IP')} style={{ flex: 1, padding: '7px 0', background: 'var(--ip2)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>IP 유지</button>
                )}
                {(!splitPopup.caBlock || splitPopup.caBlock.isDefault) && (!splitPopup.ipBlock || splitPopup.ipBlock.isDefault) && (
                  <button onClick={() => handleSplitConfirm('CA')} style={{ flex: 1, padding: '7px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>일원으로 변경</button>
                )}
                <button onClick={() => setSplitPopup(null)} style={{ flex: 1, padding: '7px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>취소</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SlotRow({ slot, top, rowHeight, halfHeight, isSplit, singleBlock, caBlock, ipBlock, onDrop, saveBlock, removeBlock }) {
  const [caHover, setCaHover] = useState(false)
  const [ipHover, setIpHover] = useState(false)
  const prevent = e => e.preventDefault()

  const handleDrop = (e, ch) => {
    e.preventDefault()
    const isBlock = e.dataTransfer.getData('isBlock')
    const itemId = e.dataTransfer.getData('itemId')
    const blockKey = e.dataTransfer.getData('blockKey')

    if (isBlock === 'true' && blockKey) {
      const { scheduleBlocks } = useScheduleStore.getState()
      const existingBlock = scheduleBlocks[blockKey]
      if (!existingBlock) return
      removeBlock(blockKey)
      const newKey = isSplit ? `${slot.slotId}_${ch}` : slot.slotId
      saveBlock(newKey, { ...existingBlock, slotId: slot.slotId, blockKey: newKey, dateKey: slot.dateKey, timeText: slot.timeText, durationMin: slot.durationMin, weightedMin: slot.weightedMin, channel: ch })
    } else if (itemId) {
      onDrop(slot, ch, itemId, isSplit)
    }
  }

  const fontSize = Math.min(10, halfHeight * 0.38)

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height: rowHeight, borderBottom: '1px solid var(--border)' }}>
      {isSplit ? (
        <>
          <div
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: halfHeight, background: caHover ? 'rgba(61,90,138,.2)' : 'transparent', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'CA')}
            onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}
          >
            {caBlock && <ScheduleBlock block={caBlock} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
          </div>
          <div
            style={{ position: 'absolute', top: halfHeight, left: 0, right: 0, height: halfHeight, background: ipHover ? 'rgba(106,61,138,.2)' : 'transparent', transition: 'background .1s' }}
            onDragOver={prevent} onDrop={e => handleDrop(e, 'IP')}
            onDragEnter={() => setIpHover(true)} onDragLeave={() => setIpHover(false)}
          >
            {ipBlock && <ScheduleBlock block={ipBlock} height={halfHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
          </div>
        </>
      ) : (
        <div
          style={{ position: 'absolute', inset: 0, background: caHover ? 'rgba(74,108,247,.06)' : 'transparent', transition: 'background .1s' }}
          onDragOver={prevent} onDrop={e => handleDrop(e, 'ALL')}
          onDragEnter={() => setCaHover(true)} onDragLeave={() => setCaHover(false)}
        >
          {singleBlock && <ScheduleBlock block={singleBlock} height={rowHeight} fontSize={fontSize} removeBlock={removeBlock} saveBlock={saveBlock} />}
        </div>
      )}
    </div>
  )
}