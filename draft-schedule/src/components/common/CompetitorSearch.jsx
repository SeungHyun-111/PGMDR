import { useEffect, useMemo, useRef, useState } from 'react'
import { compareCompetitorBroadcastDesc, fetchCompetitorSearchMonths, getBroadcastSortValue, matchesCompetitorSearch, searchCompetitorInfo } from '../../api/competitorSearch'
import CoachMark from './CoachMark'
import useCompetitorVisibilityStore from '../../store/useCompetitorVisibilityStore'

const COMPANY_ORDER = ['K', 'SSG', 'SK']
const COMPANY_META = {
  K: { label: 'K', color: '#2563eb' },
  SSG: { label: 'SSG', color: '#f97316' },
  SK: { label: 'SK스토아', color: '#e11d48' },
}

const SEARCH_COACH_STEPS = [
  { target: '[data-coach="competitor-dialog"]', title: '경쟁사 실적 검색창', description: 'MSM에서 미리 만든 RTDB 검색 인덱스를 이용해 필요한 경쟁사 실적만 조회합니다. 검색창 상단을 드래그하면 위치를 옮길 수 있고 네 모서리를 드래그하면 크기를 조절할 수 있습니다.' },
  { target: '[data-coach="competitor-month"]', title: '검색 월 선택', description: '특정 월만 조회하거나 전체를 선택해 저장된 모든 월을 한 번에 검색합니다. 월을 변경하면 이전 검색 조건과 결과는 초기화됩니다.' },
  { target: '[data-coach="competitor-brand"]', title: '브랜드 포함 검색', description: '브랜드명에 입력한 글자가 포함된 실적을 찾습니다. 한 글자 검색도 가능하며 검색 버튼 또는 Enter를 눌렀을 때만 RTDB를 조회합니다.' },
  { target: '[data-coach="competitor-product"]', title: '상품 포함 검색', description: '데이터 상품명과 실제 방송 상품명에서 입력한 글자가 포함된 실적을 찾습니다. 이미 결과가 있으면 새 조건은 내려받은 결과 안에서 추가로 검색됩니다.' },
  { target: '[data-coach="competitor-criteria"]', title: '누적 검색 조건', description: '적용한 브랜드·상품 조건이 배지로 쌓입니다. 여러 조건은 모두 만족하는 결과만 남기며, 배지의 ×를 누르면 그 조건을 삭제하고 남은 조건으로 다시 계산합니다.' },
  { target: '[data-coach="competitor-results"]', title: '채널별 실적 결과', description: '검색 결과를 K, SSG, SK스토아로 묶어 보여줍니다. 채널별 방송 횟수, 가중분, 총매출, 분당 매출과 방송일시·브랜드·상품 상세를 함께 확인할 수 있습니다.' },
  { target: '[data-coach="competitor-resize"]', title: '창 크기와 위치 조절', description: '네 모서리 중 편한 곳을 잡아 창 크기를 바꿀 수 있습니다. 상단 제목 영역을 잡으면 창 전체가 이동하며, 화면 바깥으로 빠져나가지 않도록 제한됩니다.' },
]

const integerFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const BUTTON_SIZE = 58
const BUTTON_MARGIN = 22
const BUTTON_POSITION_KEY = 'competitor-search-button-position'
const DIALOG_MIN_WIDTH = 720
const DIALOG_MIN_HEIGHT = 480

function getInitialButtonPosition() {
  try {
    const stored = JSON.parse(localStorage.getItem(BUTTON_POSITION_KEY) || 'null')
    if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) return stored
  } catch {
    localStorage.removeItem(BUTTON_POSITION_KEY)
  }

  return {
    x: window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN,
    y: window.innerHeight - BUTTON_SIZE - BUTTON_MARGIN,
  }
}

function clampButtonPosition(position) {
  return {
    x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - BUTTON_SIZE - 8)),
    y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - BUTTON_SIZE - 8)),
  }
}

