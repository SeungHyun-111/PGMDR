import PromotionReservationsTab from './PromotionReservationsTab'
import { useEffect, useMemo, useState } from 'react'
import { getPromotionBroadcasts } from '../utils/promotionPerformance'
import { dateRange } from '../utils/performanceQuery'
import usePerformanceQuery from '../hooks/usePerformanceQuery'
import usePerformanceQueryStore, { watchPerformanceMeta } from '../store/usePerformanceQueryStore'
import PromotionBroadcastRow from '../components/common/PromotionBroadcastRow'
import usePromotionAssignmentStore, { subscribePromotionAssignments } from '../store/usePromotionAssignmentStore'
import PromotionOrganizationFilter from '../components/common/PromotionOrganizationFilter'
import mdNameTeamMap from '../data/md-name-team-map.json'
import useScheduleStore from '../store/useScheduleStore'
import usePromotionLastViewedDate from '../hooks/usePromotionLastViewedDate'
import { db, ref, onValue } from '../api/firebase'
import { PROMOTION_RESERVATIONS_PATH } from '../utils/promotionAssignment'
import { getUncheckedPromotionBroadcasts } from '../utils/promotionSelectionNotice'
import PromotionFormulaTooltip from '../components/common/PromotionFormulaTooltip'
import usePerformanceRange from '../hooks/usePerformanceRange'
import { normalizePromotionDate } from '../utils/promotionDate'

const getOrganization = row => String(row.mdTeam || row.orgName || mdNameTeamMap[String(row.mdName || '').trim()] || '미분류').trim()

