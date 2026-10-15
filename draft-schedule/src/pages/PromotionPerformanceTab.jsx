import { useEffect, useMemo, useRef, useState } from 'react'
import usePerformanceRange from '../hooks/usePerformanceRange'
import usePromotionPrevious, { getPerformanceKey } from '../hooks/usePromotionPrevious'
import usePerformanceQueryStore, { watchPerformanceMeta } from '../store/usePerformanceQueryStore'
import usePromotionAssignmentStore, { subscribePromotionAssignments } from '../store/usePromotionAssignmentStore'
import { getPromotionResultRows } from '../utils/promotionResults'
import { sortPromotionResults } from '../utils/promotionResultsSort'
import { filterPerformanceRows, getPerformanceCategory, getPerformanceVideoType, summarizePerformance, summarizePreviousSlots, summarizeVideoTypes, formatPreorderShare } from '../utils/promotionStatistics'
import PromotionOrganizationFilter from '../components/common/PromotionOrganizationFilter'
import PromotionPerformanceSummary from '../components/common/PromotionPerformanceSummary'
import PromotionVideoSummary from '../components/common/PromotionVideoSummary'
import PromotionPreviousTooltip from '../components/common/PromotionPreviousTooltip'
import mdNameTeamMap from '../data/md-name-team-map.json'

const CURRENT_COLUMNS = ['방송일시', '채널', '가중분', '거래형태', '편성코드명', '영상구분', '목표취급액', '목표한계이익액', '예상취급고', '예상한계이익액', '(연동)미리주문취급액', '(연동)방송중취급액', '가중분당취급액', '가중분당한계이익액', '(연동)미리주문 비중', '조직명', 'MD명']
const AVERAGE_COLUMNS = ['가중분당취급액', '가중분당한계이익액', '(연동)미리주문 비중']
const BASELINE_COLUMNS = ['방송일시', '목표취급액', '목표한계이익액', '예상취급고', '예상한계이익액', '(연동)미리주문취급액', '(연동)방송중취급액', '가중분']
const BASELINE_FIELDS = ['broadcastDateTime', 'targetSales', 'targetContributionProfit', 'expectedSales', 'contributionProfit', 'preorderExpectedSales', 'linkedExpectedSales', 'weightedMin']
const BASELINE_GROUPS = [1, 2, 3]
const CURRENT_WIDTHS = [150, 70, 70, 80, 240, 90, 120, 130, 120, 130, 155, 145, 120, 140, 140, 100, 80]
const BASELINE_WIDTHS = [150, 120, 130, 120, 130, 155, 145, 70]
const BASELINE_START = CURRENT_COLUMNS.length + AVERAGE_COLUMNS.length
const TOTAL_COLUMNS = BASELINE_START + BASELINE_GROUPS.length * BASELINE_COLUMNS.length
const number = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)).toLocaleString('ko-KR') : '0'
const koreaToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const getOrganization = row => String(row.mdTeam || row.orgName || mdNameTeamMap[row.mdName] || '미분류').trim()

