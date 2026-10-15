import { percentChange, formatPercentagePointDifference as formatPoints, formatPreorderShare } from '../../utils/promotionStatistics'
import PromotionChangeValue from './PromotionChangeValue'
import PromotionFormulaTooltip from './PromotionFormulaTooltip'

const formulas = {
  coverage: '범위: 선택 프로모션 기간 중 실적이 있는 날까지, 현재 심야·무형·조직·카테고리 필터 적용.\n\n방송수 = 프로모션 지정 방송상품 행 수 / 같은 기간 전체 방송상품 행 수\n가중분 = 프로모션 방송 가중분 합계 / 전체 방송 가중분 합계\n가중분 비중 = 프로모션 가중분 합계 ÷ 전체 가중분 합계 × 100\n방송수는 채널 정보가 포함된 실적 한 행당 1 PGM으로 집계합니다.',
  comparison: '두 집단에 동일한 기간·심야·무형·조직·카테고리 필터를 적용합니다.\n무형 제외 = 문화서비스팀 방송 제외.\n프로모션 外 = 선택 프로모션이 지정되지 않은 방송(다른 프로모션 포함).\n\n가중분당취급액 = 예상취급고 합계 ÷ 가중분 합계\n가중분당한계이익액 = 예상한계이익액 합계 ÷ 가중분 합계\n취급달성률 = 예상취급고 합계 ÷ 목표취급액 합계 × 100\n한계이익액달성률 = 예상한계이익액 합계 ÷ 목표한계이익액 합계 × 100\n종합달성률 = 취급달성률 × 50% + 한계이익액달성률 × 50%\n미리주문 비중 = (연동)미리주문취급액 합계 ÷ 목표취급액 합계 × 100\n\n차이(분당) = 프로모션 분당 금액 − 프로모션 外 분당 금액 (금액 차이)\n차이(달성률) = 프로모션 달성률 − 外 달성률 (%p)\n차이(미리주문 비중) = 프로모션 비중 − 外 비중 (%p)\n분모가 0이면 — 표시. 개별 방송 비율의 단순 평균은 사용하지 않습니다.',
  previous: '대상: 필터를 통과한 프로모션 방송상품별 동일 거래형태 + 편성코드명.\n프로모션 시작일 이전 3개월 안에서 최근 방송 3회(P-1·P-2·P-3)를 조회합니다. 프로모션 기간 내 방송과 01:00~04:59 시작 방송은 제외합니다.\n\n직전 가중분당취급액 = 해당 직전 실적의 예상취급고 합계 ÷ 가중분 합계\n직전 가중분당한계이익액 = 해당 직전 실적의 예상한계이익액 합계 ÷ 가중분 합계\n증감률 = (프로모션 분당 값 − 직전 분당 값) ÷ |직전 분당 값| × 100\n미리주문 비중 = (연동)미리주문취급액 합계 ÷ 목표취급액 합계 × 100\n미리주문 비중 차이 = (프로모션 비중 − 직전 비중) × 100 (%p, 비중을 소수 비율로 계산)\n예: 직전 비중 10% → 프로모션 15%이면 차이 +5.0%p\n\n가중분 기준 평균입니다. 같은 상품이 여러 번 편성되면 각 프로모션 행에 동일한 직전 3회를 적용합니다. 부족한 회차는 금액·가중분 0으로 처리하며, 분당 증감률의 기준값이나 비중의 목표취급액 합계가 0이면 — 표시합니다. 직전 비중이 0%여도 %p 차이는 계산합니다.',
}

const number = value => value === null || value === undefined ? '—' : Math.trunc(value).toLocaleString('ko-KR')
const percent = value => value === null || value === undefined ? '—' : `${Math.trunc(value * 100)}%`
const change = value => <PromotionChangeValue>{value === null ? '—' : `${value > 0 ? '+' : ''}${Math.trunc(value * 100)}%`}</PromotionChangeValue>
const points = (a, b) => <PromotionChangeValue>{a === null || b === null ? '—' : `${a > b ? '+' : ''}${Math.trunc((a - b) * 100)}%p`}</PromotionChangeValue>
const amountDifference = (a, b) => <PromotionChangeValue>{a === null || b === null ? '—' : `${a > b ? '+' : ''}${number(a - b)}`}</PromotionChangeValue>
const formatPercentagePointDifference = (a, b) => <PromotionChangeValue>{formatPoints(a, b)}</PromotionChangeValue>
const metricColumns = [['salesPerMin', '가중분당취급액'], ['profitPerMin', '가중분당한계이익액'], ['salesAchievement', '취급달성률'], ['profitAchievement', '한계이익액달성률'], ['overallAchievement', '종합달성률(5:5)'], ['preorderShare', '미리주문 비중']]

