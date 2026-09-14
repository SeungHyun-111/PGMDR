import { useMemo, useState, useRef, useCallback, useEffect, Fragment } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from 'recharts'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { makePerfKey, normalizeDealType } from '../hooks/usePerformanceMap'
import { getEffectivePgmSlots } from '../utils/effectiveSlots'
import { getEffectiveBlockWeightedMin, timeToMin } from '../utils/weightedMin'
import { getManualInputKey } from '../utils/grade'
import { extractEntityFields } from '../utils/mergeEntity'
import { getScheduledBlockPerformance } from '../utils/performanceHistory'
import useLocalStorageState from '../hooks/useLocalStorageState'
import CoachMark from '../components/common/CoachMark'

const FORECAST_COACH_STEPS = [
  { target: '[data-coach="forecast-page"]', title: '시뮬레이션 화면', description: '현재 편성된 블록을 기준으로 예상 취급고와 한계이익을 계산하는 화면입니다. 단순 합계가 아니라 가중분, 직전 실적, 수기 입력, 목표값을 함께 반영합니다.' },
  { target: '[data-coach="forecast-header"]', title: '상단 기준 설정', description: '이곳에서 시뮬레이션 안내를 다시 열고, [편성팀] 전사블록을 계산에서 제외할지 정합니다. 제외하면 해당 블록은 rows 생성 단계에서 빠져 평균과 합계에 들어가지 않습니다.' },
  { target: '[data-coach="forecast-formula"]', title: '가장 중요한 계산 기준', description: '이 페이지의 평균은 미입력 포함 방식입니다. 예상취급고 = 적용 취급/분 × 가중분, 예상한익 = 적용 한익/분 × 가중분, 분당 평균 = 총 예상액 ÷ 총 편성 가중분입니다. 실적 미입력은 적용 실적이 0이지만 가중분은 분모에 포함됩니다.' },
  { target: '[data-coach="forecast-hero"]', title: '분당 예상 지표', description: '분당 취급고와 분당 한계이익의 대표 숫자입니다. 실적 적용 우선순위는 동일 방송 실적, 수기 입력, 직전 실적, 0 순서입니다. 미입력이 많으면 가중분은 그대로인데 예상액이 0으로 들어가 평균이 내려갑니다.' },
  { target: '[data-coach="forecast-pgm-team"]', title: '전사블록 시뮬레이션', description: '[편성팀] [전사블록]은 실제 상품 실적이 없을 수 있어 별도 입력칸으로 분당 취급고와 분당 한익을 보정합니다. 입력값은 sim_pgm_team 수기값으로 저장되고 재진입 시 복원됩니다.' },
  { target: '[data-coach="forecast-stats"]', title: '보조 요약', description: '총 예상취급고와 총 예상한익은 각 블록의 예상액을 합산합니다. 편성 슬롯은 실제 편성된 블록 수와 전체 슬롯 수를 비교하고, 전체 슬롯 수는 CA/IP 분할 슬롯을 2칸으로 계산합니다.' },
  { target: '[data-coach="forecast-missing-stat"]', title: '미입력 실적 카운트', description: '직전 실적도 없고 수기 입력도 완성되지 않은 블록 수입니다. 이 블록들은 가중분은 총 편성 가중분에 들어가지만 취급/분·한익/분은 0으로 계산되어 평균을 낮춥니다.' },
  { target: '[data-coach="forecast-volume"]', title: '볼륨 비중', description: '현재 편성표에 올라간 상품들을 팀명 또는 카테고리명으로 묶어서, 예상 취급고와 예상 한계이익을 어느 그룹이 얼마나 차지하는지 보여줍니다. 금액 기여도가 0인 그룹은 막대 안에서 보이지 않을 수 있습니다.' },
  { target: '[data-coach="forecast-group-toggle"]', title: '팀별/카테고리별 전환', description: '팀별은 담당 조직 기준으로, 카테고리별은 상품 분류 기준으로 다시 묶어 봅니다. 각 그룹의 분당 평균은 그 그룹의 총 예상액을 그 그룹에 편성된 가중분으로 나눈 값입니다.' },
  { target: '[data-coach="forecast-daily"]', title: '일자별 전사 관점', description: '날짜별로 편성된 모든 상품의 예상액을 합산한 뒤, 그 날짜에 편성된 가중분으로 나눈 분당 취급고와 분당 한익입니다. 전사블록 제외 옵션이 켜져 있으면 그 블록은 빠지고, 미입력 실적은 0원으로 들어가지만 가중분은 포함됩니다. 그래프 막대를 클릭하면 아래 요약, 팀별/카테고리별 관점, 미입력 표, 상세 표가 해당 일자만 보도록 필터링되고, 같은 막대를 다시 누르거나 전체 보기를 누르면 해제됩니다.' },
  { target: '[data-coach="forecast-target"]', title: '목표선과 평균선', description: '평균선은 각 날짜의 분당값을 단순 평균낸 것이 아니라, 날짜별 가중분 규모를 반영해 다시 계산한 전체 평균입니다. 목표선은 전사 목표가 있을 때만 함께 표시됩니다.' },
  { target: '[data-coach="forecast-group-charts"]', title: '팀별/카테고리별 관점', description: '현재 조건에 포함된 편성 블록을 팀명 또는 카테고리명으로 묶은 영역입니다. 전사블록 제외 옵션과 일자 선택이 적용된 뒤 남은 블록만 들어가고, 미입력 실적은 0원으로 계산되지만 해당 블록의 가중분은 그룹 평균 분모에 포함됩니다. 팀별 보기에서는 팀 목표가 있으면 팀 목표와 비교하고, 없으면 전사 목표, 그것도 없으면 현재 전체 편성 평균과 비교합니다.' },
  { target: '[data-coach="forecast-missing-table"]', title: '미입력 실적 보정표', description: '실적이 없는 블록만 모아 보여줍니다. 여기서 예상취급/분과 예상한익/분을 직접 입력하면 이후 계산에서 0 대신 수기값이 적용됩니다.' },
  { target: '[data-coach="forecast-detail-table"]', title: '편성별 상세 표', description: '모든 편성 블록의 계산 근거를 확인하는 표입니다. 편성코드명이나 거래형태를 수정하면 perfKey를 다시 산출해 실적 매칭 기준도 바뀝니다. 예상값 셀은 클릭해서 수기 보정할 수 있습니다.' },
  { target: '[data-coach="forecast-help-button"]', title: '시뮬레이션 안내 다시 보기', description: '이 버튼으로 실적 예측 페이지 투어를 다시 시작합니다. 계산 기준이 헷갈릴 때 특히 이 투어를 다시 보면 됩니다.' },
]

