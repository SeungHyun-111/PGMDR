import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import useCategoryMap from '../../hooks/useCategoryMap'
import { exportToExcel, exportToHTML, printSchedule } from '../../utils/exportUtils'

export default function ExportModal({ onClose }) {
  const { scheduleBlocks, proposalItems, startDate, endDate } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)

  const [filters, setFilters] = useState({
    includeDefault: false, includeMemo: true, includePerformance: false, groupBy: 'date'
  })

  const rows = Object.values(scheduleBlocks)
    .filter(b => filters.includeDefault || !b.isDefault)
    .map(block => ({ ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '' }))

  const opts = { startDate, endDate, ...filters }
  const toggle = key => setFilters(p => ({ ...p, [key]: !p[key] }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', minWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>내보내기</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{rows.length}건 · {startDate} ~ {endDate}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['includeDefault', '기본 블록 포함'],
            ['includeMemo', '메모 포함'],
            ['includePerformance', '실적 정보 포함'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={filters[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>그룹 기준</span>
          <select value={filters.groupBy} onChange={e => setFilters(p => ({ ...p, groupBy: e.target.value }))}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: 5, fontSize: 12 }}>
            <option value="date">일자별</option>
            <option value="team">팀별</option>
            <option value="category">카테고리별</option>
            <option value="channel">채널별</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={() => { printSchedule(rows, opts); onClose() }} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>인쇄</button>
          <button onClick={() => { exportToHTML(rows, opts); onClose() }} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>HTML</button>
          <button onClick={() => { exportToExcel(rows, opts); onClose() }} style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Excel</button>
        </div>
      </div>
    </div>
  )
}