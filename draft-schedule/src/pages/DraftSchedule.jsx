import { useEffect, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import ScheduleGrid from '../components/schedule/ScheduleGrid'
import Sidebar from '../components/sidebar/Sidebar'
import { splitWeightedMin } from '../utils/weightedMin'

const LOADING_STEPS = [
  { key: 'pgm',         label: 'PGM 슬롯',    desc: '방송일시 및 가중분 정보' },
  { key: 'proposal',    label: '제안상품',      desc: '영업팀별 상품 제안 목록' },
  { key: 'performance', label: '실적 DB',       desc: '직전 방송 실적 데이터' },
  { key: 'preSchedule', label: '선편성 정보',   desc: '반영 확정된 편성 내역' },
  { key: 'target',      label: '목표 데이터',   desc: '분당취급고 / 분당한계이익' },
]

function LoadingScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const [dots, setDots] = useState('')
  useEffect(() => {
    const stepTimer = setInterval(() => setCurrentStep(s => s < LOADING_STEPS.length - 1 ? s + 1 : s), 1800)
    const dotTimer = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => { clearInterval(stepTimer); clearInterval(dotTimer) }
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 32 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--border)', borderTop: '3px solid var(--accent2)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{LOADING_STEPS[currentStep].label} 불러오는 중{dots}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{LOADING_STEPS[currentStep].desc}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
        {LOADING_STEPS.map((step, i) => {
          const isDone = i < currentStep
          const isActive = i === currentStep
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: isActive ? 'rgba(74,108,247,.1)' : 'transparent', border: isActive ? '1px solid rgba(74,108,247,.3)' : '1px solid transparent', transition: 'all .3s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: isDone ? 'var(--green)' : isActive ? 'var(--accent)' : 'var(--bg4)', color: isDone || isActive ? '#fff' : 'var(--text3)', transition: 'all .3s' }}>
                {isDone ? '✓' : i + 1}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? 'var(--green)' : isActive ? 'var(--text)' : 'var(--text3)', transition: 'color .3s' }}>{step.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{step.desc}</div>
              </div>
              {isActive && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent2)', animation: 'pulse 1s ease-in-out infinite' }} />}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>최초 로딩 시 약 30~60초 소요됩니다</div>
    </div>
  )
}

export default function DraftSchedule({ setupPopup, setSetupPopup }) {
  const { isLoaded, isLoading, error, loadInitData, resetSession, saveBlock, removeFromSidebar, scheduleBlocks } = useScheduleStore()
  const [startDate, setStartDate] = useState('')
  const [poolType, setPoolType] = useState('A')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const lastKey = localStorage.getItem('lastWeekKey')
    if (lastKey && !isLoaded) {
      const [date, pool] = lastKey.split('_')
      loadInitData(date, pool)
    }
  }, [])

  const { startDate: loadedDate, poolType: loadedPool } = useScheduleStore()
  useEffect(() => {
    if (isLoaded) localStorage.setItem('lastWeekKey', `${loadedDate}_${loadedPool}`)
  }, [isLoaded])

  const handleSubmit = async () => {
    if (!startDate) return alert('시작일자를 선택해주세요.')
    const d = new Date(startDate + 'T00:00:00')
    if (d.getDay() !== 1) return alert('시작일자는 반드시 월요일이어야 합니다.')
    localStorage.setItem('lastWeekKey', `${startDate}_${poolType}`)
    setSetupPopup(false)
    // 기존 세션 완전 초기화 후 새로 로드
    await resetSession(startDate, poolType)
  }

  const handleBlockDrop = (slot, channel, itemId, isSplit) => {
    const { proposalItems } = useScheduleStore.getState()
    const item = proposalItems.find(p => p.itemId === itemId)
    if (!item) return

    const blockKey = isSplit ? `${slot.slotId}_${channel}` : slot.slotId
    const existingBlock = scheduleBlocks[blockKey]

    let weightedMin = slot.weightedMin
    if (isSplit) {
      const { caWeighted, ipWeighted } = splitWeightedMin(slot.weightedMin, slot.dateKey, slot.timeText)
      weightedMin = channel === 'CA' ? caWeighted : ipWeighted
    }

    // 이미 실제 블록이 있으면 경쟁 상태
if (existingBlock && !existingBlock.isDefault) {
  const brand1 = (existingBlock.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
  const brand2 = (item.pgmCodeName || '').replace(/^\[(.+?)\].*/, '$1')
  // 경쟁 가중분 = 두 블록 합산
  const competingWeightedMin = (existingBlock.weightedMin || 0) + weightedMin
  saveBlock(blockKey, {
    slotId: slot.slotId, blockKey,
    dateKey: slot.dateKey, timeText: slot.timeText,
    durationMin: slot.durationMin,
    weightedMin: competingWeightedMin, // 합산
    channel,
    isCompeting: true,
    pgmCodeName: `[${brand1}*${brand2}]`,
    item1: { itemId: existingBlock.itemId, pgmCodeName: existingBlock.pgmCodeName, mdTeam: existingBlock.mdTeam, orgName: existingBlock.orgName, dealType: existingBlock.dealType, weightedMin: existingBlock.weightedMin },
    item2: { itemId: item.itemId, pgmCodeName: item.pgmCodeName, mdTeam: item.mdTeam, orgName: item.mdTeam, dealType: item.dealType, weightedMin },
    isDefault: false, assignedAt: Date.now()
  })
  removeFromSidebar(itemId)
  return
}
    saveBlock(blockKey, {
      slotId: slot.slotId,
      blockKey,
      dateKey: slot.dateKey,
      timeText: slot.timeText,
      durationMin: slot.durationMin,
      weightedMin,
      channel,
      itemId: item.itemId,
      pgmCodeName: item.pgmCodeName,
      pgmCode: item.pgmCode,
      mdTeam: item.mdTeam,
      orgName: item.mdTeam,
      dealType: item.dealType,
      isDefault: false,
      assignedAt: Date.now()
    })
    removeFromSidebar(itemId)
  }

  if (isLoading) return <LoadingScreen />
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ color: 'var(--red)', fontSize: 14 }}>오류: {error}</div>
    </div>
  )

  return (
    <>
      {!isLoaded ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>편성 데이터가 없습니다.</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>상단 "편성 작업판" 메뉴 → 새 편성 시작</div>
        </div>
      ) : (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <ScheduleGrid onBlockDrop={handleBlockDrop} />
          </div>
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
        </div>
      )}

      {setupPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>새 편성 시작</div>
            <div style={{ fontSize: 11, color: 'var(--yellow)', background: 'rgba(245,200,66,.08)', padding: '8px 12px', borderRadius: 6 }}>
              ⚠ 기존 편성 작업 데이터가 초기화됩니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>시작일자 (월요일)</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>풀 선택</label>
              <select value={poolType} onChange={e => setPoolType(e.target.value)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}>
                <option value="A">풀 A</option>
                <option value="B">풀 B</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSetupPopup(false)} style={{ flex: 1, padding: '10px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>취소</button>
              <button onClick={handleSubmit} style={{ flex: 2, padding: '10px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>불러오기</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}