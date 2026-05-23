import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from 'recharts'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'

// ── helpers ───────────────────────────────────────────────────────────────

function calcForecast(block, perfMap, manualInputs) {
  const key = block.perfKey
  const manual = key ? (manualInputs[key] || {}) : {}
  const lastPerf = key ? (perfMap[key] || null) : null

  const manualSales  = manual.expectedSalesPerWeightedMin  ?? null
  const manualProfit = manual.expectedProfitPerWeightedMin ?? null
  const salesPerMin  = manualSales  ?? lastPerf?.salesPerWeightedMin  ?? null
  const profitPerMin = manualProfit ?? lastPerf?.profitPerWeightedMin ?? null
  const wm = Number(block.weightedMin || 0)

  return {
    lastPerf,
    salesPerMin, profitPerMin,
    manualSales, manualProfit,
    expectedSales:  (salesPerMin  ?? 0) * wm,
    expectedProfit: (profitPerMin ?? 0) * wm,
    missingPerf: !lastPerf && salesPerMin == null,
    hasManual: manualSales != null || manualProfit != null,
  }
}

// targetMetrics 구조: { month, sales: [{name, isCompanyTotal, value}], profit: [...] }
// → { teamName → { salesPerMin, profitPerMin } } + companyTotal 별도 반환
function parseTargetMetrics(raw) {
  if (!raw) return { teamMap: {}, companyTotal: null }

  // GAS 실제 구조: { sales: [...], profit: [...] }
  if (raw.sales && raw.profit) {
    const salesList  = Array.isArray(raw.sales)  ? raw.sales  : []
    const profitList = Array.isArray(raw.profit) ? raw.profit : []

    const salesMap  = {}
    salesList.forEach(r => { salesMap[(r.name || '').trim()] = r.value || 0 })
    const profitMap = {}
    profitList.forEach(r => { profitMap[(r.name || '').trim()] = r.value || 0 })

    // 전사합계
    const totalSales  = salesList.find(r => r.isCompanyTotal)
    const totalProfit = profitList.find(r => r.isCompanyTotal)
    const companyTotal = (totalSales || totalProfit) ? {
      salesPerMin:  totalSales?.value  || 0,
      profitPerMin: totalProfit?.value || 0,
    } : null

    // 팀별 맵 (양방향 팀/팀명 등록)
    const teamMap = {}
    const allNames = new Set([...Object.keys(salesMap), ...Object.keys(profitMap)])
    allNames.forEach(name => {
      if (!name) return
      const entry = { salesPerMin: salesMap[name] || 0, profitPerMin: profitMap[name] || 0 }
      teamMap[name] = entry
      const alt = name.endsWith('팀') ? name.slice(0, -1) : name + '팀'
      teamMap[alt] = entry
    })

    return { teamMap, companyTotal }
  }

  return { teamMap: {}, companyTotal: null }
}

const fmt  = v => Math.round(Number(v || 0)).toLocaleString()
const fmtS = v => {
  const n = Math.round(Number(v || 0))
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
  if (n >= 10000)     return (n / 10000).toFixed(1) + '만'
  return n.toLocaleString()
}

// ── chart tooltip ─────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.18)' }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.fill || p.color, marginBottom: 2 }}>{p.name}: <strong>{Math.round(p.value || 0).toLocaleString()}</strong></div>
      ))}
    </div>
  )
}

// ── daily chart tooltip (팀별 비중+효율) ──────────────────────────────────

function DailyTeamTip({ active, payload, dailyTeamData, metric }) {
  if (!active || !payload?.length) return null
  const dateKey = payload[0]?.payload?.date
  const teamsMap = dateKey && dailyTeamData[dateKey]
  if (!teamsMap) return null
  const teams = Object.values(teamsMap).sort((a, b) =>
    metric === 'sales' ? b.salesPerMin - a.salesPerMin : b.profitPerMin - a.profitPerMin
  )
  const color = metric === 'sales' ? 'var(--accent)' : 'var(--green)'
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,.18)', minWidth: 220 }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{dateKey}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '2px 10px', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700 }}>팀</span>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'right' }}>
          {metric === 'sales' ? '취급효율' : '한익효율'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textAlign: 'right' }}>비중</span>
        {teams.map(t => (
          <>
            <span key={t.name + 'n'} style={{ color: 'var(--text2)' }}>{t.name}</span>
            <span key={t.name + 'v'} style={{ color, fontWeight: 700, textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesPerMin : t.profitPerMin).toLocaleString()}
            </span>
            <span key={t.name + 's'} style={{ color: 'var(--text3)', textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesShare : t.profitShare).toFixed(1)}%
            </span>
          </>
        ))}
      </div>
    </div>
  )
}

// ── inline edit cell ──────────────────────────────────────────────────────

