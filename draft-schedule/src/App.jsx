import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import DraftSchedule from './pages/DraftSchedule'
const PerformanceForecast = lazy(() => import('./pages/PerformanceForecast'))
const ScheduleRatio       = lazy(() => import('./pages/ScheduleRatio'))
const ScheduleStatus      = lazy(() => import('./pages/ScheduleStatus'))
const SettingsPage        = lazy(() => import('./pages/SettingsPage'))
const HelpPage            = lazy(() => import('./pages/HelpPage'))
import ExportModal from './components/common/ExportModal'
import ChatPanel from './components/common/ChatPanel'
import PresenceBar from './components/common/PresenceBar'
import CoachMark from './components/common/CoachMark'
import useScheduleStore from './store/useScheduleStore'
import usePresence from './hooks/usePresence'
import { applyTheme, getStoredTheme } from './styles/theme'
import SessionSwitcher from './components/session/SessionSwitcher'
import VersionSwitcher from './components/session/VersionSwitcher'
import { VERSION_DRAFT, VERSION_OPS, VERSION_SALES, getVersionLabel } from './utils/sessionVersion'
import { refreshKmaWeatherIfStale } from './api/weather'

const TABS = [
  { id: 'draft',    label: '초안 편성' },
  { id: 'forecast', label: '시뮬레이션' },
  { id: 'ratio',    label: '편성비중' },
  { id: 'status',   label: '편성현황' },
  { id: 'settings', label: '설정' },
  { id: 'help',     label: '설명서' },
]

