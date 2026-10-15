import PromotionChangeValue from './PromotionChangeValue'
import { lazy, Suspense } from 'react'
import PromotionFormulaTooltip from './PromotionFormulaTooltip'
import { formatPercentagePointDifference, formatPreorderShare, summarizePerformance } from '../../utils/promotionStatistics'
const PromotionHistoryTooltipChart = lazy(() => import('./PromotionHistoryTooltipChart'))

const number = value => Math.trunc(Number(value) || 0).toLocaleString('ko-KR')
const broadcastInfo = entry => {
  if (!entry) return '실적 없음'
  const digits = String(entry.broadcastDate || '').replace(/\D/g, '').slice(0, 8)
  const date = digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : '—'
  return `${date} ${entry.multiChannel || entry.channel || '—'}`
}
const amountDifference = (current, average) => {
  if (!Number.isFinite(current) || !Number.isFinite(average)) return '—'
  const difference = Math.trunc(current - average)
  return `${difference > 0 ? '+' : ''}${number(difference)}`
}

export default function PromotionPreviousTooltip({ row, previous = [], loading, failed }) {
  const average = summarizePerformance(previous)
  const current = summarizePerformance([row])
  const comparisons = [
    ['평균', average],
    ...[0, 1, 2].map(index => [`P-${index + 1}`, summarizePerformance(previous[index] ? [previous[index]] : []), broadcastInfo(previous[index])]),
  ]
  const text = loading ? '직전 3회 실적을 불러오는 중입니다.' : failed ? '직전 실적 조회에 실패했습니다. 표의 재시도 버튼을 눌러주세요.' : (
    <><table className="promotion-previous-tooltip-table">
      <thead><tr><th>구분</th><th>가중분당취급액</th><th>가중분당한계이익액</th><th>(연동)미리주문 비중</th></tr></thead>
      <tbody>
        {comparisons.map(([label, baseline, info]) => <tr key={label}>
          <th>{label}{info && <span className="promotion-previous-broadcast-info"> ({info})</span>}</th>
          <td>{number(baseline.salesPerMin)}<small>(<PromotionChangeValue>{amountDifference(current.salesPerMin, baseline.salesPerMin)}</PromotionChangeValue>)</small></td>
          <td>{number(baseline.profitPerMin)}<small>(<PromotionChangeValue>{amountDifference(current.profitPerMin, baseline.profitPerMin)}</PromotionChangeValue>)</small></td>
          <td>{formatPreorderShare(baseline.preorderShare || 0)}<small>(<PromotionChangeValue>{formatPercentagePointDifference(current.preorderShare, baseline.preorderShare)}</PromotionChangeValue>)</small></td>
        </tr>)}
      </tbody>
    </table>
      <Suspense fallback={<p>차트를 불러오는 중입니다…</p>}><PromotionHistoryTooltipChart row={row} previous={previous} /></Suspense>
    </>
  )
  return <PromotionFormulaTooltip label={`${row.pgmCodeName} 직전 3회`} suffix="" text={text} maxWidth={760} centered />
}
