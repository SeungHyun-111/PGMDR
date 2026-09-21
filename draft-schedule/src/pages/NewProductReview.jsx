import { useEffect, useMemo, useState } from 'react'
import { db, ref, set, onValue } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'
import { encodeKey } from '../utils/firebaseKey'
import mdNameTeamMap from '../data/md-name-team-map.json'

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
  const defaultRange = useMemo(() => getDefaultWeekRange(), [])
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [teamFilter, setTeamFilter] = useState('전체')
  const [reviewInputs, setReviewInputs] = useState({})
  const {
    performanceRows,
    performanceGlobalLoaded,
    isLoadingPerformanceKeys,
    loadGlobalPerformanceData,
    userName,
  } = useScheduleStore()

  useEffect(() => {
    if (!performanceGlobalLoaded) loadGlobalPerformanceData?.()
  }, [loadGlobalPerformanceData, performanceGlobalLoaded])

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
    <main style={{ height: '100%', background: 'var(--bg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={toolbarStyle}>
        <strong style={{ fontSize: 13, color: 'var(--text)' }}>신상품/재녹화 리뷰</strong>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={filterInputStyle} />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>~</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={filterInputStyle} />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={filterInputStyle}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>
        <button type="button" onClick={() => { setStartDate(defaultRange.start); setEndDate(defaultRange.end); setTeamFilter('전체') }} style={buttonStyle}>
          이번주
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {isLoadingPerformanceKeys ? '불러오는 중...' : `미입력 ${incompleteRows.length.toLocaleString()}건 · 입력 ${completeRows.length.toLocaleString()}건`}
        </span>
      </div>

      <div style={contentStyle}>
        <ReviewTable title="미입력" rows={incompleteRows} onSave={saveReview} />
        <ReviewTable title="입력" rows={completeRows} onSave={saveReview} />
      </div>
    </main>
  )
}

function ReviewTable({ title, rows, onSave }) {
  return (
    <section style={tableSectionStyle}>
      <div style={tableTitleStyle}>
        <strong style={{ fontSize: 12, color: 'var(--text)' }}>{title}</strong>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{rows.length.toLocaleString()}건</span>
      </div>
      <div style={tableScrollStyle}>
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
    </section>
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