const COACH_STEPS = [
  { target: '[data-coach="workspace"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: '작업판 메뉴', description: '새 주차를 만들거나 GAS 데이터를 다시 불러오는 출발점입니다. 편성 작업의 판을 바꾸는 기능이라 상단 왼쪽에 따로 모아뒀어요.' },
  { target: '[data-coach="menu-new"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: '새 편성 시작', description: '새 기간과 풀을 선택해서 작업판을 새로 엽니다. 기존 주차를 보는 중이라도 여기서 다른 작업판을 만들 수 있어요.' },
  { target: '[data-coach="menu-refresh-all"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: 'GAS 전체 재동기화', description: 'PGM, 제안상품, 실적, 선편성 데이터를 한 번에 다시 맞춥니다. 직접 편성한 블록은 지키고 원본성 데이터만 최신으로 당겨오는 용도입니다.' },
  { target: '[data-coach="menu-refresh-pre"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: '선편성정보 갱신', description: '선편성 시트 기준으로 고정 편성 정보를 다시 불러옵니다. 이미 사용자가 넣은 상품을 덮지 않도록 분리해서 둔 갱신 버튼입니다.' },
  { target: '[data-coach="menu-refresh-proposal"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: '제안상품 갱신', description: '사이드바 상품 후보를 최신 제안상품 기준으로 다시 읽습니다. 신규 제안이 들어왔거나 상품 정보가 바뀌었을 때 씁니다.' },
  { target: '[data-coach="menu-refresh-performance"]', include: '[data-coach="menu-panel"]', mode: 'menu', title: '실적DB 갱신', description: '예상 취급액과 한계이익 계산에 쓰는 실적 기준 데이터를 다시 가져옵니다. 실적 예측 숫자가 낡아 보이면 여기부터 확인하면 됩니다.' },
  { target: '[data-coach="tabs"]', title: '화면 탭', description: '초안 편성, 실적 예측, 편성비중, 편성현황, 설정, 설명서를 오가는 자리입니다. 지금 하는 일의 성격에 맞춰 화면을 빠르게 바꿉니다.' },
  { target: '[data-coach="presence"]', mode: 'presence', title: '상황판: 접속자 상태', description: '누가 같은 주차에 들어와 있는지, 어느 탭과 어느 버전을 보고 있는지 보여줍니다. 함께 편성할 때 충돌을 줄이는 작은 관제탑 역할이에요.' },
  { target: '[data-coach="current-version"]', title: '현재 버전 안내', description: '지금 내가 보고 있는 데이터 버전입니다. 담당 작성, 영업팀 공유, 편성운영 중 어디에 서 있는지 항상 먼저 확인하세요.' },
  { target: '[data-coach="session"]', title: '섹션 선택', description: '작업 주차와 풀을 전환하는 선택 영역입니다. 다른 기간이나 A/B 풀로 넘어갈 때 여기서 작업판을 바꿉니다.' },
  { target: '[data-coach="history"]', title: '갱신 이력', description: 'PGM, 제안상품, 실적, 선편성이 언제 누구에 의해 갱신됐는지 남깁니다. 숫자가 이상할 때 “마지막으로 언제 갱신됐나”를 보는 곳입니다.' },
  { target: '[data-coach="versions"]', mode: 'version-draft', title: '버전 선택', description: '세 버전 사이를 전환합니다. 담당 작성은 초안을 만드는 곳, 영업팀 공유는 확정 전 공유본, 편성운영은 운영 시트와 맞춘 최종 기준에 가깝습니다.' },
  { target: '[data-coach="version-draft"]', mode: 'version-draft', title: '담당 작성 버전', description: '실제 편성 초안을 만지는 작업 버전입니다. 여기서 편성한 내용을 초안 확정하면 영업팀 공유본으로 복사됩니다.' },
  { target: '[data-coach="version-action"]', mode: 'version-draft', title: '초안 확정', description: '담당 작성본을 영업팀 공유본으로 발행합니다. “이 초안을 공유해도 된다”는 순간에 누르는 버튼입니다.' },
  { target: '[data-coach="version-sales"]', mode: 'version-sales', title: '영업팀 공유 버전', description: '담당자가 확정해 공유한 버전입니다. 영업팀과 검토하거나 확정 전 내용을 확인할 때 쓰는 중간 기준입니다.' },
  { target: '[data-coach="version-action"]', mode: 'version-sales', title: '편성 확정', description: '공유본을 편성 확정 흐름으로 넘기는 자리입니다. 현재는 Google 웹앱 연동 후 연결될 버튼이라, 투어에서는 기능 위치와 의미만 보여줍니다.' },
  { target: '[data-coach="version-ops"]', mode: 'version-ops', title: '편성운영 버전', description: '실제 운영 시트에서 가져온 기준 버전입니다. 초안과 운영본의 차이를 확인하거나 운영본 기준으로 현황을 볼 때 사용합니다.' },
  { target: '[data-coach="version-action"]', mode: 'version-ops', title: '버전 갱신', description: 'Google 편성운영 시트의 현재 내용을 다시 불러와 편성운영 버전을 갱신합니다. 운영본을 최신으로 맞추는 버튼입니다.' },
  { target: '[data-coach="export-button"]', mode: 'export', title: '내보내기 열기', description: '편성 결과를 Excel, HTML, 인쇄 형태로 꺼내는 입구입니다. 보고, 전달, 저장 목적에 따라 다른 형식을 고르면 됩니다.' },
  { target: '[data-coach="export-print"]', mode: 'export', title: '인쇄', description: '현재 편성표를 바로 인쇄용 화면으로 보냅니다. 기본 인쇄와 보고용 A3 인쇄 흐름으로 이어집니다.' },
  { target: '[data-coach="export-html"]', mode: 'export', title: 'HTML 내보내기', description: '편성표, 시뮬레이션, 편성비중, 편성현황을 웹 문서로 뽑습니다. 여러 사람이 열어보기 좋은 공유용 결과물입니다.' },
  { target: '[data-coach="html-sections"]', mode: 'export-html', title: 'HTML 섹션 선택', description: 'HTML에 포함할 섹션을 고릅니다. 필요한 보고 범위만 체크해서 가볍게 내보낼 수 있고, 편성표는 팀 단위로도 좁힐 수 있습니다.' },
  { target: '[data-coach="export-excel"]', mode: 'export', title: 'Excel 내보내기', description: '구글 업로드용 또는 BO용 양식으로 Excel을 만듭니다. 후속 시스템에 넣을 파일이 필요할 때 가장 자주 쓰게 될 버튼입니다.' },
  { target: '[data-coach="chat-button"]', mode: 'chat', title: '채팅 버튼', description: '같은 작업판을 보는 사람들과 바로 이야기하는 통로입니다. 편성 변경 이유나 확인 요청을 화면을 벗어나지 않고 남길 수 있어요.' },
  { target: '[data-coach="chat-panel"]', mode: 'chat', title: '팀 채팅 패널', description: '메시지 목록과 입력창이 있는 패널입니다. Enter로 전송하고, 작업 중 논의한 내용을 짧게 남기는 용도로 설계했습니다.' },
  { target: '[data-coach="profile"]', title: '내 프로필', description: '현재 작업자로 표시되는 이름입니다. 갱신 이력, 채팅, 접속자 상태에 함께 쓰이니 작업 전 이름이 맞는지 확인하면 좋습니다.' },
  { target: '[data-coach="theme"]', title: '모드 선택', description: '밝은 모드와 어두운 모드를 전환합니다. 장시간 편성할 때 눈이 편한 쪽으로 바꿔두면 꽤 체감이 납니다.' },
]

export default function App() {
  const [activeTab, setActiveTab]     = useState('draft')
  const [menuOpen, setMenuOpen]       = useState(false)
  const [setupPopup, setSetupPopup]   = useState(false)
  const [exportModal, setExportModal] = useState(false)
  const [chatOpen, setChatOpen]       = useState(false)
  const [toast, setToast]             = useState(null)
  const [theme, setTheme]             = useState(getStoredTheme())
  const [coachOpen, setCoachOpen]     = useState(false)
  const [coachStep, setCoachStep]     = useState(0)
  const [coachVersion, setCoachVersion] = useState(null)
  const [exportCoachView, setExportCoachView] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    refreshKmaWeatherIfStale().catch(error => {
      console.warn('[weather] Firebase sync failed:', error)
    })
  }, [])

  const {
    isLoaded, startDate, endDate, poolType,
    isLoadingProposals, isLoadingPerformance, isLoadingPreSchedule, isLoadingGasAll,
    refreshPerformance, refreshProposals, refreshPreSchedule, refreshAllGasData,
    lastUpdated, userName, setUserName, currentVersionId
  } = useScheduleStore()
  const { pendingUndo, requestUndo, cancelUndo, confirmUndo } = useScheduleStore()

  const closeCoach = () => {
    setCoachOpen(false)
    setCoachVersion(null)
    setExportCoachView(null)
    setMenuOpen(false)
    setExportModal(false)
    setChatOpen(false)
    localStorage.setItem('topbar-coach-seen-v1', '1')
  }

  const openCoach = () => {
    setMenuOpen(true)
    setExportModal(false)
    setChatOpen(false)
    setExportCoachView(null)
    setCoachVersion(null)
    setCoachStep(0)
    setCoachOpen(true)
  }

  // Firebase presence 등록
  usePresence(activeTab)

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

  useEffect(() => {
    const onKeyDown = e => {
      const target = e.target
      const isEditingText = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
      if (isEditingText) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        requestUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestUndo])

  const [showUserPopup, setShowUserPopup] = useState(!userName)
  const [userNameInput, setUserNameInput] = useState('')

  useEffect(() => {
    if (!showUserPopup && isLoaded && !localStorage.getItem('topbar-coach-seen-v1')) {
      const timer = setTimeout(() => openCoach(), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoaded, showUserPopup])

  useEffect(() => {
    if (!coachOpen) return
    const mode = COACH_STEPS[coachStep]?.mode
    setMenuOpen(mode === 'menu')
    setExportModal(mode === 'export' || mode === 'export-html')
    setExportCoachView(mode === 'export-html' ? 'html' : null)
    setChatOpen(mode === 'chat')
    if (mode === 'version-draft') setCoachVersion(VERSION_DRAFT)
    else if (mode === 'version-sales') setCoachVersion(VERSION_SALES)
    else if (mode === 'version-ops') setCoachVersion(VERSION_OPS)
    else setCoachVersion(null)
  }, [coachOpen, coachStep])

  useEffect(() => {
    const handler = (e) => {
      if (coachOpen) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [coachOpen])

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
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const formatUpdatedHistory = (ts, by) => `${formatUpdated(ts)} · ${by || '-'}`

  const isRefreshing = isLoadingProposals || isLoadingPerformance || isLoadingPreSchedule || isLoadingGasAll
  const currentVersionLabel = getVersionLabel(currentVersionId)
  const versionTone = currentVersionId === VERSION_SALES
    ? { bg: '#fff7ed', border: '#fdba74', color: '#c2410c' }
    : currentVersionId === VERSION_OPS
    ? { bg: '#ecfdf5', border: '#86efac', color: '#15803d' }
    : { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' }

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

        <div ref={menuRef} data-coach="workspace" style={{ position: 'relative', marginRight: 24 }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ background: 'transparent', border: 'none', fontSize: 15, fontWeight: 700, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            편성 작업판 <span style={{ fontSize: 10, color: 'var(--text3)' }}>▼</span>
          </button>
          {menuOpen && <NavMenu onAction={handleMenuAction} />}
        </div>

        <div data-coach="tabs" style={{ display: 'flex', height: '100%' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '0 16px', height: '100%', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400
            }}>{tab.label}</button>
          ))}
        </div>

        <div data-coach="utilities" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isRefreshing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              {isLoadingGasAll ? 'GAS 전체 재동기화 중...' : isLoadingProposals ? '제안상품 갱신 중...' : isLoadingPreSchedule ? '선편성 갱신 중...' : '실적DB 갱신 중...'}
            </div>
          )}

          {/* 접속 현황 */}
          {isLoaded && <PresenceBar forceOpen={coachOpen && COACH_STEPS[coachStep]?.mode === 'presence'} />}

          {isLoaded && (
            <div
              data-coach="current-version"
              title={`현재버전 : ${currentVersionLabel}`}
              style={{
                height: 26,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${versionTone.border}`,
                background: versionTone.bg,
                color: versionTone.color,
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              현재버전 : {currentVersionLabel}
            </div>
          )}

          {false && isLoaded && lastUpdated && (
            <div style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', gap: 8 }}>
              {lastUpdated.pgm         && <span>PGM {formatUpdated(lastUpdated.pgm)}</span>}
              {lastUpdated.proposal    && <span>제안 {formatUpdated(lastUpdated.proposal)}</span>}
              {lastUpdated.performance && <span>실적 {formatUpdated(lastUpdated.performance)}</span>}
              {lastUpdated.preSchedule && <span>선편성 {formatUpdated(lastUpdated.preSchedule)}</span>}
            </div>
          )}

          {isLoaded && (
            <div data-coach="session">
              <SessionSwitcher currentWeekKey={`${startDate}_${poolType}`} />
            </div>
          )}

          {isLoaded && (
            <button data-coach="export-button" onClick={() => setExportModal(true)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
              내보내기
            </button>
          )}

          {/* 채팅 버튼 */}
          {isLoaded && (
            <button data-coach="chat-button" onClick={() => setChatOpen(v => !v)}
              style={{ background: chatOpen ? 'var(--accent)' : 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: chatOpen ? '#fff' : 'var(--text2)', cursor: 'pointer' }}>
              💬
            </button>
          )}

          <div data-coach="profile" onClick={() => setShowUserPopup(true)}
            style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
            👤 {userName || '미설정'}
          </div>

          <button data-coach="theme" onClick={toggleTheme}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={openCoach} title="상단 메뉴 안내 다시 보기" aria-label="상단 메뉴 안내 다시 보기"
            style={{ width: 25, height: 25, borderRadius: '50%', border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', cursor: 'pointer', fontSize: 12, fontWeight: 900 }}>
            ?
          </button>
        </div>
      </nav>

      {isLoaded && (
        <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div data-coach="history" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: 'var(--text3)', fontSize: 10, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 900, color: 'var(--text2)' }}>갱신이력</span>
            <span>PGM {formatUpdatedHistory(lastUpdated?.pgm, lastUpdated?.pgmBy)}</span>
            <span>제안상품 {formatUpdatedHistory(lastUpdated?.proposal, lastUpdated?.proposalBy)}</span>
            <span>실적 {formatUpdatedHistory(lastUpdated?.performance, lastUpdated?.performanceBy)}</span>
            <span>선편 {formatUpdatedHistory(lastUpdated?.preSchedule, lastUpdated?.preScheduleBy)}</span>
          </div>
          <div data-coach="versions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <VersionSwitcher onToast={showToast} coachPreviewVersion={coachVersion} />
          </div>
        </div>
      )}

      {/* 페이지 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'var(--text3)' }}>로딩 중...</div>}>
          {activeTab === 'draft'    && <DraftSchedule setupPopup={setupPopup} setSetupPopup={setSetupPopup} />}
          {activeTab === 'forecast' && <PerformanceForecast />}
          {activeTab === 'ratio'    && <ScheduleRatio />}
          {activeTab === 'status'   && <ScheduleStatus />}
          {activeTab === 'settings' && <SettingsPage />}
          {activeTab === 'help'     && <HelpPage />}
        </Suspense>
      </div>

      {exportModal  && <ExportModal onClose={() => setExportModal(false)} coachView={exportCoachView} />}
      {chatOpen     && <ChatPanel onClose={() => setChatOpen(false)} />}
      {pendingUndo && (
        <UndoConfirmModal
          entry={pendingUndo}
          onCancel={cancelUndo}
          onConfirm={confirmUndo}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'var(--green)' : 'var(--red)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.15)', animation: 'fadeIn .2s ease' }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          {toast.msg}
        </div>
      )}
      {coachOpen && (
        <CoachMark steps={COACH_STEPS} stepIndex={coachStep} onStepChange={setCoachStep} onClose={closeCoach} />
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
    <div data-coach="menu-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200 }}>
      {groups.map((g, gi) => (
        <div key={g.group}>
          <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>{g.group}</div>
          {g.items.map(item => (
            <button key={item.id} onClick={() => onAction(item.id)}
              data-coach={item.id === 'newSetup' ? 'menu-new' : item.id === 'refreshAllGas' ? 'menu-refresh-all' : item.id === 'refreshPreSchedule' ? 'menu-refresh-pre' : item.id === 'refreshProposal' ? 'menu-refresh-proposal' : 'menu-refresh-performance'}
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

function UndoConfirmModal({ entry, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const changeCount = entry.changes.length
  const summaries = summarizeUndoChanges(entry.changes)
  const handleConfirm = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ width: 420, maxWidth: 'calc(100vw - 32px)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 40px rgba(0,0,0,.22)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>작업 되돌리기</div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>Ctrl+Z로 최근 작업을 이전 상태로 되돌립니다.</div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 8 }}>{entry.label || '최근 작업'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>
            이 작업에 포함된 변경 {changeCount.toLocaleString()}건을 한 번에 되돌립니다.
          </div>
          {summaries.length > 0 && (
            <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {summaries.map((summary, index) => (
                <div key={`${summary}-${index}`} style={{ display: 'flex', gap: 8, padding: '7px 10px', borderTop: index === 0 ? 'none' : '1px solid var(--border)', background: 'var(--bg3)' }}>
                  <span style={{ width: 16, flexShrink: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 800 }}>{index + 1}.</span>
                  <span style={{ minWidth: 0, fontSize: 11, color: 'var(--text2)', lineHeight: 1.45, wordBreak: 'keep-all' }}>{summary}</span>
                </div>
              ))}
              {changeCount > summaries.length && (
                <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', fontSize: 11, color: 'var(--text3)' }}>
                  외 {changeCount - summaries.length}건 더 포함
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg3)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
            확인하면 현재 버전의 데이터가 이 작업 이전 상태로 복원됩니다.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}>
          <button onClick={onCancel} disabled={busy}
            style={{ padding: '7px 13px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: busy ? 'default' : 'pointer', fontSize: 12, fontWeight: 700 }}>
            취소
          </button>
          <button onClick={handleConfirm} disabled={busy}
            style={{ padding: '7px 15px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.65 : 1, fontSize: 12, fontWeight: 800 }}>
            {busy ? '되돌리는 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

function summarizeUndoChanges(changes = []) {
  const seen = new Set()
  const summaries = []
  for (const change of changes) {
    const summary = describeUndoChange(change)
    if (!summary || seen.has(summary)) continue
    seen.add(summary)
    summaries.push(summary)
    if (summaries.length >= 5) break
  }
  return summaries
}

function describeUndoChange(change) {
  const path = change?.path || ''
  const before = change?.before
  const after = change?.after
  if (change?.description) return normalizeUndoDescription(change.description)
  if (path.includes('/scheduleBlocks/')) {
    if (before && !after) return `편성표에서 [${before.pgmCodeName || '블록'}] 제거`
    if (!before && after) return `편성표에 [${after.pgmCodeName || '블록'}] 생성`
    return `편성표 블록을 이전 상태로 복원`
  }
  if (path.includes('/proposalItems/')) {
    if (before && !after) return `사이드바 상품 [${before.pgmCodeName || '상품'}] 복원`
    if (!before && after) return `사이드바 상품 [${after.pgmCodeName || '상품'}] 생성 취소`
    return `사이드바 상품 정보를 이전 상태로 복원`
  }
  if (path.includes('/scheduledItemIds/') || path.includes('/scheduledUniqueKeys/')) return '상품의 편성 체크 상태 복원'
  if (path.includes('/splitSlots/')) return '채널 분리/합치기 상태 복원'
  if (path.includes('/customSlots/')) return '시간 슬롯 구성 복원'
  if (path.includes('/manualInputs/')) return '수기 입력값 복원'
  if (path.includes('/entityProps/')) return '상품 속성값 복원'
  if (path.includes('/starred/')) return '즐겨찾기 상태 복원'
  return '데이터를 이전 상태로 복원'
}

function normalizeUndoDescription(description) {
  return String(description)
    .replace(/^scheduleBlocks\//, '편성표 블록 복원: ')
    .replace(/^proposalItems\//, '사이드바 상품 복원: ')
    .replace(/^scheduledItemIds\//, '아이템 편성 체크 복원: ')
    .replace(/^scheduledUniqueKeys\//, '아이템 고유키 편성 체크 복원: ')
    .replace(/^splitSlots\//, '채널 분리/합치기 복원: ')
    .replace(/^customSlots\//, '시간 슬롯 복원: ')
    .replace(/^manualInputs\//, '수기 입력 복원: ')
    .replace(/^entityProps\//, '상품 속성 복원: ')
}
