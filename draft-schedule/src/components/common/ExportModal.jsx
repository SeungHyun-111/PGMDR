import { useEffect, useRef, useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import useCategoryMap from '../../hooks/useCategoryMap'
import { exportToExcel, printReportSchedule, printSchedule } from '../../utils/exportUtils'
import HtmlSectionSelectModal from './HtmlSectionSelectModal'
import useMemoCodes from '../../hooks/useMemoCodes'

export default function ExportModal({ onClose }) {
  const { scheduleBlocks, proposalItems, startDate, endDate, pgmSlots, customSlots, splitSlots, perfMap, entityProps } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const { allMemoCodes } = useMemoCodes()
  const [showHtmlModal, setShowHtmlModal] = useState(false)
  const [showPrintSelect, setShowPrintSelect] = useState(false)
  const [showExcelSelect, setShowExcelSelect] = useState(false)
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [profitThreshold, setProfitThreshold] = useState('')
  const thresholdInputRef = useRef(null)

  useEffect(() => {
    if (showReportOptions) setTimeout(() => thresholdInputRef.current?.focus(), 0)
  }, [showReportOptions])

  const rows = Object.values(scheduleBlocks)
    .filter(b => b && !b.isDefault)
    .map(block => ({ ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '' }))

  const opts = { startDate, endDate, scheduleBlocks, pgmSlots: pgmSlots || [], customSlots: customSlots || {}, splitSlots: splitSlots || {}, categoryMap, perfMap: perfMap || {}, entityProps: entityProps || {}, memoCodes: allMemoCodes || [] }
  const parseThreshold = value => {
    const n = Number(String(value || '').replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const thresholdDigits = String(profitThreshold || '').replace(/[^\d]/g, '').slice(0, 6)
  const thresholdSlots = thresholdDigits.padEnd(6, ' ').split('')
  const setThresholdDigits = value => setProfitThreshold(String(value || '').replace(/[^\d]/g, '').slice(0, 6))
  const handleReportPrint = () => {
    printReportSchedule(rows, { ...opts, profitThreshold: parseThreshold(thresholdDigits) })
    onClose()
  }
  const digitBox = (ch, key) => (
    <span
      key={key}
      style={{
        width: 34,
        height: 42,
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg2)',
        color: ch === ' ' ? 'transparent' : 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.06)',
      }}
    >
      {ch === ' ' ? '0' : ch}
    </span>
  )

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
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', minWidth: showReportOptions ? 430 : 360, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 18px 60px rgba(0,0,0,.24)' }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>{showReportOptions ? '보고용 인쇄 설정' : showPrintSelect ? '인쇄 형식 선택' : showExcelSelect ? 'Excel 형식 선택' : '내보내기'}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{rows.filter(b => !b.isDefault).length}건 · {startDate} ~ {endDate}</div>

        {showReportOptions ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>
              기준 한계이익
              <div
                onClick={() => thresholdInputRef.current?.focus()}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  padding: '14px 16px',
                  cursor: 'text',
                  background: 'var(--bg1)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <input
                  ref={thresholdInputRef}
                  value={thresholdDigits}
                  onChange={e => setThresholdDigits(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'text' }}
                />
                {thresholdSlots.slice(0, 3).map((ch, idx) => digitBox(ch, `left-${idx}`))}
                <span style={{ alignSelf: 'flex-end', padding: '0 2px 4px', color: 'var(--text2)', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>,</span>
                {thresholdSlots.slice(3, 6).map((ch, idx) => digitBox(ch, `right-${idx}`))}
              </div>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowReportOptions(false)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>뒤로</button>
              <button onClick={handleReportPrint} style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>보고용 인쇄</button>
            </div>
          </div>
        ) : showPrintSelect ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <button onClick={() => { printSchedule(rows, opts); onClose() }} style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>기본형 인쇄</button>
            <button onClick={() => setShowReportOptions(true)} style={{ padding: '10px 12px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>보고용 인쇄 A3</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPrintSelect(false)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>뒤로</button>
              <button onClick={onClose} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        ) : showExcelSelect ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <button onClick={() => { exportToExcel(rows, { ...opts, excelTarget: 'google' }); onClose() }} style={{ padding: '10px 12px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>구글용</button>
            <button onClick={() => { exportToExcel(rows, { ...opts, excelTarget: 'bo' }); onClose() }} style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>BO용</button>
            <button onClick={onClose} style={{ padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
            <button onClick={() => setShowPrintSelect(true)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>인쇄</button>
            <button onClick={() => setShowHtmlModal(true)} style={{ flex: 1, padding: '8px 0', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>HTML</button>
            <button onClick={() => setShowExcelSelect(true)} style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Excel</button>
          </div>
        )}
      </div>
    </div>
  )
}
