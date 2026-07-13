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
import { getEffectiveBlockWeightedMin } from '../utils/weightedMin'
import { db, ref, get } from '../api/firebase'
import { VERSION_OPS, getVersionPath } from '../utils/sessionVersion'
import useLocalStorageState from '../hooks/useLocalStorageState'
import CoachMark from '../components/common/CoachMark'

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

const RATIO_COACH_STEPS = [
  {
    target: '[data-coach="ratio-page"]',
    title: '편성비중 화면',
    description: '현재 버전의 유효 편성 슬롯을 기준으로 팀별/카테고리별 가중분 비중을 보는 화면입니다. 편성표에 실제로 존재하는 슬롯만 포함하고, 삭제되었거나 현재 유효 슬롯에 없는 블록은 집계에서 빠집니다.',
  },
  {
    target: '[data-coach="ratio-view-toggle"]',
    title: '팀별 / 카테고리별 보기',
    description: '팀별은 MD팀 또는 조직명 기준으로 묶고, 카테고리별은 상품 카테고리 기준으로 묶습니다. 기본 빈 블록은 편성팀으로, 경쟁 블록은 일반 집계에서는 경쟁으로 따로 묶입니다. 카테고리가 없는 상품은 미분류로 들어갑니다.',
  },
  {
    target: '[data-coach="ratio-summary"]',
    title: '상단 요약 카드',
    description: '실제 편성 가중분은 현재 유효 슬롯에 배치된 블록의 가중분 합계입니다. 주간 슬롯 가중분은 편성 가능 슬롯 전체의 가중분이고, 전체 달성률은 실제 편성 가중분을 팀 목표 가중분 합계로 나눈 값입니다. 경쟁 가중분은 경쟁 슬롯만 따로 합산하고, 편성 완료 슬롯은 기본 빈 블록을 제외한 실제 배치 건수입니다.',
  },
  {
    target: '[data-coach="ratio-donut"]',
    title: '목표 대비 실제 비중 도넛',
    description: '바깥 원은 목표 가중분이 있는 팀들의 목표 비중, 안쪽 원은 실제 편성 비중입니다. 실제 비중에는 미편성 가중분도 별도 조각으로 포함되어 “아직 비어 있는 몫”까지 한눈에 보이게 합니다. 목표가 없는 항목은 목표 원에는 나타나지 않을 수 있습니다.',
  },
  {
    target: '[data-coach="ratio-table"]',
    title: '비중 상세 표',
    description: '가중분은 각 그룹에 배정된 편성 가중분 합계, 순수분은 원래 방송 시간 합계, 평균 가중률은 가중분 ÷ 순수분입니다. 비중은 현재 표의 전체 가중분 대비 해당 그룹의 비율이고, 괄호 안 증감값은 전주 운영확정 버전과 비교한 차이입니다.',
  },
  {
    target: '[data-coach="ratio-table"]',
    title: '목표 / 달성률 기준',
    description: '팀별 보기에서는 목표 가중분과 목표 비중, 달성률을 같이 보여줍니다. 목표는 주간 팀 목표에서 편성팀·전략상품팀 같은 제외 대상은 빼고 사용합니다. 목표가 없는 팀, 경쟁, 미편성은 달성률 계산 대상이 아니어서 “-”로 보일 수 있습니다.',
  },
  {
    target: '[data-coach="ratio-table"]',
    title: '경쟁 포함 컬럼',
    description: '일반 집계에서는 경쟁 슬롯 1개가 “경쟁” 항목으로 들어갑니다. 오른쪽의 경쟁포함 가중분/달성률은 경쟁 슬롯 안의 후보 상품들을 각 팀으로 다시 나눠 더한 참고용 수치입니다. 그래서 “실제 확정 비중”과 “경쟁까지 감안한 잠재 달성률”을 따로 비교할 수 있습니다.',
  },
  {
    target: '[data-coach="ratio-table"]',
    title: '미편성 값 포함 기준',
    description: '미편성은 실제 블록이 아니라 “주간 슬롯 가중분 - 현재 편성된 가중분”으로 계산한 남은 몫입니다. 비중 분모에는 포함되어 전체 편성 여유를 보여주지만, 순수분은 0이고 목표 달성률/PGM건수에는 포함하지 않습니다.',
  },
  {
    target: '[data-coach="ratio-table"]',
    title: '전주 비교 기준',
    description: '표의 괄호 값은 시작일 기준 7일 전의 운영확정 버전을 찾아 비교합니다. A/B 풀이 번갈아 운영될 수 있어서 반대 풀을 먼저 찾고, 없으면 같은 풀을 봅니다. 이전 운영확정 버전이 없으면 증감값은 현재값 기준으로 0처럼 보일 수 있습니다.',
  },
  {
    target: '[data-coach="ratio-pgm-count"]',
    title: 'PGM 건수 현황',
    description: '아래 PGM 건수는 기본 빈 블록을 제외한 실제 편성 상품만 세며, 채널/거래형태/영상구분별로 건수와 가중분을 보여줍니다. 실적 평균은 실적이 있는 상품의 가중분만 분모로 쓰고, 실적 미입력 상품은 건수와 가중분에는 포함되지만 평균 실적 계산에서는 빠집니다.',
  },
  {
    target: '[data-coach="ratio-help-button"]',
    title: '편성비중 안내 다시 보기',
    description: '이 빨간 도움말 버튼을 누르면 편성비중 코치마크를 다시 시작합니다. 집계 기준이 헷갈릴 때 여기서 다시 확인하면 됩니다.',
  },
]

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
    performanceHistoryByKey,
    manualInputs,
    entityProps,
    startDate,
    poolType,
    currentVersionId,
  } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const uiScope = `${startDate || 'no-session'}_${poolType || 'A'}_${currentVersionId || 'draft'}`
  const [viewType, setViewType] = useLocalStorageState(`pgmdr.ui.${uiScope}.ratio.viewType`, 'team')
  const [previousOpsVersion, setPreviousOpsVersion] = useState(null)
  const [ratioCoachOpen, setRatioCoachOpen] = useState(false)
  const [ratioCoachStep, setRatioCoachStep] = useState(0)

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
        next[key] = (next[key] || 0) + getEffectiveBlockWeightedMin({
          ...block,
          ...item,
          weightedMin: block.weightedMin || item.weightedMin || 0,
          mdTeam: team,
          orgName: team,
        })
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

  const openRatioCoach = () => {
    setRatioCoachStep(0)
    setRatioCoachOpen(true)
  }

  const closeRatioCoach = () => setRatioCoachOpen(false)

  return (
    <div data-coach="ratio-page" style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div data-coach="ratio-view-toggle" style={{ display: 'flex', gap: 8 }}>
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
        <button
          data-coach="ratio-help-button"
          onClick={openRatioCoach}
          title="편성비중 안내 다시 보기"
          aria-label="편성비중 안내 다시 보기"
          style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', cursor: 'pointer', fontSize: 12, fontWeight: 900, flexShrink: 0 }}
        >
          ?
        </button>
      </div>

      <div data-coach="ratio-summary">
        <RatioSummaryCards
          stats={stats}
          totalSlotWeighted={totalSlotWeighted}
          totalTarget={totalTarget}
          scheduledCount={scheduledCount}
        />
      </div>

      <div data-coach="ratio-donut">
        <RatioDonutChart chartData={chartData} />
      </div>

      <div data-coach="ratio-table">
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
      </div>

      <div data-coach="ratio-pgm-count">
        <RatioPgmCount enrichedBlocks={enrichedBlocks} perfMap={perfMap} performanceHistoryByKey={performanceHistoryByKey} manualInputs={manualInputs} />
      </div>

      {ratioCoachOpen && (
        <CoachMark steps={RATIO_COACH_STEPS} stepIndex={ratioCoachStep} onStepChange={setRatioCoachStep} onClose={closeRatioCoach} />
      )}
    </div>
  )
}
