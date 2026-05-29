import { useCallback, useMemo, useState } from 'react'
import { getGrade, getEffectiveProfit, getEffectiveMetrics, GRADE_META } from '../../utils/grade'

function GradeBadge({ grade }) {
  const { color, bg } = GRADE_META[grade] || GRADE_META.D
  return (
    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40`, letterSpacing: '.03em' }}>
      {grade}
    </span>
  )
}

const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 }
const MIN_COL_WIDTH = 44
const salesSort = (perfMap, manualInputs) => (a, b) =>
  getEffectiveMetrics(a, perfMap, manualInputs).salesPerMin - getEffectiveMetrics(b, perfMap, manualInputs).salesPerMin
const profitSort = (perfMap, manualInputs) => (a, b) =>
  getEffectiveMetrics(a, perfMap, manualInputs).profitPerMin - getEffectiveMetrics(b, perfMap, manualInputs).profitPerMin
const COLS = [
  { key: '_grade', label: '등급', w: 58, sort: (a, b) => (GRADE_ORDER[a._grade || 'D'] ?? 4) - (GRADE_ORDER[b._grade || 'D'] ?? 4) },
  { key: 'mdTeam', label: '팀', w: 74, sort: (a, b) => (a.mdTeam || '').localeCompare(b.mdTeam || '') },
  { key: 'mdCategory', label: '카테고리', w: 88, sort: (a, b) => (a.mdCategory || '').localeCompare(b.mdCategory || '') },
  { key: 'pgmCodeName', label: '편성코드명', w: 220, sort: (a, b) => (a.pgmCodeName || '').localeCompare(b.pgmCodeName || '', 'ko') },
  { key: 'dealTypeConverted', label: '거래형태', w: 86, sort: (a, b) => (a.dealTypeConverted || '').localeCompare(b.dealTypeConverted || '') },
  { key: 'newProductType', label: '신상품구분', w: 96, sort: (a, b) => (a.newProductType || '').localeCompare(b.newProductType || '') },
  { key: '_salesPerMin', label: '취급/분', w: 96, sort: 'sales', align: 'right' },
  { key: '_profitPerMin', label: '한익/분', w: 96, sort: 'profit', align: 'right' },
  { key: 'availableWeightedMin1', label: '가용가중분', w: 92, sort: (a, b) => (Number(a.availableWeightedMin1) || 0) - (Number(b.availableWeightedMin1) || 0), align: 'right' },
  { key: 'remainingSchedule', label: '잔여편성', w: 82, sort: (a, b) => (Number(a.remainingSchedule) || 0) - (Number(b.remainingSchedule) || 0), align: 'right' },
  { key: 'requestNote', label: '기타요청사항', w: 240, sort: null },
]

export default function StatusUnscheduled({ rows, perfMap, manualInputs }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [colWidths, setColWidths] = useState(() =>
    Object.fromEntries(COLS.map(col => [col.key, col.w]))
  )

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const startColumnResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[key] || COLS.find(col => col.key === key)?.w || MIN_COL_WIDTH
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
  }, [colWidths])

  const sorted = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey)
    if (!col?.sort) return rows
    const sortFn = col.sort === 'sales' ? salesSort(perfMap, manualInputs)
      : col.sort === 'profit' ? profitSort(perfMap, manualInputs)
        : col.sort
    return [...rows].sort((a, b) => sortDir === 'asc' ? sortFn(a, b) : sortFn(b, a))
  }, [rows, sortKey, sortDir, perfMap, manualInputs])

  const tableWidth = useMemo(
    () => COLS.reduce((sum, col) => sum + (colWidths[col.key] || col.w), 0),
    [colWidths]
  )

  if (!rows || rows.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>미편성 항목이 없습니다.</div>
  )

  const thStyle = (col) => {
    const width = colWidths[col.key] || col.w
    return {
      position: 'relative',
      padding: '10px 12px',
      textAlign: col.align || 'left',
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      userSelect: 'none',
      color: sortKey === col.key ? 'var(--accent)' : 'var(--text2)',
      cursor: col.sort ? 'pointer' : 'default',
      background: 'var(--bg3)',
      width,
      minWidth: width,
      boxSizing: 'border-box',
    }
  }

  const tdStyle = (col, extra = {}) => {
    const width = colWidths[col.key] || col.w
    return {
      padding: '7px 12px',
      width,
      minWidth: width,
      maxWidth: width,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
      textAlign: col.align || 'left',
      ...extra,
    }
  }

  const resizeHandle = col => (
    <span
      onMouseDown={e => startColumnResize(e, col.key)}
      onClick={e => e.stopPropagation()}
      title="컬럼 넓이 조절"
      style={{
        position: 'absolute',
        top: 0,
        right: -7,
        width: 14,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 2,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
      }}
    >
      <span style={{ width: 1, height: '100%', background: sortKey === col.key ? 'var(--accent)' : 'var(--border2)', opacity: 0.95, pointerEvents: 'none' }} />
    </span>
  )

  const arrow = key => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
        실적 기준: 수기입력 &gt; 직전 실적 &gt; 미입력=0
      </div>
      <div style={{ overflow: 'auto' }}>
      <table style={{ width: tableWidth, minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {COLS.map(col => (
              <th key={col.key} style={thStyle(col)} onClick={() => col.sort && handleSort(col.key)}>
                {resizeHandle(col)}
                {col.label}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => {
            const grade = item._grade || getGrade(getEffectiveProfit(item, perfMap, manualInputs))
            const metrics = getEffectiveMetrics(item, perfMap, manualInputs)
            return (
              <tr key={item.itemId || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={tdStyle(COLS[0])}>
                  <GradeBadge grade={grade} />
                </td>
                <td style={tdStyle(COLS[1], { color: 'var(--text2)' })}>{item.mdTeam || '-'}</td>
                <td style={tdStyle(COLS[2], { color: 'var(--text3)', fontSize: 11 })}>{item.mdCategory || '-'}</td>
                <td style={tdStyle(COLS[3], { fontWeight: 500 })}>{item.pgmCodeName || '-'}</td>
                <td style={tdStyle(COLS[4], { color: 'var(--text3)', fontSize: 11 })}>{item.dealTypeConverted || item.dealType || '-'}</td>
                <td style={tdStyle(COLS[5])}>
                  {item.newProductType ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', fontWeight: 700 }}>{item.newProductType}</span>
                  ) : '-'}
                </td>
                <td style={tdStyle(COLS[6], { color: 'var(--accent)', fontWeight: 700 })}>{metrics.salesPerMin.toLocaleString()}</td>
                <td style={tdStyle(COLS[7], { color: 'var(--green)', fontWeight: 700 })}>{metrics.profitPerMin.toLocaleString()}</td>
                <td style={tdStyle(COLS[8], { color: 'var(--accent)', fontWeight: 600 })}>{(item.availableWeightedMin1 || 0).toLocaleString()}</td>
                <td style={tdStyle(COLS[9], { color: 'var(--text2)' })}>{item.remainingSchedule || '-'}</td>
                <td style={tdStyle(COLS[10], { color: 'var(--text3)', fontSize: 11 })}>{item.requestNote || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
