import { useState, useMemo } from 'react'
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
  { key: '_grade',               label: '등급',      sort: (a, b) => (GRADE_ORDER[a._grade || 'D'] ?? 4) - (GRADE_ORDER[b._grade || 'D'] ?? 4) },
  { key: 'mdTeam',               label: '팀',        sort: (a, b) => (a.mdTeam || a.team || '').localeCompare(b.mdTeam || b.team || '') },
  { key: 'mdCategory',           label: '카테고리',   sort: (a, b) => (a.mdCategory || '').localeCompare(b.mdCategory || '') },
  { key: 'pgmCodeName',          label: '편성코드명', sort: (a, b) => (a.pgmCodeName || '').localeCompare(b.pgmCodeName || '', 'ko') },
  { key: 'dealTypeConverted',    label: '거래형태',   sort: (a, b) => (a.dealTypeConverted || '').localeCompare(b.dealTypeConverted || '') },
  { key: 'newProductType',       label: '신상품구분', sort: (a, b) => (a.newProductType || '').localeCompare(b.newProductType || '') },
  { key: 'availableWeightedMin1',label: '가용가중분', sort: (a, b) => (Number(a.availableWeightedMin1) || 0) - (Number(b.availableWeightedMin1) || 0) },
  { key: 'remainingSchedule',    label: '잔여편성',   sort: (a, b) => (Number(a.remainingSchedule) || 0) - (Number(b.remainingSchedule) || 0) },
]

export default function StatusUnscheduled({ rows, perfMap, manualInputs }) {
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

  if (!rows || rows.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>미편성 항목이 없습니다.</div>
  )

  const thStyle = (key) => ({
    padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    whiteSpace: 'nowrap', userSelect: 'none',
    color: sortKey === key ? 'var(--accent)' : 'var(--text2)',
    cursor: 'pointer',
    background: 'var(--bg3)',
  })

  const arrow = key => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {COLS.map(col => (
              <th key={col.key} style={thStyle(col.key)} onClick={() => handleSort(col.key)}>
                {col.label}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => {
            const grade = item._grade || getGrade(getEffectiveProfit(item.perfKey, perfMap, manualInputs))
            return (
              <tr key={item.itemId || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '7px 12px' }}>
                  <GradeBadge grade={grade} />
                </td>
                <td style={{ padding: '7px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.mdTeam || item.team || '-'}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text3)', fontSize: 11 }}>{item.mdCategory || '-'}</td>
                <td style={{ padding: '7px 12px', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pgmCodeName || '-'}</td>
                <td style={{ padding: '7px 12px', color: 'var(--text3)', fontSize: 11 }}>{item.dealTypeConverted || item.dealType || '-'}</td>
                <td style={{ padding: '7px 12px' }}>
                  {item.newProductType ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', fontWeight: 700 }}>{item.newProductType}</span>
                  ) : '-'}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{(item.availableWeightedMin1 || 0).toLocaleString()}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text2)' }}>{item.remainingSchedule || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