function getInitialDialogRect() {
  const width = Math.min(1500, window.innerWidth * 0.96)
  const height = Math.min(860, window.innerHeight * 0.92)
  return {
    x: (window.innerWidth - width) / 2,
    y: (window.innerHeight - height) / 2,
    width,
    height,
  }
}

function formatWon(value) {
  return `${integerFormatter.format(Number(value || 0))}원`
}

function formatMonth(month) {
  const text = String(month || '')
  return text.length === 6 ? `${text.slice(0, 4)}년 ${Number(text.slice(4))}월` : text
}

function getWeightedMinutes(row) {
  return Number(row?.weightedMin ?? row?.brandWeightedMin ?? row?.simpleMin ?? 0) || 0
}

function getPerMinuteRevenue(row) {
  const minutes = getWeightedMinutes(row)
  return minutes > 0 ? Number(row?.revenue || 0) / minutes : 0
}

const SORT_COLUMNS = [
  { key: 'broadcast', label: '방송일시', align: 'left', value: getBroadcastSortValue },
  { key: 'channel', label: '채널', align: 'left', value: (row) => String(row?.channel || '') },
  { key: 'brand', label: '브랜드', align: 'left', value: (row) => String(row?.brand || '') },
  { key: 'product', label: '상품명', align: 'left', value: (row) => String(row?.productName || row?.dataProductName || '') },
  { key: 'minutes', label: '가중분', align: 'right', value: getWeightedMinutes },
  { key: 'revenue', label: '매출액', align: 'right', value: (row) => Number(row?.revenue || 0) },
  { key: 'perMinute', label: '분당 매출액', align: 'right', value: getPerMinuteRevenue },
]

