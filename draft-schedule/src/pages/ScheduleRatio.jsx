import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import useRatioStats from '../hooks/useRatioStats'
import RatioSummaryCards from '../components/ratio/RatioSummaryCards'
import RatioDonutChart, { TEAM_COLORS } from '../components/ratio/RatioDonutChart'
import RatioTable from '../components/ratio/RatioTable'
import RatioPgmCount from '../components/ratio/RatioPgmCount'

export default function ScheduleRatio() {
  const { scheduleBlocks, pgmSlots, weightedMinTargets, proposalItems, perfMap, manualInputs } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [viewType, setViewType] = useState('team')

  const enrichedBlocks = useMemo(() => {
    const result = {}
    Object.entries(scheduleBlocks).forEach(([key, block]) => {
      result[key] = { ...block, mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류' }
    })
    return result
  }, [scheduleBlocks, categoryMap])

  const stats = useRatioStats(enrichedBlocks, categoryMap, viewType)

  const totalSlotWeighted = useMemo(() =>
    pgmSlots.reduce((acc, s) => acc + (s.weightedMin || 0), 0)
  , [pgmSlots])

  const targetMap = useMemo(() => {
    const map = {}
    weightedMinTargets.forEach(t => {
      const name = (t.teamName || '').trim()
      map[name] = t.weeklyTarget
      // "영업1팀" ↔ "영업1" 양방향 등록 — GAS teamName과 block.mdTeam 접미사 불일치 대응
      const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
      map[alt] = t.weeklyTarget
    })
    return map
  }, [weightedMinTargets])

  const totalTarget = totalSlotWeighted

  const scheduledCount = useMemo(() =>
    Object.values(scheduleBlocks).filter(b => !b.isDefault).length
  , [scheduleBlocks])

  const chartData = useMemo(() =>
    Object.entries(stats.group)
      .sort((a, b) => {
        if (a[0] === '편성팀') return 1
        if (b[0] === '편성팀') return -1
        return b[1] - a[1]
      })
      .map(([name, weighted], i) => ({
        name,
        actual: Math.round(weighted),
        target: Math.round(targetMap[name] || 0),
        color: name === '편성팀' ? '#94a3b8' : name === '경쟁' ? '#dc2626' : TEAM_COLORS[i % TEAM_COLORS.length]
      }))
  , [stats.group, targetMap])

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['team', 'category'].map(v => (
          <button key={v} onClick={() => setViewType(v)} style={{
            padding: '5px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
            background: viewType === v ? 'var(--accent)' : 'var(--bg3)',
            border: '1px solid var(--border)',
            color: viewType === v ? '#fff' : 'var(--text2)',
          }}>
            {v === 'team' ? '팀별' : '카테고리별'}
          </button>
        ))}
      </div>

      <RatioSummaryCards
        stats={stats}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        scheduledCount={scheduledCount}
      />

      <RatioDonutChart chartData={chartData} />

      <RatioTable
        data={stats.group}
        groupDm={stats.groupDm}
        stats={stats}
        targetMap={targetMap}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        showTarget={viewType === 'team'}
        chartData={chartData}
      />

      <RatioPgmCount enrichedBlocks={enrichedBlocks} perfMap={perfMap} manualInputs={manualInputs} />
    </div>
  )
}