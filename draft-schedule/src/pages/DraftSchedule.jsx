// src/pages/DraftSchedule.jsx
import { useEffect, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import ScheduleGrid from '../components/schedule/ScheduleGrid'
import Sidebar from '../components/sidebar/Sidebar'
import SearchPanel from '../components/schedule/SearchPanel'
import SetupModal from '../components/modal/SetupModal'
import SessionPickerScreen from '../components/session/SessionPickerScreen'
import { splitWeightedMin } from '../utils/weightedMin'
import { makePerfKey, normalizeDealType } from '../hooks/usePerformanceMap'
import { db, ref, get } from '../api/firebase'
import { getCompetitionItems, makeCompetitionBlock, toCompetitionItem } from '../utils/competition'

export default function DraftSchedule({ setupPopup, setSetupPopup }) {
  const {
    isLoaded, isLoading, error,
    loadInitData, resetSession, saveBlock, scheduleItem, returnBlockToSidebar,
    isViewerMode,
  } = useScheduleStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessionChecking, setSessionChecking] = useState(true)
  const { setGridSearch, searchPanelOpen, setSearchPanelOpen } = useScheduleStore()

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
    const item = proposalItems.find(p => uniqueKey ? p.uniqueKey === uniqueKey : p.itemId === itemId)
    if (!item) return

    const blockKey = isSplit ? `${slot.slotId}_${channel}` : slot.slotId
    const existingBlock = currentBlocks[blockKey]

    let weightedMin = slot.weightedMin
    if (isSplit) {
      const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
      weightedMin = channel === 'CA' ? caWeighted : ipWeighted
    }

    // 항상 정규화된 값 사용 (드롭 시점 item 상태와 무관하게 일관성 보장)
    const dealTypeConverted = normalizeDealType(item.dealTypeConverted || item.dealType || '')
    const perfKey = makePerfKey(dealTypeConverted, item.pgmCodeName) || undefined
    // perfKey가 없으면 undefined로 두어 Firebase에 null 저장 방지

    if (existingBlock && !existingBlock.isDefault && mode === 'replace') {
      await returnBlockToSidebar(existingBlock)
    } else if (existingBlock && !existingBlock.isDefault) {
      const items = [
        ...getCompetitionItems(existingBlock),
        toCompetitionItem({ ...item, dealType: dealTypeConverted, dealTypeConverted, perfKey }, weightedMin),
      ]
      await saveBlock(blockKey, {
        ...makeCompetitionBlock({ slot, blockKey, channel, weightedMin, items }),
      })
      await scheduleItem(itemId, item.uniqueKey)
      return
    }

    await saveBlock(blockKey, {
      slotId: slot.slotId, blockKey,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin,
      channel,
      itemId: item.itemId,
      ...(item.uniqueKey ? { uniqueKey: item.uniqueKey } : {}),
      pgmCodeName: item.pgmCodeName,
      pgmCode: item.pgmCode || '',
      mdTeam: item.mdTeam || '',
      orgName: item.mdTeam || '',
      mdCategory: item.mdCategory || '',
      dealType: dealTypeConverted,
      dealTypeConverted,
      newProductType: item.newProductType || '',
      memoCode: item.memoCode || '',
      scheduleComment: item.scheduleComment || '',
      requestNote: item.requestNote || '',
      ...(perfKey ? { perfKey } : {}),
      isDefault: false,
      assignedAt: Date.now(),
    })
    await scheduleItem(itemId, item.uniqueKey)
  }

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
    <div style={{ display: 'flex', height: 'calc(100% - var(--panel-h, 0px))', overflow: 'hidden', transition: 'height .15s ease' }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <ScheduleGrid onBlockDrop={handleBlockDrop} readOnly={isViewerMode} />
      </div>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <SearchPanel
        isOpen={searchPanelOpen}
        onToggle={() => {
          if (searchPanelOpen) setGridSearch('')
          setSearchPanelOpen(v => !v)
        }}
      />
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
