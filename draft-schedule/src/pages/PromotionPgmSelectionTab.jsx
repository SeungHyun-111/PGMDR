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

const getOrganization = row => String(row.mdTeam || row.orgName || mdNameTeamMap[String(row.mdName || '').trim()] || '미분류').trim()

export default function PromotionPgmSelectionTab({ promotions, loaded, active }) {
  const [selectedId, setSelectedId] = useState('')
  const userName = useScheduleStore(state => state.userName)
  const { date: dateChoice, selectDate: setDateChoice, ready: dateReady, error: dateError } = usePromotionLastViewedDate(userName, selectedId, active)
  const [organizations, setOrganizations] = useState([])
  const [targetOnly, setTargetOnly] = useState(false)
  const [today, setToday] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()))
  const assignmentError = usePromotionAssignmentStore(state => state.error)
  const meta = usePerformanceQueryStore(state => state.meta)
  const performanceGlobalLoaded = usePerformanceQueryStore(state => state.metaReady)
  const metaError = usePerformanceQueryStore(state => state.error)
  const selected = promotions.find(([id]) => id === selectedId)?.[1]
  const hasSelection = !!selectedId

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
  const performanceRows = dayQuery.rows
  const isLoading = !performanceGlobalLoaded || !dateReady || dayQuery.loading
  const storeError = metaError || dayQuery.error
  const organizationOptions = useMemo(() => [...new Set([...Object.values(mdNameTeamMap), ...Object.values(performanceRows).map(getOrganization)])].sort((a, b) => a.localeCompare(b, 'ko')), [performanceRows])
  const dailyBroadcasts = useMemo(() => getPromotionBroadcasts(performanceRows, selected, currentDate), [performanceRows, selected, currentDate])
  const organizationBroadcasts = useMemo(() => dailyBroadcasts.filter(([, row]) => !organizations.length || organizations.includes(getOrganization(row))), [dailyBroadcasts, organizations])
  const targetCodes = useMemo(() => new Set(Object.values(selected?.products || {}).map(product => String(product.pgmCodeName || '').trim()).filter(Boolean)), [selected])
  const targetBroadcasts = useMemo(() => organizationBroadcasts.filter(([, row]) => targetCodes.has(String(row.pgmCodeName || '').trim())), [organizationBroadcasts, targetCodes])
  const broadcasts = targetOnly ? targetBroadcasts : organizationBroadcasts
  const productCount = Object.values(selected?.products || {}).filter(product => String(product.pgmCodeName || '').trim()).length
  const promotionNames = useMemo(() => [...new Set([...promotions]
    .sort(([a], [b]) => Number(b === selectedId) - Number(a === selectedId))
    .map(([, promotion]) => String(promotion.name || '').trim()).filter(Boolean))], [promotions, selectedId])

  return (
    <div className={`promotion-products promotion-performance${selected && performanceGlobalLoaded && dates.length ? ' has-broadcast-dates' : ''}`}>
      <h2>프로모션 PGM 선정</h2>
      <div className="promotion-product-selector" style={{ marginTop: 20 }}>
        <label htmlFor="promotion-pgm-selection">프로모션명</label>
        <select id="promotion-pgm-selection" value={selected ? selectedId : ''} onChange={event => { setSelectedId(event.target.value); setTargetOnly(false) }} disabled={!loaded || !promotions.length}>
          <option value="">프로모션을 선택하세요</option>
          {promotions.map(([id, promotion], index) => <option key={id} value={id}>{promotion.name || `프로모션 ${index + 1} (이름 미입력)`}</option>)}
        </select>
        <PromotionOrganizationFilter options={organizationOptions} selected={organizations} onChange={setOrganizations} />
      </div>
      {selected && (
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
              <div className="promotion-performance-toolbar"><span>방송 상품 <strong>{broadcasts.length}건</strong>{organizations.length > 0 && ` / 전체 ${dailyBroadcasts.length}건 · ${organizations.join(', ')}`}</span>{assignmentError ? <span role="alert" className="promotion-products-error">{assignmentError}</span> : <span>프로모션명을 선택하면 해당 방송 실적에 즉시 저장됩니다.</span>}</div>
              <div className="promotion-target-toolbar">
                <span role="status">현재 날짜·조직 기준 등록 상품과 일치하는 PGM <strong>{targetBroadcasts.length}건</strong></span>
                <label><input type="checkbox" checked={targetOnly} onChange={event => setTargetOnly(event.target.checked)} />대상 상품만 보기</label>
              </div>
              <div className="promotion-products-table-wrap promotion-performance-table-wrap">
                <table className="promotion-table promotion-products-table promotion-performance-table">
                  <colgroup><col style={{ width: '5%' }} /><col style={{ width: '18%' }} /><col style={{ width: '14%' }} /><col style={{ width: '6%' }} /><col style={{ width: '6%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '11%' }} /></colgroup>
                  <thead><tr><th>시간</th><th>편성코드명</th><th>프로모션명</th><th>거래형태</th><th>MD</th><th>가중분당 취급고</th><th>가중분당 한계이익</th><th>예상취급고</th><th>한계이익</th><th>(연동)미리주문취급액</th></tr></thead>
                  <tbody>
                    {broadcasts.map(([id, row]) => <PromotionBroadcastRow key={id} entryId={id} row={row} names={promotionNames} sourcePath="performanceEntries" promotionStart={selected.startDate} isTarget={targetCodes.has(String(row.pgmCodeName || '').trim())} selectedPromotionName={String(selected.name || '').trim()} />)}
                    {!broadcasts.length && <tr><td colSpan={10} className="promotion-products-empty">{targetOnly ? '현재 날짜·조직에 등록 상품과 일치하는 PGM이 없습니다.' : organizations.length ? '선택한 조직의 방송 실적이 없습니다. 조직명 필터에서 전체 보기를 선택해주세요.' : '이 날짜에 방송 실적이 없습니다.'}</td></tr>}
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
