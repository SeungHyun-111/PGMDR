import { useCallback, useMemo, useState, useEffect } from 'react'
import * as XLSX from 'xlsx-js-style'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LabelList, ResponsiveContainer } from 'recharts'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { db, ref, get } from '../api/firebase'
import StatusScheduled from '../components/status/StatusScheduled'
import StatusUnscheduled from '../components/status/StatusUnscheduled'
import StatusLogs from '../components/status/StatusLogs'
import { GRADES, GRADE_META, getGrade, getEffectiveProfit, getEffectiveMetrics } from '../utils/grade'
import { VERSION_DRAFT } from '../utils/sessionVersion'

const TEAM_COLORS = ['#818cf8','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#4ade80','#f87171','#fbbf24','#2dd4bf']
const GRADE_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 }
const MIN_TEAM_COL_WIDTH = 44
const TEAM_DETAIL_COLS = [
  { key: '_status', label: '상태', w: 78, sort: (a, b) => a._statusOrder - b._statusOrder },
  { key: '_gradeValue', label: '등급', w: 58, sort: (a, b) => (GRADE_ORDER[a._gradeValue] ?? 9) - (GRADE_ORDER[b._gradeValue] ?? 9) },
  { key: '_teamName', label: '팀', w: 90, sort: (a, b) => String(a._teamName || '').localeCompare(String(b._teamName || ''), 'ko') },
  { key: 'dateKey', label: '날짜', w: 92, sort: (a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')) },
  { key: 'timeText', label: '시간', w: 64, sort: (a, b) => String(a.timeText || '').localeCompare(String(b.timeText || '')) },
  { key: 'channel', label: '채널', w: 58, sort: (a, b) => String(a.channel || '').localeCompare(String(b.channel || '')) },
  { key: 'mdCategory', label: '카테고리', w: 92, sort: (a, b) => String(a.mdCategory || '').localeCompare(String(b.mdCategory || ''), 'ko') },
  { key: 'pgmCodeName', label: '편성코드명', w: 220, sort: (a, b) => String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko', { numeric: true }) },
  { key: 'dealTypeConverted', label: '거래형태', w: 86, sort: (a, b) => String(a.dealTypeConverted || a.dealType || '').localeCompare(String(b.dealTypeConverted || b.dealType || '')) },
  { key: 'newProductType', label: '신상품', w: 90, sort: (a, b) => String(a.newProductType || '').localeCompare(String(b.newProductType || ''), 'ko') },
  { key: '_displayMin', label: '가중분', w: 88, align: 'right', sort: (a, b) => Number(a._displayMin || 0) - Number(b._displayMin || 0) },
  { key: '_salesPerMin', label: '취급/분', w: 96, align: 'right', sort: (a, b) => Number(a._salesPerMin || 0) - Number(b._salesPerMin || 0) },
  { key: '_profitPerMin', label: '한익/분', w: 96, align: 'right', sort: (a, b) => Number(a._profitPerMin || 0) - Number(b._profitPerMin || 0) },
  { key: 'memoCode', label: '메모코드', w: 120, sort: (a, b) => String(a.memoCode || '').localeCompare(String(b.memoCode || ''), 'ko') },
  { key: 'memoCode2', label: '메모코드2', w: 120, sort: (a, b) => String(a.memoCode2 || '').localeCompare(String(b.memoCode2 || ''), 'ko') },
  { key: 'scheduleComment', label: '편성C', w: 130, sort: null },
  { key: 'requestNote', label: '기타요청', w: 220, sort: null },
]

function fmtNum(v) {
  const n = Number(v || 0)
  return n ? Math.round(n).toLocaleString() : '-'
}

function fmtTime(v) {
  const match = String(v || '').match(/(\d{1,2}):(\d{2})/)
  return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : ''
}

function fmtDateWithDow(v) {
  const s = String(v || '')
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return s
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${match[1]}-${match[2]}-${match[3]} (${dow})`
}

const EXCEL_GRADE_COLORS = {
  S: 'FF0000',
  A: '00AA55',
  B: '0070C0',
  C: 'ED7D31',
  D: '000000',
}

const excelBorderThin = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
}
const EXCEL_NUMBER_HEADERS = ['가중분', '취급/분', '한익/분']

function getExcelTextWidth(value) {
  return String(value ?? '').split('').reduce((sum, ch) => {
    return sum + (ch.charCodeAt(0) > 255 ? 2 : 1)
  }, 0)
}

function exportTeamDetailRows(rows, selectedTeam) {
  if (!rows.length) return
  const data = rows.map(row => ({
    '상태': row._status || '',
    '등급': row._gradeValue || '',
    '팀': row._teamName || '',
    '날짜': fmtDateWithDow(row.dateKey),
    '시간': fmtTime(row.timeText),
    '채널': row.channel || '',
    '카테고리': row.mdCategory || '',
    '편성코드명': row.pgmCodeName || '',
    '거래형태': row.dealTypeConverted || row.dealType || '',
    '신상품': row.newProductType || '',
    '가중분': Number(row._displayMin || 0),
    '취급/분': Number(row._salesPerMin || 0),
    '한익/분': Number(row._profitPerMin || 0),
    '메모코드': row.memoCode || '',
    '메모코드2': row.memoCode2 || '',
    '편성C': row.scheduleComment || '',
    '기타요청': row.requestNote || '',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const headers = Object.keys(data[0])
  const range = XLSX.utils.decode_range(ws['!ref'])
  const firstUnscheduledIdx = rows.findIndex(row => row._status === '미편성')

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const sourceRow = rows[r - 1]
    const isHeader = r === 0
    const isUnscheduled = sourceRow?._status === '미편성'
    const isFirstUnscheduled = r === firstUnscheduledIdx + 1
    const gradeColor = EXCEL_GRADE_COLORS[sourceRow?._gradeValue] || '000000'

    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue
      const header = headers[c]
      ws[addr].s = isHeader
        ? {
            font: { bold: true, sz: 9, color: { rgb: '000000' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } },
            alignment: { vertical: 'center', wrapText: false },
            border: excelBorderThin,
          }
        : {
            font: {
              bold: !isUnscheduled,
              sz: 9,
              color: { rgb: isUnscheduled ? '000000' : gradeColor },
            },
            fill: isUnscheduled ? { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } } : undefined,
            alignment: {
              vertical: 'center',
              horizontal: EXCEL_NUMBER_HEADERS.includes(header) ? 'right' : 'left',
              wrapText: false,
            },
            numFmt: EXCEL_NUMBER_HEADERS.includes(header) ? '#,##0' : undefined,
            border: {
              ...excelBorderThin,
              top: isFirstUnscheduled
                ? { style: 'double', color: { rgb: '000000' } }
                : excelBorderThin.top,
            },
          }
      if (EXCEL_NUMBER_HEADERS.includes(header)) {
        ws[addr].z = '#,##0'
      }
    }
  }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!cols'] = Object.keys(data[0]).map(key => ({
    wch: Math.min(60, Math.max(getExcelTextWidth(key) + 2, ...data.map(row => getExcelTextWidth(row[key]) + 2))),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '팀별상세')
  const teamName = String(selectedTeam || '전체').replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `편성현황_팀별상세_${teamName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function TeamStatusTab({ scheduledRows, unscheduledRows, perfMap, manualInputs, performanceHistoryByKey }) {
  const [selectedTeam, setSelectedTeam] = useState('전체')
  const [sort, setSort] = useState({ key: '_default', dir: 'asc' })
  const [colWidths, setColWidths] = useState(() =>
    Object.fromEntries(TEAM_DETAIL_COLS.map(col => [col.key, col.w]))
  )

  const detailRows = useMemo(() => {
    const scheduled = scheduledRows.map(item => {
      const metrics = getEffectiveMetrics(item, perfMap, manualInputs, performanceHistoryByKey)
      return {
        ...item,
        _status: '편성',
        _statusOrder: 0,
        _teamName: item._team || item.mdTeam || item.orgName || '미지정',
        _gradeValue: item._grade || getGrade(getEffectiveProfit(item, perfMap, manualInputs, performanceHistoryByKey)),
        _salesPerMin: metrics.salesPerMin,
        _profitPerMin: metrics.profitPerMin,
        _displayMin: Number(item.weightedMin || 0),
      }
    })
    const unscheduled = unscheduledRows.map(item => {
      const metrics = getEffectiveMetrics(item, perfMap, manualInputs)
      return {
        ...item,
        _status: '미편성',
        _statusOrder: 1,
        _teamName: item._team || item.mdTeam || item.team || '미지정',
        _gradeValue: item._grade || getGrade(getEffectiveProfit(item, perfMap, manualInputs)),
        _salesPerMin: metrics.salesPerMin,
        _profitPerMin: metrics.profitPerMin,
        _displayMin: Number(item.availableWeightedMin1 || 0),
      }
    })

    return [...scheduled, ...unscheduled].sort((a, b) => {
      const statusCmp = a._statusOrder - b._statusOrder
      if (statusCmp) return statusCmp
      const gradeCmp = (GRADE_ORDER[a._gradeValue] ?? 9) - (GRADE_ORDER[b._gradeValue] ?? 9)
      if (gradeCmp) return gradeCmp
      const profitCmp = (b._profitPerMin || 0) - (a._profitPerMin || 0)
      if (profitCmp) return profitCmp
      return String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko', { numeric: true })
    })
  }, [scheduledRows, unscheduledRows, perfMap, manualInputs, performanceHistoryByKey])

  const teamOptions = useMemo(() => {
    const teams = Array.from(new Set(detailRows.map(row => row._teamName).filter(Boolean)))
    teams.sort((a, b) => {
      if (a === '편성팀') return 1
      if (b === '편성팀') return -1
      return a.localeCompare(b, 'ko')
    })
    return ['전체', ...teams]
  }, [detailRows])

  const visibleRows = useMemo(() => {
    const rows = selectedTeam === '전체'
      ? detailRows
      : detailRows.filter(row => row._teamName === selectedTeam)

    const defaultSort = (a, b) => {
      const statusCmp = a._statusOrder - b._statusOrder
      if (statusCmp) return statusCmp
      const gradeCmp = (GRADE_ORDER[a._gradeValue] ?? 9) - (GRADE_ORDER[b._gradeValue] ?? 9)
      if (gradeCmp) return gradeCmp
      const profitCmp = (b._profitPerMin || 0) - (a._profitPerMin || 0)
      if (profitCmp) return profitCmp
      return String(a.pgmCodeName || '').localeCompare(String(b.pgmCodeName || ''), 'ko', { numeric: true })
    }

    if (sort.key === '_default') return [...rows].sort(defaultSort)
    const col = TEAM_DETAIL_COLS.find(c => c.key === sort.key)
    if (!col?.sort) return rows
    return [...rows].sort((a, b) => sort.dir === 'asc' ? col.sort(a, b) : col.sort(b, a))
  }, [detailRows, selectedTeam, sort])

  const summary = useMemo(() => {
    const base = {
      scheduledCount: 0,
      unscheduledCount: 0,
      weightedMin: 0,
      availableWeightedMin: 0,
      salesSum: 0,
      profitSum: 0,
      metricWeight: 0,
      grades: Object.fromEntries(GRADES.map(g => [g, 0])),
    }
    visibleRows.forEach(row => {
      if (row._status === '편성') {
        base.scheduledCount += 1
        base.weightedMin += Number(row._displayMin || 0)
        base.salesSum += Number(row._salesPerMin || 0) * Number(row._displayMin || 0)
        base.profitSum += Number(row._profitPerMin || 0) * Number(row._displayMin || 0)
        base.metricWeight += Number(row._displayMin || 0)
      } else {
        base.unscheduledCount += 1
        base.availableWeightedMin += Number(row._displayMin || 0)
      }
      base.grades[row._gradeValue] = (base.grades[row._gradeValue] || 0) + 1
    })
    return {
      ...base,
      salesAvg: base.metricWeight ? base.salesSum / base.metricWeight : 0,
      profitAvg: base.metricWeight ? base.profitSum / base.metricWeight : 0,
    }
  }, [visibleRows])

  const startColumnResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[key] || TEAM_DETAIL_COLS.find(col => col.key === key)?.w || MIN_TEAM_COL_WIDTH
    const onMove = mv => {
      const nextW = Math.max(MIN_TEAM_COL_WIDTH, startW + mv.clientX - startX)
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

  const handleSort = key => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  const tableWidth = useMemo(
    () => TEAM_DETAIL_COLS.reduce((sum, col) => sum + (colWidths[col.key] || col.w), 0),
    [colWidths]
  )

  if (!detailRows.length) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>팀별 데이터가 없습니다.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', marginBottom: 8 }}>팀 선택</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {teamOptions.map(team => {
            const active = selectedTeam === team
            const count = team === '전체' ? detailRows.length : detailRows.filter(row => row._teamName === team).length
            return (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--bg3)',
                  color: active ? '#fff' : 'var(--text2)',
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {team} <span style={{ opacity: active ? 0.9 : 0.65 }}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
          팀 요약 · {selectedTeam}
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: 920, minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>
                {['팀', '전체', '편성', '미편성', '편성 가중분', '가용 가중분', '취급/분', '한익/분', ...GRADES].map((h, idx) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: idx >= 1 ? 'right' : 'left', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text)' }}>{selectedTeam}</td>
                <td style={summaryTd}>{visibleRows.length.toLocaleString()}</td>
                <td style={summaryTd}>{summary.scheduledCount.toLocaleString()}</td>
                <td style={summaryTd}>{summary.unscheduledCount.toLocaleString()}</td>
                <td style={{ ...summaryTd, color: 'var(--accent)', fontWeight: 800 }}>{fmtNum(summary.weightedMin)}</td>
                <td style={summaryTd}>{fmtNum(summary.availableWeightedMin)}</td>
                <td style={{ ...summaryTd, color: 'var(--accent)', fontWeight: 700 }}>{fmtNum(summary.salesAvg)}</td>
                <td style={{ ...summaryTd, color: 'var(--green)', fontWeight: 700 }}>{fmtNum(summary.profitAvg)}</td>
                {GRADES.map(g => (
                  <td key={g} style={summaryTd}>
                    <span style={{ color: GRADE_META[g].color, fontWeight: 800 }}>{summary.grades[g] || '-'}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
            상세 상품 {visibleRows.length.toLocaleString()}건 · 기본 정렬: 편성/미편성 → 등급 → 한익/분 → 편성코드명
          </div>
          <button
            onClick={() => exportTeamDetailRows(visibleRows, selectedTeam)}
            disabled={!visibleRows.length}
            style={{ marginLeft: 'auto', height: 26, padding: '0 11px', borderRadius: 5, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: visibleRows.length ? 'pointer' : 'default', opacity: visibleRows.length ? 1 : 0.5 }}
          >
            Excel
          </button>
        </div>
        <div style={{ overflow: 'auto' }}>
        <table style={{ width: tableWidth, minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)', color: 'var(--text2)' }}>
              {TEAM_DETAIL_COLS.map(col => {
                const width = colWidths[col.key] || col.w
                const active = sort.key === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sort && handleSort(col.key)}
                    style={{ ...teamTh, width, minWidth: width, textAlign: col.align || 'left', color: active ? 'var(--accent)' : 'var(--text2)', cursor: col.sort ? 'pointer' : 'default', position: 'relative' }}
                  >
                    <span
                      onMouseDown={e => startColumnResize(e, col.key)}
                      onClick={e => e.stopPropagation()}
                      title="컬럼 넓이 조절"
                      style={{ position: 'absolute', top: 0, right: -7, width: 14, height: '100%', cursor: 'col-resize', zIndex: 2, display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}
                    >
                      <span style={{ width: 1, height: '100%', background: active ? 'var(--accent)' : 'var(--border2)', opacity: 0.95, pointerEvents: 'none' }} />
                    </span>
                    {col.label}{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => {
              const gradeMeta = GRADE_META[row._gradeValue] || GRADE_META.D
              const isScheduled = row._status === '편성'
              return (
                <tr key={`${row._status}-${row.uniqueKey || row.itemId || row.blockKey || idx}`} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 ? 'var(--bg3)' : 'transparent' }}>
                  <td style={teamCell}>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontWeight: 800,
                      background: isScheduled ? '#f0fdf4' : 'var(--bg4)',
                      color: isScheduled ? 'var(--green)' : 'var(--text3)',
                    }}>
                      {row._status}
                    </span>
                  </td>
                  <td style={teamCell}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: gradeMeta.bg, color: gradeMeta.color, border: `1px solid ${gradeMeta.color}40` }}>{row._gradeValue}</span>
                  </td>
                  <td style={{ ...teamCell, color: 'var(--text2)', fontWeight: 700 }}>{row._teamName}</td>
                  <td style={teamCell}>{fmtDateWithDow(row.dateKey) || '-'}</td>
                  <td style={{ ...teamCell, fontWeight: isScheduled ? 700 : 400 }}>{fmtTime(row.timeText) || '-'}</td>
                  <td style={teamCell}>{row.channel || '-'}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)', fontSize: 11 }}>{row.mdCategory || '-'}</td>
                  <td style={{ ...teamCell, fontWeight: 700, color: 'var(--text)' }}>{row.pgmCodeName || '-'}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)' }}>{row.dealTypeConverted || row.dealType || '-'}</td>
                  <td style={teamCell}>{row.newProductType || '-'}</td>
                  <td style={{ ...teamCell, ...teamNum, color: 'var(--accent)', fontWeight: 800 }}>{fmtNum(row._displayMin)}</td>
                  <td style={{ ...teamCell, ...teamNum, color: 'var(--accent)', fontWeight: 700 }}>{fmtNum(row._salesPerMin)}</td>
                  <td style={{ ...teamCell, ...teamNum, color: 'var(--green)', fontWeight: 700 }}>{fmtNum(row._profitPerMin)}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)' }}>{row.memoCode || '-'}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)' }}>{row.memoCode2 || '-'}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)' }}>{row.scheduleComment || '-'}</td>
                  <td style={{ ...teamCell, color: 'var(--text3)' }}>{row.requestNote || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

const teamTh = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
}

const teamCell = {
  padding: '7px 12px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
}

const teamNum = {
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const summaryTd = {
  padding: '8px 12px',
  textAlign: 'right',
  color: 'var(--text2)',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
}

// ── 원형 대 가로막대형 차트 ──────────────────────────────────────────────
function GradeDonutChart({ items, selectedGrade, onGradeSelect }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const total = items.length

  // S→A→B→C→D 순서 유지, 값 0인 등급도 포함(회색 처리)
  const gradeData = useMemo(() =>
    GRADES.map(g => ({ name: g, value: items.filter(i => i._grade === g).length, color: GRADE_META[g].color }))
  , [items])

  const filledGradeData = gradeData.filter(d => d.value > 0)

  const activeGrade = hoverIdx !== null ? filledGradeData[hoverIdx]?.name : selectedGrade

  // 팀별 집계 (가로막대용) — 건수 내림차순 상위 9
  const teamData = useMemo(() => {
    const source = activeGrade
      ? items.filter(i => i._grade === activeGrade)
      : items
    const acc = {}
    source.forEach(i => { acc[i._team] = (acc[i._team] || 0) + 1 })
    return Object.entries(acc)
      .sort((a, b) => {
        if (a[0] === '편성팀') return 1
        if (b[0] === '편성팀') return -1
        return b[1] - a[1]
      })
      .slice(0, 9)
      .map(([name, value]) => ({ name, value }))
  }, [items, activeGrade])

  const activeCnt = activeGrade ? items.filter(i => i._grade === activeGrade).length : total
  const barColor  = activeGrade ? GRADE_META[activeGrade].color : 'var(--accent)'

  const CHART_H = 240

  const renderGradeLabel = ({ x, y, name, value, percent, cx }) => {
    if (value === 0) return null
    const pct = (percent * 100).toFixed(0)
    const anchor = x > cx ? 'start' : 'end'
    return (
      <g>
        <text x={x} y={y - 4} textAnchor={anchor} fill={GRADE_META[name]?.color} fontSize={11} fontWeight={800}>{name}</text>
        <text x={x} y={y + 9}  textAnchor={anchor} fill="#888" fontSize={9}>{value}건 {pct}%</text>
      </g>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

      {/* ── 왼쪽: 도넛 원형 차트 ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <PieChart width={320} height={240}>
          <Pie data={filledGradeData} cx={150} cy={120}
            innerRadius={62} outerRadius={88}
            startAngle={90} endAngle={-270}
            dataKey="value"
            label={renderGradeLabel}
            labelLine={{ stroke: '#555', strokeWidth: 1 }}
            onMouseEnter={(_, idx) => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={(_, idx) => {
              const g = filledGradeData[idx]?.name
              onGradeSelect(selectedGrade === g ? null : g)
            }}
            isAnimationActive={false} stroke="none">
            {filledGradeData.map(d => (
              <Cell key={d.name} fill={d.color}
                opacity={selectedGrade && selectedGrade !== d.name ? 0.18 : 1}
                style={{ cursor: 'pointer', filter: selectedGrade === d.name ? `drop-shadow(0 0 4px ${d.color}88)` : 'none' }} />
            ))}
          </Pie>
        </PieChart>

        {/* 중앙 */}
        <div style={{ position: 'absolute', top: 120, left: 150, transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          {activeGrade ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 900, color: GRADE_META[activeGrade].color, lineHeight: 1 }}>{activeGrade}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{activeCnt}건</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>전체</div>
            </>
          )}
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div style={{ width: 1, height: CHART_H, background: 'var(--border)', flexShrink: 0, margin: '0 16px' }} />

      {/* ── 오른쪽: 가로 막대형 차트 ── */}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: activeGrade ? GRADE_META[activeGrade].color : 'var(--text2)' }}>
            {activeGrade ? `${activeGrade}등급` : '전체'}
          </span>
          <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>팀별 분포 ({activeCnt}건)</span>
          {!activeGrade && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>— 등급 클릭 시 해당 등급만 표시</span>}
        </div>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={teamData} layout="vertical"
            margin={{ top: 0, right: 40, left: 6, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={72}
              tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
            <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--text3)', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 등급 범례 클릭 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {GRADES.map(g => {
            const cnt = items.filter(i => i._grade === g).length
            return (
              <button key={g} onClick={() => onGradeSelect(selectedGrade === g ? null : g)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${selectedGrade === g ? GRADE_META[g].color : 'var(--border)'}`, background: selectedGrade === g ? GRADE_META[g].bg : 'transparent', transition: 'all .12s' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: GRADE_META[g].color, flexShrink: 0, display: 'inline-block', opacity: cnt > 0 ? 1 : 0.3 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cnt > 0 ? GRADE_META[g].color : 'var(--text3)' }}>{g}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{cnt}</span>
              </button>
            )
          })}
          {selectedGrade && (
            <button onClick={() => onGradeSelect(null)}
              style={{ padding: '3px 9px', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', fontSize: 10, color: 'var(--text3)' }}>
              전체 보기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default function ScheduleStatus() {
  const { scheduleBlocks, proposalItems, startDate, poolType, perfMap, performanceHistoryByKey, manualInputs, currentVersionId } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [tab, setTab]             = useState('all')
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [logs, setLogs]           = useState([])

  // 편성 블록 → 등급/팀 enrichment (경쟁 블록 제외)
  const enrichedBlocks = useMemo(() =>
    Object.values(scheduleBlocks)
      .filter(b => !b.isDefault && !b.isCompeting)
      .map(b => ({
        ...b,
        mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
        _grade: getGrade(getEffectiveProfit(b, perfMap, manualInputs, performanceHistoryByKey)),
        _team:  b.mdTeam || '미지정',
      }))
  , [scheduleBlocks, categoryMap, perfMap, performanceHistoryByKey, manualInputs])

  // 경쟁 블록은 별도 (등급 없음)
  const competingBlocks = useMemo(() =>
    Object.values(scheduleBlocks).filter(b => !b.isDefault && b.isCompeting)
  , [scheduleBlocks])

  // 미편성 아이템
  const enrichedItems = useMemo(() =>
    proposalItems.map(i => ({
      ...i,
      _grade: getGrade(getEffectiveProfit(i, perfMap, manualInputs)),
      _team:  i.mdTeam || '미지정',
    }))
  , [proposalItems, perfMap, manualInputs])

  // 전체 (편성+미편성)
  const allItems = useMemo(() => [...enrichedBlocks, ...enrichedItems], [enrichedBlocks, enrichedItems])

  // 등급 필터 적용
  const filteredBlocks = useMemo(() =>
    selectedGrade ? enrichedBlocks.filter(b => b._grade === selectedGrade) : enrichedBlocks
  , [enrichedBlocks, selectedGrade])

  const filteredItems = useMemo(() =>
    selectedGrade ? enrichedItems.filter(i => i._grade === selectedGrade) : enrichedItems
  , [enrichedItems, selectedGrade])

  // 변경이력
  useEffect(() => {
    if (!startDate) return
    get(ref(db, `sessions/${startDate}_${poolType}/logs`)).then(snap => {
      const val = snap.val() || {}
      setLogs(Object.values(val)
        .filter(log => (log?.versionId || VERSION_DRAFT) === (currentVersionId || VERSION_DRAFT))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    })
  }, [startDate, poolType, currentVersionId])

  const handleGradeSelect = g => { setSelectedGrade(prev => prev === g ? null : g) }

  const chartItems = tab === 'scheduled' ? enrichedBlocks : tab === 'unscheduled' ? enrichedItems : allItems
  const chartTitle = tab === 'scheduled' ? '편성 상품 등급 분포' : tab === 'unscheduled' ? '미편성 제안 상품 등급 분포' : '전체 상품 등급 분포'

  const btnStyle = active => ({
    padding: '5px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400,
    background: active ? 'var(--accent)' : 'var(--bg3)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? '#fff' : 'var(--text2)',
  })

  const hasGradeFilter = !!selectedGrade

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      {/* 탭 + 등급 필터 초기화 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button style={btnStyle(tab === 'all')}          onClick={() => setTab('all')}>전체 {enrichedBlocks.length + enrichedItems.length}</button>
        <button style={btnStyle(tab === 'scheduled')}    onClick={() => setTab('scheduled')}>편성완료 {enrichedBlocks.length + competingBlocks.length}</button>
        <button style={btnStyle(tab === 'unscheduled')}  onClick={() => setTab('unscheduled')}>미편성 {proposalItems.length}</button>
        <button style={btnStyle(tab === 'team')}         onClick={() => setTab('team')}>팀별</button>
        <button style={btnStyle(tab === 'logs')}         onClick={() => setTab('logs')}>변경이력 {logs.length}</button>
        {hasGradeFilter && (
          <button onClick={() => setSelectedGrade(null)}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: GRADE_META[selectedGrade].bg, border: `1px solid ${GRADE_META[selectedGrade].color}`, color: GRADE_META[selectedGrade].color, fontWeight: 700 }}>
            {selectedGrade}등급 필터 ✕
          </button>
        )}
      </div>

      {!['logs', 'team'].includes(tab) && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>{chartTitle} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>— 한계이익/가중분 기준 · 등급 클릭 시 테이블 필터</span></div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', margin: '-4px 0 10px' }}>
            등급 기준: S ≥50만 · A ≥45만 · B ≥40만 · C ≥35만 · D 미만
          </div>
          <GradeDonutChart items={chartItems} selectedGrade={selectedGrade} onGradeSelect={handleGradeSelect} />
        </div>
      )}

      {/* 테이블 */}
      {tab === 'all' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', margin: '10px 0 6px' }}>
            편성완료 {hasGradeFilter ? `(${selectedGrade}등급 ${filteredBlocks.length}건)` : `${enrichedBlocks.length}건`}
          </div>
          <StatusScheduled rows={filteredBlocks} competing={competingBlocks} perfMap={perfMap} performanceHistoryByKey={performanceHistoryByKey} manualInputs={manualInputs} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 6px' }}>
            미편성 {hasGradeFilter ? `(${selectedGrade}등급 ${filteredItems.length}건)` : `${proposalItems.length}건`}
          </div>
          <StatusUnscheduled rows={filteredItems} perfMap={perfMap} manualInputs={manualInputs} />
        </>
      )}
      {tab === 'scheduled'   && <StatusScheduled   rows={filteredBlocks} competing={competingBlocks} perfMap={perfMap} performanceHistoryByKey={performanceHistoryByKey} manualInputs={manualInputs} />}
      {tab === 'unscheduled' && <StatusUnscheduled rows={filteredItems}  perfMap={perfMap} manualInputs={manualInputs} />}
      {tab === 'team'        && <TeamStatusTab scheduledRows={filteredBlocks} unscheduledRows={filteredItems} perfMap={perfMap} performanceHistoryByKey={performanceHistoryByKey} manualInputs={manualInputs} />}
      {tab === 'logs'        && <StatusLogs logs={logs} startDate={startDate} poolType={poolType} versionId={currentVersionId} />}
    </div>
  )
}
