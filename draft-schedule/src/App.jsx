import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import DraftSchedule from './pages/DraftSchedule'
const PerformanceForecast = lazy(() => import('./pages/PerformanceForecast'))
const ScheduleRatio       = lazy(() => import('./pages/ScheduleRatio'))
const ScheduleStatus      = lazy(() => import('./pages/ScheduleStatus'))
const HelpPage            = lazy(() => import('./pages/HelpPage'))
import ExportModal from './components/common/ExportModal'
import ChatPanel from './components/common/ChatPanel'
import PresenceBar from './components/common/PresenceBar'
import useScheduleStore from './store/useScheduleStore'
import usePresence from './hooks/usePresence'
import { applyTheme, getStoredTheme } from './styles/theme'
import SessionSwitcher from './components/session/SessionSwitcher'
import VersionSwitcher from './components/session/VersionSwitcher'

const TABS = [
  { id: 'draft',    label: '초안 편성' },
  { id: 'forecast', label: '시뮬레이션' },
  { id: 'ratio',    label: '편성비중' },
  { id: 'status',   label: '편성현황' },
  { id: 'help',     label: '설명서' },
]

export default function App() {
  const [activeTab, setActiveTab]     = useState('draft')
  const [menuOpen, setMenuOpen]       = useState(false)
  const [setupPopup, setSetupPopup]   = useState(false)
  const [exportModal, setExportModal] = useState(false)
  const [chatOpen, setChatOpen]       = useState(false)
  const [toast, setToast]             = useState(null)
  const [theme, setTheme]             = useState(getStoredTheme())
  const menuRef = useRef(null)

  const {
    isLoaded, startDate, endDate, poolType,
    isLoadingProposals, isLoadingPerformance, isLoadingPreSchedule, isLoadingGasAll,
    refreshPerformance, refreshProposals, refreshPreSchedule, refreshAllGasData,
    lastUpdated, userName, setUserName
  } = useScheduleStore()

  // Firebase presence 등록
  usePresence()

  // 드래그 중 전역 ⊘ 커서 제거: dragover preventDefault 없는 영역에서도 move 커서 유지
  useEffect(() => {
    const prevent = e => e.preventDefault()
    const onStart = () => document.addEventListener('dragover', prevent)
    const onEnd   = () => document.removeEventListener('dragover', prevent)
    document.addEventListener('dragstart', onStart)
    document.addEventListener('dragend',   onEnd)
    return () => {
      document.removeEventListener('dragstart', onStart)
      document.removeEventListener('dragend',   onEnd)
      document.removeEventListener('dragover',  prevent)
    }
  }, [])

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
    } else if (action === 'refreshAllGas') {
      if (!window.confirm('GAS에서 전체 데이터를 재동기화합니다.\n사용자 편성 블록은 유지되며, 선편성·디폴트 블록은 최신 데이터로 덮어씁니다.\n계속하시겠습니까?')) return
      await refreshAllGasData(); showToast('GAS 전체 재동기화 완료')
    } else if (action === 'refreshPerformance') {
      await refreshPerformance(); showToast('실적DB 갱신 완료')
    } else if (action === 'refreshPreSchedule') {
      await refreshPreSchedule(); showToast('선편성정보 갱신 완료')
    } else if (action === 'refreshProposal') {
      await refreshProposals(); showToast('제안상품 갱신 완료')
    }
  }

  const handleUserConfirm = () => {
    if (!userNameInput.trim()) return alert('이름을 입력해주세요.')
    setUserName(userNameInput.trim())
    setShowUserPopup(false)
  }

  const formatUpdated = (ts) => {
    if (!ts) return '-'
    const d = new Date(ts)
    return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const isRefreshing = isLoadingProposals || isLoadingPerformance || isLoadingPreSchedule || isLoadingGasAll

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* 사용자 이름 팝업 */}
      {showUserPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 40px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>편성 작업판</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>작업 로그에 표시될 이름을 입력해주세요.</div>
            <input autoFocus value={userNameInput}
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

      {/* 네비 */}
      <nav style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', height: 44, padding: '0 16px', flexShrink: 0, zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>

        <div ref={menuRef} style={{ position: 'relative', marginRight: 24 }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            편성 작업판 <span style={{ fontSize: 10, color: 'var(--text3)' }}>▼</span>
          </button>
          {menuOpen && <NavMenu onAction={handleMenuAction} />}
        </div>

        <div style={{ display: 'flex', height: '100%' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '0 16px', height: '100%', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400
            }}>{tab.label}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isRefreshing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              {isLoadingGasAll ? 'GAS 전체 재동기화 중...' : isLoadingProposals ? '제안상품 갱신 중...' : isLoadingPreSchedule ? '선편성 갱신 중...' : '실적DB 갱신 중...'}
            </div>
          )}

          {/* 접속 현황 */}
          {isLoaded && <PresenceBar />}

          {isLoaded && <VersionSwitcher onToast={showToast} />}

          {isLoaded && lastUpdated && (
            <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8 }}>
              {lastUpdated.pgm         && <span>PGM {formatUpdated(lastUpdated.pgm)}</span>}
              {lastUpdated.proposal    && <span>제안 {formatUpdated(lastUpdated.proposal)}</span>}
              {lastUpdated.performance && <span>실적 {formatUpdated(lastUpdated.performance)}</span>}
              {lastUpdated.preSchedule && <span>선편성 {formatUpdated(lastUpdated.preSchedule)}</span>}
            </div>
          )}

          {isLoaded && (
            <SessionSwitcher currentWeekKey={`${startDate}_${poolType}`} />
          )}

          {isLoaded && (
            <button onClick={() => setExportModal(true)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
              내보내기
            </button>
          )}

          {/* 채팅 버튼 */}
          {isLoaded && (
            <button onClick={() => setChatOpen(v => !v)}
              style={{ background: chatOpen ? 'var(--accent)' : 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: chatOpen ? '#fff' : 'var(--text2)', cursor: 'pointer' }}>
              💬
            </button>
          )}

          <div onClick={() => setShowUserPopup(true)}
            style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
            👤 {userName || '미설정'}
          </div>

          <button onClick={toggleTheme}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </nav>

      {/* 페이지 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'var(--text3)' }}>로딩 중...</div>}>
          {activeTab === 'draft'    && <DraftSchedule setupPopup={setupPopup} setSetupPopup={setSetupPopup} />}
          {activeTab === 'forecast' && <PerformanceForecast />}
          {activeTab === 'ratio'    && <ScheduleRatio />}
          {activeTab === 'status'   && <ScheduleStatus />}
          {activeTab === 'help'     && <HelpPage />}
        </Suspense>
      </div>

      {exportModal  && <ExportModal onClose={() => setExportModal(false)} />}
      {chatOpen     && <ChatPanel onClose={() => setChatOpen(false)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'var(--green)' : 'var(--red)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.15)', animation: 'fadeIn .2s ease' }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function NavMenu({ onAction }) {
  const [hover, setHover] = useState(null)
  const groups = [
    { group: '초기 설정', items: [{ id: 'newSetup', label: '새 편성 시작', danger: true }] },
    { group: 'GAS 재동기화', items: [
      { id: 'refreshAllGas', label: 'GAS 전체 재동기화', warn: true },
    ]},
    { group: '개별 업데이트', items: [
      { id: 'refreshPreSchedule', label: '선편성정보 갱신' },
      { id: 'refreshProposal',    label: '제안상품 갱신' },
      { id: 'refreshPerformance', label: '실적DB 갱신' },
    ]},
  ]
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200 }}>
      {groups.map((g, gi) => (
        <div key={g.group}>
          <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>{g.group}</div>
          {g.items.map(item => (
            <button key={item.id} onClick={() => onAction(item.id)}
              onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover(null)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 16px', background: hover === item.id ? 'var(--bg3)' : 'transparent', border: 'none', color: item.danger ? 'var(--red)' : item.warn ? 'var(--orange)' : 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
              {item.label}
            </button>
          ))}
          {gi < groups.length - 1 && <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />}
        </div>
      ))}
    </div>
  )
}
