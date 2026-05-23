import { useState, useMemo } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { getGrade, getEffectiveProfit, GRADE_META } from '../../utils/grade'

function GradeBadge({ grade }) {
  const { color, bg } = GRADE_META[grade] || GRADE_META.D
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40`, letterSpacing: '.03em' }}>
      {grade}
    </span>
  )
}

const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 }
const COLS = [
  { key: '★',           label: '★',      sort: null },
  { key: '_grade',       label: '등급',    sort: (a, b) => (GRADE_ORDER[a._grade] ?? 4) - (GRADE_ORDER[b._grade] ?? 4) },
  { key: 'dateKey',      label: '날짜',    sort: (a, b) => (a.dateKey || '').localeCompare(b.dateKey) },
  { key: 'timeText',     label: '시간',    sort: (a, b) => (a.timeText || '').localeCompare(b.timeText) },
  { key: 'channel',      label: '채널',    sort: (a, b) => (a.channel || '').localeCompare(b.channel) },
  { key: 'mdTeam',       label: '팀',      sort: (a, b) => (a.mdTeam || a.orgName || '').localeCompare(b.mdTeam || b.orgName || '') },
  { key: 'mdCategory',   label: '카테고리', sort: (a, b) => (a.mdCategory || '').localeCompare(b.mdCategory) },
  { key: 'pgmCodeName',  label: '편성코드명', sort: (a, b) => (a.pgmCodeName || '').localeCompare(b.pgmCodeName, 'ko') },
  { key: 'weightedMin',  label: '가중분',  sort: (a, b) => (a.weightedMin || 0) - (b.weightedMin || 0) },
  { key: 'memoCode',     label: '메모코드', sort: null },
  { key: 'scheduleComment', label: '편성C', sort: null },
  { key: 'status',       label: '상태',    sort: null },
]

export default function StatusScheduled({ rows, competing = [], perfMap, manualInputs }) {
  const { starred, toggleStarred } = useScheduleStore()
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey)
    if (!col?.sort) return rows
    return [...rows].sort((a, b) => sortDir === 'asc' ? col.sort(a, b) : col.sort(b, a))
  }, [rows, sortKey, sortDir])

  const allRows = useMemo(() => [...sorted, ...competing], [sorted, competing])

  if (allRows.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>편성된 항목이 없습니다.</div>
  )

  const thStyle = (key) => ({
    padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    whiteSpace: 'nowrap', userSelect: 'none',
    color: sortKey === key ? 'var(--accent)' : 'var(--text2)',
    cursor: COLS.find(c => c.key === key)?.sort ? 'pointer' : 'default',
    background: 'var(--bg3)',
  })

  const arrow = key => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {COLS.map(col => (
              <th key={col.key} style={thStyle(col.key)}
                onClick={() => col.sort && handleSort(col.key)}>
                {col.label}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((block, i) => {
            const isStarred   = !!starred[block.itemId]
            const isCompeting = block.isCompeting
            const grade       = block._grade || getGrade(getEffectiveProfit(block.perfKey, perfMap, manualInputs))
            return (
              <tr key={block.blockKey || i}
                style={{ borderBottom: '1px solid var(--border)', background: isStarred ? 'rgba(245,200,66,.05)' : i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '7px 12px' }}>
                  <button onClick={() => block.itemId && toggleStarred(block.itemId)}
                    style={{ background: 'transparent', border: 'none', cursor: block.itemId ? 'pointer' : 'default', fontSize: 12, color: isStarred ? 'var(--yellow)' : 'var(--border2)', padding: 0 }}>
                    {isStarred ? '★' : '☆'}
                  </button>
                </td>
                <td style={{ padding: '7px 12px' }}>
                  {!isCompeting && <GradeBadge grade={grade} />}
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.dateKey}</td>
                <td style={{ padding: '7px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{block.timeText}</td>
                <td style={{ padding: '7px 12px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                    background: block.channel === 'CA' ? 'var(--ca)' : block.channel === 'IP' ? 'var(--ip)' : 'var(--all)',
                    color:      block.channel === 'CA' ? 'var(--ca-t)' : block.channel === 'IP' ? 'var(--ip-t)' : 'var(--all-t)' }}>
                    {block.channel}
                  </span>
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--text2)' }}>{block.mdTeam || block.orgName || '-'}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.mdCategory || '-'}</td>
                <td style={{ padding: '7px 12px', fontWeight: isCompeting ? 700 : 400, color: isCompeting ? 'var(--red)' : 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isCompeting ? '⚔ ' : ''}{block.pgmCodeName}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{(block.weightedMin || 0).toLocaleString()}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.memoCode || '-'}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text3)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.scheduleComment || '-'}</td>
                <td style={{ padding: '7px 12px' }}>
                  {isCompeting ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: 'var(--red)', fontWeight: 700 }}>경쟁</span>
                  ) : block.isPreSchedule ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--text3)', fontWeight: 700 }}>선편성</span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f0fdf4', color: 'var(--green)', fontWeight: 700 }}>편성</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