// ── helpers ───────────────────────────────────────────────────────────────

function calcForecast(block, perfMap, manualInputs, performanceHistoryByKey) {
  const perfState = getScheduledBlockPerformance(block, {
    performanceHistoryByKey,
    manualInputs,
    fallbackPerfMap: perfMap,
  })
  const lastPerf = perfState.lastPerf
  const sameBroadcastPerf = perfState.sameBroadcastPerf
  const manualSales  = perfState.manualSales
  const manualProfit = perfState.manualProfit
  const salesPerMin  = perfState.salesPerMin
  const profitPerMin = perfState.profitPerMin
  const wm = getEffectiveBlockWeightedMin(block)

  return {
    lastPerf,
    sameBroadcastPerf,
    salesPerMin, profitPerMin,
    manualSales, manualProfit,
    weightedMin: wm,
    expectedSales:  (salesPerMin  ?? 0) * wm,
    expectedProfit: (profitPerMin ?? 0) * wm,
    missingPerf: perfState.missingPerf,
    hasManual: perfState.hasManual,
    perfSource: perfState.source,
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
  const teams = Object.values(teamsMap).sort((a, b) => {
    if (a.name === '편성팀') return 1
    if (b.name === '편성팀') return -1
    return metric === 'sales' ? b.salesPerMin - a.salesPerMin : b.profitPerMin - a.profitPerMin
  })
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
          <Fragment key={t.name}>
            <span style={{ color: 'var(--text2)' }}>{t.name}</span>
            <span style={{ color, fontWeight: 700, textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesPerMin : t.profitPerMin).toLocaleString()}
            </span>
            <span style={{ color: 'var(--text3)', textAlign: 'right' }}>
              {(metric === 'sales' ? t.salesShare : t.profitShare).toFixed(1)}%
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// ── constants ─────────────────────────────────────────────────────────────

const VIDEO_STATUS_OPTIONS = ['기존', '재녹화', '재편집', '신상품']
const DEAL_TYPE_OPTIONS    = ['위탁', '직매입', '모바일광고', '혼합', '정액']

// ── block field editor (편성코드명·거래형태·영상구분 인라인 수정) ─────────

function BlockFieldEditor({ value, type, options, onSave, placeholder, minWidth = 80 }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const inputRef = useRef()

  const open   = () => { setVal(value || ''); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) }
  const commit = v => { setEditing(false); if (v !== (value ?? '')) onSave(v) }

  if (editing && type === 'select') return (
    <select ref={inputRef} value={val} autoFocus
      onChange={e => commit(e.target.value)}
      onBlur={() => setEditing(false)}
      style={{ background: 'var(--bg4)', border: '1px solid var(--accent)', color: 'var(--text)', padding: '2px 4px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  if (editing) return (
    <input ref={inputRef} value={val} placeholder={placeholder} autoFocus
      onChange={e => setVal(e.target.value)}
      onBlur={() => commit(val)}
      onKeyDown={e => { if (e.key === 'Enter') commit(val); if (e.key === 'Escape') setEditing(false) }}
      style={{ width: '100%', minWidth, background: 'var(--bg4)', border: '1px solid var(--accent)', color: 'var(--text)', padding: '2px 6px', borderRadius: 4, fontSize: 11, outline: 'none' }} />
  )

  return (
    <span onClick={open} title="클릭하여 수정"
      style={{ cursor: 'pointer', color: value ? 'var(--text)' : 'var(--text3)', borderBottom: '1px dashed var(--border2)', display: 'inline-block' }}>
      {value || '—'}
    </span>
  )
}

// ── inline edit cell ──────────────────────────────────────────────────────

function EditCell({ value, uniqueKey, field, onSave, dim }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const iref = useRef()

  const open = () => {
    if (!uniqueKey) return
    setVal(value != null ? String(Math.round(value)) : '')
    setEditing(true)
    setTimeout(() => iref.current?.select(), 0)
  }
  const commit = async () => {
    setEditing(false)
    await onSave(uniqueKey, field, val === '' ? null : Number(val))
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
    <span onClick={open} title={uniqueKey ? '클릭 수정' : ''}
      style={{ display: 'inline-block', minWidth: 60, textAlign: 'right', cursor: uniqueKey ? 'pointer' : 'default',
        color: dim ? 'var(--text3)' : display != null ? 'var(--text)' : 'var(--text3)',
        borderBottom: uniqueKey ? '1px dashed var(--border)' : 'none', fontSize: 11 }}>
      {display ?? (uniqueKey ? '입력' : '-')}
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
        {sub && <span style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 700 }}>{sub}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  )
}

function ReferenceLineLabel({ viewBox, text, color, lane = 'top' }) {
  if (!viewBox) return null
  const { x, y, width } = viewBox
  const labelW = 86
  const labelH = 18
  const chartTop = 4
  const chartBottom = 156
  const plotEndX = x + width
  const labelX = plotEndX - labelW - 8
  const labelY = lane === 'bottom' ? chartBottom : chartTop
  const lineEndX = labelX + labelW + 4
  const lineEndY = labelY + labelH / 2
  const lineStartX = plotEndX
  const elbowX = lineEndX + 14
  return (
    <g>
      <polyline
        points={`${lineStartX},${y} ${elbowX},${y} ${lineEndX},${lineEndY}`}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.95}
      />
      <circle cx={lineStartX} cy={y} r={2} fill={color} fillOpacity={0.9} />
      <rect
        x={labelX}
        y={labelY}
        width={labelW}
        height={labelH}
        rx={3}
        fill="var(--bg2)"
        stroke={color}
        strokeOpacity={0.9}
      />
      <text
        x={labelX + labelW / 2}
        y={labelY + 12}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={800}
      >
        {text}
      </text>
    </g>
  )
}

// ── main ──────────────────────────────────────────────────────────────────

export default function PerformanceForecast() {
  const {
    scheduleBlocks, pgmSlots, splitSlots, customSlots, proposalItems,
    perfMap, performanceHistoryByKey, manualInputs,
    ensurePerformanceKeys,
    saveManualInput, saveBlock, saveEntityProps, weightedMinTargets, targetMetrics,
    startDate, poolType, currentVersionId,
  } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const uiScope = `${startDate || 'no-session'}_${poolType || 'A'}_${currentVersionId || 'draft'}`
  const [groupBy, setGroupBy]           = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.groupBy`, 'team')
  const [simSpm, setSimSpm]             = useState('')
  const [simPpm, setSimPpm]             = useState('')
  const [excludePgmTeam, setExcludePgmTeam] = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.excludePgmTeam`, false)
  const [selectedDate, setSelectedDate] = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.selectedDate`, null)
  const [detailSort,   setDetailSort]   = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.detailSort`, { key: null, dir: 'asc' })
  const [missingSort,  setMissingSort]  = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.missingSort`, { key: null, dir: 'asc' })
  const [detailWidths, setDetailWidths] = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.detailWidths`, {})
  const [missingWidths, setMissingWidths] = useLocalStorageState(`pgmdr.ui.${uiScope}.forecast.missingWidths`, {})
  const [forecastCoachOpen, setForecastCoachOpen] = useState(false)
  const [forecastCoachStep, setForecastCoachStep] = useState(0)
  const simDebounceRef = useRef(null)

  useEffect(() => {
    const keys = [...new Set(Object.values(scheduleBlocks || {}).map(block => block?.perfKey).filter(Boolean))]
    if (keys.length) ensurePerformanceKeys?.(keys, { latest: true, history: true })
  }, [scheduleBlocks, ensurePerformanceKeys])

  const { teamTargetMap, companyTotal } = useMemo(() => {
    const { teamMap, companyTotal } = parseTargetMetrics(targetMetrics)
    return { teamTargetMap: teamMap, companyTotal }
  }, [targetMetrics])

  const rows = useMemo(() =>
    Object.values(scheduleBlocks)
      .filter(b => b && !(excludePgmTeam && b.mdTeam === '편성팀'))
      .map(block => ({
        ...block,
        mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류',
        mdTeam: block.mdTeam || block.orgName || '미지정',
        ...calcForecast(block, perfMap, manualInputs, performanceHistoryByKey),
      }))
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return (a.dateKey || '').localeCompare(b.dateKey || '')
        return timeToMin(a.timeText) - timeToMin(b.timeText)
      })
  , [scheduleBlocks, perfMap, performanceHistoryByKey, manualInputs, categoryMap, excludePgmTeam])

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

    // 엑셀 내보내기와 동일한 방식: getEffectivePgmSlots → 분할 슬롯 2칸으로 카운트
    const effectiveSlots = getEffectivePgmSlots(pgmSlots, customSlots)
    const totalSlotWm    = effectiveSlots.reduce((a, sl) => a + (sl.weightedMin || 0), 0)
    const totalSlotCount = effectiveSlots.reduce((sum, sl) => sum + (splitSlots[sl.slotId] ? 2 : 1), 0)
    const validCount     = displayRows.length

    return {
      ...s,
      salesPerMin:  s.wm > 0 ? s.sales  / s.wm : 0,
      profitPerMin: s.wm > 0 ? s.profit / s.wm : 0,
      missingCount: displayRows.filter(r => r.missingPerf).length,
      perfEnteredCount: displayRows.filter(r => !r.missingPerf).length,
      count: validCount,
      totalSlotCount,
      totalSlotWm,
      scheduleRate: totalSlotWm > 0 ? (s.wm / totalSlotWm * 100) : 0,
      perfRate: displayRows.length > 0 ? (displayRows.filter(r => !r.missingPerf).length / displayRows.length * 100) : 0,
    }
  }, [displayRows, pgmSlots, customSlots, splitSlots])

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
  const sortedDetailRows  = useMemo(() => applySortRows(displayRows, detailSort),  [displayRows, detailSort])
  const sortedMissingRows = useMemo(() => applySortRows(missingRows, missingSort), [missingRows, missingSort])

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
  useEffect(() => {
    const saved = manualInputs['sim_pgm_team']
    if (!saved) return
    if (saved.expectedSalesPerWeightedMin  != null) setSimSpm(String(Math.round(saved.expectedSalesPerWeightedMin)))
    if (saved.expectedProfitPerWeightedMin != null) setSimPpm(String(Math.round(saved.expectedProfitPerWeightedMin)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const handleSave = async (uniqueKey, field, val) => { await saveManualInput(uniqueKey, { [field]: val }) }

  // 블록 필드(편성코드명·거래형태·영상구분) 수정 → uniqueKey 엔티티 속성 반영
  // pgmCodeName·dealType 변경 시 perfKey 재산출
  const handleBlockFieldSave = useCallback(async (block, field, newVal) => {
    const patch = { [field]: newVal }
    if (field === 'pgmCodeName' || field === 'dealType') {
      const newName = field === 'pgmCodeName' ? newVal : (block.pgmCodeName || '')
      const newDeal = field === 'dealType'    ? newVal : (block.dealType    || '')
      const newConverted = normalizeDealType(newDeal)
      patch.dealTypeConverted = newConverted
      patch.perfKey = newName ? makePerfKey(newConverted, newName) : null
    }
    const entityPatch = extractEntityFields(patch)
    if (block.uniqueKey) {
      await saveEntityProps(block.uniqueKey, entityPatch)
    } else {
      await saveBlock(block.blockKey || block.slotId, entityPatch)
    }
  }, [saveBlock, saveEntityProps])

  const startResize = useCallback((e, setWidths, key) => {
    e.preventDefault(); e.stopPropagation()
    const th = e.currentTarget.parentElement
    const allThs = [...th.closest('tr').querySelectorAll('th')]
    const startX = e.clientX, startW = th.offsetWidth
    // snapshot all column widths before switching to fixed layout
    setWidths(prev => {
      const snap = { ...prev }
      allThs.forEach(el => { if (el.dataset.colH && !snap[el.dataset.colH]) snap[el.dataset.colH] = el.offsetWidth })
      return snap
    })
    const onMove = ev => setWidths(p => ({ ...p, [key]: Math.max(40, startW + ev.clientX - startX) }))
    const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  const saveSimDebounced = useCallback((spmVal, ppmVal) => {
    if (simDebounceRef.current) clearTimeout(simDebounceRef.current)
    simDebounceRef.current = setTimeout(() => {
      const patch = {}
      if (spmVal !== '') patch.expectedSalesPerWeightedMin  = Number(spmVal)
      if (ppmVal !== '') patch.expectedProfitPerWeightedMin = Number(ppmVal)
      if (Object.keys(patch).length === 0) return
      saveManualInput('sim_pgm_team', patch)
    }, 500)
  }, [saveManualInput])

  const openForecastCoach = () => {
    setForecastCoachStep(0)
    setForecastCoachOpen(true)
  }

  const closeForecastCoach = () => setForecastCoachOpen(false)

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

  const detailCols = [
    { h: '일자',        align: 'left',   k: 'dateKey',      dw: 72  },
    { h: '시간',        align: 'left',   k: 'timeText',     dw: 55  },
    { h: '채널',        align: 'center', k: 'channel',      dw: 46  },
    { h: '카테고리',    align: 'left',   k: 'mdCategory',   dw: 66  },
    { h: '팀',          align: 'left',   k: 'mdTeam',       dw: 66  },
    { h: '편성코드명 ✏', align: 'left',  k: 'pgmCodeName',  dw: 140 },
    { h: '거래형태 ✏',  align: 'left',   k: 'dealType',     dw: 66  },
    { h: '신상품구분 ✏', align: 'left',   k: 'newProductType', dw: 66  },
    { h: '가중분',      align: 'right',  k: 'weightedMin',  dw: 56  },
    { h: '직전취급/분', align: 'right',  k: '_lastSales',   dw: 82  },
    { h: '직전한익/분', align: 'right',  k: '_lastProfit',  dw: 82  },
    { h: '예상취급/분 ✏', align: 'right', k: '_estSales',  dw: 92  },
    { h: '예상한익/분 ✏', align: 'right', k: '_estProfit', dw: 92  },
    { h: '예상취급고',  align: 'right',  k: 'expectedSales',  dw: 78 },
    { h: '예상한익',    align: 'right',  k: 'expectedProfit', dw: 72 },
  ]
  const missingCols = [
    { h: '일자',        align: 'left',   k: 'dateKey',     dw: 72  },
    { h: '시간',        align: 'left',   k: 'timeText',    dw: 55  },
    { h: '채널',        align: 'center', k: 'channel',     dw: 46  },
    { h: '팀',          align: 'left',   k: 'mdTeam',      dw: 66  },
    { h: '편성코드명 ✏', align: 'left',  k: 'pgmCodeName', dw: 140 },
    { h: '거래형태 ✏',  align: 'left',   k: 'dealType',    dw: 66  },
    { h: '신상품구분 ✏', align: 'left',   k: 'newProductType', dw: 66  },
    { h: '가중분',      align: 'right',  k: 'weightedMin', dw: 56  },
    { h: '예상취급/분 ✏', align: 'right', k: '_manualSales',  dw: 92 },
    { h: '예상한익/분 ✏', align: 'right', k: '_manualProfit', dw: 92 },
  ]

  function getSortVal(r, k) {
    switch (k) {
      case '_lastSales':    return r.lastPerf?.salesPerWeightedMin  ?? -Infinity
      case '_lastProfit':   return r.lastPerf?.profitPerWeightedMin ?? -Infinity
      case '_estSales':     return r.manualSales  ?? r.salesPerMin  ?? 0
      case '_estProfit':    return r.manualProfit ?? r.profitPerMin ?? 0
      case '_manualSales':  return r.manualSales  ?? 0
      case '_manualProfit': return r.manualProfit ?? 0
      case 'dealType':      return r.dealTypeConverted || r.dealType || ''
      case 'timeText':      return timeToMin(r.timeText)
      default:              return r[k] ?? ''
    }
  }
  function applySortRows(rows, sort) {
    if (!sort.key) return rows
    return [...rows].sort((a, b) => {
      const av = getSortVal(a, sort.key), bv = getSortVal(b, sort.key)
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  const makeTh = (col, sort, setSort, widths, setWidths, extraBg) => {
    const isActive = sort.key === col.k
    const hasExplicit = col.h in widths
    const w = hasExplicit ? widths[col.h] : undefined
    return (
      <th key={col.h}
        data-col-h={col.h}
        onClick={() => col.k && setSort(s => ({ key: col.k, dir: s.key === col.k && s.dir === 'asc' ? 'desc' : 'asc' }))}
        style={{
          ...(w != null ? { width: w, minWidth: w, maxWidth: w } : { minWidth: col.dw }),
          padding: '8px 10px', textAlign: col.align || 'left', fontSize: 10,
          color: 'var(--text3)', fontWeight: 700,
          background: extraBg || 'var(--bg3)',
          borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
          position: 'sticky', top: 0, zIndex: 1,
          cursor: col.k ? 'pointer' : 'default', userSelect: 'none',
          overflow: 'hidden',
        }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {col.h}
          {col.k && <span style={{ fontSize: 8, color: isActive ? 'var(--accent)' : 'var(--border2)', flexShrink: 0 }}>
            {isActive ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>}
        </span>
        <div onMouseDown={e => startResize(e, setWidths, col.h)}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }} />
      </th>
    )
  }
  const td = { padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }

  return (
    <div data-coach="forecast-page" style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 상단 컨트롤 ──────────────────────────────────────── */}
      <div data-coach="forecast-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>시뮬레이션</span>
        <button
          data-coach="forecast-help-button"
          onClick={openForecastCoach}
          title="시뮬레이션 안내 다시 보기"
          aria-label="시뮬레이션 안내 다시 보기"
          style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', cursor: 'pointer', fontSize: 12, fontWeight: 900, flexShrink: 0 }}
        >
          ?
        </button>
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
      <div data-coach="forecast-formula" style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
        시뮬레이션 평균 기준: 미입력 포함(실적 = 0, 가중분 = 총 편성)
      </div>
      {(() => {
        const salesAchieve  = companyTotal?.salesPerMin  > 0 ? summary.salesPerMin  / companyTotal.salesPerMin  * 100 : null
        const profitAchieve = companyTotal?.profitPerMin > 0 ? summary.profitPerMin / companyTotal.profitPerMin * 100 : null
        return (
          <div data-coach="forecast-hero" style={{ display: 'flex', gap: 12 }}>
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
                <div data-coach="forecast-pgm-team" style={{ flex: 1, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          <div data-coach="forecast-stats" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <StatCard label="총 예상취급고" value={fmtS(summary.sales)} color="var(--accent)"
              sub={salesPct != null ? `목표 ${fmtS(tgtSales)} · ${Math.round(salesPct)}%` : undefined} />
            <StatCard label="총 예상한익" value={fmtS(summary.profit)} color="var(--green)"
              sub={profitPct != null ? `목표 ${fmtS(tgtProfit)} · ${Math.round(profitPct)}%` : undefined} />
            <StatCard label="편성 슬롯" value={`${summary.count} / ${summary.totalSlotCount}`} sub={`가중분 ${fmt(summary.wm)}`} />
            <StatCard label="실적 입력" value={`${summary.perfEnteredCount}건`} sub={`${Math.round(summary.perfRate)}%`} />
            <div data-coach="forecast-missing-stat" style={{ flex: 1, minWidth: 120 }}>
            <StatCard label="미입력 실적" value={`${summary.missingCount}건`} warn={summary.missingCount > 0}
              color={summary.missingCount > 0 ? 'var(--red)' : 'var(--text)'} sub="직전 실적 없음" />
            </div>
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
          <div data-coach="forecast-volume">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.3px' }}>
                {groupBy === 'team' ? '팀별' : '카테고리별'} 볼륨 비중
              </span>
              <div data-coach="forecast-group-toggle" style={{ marginLeft: 'auto' }}>{groupToggle}</div>
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
      <div data-coach="forecast-daily">
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
        <div data-coach="forecast-target" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          <ChartCard title="전사 일자별 분당취급고" sub="미입력 포함(실적 = 0, 가중분 = 총 편성) · 평균선 / 전사목표선">
            {(() => {
              const dataMax = Math.max(...dailyData.map(d => d.salesPerMin), 0)
              const yMax = Math.ceil(Math.max(dataMax, companyTotal?.salesPerMin || 0) * 1.12)
              const targetLine = companyTotal?.salesPerMin || 0
              const avgLane = avgDailySalesMin >= targetLine ? 'top' : 'bottom'
              const targetLane = avgLane === 'top' ? 'bottom' : 'top'
              return (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dailyData} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yMax]} tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} width={42} />
                <Tooltip content={<DailyTeamTip dailyTeamData={dailyTeamData} metric="sales" />} />
                <ReferenceLine y={avgDailySalesMin} stroke="#2563eb" strokeDasharray="5 3" strokeOpacity={0.95} strokeWidth={1.5}
                  label={<ReferenceLineLabel text={`${fmt(avgDailySalesMin)} 평균`} color="#2563eb" lane={avgLane} />} />
                {companyTotal?.salesPerMin > 0 && (
                  <ReferenceLine y={companyTotal.salesPerMin} stroke="#dc2626" strokeDasharray="4 3" strokeOpacity={0.95} strokeWidth={1.5}
                    label={<ReferenceLineLabel text={`${fmt(companyTotal.salesPerMin)} 목표`} color="#dc2626" lane={targetLane} />} />
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

          <ChartCard title="전사 일자별 분당한익" sub="미입력 포함(실적 = 0, 가중분 = 총 편성) · 평균선 / 전사목표선">
            {(() => {
              const dataMax = Math.max(...dailyData.map(d => d.profitPerMin), 0)
              const yMax = Math.ceil(Math.max(dataMax, companyTotal?.profitPerMin || 0) * 1.12)
              const targetLine = companyTotal?.profitPerMin || 0
              const avgLane = avgDailyProfitMin >= targetLine ? 'top' : 'bottom'
              const targetLane = avgLane === 'top' ? 'bottom' : 'top'
              return (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dailyData} margin={{ top: 24, right: 8, bottom: 0, left: 8 }} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yMax]} tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtS(v)} width={42} />
                <Tooltip content={<DailyTeamTip dailyTeamData={dailyTeamData} metric="profit" />} />
                <ReferenceLine y={avgDailyProfitMin} stroke="#16a34a" strokeDasharray="5 3" strokeOpacity={0.95} strokeWidth={1.5}
                  label={<ReferenceLineLabel text={`${fmt(avgDailyProfitMin)} 평균`} color="#16a34a" lane={avgLane} />} />
                {companyTotal?.profitPerMin > 0 && (
                  <ReferenceLine y={companyTotal.profitPerMin} stroke="#dc2626" strokeDasharray="4 3" strokeOpacity={0.95} strokeWidth={1.5}
                    label={<ReferenceLineLabel text={`${fmt(companyTotal.profitPerMin)} 목표`} color="#dc2626" lane={targetLane} />} />
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
      <div data-coach="forecast-group-charts">
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
                sub="미입력 포함(실적 = 0, 가중분 = 총 편성) · 편성 vs 목표">
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
                sub="미입력 포함(실적 = 0, 가중분 = 총 편성) · 편성 vs 목표">
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


      {/* ── 미입력 실적 ───────────────────────────────────────── */}
      <div data-coach="forecast-missing-table" style={{ background: 'rgba(220,38,38,.05)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(220,38,38,.2)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
            ⚠ 직전 실적 미확인 {missingRows.length}건
          </span>
          {missingRows.length === 0
            ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>없음</span>
            : <span style={{ fontSize: 10, color: 'var(--text3)' }}>예상값이 0으로 계산됩니다 — 여기서 직접 입력 가능</span>
          }
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: missingCols.reduce((s, c) => s + (missingWidths[c.h] ?? c.dw), 0), tableLayout: Object.keys(missingWidths).length > 0 ? 'fixed' : 'auto' }}>
            {Object.keys(missingWidths).length > 0 && <colgroup>{missingCols.map(c => <col key={c.h} style={{ width: missingWidths[c.h] ?? c.dw }} />)}</colgroup>}
            <thead>
              <tr>{missingCols.map(col => makeTh(col, missingSort, setMissingSort, missingWidths, setMissingWidths, 'rgba(220,38,38,.08)'))}</tr>
            </thead>
            <tbody>
              {sortedMissingRows.length === 0
                ? <tr><td colSpan={missingCols.length} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: '12px' }}>미입력 실적 없음</td></tr>
                : sortedMissingRows.map((r, i) => (
                  <tr key={r.blockKey || i} style={{ borderBottom: '1px solid rgba(220,38,38,.15)' }}>
                    <td style={td}>{r.dateKey}</td>
                    <td style={td}>{r.timeText}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}>{r.channel}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.mdTeam}</td>
                    <td style={td}>
                      <BlockFieldEditor value={r.pgmCodeName} type="text" minWidth={100}
                        onSave={v => handleBlockFieldSave(r, 'pgmCodeName', v)} />
                    </td>
                    <td style={td}>
                      <BlockFieldEditor value={r.dealTypeConverted || r.dealType || '위탁'} type="select"
                        options={DEAL_TYPE_OPTIONS} onSave={v => handleBlockFieldSave(r, 'dealType', v)} />
                    </td>
                    <td style={td}>
                      <BlockFieldEditor value={r.newProductType || '기존'} type="select"
                        options={VIDEO_STATUS_OPTIONS} onSave={v => handleBlockFieldSave(r, 'newProductType', v)} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(r.weightedMin)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualSales} uniqueKey={r.uniqueKey} field="expectedSalesPerWeightedMin" onSave={handleSave} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualProfit} uniqueKey={r.uniqueKey} field="expectedProfitPerWeightedMin" onSave={handleSave} />
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 전체 상세 테이블 ──────────────────────────────────── */}
      <div data-coach="forecast-detail-table" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>편성별 실적 상세</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>예상취급/분 · 예상한익/분 셀 클릭하여 수정 · 평균/합계: 미입력 포함(실적 = 0, 가중분 = 총 편성)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', minWidth: detailCols.reduce((s, c) => s + (detailWidths[c.h] ?? c.dw), 0), tableLayout: Object.keys(detailWidths).length > 0 ? 'fixed' : 'auto' }}>
            {Object.keys(detailWidths).length > 0 && <colgroup>{detailCols.map(c => <col key={c.h} style={{ width: detailWidths[c.h] ?? c.dw }} />)}</colgroup>}
            <thead>
              <tr>{detailCols.map(col => makeTh(col, detailSort, setDetailSort, detailWidths, setDetailWidths))}</tr>
            </thead>
            <tbody>
              {sortedDetailRows.length === 0 && (
                <tr><td colSpan={detailCols.length} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: '20px' }}>
                  편성된 블록이 없습니다 — scheduleBlocks: {Object.keys(scheduleBlocks).length}건
                </td></tr>
              )}
              {sortedDetailRows.map((r, i) => {
                const rowBg = r.missingPerf ? 'rgba(220,38,38,.05)' : i % 2 === 0 ? 'transparent' : 'var(--bg3)'
                return (
                  <tr key={r.blockKey || i} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{r.dateKey}</td>
                    <td style={td}>{r.timeText}</td>
                    <td style={{ ...td, textAlign: 'center', color: r.channel === 'CA' ? 'var(--ca)' : r.channel === 'IP' ? 'var(--ip)' : 'var(--text3)' }}>{r.channel}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{r.mdCategory || '-'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.mdTeam}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                        {r.missingPerf && <span style={{ fontSize: 9, background: 'var(--red)', color: '#fff', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>미입력</span>}
                        {r.hasManual   && <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>수동</span>}
                        <BlockFieldEditor value={r.pgmCodeName} type="text" minWidth={60}
                          onSave={v => handleBlockFieldSave(r, 'pgmCodeName', v)} />
                      </div>
                    </td>
                    <td style={td}>
                      <BlockFieldEditor value={r.dealTypeConverted || r.dealType || '위탁'} type="select"
                        options={DEAL_TYPE_OPTIONS} onSave={v => handleBlockFieldSave(r, 'dealType', v)} />
                    </td>
                    <td style={td}>
                      <BlockFieldEditor value={r.newProductType || '기존'} type="select"
                        options={VIDEO_STATUS_OPTIONS} onSave={v => handleBlockFieldSave(r, 'newProductType', v)} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmt(r.weightedMin)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                      {r.lastPerf ? fmt(r.lastPerf.salesPerWeightedMin) : <span style={{ color: 'var(--red)', fontSize: 10 }}>없음</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                      {r.lastPerf ? fmt(r.lastPerf.profitPerWeightedMin) : <span style={{ color: 'var(--red)', fontSize: 10 }}>없음</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualSales ?? r.salesPerMin} uniqueKey={r.uniqueKey}
                        field="expectedSalesPerWeightedMin" onSave={handleSave} dim={r.manualSales == null} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <EditCell value={r.manualProfit ?? r.profitPerMin} uniqueKey={r.uniqueKey}
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
    {forecastCoachOpen && (
      <CoachMark steps={FORECAST_COACH_STEPS} stepIndex={forecastCoachStep} onStepChange={setForecastCoachStep} onClose={closeForecastCoach} />
    )}
    </div>
  )
}
