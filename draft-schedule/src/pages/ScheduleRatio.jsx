import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import useRatioStats from '../hooks/useRatioStats'
import { getEffectivePgmSlots } from '../utils/effectiveSlots'
import RatioSummaryCards from '../components/ratio/RatioSummaryCards'
import RatioDonutChart, { TEAM_COLORS } from '../components/ratio/RatioDonutChart'
import RatioTable from '../components/ratio/RatioTable'
import RatioPgmCount from '../components/ratio/RatioPgmCount'

const UNSCHEDULED_NAME = '미편성'
const DEFAULT_TEAM_NAME = '편성팀'
const COMPETING_NAME = '경쟁'
const UNCATEGORIZED_NAME = '미분류'

export default function ScheduleRatio() {
  const {
    scheduleBlocks,
    pgmSlots,
    customSlots,
    splitSlots,
    weightedMinTargets,
    proposalItems,
    perfMap,
    manualInputs,
  } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [viewType, setViewType] = useState('team')

  const effectiveSlots = useMemo(
    () => getEffectivePgmSlots(pgmSlots || [], customSlots || {}),
    [pgmSlots, customSlots]
  )

  const validScheduleBlocks = useMemo(() => {
    const result = {}
    effectiveSlots.forEach(slot => {
      if (splitSlots?.[slot.slotId]) {
        const caKey = `${slot.slotId}_CA`
        const ipKey = `${slot.slotId}_IP`
        if (scheduleBlocks[caKey]) result[caKey] = scheduleBlocks[caKey]
        if (scheduleBlocks[ipKey]) result[ipKey] = scheduleBlocks[ipKey]
      } else if (scheduleBlocks[slot.slotId]) {
        result[slot.slotId] = scheduleBlocks[slot.slotId]
      }
    })
    return result
  }, [scheduleBlocks, effectiveSlots, splitSlots])

  const enrichedBlocks = useMemo(() => {
    const result = {}
    Object.entries(validScheduleBlocks).forEach(([key, block]) => {
      result[key] = {
        ...block,
        mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || UNCATEGORIZED_NAME,
      }
    })
    return result
  }, [validScheduleBlocks, categoryMap])

  const stats = useRatioStats(enrichedBlocks, categoryMap, viewType)

  const totalSlotWeighted = useMemo(
    () => effectiveSlots.reduce((acc, s) => acc + (s.weightedMin || 0), 0),
    [effectiveSlots]
  )

  const unscheduledWeighted = Math.max(0, totalSlotWeighted - stats.totalWeighted)

  const ratioData = useMemo(() => {
    if (unscheduledWeighted <= 0) return stats.group
    return { ...stats.group, [UNSCHEDULED_NAME]: unscheduledWeighted }
  }, [stats.group, unscheduledWeighted])

  const ratioStats = useMemo(() => {
    if (unscheduledWeighted <= 0) return stats
    return {
      ...stats,
      group: ratioData,
      groupDm: { ...stats.groupDm, [UNSCHEDULED_NAME]: 0 },
      totalWeighted: stats.totalWeighted + unscheduledWeighted,
    }
  }, [stats, ratioData, unscheduledWeighted])

  const targetMap = useMemo(() => {
    const map = {}
    weightedMinTargets.forEach(t => {
      const name = (t.teamName || '').trim()
      map[name] = t.weeklyTarget
      const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
      map[alt] = t.weeklyTarget
    })
    return map
  }, [weightedMinTargets])

  const totalTarget = totalSlotWeighted

  const scheduledCount = useMemo(
    () => Object.values(validScheduleBlocks).filter(b => !b.isDefault).length,
    [validScheduleBlocks]
  )

  const chartData = useMemo(() =>
    Object.entries(ratioData)
      .sort((a, b) => {
        if (a[0] === DEFAULT_TEAM_NAME) return 1
        if (b[0] === DEFAULT_TEAM_NAME) return -1
        if (a[0] === UNSCHEDULED_NAME) return 1
        if (b[0] === UNSCHEDULED_NAME) return -1
        return b[1] - a[1]
      })
      .map(([name, weighted], i) => ({
        name,
        actual: Math.round(weighted),
        target: Math.round(targetMap[name] || 0),
        color: name === UNSCHEDULED_NAME
          ? '#64748b'
          : name === DEFAULT_TEAM_NAME
            ? '#94a3b8'
            : name === COMPETING_NAME
              ? '#dc2626'
              : TEAM_COLORS[i % TEAM_COLORS.length],
      }))
  , [ratioData, targetMap])

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
        data={ratioData}
        groupDm={ratioStats.groupDm}
        stats={ratioStats}
        targetMap={targetMap}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        showTarget={viewType === 'team'}
        chartData={chartData}
        scheduledWeighted={stats.totalWeighted}
      />

      <RatioPgmCount enrichedBlocks={enrichedBlocks} perfMap={perfMap} manualInputs={manualInputs} />
    </div>
  )
}