function EditCell({ value, perfKey, field, onSave, dim }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const iref = useRef()

  const open = () => {
    if (!perfKey) return
    setVal(value != null ? String(Math.round(value)) : '')
    setEditing(true)
    setTimeout(() => iref.current?.select(), 0)
  }
  const commit = async () => {
    setEditing(false)
    await onSave(perfKey, field, val === '' ? null : Number(val))
  }

  if (editing) return (
    <input ref={iref} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ width: 80, background: 'var(--bg4)', border: '1px solid var(--accent)', color: 'var(--text)', padding: '2px 6px', borderRadius: 4, fontSize: 11, textAlign: 'right', outline: 'none' }}
      autoFocus
    />
  )

  const display = value != null ? fmt(value) : null
  return (
    <span onClick={open} title={perfKey ? '클릭 수정' : ''}
      style={{ display: 'inline-block', minWidth: 60, textAlign: 'right', cursor: perfKey ? 'pointer' : 'default',
        color: dim ? 'var(--text3)' : display != null ? 'var(--text)' : 'var(--text3)',
        borderBottom: perfKey ? '1px dashed var(--border)' : 'none', fontSize: 11 }}>
      {display ?? (perfKey ? '입력' : '-')}
    </span>
  )
}

// ── efficiency bar ─────────────────────────────────────────────────────────

