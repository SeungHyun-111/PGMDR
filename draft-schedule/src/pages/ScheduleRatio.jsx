import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import useRatioStats from '../hooks/useRatioStats'
import RatioSummaryCards from '../components/ratio/RatioSummaryCards'
import RatioDonutChart, { TEAM_COLORS } from '../components/ratio/RatioDonutChart'
import RatioTable from '../components/ratio/RatioTable'

export default function ScheduleRatio() {
  const { scheduleBlocks, pgmSlots, weightedMinTargets, proposalItems } = useScheduleStore()
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
    weightedMinTargets.forEach(t => { map[t.teamName] = t.weeklyTarget })
    return map
  }, [weightedMinTargets])

  const totalTarget = useMemo(() =>
    weightedMinTargets.reduce((acc, t) => acc + (t.weeklyTarget || 0), 0)
  , [weightedMinTargets])

  const scheduledCount = useMemo(() =>
    Object.values(scheduleBlocks).filter(b => !b.isDefault).length
  , [scheduleBlocks])

  const chartData = useMemo(() =>
    Object.entries(stats.group)
      .sort((a, b) => b[1] - a[1])
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
        stats={stats}
        targetMap={targetMap}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        showTarget={viewType === 'team'}
        chartData={chartData}
      />
    </div>
  )
}