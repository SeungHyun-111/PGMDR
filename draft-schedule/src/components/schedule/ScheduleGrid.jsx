import { useMemo, useState, useRef, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ScheduleBlock from './ScheduleBlock'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const TIME_COL_WIDTH = 34
const SLOT_COL_WIDTH = 120
const HEADER_HEIGHT = 36
const TOOLBAR_HEIGHT = 32
const TARGET_SCROLL_RATIO = 1.2

function timeToMin(timeText) {
  if (!timeText) return 0
  const [h, m] = String(timeText).split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleGrid({ onBlockDrop }) {
  const { pgmSlots, scheduleBlocks } = useScheduleStore()
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 700 })
  const [splitSlots, setSplitSlots] = useState({})

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const dates = useMemo(() => {
    const seen = new Set()
    const result = []
    pgmSlots.forEach(s => {
      if (!seen.has(s.dateKey)) { seen.add(s.dateKey); result.push(s.dateKey) }
    })
    return result.sort()
  }, [pgmSlots])

  const slotsByDate = useMemo(() => {
    const map = {}
    pgmSlots.forEach(s => {
      if (!map[s.dateKey]) map[s.dateKey] = []
      map[s.dateKey].push(s)
    })
    Object.keys(map).forEach(date => {
      map[date].sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText))
    })
    return map
  }, [pgmSlots])

  // 날짜별 총 분 계산 → 가장 긴 날 기준으로 높이
  const maxTotalMin = useMemo(() => {
    return Math.max(...Object.values(slotsByDate).map(slots =>
      slots.reduce((a, s) => a + s.durationMin, 0)
    ))
  }, [slotsByDate])

  const slotHeightPerMin = useMemo(() => {
    const available = (containerSize.height - HEADER_HEIGHT - TOOLBAR_HEIGHT) * TARGET_SCROLL_RATIO
    return available / maxTotalMin
  }, [containerSize.height, maxTotalMin])

  const totalHeight = maxTotalMin * slotHeightPerMin

  // 전체 가로폭에 맞게 슬롯 컬럼 너비 자동 계산
  const slotColWidth = useMemo(() => {
    const totalCols = dates.length // 각 날짜당 시간축+슬롯 = 1세트
    const available = containerSize.width - TIME_COL_WIDTH * dates.length
    return available / dates.length
  }, [containerSize.width, dates.length])

  const toggleSplit = (slotId) => {
    setSplitSlots(prev => ({ ...prev, [slotId]: !prev[slotId] }))
  }

  if (!pgmSlots.length) return null

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* 툴바 */}
      <div style={{
        height: TOOLBAR_HEIGHT, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 12, borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0
      }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          총 {pgmSlots.length}슬롯 · {dates.length}일 · 슬롯 우클릭 → CA/IP 분리
        </div>
        {Object.values(splitSlots).some(Boolean) && (
          <button
            onClick={() => setSplitSlots({})}
            style={{
              fontSize: 10, padding: '2px 8px', background: 'var(--bg4)',
              border: '1px solid var(--border2)', color: 'var(--text2)',
              borderRadius: 4, cursor: 'pointer'
            }}
          >
            분리 전체 해제
          </button>
        )}
      </div>

      {/* 헤더 */}
      <div style={{
        display: 'flex', flexShrink: 0, height: HEADER_HEIGHT,
        borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
        zIndex: 20, overflowX: 'hidden'
      }}>
        {dates.map((date, di) => (
          <div key={date} style={{
            display: 'flex', flexShrink: 0,
            width: TIME_COL_WIDTH + slotColWidth,
            borderLeft: di === 0 ? 'none' : '2px solid var(--border2)',
          }}>
            {/* 시간 헤더 */}
            <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
            {/* 날짜 헤더 */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center'
            }}>
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
          return (
            <div key={date} style={{
              display: 'flex', flexShrink: 0,
              width: TIME_COL_WIDTH + slotColWidth,
              borderLeft: di === 0 ? 'none' : '2px solid var(--border2)',
              position: 'relative'
            }}>

              {/* 시간축 */}
<div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative', height: totalHeight, borderRight: '1px solid var(--border2)' }}>
  {slots.reduce((acc, slot) => {
    const top = acc.top
    const height = slot.durationMin * slotHeightPerMin
    const [h, m] = slot.timeText.split(':')
    acc.elements.push(
      <div key={slot.slotId} style={{
        position: 'absolute', top, left: 0, right: 0, height,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'flex-start', paddingLeft: 3
      }}>
        <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}
        </span>
      </div>
    )
    acc.top += height
    return acc
  }, { top: 0, elements: [] }).elements}
</div>

              {/* 슬롯 컬럼 */}
              <div style={{ flex: 1, position: 'relative', height: totalHeight }}>
                {slots.reduce((acc, slot) => {
                  const top = acc.top
                  const height = slot.durationMin * slotHeightPerMin
                  const isSplit = !!splitSlots[slot.slotId]
                  acc.elements.push(
                    <SlotRow
                      key={slot.slotId}
                      slot={slot}
                      top={top}
                      height={height}
                      isSplit={isSplit}
                      block={scheduleBlocks[slot.slotId]}
                      onDrop={onBlockDrop}
                      onToggleSplit={() => toggleSplit(slot.slotId)}
                    />
                  )
                  acc.top += height
                  return acc
                }, { top: 0, elements: [] }).elements}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlotRow({ slot, top, height, isSplit, block, onDrop, onToggleSplit }) {
  const [caHover, setCaHover] = useState(false)
  const [ipHover, setIpHover] = useState(false)
  const prevent = e => e.preventDefault()

  const handleDrop = (e, ch) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('itemId')
    if (itemId && onDrop) onDrop(slot, ch, itemId)
  }

  return (
    <div
      style={{
        position: 'absolute', top, left: 0, right: 0, height,
        borderBottom: '1px solid var(--border)'
      }}
      onContextMenu={e => { e.preventDefault(); onToggleSplit() }}
    >
      {isSplit ? (
        <>
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
              background: caHover ? 'rgba(61,90,138,.2)' : 'rgba(42,58,92,.06)',
              transition: 'background .1s'
            }}
            onDragOver={prevent}
            onDrop={e => handleDrop(e, 'CA')}
            onDragEnter={() => setCaHover(true)}
            onDragLeave={() => setCaHover(false)}
          >
            <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: 'var(--ca-t)', opacity: .5, fontWeight: 700 }}>CA</div>
            {block?.channel === 'CA' && <ScheduleBlock block={block} height={height} />}
          </div>
          <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: 'var(--border2)' }} />
          <div
            style={{
              position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%',
              background: ipHover ? 'rgba(106,61,138,.2)' : 'rgba(58,42,74,.06)',
              transition: 'background .1s'
            }}
            onDragOver={prevent}
            onDrop={e => handleDrop(e, 'IP')}
            onDragEnter={() => setIpHover(true)}
            onDragLeave={() => setIpHover(false)}
          >
            <div style={{ position: 'absolute', top: 2, left: 3, fontSize: 8, color: 'var(--ip-t)', opacity: .5, fontWeight: 700 }}>IP</div>
            {block?.channel === 'IP' && <ScheduleBlock block={block} height={height} />}
          </div>
        </>
      ) : (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: caHover ? 'rgba(74,108,247,.06)' : 'transparent',
            transition: 'background .1s'
          }}
          onDragOver={prevent}
          onDrop={e => handleDrop(e, 'ALL')}
          onDragEnter={() => setCaHover(true)}
          onDragLeave={() => setCaHover(false)}
        >
          {block && <ScheduleBlock block={block} height={height} />}
        </div>
      )}
    </div>
  )
}