export default function CompetitorSearch() {
  const hidden = useCompetitorVisibilityStore(state => state.hidden)
  const setHidden = useCompetitorVisibilityStore(state => state.setHidden)
  const [contextMenu, setContextMenu] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [months, setMonths] = useState([])
  const [month, setMonth] = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [criteria, setCriteria] = useState([])
  const [baseResults, setBaseResults] = useState([])
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [buttonPosition, setButtonPosition] = useState(getInitialButtonPosition)
  const [dialogRect, setDialogRect] = useState(getInitialDialogRect)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachStep, setCoachStep] = useState(0)
  const dragRef = useRef(null)
  const dialogResizeRef = useRef(null)
  const dialogMoveRef = useRef(null)

  useEffect(() => {
    if (!isOpen || months.length) return
    let cancelled = false
    fetchCompetitorSearchMonths()
      .then((nextMonths) => {
        if (cancelled) return
        setMonths(nextMonths)
        setMonth((current) => current || (nextMonths.length ? 'all' : ''))
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
    return () => { cancelled = true }
  }, [isOpen, months.length])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  useEffect(() => {
    const onResize = () => {
      setButtonPosition((current) => clampButtonPosition(current))
      setDialogRect((current) => {
        const width = Math.min(current.width, window.innerWidth - 16)
        const height = Math.min(current.height, window.innerHeight - 16)
        return {
          x: Math.min(Math.max(8, current.x), window.innerWidth - width - 8),
          y: Math.min(Math.max(8, current.y), window.innerHeight - height - 8),
          width,
          height,
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const groupedResults = useMemo(() => COMPANY_ORDER.map((company) => ({
    company,
    rows: results.filter((row) => row.companyKey === company),
  })).filter((group) => group.rows.length), [results])

  const fetchInitialResults = async (criterion) => {
    const targetMonths = month === 'all' ? months : [month]
    const monthlyResults = await Promise.all(targetMonths.map((targetMonth) => searchCompetitorInfo({
      month: targetMonth,
      type: criterion.type,
      searchText: criterion.text,
    })))
    return monthlyResults.flat().sort(compareCompetitorBroadcastDesc)
  }

  const filterByCriteria = (rows, nextCriteria) => rows
    .filter((row) => (
      nextCriteria.every((criterion) => matchesCompetitorSearch(row, criterion.type, criterion.text))
    ))
    .sort(compareCompetitorBroadcastDesc)

  const applyCriteria = async (nextCriteria) => {
    if (!nextCriteria.length) {
      setCriteria([])
      setBaseResults([])
      setResults([])
      setError('')
      return
    }

    setIsLoading(true)
    setError('')
    setResults([])
    try {
      const nextBaseResults = await fetchInitialResults(nextCriteria[0])
      setBaseResults(nextBaseResults)
      setCriteria(nextCriteria)
      setResults(filterByCriteria(nextBaseResults, nextCriteria))
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const runSearch = async (type) => {
    if (isLoading) return
    const searchText = type === 'brand' ? brandSearch : productSearch
    if (!searchText.trim()) {
      setError(type === 'brand' ? '브랜드 검색어를 입력해 주세요.' : '상품 검색어를 입력해 주세요.')
      return
    }

    const criterion = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type, text: searchText.trim() }
    const nextCriteria = [...criteria, criterion]
    if (!criteria.length) {
      await applyCriteria(nextCriteria)
    } else {
      setCriteria(nextCriteria)
      setResults(filterByCriteria(baseResults, nextCriteria))
    }
    if (type === 'brand') setBrandSearch('')
    else setProductSearch('')
  }

  const removeCriterion = (criterionId) => {
    const nextCriteria = criteria.filter((criterion) => criterion.id !== criterionId)
    applyCriteria(nextCriteria)
  }

  const handleMonthChange = (nextMonth) => {
    setMonth(nextMonth)
    setCriteria([])
    setBaseResults([])
    setResults([])
    setError('')
  }

  const handleButtonPointerDown = (event) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: buttonPosition.x,
      originY: buttonPosition.y,
      moved: false,
    }
  }

  const handleButtonPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true
    if (!drag.moved) return
    setButtonPosition(clampButtonPosition({ x: drag.originX + deltaX, y: drag.originY + deltaY }))
  }

  const handleButtonPointerUp = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const finalPosition = clampButtonPosition({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.moved) {
      setButtonPosition(finalPosition)
      localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify(finalPosition))
      return
    }
    setIsOpen(true)
  }

  const handleDialogResizeStart = (event, corner) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dialogResizeRef.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      rect: dialogRect,
    }
  }

  const handleDialogResizeMove = (event) => {
    const resize = dialogResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const deltaX = event.clientX - resize.startX
    const deltaY = event.clientY - resize.startY
    const minimumWidth = Math.min(DIALOG_MIN_WIDTH, window.innerWidth - 16)
    const minimumHeight = Math.min(DIALOG_MIN_HEIGHT, window.innerHeight - 16)
    let { x, y, width, height } = resize.rect

    if (resize.corner.includes('e')) {
      width = Math.min(Math.max(minimumWidth, width + deltaX), window.innerWidth - x - 8)
    }
    if (resize.corner.includes('s')) {
      height = Math.min(Math.max(minimumHeight, height + deltaY), window.innerHeight - y - 8)
    }
    if (resize.corner.includes('w')) {
      const nextX = Math.min(Math.max(8, x + deltaX), x + width - minimumWidth)
      width += x - nextX
      x = nextX
    }
    if (resize.corner.includes('n')) {
      const nextY = Math.min(Math.max(8, y + deltaY), y + height - minimumHeight)
      height += y - nextY
      y = nextY
    }

    setDialogRect({ x, y, width, height })
  }

  const handleDialogResizeEnd = (event) => {
    if (dialogResizeRef.current?.pointerId !== event.pointerId) return
    dialogResizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleDialogMoveStart = (event) => {
    if (event.button !== 0 || event.target.closest('button, select, input')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dialogMoveRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dialogRect.x,
      originY: dialogRect.y,
    }
  }

  const handleDialogMove = (event) => {
    const move = dialogMoveRef.current
    if (!move || move.pointerId !== event.pointerId) return
    setDialogRect((current) => ({
      ...current,
      x: Math.min(Math.max(8, move.originX + event.clientX - move.startX), window.innerWidth - current.width - 8),
      y: Math.min(Math.max(8, move.originY + event.clientY - move.startY), window.innerHeight - current.height - 8),
    }))
  }

  const handleDialogMoveEnd = (event) => {
    if (dialogMoveRef.current?.pointerId !== event.pointerId) return
    dialogMoveRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <>
      {!hidden && <button
        type="button"
        data-testid="competitor-search-trigger"
        data-coach="competitor-search"
        aria-label="경쟁사 실적 검색"
        title="경쟁사 실적 검색 · 우클릭: 숨기기"
        onContextMenu={event => {
          event.preventDefault()
          setContextMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 208)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 60)) })
        }}
        onPointerDown={handleButtonPointerDown}
        onPointerMove={handleButtonPointerMove}
        onPointerUp={handleButtonPointerUp}
        onPointerCancel={() => { dragRef.current = null }}
        style={{
          position: 'fixed', left: buttonPosition.x, top: buttonPosition.y, zIndex: 8000,
          width: 58, height: 58, borderRadius: '50%', border: '1px solid rgba(255,255,255,.2)',
          background: '#082f49', color: '#fff', boxShadow: '0 8px 24px rgba(2,47,73,.35)',
          cursor: 'grab', fontSize: 0, display: 'grid', placeItems: 'center', touchAction: 'none', userSelect: 'none',
        }}
      >
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="2.2" />
          <path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7.8 10.8h6M10.8 7.8v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".75" />
        </svg>
      </button>}

      {contextMenu && <div onPointerDown={() => setContextMenu(null)} onContextMenu={event => { event.preventDefault(); setContextMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 8500 }}>
        <div role="menu" aria-label="경쟁사 검색 아이콘" style={{ position: 'absolute', left: contextMenu.x, top: contextMenu.y, padding: 5, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', boxShadow: '0 6px 24px rgba(0,0,0,.2)' }} onPointerDown={event => event.stopPropagation()}>
          <button type="button" role="menuitem" autoFocus onKeyDown={event => { if (event.key === 'Escape') setContextMenu(null) }} onClick={() => { setHidden(true); setContextMenu(null); setIsOpen(false) }} style={{ padding: '10px 14px', border: 0, borderRadius: 5, background: 'var(--bg2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>경쟁사 검색 아이콘 숨기기</button>
        </div>
      </div>}

      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <section data-testid="competitor-search-dialog" data-coach="competitor-dialog" role="dialog" aria-modal="true" aria-label="경쟁사 실적 검색" title="모서리를 드래그해 크기를 조절할 수 있습니다." style={{ position: 'fixed', left: dialogRect.x, top: dialogRect.y, width: dialogRect.width, height: dialogRect.height, opacity: 0.9, background: 'var(--bg2)', color: 'var(--text)', border: '2px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,.32)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header
              onPointerDown={handleDialogMoveStart}
              onPointerMove={handleDialogMove}
              onPointerUp={handleDialogMoveEnd}
              onPointerCancel={handleDialogMoveEnd}
              style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg3)', cursor: 'move', userSelect: 'none', touchAction: 'none' }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>경쟁사 실적 검색</div>
                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text3)' }}>브랜드 또는 상품명에 포함된 실적을 조회합니다.</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>데이터 갱신 주기: 매주 월요일 또는 화요일에 직전 주 정보를 업데이트합니다.</div>
              </div>
              <select data-coach="competitor-month" value={month} onChange={(event) => handleMonthChange(event.target.value)} style={{ marginLeft: 'auto', height: 36, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg2)', color: 'var(--text)', padding: '0 10px', fontWeight: 700 }}>
                {!months.length && <option value="">월 불러오는 중</option>}
                {!!months.length && <option value="all">전체</option>}
                {months.map((item) => <option key={item} value={item}>{formatMonth(item)}</option>)}
              </select>
              <button type="button" onClick={() => { setCoachStep(0); setCoachOpen(true) }} aria-label="경쟁사 검색 도움말" title="검색 기능 사용 안내" style={{ width: 36, height: 36, border: '1px solid #fecdd3', borderRadius: '50%', background: '#fff1f2', color: '#be123c', cursor: 'pointer', fontSize: 14, fontWeight: 900 }}>?</button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="닫기" style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </header>

            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg2)' }}>
              <SearchBox coachId="competitor-brand" testId="brand" label="브랜드 검색" value={brandSearch} onChange={setBrandSearch} onSearch={() => runSearch('brand')} disabled={isLoading || !month} placeholder="브랜드명 포함 검색" />
              <SearchBox coachId="competitor-product" testId="product" label="상품 검색" value={productSearch} onChange={setProductSearch} onSearch={() => runSearch('product')} disabled={isLoading || !month} placeholder="상품명 포함 검색" />
              <div data-coach="competitor-criteria" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, minHeight: 28, padding: '2px 3px 0' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)' }}>검색 조건</span>
                  {!criteria.length && <span style={{ fontSize: 11, color: 'var(--text3)' }}>검색하면 조건이 배지로 표시됩니다.</span>}
                  {criteria.map((criterion) => (
                    <span key={criterion.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #93c5fd', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', padding: '5px 7px 5px 10px', fontSize: 11, fontWeight: 800 }}>
                      {criterion.type === 'brand' ? '브랜드' : '상품'} · {criterion.text}
                      <button type="button" onClick={() => removeCriterion(criterion.id)} aria-label={`${criterion.text} 조건 삭제`} style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', border: 'none', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
              </div>
            </div>

            <div data-coach="competitor-results" style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg)' }}>
              {error && <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid #fecaca', borderRadius: 8, background: '#fff1f2', color: '#be123c', fontSize: 12, fontWeight: 700 }}>{error}</div>}
              {isLoading && <EmptyState>검색 결과를 불러오는 중입니다…</EmptyState>}
              {!isLoading && criteria.length > 0 && !error && (
                <div data-testid="competitor-search-summary" style={{ marginBottom: 10, fontSize: 12, color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--accent)' }}>{criteria.length}개 조건</strong> 검색 결과 {integerFormatter.format(results.length)}건
                </div>
              )}
              {!isLoading && criteria.length === 0 && <EmptyState>브랜드 또는 상품 검색어를 입력한 뒤 검색 버튼을 누르거나 Enter를 입력하세요.</EmptyState>}
              {!isLoading && criteria.length > 0 && !error && results.length === 0 && <EmptyState>검색 결과가 없습니다.</EmptyState>}
              {!isLoading && groupedResults.map((group) => <CompanyResult key={group.company} company={group.company} rows={group.rows} />)}
            </div>
            {['nw', 'ne', 'sw', 'se'].map((corner) => (
              <ResizeHandle
                key={corner}
                corner={corner}
                coachId={corner === 'se' ? 'competitor-resize' : undefined}
                onPointerDown={(event) => handleDialogResizeStart(event, corner)}
                onPointerMove={handleDialogResizeMove}
                onPointerUp={handleDialogResizeEnd}
                onPointerCancel={handleDialogResizeEnd}
              />
            ))}
          </section>
          {coachOpen && <CoachMark steps={SEARCH_COACH_STEPS} stepIndex={coachStep} onStepChange={setCoachStep} onClose={() => setCoachOpen(false)} />}
        </div>
      )}
    </>
  )
}

function ResizeHandle({ corner, coachId, ...pointerHandlers }) {
  const isTop = corner.includes('n')
  const isLeft = corner.includes('w')
  return (
    <div
      {...pointerHandlers}
      data-coach={coachId}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: isTop ? 0 : 'auto',
        bottom: isTop ? 'auto' : 0,
        left: isLeft ? 0 : 'auto',
        right: isLeft ? 'auto' : 0,
        width: 24,
        height: 24,
        zIndex: 20,
        cursor: isTop === isLeft ? 'nwse-resize' : 'nesw-resize',
        touchAction: 'none',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: `rotate(${corner === 'nw' ? 180 : corner === 'ne' ? 270 : corner === 'sw' ? 90 : 0}deg)` }}>
        <path d="M22 9 9 22M22 15l-7 7M22 21l-1 1" fill="none" stroke="var(--text2)" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function SearchBox({ coachId, testId, label, value, onChange, onSearch, disabled, placeholder }) {
  return (
    <label data-coach={coachId} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: 9, background: 'var(--bg3)' }}>
      <span style={{ paddingLeft: 4, fontSize: 12, fontWeight: 900 }}>{label}</span>
      <input data-testid={`${testId}-search-input`} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }} placeholder={placeholder} style={{ minWidth: 0, height: 34, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--text)', padding: '0 11px', fontSize: 12 }} />
      <button data-testid={`${testId}-search-button`} type="button" onClick={onSearch} disabled={disabled} style={{ height: 34, border: 'none', borderRadius: 6, padding: '0 15px', background: 'var(--accent)', color: '#fff', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1, fontSize: 12, fontWeight: 800 }}>검색</button>
    </label>
  )
}

function CompanyResult({ company, rows }) {
  const meta = COMPANY_META[company] || { label: company, color: '#475569' }
  const totalMinutes = rows.reduce((sum, row) => sum + getWeightedMinutes(row), 0)
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0)
  const totalPerMinute = totalMinutes > 0 ? totalRevenue / totalMinutes : 0
  const [sort, setSort] = useState({ key: 'broadcast', direction: 'desc' })
  const sortedRows = useMemo(() => {
    const column = SORT_COLUMNS.find((item) => item.key === sort.key) || SORT_COLUMNS[0]
    const direction = sort.direction === 'asc' ? 1 : -1
    return [...rows]
      .sort((a, b) => {
        const aValue = column.value(a)
        const bValue = column.value(b)
        let compare = 0
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          compare = aValue - bValue
        } else {
          compare = String(aValue).localeCompare(String(bValue), 'ko-KR', { numeric: true, sensitivity: 'base' })
        }
        if (compare) return compare * direction
        return compareCompetitorBroadcastDesc(a, b)
      })
  }, [rows, sort])

  const handleSort = (key) => {
    setSort((current) => {
      if (current.key !== key) return { key, direction: key === 'broadcast' ? 'desc' : 'asc' }
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  return (
    <section style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg2)' }}>
      <div style={{ minHeight: 48, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 16, background: meta.color, color: '#fff' }}>
        <strong style={{ fontSize: 16 }}>{meta.label}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, fontSize: 12, fontWeight: 800 }}>
          <span>{integerFormatter.format(rows.length)}회</span>
          <span>{integerFormatter.format(totalMinutes)}분</span>
          <span>{formatWon(totalRevenue)}</span>
          <span>{formatWon(totalPerMinute)}/분</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1050, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '39%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>
              {SORT_COLUMNS.map((column) => {
                const isActive = sort.key === column.key
                return (
                  <th key={column.key} style={{ padding: 0, textAlign: column.align, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      style={{
                        width: '100%',
                        minHeight: 34,
                        padding: '9px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--text2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      <span>{column.label}</span>
                      <span aria-hidden="true" style={{ width: 10, color: isActive ? 'var(--accent)' : 'var(--text3)' }}>
                        {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={`${row.sourceMonth}_${company}_${row.sourceRowIndex}`} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={cellStyle}>{row.date || '-'} {String(row.time || '').padStart(5, '0')}</td>
                <td style={cellStyle}>{row.channel || '-'}</td>
                <td style={cellStyle}>{row.brand || '-'}</td>
                <td title={row.productName || row.dataProductName || '-'} style={{ ...cellStyle, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.productName || row.dataProductName || '-'}</td>
                <td style={numberCellStyle}>{integerFormatter.format(getWeightedMinutes(row))}</td>
                <td style={numberCellStyle}>{formatWon(row.revenue)}</td>
                <td style={numberCellStyle}>{formatWon(getPerMinuteRevenue(row))}/분</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const cellStyle = { padding: '9px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }
const numberCellStyle = { ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function EmptyState({ children }) {
  return <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', color: 'var(--text3)', fontSize: 12 }}>{children}</div>
}
