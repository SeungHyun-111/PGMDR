import { useMemo } from 'react'
import { useReducedMotion } from 'motion/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import UrbanSurface from '../forecast/UrbanSurface'
import { summarizePerformance } from '../../utils/promotionStatistics'

const format = value => value == null ? '—' : Number(value).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const compact = value => `${(value / 10000).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}만`
// Separate padded ranges expose changes without forcing either series to zero.
function promotionTrendDomain([min, max]) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  const padding = Math.max((max - min) * .18, Math.max(Math.abs(min), Math.abs(max)) * .03, 1)
  return [min >= 0 ? Math.max(0, min - padding) : min - padding, max + padding]
}
const tip = { background:'#203950', border:'1px solid #dceeff55', borderRadius:10, color:'#f3f8ff', fontSize:11 }
function PromotionChartTooltip({ active, payload, label, comparison = false }) {
  if (!active || !payload?.length) return null
  const values = payload.filter(item => item.value != null)
  const row = payload[0].payload
  const difference = row.promotion != null && row.outside != null ? row.promotion - row.outside : null
  const rate = difference !== null && row.outside !== 0 ? difference / Math.abs(row.outside) * 100 : null
  const signed = value => `${value > 0 ? '+' : ''}${format(value)}`
  return <div className="promotion-chart-tooltip" style={{...tip,padding:'12px 15px',minWidth:190}}>
    <strong>{label}</strong>
    {values.map(item => <div key={item.dataKey} className="promotion-chart-tooltip-row"><span><i style={{background:item.color}}/>{item.name}</span><b>{format(item.value)} 원/분</b></div>)}
    {comparison && <div className="promotion-chart-tooltip-difference"><small>프로모션 − 프로모션 外</small><div><span>차이 금액</span><b>{difference === null ? '—' : `${signed(difference)} 원/분`}</b></div><div><span>증감률</span><b>{rate === null ? '—' : `${rate > 0 ? '+' : ''}${Number(rate).toFixed(1)}%`}</b></div></div>}
  </div>
}
export default function UrbanPromotionDashboard({ rows, statistics, loading }) {
  const reduced = useReducedMotion()
  const { promotion, outside } = statistics
  const daily = useMemo(() => {
    const dates = new Map()
    rows.forEach(([, row]) => { const date = row.broadcastDate; if (!dates.has(date)) dates.set(date, []); dates.get(date).push(row) })
    return [...dates].sort(([a],[b]) => a.localeCompare(b)).map(([date, group]) => ({ date:date.slice(5), ...summarizePerformance(group) }))
  }, [rows])
  const comparison = [{ name:'가중분당취급액', promotion:promotion.salesPerMin, outside:outside.salesPerMin }, { name:'가중분당한계이익액', promotion:promotion.profitPerMin, outside:outside.profitPerMin }]
  const cards = [['예상취급고', promotion.expectedSales, '원', `취급달성률 ${promotion.salesAchievement == null ? '—' : `${Number(promotion.salesAchievement*100).toFixed(1)}%`}`, 'blue'], ['예상한계이익액', promotion.contributionProfit, '원', `이익달성률 ${promotion.profitAchievement == null ? '—' : `${Number(promotion.profitAchievement*100).toFixed(1)}%`}`, 'warm'], ['가중분당취급액', promotion.salesPerMin, '원/분', `가중분 ${format(promotion.weightedMin)}분`, 'plain'], ['가중분당한계이익액', promotion.profitPerMin, '원/분', `적용 방송 ${format(promotion.count)}건`, 'plain']]
  return <div className="promotion-urban-dashboard">
    <div className="urban-metrics">{cards.map(([label,value,unit,caption,tone],i) => <UrbanSurface key={label} order={i} className={`urban-metric urban-metric--${tone}`}><span className="urban-eyebrow">{label}</span><div className="urban-number">{loading ? '…' : format(value)}<small>{unit}</small></div><p>{loading ? '실적 조회 중' : caption}</p></UrbanSurface>)}</div>
    <div className="urban-group-grid">
      <UrbanSurface order={4} className="urban-chart-card"><div className="urban-panel-heading"><div><h3>일별 프로모션 실적</h3><p>현재 기간·심야·무형·조직·카테고리 필터 적용 · 원/분 · 좌: 취급액 / 우: 한계이익 · 축별 자동 범위</p></div></div>{!loading && daily.length ? <ResponsiveContainer width="100%" height={230}><AreaChart data={daily} margin={{left:4,right:4,top:10,bottom:0}}><defs><linearGradient id="promotion-sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a4ccff" stopOpacity={.45}/><stop offset="100%" stopColor="#a4ccff" stopOpacity={.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#dfedff20"/><XAxis dataKey="date" tick={{fill:'#dbeaff',fontSize:10}} axisLine={false} tickLine={false}/><YAxis yAxisId="sales" domain={promotionTrendDomain} tickFormatter={compact} tick={{fill:'#accfff',fontSize:10}} axisLine={false} tickLine={false} width={62}/><YAxis yAxisId="profit" orientation="right" domain={promotionTrendDomain} tickFormatter={compact} tick={{fill:'#f0c3a1',fontSize:10}} axisLine={false} tickLine={false} width={62}/><Tooltip content={<PromotionChartTooltip/>}/><Area yAxisId="sales" name="가중분당취급액" dataKey="salesPerMin" type="monotone" stroke="#accfff" fill="url(#promotion-sales-fill)" strokeWidth={2} isAnimationActive={!reduced}/><Area yAxisId="profit" name="가중분당한계이익액" dataKey="profitPerMin" type="monotone" stroke="#f0c3a1" fill="transparent" strokeWidth={2} isAnimationActive={!reduced}/></AreaChart></ResponsiveContainer> : <div className="urban-empty">{loading ? '실적을 불러오는 중입니다.' : '현재 필터에 해당하는 실적이 없습니다.'}</div>}</UrbanSurface>
      <UrbanSurface order={5} className="urban-chart-card"><div className="urban-panel-heading"><div><h3>일반 PGM 대비 분당 실적</h3><p>프로모션 外 = 같은 기간·필터에서 선택 프로모션 외 방송</p></div><div className="urban-chart-key"><i/>프로모션 <i className="is-target"/>프로모션 外</div></div>{!loading && promotion.count ? <ResponsiveContainer width="100%" height={230}><BarChart data={comparison} margin={{left:8,right:10,top:10,bottom:0}}><CartesianGrid vertical={false} stroke="#dfedff20"/><XAxis dataKey="name" tick={{fill:'#dbeaff',fontSize:11}} axisLine={false} tickLine={false}/><YAxis tickFormatter={v=>`${Number(v/10000).toFixed(1)}만`} tick={{fill:'#dbeaff',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<PromotionChartTooltip comparison/>}/><Bar name="프로모션" dataKey="promotion" fill="#a8ccff" radius={[5,5,0,0]} maxBarSize={45} isAnimationActive={!reduced}/><Bar name="프로모션 外" dataKey="outside" fill="#efbf9e" radius={[5,5,0,0]} maxBarSize={45} isAnimationActive={!reduced}/></BarChart></ResponsiveContainer> : <div className="urban-empty">{loading ? '실적을 불러오는 중입니다.' : '비교할 실적이 없습니다.'}</div>}</UrbanSurface>
    </div>
  </div>
}