export default function PromotionPerformanceTab({ promotions, loaded, active }) {
  const exportRoot = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [sort, setSort] = useState({ column: 0, direction: 'asc' })
  const [selectedVideoType, setSelectedVideoType] = useState('')
  const [excludeLateNight, setExcludeLateNight] = useState(true)
  const [excludeIntangible, setExcludeIntangible] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [categories, setCategories] = useState([])
  const [today, setToday] = useState(koreaToday)
  const selected = promotions.find(([id]) => id === selectedId)?.[1]
  const meta = usePerformanceQueryStore(state => state.meta)
  const metaReady = usePerformanceQueryStore(state => state.metaReady)
  const metaError = usePerformanceQueryStore(state => state.error)
  const names = usePromotionAssignmentStore(state => state.names)
  const namesReady = usePromotionAssignmentStore(state => state.ready)
  const namesError = usePromotionAssignmentStore(state => state.error)
  const hasSelection = !!selected
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setToday(koreaToday()), 60000)
    return () => clearInterval(timer)
  }, [active])
  useEffect(() => { if (active) return watchPerformanceMeta() }, [active])
  useEffect(() => { if (active && hasSelection) return subscribePromotionAssignments() }, [active, hasSelection])
  const end = selected?.endDate && meta?.latestDate ? [selected.endDate, meta.latestDate, today].sort()[0] : ''
  const range = usePerformanceRange(selected?.startDate || '', end, active && hasSelection && metaReady && !!end)
  const promotionRows = useMemo(() => getPromotionResultRows(range.rows, names, selected, end), [range.rows, names, selected, end])
  const organizationOptions = useMemo(() => [...new Set(promotionRows.map(([, row]) => getOrganization(row)))].sort((a, b) => a.localeCompare(b, 'ko')), [promotionRows])
  const categoryOptions = useMemo(() => [...new Set(promotionRows.map(([, row]) => getPerformanceCategory(row)))].sort((a, b) => a.localeCompare(b, 'ko')), [promotionRows])
  const filteredPeriod = useMemo(() => filterPerformanceRows(Object.entries(range.rows), { excludeLateNight, excludeIntangible, organizations, categories }, getOrganization), [range.rows, excludeLateNight, excludeIntangible, organizations, categories])
  const promotionIds = useMemo(() => new Set(promotionRows.map(([id]) => id)), [promotionRows])
  const rows = useMemo(() => filteredPeriod.filter(([id]) => promotionIds.has(id)), [filteredPeriod, promotionIds])
  const error = metaError || namesError || range.error
  const loading = hasSelection && (!metaReady || !namesReady || range.loading)
  const previous = usePromotionPrevious(rows, selected?.startDate || '', active && hasSelection && !loading && !error)
  const detailRows = useMemo(() => rows.filter(([, row]) => !selectedVideoType || getPerformanceVideoType(row) === selectedVideoType), [rows, selectedVideoType])
  const sortedRows = useMemo(() => sortPromotionResults(detailRows, sort, previous.byKey, getPerformanceKey, getOrganization), [detailRows, sort, previous.byKey])
  const detailTotals = useMemo(() => ({ total: summarizePerformance(detailRows.map(([, row]) => row)), previous: summarizePreviousSlots(detailRows.map(([, row]) => row), previous.byKey, getPerformanceKey) }), [detailRows, previous.byKey])
  const changeSort = column => setSort(current => ({ column, direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc' }))
  const statistics = useMemo(() => ({
    promotion: summarizePerformance(rows.map(([, row]) => row)),
    outside: summarizePerformance(filteredPeriod.filter(([id]) => !promotionIds.has(id)).map(([, row]) => row)),
    total: summarizePerformance(filteredPeriod.map(([, row]) => row)),
    previous: summarizePreviousSlots(rows.map(([, row]) => row), previous.byKey, getPerformanceKey),
    videoTypes: summarizeVideoTypes(rows.map(([, row]) => row), previous.byKey, getPerformanceKey),
  }), [rows, filteredPeriod, promotionIds, previous.byKey])

  const downloadExcel = async () => {
    setExporting(true)
    setExportError('')
    try {
      const root = exportRoot.current.cloneNode(true)
      const { downloadPromotionPerformance } = await import('../utils/export/promotionPerformanceExport')
      downloadPromotionPerformance({ root, promotion: selected, filters: [excludeLateNight ? '심야 제외' : '심야 포함', excludeIntangible ? '무형 제외' : '무형 포함', `조직: ${organizations.join(', ') || '전체'}`, `카테고리: ${categories.join(', ') || '전체'}`, `상세 영상구분: ${selectedVideoType || '전체'}`, `실적 조회일: ${selected.startDate} ~ ${end}`, '상세 표: 화면 정렬 순서'].join(' · ') })
    } catch {
      setExportError('엑셀 다운로드에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="promotion-results" ref={exportRoot}>
      <div className="promotion-product-selector">
        <label htmlFor="promotion-performance-selection">프로모션명</label>
        <select id="promotion-performance-selection" value={selected ? selectedId : ''} onChange={event => { setSelectedId(event.target.value); setOrganizations([]); setCategories([]); setSelectedVideoType(''); setSort({ column: 0, direction: 'asc' }) }} disabled={!loaded || !promotions.length}>
          <option value="">프로모션을 선택하세요</option>
          {promotions.map(([id, promotion], index) => <option key={id} value={id}>{promotion.name || `프로모션 ${index + 1} (이름 미입력)`}</option>)}
        </select>
        {selected && <span className="promotion-results-period">{selected.startDate || '시작일 미설정'} ~ {selected.endDate || '종료일 미설정'}</span>}
        <div className="promotion-results-filters">
          <PromotionOrganizationFilter options={organizationOptions} selected={organizations} onChange={setOrganizations} />
          <PromotionOrganizationFilter label="카테고리" options={categoryOptions} selected={categories} onChange={setCategories} />
          <label className="promotion-results-night-filter"><input type="checkbox" checked={excludeLateNight} onChange={event => setExcludeLateNight(event.target.checked)} />심야 제외</label>
          <label className="promotion-results-night-filter" title="문화서비스팀 방송 제외"><input type="checkbox" checked={excludeIntangible} onChange={event => setExcludeIntangible(event.target.checked)} />무형 제외</label>
          <button type="button" className="promotion-excel-download" onClick={downloadExcel} disabled={!selected || loading || !!error || previous.loading || previous.errors.length > 0 || !detailRows.length || exporting}>{exporting ? '엑셀 생성 중…' : '엑셀 내려받기'}</button>
        </div>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      {selected && <PromotionPerformanceSummary promotion={statistics.promotion} outside={statistics.outside} total={statistics.total} previous={statistics.previous.average} loading={loading || !!error} previousLoading={previous.loading} previousError={previous.errors.length > 0} onRetry={previous.retry} />}
      {selected && <PromotionVideoSummary groups={statistics.videoTypes} loading={loading || !!error} previousLoading={previous.loading} selectedType={selectedVideoType} onSelectType={type => setSelectedVideoType(current => current === type ? '' : type)} />}
      <div className="promotion-results-description"><span>프로모션 적용 방송 <strong>{detailRows.length}건</strong>{selectedVideoType && <> / 전체 {rows.length}건 <button type="button" className="promotion-video-filter-chip" onClick={() => setSelectedVideoType('')} aria-label="영상구분 필터 해제">{selectedVideoType} ×</button></>}</span><span>P-1·P-2·P-3: 프로모션 시작 전 3개월 내 직전 3회(최근순) · 동일 거래형태 + 편성코드명 · 심야 제외 · 부족한 회차는 0</span></div>
      <div className="promotion-results-scroll">
        <table id="promotion-results-detail-table" className="promotion-results-table">
          <colgroup>{[...CURRENT_WIDTHS, 140, 160, 120, ...BASELINE_GROUPS.flatMap(() => BASELINE_WIDTHS)].map((width, i) => <col key={i} style={{ width }} />)}</colgroup>
          <thead>
            <tr><th colSpan={CURRENT_COLUMNS.length} scope="colgroup">프로모션 실적</th><th colSpan={3} scope="colgroup" className="promotion-average-group">직전 3회 평균</th>{BASELINE_GROUPS.map(n => <th key={n} colSpan={8} scope="colgroup" className="promotion-baseline-group">P-{n}</th>)}</tr>
            <tr>{[...CURRENT_COLUMNS, ...AVERAGE_COLUMNS, ...BASELINE_GROUPS.flatMap(() => BASELINE_COLUMNS)].map((title, index) => {
              const label = `${index >= BASELINE_START ? `P-${Math.floor((index - BASELINE_START) / 8) + 1} ` : index >= CURRENT_COLUMNS.length ? '직전 3회 평균 ' : ''}${title}`
              const selected = sort.column === index
              const nextDirection = selected && sort.direction === 'asc' ? '내림차순' : '오름차순'
              return <th key={index} scope="col" aria-sort={selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined} className={index === CURRENT_COLUMNS.length ? 'promotion-average-start' : index >= BASELINE_START && (index - BASELINE_START) % 8 === 0 ? 'promotion-baseline-start' : ''}><button type="button" className="promotion-sort-header" aria-label={`${label} ${nextDirection} 정렬`} title={`${label}: 클릭하면 ${nextDirection}`} onClick={() => changeSort(index)}><span>{title}</span><span className={selected ? 'is-active' : ''} aria-hidden="true">{selected ? sort.direction === 'asc' ? '▲' : '▼' : '↕'}</span></button></th>
            })}</tr>
          </thead>
          <tbody>
            {active && selected && !loading && !error && <TotalsRow total={detailTotals.total} previous={detailTotals.previous.slots} average={detailTotals.previous.average} loading={previous.loading} failed={previous.errors.length > 0} />}
            {active && !loading && !error && sortedRows.map(([id, row]) => <PerformanceRow key={id} row={row} previous={previous.byKey[getPerformanceKey(row)]} previousLoading={previous.loading} previousFailed={!previous.loading && previous.byKey[getPerformanceKey(row)] === undefined} onRetry={previous.retry} />)}
            {(!selected || loading || error || !detailRows.length) && <tr><td colSpan={TOTAL_COLUMNS} className="promotion-results-empty" role={error ? 'alert' : undefined}>{!selected ? '프로모션을 선택하세요.' : error || (loading ? '프로모션 실적을 불러오는 중입니다.' : !selected.startDate || !selected.endDate ? '프로모션 기간을 설정해주세요.' : selectedVideoType ? `${selectedVideoType}에 해당하는 방송이 없습니다. 영상구분 필터를 해제해주세요.` : '프로모션 PGM 선정 탭에서 해당 프로모션을 지정한 방송이 없습니다.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PerformanceRow({ row, previous, previousLoading, previousFailed, onRetry }) {
  const metrics = [row.targetSales, row.targetContributionProfit, row.expectedSales, row.contributionProfit, row.preorderExpectedSales, row.linkedExpectedSales, row.salesPerWeightedMin, row.contributionProfitPerWeightedMin ?? row.profitPerWeightedMin]
  return (
    <tr>
      <td>{row.broadcastDate} {row.broadcastTime}</td><td>{row.multiChannel || '—'}</td><td className="is-number">{number(row.weightedMin)}</td><td>{row.dealTypeConverted || row.dealType2 || row.dealType || '—'}</td><td className="promotion-results-code"><span className="promotion-results-code-content"><span title={row.pgmCodeName}>{row.pgmCodeName}</span><PromotionPreviousTooltip row={row} previous={previous} loading={previousLoading} failed={previousFailed} /></span></td><td>{getPerformanceVideoType(row)}</td>
      {metrics.map((value, i) => <td key={i} className="is-number">{number(value)}</td>)}
      <td className="is-number">{formatPreorderShare(summarizePerformance([row]).preorderShare || 0)}</td><td>{row.mdTeam || row.orgName || mdNameTeamMap[row.mdName] || '미분류'}</td><td>{row.mdName || '—'}</td>
      <AverageCells average={summarizePerformance(previous || [])} loading={previousLoading} failed={previousFailed} />
      <BaselineCells previous={previous} loading={previousLoading} failed={previousFailed} onRetry={onRetry} />
    </tr>
  )
}

function BaselineCells({ previous = [], loading, failed, onRetry }) {
  if (loading || failed) return <td colSpan={24} className="promotion-baseline-start promotion-baseline-message" role={failed ? 'alert' : undefined}>{loading ? 'P-1·P-2·P-3 조회 중…' : <>직전 실적을 불러오지 못했습니다. <button type="button" onClick={onRetry}>재시도</button></>}</td>
  return BASELINE_GROUPS.flatMap((n, index) => {
    const baseline = previous[index]
    return BASELINE_FIELDS.map((field, i) => <td key={`${n}-${field}`} className={i === 0 ? 'promotion-baseline-start' : 'is-number'} title={baseline ? `P-${n}: ${baseline.broadcastDate} ${baseline.broadcastTime}` : `P-${n}: 조건에 맞는 직전 실적 없음`}>{field === 'broadcastDateTime' ? (baseline ? `${baseline.broadcastDate} ${baseline.broadcastTime}` : '0') : number(baseline?.[field] ?? 0)}</td>)
  })
}

function AverageCells({ average, loading, failed }) {
  return [average.salesPerMin, average.profitPerMin, average.preorderShare].map((value, index) => <td key={index} className={`is-number promotion-average-cell${index === 0 ? ' promotion-average-start' : ''}`}>{loading ? '…' : failed ? '—' : index === 2 ? formatPreorderShare(value || 0) : number(value)}</td>)
}

function TotalsRow({ total, previous, average, loading, failed }) {
  const metrics = [total.targetSales, total.targetContributionProfit, total.expectedSales, total.contributionProfit, total.preorderExpectedSales, total.linkedExpectedSales, total.salesPerMin, total.profitPerMin]
  return <tr className="promotion-results-totals">
    <td>계</td><td>—</td><td className="is-number">{number(total.weightedMin)}</td><td>—</td><td>{total.count}건</td><td>—</td>
    {metrics.map((value, index) => <td key={index} className="is-number">{number(value)}</td>)}<td className="is-number">{formatPreorderShare(total.preorderShare || 0)}</td><td>—</td><td>—</td>
    <AverageCells average={average} loading={loading} failed={failed} />
    {previous.flatMap((slot, index) => BASELINE_FIELDS.map((field, i) => <td key={`${index}-${field}`} className={i === 0 ? 'promotion-baseline-start' : 'is-number'}>{i === 0 ? '계' : loading ? '…' : failed ? '—' : number(slot[field])}</td>))}
  </tr>
}