function EffBar({ pct, color, height = 6 }) {
  const clamp = Math.min(Math.max(pct || 0, 0), 100)
  const c = clamp >= 90 ? '#16a34a' : clamp >= 65 ? '#d97706' : '#dc2626'
  return (
    <div style={{ height, background: 'var(--bg4)', borderRadius: height / 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${clamp}%`, height: '100%', background: color || c, borderRadius: height / 2, transition: 'width .4s' }} />
    </div>
  )
}

// ── hero metric card ───────────────────────────────────────────────────────

function HeroCard({ label, big, small, sub, color, pct, note }) {
  return (
    <div style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{big}</span>
        {small && <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{small}</span>}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>{sub}</div>}
      {pct != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <EffBar pct={pct} color={color} height={5} />
          <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 34, textAlign: 'right' }}>{Math.round(pct)}%</span>
        </div>
      )}
      {note && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}

function StatCard({ label, value, sub, color, warn }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: 'var(--bg2)', border: `1px solid ${warn ? 'rgba(220,38,38,.5)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: warn ? 'var(--red)' : 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function ChartCard({ title, sub, right, children }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
        {sub && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>{sub}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────

export default function PerformanceForecast() {
  const { scheduleBlocks, pgmSlots, proposalItems, perfMap, manualInputs, saveManualInput, weightedMinTargets, targetMetrics } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [groupBy, setGroupBy]       = useState('team')
  const [showMissing, setShowMissing] = useState(true)
  const [simSpm, setSimSpm] = useState('')
  const [simPpm, setSimPpm] = useState('')
  const [excludePgmTeam, setExcludePgmTeam] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const simDebounceRef = useRef(null)

  const { teamTargetMap, companyTotal } = useMemo(() => {
    const { teamMap, companyTotal } = parseTargetMetrics(targetMetrics)
    return { teamTargetMap: teamMap, companyTotal }
  }, [targetMetrics])

  const rows = useMemo(() =>
    Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault && !(excludePgmTeam && b.mdTeam === '편성팀'))
      .map(block => ({
        ...block,
        mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류',
        mdTeam: block.mdTeam || block.orgName || '미지정',
        ...calcForecast(block, perfMap, manualInputs),
      }))
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return (a.dateKey || '').localeCompare(b.dateKey || '')
        return (a.timeText || '').localeCompare(b.timeText || '')
      })
  , [scheduleBlocks, perfMap, manualInputs, categoryMap, excludePgmTeam])

  // 일자 선택 시 해당 일자만, 없으면 전체
  const displayRows = useMemo(() =>
    selectedDate ? rows.filter(r => r.dateKey === selectedDate) : rows
  , [rows, selectedDate])

  const summary = useMemo(() => {
    const s = displayRows.reduce((acc, r) => ({
      sales:  acc.sales  + r.expectedSales,
      profit: acc.profit + r.expectedProfit,
      wm:     acc.wm     + Number(r.weightedMin || 0),
    }), { sales: 0, profit: 0, wm: 0 })

    const totalSlotWm = pgmSlots.reduce((a, sl) => a + (sl.weightedMin || 0), 0)

    return {
      ...s,
      salesPerMin:  s.wm > 0 ? s.sales  / s.wm : 0,
      profitPerMin: s.wm > 0 ? s.profit / s.wm : 0,
      missingCount: displayRows.filter(r => r.missingPerf).length,
      perfEnteredCount: displayRows.filter(r => !r.missingPerf).length,
      count: displayRows.length,
      totalSlotCount: pgmSlots.length,
      totalSlotWm,
      scheduleRate: totalSlotWm > 0 ? (s.wm / totalSlotWm * 100) : 0,
      perfRate: displayRows.length > 0 ? (displayRows.filter(r => !r.missingPerf).length / displayRows.length * 100) : 0,
    }
  }, [displayRows, pgmSlots])

  // ── 전사 일자별 데이터 ────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const d = r.dateKey || '?'
      if (!map[d]) map[d] = { date: d, label: d.slice(5).replace('-', '/'), sales: 0, profit: 0, wm: 0 }
      map[d].sales  += r.expectedSales
      map[d].profit += r.expectedProfit
      map[d].wm     += Number(r.weightedMin || 0)
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        salesPerMin:  d.wm > 0 ? Math.round(d.sales  / d.wm) : 0,
        profitPerMin: d.wm > 0 ? Math.round(d.profit / d.wm) : 0,
      }))
  }, [rows])

  const avgDailySalesMin  = useMemo(() => {
    const totalWm = dailyData.reduce((s, d) => s + d.wm, 0)
    return totalWm > 0 ? Math.round(dailyData.reduce((s, d) => s + d.salesPerMin * d.wm, 0) / totalWm) : 0
  }, [dailyData])

  const avgDailyProfitMin = useMemo(() => {
    const totalWm = dailyData.reduce((s, d) => s + d.wm, 0)
    return totalWm > 0 ? Math.round(dailyData.reduce((s, d) => s + d.profitPerMin * d.wm, 0) / totalWm) : 0
  }, [dailyData])

  // ── 일자별 팀 분해 데이터 (툴팁용) ───────────────────────────────────
  const dailyTeamData = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const d = r.dateKey || '?'
      const t = r.mdTeam || '미지정'
      if (!map[d]) map[d] = {}
      if (!map[d][t]) map[d][t] = { name: t, sales: 0, profit: 0, wm: 0 }
      map[d][t].sales  += r.expectedSales
      map[d][t].profit += r.expectedProfit
      map[d][t].wm     += Number(r.weightedMin || 0)
    })
    Object.values(map).forEach(teams => {
      const totalSales  = Object.values(teams).reduce((s, t) => s + t.sales,  0)
      const totalProfit = Object.values(teams).reduce((s, t) => s + t.profit, 0)
      Object.values(teams).forEach(t => {
        t.salesPerMin  = t.wm > 0 ? Math.round(t.sales  / t.wm) : 0
        t.profitPerMin = t.wm > 0 ? Math.round(t.profit / t.wm) : 0
        t.salesShare   = totalSales  > 0 ? t.sales  / totalSales  * 100 : 0
        t.profitShare  = totalProfit > 0 ? t.profit / totalProfit * 100 : 0
      })
    })
    return map
  }, [rows])

  // ── 팀/카테고리별 데이터 ──────────────────────────────────────────────
  const groupData = useMemo(() => {
    const map = {}
    displayRows.forEach(r => {
      const key = groupBy === 'team' ? r.mdTeam : r.mdCategory
      if (!map[key]) map[key] = { name: key, sales: 0, profit: 0, wm: 0, count: 0, missing: 0 }
      map[key].sales  += r.expectedSales
      map[key].profit += r.expectedProfit
      map[key].wm     += Number(r.weightedMin || 0)
      map[key].count  += 1
      if (r.missingPerf) map[key].missing += 1
    })

    const wmTargetMap = {}
    if (groupBy === 'team') {
      weightedMinTargets.forEach(t => {
        const n = (t.teamName || '').trim()
        if (n) { wmTargetMap[n] = t.weeklyTarget; wmTargetMap[n.endsWith('팀') ? n.slice(0, -1) : n + '팀'] = t.weeklyTarget }
      })
    }

    const list = Object.values(map).map(g => {
      const tgt = teamTargetMap[g.name] || {}
      return {
        ...g,
        salesPerMin:       g.wm > 0 ? Math.round(g.sales  / g.wm) : 0,
        profitPerMin:      g.wm > 0 ? Math.round(g.profit / g.wm) : 0,
        targetSalesPerMin: tgt.salesPerMin  || 0,
        targetProfitPerMin:tgt.profitPerMin || 0,
        targetWm:  wmTargetMap[g.name] || 0,
        wmShare: summary.wm > 0 ? g.wm / summary.wm * 100 : 0,
      }
    }).sort((a, b) => b.salesPerMin - a.salesPerMin)

    const maxSpm = Math.max(...list.map(g => g.salesPerMin), 1)
    return list.map((g, i) => ({ ...g, rank: i + 1, effPct: g.salesPerMin / maxSpm * 100 }))
  }, [displayRows, groupBy, weightedMinTargets, teamTargetMap, summary.wm])

  const avgGroupSalesPerMin  = groupData.length > 0
    ? Math.round(groupData.reduce((s, g) => s + g.salesPerMin  * g.wm, 0) / Math.max(summary.wm, 1)) : 0
  const avgGroupProfitPerMin = groupData.length > 0
    ? Math.round(groupData.reduce((s, g) => s + g.profitPerMin * g.wm, 0) / Math.max(summary.wm, 1)) : 0

  const hasTargetData = groupData.some(g => g.targetSalesPerMin > 0)

  const missingRows = useMemo(() => displayRows.filter(r => r.missingPerf), [displayRows])
  const pgmTeamRows = useMemo(() => displayRows.filter(r => r.mdTeam === '편성팀'), [displayRows])

  // 팀/카테고리별 목표가 없는 항목(편성팀, 미분류 등)은 전사 평균으로 대체
  // 팀 목표 없으면 전사 목표(companyTotal)로 fallback, 그것도 없으면 편성 평균
  const enrichedGroupData = useMemo(() =>
    groupData.map(g => ({
      ...g,
      effectiveTargetSalesPerMin:  g.targetSalesPerMin  > 0 ? g.targetSalesPerMin  : (companyTotal?.salesPerMin  || avgGroupSalesPerMin),
      effectiveTargetProfitPerMin: g.targetProfitPerMin > 0 ? g.targetProfitPerMin : (companyTotal?.profitPerMin || avgGroupProfitPerMin),
    }))
  , [groupData, avgGroupSalesPerMin, avgGroupProfitPerMin, companyTotal])

  // 탭 전환 후 재마운트 시 저장된 시뮬레이션 값 복원
  // perfKey는 makePerfKey('', '[편성팀]') = '[위][편성팀]' — normalizeDealType('')이 '[위]' 반환
  useEffect(() => {
    const perfKey = pgmTeamRows[0]?.perfKey
    if (!perfKey) return
    const saved = manualInputs[perfKey]
    if (!saved) return
    if (saved.expectedSalesPerWeightedMin  != null) setSimSpm(String(Math.round(saved.expectedSalesPerWeightedMin)))
    if (saved.expectedProfitPerWeightedMin != null) setSimPpm(String(Math.round(saved.expectedProfitPerWeightedMin)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleSave  = async (perfKey, field, val) => { await saveManualInput(perfKey, { [field]: val }) }

  const saveSimDebounced = useCallback((spmVal, ppmVal) => {
    if (simDebounceRef.current) clearTimeout(simDebounceRef.current)
    simDebounceRef.current = setTimeout(() => {
      const patch = {}
      if (spmVal !== '') patch.expectedSalesPerWeightedMin  = Number(spmVal)
      if (ppmVal !== '') patch.expectedProfitPerWeightedMin = Number(ppmVal)
      if (Object.keys(patch).length === 0) return
      const perfKey = pgmTeamRows[0]?.perfKey
      if (perfKey) saveManualInput(perfKey, patch)
    }, 500)
  }, [pgmTeamRows, saveManualInput])

  const groupToggle = (
    <div style={{ display: 'flex', gap: 4 }}>
      {['team', 'category'].map(v => (
        <button key={v} onClick={() => setGroupBy(v)} style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
          background: groupBy === v ? 'var(--accent)' : 'var(--bg3)',
          border: '1px solid var(--border)', color: groupBy === v ? '#fff' : 'var(--text2)',
        }}>
          {v === 'team' ? '팀별' : '카테고리'}
        </button>
      ))}
    </div>
  )

  const groupCols = [
    { h: '#', align: 'center' },
    { h: groupBy === 'team' ? '팀' : '카테고리', align: 'left' },
    { h: '슬롯', align: 'right' },
    { h: '편성비중', align: 'right' },
    { h: '가중분', align: 'right' },
    { h: '분당취급고', align: 'right' },
    { h: '분당한익', align: 'right' },
    { h: '취급고 효율', align: 'left' },
    { h: '예상취급고', align: 'right' },
    { h: '예상한익', align: 'right' },
  ]
  const detailCols = [
    { h: '일자', align: 'left' }, { h: '시간', align: 'left' }, { h: '채널', align: 'center' },
    { h: '카테고리', align: 'left' }, { h: '팀', align: 'left' }, { h: '상품', align: 'left' },
    { h: '거래형태', align: 'left' }, { h: '가중분', align: 'right' },
    { h: '직전취급/분', align: 'right' }, { h: '직전한익/분', align: 'right' },
    { h: '예상취급/분 ✏', align: 'right' }, { h: '예상한익/분 ✏', align: 'right' },
    { h: '예상취급고', align: 'right' }, { h: '예상한익', align: 'right' },
  ]
  const missingCols = [
    { h: '일자', align: 'left' }, { h: '시간', align: 'left' }, { h: '채널', align: 'center' },
    { h: '팀', align: 'left' }, { h: '상품', align: 'left' }, { h: '가중분', align: 'right' },
    { h: '예상취급/분 ✏', align: 'right' }, { h: '예상한익/분 ✏', align: 'right' },
  ]
  const makeTh = col => ({
    padding: '8px 10px', textAlign: col.align || 'left', fontSize: 10,
    color: 'var(--text3)', fontWeight: 700, background: 'var(--bg3)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  })
  const td = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 상단 컨트롤 ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>시뮬레이션</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginLeft: 'auto',
          fontSize: 11, color: excludePgmTeam ? 'var(--accent)' : 'var(--text3)', fontWeight: excludePgmTeam ? 700 : 400 }}>
          <div onClick={() => setExcludePgmTeam(v => !v)}
            style={{ width: 34, height: 18, borderRadius: 9, background: excludePgmTeam ? 'var(--accent)' : 'var(--bg4)',
              border: '1px solid var(--border)', position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 2, left: excludePgmTeam ? 16 : 2, width: 12, height: 12,
              borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
          </div>
          전사블록 제외
        </label>
      </div>

      {/* ── HERO ──────────────────────────────────────────────── */}
      {(() => {
        const salesAchieve  = companyTotal?.salesPerMin  > 0 ? summary.salesPerMin  / companyTotal.salesPerMin  * 100 : null
        const profitAchieve = companyTotal?.profitPerMin > 0 ? summary.profitPerMin / companyTotal.profitPerMin * 100 : null
        return (
          <div style={{ display: 'flex', gap: 12 }}>
            <HeroCard label="분당 취급고 (예상)" big={fmt(summary.salesPerMin)} small="원/분"
              sub={`총 ${fmtS(summary.sales)} 취급고 예상`} color="var(--accent)"
              pct={salesAchieve}
              note={salesAchieve != null
                ? `전사 목표 ${fmt(companyTotal.salesPerMin)} · 달성률 ${Math.round(salesAchieve)}%`
                : `실적 입력률 ${Math.round(summary.perfRate)}% · 미입력 ${summary.missingCount}건`} />
            <HeroCard label="분당 한계이익 (예상)" big={fmt(summary.profitPerMin)} small="원/분"
              sub={`총 ${fmtS(summary.profit)} 한익 예상`} color="var(--green)"
              pct={profitAchieve}
              note={profitAchieve != null
                ? `전사 목표 ${fmt(companyTotal.profitPerMin)} · 달성률 ${Math.round(profitAchieve)}%`
                : `가중분 ${fmt(summary.wm)} / 슬롯 ${summary.count}개`} />
            {(() => {
              const pgmWm      = pgmTeamRows.reduce((s, r) => s + Number(r.weightedMin || 0), 0)
              const pgmWmShare = summary.wm > 0 ? pgmWm / summary.wm * 100 : 0
              const pgmSlotShare = summary.count > 0 ? pgmTeamRows.length / summary.count * 100 : 0
              const spmHolder = companyTotal?.salesPerMin  > 0 ? fmt(companyTotal.salesPerMin)  : '목표 없음'
              const ppmHolder = companyTotal?.profitPerMin > 0 ? fmt(companyTotal.profitPerMin) : '목표 없음'
              return (
                <div style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>전사블록 시뮬레이션</div>

                  {/* 편성팀 블록 현황 */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
                    <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>슬롯 수</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{pgmTeamRows.length}<span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>개</span></div>
                      <div style={{ fontSize: 9, color: 'var(--text3)' }}>전체의 {pgmSlotShare.toFixed(1)}%</div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 2 }}>가중분</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmtS(pgmWm)}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)' }}>전체의 {pgmWmShare.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* 실시간 입력 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>분당취급고 (원/분)</div>
                      <input value={simSpm}
                        onChange={e => { setSimSpm(e.target.value); saveSimDebounced(e.target.value, simPpm) }}
                        placeholder={spmHolder}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3 }}>분당한익 (원/분)</div>
                      <input value={simPpm}
                        onChange={e => { setSimPpm(e.target.value); saveSimDebounced(simSpm, e.target.value) }}
                        placeholder={ppmHolder}
                        style={{ width: '100%', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── 보조 요약 ──────────────────────────────────────────── */}
      {(() => {
        const tgtSales  = companyTotal?.salesPerMin  > 0 ? companyTotal.salesPerMin  * summary.totalSlotWm : null
        const tgtProfit = companyTotal?.profitPerMin > 0 ? companyTotal.profitPerMin * summary.totalSlotWm : null
        const salesPct  = tgtSales  > 0 ? summary.sales  / tgtSales  * 100 : null
        const profitPct = tgtProfit > 0 ? summary.profit / tgtProfit * 100 : null
        const pctColor  = p => p >= 100 ? 'var(--green)' : p >= 80 ? 'var(--yellow)' : 'var(--red)'
        return (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="총 예상취급고" value={fmtS(summary.sales)} color="var(--accent)"
              sub={salesPct != null ? `목표 ${fmtS(tgtSales)} · ${Math.round(salesPct)}%` : undefined} />
            <StatCard label="총 예상한익" value={fmtS(summary.profit)} color="var(--green)"
              sub={profitPct != null ? `목표 ${fmtS(tgtProfit)} · ${Math.round(profitPct)}%` : undefined} />
            <StatCard label="편성 슬롯" value={`${summary.count} / ${summary.totalSlotCount}`} sub={`가중분 ${fmt(summary.wm)}`} />
            <StatCard label="실적 입력" value={`${summary.perfEnteredCount}건`} sub={`${Math.round(summary.perfRate)}%`} />
            <StatCard label="미입력 실적" value={`${summary.missingCount}건`} warn={summary.missingCount > 0}
              color={summary.missingCount > 0 ? 'var(--red)' : 'var(--text)'} sub="직전 실적 없음" />
          </div>
        )
        void pctColor
      })()}

      {/* ── 팀별 볼륨 바 ────────────────────────────────────────── */}
      {(() => {
        const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316','#84cc16','#94a3b8']
        const teams = groupData.filter(g => g.sales > 0 || g.profit > 0)
        if (!teams.length) return null
        const totalSales  = teams.reduce((s, g) => s + g.sales,  0)
        const totalProfit = teams.reduce((s, g) => s + g.profit, 0)

        const VolBar = ({ getValue, total }) => (
          <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {teams.map((g, i) => {
              const v = getValue(g)
              const pct = total > 0 ? v / total * 100 : 0
              return (
                <div key={g.name} title={`${g.name}: ${fmtS(v)} (${pct.toFixed(1)}%)`}
                  style={{ flex: v || 0, background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {pct > 6 && <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', padding: '0 3px' }}>{g.name.replace('팀','')}</span>}
                </div>
              )
            })}
          </div>
        )

        const Legend = () => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 6 }}>
            {teams.map((g, i) => (
              <span key={g.name} style={{ fontSize: 8, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                {g.name}
              </span>
            ))}
          </div>
        )

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.3px' }}>
                {groupBy === 'team' ? '팀별' : '카테고리별'} 볼륨 비중
              </span>
              <div style={{ marginLeft: 'auto' }}>{groupToggle}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>취급고</div>
                <VolBar getValue={g => g.sales} total={totalSales} />
                <Legend />
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>한계이익</div>
                <VolBar getValue={g => g.profit} total={totalProfit} />
                <Legend />
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 전사 관점: 일자별 분당취급고 / 분당한익 ───────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.3px' }}>전사 관점</span>
          {selectedDate ? (
            <>
              <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'rgba(99,102,241,.12)', padding: '2px 8px', borderRadius: 4 }}>
                {selectedDate} 선택됨
              </span>
              <button onClick={() => setSelectedDate(null)}
                style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                전체 보기
              </button>
            </>
          ) : (
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>막대 클릭 시 해당 일자로 필터</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          <ChartCard title="전사 일자별 분당취급고" sub="원/분 · 평균선 / 전사목표선(적)">
            {(() => {
              const dataMax = Math.max(...dailyData.map(d => d.salesPerMin), 0)
              const yMax = Math.ceil(Math.max(dataMax, companyTotal?.salesPerMin || 0) * 1.12)
              return (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dailyData} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yMax]} tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} width={42} />
                <Tooltip content={<DailyTeamTip dailyTeamData={dailyTeamData} metric="sales" />} />
                <ReferenceLine y={avgDailySalesMin} stroke="var(--accent)" strokeDasharray="5 3" strokeOpacity={0.6}
                  label={{ value: `${fmt(avgDailySalesMin)} 평균`, position: 'insideTopRight', fill: 'var(--text3)', fontSize: 9 }} />
                {companyTotal?.salesPerMin > 0 && (
                  <ReferenceLine y={companyTotal.salesPerMin} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.8}
                    label={{ value: `${fmt(companyTotal.salesPerMin)} 목표`, position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }} />
                )}
                <Bar dataKey="salesPerMin" name="분당취급고" radius={[4, 4, 0, 0]} cursor="pointer"
                  onClick={d => setSelectedDate(prev => prev === d.date ? null : d.date)}>
                  {dailyData.map((d, i) => {
                    const isSelected = selectedDate === d.date
                    const isOther = selectedDate && !isSelected
                    return <Cell key={i}
                      fill={isSelected ? '#facc15' : d.salesPerMin >= avgDailySalesMin ? 'var(--accent)' : '#94a3b8'}
                      opacity={isOther ? 0.25 : d.salesPerMin >= avgDailySalesMin ? 0.9 : 0.6}
                      stroke={isSelected ? '#ca8a04' : 'none'} strokeWidth={isSelected ? 2 : 0} />
                  })}
                  <LabelList dataKey="salesPerMin" position="top"
                    formatter={v => v > 0 ? `${(v / 10000).toFixed(1)}만` : ''}
                    style={{ fontSize: 9, fill: 'var(--text3)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
              )
            })()}
          </ChartCard>

          <ChartCard title="전사 일자별 분당한익" sub="원/분 · 평균선 / 전사목표선(적)">
            {(() => {
              const dataMax = Math.max(...dailyData.map(d => d.profitPerMin), 0)
              const yMax = Math.ceil(Math.max(dataMax, companyTotal?.profitPerMin || 0) * 1.12)
              return (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dailyData} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yMax]} tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} width={42} />
                <Tooltip content={<DailyTeamTip dailyTeamData={dailyTeamData} metric="profit" />} />
                <ReferenceLine y={avgDailyProfitMin} stroke="var(--green)" strokeDasharray="5 3" strokeOpacity={0.6}
                  label={{ value: `${fmt(avgDailyProfitMin)} 평균`, position: 'insideTopRight', fill: 'var(--text3)', fontSize: 9 }} />
                {companyTotal?.profitPerMin > 0 && (
                  <ReferenceLine y={companyTotal.profitPerMin} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.8}
                    label={{ value: `${fmt(companyTotal.profitPerMin)} 목표`, position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }} />
                )}
                <Bar dataKey="profitPerMin" name="분당한익" radius={[4, 4, 0, 0]} cursor="pointer"
                  onClick={d => setSelectedDate(prev => prev === d.date ? null : d.date)}>
                  {dailyData.map((d, i) => {
                    const isSelected = selectedDate === d.date
                    const isOther = selectedDate && !isSelected
                    return <Cell key={i}
                      fill={isSelected ? '#facc15' : d.profitPerMin >= avgDailyProfitMin ? 'var(--green)' : '#94a3b8'}
                      opacity={isOther ? 0.25 : d.profitPerMin >= avgDailyProfitMin ? 0.9 : 0.6}
                      stroke={isSelected ? '#ca8a04' : 'none'} strokeWidth={isSelected ? 2 : 0} />
                  })}
                  <LabelList dataKey="profitPerMin" position="top"
                    formatter={v => v > 0 ? `${(v / 10000).toFixed(1)}만` : ''}
                    style={{ fontSize: 9, fill: 'var(--text3)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
              )
            })()}
          </ChartCard>

        </div>
      </div>

      {/* ── 팀/카테고리 관점: 분당취급고 vs 목표 / 분당한익 vs 목표 ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.3px' }}>
            {groupBy === 'team' ? '팀별' : '카테고리별'} 관점
          </span>
          {groupBy === 'team' && !hasTargetData && (
            <span style={{ fontSize: 9, color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 3 }}>
              팀별 목표 없음 — 전사 평균으로 대체
            </span>
          )}
          <div style={{ marginLeft: 'auto' }}>{groupToggle}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* 팀별 분당취급고 vs 목표 */}
          {(() => {
            const baseSpm = companyTotal?.salesPerMin || avgGroupSalesPerMin
            const capSpm  = baseSpm > 0 ? Math.ceil(baseSpm * 1.5) : undefined
            const SalesLabel = ({ x, y, width, height, value }) => {
              if (!capSpm || !value || value <= capSpm) return null
              return (
                <text x={x + width - 4} y={y + height / 2} fill="#fff" textAnchor="end" dominantBaseline="middle" fontSize={9} fontWeight="bold">
                  {(value / 10000).toFixed(1)}만
                </text>
              )
            }
            return (
              <ChartCard
                title={`${groupBy === 'team' ? '팀별' : '카테고리별'} 분당취급고`}
                sub="편성 vs 목표 (미설정→전사목표)">
                <ResponsiveContainer width="100%" height={Math.max(240, enrichedGroupData.length * 54 + 30)}>
                  <BarChart data={enrichedGroupData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 52 }} barCategoryGap="16%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={capSpm ? [0, capSpm] : ['auto', 'auto']} allowDataOverflow tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 15, fill: 'var(--text2)' }} axisLine={false} tickLine={false} width={75} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="effectiveTargetSalesPerMin" name="목표" fill="#94a3b8" opacity={0.35} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="salesPerMin" name="편성" radius={[0, 4, 4, 0]} opacity={0.9}>
                      {enrichedGroupData.map((g, i) => (
                        <Cell key={i} fill={g.salesPerMin >= g.effectiveTargetSalesPerMin ? 'var(--accent)' : '#6366f1'} />
                      ))}
                      <LabelList content={SalesLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, background: '#94a3b8', opacity: 0.5, borderRadius: 2, display: 'inline-block' }} />목표
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, background: 'var(--accent)', borderRadius: 2, display: 'inline-block' }} />편성
                  </span>
                </div>
              </ChartCard>
            )
          })()}

          {/* 팀별 분당한익 vs 목표 */}
          {(() => {
            const basePpm = companyTotal?.profitPerMin || avgGroupProfitPerMin
            const capPpm  = basePpm > 0 ? Math.ceil(basePpm * 1.5) : undefined
            const ProfitLabel = ({ x, y, width, height, value }) => {
              if (!capPpm || !value || value <= capPpm) return null
              return (
                <text x={x + width - 4} y={y + height / 2} fill="#fff" textAnchor="end" dominantBaseline="middle" fontSize={9} fontWeight="bold">
                  {(value / 10000).toFixed(1)}만
                </text>
              )
            }
            return (
              <ChartCard
                title={`${groupBy === 'team' ? '팀별' : '카테고리별'} 분당한익`}
                sub="편성 vs 목표 (미설정→전사목표)">
                <ResponsiveContainer width="100%" height={Math.max(240, enrichedGroupData.length * 54 + 30)}>
                  <BarChart data={enrichedGroupData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 52 }} barCategoryGap="16%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={capPpm ? [0, capPpm] : ['auto', 'auto']} allowDataOverflow tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 15, fill: 'var(--text2)' }} axisLine={false} tickLine={false} width={75} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="effectiveTargetProfitPerMin" name="목표" fill="#94a3b8" opacity={0.35} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="profitPerMin" name="편성" radius={[0, 4, 4, 0]} opacity={0.9}>
                      {enrichedGroupData.map((g, i) => (
                        <Cell key={i} fill={g.profitPerMin >= g.effectiveTargetProfitPerMin ? 'var(--green)' : '#94a3b8'} />
                      ))}
                      <LabelList content={ProfitLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, background: '#94a3b8', opacity: 0.5, borderRadius: 2, display: 'inline-block' }} />목표
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 6, background: 'var(--green)', borderRadius: 2, display: 'inline-block' }} />편성
                  </span>
                </div>
              </ChartCard>
            )
          })()}

        </div>
      </div>

      {/* ── 그룹별 효율 테이블 ────────────────────────────────── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
            {groupBy === 'team' ? '팀별' : '카테고리별'} 분당 효율 요약
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>분당취급고 기준 내림차순</span>
          <div style={{ marginLeft: 'auto' }}>{groupToggle}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>{groupCols.map(col => <th key={col.h} style={makeTh(col)}>{col.h}</th>)}</tr>
            </thead>
            <tbody>
              {groupData.map((g, i) => {
                const aboveAvg = g.salesPerMin >= avgGroupSalesPerMin
                return (
                  <tr key={g.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td style={{ ...td, color: 'var(--text3)', textAlign: 'center', width: 28 }}>
                      {g.rank <= 3 ? ['🥇','🥈','🥉'][g.rank - 1] : g.rank}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{g.name}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>{g.count}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                          <div style={{ width: `${g.wmShare}%`, height: '100%', background: 'var(--text3)', borderRadius: 2, opacity: 0.5 }} />
                        </div>
                        <span style={{ minWidth: 30, textAlign: 'right', color: 'var(--text3)' }}>{g.wmShare.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(g.wm)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: aboveAvg ? 'var(--accent)' : 'var(--text2)' }}>
                      {fmt(g.salesPerMin)}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>원/분</span>
                      {hasTargetData && g.targetSalesPerMin > 0 && (
                        <span style={{ fontSize: 9, color: g.salesPerMin >= g.targetSalesPerMin ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>
                          ({g.targetSalesPerMin > 0 ? `목표 ${fmt(g.targetSalesPerMin)}` : ''})
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                      {fmt(g.profitPerMin)}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>원/분</span>
                    </td>
                    <td style={{ ...td, minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <EffBar pct={g.effPct} color={aboveAvg ? 'var(--accent)' : '#94a3b8'} height={6} />
                        <span style={{ fontSize: 10, minWidth: 36, textAlign: 'right',
                          color: aboveAvg ? 'var(--accent)' : 'var(--text3)', fontWeight: 700 }}>
                          {Math.round(g.effPct)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--accent)' }}>{fmtS(g.sales)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--green)' }}>{fmtS(g.profit)}</td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg3)' }}>
                <td style={td} /><td style={{ ...td, fontWeight: 700 }}>합계</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{summary.count}</td>
                <td style={td} />
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(summary.wm)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmt(summary.salesPerMin)}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>원/분</span></td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmt(summary.profitPerMin)}<span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 3 }}>원/분</span></td>
                <td style={td} />
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{fmtS(summary.sales)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmtS(summary.profit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 미입력 실적 ───────────────────────────────────────── */}
      {missingRows.length > 0 && (
        <div style={{ background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 10, overflow: 'hidden' }}>
          <button onClick={() => setShowMissing(v => !v)}
            style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>⚠ 직전 실적 미확인 {missingRows.length}건</span>
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>예상값이 0으로 계산됩니다 — 여기서 직접 입력 가능</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{showMissing ? '▲' : '▼'}</span>
          </button>
          {showMissing && (
            <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(220,38,38,.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{missingCols.map(col => <th key={col.h} style={{ ...makeTh(col), background: 'rgba(220,38,38,.08)' }}>{col.h}</th>)}</tr>
                </thead>
                <tbody>
                  {missingRows.map((r, i) => (
                    <tr key={r.blockKey || i} style={{ borderBottom: '1px solid rgba(220,38,38,.15)' }}>
                      <td style={td}>{r.dateKey}</td>
                      <td style={td}>{r.timeText}</td>
                      <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}>{r.channel}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.mdTeam}</td>
                      <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.pgmCodeName}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmt(r.weightedMin)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <EditCell value={r.manualSales} perfKey={r.perfKey} field="expectedSalesPerWeightedMin" onSave={handleSave} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <EditCell value={r.manualProfit} perfKey={r.perfKey} field="expectedProfitPerWeightedMin" onSave={handleSave} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 전체 상세 테이블 ──────────────────────────────────── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>편성별 실적 상세</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>예상취급/분 · 예상한익/분 셀 클릭하여 수정</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>{detailCols.map(col => <th key={col.h} style={makeTh(col)}>{col.h}</th>)}</tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => {
                const rowBg = r.missingPerf ? 'rgba(220,38,38,.05)' : i % 2 === 0 ? 'transparent' : 'var(--bg3)'
                return (
                  <tr key={r.blockKey || i} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{r.dateKey}</td>
                    <td style={td}>{r.timeText}</td>
                    <td style={{ ...td, textAlign: 'center', color: r.channel === 'CA' ? 'var(--ca)' : r.channel === 'IP' ? 'var(--ip)' : 'var(--text3)' }}>{r.channel}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{r.mdCategory || '-'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.mdTeam}</td>
                    <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.missingPerf && <span style={{ fontSize: 9, background: 'var(--red)', color: '#fff', padding: '1px 4px', borderRadius: 3, marginRight: 4 }}>미입력</span>}
                      {r.hasManual  && <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: 3, marginRight: 4 }}>수동</span>}
                      {r.pgmCodeName}
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{r.dealTypeConverted || r.dealType || '-'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(r.weightedMin)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                      {r.lastPerf ? fmt(r.lastPerf.salesPerWeightedMin) : <span style={{ color: 'var(--red)', fontSize: 10 }}>없음</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                      {r.lastPerf ? fmt(r.lastPerf.profitPerWeightedMin) : <span style={{ color: 'var(--red)', fontSize: 10 }}>없음</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualSales ?? r.salesPerMin} perfKey={r.perfKey}
                        field="expectedSalesPerWeightedMin" onSave={handleSave} dim={r.manualSales == null} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualProfit ?? r.profitPerMin} perfKey={r.perfKey}
                        field="expectedProfitPerWeightedMin" onSave={handleSave} dim={r.manualProfit == null} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{fmtS(r.expectedSales)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmtS(r.expectedProfit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
