import { useEffect, useId, useState } from 'react'
import NumberFlow from '@number-flow/react'
import { useReducedMotion } from 'motion/react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import UrbanSurface from './UrbanSurface'
import { DailyTeamTip, ChartTip } from './ForecastTooltips'

const palette = ['#82b8ff', '#b9dcff', '#ffba86', '#85d8cd', '#afa9eb', '#deb5cd', '#9ec5da', '#dcd3b5']
const fmt = value => Math.round(Number(value) || 0).toLocaleString('ko-KR')
const compact = value => Math.abs(value) >= 100000000 ? `${(value / 100000000).toFixed(1)}억` : Math.abs(value) >= 10000 ? `${(value / 10000).toFixed(1)}만` : fmt(value)
function Icon({ kind = 'chart' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'chart' ? <><path d="M4 19h16M7 15v-4m5 4V6m5 9V9"/><path d="m6 7 5-4 5 2 4-3"/></> : kind === 'clock' ? <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></> : kind === 'check' ? <><path d="m12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7l8-4Z"/><path d="m8 12 3 3 5-6"/></> : <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>}
  </svg>
}
function Counter({ value, order = 0, suffix }) {
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setReady(true), reduced ? 0 : 300 + order * 85); return () => clearTimeout(timer) }, [order, reduced])
  return <><NumberFlow value={ready || reduced ? Number(value) || 0 : 0} locales="ko-KR" format={{ maximumFractionDigits: suffix === '%' ? 1 : 0 }} />{suffix && <small>{suffix}</small>}</>
}
function Sparkline({ values }) {
  if (!values.length) return null
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = max - min || 1
  const points = values.map((v, i) => `${values.length > 1 ? i / (values.length - 1) * 180 : 90},${42 - (v - min) / span * 36}`).join(' ')
  return <svg className="urban-spark" viewBox="0 0 180 48" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
}
function MetricCard({ label, value, unit, detail, badge, kind, tone, order, values }) {
  return <UrbanSurface order={order} className={`urban-metric urban-metric--${tone || 'neutral'}`}>
    <div className="urban-metric-head"><span className="urban-icon"><Icon kind={kind}/></span>{badge && <span className="urban-badge">{badge}</span>}</div>
    <span className="urban-eyebrow">{label}</span><div className="urban-number"><Counter value={value} suffix={unit} order={order}/></div>
    <p>{detail}</p><Sparkline values={values || []}/>
  </UrbanSurface>
}
function PanelHeading({ title, subtitle, children }) {
  return <header className="urban-panel-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{children}</header>
}
function GroupChart({ groups, metric, title, order }) {
  const reduced = useReducedMotion()
  const profit = metric === 'profit', key = profit ? 'profitPerMin' : 'salesPerMin', target = profit ? 'effectiveTargetProfitPerMin' : 'effectiveTargetSalesPerMin'
  return <UrbanSurface order={order} className="urban-chart-card"><PanelHeading title={title} subtitle="분당 실적 · 목표 대비 편성 효율"><span className="urban-chart-key"><i/>편성 <i className="is-target"/>목표</span></PanelHeading>
    {!groups.length ? <div className="urban-empty">해당 기간의 편성이 없습니다.</div> : <ResponsiveContainer width="100%" height={Math.max(230, groups.length * 45)}>
      <BarChart data={groups} layout="vertical" margin={{ left: 12, right: 25, top: 8, bottom: 0 }} barGap={3}>
        <CartesianGrid horizontal={false} stroke="rgba(229,242,255,.12)" strokeDasharray="3 5"/>
        <XAxis type="number" domain={['auto','auto']} tickFormatter={compact} tick={{ fill: '#d6e5f6', fontSize: 10 }} axisLine={false} tickLine={false}/>
        <YAxis type="category" dataKey="name" width={85} tick={{ fill: '#edf5ff', fontSize: 11 }} axisLine={false} tickLine={false}/>
        <Tooltip content={<ChartTip/>} cursor={{ fill: 'rgba(230,243,255,.045)' }}/>
        <Bar dataKey={target} name="목표" fill="rgba(218,234,255,.23)" radius={[0,5,5,0]} barSize={5} isAnimationActive={false}/>
        <Bar dataKey={key} name="편성" radius={[0,5,5,0]} barSize={11} isAnimationActive={!reduced} animationBegin={400 + order * 85} animationDuration={700}>
          {groups.map((g,i)=><Cell key={g.name} fill={profit ? '#91d8cc' : palette[i % palette.length]}/>)}</Bar>
      </BarChart>
    </ResponsiveContainer>}
  </UrbanSurface>
}

