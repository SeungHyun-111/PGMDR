import { useMemo, useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, LabelList, ResponsiveContainer } from 'recharts'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { db, ref, get } from '../api/firebase'
import StatusScheduled from '../components/status/StatusScheduled'
import StatusUnscheduled from '../components/status/StatusUnscheduled'
import StatusLogs from '../components/status/StatusLogs'
import { GRADES, GRADE_META, getGrade, getEffectiveProfit } from '../utils/grade'

const TEAM_COLORS = ['#818cf8','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#4ade80','#f87171','#fbbf24','#2dd4bf']

// ── 원형 대 가로막대형 차트 ──────────────────────────────────────────────
function GradeDonutChart({ items, selectedGrade, onGradeSelect }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const total = items.length

  // S→A→B→C→D 순서 유지, 값 0인 등급도 포함(회색 처리)
  const gradeData = useMemo(() =>
    GRADES.map(g => ({ name: g, value: items.filter(i => i._grade === g).length, color: GRADE_META[g].color }))
  , [items])

  const filledGradeData = gradeData.filter(d => d.value > 0)

  const activeGrade = hoverIdx !== null ? filledGradeData[hoverIdx]?.name : selectedGrade

  // 팀별 집계 (가로막대용) — 건수 내림차순 상위 9
  const teamData = useMemo(() => {
    const source = activeGrade
      ? items.filter(i => i._grade === activeGrade)
      : items
    const acc = {}
    source.forEach(i => { acc[i._team] = (acc[i._team] || 0) + 1 })
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 9)
      .map(([name, value]) => ({ name, value }))
  }, [items, activeGrade])

  const activeCnt = activeGrade ? items.filter(i => i._grade === activeGrade).length : total
  const barColor  = activeGrade ? GRADE_META[activeGrade].color : 'var(--accent)'

  const CHART_H = 240

  const renderGradeLabel = ({ x, y, name, value, percent, cx }) => {
    if (value === 0) return null
    const pct = (percent * 100).toFixed(0)
    const anchor = x > cx ? 'start' : 'end'
    return (
      <g>
        <text x={x} y={y - 4} textAnchor={anchor} fill={GRADE_META[name]?.color} fontSize={11} fontWeight={800}>{name}</text>
        <text x={x} y={y + 9}  textAnchor={anchor} fill="#888" fontSize={9}>{value}건 {pct}%</text>
      </g>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>

      {/* ── 왼쪽: 도넛 원형 차트 ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <PieChart width={320} height={240}>
          <Pie data={filledGradeData} cx={150} cy={120}
            innerRadius={62} outerRadius={88}
            startAngle={90} endAngle={-270}
            dataKey="value"
            label={renderGradeLabel}
            labelLine={{ stroke: '#555', strokeWidth: 1 }}
            onMouseEnter={(_, idx) => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={(_, idx) => {
              const g = filledGradeData[idx]?.name
              onGradeSelect(selectedGrade === g ? null : g)
            }}
            isAnimationActive={false} stroke="none">
            {filledGradeData.map(d => (
              <Cell key={d.name} fill={d.color}
                opacity={selectedGrade && selectedGrade !== d.name ? 0.18 : 1}
                style={{ cursor: 'pointer', filter: selectedGrade === d.name ? `drop-shadow(0 0 4px ${d.color}88)` : 'none' }} />
            ))}
          </Pie>
        </PieChart>

        {/* 중앙 */}
        <div style={{ position: 'absolute', top: 120, left: 150, transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          {activeGrade ? (
            <>
              <div style={{ fontSize: 26, fontWeight: 900, color: GRADE_META[activeGrade].color, lineHeight: 1 }}>{activeGrade}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{activeCnt}건</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>전체</div>
            </>
          )}
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div style={{ width: 1, height: CHART_H, background: 'var(--border)', flexShrink: 0, margin: '0 16px' }} />

      {/* ── 오른쪽: 가로 막대형 차트 ── */}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: activeGrade ? GRADE_META[activeGrade].color : 'var(--text2)' }}>
            {activeGrade ? `${activeGrade}등급` : '전체'}
          </span>
          <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>팀별 분포 ({activeCnt}건)</span>
          {!activeGrade && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10, marginLeft: 6 }}>— 등급 클릭 시 해당 등급만 표시</span>}
        </div>
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={teamData} layout="vertical"
            margin={{ top: 0, right: 40, left: 6, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={72}
              tick={{ fontSize: 10, fill: 'var(--text2)' }} axisLine={false} tickLine={false} />
            <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--text3)', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 등급 범례 클릭 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {GRADES.map(g => {
            const cnt = items.filter(i => i._grade === g).length
            return (
              <button key={g} onClick={() => onGradeSelect(selectedGrade === g ? null : g)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${selectedGrade === g ? GRADE_META[g].color : 'var(--border)'}`, background: selectedGrade === g ? GRADE_META[g].bg : 'transparent', transition: 'all .12s' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: GRADE_META[g].color, flexShrink: 0, display: 'inline-block', opacity: cnt > 0 ? 1 : 0.3 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cnt > 0 ? GRADE_META[g].color : 'var(--text3)' }}>{g}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{cnt}</span>
              </button>
            )
          })}
          {selectedGrade && (
            <button onClick={() => onGradeSelect(null)}
              style={{ padding: '3px 9px', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', fontSize: 10, color: 'var(--text3)' }}>
              전체 보기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default function ScheduleStatus() {
  const { scheduleBlocks, proposalItems, startDate, poolType, perfMap, manualInputs } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [tab, setTab]             = useState('all')
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [logs, setLogs]           = useState([])

  // 편성 블록 → 등급/팀 enrichment (경쟁 블록 제외)
  const enrichedBlocks = useMemo(() =>
    Object.values(scheduleBlocks)
      .filter(b => !b.isDefault && !b.isCompeting)
      .map(b => ({
        ...b,
        mdCategory: b.mdCategory || categoryMap[b.pgmCodeName] || '미분류',
        _grade: getGrade(getEffectiveProfit(b.perfKey, perfMap, manualInputs)),
        _team:  b.mdTeam || b.orgName || '미지정',
      }))
  , [scheduleBlocks, categoryMap, perfMap, manualInputs])

  // 경쟁 블록은 별도 (등급 없음)
  const competingBlocks = useMemo(() =>
    Object.values(scheduleBlocks).filter(b => !b.isDefault && b.isCompeting)
  , [scheduleBlocks])

  // 미편성 아이템
  const enrichedItems = useMemo(() =>
    proposalItems.map(i => ({
      ...i,
      _grade: getGrade(getEffectiveProfit(i.perfKey, perfMap, manualInputs)),
      _team:  i.mdTeam || i.team || '미지정',
    }))
  , [proposalItems, perfMap, manualInputs])

  // 전체 (편성+미편성)
  const allItems = useMemo(() => [...enrichedBlocks, ...enrichedItems], [enrichedBlocks, enrichedItems])

  // 등급 필터 적용
  const filteredBlocks = useMemo(() =>
    selectedGrade ? enrichedBlocks.filter(b => b._grade === selectedGrade) : enrichedBlocks
  , [enrichedBlocks, selectedGrade])

  const filteredItems = useMemo(() =>
    selectedGrade ? enrichedItems.filter(i => i._grade === selectedGrade) : enrichedItems
  , [enrichedItems, selectedGrade])

  // 변경이력
  useEffect(() => {
    if (!startDate) return
    get(ref(db, `sessions/${startDate}_${poolType}/logs`)).then(snap => {
      const val = snap.val() || {}
      setLogs(Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    })
  }, [startDate, poolType])

  const handleGradeSelect = g => { setSelectedGrade(prev => prev === g ? null : g) }

  const chartItems = tab === 'scheduled' ? enrichedBlocks : tab === 'unscheduled' ? enrichedItems : allItems
  const chartTitle = tab === 'scheduled' ? '편성 상품 등급 분포' : tab === 'unscheduled' ? '미편성 제안 상품 등급 분포' : '전체 상품 등급 분포'

  const btnStyle = active => ({
    padding: '5px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 400,
    background: active ? 'var(--accent)' : 'var(--bg3)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? '#fff' : 'var(--text2)',
  })

  const hasGradeFilter = !!selectedGrade

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      {/* 탭 + 등급 필터 초기화 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button style={btnStyle(tab === 'all')}          onClick={() => setTab('all')}>전체 {enrichedBlocks.length + enrichedItems.length}</button>
        <button style={btnStyle(tab === 'scheduled')}    onClick={() => setTab('scheduled')}>편성완료 {enrichedBlocks.length + competingBlocks.length}</button>
        <button style={btnStyle(tab === 'unscheduled')}  onClick={() => setTab('unscheduled')}>미편성 {proposalItems.length}</button>
        <button style={btnStyle(tab === 'logs')}         onClick={() => setTab('logs')}>변경이력 {logs.length}</button>
        {hasGradeFilter && (
          <button onClick={() => setSelectedGrade(null)}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: GRADE_META[selectedGrade].bg, border: `1px solid ${GRADE_META[selectedGrade].color}`, color: GRADE_META[selectedGrade].color, fontWeight: 700 }}>
            {selectedGrade}등급 필터 ✕
          </button>
        )}
      </div>

      {tab !== 'logs' && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>{chartTitle} <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 10 }}>— 한계이익/가중분 기준 · 등급 클릭 시 테이블 필터</span></div>
          <GradeDonutChart items={chartItems} selectedGrade={selectedGrade} onGradeSelect={handleGradeSelect} />
        </div>
      )}

      {/* 테이블 */}
      {tab === 'all' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', margin: '10px 0 6px' }}>
            편성완료 {hasGradeFilter ? `(${selectedGrade}등급 ${filteredBlocks.length}건)` : `${enrichedBlocks.length}건`}
          </div>
          <StatusScheduled rows={filteredBlocks} competing={competingBlocks} perfMap={perfMap} manualInputs={manualInputs} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 6px' }}>
            미편성 {hasGradeFilter ? `(${selectedGrade}등급 ${filteredItems.length}건)` : `${proposalItems.length}건`}
          </div>
          <StatusUnscheduled rows={filteredItems} perfMap={perfMap} manualInputs={manualInputs} />
        </>
      )}
      {tab === 'scheduled'   && <StatusScheduled   rows={filteredBlocks} competing={competingBlocks} perfMap={perfMap} manualInputs={manualInputs} />}
      {tab === 'unscheduled' && <StatusUnscheduled rows={filteredItems}  perfMap={perfMap} manualInputs={manualInputs} />}
      {tab === 'logs'        && <StatusLogs logs={logs} />}
    </div>
  )
}
