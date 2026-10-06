import { useEffect, useMemo, useState } from 'react'
import { db, ref, onValue, set, update } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'

const DEFAULT_TEAMS = ['뷰티팀', '문화서비스팀', '식품팀', '헬스푸드팀', '패션트렌드팀', '리빙팀', '가전팀']
const SECTIONS = [
  { key: 'ratio', label: '편성비중' },
  { key: 'salesPerMin', label: '분당취급고' },
  { key: 'profitPerMin', label: '분당한계이익' },
]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const OCTOBER_EXECUTION_PLAN = {
  ratio: {
    '뷰티팀': '10.6%',
    '문화서비스팀': '12.7%',
    '식품팀': '4.0%',
    '헬스푸드팀': '18.0%',
    '패션트렌드팀': '30.6%',
    '리빙팀': '11.2%',
    '가전팀': '12.9%',
  },
  salesPerMin: {
    '뷰티팀': '1.45',
    '문화서비스팀': '7.76',
    '식품팀': '2.20',
    '헬스푸드팀': '1.76',
    '패션트렌드팀': '1.70',
    '리빙팀': '1.73',
    '가전팀': '1.75',
  },
  profitPerMin: {
    '뷰티팀': '0.46',
    '문화서비스팀': '0.47',
    '식품팀': '0.40',
    '헬스푸드팀': '0.52',
    '패션트렌드팀': '0.45',
    '리빙팀': '0.46',
    '가전팀': '0.44',
  },
}

export default function ExecutionPlanPage() {
  const { userName } = useScheduleStore()
  const [plan, setPlan] = useState(() => buildEmptyPlan())

  const planPath = 'global/executionPlan'

  useEffect(() => {
    if (!planPath) return
    const unsubscribe = onValue(ref(db, planPath), snap => {
      const value = snap.exists() ? snap.val() : null
      const next = normalizePlan(value)
      setPlan(next)
      if (!value) set(ref(db, planPath), { ...next, createdAt: Date.now(), createdBy: userName || '' })
      else if (hasPlanMigrations(value)) update(ref(db, planPath), getPlanMigrationUpdates(next, value))
    })
    return () => unsubscribe()
  }, [planPath, userName])

  const teamRows = useMemo(
    () => Object.entries(plan.teams || {})
      .map(([id, team]) => ({ id, ...team }))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'ko')),
    [plan.teams]
  )

  const saveCell = async (sectionKey, teamId, month, value) => {
    if (!planPath) return
    await set(ref(db, `${planPath}/sections/${sectionKey}/values/${teamId}/month${String(month).padStart(2, '0')}`), value)
    await touchPlan(planPath, userName)
  }

  const updateCellLocal = (sectionKey, teamId, month, value) => {
    const monthKey = `month${String(month).padStart(2, '0')}`
    setPlan(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: {
          ...(prev.sections?.[sectionKey] || {}),
          values: {
            ...(prev.sections?.[sectionKey]?.values || {}),
            [teamId]: {
              ...(prev.sections?.[sectionKey]?.values?.[teamId] || {}),
              [monthKey]: value,
            },
          },
        },
      },
    }))
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', padding: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 1320 }}>
        {SECTIONS.map(section => (
          <PlanTable
            key={section.key}
            section={section}
            teams={teamRows}
            values={plan.sections?.[section.key]?.values || {}}
            onCellLocal={updateCellLocal}
            onCellSave={saveCell}
          />
        ))}
      </div>
    </div>
  )
}

