import { useState, useRef, useEffect } from 'react'
import DraftSchedule from './pages/DraftSchedule'
import PerformanceForecast from './pages/PerformanceForecast'
import ScheduleRatio from './pages/ScheduleRatio'
import ScheduleStatus from './pages/ScheduleStatus'
import useScheduleStore from './store/useScheduleStore'
import { applyTheme, getStoredTheme } from './styles/theme'

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
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(getStoredTheme())
  const menuRef = useRef(null)

  const {
    isLoaded, startDate, endDate, poolType,
    isLoadingProposals, isLoadingPerformance,
    refreshPerformance, refreshProposals, refreshPreSchedule,
    lastUpdated, userName, setUserName
  } = useScheduleStore()

  // 사용자 이름 없으면 팝업
  const [showUserPopup, setShowUserPopup] = useState(!userName)
  const [userNameInput, setUserNameInput] = useState('')

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleMenuAction = async (action) => {
    setMenuOpen(false)
    if (action === 'newSetup') {
      setSetupPopup(true)
    } else if (action === 'refreshPerformance') {
      await refreshPerformance()
      showToast('실적DB 갱신 완료')
    } else if (action === 'refreshPreSchedule') {
      await refreshPreSchedule()
      showToast('선편성정보 갱신 완료')
    } else if (action === 'refreshProposal') {
      await refreshProposals()
      showToast('제안상품 갱신 완료')
    }
  }

  const isRefreshing = isLoadingProposals || isLoadingPerformance

  const formatUpdated = (ts) => {
    if (!ts) return '-'
    const d = new Date(ts)
    return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const handleUserConfirm = () => {
    if (!userNameInput.trim()) return alert('이름을 입력해주세요.')
    setUserName(userNameInput.trim())
    setShowUserPopup(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* 사용자 이름 입력 팝업 */}
      {showUserPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 40px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>편성 작업판</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>작업 로그에 표시될 이름을 입력해주세요.</div>
            <input
              autoFocus
              value={userNameInput}
              onChange={e => setUserNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUserConfirm()}
              placeholder="이름 입력..."
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '9px 12px', borderRadius: 6, fontSize: 13 }}
            />
            <button onClick={handleUserConfirm}
              style={{ padding: '10px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              시작
            </button>
          </div>
        </div>
      )}

      <nav style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', height: 44, padding: '0 16px', flexShrink: 0, position: 'relative', zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        <div ref={menuRef} style={{ position: 'relative', marginRight: 24 }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            편성 작업판 <span style={{ fontSize: 10, color: 'var(--text3)' }}>▼</span>
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
              <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>초기 설정</div>
              <MenuItem onClick={() => handleMenuAction('newSetup')} danger>새 편성 시작</MenuItem>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>개별 업데이트</div>
              <MenuItem onClick={() => handleMenuAction('refreshPreSchedule')}>선편성정보 갱신</MenuItem>
              <MenuItem onClick={() => handleMenuAction('refreshProposal')}>제안상품 갱신</MenuItem>
              <MenuItem onClick={() => handleMenuAction('refreshPerformance')}>실적DB 갱신</MenuItem>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', height: '100%' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '0 16px', height: '100%', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', fontWeight: activeTab === tab.id ? 600 : 400
            }}>{tab.label}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {isRefreshing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              {isLoadingProposals ? '제안상품 갱신 중...' : '실적DB 갱신 중...'}
            </div>
          )}
          {isLoaded && lastUpdated && (
            <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 10 }}>
              {lastUpdated.pgm && <span>PGM {formatUpdated(lastUpdated.pgm)}</span>}
              {lastUpdated.proposal && <span>제안 {formatUpdated(lastUpdated.proposal)}</span>}
              {lastUpdated.performance && <span>실적 {formatUpdated(lastUpdated.performance)}</span>}
              {lastUpdated.preSchedule && <span>선편성 {formatUpdated(lastUpdated.preSchedule)}</span>}
            </div>
          )}
          {isLoaded && (
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{startDate} ~ {endDate} · 풀 {poolType}</div>
          )}
          {/* 사용자 이름 */}
          <div
            onClick={() => setShowUserPopup(true)}
            style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg3)' }}
          >
            👤 {userName || '미설정'}
          </div>
          <button onClick={toggleTheme}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'draft'    && <DraftSchedule setupPopup={setupPopup} setSetupPopup={setSetupPopup} />}
        {activeTab === 'forecast' && <PerformanceForecast />}
        {activeTab === 'ratio'    && <ScheduleRatio />}
        {activeTab === 'status'   && <ScheduleStatus />}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'var(--green)' : 'var(--red)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.15)', animation: 'fadeIn .2s ease' }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function MenuItem({ onClick, children, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 16px', background: hover ? 'var(--bg3)' : 'transparent', border: 'none', color: danger ? 'var(--red)' : 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
      {children}
    </button>
  )
}