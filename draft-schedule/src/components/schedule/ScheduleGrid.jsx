// src/components/schedule/ScheduleGrid.jsx
import { useMemo, useState, useRef, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import SlotRow from './SlotRow'
import { splitWeightedMin, timeToMin, minToTime } from '../../utils/weightedMin'
import { getEffectivePgmSlots } from '../../utils/effectiveSlots'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const TIME_COL_WIDTH = 36
const HEADER_HEIGHT = 36
const TOOLBAR_HEIGHT = 32
const MIN_ROW_HEIGHT = 28

export default function ScheduleGrid({ onBlockDrop, readOnly = false }) {
  const { pgmSlots, customSlots, scheduleBlocks, saveBlock, removeBlock, splitSlots, toggleSplitSlot, splitSlotTime, deleteSlotTime, gridSearch, setGridSearch, setSearchPanelOpen, isViewerMode, setViewerMode, runUndoBatch } = useScheduleStore()
  const viewerMode = readOnly || isViewerMode
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [containerHeight, setContainerHeight] = useState(0)
  const [splitPopup, setSplitPopup]       = useState(null)  // CA/IP 분리
  const [ctxMenu, setCtxMenu]             = useState(null)  // 시간 우클릭 메뉴
  const [timeSplitModal, setTimeSplitModal] = useState(null) // 시간 분할 모달
  const [timeSplitInput, setTimeSplitInput] = useState('')
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
    const handler = () => { setSplitPopup(null); setCtxMenu(null) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  // GAS 원본 + customSlots 오버라이드/추가를 합산한 실효 슬롯
  const effectivePgmSlots = useMemo(
    () => getEffectivePgmSlots(pgmSlots, customSlots),
    [pgmSlots, customSlots]
  )

  const dates = useMemo(() => {
    const seen = new Set()
    const result = []
    effectivePgmSlots.forEach(slot => {
      if (!seen.has(slot.dateKey)) { seen.add(slot.dateKey); result.push(slot.dateKey) }
    })
    return result.sort()
  }, [effectivePgmSlots])

  const slotsByDate = useMemo(() => {
    const map = {}
    effectivePgmSlots.forEach(slot => {
      if (!map[slot.dateKey]) map[slot.dateKey] = []
      map[slot.dateKey].push(slot)
    })
    Object.keys(map).forEach(date => {
      map[date].sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText))
    })
    return map
  }, [effectivePgmSlots])

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

  const handleTimeAxisRightClick = (e, slot, dateSlots) => {
    e.preventDefault()
    e.stopPropagation()
    if (viewerMode) return
    const idx = dateSlots.findIndex(s => s.slotId === slot.slotId)
    const x = Math.min(e.clientX, window.innerWidth  - 160)
    const y = Math.min(e.clientY, window.innerHeight - 120)
    setCtxMenu({ slot, idx, x, y })
  }

  const openCaIpPopup = slot => {
    if (viewerMode) return
    const isSplit = !!splitSlots[slot.slotId]
    const popupW = 276, popupH = 120
    const x = Math.min(ctxMenu?.x ?? 0, window.innerWidth  - popupW)
    const y = Math.min((ctxMenu?.y ?? 0) + 10, window.innerHeight - popupH)
    setCtxMenu(null)
    setSplitPopup({
      slotId: slot.slotId, slot,
      mode: isSplit ? 'merge' : 'split',
      singleBlock: scheduleBlocks[slot.slotId],
      caBlock: scheduleBlocks[`${slot.slotId}_CA`],
      ipBlock: scheduleBlocks[`${slot.slotId}_IP`],
      x, y,
    })
  }

  const openTimeSplitModal = slot => {
    if (viewerMode) return
    setCtxMenu(null)
    setTimeSplitInput('')
    setTimeSplitModal(slot)
  }

  const handleDeleteSlotTime = async slot => {
    if (viewerMode) return
    setCtxMenu(null)
    await runUndoBatch(`시간 삭제 되돌리기: ${slot.dateKey} ${slot.timeText}`, () => deleteSlotTime(slot.slotId))
  }

  const handleTimeSplitConfirm = async () => {
    if (viewerMode) return
    if (!timeSplitModal || !timeSplitInput.trim()) return
    await runUndoBatch(`시간 나누기 되돌리기: ${timeSplitModal.dateKey} ${timeSplitModal.timeText}`, () => splitSlotTime(timeSplitModal.slotId, timeSplitInput.trim()))
    setTimeSplitModal(null)
    setTimeSplitInput('')
  }

  // 시간 분할 미리보기 계산
  const timeSplitPreview = useMemo(() => {
    if (!timeSplitModal || !timeSplitInput) return null
    const slot = timeSplitModal
    const origStart = timeToMin(slot.timeText)
    const newStart  = timeToMin(timeSplitInput)
    const origEnd   = origStart + slot.durationMin
    if (newStart <= origStart || newStart >= origEnd) return null
    const firstDur  = newStart - origStart
    const secondDur = origEnd - newStart
    const rate      = slot.durationMin > 0 ? slot.weightedMin / slot.durationMin : 0
    return {
      firstDur, secondDur,
      firstWm:  Math.round(rate * firstDur),
      secondWm: Math.round(rate * secondDur),
      endTime:  minToTime(origEnd),
    }
  }, [timeSplitModal, timeSplitInput])

  const handleSplitConfirm = async choice => {
    if (viewerMode) return
    const { slotId, slot, mode, singleBlock, caBlock, ipBlock } = splitPopup
    const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)

    await runUndoBatch(`채널 ${mode === 'split' ? '분리' : '합치기'} 되돌리기: ${slot.dateKey} ${slot.timeText}`, async () => {
    if (mode === 'split') {
      await toggleSplitSlot(slotId)
      if (singleBlock && !singleBlock.isDefault) {
        await removeBlock(slotId, { keepScheduled: true })
        const keepKey = `${slotId}_${choice}`
        await saveBlock(keepKey, { ...singleBlock, slotId, blockKey: keepKey, channel: choice, weightedMin: choice === 'CA' ? caWeighted : ipWeighted })
      } else {
        await removeBlock(slotId)
      }
    } else {
      await toggleSplitSlot(slotId)
      const keepBlock = choice === 'CA' ? caBlock : ipBlock
      const removeCh  = choice === 'CA' ? 'IP' : 'CA'
      await removeBlock(`${slotId}_${removeCh}`)
      if (keepBlock && !keepBlock.isDefault) {
        await removeBlock(`${slotId}_${choice}`, { keepScheduled: true })
        await saveBlock(slotId, { ...keepBlock, slotId, blockKey: slotId, channel: choice, weightedMin: slot.weightedMin })
      } else {
        await removeBlock(`${slotId}_${choice}`)
      }
    }
    })
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
      <div style={{ height: TOOLBAR_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          총 {effectivePgmSlots.length}슬롯 · {dates.length}일
        </div>

        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 6px', borderRadius: 4, fontSize: 11, outline: 'none' }}>
          {blockTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {teamFilter !== '전체' && (
          <button onClick={() => setTeamFilter('전체')}
            style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 4, cursor: 'pointer' }}>
            ✕
          </button>
        )}

        <input
          value={gridSearch}
          onChange={e => {
            const v = e.target.value
            setGridSearch(v)
            setSearchPanelOpen(!!v)
          }}
          placeholder="🔍 편성표 검색"
          style={{
            marginLeft: 'auto',
            width: gridSearch ? 170 : 130,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '5px 8px', borderRadius: 4,
            fontSize: 11, outline: 'none', transition: 'width .2s',
          }}
        />
        <label
          title="뷰어 모드에서는 편성표 편집과 드래그 작업이 잠깁니다."
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: viewerMode ? 'var(--accent)' : 'var(--text3)',
            userSelect: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{
            color: viewerMode ? 'var(--text3)' : 'var(--accent)',
            fontWeight: viewerMode ? 400 : 700,
          }}>편집</span>
          <input
            type="checkbox"
            checked={viewerMode}
            onChange={e => {
              if (e.target.checked) {
                setSplitPopup(null)
                setCtxMenu(null)
                setTimeSplitModal(null)
              }
              setViewerMode(e.target.checked)
            }}
            style={{ display: 'none' }}
          />
          <span style={{
            width: 30,
            height: 16,
            borderRadius: 999,
            background: viewerMode ? 'var(--accent)' : 'var(--bg4)',
            border: '1px solid var(--border)',
            position: 'relative',
            transition: 'background .15s',
            flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute',
              top: 2,
              left: viewerMode ? 16 : 2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: viewerMode ? '#fff' : 'var(--text3)',
              transition: 'left .15s',
            }} />
          </span>
          <span style={{
            color: viewerMode ? 'var(--accent)' : 'var(--text3)',
            fontWeight: viewerMode ? 700 : 400,
          }}>뷰어</span>
        </label>
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
                  const isSplit   = !!splitSlots[slot.slotId]
                  const isCustom  = !!slot.isCustom
                  const timeFontSize = Math.min(13, Math.max(10, rowH * 0.28 + 2)) - (isSplit ? 2 : 0)
                  return (
                    <div key={slot.slotId}
                      style={{
                        position: 'absolute', top: currentTop, left: 0, right: 0, height: rowH,
                        overflow: 'hidden',
                        ...(isSplit
                          ? { border: '2px double var(--red)', background: 'rgba(220,38,38,.03)' }
                          : isCustom
                          ? { borderBottom: '1px dashed var(--accent)', background: 'rgba(74,108,247,.04)' }
                          : { borderBottom: '1px solid var(--border)', background: 'transparent' }
                        ),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'context-menu',
                      }}
                      onContextMenu={e => handleTimeAxisRightClick(e, slot, slots)}
                    >
                      <span style={{ fontSize: timeFontSize, color: '#000', fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: 0 }}>
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
                        gridSearch={gridSearch}
                        readOnly={viewerMode}
                      />
                    )
                  })
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* 시간축 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, boxShadow: '0 8px 24px rgba(0,0,0,.45)', padding: '4px 0', minWidth: 148 }}>
          {[
            {
              label: splitSlots[ctxMenu.slot.slotId] ? '일원 변경' : 'CA / IP 분리',
              icon: '⇄',
              action: () => openCaIpPopup(ctxMenu.slot),
            },
            { sep: true },
            {
              label: '시간 분할',
              icon: '✂',
              action: () => openTimeSplitModal(ctxMenu.slot),
            },
            {
              label: '시간 삭제',
              icon: '✕',
              disabled: ctxMenu.idx === 0,
              action: () => handleDeleteSlotTime(ctxMenu.slot),
            },
          ].map((item, i) =>
            item.sep
              ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
              : <button key={i} disabled={item.disabled} onClick={item.action}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 12, color: item.disabled ? 'var(--text3)' : 'var(--text)', cursor: item.disabled ? 'default' : 'pointer' }}>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{item.icon}</span>{item.label}
                </button>
          )}
        </div>
      )}

      {/* 시간 분할 모달 */}
      {timeSplitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setTimeSplitModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: '20px 24px', minWidth: 300, boxShadow: '0 16px 48px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>시간 분할</div>

            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
              현재 슬롯: <strong style={{ color: 'var(--text)' }}>{timeSplitModal.timeText}</strong>
              {' ~ '}
              <strong style={{ color: 'var(--text)' }}>{minToTime(timeToMin(timeSplitModal.timeText) + timeSplitModal.durationMin)}</strong>
              {' '}({timeSplitModal.durationMin}분 · WM {timeSplitModal.weightedMin})
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>새 시작시간 입력 (뒤 슬롯 시작)</div>
              <input
                autoFocus
                value={timeSplitInput}
                onChange={e => setTimeSplitInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTimeSplitConfirm(); if (e.key === 'Escape') setTimeSplitModal(null) }}
                placeholder="예: 03:41"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '8px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
            </div>

            {timeSplitPreview ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { label: `앞 슬롯 (${timeSplitModal.timeText}~${timeSplitInput})`, dur: timeSplitPreview.firstDur, wm: timeSplitPreview.firstWm },
                  { label: `뒤 슬롯 (${timeSplitInput}~${timeSplitPreview.endTime})`, dur: timeSplitPreview.secondDur, wm: timeSplitPreview.secondWm },
                ].map((p, i) => (
                  <div key={i} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 7, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{p.dur}분</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>WM {p.wm}</div>
                  </div>
                ))}
              </div>
            ) : timeSplitInput ? (
              <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 16 }}>유효하지 않은 시간입니다</div>
            ) : (
              <div style={{ height: 16, marginBottom: 16 }} />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTimeSplitModal(null)}
                style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={handleTimeSplitConfirm} disabled={!timeSplitPreview}
                style={{ flex: 1, padding: '8px 0', background: timeSplitPreview ? 'var(--accent)' : 'var(--bg4)', border: 'none', color: timeSplitPreview ? '#fff' : 'var(--text3)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: timeSplitPreview ? 'pointer' : 'default' }}>
                분할
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CA/IP 분리 팝업 */}
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
