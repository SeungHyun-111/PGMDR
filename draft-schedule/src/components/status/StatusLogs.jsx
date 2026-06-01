import { useCallback, useMemo, useState } from 'react'
import { db, ref, get } from '../../api/firebase'
import { VERSION_DRAFT } from '../../utils/sessionVersion'

const PAGE_SIZE = 300
const MIN_COL_WIDTH = 52

const formatTs = ts => {
  const d = new Date(ts || 0)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const productName = value => {
  if (!value) return '-'
  if (value.isCompeting) {
    const names = [value.item1?.pgmCodeName, value.item2?.pgmCodeName, ...(value.items || []).map(i => i?.pgmCodeName)]
      .filter(Boolean)
    return names.length ? names.join(' + ') : value.pgmCodeName || '경쟁'
  }
  return value.pgmCodeName || '-'
}

const getItem = log => log.after || log.before || {}

const scheduleDetail = log => {
  if (log.detail) return log.detail
  const before = log.before || null
  const after = log.after || null
  if (!before && after) return '빈 슬롯에 상품 편성'
  if (before && !after) return '기존 상품 삭제 또는 사이드바 반환'
  if (before && after && before.channel !== after.channel) return `채널변경: ${before.channel || '-'} → ${after.channel || '-'}`
  if (before && after && productName(before) === productName(after)) return '속성변경'
  if (before && after) return '상품 교체'
  return '-'
}

const actionStyle = action => {
  if (['삭제', '시간삭제'].includes(action)) return { bg: '#fef2f2', color: 'var(--red)' }
  if (['편성', '추가'].includes(action)) return { bg: '#f0fdf4', color: 'var(--green)' }
  if (['채널변경', '채널나누기', '채널합치기', '시간나누기'].includes(action)) return { bg: '#eff6ff', color: 'var(--accent)' }
  if (['복사'].includes(action)) return { bg: '#fef9c3', color: '#854d0e' }
  return { bg: 'var(--bg4)', color: 'var(--text2)' }
}

const SCHEDULE_COLS = [
  { key: 'userName', label: '수정자', w: 82, value: log => log.userName || '-' },
  { key: 'timestamp', label: '수정시각', w: 116, value: log => formatTs(log.timestamp), sort: (a, b) => (a.timestamp || 0) - (b.timestamp || 0) },
  { key: 'dateKey', label: '편성일', w: 92, value: log => log.dateKey || log.after?.dateKey || log.before?.dateKey || '-' },
  { key: 'timeText', label: '편성시간', w: 76, value: log => log.timeText || log.after?.timeText || log.before?.timeText || '-' },
  { key: 'channel', label: '채널', w: 58, value: log => log.channel || log.after?.channel || log.before?.channel || '-' },
  { key: 'action', label: '액션', w: 92, value: log => log.action || '-' },
  { key: 'beforeName', label: '기존상품', w: 190, value: log => productName(log.before) },
  { key: 'afterName', label: '변경상품', w: 190, value: log => productName(log.after) },
  { key: 'detail', label: '변경상세', w: 360, value: scheduleDetail },
]

const SIDEBAR_COLS = [
  { key: 'userName', label: '수정자', w: 82, value: log => log.userName || '-' },
  { key: 'timestamp', label: '수정시각', w: 116, value: log => formatTs(log.timestamp), sort: (a, b) => (a.timestamp || 0) - (b.timestamp || 0) },
  { key: 'action', label: '액션', w: 74, value: log => log.action || '-' },
  { key: 'pgmCodeName', label: '상품명', w: 220, value: log => productName(getItem(log)) },
  { key: 'mdTeam', label: '팀', w: 78, value: log => getItem(log).mdTeam || getItem(log).orgName || '-' },
  { key: 'mdCategory', label: '카테고리', w: 92, value: log => getItem(log).mdCategory || '-' },
  { key: 'memoCode', label: '메모코드', w: 96, value: log => getItem(log).memoCode || '-' },
  { key: 'scheduleComment', label: '편성C', w: 130, value: log => getItem(log).scheduleComment || '-' },
  { key: 'requestNote', label: '기타요청', w: 220, value: log => getItem(log).requestNote || '-' },
  { key: 'detail', label: '변경상세', w: 280, value: log => log.detail || '-' },
]

function LogTable({ title, rows, cols, emptyText }) {
  const [sortKey, setSortKey] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')
  const [colWidths, setColWidths] = useState(() =>
    Object.fromEntries(cols.map(col => [col.key, col.w]))
  )

  const startColumnResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[key] || cols.find(col => col.key === key)?.w || MIN_COL_WIDTH
    const onMove = mv => {
      const nextW = Math.max(MIN_COL_WIDTH, startW + mv.clientX - startX)
      setColWidths(prev => ({ ...prev, [key]: nextW }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths, cols])

  const sorted = useMemo(() => {
    const col = cols.find(c => c.key === sortKey)
    const sortFn = col?.sort || ((a, b) => String(col?.value(a) ?? '').localeCompare(String(col?.value(b) ?? ''), 'ko'))
    return [...rows].sort((a, b) => sortDir === 'asc' ? sortFn(a, b) : sortFn(b, a))
  }, [rows, cols, sortKey, sortDir])

  const tableWidth = useMemo(
    () => cols.reduce((sum, col) => sum + (colWidths[col.key] || col.w), 0),
    [cols, colWidths]
  )

  const handleSort = key => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <section style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <div style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{rows.length.toLocaleString()}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{emptyText}</div>
        ) : (
          <table style={{ width: tableWidth, minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {cols.map(col => {
                  const width = colWidths[col.key] || col.w
                  const active = sortKey === col.key
                  return (
                    <th key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ position: 'sticky', top: 0, zIndex: 1, width, minWidth: width, boxSizing: 'border-box', padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', userSelect: 'none', color: active ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', background: 'var(--bg3)' }}>
                      <span
                        onMouseDown={e => startColumnResize(e, col.key)}
                        onClick={e => e.stopPropagation()}
                        title="컬럼 넓이 조절"
                        style={{ position: 'absolute', top: 0, right: -7, width: 14, height: '100%', cursor: 'col-resize', zIndex: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
                      >
                        <span style={{ width: 1, height: '100%', background: active ? 'var(--accent)' : 'var(--border2)', opacity: 0.95, pointerEvents: 'none' }} />
                      </span>
                      {col.label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((log, i) => (
                <tr key={`${log.timestamp || i}_${i}`} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  {cols.map(col => {
                    const width = colWidths[col.key] || col.w
                    const value = col.value(log)
                    const isAction = col.key === 'action'
                    const style = isAction ? actionStyle(value) : null
                    return (
                      <td key={col.key} style={{ width, minWidth: width, maxWidth: width, boxSizing: 'border-box', padding: '8px 12px', color: col.key === 'timestamp' ? 'var(--text3)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value || '')}>
                        {isAction ? (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 800, background: style.bg, color: style.color }}>
                            {value}
                          </span>
                        ) : value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

const isLogForVersion = (log, versionId) => {
  const logVersionId = log?.versionId || VERSION_DRAFT
  return logVersionId === (versionId || VERSION_DRAFT)
}

export default function StatusLogs({ logs, startDate, poolType, versionId }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [keyword, setKeyword] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [searchRows, setSearchRows] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const sourceLogs = searchRows || logs || []
  const orderedLogs = useMemo(
    () => [...sourceLogs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    [sourceLogs]
  )
  const visibleLogs = orderedLogs.slice(0, limit)
  const scheduleLogs = visibleLogs.filter(log => (log.scope || 'schedule') === 'schedule')
  const sidebarLogs = visibleLogs.filter(log => log.scope === 'sidebar')
  const hasMore = limit < orderedLogs.length

  const runSearch = async () => {
    const q = keyword.trim().toLowerCase()
    setSearchError('')
    setLimit(PAGE_SIZE)
    if (!q) {
      setSearchRows(null)
      setActiveKeyword('')
      return
    }
    if (!startDate) return
    setIsSearching(true)
    try {
      const snap = await get(ref(db, `sessions/${startDate}_${poolType}/logs`))
      const val = snap.val() || {}
      const rows = Object.values(val).filter(log =>
        isLogForVersion(log, versionId) && productName(log?.before).toLowerCase().includes(q)
      )
      setSearchRows(rows)
      setActiveKeyword(keyword.trim())
    } catch (e) {
      setSearchError(e.message || '검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setKeyword('')
    setActiveKeyword('')
    setSearchRows(null)
    setSearchError('')
    setLimit(PAGE_SIZE)
  }

  return (
    <div style={{ height: 'calc(100vh - 190px)', minHeight: 520, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', flexShrink: 0 }}>기존상품 검색</span>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch(); if (e.key === 'Escape') clearSearch() }}
          placeholder="기존상품명 입력"
          style={{ width: 220, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5, fontSize: 11, outline: 'none' }}
        />
        <button onClick={runSearch} disabled={isSearching}
          style={{ padding: '5px 12px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', cursor: isSearching ? 'default' : 'pointer', opacity: isSearching ? 0.65 : 1, fontSize: 11, fontWeight: 800 }}>
          {isSearching ? '검색중' : '검색'}
        </button>
        {activeKeyword && (
          <button onClick={clearSearch}
            style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>
            초기화
          </button>
        )}
        <span style={{ fontSize: 10, color: searchError ? 'var(--red)' : 'var(--text3)' }}>
          {searchError || (activeKeyword ? `"${activeKeyword}" 검색 결과 ${orderedLogs.length.toLocaleString()}건` : '검색은 RTDB 전체 변경이력에서 기존상품 기준으로 조회')}
        </span>
      </div>
      {!orderedLogs.length ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>변경 이력이 없습니다.</div>
      ) : (
      <>
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>
        <LogTable
          title="편성표 수정 이력"
          rows={scheduleLogs}
          cols={SCHEDULE_COLS}
          emptyText="편성표 수정 이력이 없습니다."
        />
        <LogTable
          title="사이드바 상품 이력"
          rows={sidebarLogs}
          cols={SIDEBAR_COLS}
          emptyText="사이드바 상품 이력이 없습니다."
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          {activeKeyword ? '검색 결과' : '최근'} {visibleLogs.length.toLocaleString()} / 전체 {orderedLogs.length.toLocaleString()}건
        </span>
        {hasMore && (
          <button onClick={() => setLimit(prev => prev + PAGE_SIZE)}
            style={{ padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            300건 더 보기
          </button>
        )}
      </div>
      </>
      )}
    </div>
  )
}
