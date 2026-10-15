import { useMemo } from 'react'
import usePerformanceQuery from '../../hooks/usePerformanceQuery'
import { getPromotionPreviousThree } from '../../utils/promotionResults'
import { makePerfKey } from '../../hooks/usePerformanceMap'

const number = value => value == null ? '—' : Math.trunc(Number(value)).toLocaleString('ko-KR')

export default function PreviousPerformance({ row, promotionStart }) {
  const key = row.perfKey || makePerfKey(row.dealTypeConverted || row.dealType2 || row.dealType, row.pgmCodeName)
  const { rows, loading, error, retry } = usePerformanceQuery('product', key)
  const entries = useMemo(() => getPromotionPreviousThree(rows, promotionStart, key), [rows, promotionStart, key])
  return (
    <div className="promotion-previous-performance">
      <strong>직전 3회 · 프로모션 시작일 {promotionStart} 이전 3개월 · 프로모션 기간 내 방송 및 심야 제외</strong>
      {loading ? <p>해당 상품 이력을 불러오는 중입니다.</p> : error ? <p role="alert">{error} <button type="button" onClick={retry}>다시 시도</button></p> : entries.length ? (
        <div className="promotion-previous-list">
          {entries.map(entry => <div key={entry.broadcastTimestamp}><b>{entry.broadcastDate} {entry.broadcastTime}</b><span>예상취급고 {number(entry.expectedSales)}</span><span>한계이익 {number(entry.contributionProfit)}</span><span>(연동)미리주문취급액 {number(entry.preorderExpectedSales)}</span></div>)}
        </div>
      ) : <p>조건에 맞는 직전 실적이 없습니다.</p>}
    </div>
  )
}