export default function PromotionPgmSelectionTab({ promotions, loaded, active }) {
  const [mode, setMode] = useState('results')
  const [selectedId, setSelectedId] = useState('')
  const userName = useScheduleStore(state => state.userName)
  const { date: dateChoice, selectDate: setDateChoice, ready: dateReady, error: dateError } = usePromotionLastViewedDate(userName, selectedId, active)
  const [organizations, setOrganizations] = useState([])
  const [targetOnly, setTargetOnly] = useState(false)
  const [today, setToday] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()))
  const assignmentError = usePromotionAssignmentStore(state => state.error)
  const assignmentIds = usePromotionAssignmentStore(state => state.ids)
  const assignmentNames = usePromotionAssignmentStore(state => state.names)
  const assignmentsReady = usePromotionAssignmentStore(state => state.ready)
  const [reservationState, setReservationState] = useState({ rows: {}, ready: false, error: '' })
  const meta = usePerformanceQueryStore(state => state.meta)
  const performanceGlobalLoaded = usePerformanceQueryStore(state => state.metaReady)
  const metaError = usePerformanceQueryStore(state => state.error)
  const selected = promotions.find(([id]) => id === selectedId)?.[1]
  const hasSelection = !!selectedId

  useEffect(() => {
    if (!active || !hasSelection) return
    return onValue(ref(db, PROMOTION_RESERVATIONS_PATH), snapshot => {
      setReservationState({ rows: snapshot.val() || {}, ready: true, error: '' })
    }, () => setReservationState({ rows: {}, ready: false, error: '예약방송 정보를 불러오지 못했습니다.' }))
  }, [active, hasSelection])

  useEffect(() => {
    if (active && hasSelection) return subscribePromotionAssignments()
  }, [active, hasSelection])

  useEffect(() => {
    if (active) return watchPerformanceMeta()
  }, [active])

  useEffect(() => {
    const timer = setInterval(() => setToday(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())), 60000)
    return () => clearInterval(timer)
  }, [])

  const dates = useMemo(() => {
    if (!selected?.startDate || !selected?.endDate || !meta?.latestDate) return []
    const end = [selected.endDate, today, meta.latestDate].sort()[0]
    return dateRange(selected.startDate, end)
  }, [selected, today, meta])
  const currentDate = dateReady ? (dates.includes(dateChoice) ? dateChoice : dates.at(-1) || '') : ''
  const dateIndex = dates.indexOf(currentDate)
  const dayQuery = usePerformanceQuery('date', currentDate, active && performanceGlobalLoaded && dateReady)
  const periodQuery = usePerformanceRange(selected?.startDate, selected?.endDate, active && mode === 'results' && !!selected?.startDate && !!selected?.endDate && performanceGlobalLoaded)
  const performanceRows = dayQuery.rows
  const isLoading = !performanceGlobalLoaded || !dateReady || (targetOnly ? periodQuery.loading : dayQuery.loading)
  const storeError = metaError || (targetOnly ? periodQuery.error : dayQuery.error)
  const organizationOptions = useMemo(() => [...new Set([...Object.values(mdNameTeamMap), ...Object.values(performanceRows).map(getOrganization)])].sort((a, b) => a.localeCompare(b, 'ko')), [performanceRows])
  const dailyBroadcasts = useMemo(() => getPromotionBroadcasts(performanceRows, selected, currentDate), [performanceRows, selected, currentDate])
  const organizationBroadcasts = useMemo(() => dailyBroadcasts.filter(([, row]) => !organizations.length || organizations.includes(getOrganization(row))), [dailyBroadcasts, organizations])
  const targetCodes = useMemo(() => new Set(Object.values(selected?.products || {}).map(product => String(product.pgmCodeName || '').trim()).filter(Boolean)), [selected])
  const periodBroadcasts = useMemo(() => Object.entries(periodQuery.rows).filter(([, row]) => {
    const date = normalizePromotionDate(row.broadcastDate)
    return date && date >= selected?.startDate && date <= selected?.endDate
  }).sort(([aId, a], [bId, b]) => `${normalizePromotionDate(a.broadcastDate)} ${a.broadcastTime || ''}`.localeCompare(`${normalizePromotionDate(b.broadcastDate)} ${b.broadcastTime || ''}`) || aId.localeCompare(bId)), [periodQuery.rows, selected])
  const periodOrganizationBroadcasts = useMemo(() => periodBroadcasts.filter(([, row]) => !organizations.length || organizations.includes(getOrganization(row))), [periodBroadcasts, organizations])
  const targetBroadcasts = useMemo(() => periodOrganizationBroadcasts.filter(([, row]) => targetCodes.has(String(row.pgmCodeName || '').trim())), [periodOrganizationBroadcasts, targetCodes])
  const broadcasts = targetOnly ? targetBroadcasts : organizationBroadcasts
  const productCount = Object.values(selected?.products || {}).filter(product => String(product.pgmCodeName || '').trim()).length
  const uncheckedBroadcasts = useMemo(() => getUncheckedPromotionBroadcasts({
    broadcasts: periodBroadcasts, targetCodes, reservations: reservationState.rows,
    promotionId: selectedId, promotions, ids: assignmentIds, names: assignmentNames,
  }), [periodBroadcasts, targetCodes, reservationState.rows, selectedId, promotions, assignmentIds, assignmentNames])
  const noticeReady = assignmentsReady && reservationState.ready && !periodQuery.loading && !periodQuery.error


  return (
    <div className={`promotion-products promotion-performance${mode === 'reservations' ? ' is-reservation-mode' : ''}${mode === 'results' && selected && performanceGlobalLoaded && dates.length ? ' has-broadcast-dates' : ''}`}>
      <h2>프로모션 PGM 선정</h2>
      <div className="promotion-product-selector" style={{ marginTop: 20 }}>
        <label htmlFor="promotion-pgm-selection">프로모션명</label>
        <select id="promotion-pgm-selection" value={selected ? selectedId : ''} onChange={event => { setSelectedId(event.target.value); setTargetOnly(false) }} disabled={!loaded || !promotions.length}>
          <option value="">프로모션을 선택하세요</option>
          {promotions.map(([id, promotion], index) => <option key={id} value={id}>{promotion.name || `프로모션 ${index + 1} (이름 미입력)`}</option>)}
        </select>
        {mode === 'results' && <PromotionOrganizationFilter options={organizationOptions} selected={organizations} onChange={setOrganizations} />}
      </div>
      <div className="promotion-selection-tabs" role="tablist" aria-label="PGM 선정 방식">
        <button type="button" role="tab" aria-selected={mode === 'results'} onClick={() => setMode('results')}>실적 선정</button>
        <button type="button" role="tab" aria-selected={mode === 'reservations'} onClick={() => setMode('reservations')}>예약</button>
      </div>
      {mode === 'reservations' && <PromotionReservationsTab key={selectedId} promotionId={selectedId} promotion={selected} active={active && mode === 'reservations'} />}
      {selected && mode === 'results' && (
        <>
          <div className="promotion-performance-meta">
            <span>프로모션 기간 <strong>{selected.startDate || '미설정'} ~ {selected.endDate || '미설정'}</strong></span>
            <span>등록 상품 <strong>{productCount}개</strong></span>
            {dates.length > 0 && <span>조회 가능 <strong>{dates[0]} ~ {dates[dates.length - 1]}</strong></span>}
          </div>
          {dateError && <p role="alert" className="promotion-products-error">{dateError}</p>}
          {isLoading || storeError ? (
            <div className="promotion-products-empty">{isLoading ? '해당 날짜 실적을 불러오는 중입니다.' : <><p role="alert">{storeError}</p><button type="button" onClick={dayQuery.retry}>다시 불러오기</button></>}</div>
          ) : dates.length === 0 ? (
            <div className="promotion-products-empty">{!selected.startDate || !selected.endDate ? '프로모션 설정에서 기간을 입력해주세요.' : '프로모션 기간 안에 조회 가능한 실적 날짜가 없습니다.'}</div>
          ) : (
            <>
              <div className="promotion-date-navigation" aria-label="실적 날짜 이동">
                <button type="button" style={{ width: 'auto', minWidth: 48, padding: '0 8px', whiteSpace: 'nowrap' }} disabled={dateIndex <= 0} onClick={() => setDateChoice(dates[0])}>시작일</button>
                <button type="button" aria-label="이전 실적 날짜" disabled={dateIndex <= 0} onClick={() => setDateChoice(dates[dateIndex - 1])}>◀</button>
                <label className="promotion-performance-date">
                  <span className="promotion-sr-only">실적 날짜</span>
                  <select value={currentDate} onChange={event => setDateChoice(event.target.value)}>
                    {dates.map(date => <option key={date} value={date}>{date.replaceAll('-', '.')}</option>)}
                  </select>
                </label>
                <button type="button" aria-label="다음 실적 날짜" disabled={dateIndex >= dates.length - 1} onClick={() => setDateChoice(dates[dateIndex + 1])}>▶</button>
                <button type="button" style={{ width: 'auto', minWidth: 48, padding: '0 8px', whiteSpace: 'nowrap' }} disabled={dateIndex >= dates.length - 1} onClick={() => setDateChoice(dates.at(-1))}>최신일</button>
              </div>
              <div className="promotion-performance-toolbar">
                <div className="promotion-broadcast-counts">
                  <span className="promotion-broadcast-total">방송 상품 <strong>{broadcasts.length}건</strong><small>{targetOnly ? '프로모션 전체 기간' : currentDate}{organizations.length > 0 && ` · ${organizations.join(', ')}`}</small></span>
                <span className="promotion-unchecked-notice" role="status">
                  {reservationState.error || assignmentError || periodQuery.error || (!noticeReady ? '미체크 방송 확인 중…' : <>대상 상품·예약방송 미체크 <strong>{uncheckedBroadcasts.length}건</strong><small>전체 기간 · 전체 조직</small></>)}
                  {noticeReady && !assignmentError && <PromotionFormulaTooltip label="미체크 방송" suffix=" 상세" maxWidth={480} text={[
                    `${selected.startDate} ~ ${selected.endDate} · 전체 조직 · 선택한 프로모션 기준`,
                    '대상 상품 또는 예약방송인 실적 중 미체크 방송 (중복 제외)',
                    ...uncheckedBroadcasts.map(({ row, reason }) => `${normalizePromotionDate(row.broadcastDate)} ${row.broadcastTime || '시간 미상'} · ${row.pgmCodeName}\n${reason}`),
                    ...(!uncheckedBroadcasts.length ? ['미체크 방송이 없습니다.'] : []),
                  ].join('\n\n')} />}
                </span>
                </div>
                <label className="promotion-period-target-filter"><input type="checkbox" checked={targetOnly} onChange={event => setTargetOnly(event.target.checked)} />대상 상품만 보기 <small>전체 기간</small></label>
                <span className="promotion-selection-help">프로모션명 클릭으로 적용 · 다시 클릭하면 해제</span>
              </div>
              <div className="promotion-products-table-wrap promotion-performance-table-wrap">
                <table className="promotion-table promotion-products-table promotion-performance-table">
                  <colgroup>{[60, 240, 155, 140, 65, 75, 110, 120, 110, 110, 150].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
                  <thead><tr><th>{targetOnly ? '방송일시' : '시간'}</th><th>편성코드명</th><th>선택한 프로모션</th><th>다른 적용 프로모션</th><th>거래형태</th><th>MD</th><th>가중분당 취급고</th><th>가중분당 한계이익</th><th>예상취급고</th><th>한계이익</th><th>(연동)미리주문취급액</th></tr></thead>
                  <tbody>
                    {broadcasts.map(([id, row]) => <PromotionBroadcastRow key={id} entryId={id} row={row} showDate={targetOnly} promotions={promotions} sourcePath="performanceEntries" promotionStart={selected.startDate} isTarget={targetCodes.has(String(row.pgmCodeName || '').trim())} selectedPromotionId={selectedId} />)}
                    {!broadcasts.length && <tr><td colSpan={11} className="promotion-products-empty">{targetOnly ? '프로모션 전체 기간에 선택한 조직의 대상 상품 방송 실적이 없습니다.' : organizations.length ? '선택한 조직의 방송 실적이 없습니다. 조직명 필터에서 전체 보기를 선택해주세요.' : '이 날짜에 방송 실적이 없습니다.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
