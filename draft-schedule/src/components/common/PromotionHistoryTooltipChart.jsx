import { useMemo } from 'react'
import { curveLinear } from '@visx/curve'
import { ComposedChart } from '../charts/composed-chart'
import { SeriesBar } from '../charts/series-bar'
import { Line } from '../charts/line'
import { Grid } from '../charts/grid'
import { XAxis } from '../charts/x-axis'
import { YAxis } from '../charts/y-axis'
import { ChartTooltip } from '../charts/tooltip/chart-tooltip'
import { buildPromotionHistoryChart } from '../../utils/promotionHistoryChart'
import { formatPreorderShare } from '../../utils/promotionStatistics'
import '../ui/charts/charts.css'

const colors = { sales: '#3b82f6', profit: '#8b5cf6', preorder: '#10b981' }
const won = value => `${Math.trunc(value).toLocaleString('ko-KR')}원`

export default function PromotionHistoryTooltipChart({ row, previous }) {
  const data = useMemo(() => buildPromotionHistoryChart(row, previous), [row, previous])
  return <section className="promotion-history-chart" aria-label="직전 3회와 프로모션 실적 비교 차트">
    <div className="promotion-history-chart-heading"><strong>직전 3회 vs 프로모션</strong><span>왼쪽: 금액 · 오른쪽: 비중</span></div>
    <ComposedChart data={data} xDataKey="date" aspectRatio="2.6 / 1" maxBarSize={25} barGap={4} margin={{ top: 22, bottom: 36, left: 72, right: 70 }} animationDuration={450}>
      <Grid horizontal />
      <SeriesBar dataKey="salesPerMin" radius={3} fill={colors.sales} />
      <SeriesBar dataKey="profitPerMin" radius={3} fill={colors.profit} />
      <Line dataKey="avgSalesPerMin" stroke={colors.sales} strokeWidth={1.5} dashFromIndex={0} dashArray="5 4" curve={curveLinear} />
      <Line dataKey="avgProfitPerMin" stroke={colors.profit} strokeWidth={1.5} dashFromIndex={0} dashArray="5 4" curve={curveLinear} />
      <Line dataKey="preorderRatio" yAxisId="right" stroke={colors.preorder} strokeWidth={2.5} showMarkers curve={curveLinear} />
      <Line dataKey="avgPreorderRatio" yAxisId="right" stroke={colors.preorder} strokeWidth={1.5} dashFromIndex={0} dashArray="5 4" curve={curveLinear} />
      <YAxis yAxisId="left" numTicks={4} labelPadding={36} formatValue={value => `${Math.trunc(value / 10000).toLocaleString('ko-KR')}만`} />
      <YAxis yAxisId="right" orientation="right" numTicks={4} labelPadding={36} formatValue={value => `${Math.trunc(value)}%`} />
      <XAxis numTicks={4} formatValue={date => data[date.getDate() - 1]?.label || ''} />
      <ChartTooltip showCrosshair={false} showDatePill={false} showDots={false} content={({ point }) => <div className="promotion-history-chart-hover">
        <strong>{point.label} {point.missing ? '(실적 없음 · 0)' : `(${point.broadcastDate} ${point.channel})`}</strong>
        <div>가중분당취급액 <b>{won(point.salesPerMin)}</b></div>
        <div>가중분당한계이익액 <b>{won(point.profitPerMin)}</b></div>
        <div>(연동)미리주문 비중 <b>{formatPreorderShare(point.preorderRatio / 100)}</b></div>
      </div>} />
    </ComposedChart>
    <div className="promotion-history-chart-legend">
      <span><i style={{ background: colors.sales }} />가중분당취급액</span>
      <span><i style={{ background: colors.profit }} />가중분당한계이익액</span>
      <span><i className="is-line" style={{ background: colors.preorder }} />(연동)미리주문 비중</span>
      <span>점선 = 직전 3회 평균</span>
    </div>
  </section>
}
