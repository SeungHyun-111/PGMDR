// src/components/schedule/ScheduleGrid.jsx
import { useMemo, useState, useRef, useEffect } from 'react'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import SlotRow from './SlotRow'
import { splitWeightedMin } from '../../utils/weightedMin'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const TIME_COL_WIDTH = 34
const HEADER_HEIGHT = 36
const TOOLBAR_HEIGHT = 32
const MIN_ROW_HEIGHT = 28

function timeToMin(timeText) {
  if (!timeText) return 0
  const [h, m] = String(timeText).split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleGrid({ onBlockDrop }) {
  const { pgmSlots, scheduleBlocks, saveBlock, removeBlock, splitSlots, toggleSplitSlot } = useScheduleStore()
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [containerHeight, setContainerHeight] = useState(0)
  const [splitPopup, setSplitPopup] = useState(null)
  const [teamFilter, setTeamFilter] = useState('전체')

  // pgmSlots가 실제로 로드된 뒤 컨테이너가 DOM에 붙으므로 hasPgmSlots 변화 시 재실행
  const hasPgmSlots = pgmSlots.length > 0
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
      setContainerHeight(entries[0].contentRect.height)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [hasPgmSlots])

  useEffect(() => {
    const handler = () => setSplitPopup(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const dates = useMemo(() => {
    const seen = new Set()
    const result = []
    pgmSlots.forEach(slot => {
      if (!seen.has(slot.dateKey)) { seen.add(slot.dateKey); result.push(slot.dateKey) }
    })
    return result.sort()
  }, [pgmSlots])

  const slotsByDate = useMemo(() => {
    const map = {}
    pgmSlots.forEach(slot => {
      if (!map[slot.dateKey]) map[slot.dateKey] = []
      map[slot.dateKey].push(slot)
    })
    Object.keys(map).forEach(date => {
      map[date].sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText))
    })
    return map
  }, [pgmSlots])

  // 날짜별 슬롯 유닛 수(split=2, single=1)의 최대값 → 세로 높이 기준
  const maxSlotUnits = useMemo(() => {
    if (!dates.length) return 0
    return Math.max(...dates.map(date =>
      (slotsByDate[date] || []).reduce((sum, s) => sum + (splitSlots[s.slotId] ? 2 : 1), 0)
    ))
  }, [slotsByDate, dates, splitSlots])

  // 툴바·헤더를 뺀 실제 그리드 바디 가용 높이
  const bodyAvailableHeight = Math.max(0, containerHeight - HEADER_HEIGHT - TOOLBAR_HEIGHT)

  // 전체 그리드 높이: 최소 MIN_ROW_HEIGHT 보장, 남는 공간이 있으면 꽉 채움
  const totalHeight = useMemo(() => {
    const natural = maxSlotUnits * MIN_ROW_HEIGHT
    return bodyAvailableHeight > 0 ? Math.max(natural, bodyAvailableHeight) : natural
  }, [bodyAvailableHeight, maxSlotUnits])

  // 슬롯 1유닛당 실제 픽셀 높이
  const unitHeight = maxSlotUnits > 0 ? totalHeight / maxSlotUnits : MIN_ROW_HEIGHT
  const getRowHeight = slotId => splitSlots[slotId] ? unitHeight * 2 : unitHeight

  const colWidth = useMemo(() => {
    if (!dates.length) return 0
    return (containerWidth - TIME_COL_WIDTH * dates.length) / dates.length
  }, [containerWidth, dates.length])

  const handleTimeAxisRightClick = (e, slot) => {
    e.preventDefault()
    e.stopPropagation()
    const isSplit = !!splitSlots[slot.slotId]
    const popupW = 276
    const popupH = 120
    const x = e.clientX + popupW > window.innerWidth  ? e.clientX - popupW : e.clientX
    const y = e.clientY + popupH > window.innerHeight ? e.clientY - popupH : e.clientY
    setSplitPopup({
      slotId: slot.slotId, slot,
      mode: isSplit ? 'merge' : 'split',
      singleBlock: scheduleBlocks[slot.slotId],
      caBlock: scheduleBlocks[`${slot.slotId}_CA`],
      ipBlock: scheduleBlocks[`${slot.slotId}_IP`],
      x, y,
    })
  }

  const handleSplitConfirm = async choice => {
    const { slotId, slot, mode, singleBlock, caBlock, ipBlock } = splitPopup
    const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)

    if (mode === 'split') {
      await toggleSplitSlot(slotId)
      if (singleBlock && !singleBlock.isDefault) {
        await removeBlock(slotId)
        const keepKey  = `${slotId}_${choice}`
        const otherCh  = choice === 'CA' ? 'IP' : 'CA'
        const otherKey = `${slotId}_${otherCh}`
        await saveBlock(keepKey, { ...singleBlock, slotId, blockKey: keepKey, channel: choice, weightedMin: choice === 'CA' ? caWeighted : ipWeighted })
        await saveBlock(otherKey, makeDefaultBlock(slot, otherCh))
      } else {
        await removeBlock(slotId)
        await saveBlock(`${slotId}_CA`, makeDefaultBlock(slot, 'CA'))
        await saveBlock(`${slotId}_IP`, makeDefaultBlock(slot, 'IP'))
      }
    } else {
      await toggleSplitSlot(slotId)
      const keepBlock = choice === 'CA' ? caBlock : ipBlock
      const removeCh  = choice === 'CA' ? 'IP' : 'CA'
      await removeBlock(`${slotId}_${removeCh}`)
      if (keepBlock && !keepBlock.isDefault) {
        await removeBlock(`${slotId}_${choice}`)
        await saveBlock(slotId, { ...keepBlock, slotId, blockKey: slotId, channel: choice, weightedMin: slot.weightedMin })
      } else {
        await removeBlock(`${slotId}_${choice}`)
        await saveBlock(slotId, makeDefaultBlock(slot, 'ALL'))
      }
    }
    setSplitPopup(null)
  }

  const blockTeams = useMemo(() => {
    const set = new Set()
    Object.values(scheduleBlocks).forEach(b => {
      if (b && !b.isDefault) {
        const t = b.mdTeam || b.orgName || ''
        if (t) set.add(t)
      }
    })
    return ['전체', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))]
  }, [scheduleBlocks])

  if (!pgmSlots.length) return null

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* 툴바 */}
      <div style={{ height: TOOLBAR_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          총 {pgmSlots.length}슬롯 · {dates.length}일 · 시간축 우클릭 → CA/IP 분리
        </div>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 6px', borderRadius: 4, fontSize: 11, outline: 'none', marginLeft: 4 }}>
          {blockTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter !== '전체' && (
          <button onClick={() => setTeamFilter('전체')}
            style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 4, cursor: 'pointer' }}>
            ✕
          </button>
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
          let timeTop = 0
          return (
            <div key={date} style={{ display: 'flex', flexShrink: 0, width: TIME_COL_WIDTH + colWidth, borderLeft: di === 0 ? 'none' : '2px solid var(--border2)', position: 'relative', height: totalHeight }}>

              {/* 시간축 */}
              <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'relative', height: totalHeight, borderRight: '1px solid var(--border2)' }}>
                {slots.map(slot => {
                  const rowH = getRowHeight(slot.slotId)
                  const currentTop = timeTop
                  timeTop += rowH
                  const [h, m] = slot.timeText.split(':')
                  const isSplit = !!splitSlots[slot.slotId]
                  return (
                    <div key={slot.slotId}
                      style={{
                        position: 'absolute', top: currentTop, left: 0, right: 0, height: rowH,
                        ...(isSplit
                          ? { border: '2px double var(--red)', background: 'rgba(220,38,38,.03)' }
                          : { borderBottom: '1px solid var(--border)', background: 'transparent' }
                        ),
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                        paddingLeft: 3, cursor: 'context-menu',
                      }}
                      onContextMenu={e => handleTimeAxisRightClick(e, slot)}
                    >
                      <span style={{ fontSize: Math.min(12, Math.max(9, rowH * 0.3)), color: isSplit ? 'var(--red)' : 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* 슬롯 */}
              <div style={{ flex: 1, position: 'relative', height: totalHeight }}>
                {(() => {
                  let rowTop = 0
                  return slots.map(slot => {
                    const rowH = getRowHeight(slot.slotId)
                    const currentTop = rowTop
                    rowTop += rowH
                    const isSplit = !!splitSlots[slot.slotId]
                    return (
                      <SlotRow
                        key={slot.slotId}
                        slot={slot}
                        top={currentTop}
                        height={rowH}
                        isSplit={isSplit}
                        block={scheduleBlocks[slot.slotId]}
                        splitBlock_CA={scheduleBlocks[`${slot.slotId}_CA`]}
                        splitBlock_IP={scheduleBlocks[`${slot.slotId}_IP`]}
                        onDrop={onBlockDrop}
                        saveBlock={saveBlock}
                        removeBlock={removeBlock}
                        teamFilter={teamFilter}
                      />
                    )
                  })
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* 분리 팝업 */}
      {splitPopup && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: splitPopup.x, top: splitPopup.y, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '12px 16px', minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
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
              <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 12, lineHeight: 1.5 }}>⚠ CA/IP 중 선택한 하나만 남기고 나머지는 삭제됩니다.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {splitPopup.caBlock && !splitPopup.caBlock.isDefault && (
                  <button onClick={() => handleSplitConfirm('CA')} style={{ flex: 1, padding: '7px 0', background: 'var(--ca2)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>CA 유지</button>
                )}
                {splitPopup.ipBlock && !splitPopup.ipBlock.isDefault && (
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