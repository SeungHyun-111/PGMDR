import { useEffect, useMemo, useRef, useState } from 'react'
import { db, ref, set, onValue } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'
import usePerformanceRange from '../hooks/usePerformanceRange'
import { encodeKey } from '../utils/firebaseKey'
import mdNameTeamMap from '../data/md-name-team-map.json'
import { buildReviewRequestBody, buildReviewRequestMailto } from '../utils/reviewRequestMail'
import useLocalStorageState from '../hooks/useLocalStorageState'
import UrbanSurface from '../components/forecast/UrbanSurface'
import './PerformanceForecastUrban.css'
import './NewProductReviewUrban.css'

const REVIEW_TYPES = new Set(['신상품', '재녹화'])
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const REVIEW_INPUT_PATH = 'newProductReviewInputs'

function toDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getDefaultWeekRange() {
  const today = new Date()
  const monday = new Date(today)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setDate(monday.getDate() - 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 13)
  return { start: toDateKey(monday), end: toDateKey(sunday) }
}

function formatDateLabel(dateKey, fallbackDay = '') {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey || '-'
  const day = fallbackDay || DAY_LABELS[date.getDay()]
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${day}`
}

function getPreviousTwoWeeks() {
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const start = new Date(monday)
  start.setDate(start.getDate() - 14)
  const end = new Date(monday)
  end.setDate(end.getDate() - 1)
  return { start: toDateKey(start), end: toDateKey(end) }
}

function formatNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? Math.round(number).toLocaleString() : '-'
}

function getReviewTypeLabel(type) {
  if (type === '신상품') return '신'
  if (type === '재녹화') return '재'
  return type || '-'
}

function getEntryId(row) {
  return `${row.broadcastTimestamp || 0}_${encodeKey(row.perfKey || '')}_${row.sourceRow || 0}`
}

function getEntryPrefix(row) {
  return `${row.broadcastTimestamp || 0}_${encodeKey(row.perfKey || '')}`
}

function getTeamName(row) {
  return row.mdTeam || mdNameTeamMap[String(row.mdName || '').trim()] || ''
}

export default function NewProductReview() {
  const [urban, setUrban] = useLocalStorageState('pgmdr.ui.review.urban', true)
  const defaultRange = useMemo(() => getDefaultWeekRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [teamFilter, setTeamFilter] = useState('전체')
  const [reviewInputs, setReviewInputs] = useState({})
  const [mailModalOpen, setMailModalOpen] = useState(false)
  const userName = useScheduleStore(state => state.userName)
  const { rows: performanceRows, loading: isLoadingPerformanceKeys, error: performanceError } = usePerformanceRange(startDate, endDate)

  useEffect(() => {
    const reviewRef = ref(db, REVIEW_INPUT_PATH)
    const unsubscribe = onValue(reviewRef, snap => setReviewInputs(snap.exists() ? snap.val() : {}))
    return () => unsubscribe?.()
  }, [])

  const reviewInputsByPrefix = useMemo(() => {
    const result = {}
    Object.entries(reviewInputs || {}).forEach(([entryId, state]) => {
      const prefix = entryId.split('_').slice(0, -1).join('_')
      if (!prefix) return
      const previous = result[prefix]
      if (!previous || Number(state?.updatedAt || 0) > Number(previous?.updatedAt || 0)) {
        result[prefix] = state
      }
    })
    return result
  }, [reviewInputs])

  const baseRows = useMemo(() => {
    return Object.values(performanceRows || {})
      .filter(row => REVIEW_TYPES.has(row?.newProductType))
      .filter(row => {
        const date = row.broadcastDate || ''
        return (!startDate || date >= startDate) && (!endDate || date <= endDate)
      })
      .map(row => {
        const entryId = getEntryId(row)
        return {
          ...row,
          entryId,
          entryPrefix: getEntryPrefix(row),
          teamName: getTeamName(row),
          reviewState: reviewInputs[entryId] || reviewInputsByPrefix[getEntryPrefix(row)] || {},
        }
      })
      .filter(row => teamFilter === '전체' || row.teamName === teamFilter)
      .sort((a, b) => {
        const at = Number(a.broadcastTimestamp || 0)
        const bt = Number(b.broadcastTimestamp || 0)
        if (at !== bt) return at - bt
        return String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko')
      })
  }, [endDate, performanceRows, reviewInputs, reviewInputsByPrefix, startDate, teamFilter])

  const teamOptions = useMemo(() => {
    const names = new Set(['전체'])
    Object.values(performanceRows || {}).forEach(row => {
      if (!REVIEW_TYPES.has(row?.newProductType)) return
      const date = row.broadcastDate || ''
      if ((startDate && date < startDate) || (endDate && date > endDate)) return
      const team = getTeamName(row)
      if (team) names.add(team)
    })
    return [...names].sort((a, b) => a === '전체' ? -1 : b === '전체' ? 1 : a.localeCompare(b, 'ko'))
  }, [endDate, performanceRows, startDate])

  const incompleteRows = baseRows.filter(row => !row.reviewState.completed)
  const completeRows = baseRows.filter(row => row.reviewState.completed)

  const saveReview = async (row, patch) => {
    const prev = reviewInputs[row.entryId] || {}
    const next = {
      ...prev,
      ...patch,
      updatedAt: Date.now(),
      updatedBy: userName || '',
    }
    await set(ref(db, `${REVIEW_INPUT_PATH}/${row.entryId}`), next)
  }

  return (
    <main className={`review-page forecast-page${urban ? ' is-urban' : ''}`} style={{ height: '100%', background: urban ? undefined : 'var(--bg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {urban && <header className="review-hero"><div><span>PRODUCT PERFORMANCE REVIEW</span><h1>신상품 / 재녹화 리뷰</h1><p>방송 실적을 살펴보고, 다음 편성을 위한 리뷰를 남기세요.</p></div><span className="urban-period">{startDate} — {endDate}</span></header>}
      <div className="review-toolbar" style={toolbarStyle}>
        <div className="forecast-mode-switch" aria-label="리뷰 테마">{[true, false].map(value => <button key={String(value)} type="button" aria-pressed={urban === value} onClick={() => setUrban(value)}>{value ? 'Urban' : '기본'}</button>)}</div>
        <strong style={{ fontSize: 13, color: 'var(--text)' }}>신상품/재녹화 리뷰</strong>
        <input aria-label="조회 시작일" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={filterInputStyle} />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>~</span>
        <input aria-label="조회 종료일" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={filterInputStyle} />
        <select aria-label="조회 팀" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={filterInputStyle}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>
        <button type="button" onClick={() => { setStartDate(defaultRange.start); setEndDate(defaultRange.end); setTeamFilter('전체') }} style={buttonStyle}>
          이번주
        </button>
        <button type="button" onClick={() => setMailModalOpen(true)} style={buttonStyle}>메일작성</button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {isLoadingPerformanceKeys ? '불러오는 중...' : `미입력 ${incompleteRows.length.toLocaleString()}건 · 입력 ${completeRows.length.toLocaleString()}건`}
        </span>
      </div>

      {performanceError && <p role="alert" style={{ color: 'var(--red)', padding: '0 16px', fontSize: 12 }}>{performanceError}</p>}
      {urban && <div className="review-metrics">
        {[['전체 대상', baseRows.length, '조회 기간 · 선택 조직 기준', 'blue'], ['리뷰 대기', incompleteRows.length, '아직 완료하지 않은 방송', 'warm'], ['리뷰 완료', completeRows.length, `완료율 ${baseRows.length ? Math.round(completeRows.length / baseRows.length * 100) : 0}%`, 'done']].map(([label, count, caption, tone], index) => <UrbanSurface key={label} order={index} className={`review-metric urban-metric--${tone}`}><span>{label}</span><strong>{isLoadingPerformanceKeys ? '—' : count.toLocaleString()}<small>건</small></strong><p>{caption}</p></UrbanSurface>)}
      </div>}
      <div className="review-content" style={contentStyle}>
        <ReviewTable title="미입력" rows={incompleteRows} onSave={saveReview} urban={urban} order={3} />
        <ReviewTable title="입력" rows={completeRows} onSave={saveReview} urban={urban} order={4} />
      </div>
      {mailModalOpen && <MailTargetModal initialTeam={teamFilter} reviewInputs={reviewInputs} reviewInputsByPrefix={reviewInputsByPrefix} onClose={() => setMailModalOpen(false)} />}
    </main>
  )
}

function MailTargetModal({ initialTeam, reviewInputs, reviewInputsByPrefix, onClose }) {
  const dialogRef = useRef(null)
  const [defaultRange] = useState(getPreviousTwoWeeks)
  const [start, setStart] = useState(defaultRange.start)
  const [end, setEnd] = useState(defaultRange.end)
  const [team, setTeam] = useState(initialTeam)
  const [excludedIds, setExcludedIds] = useState(() => new Set())
  const [mailStatus, setMailStatus] = useState('')
  const [preparingMail, setPreparingMail] = useState(false)
  const validRange = !!start && !!end && start <= end
  const { rows, loading, error } = usePerformanceRange(start, end, validRange)

  useEffect(() => { dialogRef.current.showModal() }, [])

  const candidates = useMemo(() => Object.values(rows || {})
    .filter(row => REVIEW_TYPES.has(row?.newProductType) && row.broadcastDate >= start && row.broadcastDate <= end)
    .map(row => ({ ...row, teamName: getTeamName(row) || '미지정', reviewState: reviewInputs[getEntryId(row)] || reviewInputsByPrefix[getEntryPrefix(row)] || {} }))
    .sort((a, b) => Number(a.broadcastTimestamp || 0) - Number(b.broadcastTimestamp || 0) || String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko')),
  [rows, start, end, reviewInputs, reviewInputsByPrefix])
  const teams = [...new Set([initialTeam, team, ...candidates.map(row => row.teamName)])].filter(name => name && name !== '전체').sort((a, b) => a.localeCompare(b, 'ko'))
  const targets = validRange ? candidates.filter(row => (team === '전체' || row.teamName === team) && !row.reviewState.completed) : []
  const selectedCount = targets.filter(row => !excludedIds.has(getEntryId(row))).length
  const allSelected = targets.length > 0 && selectedCount === targets.length
  const selectionDisabled = !validRange || loading || !!error || !targets.length
  const toggleTarget = (id, checked) => setExcludedIds(previous => {
    const next = new Set(previous)
    if (checked) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = checked => setExcludedIds(previous => {
    const next = new Set(previous)
    targets.forEach(row => {
      if (checked) next.delete(getEntryId(row))
      else next.add(getEntryId(row))
    })
    return next
  })
  const columns = ['구분', 'PGM명', '조직', '방송일', '시간', '다원', '입력여부']
  const copyMailBody = async selectedRows => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('HTML 표 복사를 지원하는 Chrome 또는 Edge에서 접속해주세요.')
    const { html, text } = buildReviewRequestBody(selectedRows)
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })])
    } catch {
      throw new Error('본문 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해주세요.')
    }
  }
  const recopyMailBody = async () => {
    if (selectionDisabled || !selectedCount || preparingMail) return
    setPreparingMail(true)
    try {
      await copyMailBody(targets.filter(row => !excludedIds.has(getEntryId(row))))
      setMailStatus(`본문 ${selectedCount.toLocaleString()}건 복사 완료. 기존 클립보드 내용을 교체했습니다. Outlook 본문 영역을 클릭한 뒤 Ctrl+V를 눌러주세요.`)
    } catch (error) {
      setMailStatus(error.message)
    } finally {
      setPreparingMail(false)
    }
  }
  const openMail = async () => {
    if (selectionDisabled || !selectedCount || preparingMail) return
    setPreparingMail(true)
    setMailStatus('')
    try {
      const selectedRows = targets.filter(row => !excludedIds.has(getEntryId(row)))
      const mailto = buildReviewRequestMailto(selectedRows)
      await copyMailBody(selectedRows)
      setMailStatus(`본문 ${selectedRows.length.toLocaleString()}건 복사 완료. 메일창의 수신자 이름을 확인하고, 본문에서 Ctrl+V를 눌러주세요. 붙여넣기가 안 되면 '본문 다시 복사'를 눌러주세요. 메일창이 안 뜨면 브라우저의 앱 열기 확인창을 확인해주세요.`)
      window.location.assign(mailto)
    } catch (error) {
      setMailStatus(error.message || 'Outlook 작성창을 열지 못했습니다.')
    } finally {
      setPreparingMail(false)
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="mail-target-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose() } }} style={{ width: 'min(960px, calc(100vw - 40px))', maxHeight: '85vh', position: 'fixed', inset: 0, margin: 'auto', padding: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg2)', color: 'var(--text)', boxShadow: '0 20px 70px #0005' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 id="mail-target-title" style={{ margin: 0, fontSize: 16 }}>메일작성 · 대상 PGM 선택</h2>
        <button type="button" onClick={onClose} style={buttonStyle}>닫기</button>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <label>조직 <select value={team} onChange={e => setTeam(e.target.value)} style={filterInputStyle}><option>전체</option>{teams.map(name => <option key={name}>{name}</option>)}</select></label>
          <label>시작일 <input type="date" value={start} onChange={e => setStart(e.target.value)} style={filterInputStyle} /></label>
          <label>종료일 <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={filterInputStyle} /></label>
        </div>
        {!validRange && <p role="alert" style={{ color: 'var(--red)', fontSize: 12 }}>시작일과 종료일을 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.</p>}
        {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 12 }}>{String(error)}</p>}
        <p aria-live="polite" style={{ fontSize: 12, color: 'var(--text2)', margin: '18px 0 8px' }}>미입력 대상 PGM · {validRange && loading ? '불러오는 중…' : error || !validRange ? '조회 대기' : `${targets.length.toLocaleString()}건 중 ${selectedCount.toLocaleString()}건 선택`}</p>
        <div style={{ overflow: 'auto', maxHeight: '48vh', border: '1px solid var(--border)' }}>
          <table style={{ ...tableStyle, width: '100%', minWidth: 720 }}>
            <thead><tr><th scope="col" style={{ ...thStyle, width: 42, textAlign: 'center' }}><input type="checkbox" aria-label="대상 PGM 전체 선택/해제" checked={allSelected} disabled={selectionDisabled} ref={element => { if (element) element.indeterminate = selectedCount > 0 && !allSelected }} onChange={event => toggleAll(event.target.checked)} /></th>{columns.map((label, index) => <th key={label} scope="col" style={{ ...thStyle, width: index === 1 ? '32%' : undefined }}>{label}</th>)}</tr></thead>
            <tbody>
              {validRange && !loading && !error && targets.map(row => <tr key={getEntryId(row)}><td style={{ ...tdStyle, textAlign: 'center' }}><input type="checkbox" aria-label={`${row.pgmCodeName || 'PGM'} ${row.broadcastDate} ${row.broadcastTime || ''} 선택`} checked={!excludedIds.has(getEntryId(row))} onChange={event => toggleTarget(getEntryId(row), event.target.checked)} /></td>{[row.newProductType, row.pgmCodeName || '-', row.teamName, formatDateLabel(row.broadcastDate, row.dayOfWeek), row.broadcastTime || '-', row.multiChannel || '-', '미입력'].map((value, index) => <td key={index} title={String(value)} style={tdStyle}>{value}</td>)}</tr>)}
              {(!validRange || loading || error || !targets.length) && <tr><td colSpan={columns.length + 1} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>{!validRange ? '조회할 기간을 선택해주세요.' : loading ? '대상 PGM을 불러오는 중입니다.' : error ? '대상 PGM을 불러오지 못했습니다.' : '선택한 조건에 해당하는 PGM이 없습니다.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>수신자·제목은 자동 설정됩니다. 본문에서 Ctrl+V를 눌러주세요.</span>
          <button type="button" disabled={selectionDisabled || !selectedCount || preparingMail} onClick={recopyMailBody} style={buttonStyle}>본문 다시 복사</button>
          <button type="button" disabled={selectionDisabled || !selectedCount || preparingMail} onClick={openMail} style={{ ...buttonStyle, background: 'var(--accent)', color: '#fff', opacity: selectionDisabled || !selectedCount || preparingMail ? 0.5 : 1 }}>{preparingMail ? 'Outlook 연결 중…' : 'Outlook 메일창 열기'}</button>
        </div>
        {mailStatus && <p role="status" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 0 }}>{mailStatus}</p>}
      </div>
    </dialog>
  )
}

function ReviewTable({ title, rows, onSave, urban, order }) {
  const Surface = urban ? UrbanSurface : 'section'
  return (
    <Surface className="review-table-panel" {...(urban ? { order } : {})} style={tableSectionStyle}>
      <div className="review-table-title" style={tableTitleStyle}>
        <strong style={{ fontSize: 12, color: 'var(--text)' }}>{title}</strong>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length.toLocaleString()}건</span>
      </div>
      <div className="review-table-scroll" style={tableScrollStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ ...thStyle, width: col.w, textAlign: col.align || 'left' }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                  표시할 항목이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <ReviewRow key={row.entryId} row={row} index={index} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  )
}

function ReviewRow({ row, index, onSave }) {
  const type = row.newProductType || ''
  const completed = !!row.reviewState.completed
  const reviewText = row.reviewState.review || ''
  const reviewRows = Math.min(12, Math.max(1, reviewText.split('\n').length))
  const bg = completed
    ? 'rgba(22,163,74,.08)'
    : type === '신상품'
      ? 'rgba(74,108,247,.10)'
      : index % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)'

  return (
    <tr style={{ background: bg }}>
      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: type === '신상품' ? 'var(--accent)' : 'var(--text2)' }}>{getReviewTypeLabel(type)}</td>
      <td style={tdStyle} title={row.pgmCodeName || ''}>{row.pgmCodeName || '-'}</td>
      <td style={tdStyle} title={row.teamName || ''}>{row.teamName || '-'}</td>
      <td style={tdStyle}>{formatDateLabel(row.broadcastDate, row.dayOfWeek)}</td>
      <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{row.broadcastTime || '-'}</td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>{row.multiChannel || '-'}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(row.salesPerWeightedMin)}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(row.profitPerWeightedMin)}</td>
      <td style={{ ...tdStyle, ...reviewTdStyle }}>
        <textarea
          aria-label={`${row.pgmCodeName || 'PGM'} 리뷰`}
          value={reviewText}
          onChange={e => onSave(row, { review: e.target.value })}
          rows={reviewRows}
          style={textareaStyle}
        />
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={completed}
          onChange={e => onSave(row, { completed: e.target.checked })}
          aria-label="입력여부"
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
      </td>
    </tr>
  )
}

const COLUMNS = [
  { key: 'type', label: '구분', w: 54, align: 'center' },
  { key: 'pgmCodeName', label: '편성코드', w: 250 },
  { key: 'teamName', label: '팀명', w: 110 },
  { key: 'date', label: '날짜', w: 110 },
  { key: 'time', label: '시간', w: 70, align: 'center' },
  { key: 'multiChannel', label: '다원', w: 70, align: 'center' },
  { key: 'salesPerWeightedMin', label: '분취', w: 92, align: 'right' },
  { key: 'profitPerWeightedMin', label: '분한익', w: 92, align: 'right' },
  { key: 'review', label: '리뷰', w: 460 },
  { key: 'input', label: '입력여부', w: 90, align: 'center' },
]

const TABLE_WIDTH = COLUMNS.reduce((sum, col) => sum + col.w, 0)

const toolbarStyle = {
  minHeight: 50,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg2)',
  flexShrink: 0,
}

const contentStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const tableSectionStyle = {
  flex: '1 1 0',
  minHeight: 180,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const tableTitleStyle = {
  height: 28,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const tableScrollStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  position: 'relative',
}

const tableStyle = {
  width: TABLE_WIDTH,
  minWidth: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  tableLayout: 'fixed',
  background: 'var(--bg2)',
  fontSize: 12,
}

const thStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  height: 30,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  borderTop: '2px solid var(--text)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontWeight: 900,
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 0 var(--border2), 0 8px 12px rgba(0,0,0,.08)',
}

const tdStyle = {
  position: 'relative',
  zIndex: 0,
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const reviewTdStyle = {
  height: 'auto',
  minHeight: 32,
  padding: 2,
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'clip',
  verticalAlign: 'top',
}

const textareaStyle = {
  position: 'relative',
  zIndex: 0,
  width: '100%',
  minHeight: 28,
  height: 'auto',
  display: 'block',
  resize: 'none',
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--text)',
  padding: '5px 6px',
  font: 'inherit',
  lineHeight: 1.45,
  outline: 'none',
  overflow: 'hidden',
  fieldSizing: 'content',
}

const filterInputStyle = {
  height: 30,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg3)',
  color: 'var(--text)',
  padding: '0 8px',
  fontSize: 12,
}

const buttonStyle = {
  height: 30,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg3)',
  color: 'var(--text2)',
  padding: '0 10px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
}
