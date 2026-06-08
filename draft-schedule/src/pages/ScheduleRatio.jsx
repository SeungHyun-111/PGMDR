import { useEffect, useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import useRatioStats from '../hooks/useRatioStats'
import { getEffectivePgmSlots } from '../utils/effectiveSlots'
import RatioSummaryCards from '../components/ratio/RatioSummaryCards'
import RatioDonutChart, { TEAM_COLORS } from '../components/ratio/RatioDonutChart'
import RatioTable from '../components/ratio/RatioTable'
import RatioPgmCount from '../components/ratio/RatioPgmCount'
import { getCompetitionItems } from '../utils/competition'
import { applyEntityProps, resolveEntity } from '../utils/mergeEntity'
import { db, ref, get } from '../api/firebase'
import { VERSION_OPS, getVersionPath } from '../utils/sessionVersion'

const UNSCHEDULED_NAME = '미편성'
const DEFAULT_TEAM_NAME = '편성팀'
const COMPETING_NAME = '경쟁'
const UNCATEGORIZED_NAME = '미분류'
const EXCLUDED_TARGET_TEAMS = new Set(['편성팀', '편성', '전략상품팀', '전략상품'])
const TEAM_RATIO_ORDER = ['헬스푸드팀', '패션트렌드팀', '리빙팀', '가전팀', '뷰티팀', '문화서비스팀', '식품팀']

function getTeamAlias(name) {
  if (!name) return ''
  return name.endsWith('팀') ? name.slice(0, -1) : `${name}팀`
}

function getTeamRatioOrder(name) {
  const idx = TEAM_RATIO_ORDER.indexOf(name)
  if (idx >= 0) return idx
  const aliasIdx = TEAM_RATIO_ORDER.indexOf(getTeamAlias(name))
  return aliasIdx >= 0 ? aliasIdx : 999
}

function getPreviousWeekKeys(startDate, poolType) {
  if (!startDate || !poolType) return []
  const [year, month, day] = String(startDate).split('-').map(Number)
  if (!year || !month || !day) return []
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() - 7)
  const date = d.toISOString().slice(0, 10)
  const altPool = poolType === 'A' ? 'B' : poolType === 'B' ? 'A' : ''
  return [altPool, poolType]
    .filter(Boolean)
    .filter((pool, idx, list) => list.indexOf(pool) === idx)
    .map(pool => `${date}_${pool}`)
}