export default function UrbanForecastDashboard({ summary, companyTotal, dailyData, dailyTeamData, groups, groupBy, groupToggle, selectedDate, setSelectedDate,
  avgDailySalesMin, avgDailyProfitMin, pgmTeamRows, simSpm, simPpm, onSalesChange, onProfitChange }) {
  const [metric, setMetric] = useState('sales')
  const reduced = useReducedMotion()
  const rawId = useId(), id = rawId.replace(/[^a-zA-Z0-9]/g, '')
  const profit = metric === 'profit', metricKey = profit ? 'profitPerMin' : 'salesPerMin'
  const avg = profit ? avgDailyProfitMin : avgDailySalesMin, target = profit ? companyTotal?.profitPerMin : companyTotal?.salesPerMin
  const volumeTotal = groups.reduce((s,g)=>s+Math.max(0,g[metric] || 0),0)
  const hasNegative = groups.some(g=>(g[metric] || 0)<0)
  const pgmWm = pgmTeamRows.reduce((s,r)=>s+Number(r.weightedMin || 0),0)
  const achieve = (value, targetValue) => targetValue > 0 ? `목표 ${(value / targetValue * 100).toFixed(1)}%` : '목표 미설정'
  return <div className="urban-dashboard">
    <div className="urban-section-title"><div><span>PERFORMANCE OUTLOOK</span><h2>편성 실적 시뮬레이션</h2></div><span className="urban-period">{dailyData[0]?.date || '조회기간'}{dailyData.length > 1 ? ` — ${dailyData.at(-1).date}` : ''}</span></div>
    <div className="urban-metrics" data-coach="forecast-hero">
      <MetricCard order={0} tone="blue" kind="chart" label="예상 분당취급고" value={summary.salesPerMin} unit="원/분" detail={`총 예상 취급고 ${compact(summary.sales)}원`} badge={achieve(summary.salesPerMin,companyTotal?.salesPerMin)} values={dailyData.map(d=>d.salesPerMin)}/>
      <MetricCard order={1} tone="warm" kind="layers" label="예상 분당한계이익" value={summary.profitPerMin} unit="원/분" detail={`총 예상 한계이익 ${compact(summary.profit)}원`} badge={achieve(summary.profitPerMin,companyTotal?.profitPerMin)} values={dailyData.map(d=>d.profitPerMin)}/>
      <MetricCard order={2} kind="clock" label="총 편성 가중분" value={summary.wm} unit="분" detail={`편성 슬롯 ${fmt(summary.count)}개`} badge="편성 기준" values={dailyData.map(d=>d.wm)}/>
      <MetricCard order={3} kind="check" label="실적 입력률" value={summary.perfRate} unit="%" detail={`직전 실적 미확인 ${fmt(summary.missingCount)}건`} badge={summary.missingCount ? '입력 확인' : '입력 완료'}/>
    </div>
    <div className="urban-summary-strip"><span>편성률 <b>{summary.scheduleRate.toFixed(1)}%</b></span><span>전체 가중분 <b>{fmt(summary.totalSlotWm)}분</b></span><span>전체 슬롯 <b>{fmt(summary.totalSlotCount)}개</b></span><span>목표 취급고 <b>{companyTotal?.salesPerMin > 0 ? `${compact(companyTotal.salesPerMin * summary.totalSlotWm)}원` : '미설정'}</b></span><span>목표 한계이익 <b>{companyTotal?.profitPerMin > 0 ? `${compact(companyTotal.profitPerMin * summary.totalSlotWm)}원` : '미설정'}</b></span></div>
    <div className="urban-overview">
      <UrbanSurface order={4} className="urban-chart-card urban-trend" data-coach="forecast-daily">
        <PanelHeading title="일자별 실적 흐름" subtitle="미입력 실적 0 포함 · 가중분 기준 분당 실적">
          <div className="urban-segment" aria-label="실적 지표">{['sales','profit'].map(v=><button key={v} type="button" aria-pressed={metric===v} onClick={()=>setMetric(v)}>{v==='sales'?'취급고':'한계이익'}</button>)}</div>
        </PanelHeading>
        <div className="urban-trend-summary"><strong>{fmt(profit ? summary.profitPerMin : summary.salesPerMin)}<small>원/분</small></strong>
          {selectedDate ? <button className="urban-reset" onClick={()=>setSelectedDate(null)}>{selectedDate} 선택 해제 ×</button> : <span>그래프의 날짜를 선택해 상세 내역을 확인하세요.</span>}</div>
        {!dailyData.length ? <div className="urban-empty">편성을 추가하면 일자별 예상 실적이 표시됩니다.</div> : <ResponsiveContainer width="100%" height={290}>
          <AreaChart data={dailyData} margin={{ top: 22, right: 18, bottom: 12, left: 0 }} onClick={state=>{if(state?.activeTooltipIndex==null)return;const d=dailyData[Number(state.activeTooltipIndex)];if(d)setSelectedDate(selectedDate===d.date?null:d.date)}}>
            <defs><linearGradient id={`urban-area-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={profit?'#91d8cc':'#84baff'} stopOpacity={.5}/><stop offset="100%" stopColor="#84baff" stopOpacity={.01}/></linearGradient></defs>
            <CartesianGrid stroke="rgba(230,242,255,.14)" vertical={false} strokeDasharray="3 5"/>
            <XAxis dataKey="label" tick={{fill:'#dce9f8',fontSize:10}} axisLine={false} tickLine={false} minTickGap={20}/>
            <YAxis domain={['auto','auto']} width={55} tickFormatter={compact} tick={{fill:'#dce9f8',fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<DailyTeamTip dailyTeamData={dailyTeamData} metric={metric}/>} cursor={{ stroke:'rgba(245,250,255,.5)',strokeDasharray:'3 4' }}/>
            <ReferenceLine y={avg} stroke="rgba(208,230,255,.65)" strokeDasharray="5 5"/>
            {target > 0 && <ReferenceLine y={target} stroke="#ffc293" strokeDasharray="4 5"/>}
            <Area key={metric} type="monotone" dataKey={metricKey} stroke={profit?'#b7f2e7':'#d5e9ff'} strokeWidth={2.2} fill={`url(#urban-area-${id})`} dot={dailyData.length===1?{r:4,fill:'#fff'}:false} activeDot={{r:5,fill:'#ffd1a1',stroke:'#fff',strokeWidth:2}} isAnimationActive={!reduced} animationBegin={550} animationDuration={1000}/>
          </AreaChart>
        </ResponsiveContainer>}
        <div className="urban-chart-footer" data-coach="forecast-target"><span>평균 <b>{fmt(avg)}</b></span><span>전사 목표 <b>{target > 0 ? fmt(target) : '미설정'}</b></span></div>
      </UrbanSurface>
      <UrbanSurface order={5} className="urban-chart-card urban-volume" data-coach="forecast-volume">
        <PanelHeading title={`${groupBy==='team'?'팀별':'카테고리별'} ${profit?'한익':'취급고'} 비중`} subtitle={hasNegative?'비중은 양수 금액 기준':'동일 기간의 예상 실적 구성'}><div data-coach="forecast-group-toggle">{groupToggle}</div></PanelHeading>
        {volumeTotal > 0 ? <div className="urban-donut"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={groups.map(g=>({...g,amount:Math.max(0,g[metric] || 0)}))} dataKey="amount" nameKey="name" innerRadius={73} outerRadius={94} paddingAngle={3} cornerRadius={5} stroke="rgba(238,247,255,.45)" strokeWidth={.8} isAnimationActive={!reduced} animationBegin={650} animationDuration={900}>
          {groups.map((g,i)=><Cell key={g.name} fill={palette[i%palette.length]}/>)}</Pie><Tooltip formatter={value=>`${fmt(value)}원`} contentStyle={{background:'#20314b',border:'1px solid #d9eaff55',borderRadius:12,color:'#fff'}}/></PieChart></ResponsiveContainer><div className="urban-donut-label"><strong>{compact(volumeTotal)}</strong><span>{hasNegative?'양수 실적 합계':'예상 실적 합계'}</span></div></div> : <div className="urban-empty">집계할 양수 실적이 없습니다.</div>}
        <div className="urban-volume-legend">{groups.map((g,i)=><div key={g.name}><i style={{background:palette[i%palette.length]}}/><span>{g.name}</span><b>{volumeTotal > 0 ? (Math.max(0,g[metric] || 0)/volumeTotal*100).toFixed(1) : '0.0'}%</b><small>{compact(g[metric] || 0)}</small></div>)}</div>
      </UrbanSurface>
    </div>
    <div className="urban-group-grid" data-coach="forecast-group-charts">
      <GroupChart order={6} groups={groups} metric="sales" title={`${groupBy==='team'?'팀별':'카테고리별'} 취급 효율`}/>
      <GroupChart order={7} groups={groups} metric="profit" title={`${groupBy==='team'?'팀별':'카테고리별'} 한익 효율`}/>
    </div>
    <UrbanSurface order={6} className="urban-pgm-editor" data-coach="forecast-pgm-team"><div><span className="urban-eyebrow">SCENARIO INPUT</span><h3>전사블록 시뮬레이션</h3><p>편성팀 {pgmTeamRows.length}개 슬롯 · 가중분 {fmt(pgmWm)}분</p></div>
      <label>분당취급고 <span>원/분</span><input aria-label="전사블록 분당취급고" value={simSpm} placeholder={companyTotal?.salesPerMin > 0 ? fmt(companyTotal.salesPerMin) : '목표 없음'} onChange={e=>onSalesChange(e.target.value)}/></label>
      <label>분당한계이익 <span>원/분</span><input aria-label="전사블록 분당한계이익" value={simPpm} placeholder={companyTotal?.profitPerMin > 0 ? fmt(companyTotal.profitPerMin) : '목표 없음'} onChange={e=>onProfitChange(e.target.value)}/></label>
    </UrbanSurface>
  </div>
}