function PlanTable({ section, teams, values, onCellLocal, onCellSave }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: 1280 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12 }}>
          <colgroup>
          <col style={{ width: 190 }} />
          {MONTHS.map(month => <col key={month} style={{ width: 90 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th colSpan={12} style={{ height: 30, background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }} />
            <th style={{ height: 30, background: 'var(--bg3)', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 900, whiteSpace: 'nowrap' }}>
              {section.label}
            </th>
          </tr>
          <tr>
            <th style={headerCellStyle}>구분</th>
            {MONTHS.map(month => (
              <th key={month} style={headerCellStyle}>{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map(team => (
            <tr key={`${section.key}-${team.id}`}>
              <td style={{ ...bodyCellStyle, color: 'var(--text)', fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap', padding: '0 10px' }}>
                {team.name}
              </td>
              {MONTHS.map(month => {
                const monthKey = `month${String(month).padStart(2, '0')}`
                const value = values?.[team.id]?.[monthKey] || ''
                return (
                  <td key={`${section.key}-${team.id}-${month}`} style={{ ...bodyCellStyle, padding: 0 }}>
                    <input
                      value={value}
                      onChange={e => onCellLocal(section.key, team.id, month, e.target.value)}
                      onBlur={e => onCellSave(section.key, team.id, month, e.target.value)}
                      style={cellInputStyle}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildEmptyPlan() {
  const teams = {}
  DEFAULT_TEAMS.forEach((name, order) => {
    teams[makeTeamId(name, teams)] = { name, order }
  })
  return {
    teams,
    sections: buildDefaultSections(teams),
  }
}

function normalizePlan(value) {
  if (!value) return buildEmptyPlan()
  const defaultPlan = buildEmptyPlan()
  const teams = value.teams || defaultPlan.teams
  return {
    ...defaultPlan,
    ...value,
    teams,
    sections: SECTIONS.reduce((acc, section) => ({
      ...acc,
      [section.key]: {
        values: {
          ...(buildDefaultSections(teams)[section.key]?.values || {}),
          ...(value.sections?.[section.key]?.values || {}),
        },
      },
    }), {}),
  }
}

function buildDefaultSections(teams) {
  const sections = SECTIONS.reduce((acc, section) => ({ ...acc, [section.key]: { values: {} } }), {})
  Object.entries(teams || {}).forEach(([teamId, team]) => {
    SECTIONS.forEach(section => {
      const value = OCTOBER_EXECUTION_PLAN[section.key]?.[team.name]
      if (value == null) return
      sections[section.key].values[teamId] = { month10: value }
    })
  })
  return sections
}

function hasPlanMigrations(value) {
  const teams = value?.teams || buildEmptyPlan().teams
  return Object.entries(teams).some(([, team]) => team?.name === '서비스팀')
    || Object.entries(teams).some(([teamId, team]) =>
    SECTIONS.some(section => {
      const expected = OCTOBER_EXECUTION_PLAN[section.key]?.[team.name]
      if (expected == null) return false
      return value?.sections?.[section.key]?.values?.[teamId]?.month10 == null
    })
  )
}

function getPlanMigrationUpdates(plan, rawValue) {
  const updates = {}
  Object.entries(rawValue?.teams || {}).forEach(([teamId, team]) => {
    if (team?.name === '서비스팀') updates[`teams/${teamId}/name`] = '문화서비스팀'
  })
  Object.entries(plan.teams || {}).forEach(([teamId, team]) => {
    SECTIONS.forEach(section => {
      const value = OCTOBER_EXECUTION_PLAN[section.key]?.[team.name]
      if (value == null) return
      updates[`sections/${section.key}/values/${teamId}/month10`] = value
    })
  })
  return updates
}

function makeTeamId(name, existing = {}) {
  const base = String(name || 'team')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[.#$/[\]]/g, '_')
    .replace(/_+/g, '_') || `team_${Date.now()}`
  let id = base
  let i = 2
  while (existing[id]) {
    id = `${base}_${i}`
    i += 1
  }
  return id
}

async function touchPlan(planPath, userName) {
  await update(ref(db, planPath), {
    updatedAt: Date.now(),
    updatedBy: userName || '',
  })
}

const headerCellStyle = {
  height: 32,
  padding: '6px 8px',
  background: 'var(--bg3)',
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text2)',
  fontWeight: 800,
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const bodyCellStyle = {
  height: 34,
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text2)',
  textAlign: 'right',
}

const cellInputStyle = {
  width: '100%',
  height: 34,
  boxSizing: 'border-box',
  border: 'none',
  background: 'transparent',
  color: 'var(--text2)',
  padding: '0 8px',
  outline: 'none',
  textAlign: 'right',
}
