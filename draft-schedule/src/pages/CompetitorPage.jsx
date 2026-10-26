import { useEffect, useId, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { clearCompetitorScheduleCache, fetchScheduleMonths, fetchScheduleWeek } from '../api/competitorSchedule'
import './CompetitorPage.css'
import CompetitorRefresh from '../components/common/CompetitorRefresh'
import CompetitorProgramTooltip from '../components/common/CompetitorProgramTooltip'
import { buildCompetitorTimeline, PIXELS_PER_MINUTE } from '../utils/competitorTimeline'
import useScheduleStore from '../store/useScheduleStore'
import usePromotionLastViewedDate from '../hooks/usePromotionLastViewedDate'
import CompetitorOrganizationFilter from '../components/common/CompetitorOrganizationFilter'
import useCompetitorVisibilityStore from '../store/useCompetitorVisibilityStore'
import CompetitorMeetingNotes from '../components/common/CompetitorMeetingNotes'
import { summarizeCompetitorHighlights } from '../utils/competitorHighlight'
import CompetitorBrandSummary from '../components/common/CompetitorBrandSummary'
import useLocalStorageState from '../hooks/useLocalStorageState'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const normalizedMeetingHeight = value => Number.isFinite(value) ? Math.min(75, Math.max(20, value)) : 40
const organization = row => String(row.org || '').trim() || '조직 미등록'
const number = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })
const monday = value => {
  const date = dayjs(value)
  return date.subtract((date.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

export default function CompetitorPage() {
  const competitorSearchHidden = useCompetitorVisibilityStore(state => state.hidden)
  const setCompetitorSearchHidden = useCompetitorVisibilityStore(state => state.setHidden)
  const [company, setCompany] = useState('SSG')
  const [activeView, setActiveView] = useState('schedule')
  const [meetingInputOpen, setMeetingInputOpen] = useState(false)
  const [storedMeetingHeight, setMeetingHeight] = useLocalStorageState('pgmdr:competitor-meeting-height-v1', 40)
  const meetingHeight = normalizedMeetingHeight(storedMeetingHeight)
  const scheduleLayout = useRef(null)
  const calendarBoundary = useRef(null)
  const resizingMeeting = useRef(false)
  const [highlightSearch, setHighlightSearch] = useState('')
  const [selectedOrganizations, setSelectedOrganizations] = useState([])
  const [verticalScale, setVerticalScale] = useState(100)
  const [scaleInput, setScaleInput] = useState('100')
  const pixelsPerMinute = PIXELS_PER_MINUTE * verticalScale / 100
  const userName = useScheduleStore(state => state.userName)
  const { date: savedWeek, ready: weekReady, error: weekError, selectDate: saveWeek } = usePromotionLastViewedDate(userName, 'weekly', true, 'competitorSchedule')
  const [defaultWeek, setDefaultWeek] = useState('')
  const validSavedWeek = /^\d{4}-\d{2}-\d{2}$/.test(savedWeek) && dayjs(savedWeek).isValid() && dayjs(savedWeek).format('YYYY-MM-DD') === savedWeek
  const week = weekReady ? (validSavedWeek ? monday(savedWeek) : defaultWeek) : ''
  const setWeek = value => { setDefaultWeek(value); saveWeek(value) }
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [tooltip, setTooltip] = useState(null)
  const tooltipId = useId()
  useEffect(() => {
    if (!weekReady || week) return
    const controller = new AbortController()
    fetchScheduleMonths(controller.signal).then(months => {
      if (!months.length) throw new Error('저장된 경쟁사 데이터가 없습니다.')
      const last = months.at(-1)
      const initialWeek = monday(dayjs(`${last.slice(0, 4)}-${last.slice(4)}-01`).endOf('month'))
      setDefaultWeek(initialWeek)
      saveWeek(initialWeek)
    }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false) } })
    return () => controller.abort()
  }, [revision, week, weekReady, saveWeek])
  useEffect(() => {
    if (!week) return
    const controller = new AbortController()
    const dates = Array.from({ length: 8 }, (_, i) => dayjs(week).add(i - 1, 'day').format('YYYY-MM-DD'))
    fetchScheduleWeek(company, dates, controller.signal).then(data => {
      if (!controller.signal.aborted) setRows(data)
    }).catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [company, week, revision])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs(week || undefined).add(i, 'day')), [week])
  const organizations = useMemo(() => [...new Set(rows.map(organization))].sort((a, b) => a.localeCompare(b, 'ko')), [rows])
  const weekRows = useMemo(() => rows.filter(row => row.date >= week), [rows, week])
  // Organization selection only changes emphasis; every broadcast keeps its position.
  const timeline = useMemo(() => buildCompetitorTimeline(rows, days.map(date => date.format('YYYY-MM-DD')), company), [rows, days, company])
  const highlights = useMemo(() => summarizeCompetitorHighlights(timeline, highlightSearch, selectedOrganizations), [timeline, highlightSearch, selectedOrganizations])
  const reset = () => { setLoading(true); setError(''); setRows([]); setTooltip(null) }
  const showTooltip = (event, detail) => setTooltip({ ...detail, company, anchor: event.currentTarget.getBoundingClientRect(), pointer: Number.isFinite(event.clientX) && !(event.type === 'click' && event.detail === 0) ? { x: event.clientX, y: event.clientY } : null })
  const changeWeek = value => { if (value === week) return; reset(); setWeek(value) }
  const refresh = async () => { await clearCompetitorScheduleCache(); reset(); setRevision(value => value + 1) }
  const move = offset => changeWeek(dayjs(week).add(offset, 'week').format('YYYY-MM-DD'))
  const resizeMeeting = clientY => {
    const rect = scheduleLayout.current.getBoundingClientRect()
    if (rect.height) setMeetingHeight(Math.min(75, Math.max(20, (rect.bottom - clientY) / rect.height * 100)))
    setTooltip(null)
  }
  return <section className="competitor-page">
    <header className="competitor-toolbar">
      <div className="competitor-toolbar-left">
      <h2>경쟁사 주간 편성표</h2>
      <div className="competitor-channels" role="group" aria-label="경쟁사 채널">{['SSG', 'K'].map(channel => <button key={channel} aria-pressed={company === channel} onClick={() => { if (company !== channel) { reset(); setSelectedOrganizations([]); setCompany(channel) } }}>{channel}</button>)}</div>
      <CompetitorOrganizationFilter options={organizations} selected={selectedOrganizations} onChange={value => { setTooltip(null); setSelectedOrganizations(value) }} />
      <CompetitorBrandSummary company={company} week={week} rows={rows} loading={loading} revision={revision} preferredOrganization={selectedOrganizations[0]} boundaryRef={calendarBoundary} active={activeView === 'schedule'} onActivate={() => setActiveView('schedule')} />
      <label className="competitor-scale">세로 배율 <input type="number" min="0" step="any" aria-label="편성표 세로 배율" value={scaleInput}
        onChange={event => {
          const value = event.target.value
          setScaleInput(value)
          const scale = Number(value)
          if (Number.isFinite(scale) && scale > 0) { setTooltip(null); setVerticalScale(scale) }
        }}
        onBlur={() => setScaleInput(String(verticalScale))}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />%</label>
      </div>
      <div className="competitor-toolbar-center">
        <div className="competitor-week"><button disabled={!week} onClick={() => move(-1)} aria-label="이전 주">‹</button><label className="competitor-week-picker"><span>{week ? `${dayjs(week).format('YYYY년 M월 D일')} 주차` : '주차 선택'}</span><input type="date" aria-label="조회 주차" value={week} onChange={e => { if (e.target.value) changeWeek(monday(e.target.value)) }} /></label><button disabled={!week} onClick={() => move(1)} aria-label="다음 주">›</button></div>
        <div className="competitor-view-tabs" role="group" aria-label="경쟁사 화면 선택">{[['schedule', '편성표'], ['meeting', '회의자료']].map(([view, label]) => <button key={view} aria-pressed={activeView === view} onClick={() => { setTooltip(null); setActiveView(view) }}>{label}</button>)}</div>
        <div className="competitor-highlight-search" role="search" aria-label="편성표 하이라이트 검색">
          <input type="search" aria-label="편성표 하이라이트 검색어" placeholder="브랜드·상품·카테고리·조직 검색" value={highlightSearch}
            onFocus={() => setActiveView('schedule')}
            onChange={event => { setTooltip(null); setHighlightSearch(event.target.value) }}
            onKeyDown={event => { if (event.key === 'Escape') setHighlightSearch('') }} />
          {highlightSearch && <button type="button" aria-label="하이라이트 검색 지우기" onClick={() => setHighlightSearch('')}>×</button>}
          {activeView === 'schedule' && highlights.query && <div className="competitor-highlight-summary" role="status" aria-live="polite">
            <strong>“{highlightSearch.trim()}”</strong>
            {loading ? <span>불러오는 중…</span> : <><span>PGM <b>{number(highlights.count)}</b>건</span><span>가중분 <b>{highlights.weightedMin.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</b>분</span><span>매출액 <b>{number(highlights.revenue)}</b>원</span>{highlights.count === 0 && <span>일치하는 방송이 없습니다.</span>}</>}
            <small>현재 채널·주차·조직 기준</small>
          </div>}
        </div>
      </div>
      <div className="competitor-toolbar-actions"><button onClick={refresh}>새로고침</button><CompetitorRefresh onComplete={month => { reset(); setWeek(monday(`${month}-01`)); setRevision(value => value + 1) }} /><label className="competitor-search-toggle"><input type="checkbox" checked={!competitorSearchHidden} onChange={event => setCompetitorSearchHidden(!event.target.checked)} />검색 토글</label><label className="competitor-search-toggle"><input type="checkbox" checked={meetingInputOpen} aria-controls="competitor-meeting-input-panel" onChange={event => { setMeetingInputOpen(event.target.checked); setTooltip(null); if (event.target.checked) setActiveView('schedule') }} />회의자료 입력</label></div>
    </header>
    {weekError && <div className="competitor-message" role="status">{weekError}</div>}
    {activeView === 'meeting' ? <CompetitorMeetingNotes key={`${week}-${userName}`} week={week} organizations={organizations} userName={userName} revision={revision} currentCompany={!error ? company : undefined} currentRows={rows} currentRowsReady={!loading} /> : <>
    {error && <div className="competitor-message" role="alert">{error} <button onClick={refresh}>다시 시도</button></div>}
    {!loading && !error && ![...timeline.values()].some(blocks => blocks.length) && <div className="competitor-message">선택한 주에 저장된 방송이 없습니다.</div>}
    <div ref={scheduleLayout} className={`competitor-schedule-layout${meetingInputOpen ? ' with-meeting' : ''}`} style={meetingInputOpen ? { gridTemplateRows: `minmax(180px, ${100 - meetingHeight}fr) 8px minmax(160px, ${meetingHeight}fr)` } : undefined}>
    <div ref={calendarBoundary} className="competitor-grid-scroll" aria-busy={loading}>
      <div className="competitor-timeline" style={{ '--hour-height': `${60 * pixelsPerMinute}px` }}>
        <div className="competitor-timeline-head"><div>시간</div>{days.map((date, i) => <div key={i} className={i > 4 ? 'weekend' : ''}>{date.format('MM.DD')} ({DAYS[i]})<small>{loading ? '—' : `${weekRows.filter(row => row.date === date.format('YYYY-MM-DD')).length}건`}</small></div>)}</div>
        <div className="competitor-timeline-body" style={{ height: 1440 * pixelsPerMinute }}>
          <div className="competitor-time-axis">{HOURS.map(hour => <span key={hour} style={{ top: hour * 60 * pixelsPerMinute }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
          {days.map(date => <div className="competitor-day-track" key={date.format('YYYY-MM-DD')} aria-label={date.format('YYYY-MM-DD')}>
            {(timeline.get(date.format('YYYY-MM-DD')) || []).map(({ row, channel, start, end, duration, label, continuation, lane, lanes }) => <article className={`competitor-program${end - start < 35 ? ' compact' : ''}${duration ? '' : ' unknown-duration'}${selectedOrganizations.length ? selectedOrganizations.includes(organization(row)) ? ' organization-hit' : ' organization-miss' : ''}${highlights.query ? highlights.matchedIds.has(row.id) ? ' search-hit' : ' search-miss' : ''}`} key={`${row.id}-${continuation}`} tabIndex={0}
              data-organization={organization(row)}
              data-channel={company === 'SSG' ? channel || 'ALL' : undefined}
              aria-label={`${row.brand || '브랜드 미등록'}, ${number(row.revenue)}원`}
              aria-describedby={tooltip?.row.id === row.id && tooltip?.continuation === continuation ? tooltipId : undefined}
              onPointerEnter={event => showTooltip(event, { row, channel, label, duration, continuation })}
              onPointerLeave={() => setTooltip(null)}
              onFocus={event => showTooltip(event, { row, channel, label, duration, continuation })}
              onBlur={() => setTooltip(null)}
              onClick={event => showTooltip(event, { row, channel, label, duration, continuation })}
              style={{ top: start * pixelsPerMinute, height: (end - start) * pixelsPerMinute, left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
              <div className="competitor-program-meta"><b>{channel ? `${channel} · ` : ''}{continuation ? '전날 시작 · ' : ''}{label} · 단순 {duration ? `${duration}분` : '미등록'}</b><span>가중 {row.weightedMin != null ? `${number(row.weightedMin)}분` : '미등록'}</span></div>
              <div className="competitor-program-main"><strong className="competitor-program-brand">{row.brand || '브랜드 미등록'}</strong><b className="competitor-program-revenue">{number(row.revenue)}원</b></div>
              <div className="competitor-program-footer"><span>{row.mdCategory || row.org}</span></div>
            </article>)}
          </div>)}
        </div>
      </div>
    </div>
    {meetingInputOpen && <><div className="competitor-meeting-resizer" role="separator" tabIndex={0} aria-label="회의자료 입력 높이 조절" aria-orientation="horizontal" aria-valuemin={20} aria-valuemax={75} aria-valuenow={Math.round(meetingHeight)} title="위아래로 드래그하여 높이 조절 · 방향키로 조절"
      onPointerDown={event => { event.preventDefault(); resizingMeeting.current = true; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { if (resizingMeeting.current) resizeMeeting(event.clientY) }}
      onPointerUp={event => { resizingMeeting.current = false; event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { resizingMeeting.current = false }}
      onKeyDown={event => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        setTooltip(null)
        setMeetingHeight(value => event.key === 'Home' ? 20 : event.key === 'End' ? 75 : normalizedMeetingHeight(normalizedMeetingHeight(value) + (event.key === 'ArrowUp' ? 5 : -5)))
      }} />
    <aside id="competitor-meeting-input-panel" className="competitor-meeting-input-sidebar" aria-label="편성표 회의자료 입력">
      <CompetitorMeetingNotes key={`${week}-${userName}`} week={week} organizations={organizations} userName={userName} revision={revision} currentCompany={!error ? company : undefined} currentRows={rows} currentRowsReady={!loading} draftMode onSaved={() => { setTooltip(null); setActiveView('meeting') }} />
    </aside></>}
    </div>
    {tooltip && <CompetitorProgramTooltip detail={tooltip} id={tooltipId} onClose={setTooltip} boundaryRef={calendarBoundary} />}
    </>}
  </section>
}
