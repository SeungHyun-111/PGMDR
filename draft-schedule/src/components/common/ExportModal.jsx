import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import useCategoryMap from '../../hooks/useCategoryMap'
import { exportToExcel, printSchedule } from '../../utils/exportUtils'
import HtmlSectionSelectModal from './HtmlSectionSelectModal'

export default function ExportModal({ onClose }) {
  const { scheduleBlocks, proposalItems, startDate, endDate } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [showHtmlModal, setShowHtmlModal] = useState(false)

  const rows = Object.values(scheduleBlocks)
    .filter(b => b && !b.isDefault)
    .map(block => ({ ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '' }))

  const opts = { startDate, endDate }

  if (showHtmlModal) {
    return (
      <HtmlSectionSelectModal
        onBack={() => setShowHtmlModal(false)}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', minWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>내보내기</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{rows.filter(b => !b.isDefault).length}건 · {startDate} ~ {endDate}</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={() => { printSchedule(rows, opts); onClose() }} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>인쇄</button>
          <button onClick={() => setShowHtmlModal(true)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>HTML</button>
          <button onClick={() => { exportToExcel(rows, opts); onClose() }} style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Excel</button>
        </div>
      </div>
    </div>
  )
}
