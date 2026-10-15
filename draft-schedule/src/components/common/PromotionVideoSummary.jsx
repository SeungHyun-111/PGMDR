import { percentChange } from '../../utils/promotionStatistics'
import PromotionFormulaTooltip from './PromotionFormulaTooltip'

const number = value => value == null ? '—' : Math.trunc(value).toLocaleString('ko-KR')
const percent = value => value == null ? '—' : `${Math.trunc(value * 100)}%`
const increase = (current, previous) => {
  const change = percentChange(current, previous)
  return change === null ? '—' : `${change > 0 ? '+' : ''}${Math.trunc(change * 100)}%`
}
const formula = '영상구분은 현재 프로모션 방송의 newProductType(신상품·재녹화·기존 등) 기준입니다.\n심야·무형(문화서비스팀)·조직·카테고리 필터를 동일하게 적용합니다.\n\n분당취급액 = 유형별 예상취급고 합계 ÷ 가중분 합계\n분당한계이익액 = 유형별 예상한계이익액 합계 ÷ 가중분 합계\n달성률 = 유형별 실적 합계 ÷ 목표 합계 × 100\n종합달성률 = 취급달성률 × 50% + 한계이익액달성률 × 50%\n미리주문 비중 = (연동)미리주문취급액 합계 ÷ 목표취급액 합계 × 100\n\n증감률 = (현재 값 − 직전 3회 평균 값) ÷ |직전 평균 값| × 100\n직전 평균은 해당 유형의 현재 방송상품들에 대응하는 프로모션 시작 전 3개월·심야 제외 이력을 가중분으로 합산합니다. 과거 방송 자체의 영상구분은 제한하지 않습니다.\n기준값이 0이거나 조회에 실패하면 — 표시합니다.'

export default function PromotionVideoSummary({ groups, loading, previousLoading }) {
  return (
    <details className="promotion-video-summary" open>
      <summary>영상구분별 실적 · 직전 3회 대비 증감률 <PromotionFormulaTooltip label="영상구분별 실적" text={formula} /></summary>
      <div className="promotion-video-scroll">
        <table>
          <thead><tr>{['영상구분', 'PGM수', '가중분', '예상취급고', '예상한계이익액', '가중분당취급액', '증감률', '가중분당한계이익액', '증감률', '취급달성률', '한계이익액달성률', '종합달성률(5:5)', '미리주문 비중', '비중 증감률'].map((label, i) => <th key={i}>{label}</th>)}</tr></thead>
          <tbody>
            {!loading && groups.map(({ type, current, previous, missingHistory }) => {
              const growth = key => previousLoading ? '…' : missingHistory ? '—' : increase(current[key], previous[key])
              return <tr key={type}><th>{type}</th><td>{current.count}</td><td>{number(current.weightedMin)}</td><td>{number(current.expectedSales)}</td><td>{number(current.contributionProfit)}</td><td>{number(current.salesPerMin)}</td><td className="promotion-video-growth">{growth('salesPerMin')}</td><td>{number(current.profitPerMin)}</td><td className="promotion-video-growth">{growth('profitPerMin')}</td><td>{percent(current.salesAchievement)}</td><td>{percent(current.profitAchievement)}</td><td>{percent(current.overallAchievement)}</td><td>{percent(current.preorderShare)}</td><td className="promotion-video-growth">{growth('preorderShare')}</td></tr>
            })}
            {(loading || !groups.length) && <tr><td colSpan={14} className="promotion-video-empty">{loading ? '영상구분별 실적을 불러오는 중입니다.' : '현재 필터에 해당하는 프로모션 방송이 없습니다.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </details>
  )
}
