import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import useCategoryMap from '../../hooks/useCategoryMap'
import { exportToExcel, exportToHTML, printSchedule } from '../../utils/exportUtils'

export default function ExportModal({ onClose }) {
  const { scheduleBlocks, proposalItems, performanceRows, startDate, endDate } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems, performanceRows)

  const [filters, setFilters] = useState({
    includeDefault:    false,
    includeCompeting:  true,
    includePreSchedule: true,
    onlyStarred:       false,
  })
  const { starred } = useScheduleStore()

  const getFilteredBlocks = () => {
    return Object.fromEntries(
      Object.entries(scheduleBlocks).filter(([, b]) => {
        if (!b) return false
        if (!filters.includeDefault && b.isDefault) return false
        if (!filters.includeCompeting && b.isCompeting) return false
        if (!filters.includePreSchedule && b.isPreSchedule) return false
        if (filters.onlyStarred && !starred[b.itemId]) return false
        return true
      })
    )
  }

  const handleExcel = () => {
    exportToExcel(getFilteredBlocks(), [], categoryMap)
    onClose()
  }

  const handleHTML = () => {
    exportToHTML(getFilteredBlocks(), [], categoryMap, startDate, endDate)
    onClose()
  }

  const handlePrint = () => {
    printSchedule(getFilteredBlocks(), categoryMap, startDate, endDate)
    onClose()
  }

  const chk = { accent: 'var(--accent)', cursor: 'pointer' }
  const row = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ fontSize: 14, fontWeight: 700 }}>내보내기</div>

        {/* 필터 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg3)', borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>포함 항목</div>
          {[
            { key: 'includeDefault',     label: '[편성팀] 디폴트 블록 포함' },
            { key: 'includeCompeting',   label: '경쟁 블록 포함' },
            { key: 'includePreSchedule', label: '선편성 블록 포함' },
            { key: 'onlyStarred',        label: '별표 항목만' },
          ].map(f => (
            <label key={f.key} style={{ ...row, cursor: 'pointer' }}>
              <input type="checkbox"
                checked={filters[f.key]}
                onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.checked }))}
              />
              {f.label}
            </label>
          ))}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleExcel}
            style={{ padding: '10px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            📊 Excel 내보내기 (.xlsx)
          </button>
          <button onClick={handleHTML}
            style={{ padding: '10px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            📧 HTML 내보내기 (Outlook용)
          </button>
          <button onClick={handlePrint}
            style={{ padding: '10px', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            🖨 인쇄
          </button>
        </div>

        <button onClick={onClose}
          style={{ padding: '8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          취소
        </button>
      </div>
    </div>
  )
}