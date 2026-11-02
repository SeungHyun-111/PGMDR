import { useReducedMotion } from 'motion/react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import UrbanSurface from '../forecast/UrbanSurface'
import { GRADES, GRADE_META } from '../../utils/grade'

const number = value => Math.round(value || 0).toLocaleString('ko-KR')
const tooltipStyle = { background:'#203950',border:'1px solid #dceeff55',borderRadius:10,color:'#f2f7ff',fontSize:11 }
export default function UrbanTeamDashboard({ summary, rows, team }) {
  const reduced = useReducedMotion()
  const status = [
    {name:'편성',value:rows.filter(row=>row._status==='편성').length,color:'#a6ccff'},
    {name:'경쟁',value:rows.filter(row=>row._status==='경쟁').length,color:'#f1c2a0'},
    {name:'미편성',value:summary.unscheduledCount,color:'#b9ace7'},
  ]
  const grades=GRADES.map(name=>({name,value:summary.grades[name] || 0,color:GRADE_META[name].color}))
  const cards=[['편성 가중분',summary.weightedMin,'분',`편성·경쟁 ${summary.scheduledCount}건`,'blue'],['미편성 가용 가중분',summary.availableWeightedMin,'분',`미편성 ${summary.unscheduledCount}건`,'warm'],['편성 취급 / 분',summary.salesAvg,'원/분','편성·경쟁 가중분 기준 평균','plain'],['편성 한계이익 / 분',summary.profitAvg,'원/분','편성·경쟁 가중분 기준 평균','plain']]
  return <div className="urban-team-dashboard" aria-label={`${team} 요약 대시보드`}>
    <div className="urban-metrics">{cards.map(([label,value,unit,caption,tone],i)=><UrbanSurface key={label} order={i} className={`urban-metric urban-metric--${tone}`}><span className="urban-eyebrow">{label}</span><div className="urban-number">{number(value)}<small>{unit}</small></div><p>{caption}</p></UrbanSurface>)}</div>
    <div className="urban-group-grid">
      <UrbanSurface order={4} className="urban-chart-card"><div className="urban-panel-heading"><div><h3>{team} · 편성 구성</h3><p>현재 상세 표의 상품 건수 기준 · 편성 / 경쟁 / 미편성</p></div></div><div className="urban-team-composition"><div className="urban-donut"><ResponsiveContainer width="100%" height={220}><PieChart><Tooltip contentStyle={tooltipStyle} formatter={v=>`${number(v)}건`}/><Pie data={status.filter(item=>item.value>0)} dataKey="value" nameKey="name" innerRadius={65} outerRadius={90} paddingAngle={3} stroke="none" isAnimationActive={!reduced}>{status.filter(item=>item.value>0).map(item=><Cell key={item.name} fill={item.color}/>)}</Pie></PieChart></ResponsiveContainer><div className="urban-donut-label"><strong>{number(rows.length)}</strong><span>전체 상품</span></div></div><div className="urban-team-legend">{status.map(item=><div key={item.name}><i style={{background:item.color}}/><span>{item.name}</span><b>{number(item.value)}건</b><small>{rows.length?(item.value/rows.length*100).toFixed(1):'0'}%</small></div>)}</div></div></UrbanSurface>
      <UrbanSurface order={5} className="urban-chart-card"><div className="urban-panel-heading"><div><h3>{team} · 등급 분포</h3><p>현재 상세 표와 동일한 등급 집계 · 경쟁 후보 포함</p></div></div><ResponsiveContainer width="100%" height={220}><BarChart data={grades} margin={{left:0,right:12,top:10,bottom:0}}><CartesianGrid vertical={false} stroke="#dcecff20"/><XAxis dataKey="name" tick={{fill:'#e1efff',fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:'#cde0f5',fontSize:10}} axisLine={false} tickLine={false} width={35}/><Tooltip contentStyle={tooltipStyle} formatter={v=>[`${number(v)}건`,'상품 수']}/><Bar dataKey="value" maxBarSize={42} radius={[5,5,0,0]} isAnimationActive={!reduced}>{grades.map(item=><Cell key={item.name} fill={item.color}/>)}</Bar></BarChart></ResponsiveContainer></UrbanSurface>
    </div>
  </div>
}
