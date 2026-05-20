import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import useRatioStats from '../hooks/useRatioStats'
import RatioSummaryCards from '../components/ratio/RatioSummaryCards'
import RatioDonutChart, { TEAM_COLORS } from '../components/ratio/RatioDonutChart'
import RatioTable from '../components/ratio/RatioTable'

export default function ScheduleRatio() {
  const { scheduleBlocks, pgmSlots, weightedMinTargets, proposalItems, performanceRows } = useScheduleStore()
  const [viewMode, setViewMode] = useState('team')
  const [orgFilter, setOrgFilter] = useState('')

  const categoryMap = useCategoryMap(proposalItems, performanceRows)
  const stats = useRatioStats(scheduleBlocks, categoryMap, orgFilter)

  const totalSlotWeighted = useMemo(() => {
    return pgmSlots.reduce((acc, s) => acc + (s.weightedMin || 0), 0)
  }, [pgmSlots])

  const targetMap = useMemo(() => {
    const map = {}
    weightedMinTargets.forEach(t => {
      map[t.teamName] = t.weeklyTarget
      map[t.teamName + '팀'] = t.weeklyTarget
    })
    return map
  }, [weightedMinTargets])

  const totalTarget = useMemo(() => {
    return weightedMinTargets.reduce((acc, t) => acc + (t.weeklyTarget || 0), 0)
  }, [weightedMinTargets])

  const orgList = useMemo(() => {
    const orgs = new Set()
    Object.values(scheduleBlocks).forEach(b => { if (b && (b.mdTeam || b.orgName)) orgs.add(b.mdTeam || b.orgName) })
    return [...orgs].sort()
  }, [scheduleBlocks])

const chartData = useMemo(() => {
  return Object.entries(stats.team)
    .sort((a, b) => b[1] - a[1])
    .map(([name, weighted], i) => ({
      name,
      actual: Math.round(weighted),
      target: Math.round(targetMap[name] || 0),
      color: name === '편성팀' ? '#94a3b8' : name === '경쟁' ? '#dc2626' : TEAM_COLORS[i % TEAM_COLORS.length]
    }))
}, [stats.team, targetMap])

  const scheduledCount = Object.values(scheduleBlocks).filter(b => b && !b.isDefault && !b.isCompeting).length

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>

      <RatioSummaryCards
        stats={stats}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        scheduledCount={scheduledCount}
      />

      {viewMode === 'team' && <RatioDonutChart chartData={chartData} />}

      {/* 탭 + 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {[
          { id: 'team',     label: '팀별' },
          { id: 'category', label: '카테고리별' },
          { id: 'channel',  label: '채널별' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid',
            borderColor: viewMode === tab.id ? 'var(--accent)' : 'var(--border)',
            background: viewMode === tab.id ? 'var(--accent)' : 'var(--bg2)',
            color: viewMode === tab.id ? '#fff' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>{tab.label}</button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
            <option value="">전체 조직</option>
            {orgList.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <RatioTable
        data={viewMode === 'team' ? stats.team : viewMode === 'category' ? stats.category : stats.channel}
        stats={stats}
        targetMap={targetMap}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        showTarget={viewMode === 'team'}
        chartData={chartData}
      />
    </div>
  )
}