export default function PromotionPerformanceSummary({ promotion, outside, total, previous, loading, previousLoading, previousError, onRetry }) {
  const waiting = value => loading ? '…' : value
  return (
    <div className="promotion-statistics">
      <div className="promotion-coverage">
        <strong>프로모션 PGM / 전체 <PromotionFormulaTooltip label="프로모션 PGM / 전체" text={formulas.coverage} /></strong>
        <span>방송수 <b>{waiting(`${number(promotion.count)} / ${number(total.count)}건`)}</b></span>
        <span>가중분 <b>{waiting(`${number(promotion.weightedMin)} / ${number(total.weightedMin)}분`)}</b></span>
        <span>가중분 비중 <b>{waiting(percent(total.weightedMin > 0 ? promotion.weightedMin / total.weightedMin : null))}</b></span>
      </div>
      <div className="promotion-comparison-grid">
        <div className="promotion-comparison-card promotion-comparison-card--outside">
          <h3>프로모션 PGM / 프로모션 外 PGM <PromotionFormulaTooltip label="프로모션 PGM / 프로모션 外 PGM" text={formulas.comparison} /></h3>
          <div className="promotion-comparison-overflow"><table>
            <thead><tr><th>구분</th>{metricColumns.map(([key, title]) => <th key={key}>{title}</th>)}</tr></thead>
            <tbody>
              {[[promotion, '프로모션'], [outside, '프로모션 外']].map(([data, label]) => <tr key={label}><th>{label}</th>{metricColumns.map(([key], i) => <td key={key}>{waiting(i < 2 ? number(data[key]) : key === 'preorderShare' ? formatPreorderShare(data[key]) : percent(data[key]))}</td>)}</tr>)}
              <tr className="promotion-comparison-difference"><th>차이</th>{metricColumns.map(([key], i) => <td key={key}>{waiting(i < 2 ? amountDifference(promotion[key], outside[key]) : key === 'preorderShare' ? formatPercentagePointDifference(promotion[key], outside[key]) : points(promotion[key], outside[key]))}</td>)}</tr>
            </tbody>
          </table></div>
        </div>
        <div className="promotion-comparison-card promotion-comparison-card--history">
          <h3>프로모션 / 직전 3회 평균 <PromotionFormulaTooltip label="프로모션 / 직전 3회 평균" text={formulas.previous} /></h3>
          {previousError ? <p role="alert">직전 실적 일부를 불러오지 못했습니다. <button type="button" onClick={onRetry}>다시 조회</button></p> : (
            <div className="promotion-comparison-overflow"><table><thead><tr><th>구분</th><th>가중분당취급액</th><th>가중분당한계이익액</th><th>(연동)미리주문 비중</th></tr></thead>
              <tbody><tr><th>프로모션</th><td>{waiting(number(promotion.salesPerMin))}</td><td>{waiting(number(promotion.profitPerMin))}</td><td>{waiting(formatPreorderShare(promotion.preorderShare))}</td></tr>
                <tr><th>직전 3회 평균</th><td>{previousLoading ? '조회 중…' : number(previous.salesPerMin)}</td><td>{previousLoading ? '조회 중…' : number(previous.profitPerMin)}</td><td>{previousLoading ? '조회 중…' : formatPreorderShare(previous.preorderShare)}</td></tr>
                <tr className="promotion-comparison-difference"><th>증감률 / 비중 차이</th><td>{loading || previousLoading ? '…' : change(percentChange(promotion.salesPerMin, previous.salesPerMin))}</td><td>{loading || previousLoading ? '…' : change(percentChange(promotion.profitPerMin, previous.profitPerMin))}</td><td>{loading || previousLoading ? '…' : formatPercentagePointDifference(promotion.preorderShare, previous.preorderShare)}</td></tr>
              </tbody></table></div>
          )}
        </div>
      </div>
      <p className="promotion-statistics-note">동일 기간·필터 적용 · 각 카드의 ?에서 계산식 확인 · 분모·비교 기준값이 0이면 — 표시</p>
    </div>
  )
}
