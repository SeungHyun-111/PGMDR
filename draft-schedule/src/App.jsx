import { useState, useRef, useEffect } from 'react'
import DraftSchedule from './pages/DraftSchedule'
import PerformanceForecast from './pages/PerformanceForecast'
import ScheduleRatio from './pages/ScheduleRatio'
import ScheduleStatus from './pages/ScheduleStatus'
import useScheduleStore from './store/useScheduleStore'

const TABS = [
  { id: 'draft',    label: '초안 편성' },
  { id: 'forecast', label: '실적 예상값' },
  { id: 'ratio',    label: '편성비중' },
  { id: 'status',   label: '편성현황' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('draft')
  const [menuOpen, setMenuOpen] = useState(false)
  const [setupPopup, setSetupPopup] = useState(false)
  const menuRef = useRef(null)

  const { isLoaded, startDate, endDate, poolType, refreshPerformance } = useScheduleStore()

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMenuAction = (action) => {
    setMenuOpen(false)
    if (action === 'newSetup') {
      setSetupPopup(true)
    } else if (action === 'refreshPerformance') {
      refreshPerformance()
    } else if (action === 'refreshPreSchedule') {
      alert('선편성정보 갱신 (준비 중)')
    } else if (action === 'refreshProposal') {
      alert('제안상품 갱신 (준비 중)')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', height: 44, padding: '0 16px',
        flexShrink: 0, position: 'relative', zIndex: 100
      }}>

        {/* 로고 + 드롭다운 */}
        <div ref={menuRef} style={{ position: 'relative', marginRight: 24 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              background: 'transparent', border: 'none',
              fontSize: 15, fontWeight: 700, color: 'var(--accent2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            편성 작업판
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>▼</span>
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '6px 0', minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,.4)'
            }}>
              <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>
                초기 설정
              </div>
              <MenuItem onClick={() => handleMenuAction('newSetup')} danger>
                새 편성 시작
              </MenuItem>

              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

              <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>
                개별 업데이트
              </div>
              <MenuItem onClick={() => handleMenuAction('refreshPreSchedule')}>
                선편성정보 갱신
              </MenuItem>
              <MenuItem onClick={() => handleMenuAction('refreshProposal')}>
                제안상품 갱신
              </MenuItem>
              <MenuItem onClick={() => handleMenuAction('refreshPerformance')}>
                실적DB 갱신
              </MenuItem>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', height: '100%' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0 16px', height: '100%', background: 'transparent',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent2)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent2)' : 'var(--text2)',
                cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 현재 편성 주차 표시 */}
        {isLoaded && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
            {startDate} ~ {endDate} · 풀 {poolType}
          </div>
        )}
      </nav>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'draft'    && <DraftSchedule setupPopup={setupPopup} setSetupPopup={setSetupPopup} />}
        {activeTab === 'forecast' && <PerformanceForecast />}
        {activeTab === 'ratio'    && <ScheduleRatio />}
        {activeTab === 'status'   && <ScheduleStatus />}
      </div>
    </div>
  )
}

function MenuItem({ onClick, children, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 16px', background: hover ? 'var(--bg4)' : 'transparent',
        border: 'none', color: danger ? 'var(--yellow)' : 'var(--text)',
        fontSize: 12, cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}