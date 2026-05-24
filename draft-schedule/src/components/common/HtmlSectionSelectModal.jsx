import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import useCategoryMap from '../../hooks/useCategoryMap'
import { exportToHtmlSections } from '../../utils/exportUtils'

const SECTIONS = [
  { id: 'grid',       label: '편성표 (스케쥴 그리드)',   desc: '시간 × 날짜 편성 그리드' },
  { id: 'simulation', label: '시뮬레이션 (실적 예상값)', desc: '팀별·일자별 예상 취급고/한익' },
  { id: 'ratio',      label: '편성비중',                desc: '팀별·카테고리별 가중분 비중' },
  { id: 'status',     label: '편성현황',                desc: '편성완료·미편성 상품 목록' },
]

// onBack: HTML 버튼 누른 ExportModal로 돌아가기
// onClose: 전체 닫기
export default function HtmlSectionSelectModal({ onBack, onClose }) {
  const {
    scheduleBlocks, pgmSlots, customSlots, proposalItems,
    perfMap, manualInputs, startDate, endDate,
    weightedMinTargets, splitSlots, targetMetrics,
  } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)

  const [selected, setSelected] = useState({ grid: true, simulation: true, ratio: true, status: true })
  const toggle = id => setSelected(p => ({ ...p, [id]: !p[id] }))
  const hasAny = Object.values(selected).some(Boolean)

  const handleExport = () => {
    exportToHtmlSections(selected, {
      scheduleBlocks, pgmSlots, customSlots, proposalItems,
      perfMap, manualInputs, startDate, endDate,
      weightedMinTargets, categoryMap, splitSlots, targetMetrics,
    })
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onBack}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', minWidth: 340, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
          >←</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>HTML 내보내기</span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text2)' }}>포함할 섹션을 선택하세요</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTIONS.map(({ id, label, desc }) => (
            <div
              key={id}
              onClick={() => toggle(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 12px', borderRadius: 7,
                border: `1px solid ${selected[id] ? 'var(--accent)' : 'var(--border)'}`,
                background: selected[id] ? 'rgba(74,108,247,.06)' : 'transparent',
                transition: 'all .12s',
              }}
            >
              <input
                type="checkbox"
                checked={selected[id]}
                onChange={() => toggle(id)}
                onClick={e => e.stopPropagation()}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: selected[id] ? 700 : 400, color: selected[id] ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, lineHeight: 1.6 }}>
          ⚠ 차트·정렬·인라인 편집은 로컬 HTML에서 동작하지 않으며 표로 대체됩니다.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onBack}
            style={{ flex: 1, padding: '9px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >취소</button>
          <button
            onClick={handleExport}
            disabled={!hasAny}
            style={{ flex: 2, padding: '9px 0', background: hasAny ? 'var(--accent)' : 'var(--bg4)', border: 'none', color: hasAny ? '#fff' : 'var(--text3)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: hasAny ? 'pointer' : 'default' }}
          >HTML 다운로드</button>
        </div>
      </div>
    </div>
  )
}