function getValidScheduleBlocks(scheduleBlocks, effectiveSlots, splitSlots) {
  const result = {}
  ;(effectiveSlots || []).forEach(slot => {
    if (splitSlots?.[slot.slotId]) {
      const caKey = `${slot.slotId}_CA`
      const ipKey = `${slot.slotId}_IP`
      if (scheduleBlocks?.[caKey]) result[caKey] = scheduleBlocks[caKey]
      if (scheduleBlocks?.[ipKey]) result[ipKey] = scheduleBlocks[ipKey]
    } else if (scheduleBlocks?.[slot.slotId]) {
      result[slot.slotId] = scheduleBlocks[slot.slotId]
    }
  })
  return result
}

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
    entityProps,
    startDate,
    poolType,
  } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [viewType, setViewType] = useState('team')
  const [previousOpsVersion, setPreviousOpsVersion] = useState(null)

  useEffect(() => {
    let cancelled = false
    const previousWeekKeys = getPreviousWeekKeys(startDate, poolType)
    if (!previousWeekKeys.length) {
      setPreviousOpsVersion(null)
      return
    }
    Promise.all(previousWeekKeys.map(weekKey => get(ref(db, getVersionPath(weekKey, VERSION_OPS))))).then(snaps => {
      if (cancelled) return
      const snap = snaps.find(s => s.exists())
      setPreviousOpsVersion(snap ? snap.val() : null)
    }).catch(() => {
      if (!cancelled) setPreviousOpsVersion(null)
    })
    return () => { cancelled = true }
  }, [startDate, poolType])

  const effectiveSlots = useMemo(
    () => getEffectivePgmSlots(pgmSlots || [], customSlots || {}),
    [pgmSlots, customSlots]
  )

  const validScheduleBlocks = useMemo(
    () => getValidScheduleBlocks(scheduleBlocks, effectiveSlots, splitSlots),
    [scheduleBlocks, effectiveSlots, splitSlots]
  )

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

  const previousEffectiveSlots = useMemo(
    () => previousOpsVersion
      ? getEffectivePgmSlots(previousOpsVersion.pgmSlots || [], previousOpsVersion.customSlots || {})
      : [],
    [previousOpsVersion]
  )

  const previousBlocks = useMemo(() => {
    if (!previousOpsVersion) return {}
    return applyEntityProps(previousOpsVersion.scheduleBlocks || {}, previousOpsVersion.entityProps || {})
  }, [previousOpsVersion])

  const previousValidScheduleBlocks = useMemo(
    () => getValidScheduleBlocks(previousBlocks, previousEffectiveSlots, previousOpsVersion?.splitSlots || {}),
    [previousBlocks, previousEffectiveSlots, previousOpsVersion]
  )

  const previousEnrichedBlocks = useMemo(() => {
    const result = {}
    Object.entries(previousValidScheduleBlocks).forEach(([key, block]) => {
      result[key] = {
        ...block,
        mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || UNCATEGORIZED_NAME,
      }
    })
    return result
  }, [previousValidScheduleBlocks, categoryMap])

  const previousStats = useRatioStats(previousEnrichedBlocks, categoryMap, viewType)

  const totalSlotWeighted = useMemo(
    () => effectiveSlots.reduce((acc, s) => acc + (s.weightedMin || 0), 0),
    [effectiveSlots]
  )

  const unscheduledWeighted = Math.max(0, totalSlotWeighted - stats.totalWeighted)
  const previousTotalSlotWeighted = useMemo(
    () => previousEffectiveSlots.reduce((acc, s) => acc + (s.weightedMin || 0), 0),
    [previousEffectiveSlots]
  )
  const previousUnscheduledWeighted = Math.max(0, previousTotalSlotWeighted - previousStats.totalWeighted)

  const ratioData = useMemo(() => {
    if (unscheduledWeighted <= 0) return stats.group
    return { ...stats.group, [UNSCHEDULED_NAME]: unscheduledWeighted }
  }, [stats.group, unscheduledWeighted])

  const previousRatioData = useMemo(() => {
    if (!previousOpsVersion) return null
    if (previousUnscheduledWeighted <= 0) return previousStats.group
    return { ...previousStats.group, [UNSCHEDULED_NAME]: previousUnscheduledWeighted }
  }, [previousOpsVersion, previousStats.group, previousUnscheduledWeighted])

  const ratioStats = useMemo(() => {
    if (unscheduledWeighted <= 0) return stats
    return {
      ...stats,
      group: ratioData,
      groupDm: { ...stats.groupDm, [UNSCHEDULED_NAME]: 0 },
      totalWeighted: stats.totalWeighted + unscheduledWeighted,
    }
  }, [stats, ratioData, unscheduledWeighted])

  const previousRatioStats = useMemo(() => {
    if (!previousOpsVersion || !previousRatioData) return null
    if (previousUnscheduledWeighted <= 0) return previousStats
    return {
      ...previousStats,
      group: previousRatioData,
      groupDm: { ...previousStats.groupDm, [UNSCHEDULED_NAME]: 0 },
      totalWeighted: previousStats.totalWeighted + previousUnscheduledWeighted,
    }
  }, [previousOpsVersion, previousRatioData, previousStats, previousUnscheduledWeighted])

  const targetTeams = useMemo(() =>
    (weightedMinTargets || [])
      .map(t => ({
        name: (t.teamName || '').trim(),
        target: Number(t.weeklyTarget || 0),
      }))
      .filter(t => t.name && !EXCLUDED_TARGET_TEAMS.has(t.name))
  , [weightedMinTargets])

  const targetMap = useMemo(() => {
    const map = {}
    targetTeams.forEach(t => {
      map[t.name] = t.target
      map[getTeamAlias(t.name)] = t.target
    })
    return map
  }, [targetTeams])

  const targetTeamNameMap = useMemo(() => {
    const map = {}
    targetTeams.forEach(({ name }) => {
      map[name] = name
      map[getTeamAlias(name)] = name
    })
    return map
  }, [targetTeams])

  const displayRatioData = useMemo(() => {
    if (viewType !== 'team') return ratioData
    const next = { ...ratioData }
    targetTeams.forEach(({ name }) => {
      const alias = getTeamAlias(name)
      if (next[name] == null && next[alias] != null) {
        next[name] = next[alias]
        delete next[alias]
      } else if (next[name] == null) {
        next[name] = 0
      }
    })
    return next
  }, [ratioData, targetTeams, viewType])

  const previousDisplayRatioData = useMemo(() => {
    if (!previousOpsVersion || !previousRatioData) return null
    if (viewType !== 'team') return previousRatioData
    const next = { ...previousRatioData }
    targetTeams.forEach(({ name }) => {
      const alias = getTeamAlias(name)
      if (next[name] == null && next[alias] != null) {
        next[name] = next[alias]
        delete next[alias]
      } else if (next[name] == null) {
        next[name] = 0
      }
    })
    return next
  }, [previousOpsVersion, previousRatioData, targetTeams, viewType])

  const displayRatioStats = useMemo(() => {
    if (viewType !== 'team') return ratioStats
    return {
      ...ratioStats,
      group: displayRatioData,
      groupDm: targetTeams.reduce((acc, { name }) => {
        const alias = getTeamAlias(name)
        if (acc[name] == null && acc[alias] != null) {
          acc[name] = acc[alias]
          delete acc[alias]
        } else if (acc[name] == null) {
          acc[name] = 0
        }
        return acc
      }, { ...ratioStats.groupDm }),
    }
  }, [displayRatioData, ratioStats, targetTeams, viewType])

  const previousDisplayRatioStats = useMemo(() => {
    if (!previousOpsVersion || !previousRatioStats || !previousDisplayRatioData) return null
    if (viewType !== 'team') return previousRatioStats
    return {
      ...previousRatioStats,
      group: previousDisplayRatioData,
      groupDm: targetTeams.reduce((acc, { name }) => {
        const alias = getTeamAlias(name)
        if (acc[name] == null && acc[alias] != null) {
          acc[name] = acc[alias]
          delete acc[alias]
        } else if (acc[name] == null) {
          acc[name] = 0
        }
        return acc
      }, { ...previousRatioStats.groupDm }),
    }
  }, [previousOpsVersion, previousRatioStats, previousDisplayRatioData, targetTeams, viewType])

  const previousComparison = useMemo(() => {
    if (!previousOpsVersion || !previousDisplayRatioStats || !previousDisplayRatioData) return null
    const total = previousDisplayRatioStats.totalWeighted || 0
    const ratioMap = {}
    Object.entries(previousDisplayRatioData).forEach(([name, weighted]) => {
      ratioMap[name] = total > 0 ? Number(weighted || 0) / total * 100 : 0
    })
    return {
      weighted: previousDisplayRatioData,
      ratio: ratioMap,
      totalWeighted: previousDisplayRatioStats.totalWeighted || 0,
    }
  }, [previousOpsVersion, previousDisplayRatioStats, previousDisplayRatioData])

  const competingIncludedData = useMemo(() => {
    if (viewType !== 'team') return null
    const next = { ...displayRatioData }
    Object.values(enrichedBlocks).forEach(block => {
      if (!block?.isCompeting) return
      const items = getCompetitionItems(block)
      items.forEach(item => {
        const resolved = resolveEntity(item, entityProps)
        const team = resolved?.mdTeam || resolved?.orgName || item?.mdTeam || item?.orgName || COMPETING_NAME
        const key = targetTeamNameMap[team] || targetTeamNameMap[getTeamAlias(team)] || team
        next[key] = (next[key] || 0) + (Number(block.weightedMin || item.weightedMin || 0))
      })
    })
    targetTeams.forEach(({ name }) => {
      if (next[name] == null) next[name] = 0
    })
    return next
  }, [displayRatioData, enrichedBlocks, entityProps, targetTeamNameMap, targetTeams, viewType])

  const totalTarget = useMemo(
    () => targetTeams.reduce((acc, t) => acc + t.target, 0),
    [targetTeams]
  )

  const scheduledCount = useMemo(
    () => Object.values(validScheduleBlocks).filter(b => !b.isDefault).length,
    [validScheduleBlocks]
  )

  const chartData = useMemo(() =>
    Object.entries(displayRatioData)
      .sort((a, b) => {
        if (viewType === 'team') {
          const order = getTeamRatioOrder(a[0]) - getTeamRatioOrder(b[0])
          if (order) return order
        }
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
  , [displayRatioData, targetMap])

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
        data={displayRatioData}
        groupDm={displayRatioStats.groupDm}
        stats={displayRatioStats}
        targetMap={targetMap}
        totalSlotWeighted={totalSlotWeighted}
        totalTarget={totalTarget}
        showTarget={viewType === 'team'}
        chartData={chartData}
        scheduledWeighted={stats.totalWeighted}
        competingIncludedData={competingIncludedData}
        previousComparison={previousComparison}
      />

      <RatioPgmCount enrichedBlocks={enrichedBlocks} perfMap={perfMap} manualInputs={manualInputs} />
    </div>
  )
}
