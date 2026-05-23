// src/pages/DraftSchedule.jsx
import { useEffect, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import ScheduleGrid from '../components/schedule/ScheduleGrid'
import Sidebar from '../components/sidebar/Sidebar'
import SetupModal from '../components/modal/SetupModal'
import { splitWeightedMin } from '../utils/weightedMin'
import { makePerfKey, normalizeDealType } from '../hooks/usePerformanceMap'
import { db, ref, get, onValue } from '../api/firebase'

export default function DraftSchedule({ setupPopup, setSetupPopup }) {
  const {
    isLoaded, isLoading, error,
    loadInitData, resetSession, saveBlock, scheduleItem,
  } = useScheduleStore()

  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 진입 시 세션 복구: localStorage → Firebase activeSession 순으로 fallback
  useEffect(() => {
    const lastKey = localStorage.getItem('lastWeekKey')
    if (lastKey) {
      if (!useScheduleStore.getState().isLoaded && !useScheduleStore.getState().isLoading) {
        const [date, pool] = lastKey.split('_')
        loadInitData(date, pool)
      }
    } else {
      // localStorage 없으면 Firebase activeSession 한 번 읽어 자동 합류
      get(ref(db, 'activeSession')).then(snap => {
        if (!snap.exists()) return
        const { weekKey, startDate: sDate, poolType: pType } = snap.val()
        const state = useScheduleStore.getState()
        if (!state.isLoaded && !state.isLoading) {
          localStorage.setItem('lastWeekKey', weekKey)
          loadInitData(sDate, pType)
        }
      })
    }
  }, [])

  // activeSession 실시간 구독: 누군가 새 편성 시작 시 모든 접속자 자동 전환
  useEffect(() => {
    let initialized = false
    const unsubscribe = onValue(ref(db, 'activeSession'), snap => {
      if (!snap.exists()) { initialized = true; return }
      const { weekKey, startDate: sDate, poolType: pType } = snap.val()

      if (!initialized) {
        initialized = true
        return // 초기 발화는 진입 useEffect에서 이미 처리
      }

      const { startDate: curDate, poolType: curPool } = useScheduleStore.getState()
      const currentKey = curDate ? `${curDate}_${curPool}` : null
      if (weekKey !== currentKey) {
        localStorage.setItem('lastWeekKey', weekKey)
        loadInitData(sDate, pType)
      }
    })
    return () => unsubscribe()
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

  const handleBlockDrop = async (slot, channel, itemId, isSplit) => {
    const { proposalItems, scheduleBlocks: currentBlocks } = useScheduleStore.getState()
    const item = proposalItems.find(p => p.itemId === itemId)
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

    if (existingBlock && !existingBlock.isDefault) {
      const brand1 = (existingBlock.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
      const brand2 = (item.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
      await saveBlock(blockKey, {
        slotId: slot.slotId, blockKey,
        dateKey: slot.dateKey, timeText: slot.timeText,
        durationMin: slot.durationMin, weightedMin: slot.weightedMin,
        channel, isCompeting: true, isPreSchedule: false,
        pgmCodeName: `[${brand1}*${brand2}]`,
        item1: {
          ...(existingBlock.itemId ? { itemId: existingBlock.itemId } : {}),
          pgmCodeName: existingBlock.pgmCodeName,
          mdTeam: existingBlock.mdTeam,
          orgName: existingBlock.orgName,
          dealType: existingBlock.dealType,
          dealTypeConverted: existingBlock.dealTypeConverted || existingBlock.dealType || '',
          ...(existingBlock.perfKey ? { perfKey: existingBlock.perfKey } : {}),
          weightedMin: existingBlock.weightedMin,
        },
        item2: {
          itemId: item.itemId,
          pgmCodeName: item.pgmCodeName,
          mdTeam: item.mdTeam,
          orgName: item.mdTeam,
          dealType: dealTypeConverted,
          dealTypeConverted,
          ...(perfKey ? { perfKey } : {}),
          weightedMin,
        },
        isDefault: false, assignedAt: Date.now(),
      })
      await scheduleItem(itemId)
      return
    }

    await saveBlock(blockKey, {
      slotId: slot.slotId, blockKey,
      dateKey: slot.dateKey, timeText: slot.timeText,
      durationMin: slot.durationMin, weightedMin,
      channel,
      itemId: item.itemId,
      pgmCodeName: item.pgmCodeName,
      pgmCode: item.pgmCode || '',
      mdTeam: item.mdTeam || '',
      orgName: item.mdTeam || '',
      dealType: dealTypeConverted,        // ← dealType에도 변환값 저장
      dealTypeConverted,                  // ← dealTypeConverted 명시적 저장
      ...(perfKey ? { perfKey } : {}),    // ← perfKey null 방지
      isDefault: false,
      assignedAt: Date.now(),
    })
    await scheduleItem(itemId)
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
    const lastKey = localStorage.getItem('lastWeekKey')
    if (lastKey) return <LoadingScreen />
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>편성 데이터가 없습니다</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>상단 메뉴 <strong style={{ color: 'var(--accent)' }}>편성 작업판 ▼</strong> → <strong style={{ color: 'var(--red)' }}>새 편성 시작</strong> 을 눌러 주세요.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100% - var(--panel-h, 0px))', overflow: 'hidden', transition: 'height .15s ease' }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <ScheduleGrid onBlockDrop={handleBlockDrop} />
      </div>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
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