// src/pages/DraftSchedule.jsx
import { useEffect, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import ScheduleGrid from '../components/schedule/ScheduleGrid'
import Sidebar from '../components/sidebar/Sidebar'
import SearchPanel from '../components/schedule/SearchPanel'
import CoachMark from '../components/common/CoachMark'
import SetupModal from '../components/modal/SetupModal'
import SessionPickerScreen from '../components/session/SessionPickerScreen'
import { splitWeightedMin } from '../utils/weightedMin'
import { makePerfKey, normalizeDealType } from '../hooks/usePerformanceMap'
import { db, ref, get } from '../api/firebase'
import { getCompetitionItems, makeCompetitionBlock, toCompetitionItem } from '../utils/competition'
import { extractEntityFields, stripEntityFields } from '../utils/mergeEntity'
import useLocalStorageState from '../hooks/useLocalStorageState'

const DRAFT_COACH_STEPS = [
  { target: '[data-coach="draft-page"]', title: '초안 편성 화면', description: '이 화면은 왼쪽의 편성표와 오른쪽의 상품 풀을 오가며 초안을 만드는 작업 공간입니다. 기본 흐름은 상품을 찾고, 편성표 슬롯에 끌어놓고, 필요하면 검색과 현황으로 검증하는 방식입니다.' },
  { target: '[data-coach="draft-grid-toolbar"]', title: '편성표 도구막대', description: '현재 불러온 슬롯 수와 날짜 수를 확인하고, 팀 필터·편성표 검색·편집/뷰어 모드를 조절하는 곳입니다. 편성표를 빠르게 좁혀 보는 조종석이라고 보면 됩니다.' },
  { target: '[data-coach="draft-grid-count"]', title: '슬롯과 날짜 수', description: '현재 세션에 들어온 PGM 슬롯 개수와 날짜 수입니다. 원본 데이터가 제대로 들어왔는지 처음 확인할 때 이 숫자를 먼저 보면 좋아요.' },
  { target: '[data-coach="draft-team-filter"]', title: '팀 필터', description: '편성표에 올라간 상품 중 특정 팀만 강조해서 봅니다. 다른 팀 블록은 흐리게 처리되므로 팀별 배분이나 충돌 여부를 볼 때 유용합니다.' },
  { target: '[data-coach="draft-grid-search"]', mode: 'search', title: '편성표 검색', description: '상품명, 팀, 카테고리, 거래형태 같은 키워드로 편성표와 미편성 상품을 동시에 찾습니다. 입력하면 오른쪽에 검색 결과 패널이 열립니다.' },
  { target: '[data-coach="draft-viewer-mode"]', title: '편집/뷰어 모드', description: '편집 모드에서는 드래그와 수정이 가능하고, 뷰어 모드에서는 실수로 편성을 바꾸지 않도록 작업을 잠급니다. 검토만 할 때는 뷰어가 안전합니다.' },
  { target: '[data-coach="draft-date-header"]', title: '날짜 헤더와 날씨', description: '요일과 날짜를 기준으로 편성 열이 나뉩니다. 날씨 정보가 있으면 상단에 같이 표시되어 계절성 상품이나 외부 변수 판단에 참고할 수 있습니다.' },
  { target: '[data-coach="draft-time-axis"]', title: '시간축', description: '각 날짜의 방송 시작 시간을 보여주는 축입니다. 이 시간 영역을 우클릭하면 시간 나누기, 시간 삭제, CA/IP 분리 같은 슬롯 편집 메뉴를 사용할 수 있습니다.' },
  { target: '[data-coach="draft-schedule-body"]', title: '편성표 본문', description: '상품을 실제로 배치하는 영역입니다. 오른쪽 상품 풀에서 상품을 끌어와 슬롯에 놓으면 편성이 만들어지고, 이미 상품이 있는 슬롯에 놓으면 경쟁·교체 같은 선택 흐름이 이어집니다.' },
  { target: '[data-coach="draft-slot-row"]', title: '방송 슬롯', description: '한 줄이 하나의 방송 시간대입니다. 빈 슬롯에는 가중분이 표시되고, 상품이 들어가면 상품 블록으로 바뀝니다. CA/IP로 분리된 슬롯은 두 칸으로 나뉘어 보입니다.' },
  { target: '[data-coach="draft-sidebar"]', mode: 'sidebar', title: '상품 풀', description: '아직 편성하지 않은 제안상품 목록입니다. 여기서 상품을 잡아 편성표 슬롯으로 드래그하는 것이 초안 작성의 기본 동작입니다.' },
  { target: '[data-coach="draft-sidebar-header"]', mode: 'sidebar', title: '상품 풀 헤더', description: '현재 필터 결과 건수를 보고, 새 상품을 임시 추가하거나 하단 확장표를 열 수 있습니다. 닫기 버튼으로 상품 풀을 접어 작업 공간을 넓힐 수도 있습니다.' },
  { target: '[data-coach="draft-product-filters"]', mode: 'sidebar', title: '상품 필터', description: '키워드, 팀, 거래형태, 신상품 구분, 즐겨찾기, 정렬을 조합해 후보 상품을 좁힙니다. 제안상품이 많을수록 이 필터가 작업 속도를 크게 좌우합니다.' },
  { target: '[data-coach="draft-product-list"]', mode: 'sidebar', title: '상품 리스트', description: '필터를 통과한 상품 카드들이 쌓이는 영역입니다. 스크롤하면 더 불러오고, 편성표에서 뺀 상품을 다시 이곳으로 반환할 수도 있습니다.' },
  { target: '[data-coach="draft-product-card"]', mode: 'sidebar', title: '상품 카드', description: '상품명, 팀, 카테고리, 거래형태, 메모코드, 취급/분·한익/분 같은 핵심 정보를 압축해서 보여줍니다. 별표로 고정하고, 우클릭으로 복사·삭제도 할 수 있습니다.' },
  { target: '[data-coach="draft-sidebar-expand-button"]', mode: 'sidebar', title: '상품 풀 확장 버튼', description: '상품을 카드가 아니라 넓은 표 형태로 보고 싶을 때 여는 버튼입니다. 많은 상품을 비교하거나 여러 컬럼을 한꺼번에 확인할 때 쓰기 좋습니다.' },
  { target: '[data-coach="draft-sidebar-expanded"]', mode: 'sidebar-expanded', title: '사이드바 확장표', description: '하단에 펼쳐지는 상품 표입니다. 검색, 팀 필터, 즐겨찾기, 컬럼 정렬을 쓰면서 상품 속성을 더 촘촘하게 비교하고 일부 항목은 바로 편집할 수 있습니다.' },
  { target: '[data-coach="draft-search-panel"]', mode: 'search', title: '검색 결과 패널', description: '편성표 검색 결과를 오른쪽 패널로 요약합니다. 편성된 블록 수, 가중분 합계, 거래형태별·채널별 비중, 미편성 후보까지 한 번에 확인합니다.' },
  { target: '[data-coach="draft-search-summary"]', mode: 'search', title: '검색 요약 지표', description: '검색 조건에 걸린 편성의 가중분, 순수 방송분, 평균 가중률을 빠르게 보여줍니다. 특정 키워드가 편성표에서 얼마나 비중을 차지하는지 볼 때 좋습니다.' },
  { target: '[data-coach="draft-help-button"]', title: '초안 편성 안내 다시 보기', description: '이 버튼으로 초안 편성 투어를 언제든 다시 시작할 수 있습니다. 상단 바 투어와 별개로, 이 페이지 안의 작업 흐름만 다시 훑습니다.' },
]

export default function DraftSchedule({ setupPopup, setSetupPopup }) {
  const {
    isLoaded, isLoading, error, startDate, poolType, currentVersionId,
    loadInitData, resetSession, saveBlock, saveEntityProps, scheduleItem, returnBlockToSidebar,
    isViewerMode,
  } = useScheduleStore()

  const uiScope = `${startDate || 'no-session'}_${poolType || 'A'}_${currentVersionId || 'draft'}`
  const [sidebarOpen, setSidebarOpen] = useLocalStorageState(`pgmdr.ui.${uiScope}.draft.sidebarOpen`, true)
  const [sessionChecking, setSessionChecking] = useState(true)
  const { setGridSearch, searchPanelOpen, setSearchPanelOpen } = useScheduleStore()
  const [draftCoachOpen, setDraftCoachOpen] = useState(false)
  const [draftCoachStep, setDraftCoachStep] = useState(0)

  // 진입 시 세션 복구: lastWeekKey 있으면 Firebase에 실제 존재하는지 먼저 확인
  useEffect(() => {
    const lastKey = localStorage.getItem('lastWeekKey')
    if (!lastKey) { setSessionChecking(false); return }

    get(ref(db, `sessions/${lastKey}/gasData/meta`)).then(snap => {
      if (!snap.exists()) {
        // 세션이 삭제됐거나 없음 → lastWeekKey 제거 후 SessionPickerScreen 표시
        localStorage.removeItem('lastWeekKey')
        setSessionChecking(false)
        return
      }
      const state = useScheduleStore.getState()
      if (!state.isLoaded && !state.isLoading) {
        const [date, pool] = lastKey.split('_')
        loadInitData(date, pool)
      }
      setSessionChecking(false)
    }).catch(() => {
      localStorage.removeItem('lastWeekKey')
      setSessionChecking(false)
    })
  }, [])

  const handleSetupComplete = async (startDate, poolType) => {
    // setupPopup=true → 사용자가 명시적으로 "새 편성 시작" 선택 → Firebase 완전 삭제 후 GAS 재호출
    // !isLoaded (초기 자동 로드) → Firebase 캐시 있으면 재사용
    if (setupPopup) {
      await resetSession(startDate, poolType)
    } else {
      await loadInitData(startDate, poolType)
    }
    setSetupPopup(false)
  }

  const handleBlockDrop = async (slot, channel, itemId, isSplit, mode = 'compete', uniqueKey = '') => {
    if (useScheduleStore.getState().isViewerMode) return

    const { proposalItems, scheduleBlocks: currentBlocks } = useScheduleStore.getState()
    const { _writeLog, runUndoBatch } = useScheduleStore.getState()
    const item = proposalItems.find(p => uniqueKey ? p.uniqueKey === uniqueKey : p.itemId === itemId)
    if (!item) return

    await runUndoBatch(`상품 편성 되돌리기: ${item.pgmCodeName || item.itemId || uniqueKey}`, async () => {
    const blockKey = isSplit ? `${slot.slotId}_${channel}` : slot.slotId
    const existingBlock = currentBlocks[blockKey]

    let weightedMin = slot.weightedMin
    if (isSplit) {
      const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
      weightedMin = channel === 'CA' ? caWeighted : ipWeighted
    }

    // 항상 정규화된 값 사용 (드롭 시점 item 상태와 무관하게 일관성 보장)
    const pgmCodeName = String(item.pgmCodeName || '').trim()
    const dealTypeConverted = normalizeDealType(item.dealTypeConverted || item.dealType || '')
    const perfKey = makePerfKey(dealTypeConverted, pgmCodeName) || undefined
    // perfKey가 없으면 undefined로 두어 Firebase에 null 저장 방지

    if (existingBlock && !existingBlock.isDefault && mode === 'replace') {
      await returnBlockToSidebar(existingBlock, { skipLog: true })
    } else if (existingBlock && !existingBlock.isDefault) {
      const items = [
        ...getCompetitionItems(existingBlock),
        toCompetitionItem({ ...item, pgmCodeName, dealType: dealTypeConverted, dealTypeConverted, perfKey }, weightedMin),
      ]
      await saveBlock(blockKey, {
        ...makeCompetitionBlock({ slot, blockKey, channel, weightedMin, items }),
      })
      await scheduleItem(itemId, item.uniqueKey)
      return
    }

    const newBlock = {
      slotId: slot.slotId, blockKey,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin,
      channel,
      itemId: item.itemId,
      ...(item.uniqueKey ? { uniqueKey: item.uniqueKey } : {}),
      pgmCodeName,
      pgmCode: item.pgmCode || '',
      mdTeam: item.mdTeam || '',
      orgName: item.mdTeam || '',
      mdCategory: item.mdCategory || '',
      dealType: dealTypeConverted,
      dealTypeConverted,
      newProductType: item.newProductType || '',
      memoCode: item.memoCode || '',
      memoCodeCode: item.memoCodeCode || '',
      memoCode2: item.memoCode2 || '',
      memoCode2Code: item.memoCode2Code || '',
      scheduleComment: item.scheduleComment || '',
      requestNote: item.requestNote || '',
      ...(perfKey ? { perfKey } : {}),
      isDefault: false,
      assignedAt: Date.now(),
    }

    if (newBlock.uniqueKey) {
      await saveEntityProps(newBlock.uniqueKey, extractEntityFields(newBlock))
    }

    await saveBlock(blockKey, {
      ...stripEntityFields(newBlock, true),
      ...(existingBlock && !existingBlock.isDefault && mode === 'replace' ? { __skipLog: true } : {}),
    })
    if (existingBlock && !existingBlock.isDefault && mode === 'replace') {
      await _writeLog('편성변경', blockKey, existingBlock, newBlock, {
        scope: 'schedule',
        detail: '편성변경: 기존상품 처리: 사이드바 이동',
      })
    }
    await scheduleItem(itemId, item.uniqueKey)
    })
  }

  const openDraftCoach = () => {
    setSidebarOpen(true)
    setSearchPanelOpen(false)
    setGridSearch('')
    setDraftCoachStep(0)
    setDraftCoachOpen(true)
  }

  const closeDraftCoach = () => {
    setDraftCoachOpen(false)
    setGridSearch('')
    setSearchPanelOpen(false)
  }

  useEffect(() => {
    if (!draftCoachOpen) return
    const mode = DRAFT_COACH_STEPS[draftCoachStep]?.mode
    if (mode === 'sidebar' || mode === 'sidebar-expanded') {
      setSidebarOpen(true)
      if (useScheduleStore.getState().searchPanelOpen) setSearchPanelOpen(false)
      setGridSearch('')
    } else if (mode === 'search') {
      setSidebarOpen(true)
      setGridSearch('')
      if (!useScheduleStore.getState().searchPanelOpen) setSearchPanelOpen(true)
    } else {
      if (useScheduleStore.getState().searchPanelOpen) setSearchPanelOpen(false)
      setGridSearch('')
    }
  }, [draftCoachOpen, draftCoachStep])

  if (isLoading) return <LoadingScreen />

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ color: 'var(--red)', fontSize: 14 }}>오류: {error}</div>
    </div>
  )

  if (setupPopup) {
    return (
      <SetupModal
        isLoading={isLoading}
        error={error}
        onClose={() => setSetupPopup(false)}
        onSubmit={handleSetupComplete}
      />
    )
  }

  if (!isLoaded) {
    if (sessionChecking || isLoading) return <LoadingScreen />
    return (
      <SessionPickerScreen
        onJoin={(startDate, poolType) => {
          const weekKey = `${startDate}_${poolType}`
          localStorage.setItem('lastWeekKey', weekKey)
          loadInitData(startDate, poolType)
        }}
        onNew={() => setSetupPopup(true)}
      />
    )
  }

  return (
    <div data-coach="draft-page" style={{ display: 'flex', height: 'calc(100% - var(--panel-h, 0px))', overflow: 'hidden', transition: 'height .15s ease', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <ScheduleGrid onBlockDrop={handleBlockDrop} readOnly={isViewerMode} onOpenCoach={openDraftCoach} />
      </div>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} coachExpanded={draftCoachOpen && DRAFT_COACH_STEPS[draftCoachStep]?.mode === 'sidebar-expanded'} />
      <SearchPanel
        isOpen={searchPanelOpen}
        onToggle={() => {
          if (searchPanelOpen) setGridSearch('')
          setSearchPanelOpen(v => !v)
        }}
      />
      {draftCoachOpen && (
        <CoachMark steps={DRAFT_COACH_STEPS} stepIndex={draftCoachStep} onStepChange={setDraftCoachStep} onClose={closeDraftCoach} />
      )}
    </div>
  )
}

function LoadingScreen() {
  const steps = ['PGM 슬롯', '제안상품', '실적 DB', '선편성 정보', '목표 데이터']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(v => Math.min(v + 1, steps.length - 1)), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{steps[step]} 불러오는 중...</div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>최초 로딩 시 30~60초 소요됩니다</div>
    </div>
  )
}
