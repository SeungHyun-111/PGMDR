import { assignedPromotionIds } from '../../utils/promotionAssignment'
import { memo, useState } from 'react'
import PreviousPerformance from './PreviousPerformance'
import PromotionAssignmentSelect from './PromotionAssignmentSelect'
import usePromotionAssignmentStore from '../../store/usePromotionAssignmentStore'

const formatNumber = value => value === null || value === undefined || value === '' ? '—' : Math.trunc(Number(value)).toLocaleString('ko-KR')

export default memo(function PromotionBroadcastRow({ entryId, row, promotions, sourcePath, promotionStart, isTarget = false, selectedPromotionId = '' }) {
  const [expanded, setExpanded] = useState(false)
  const ids = usePromotionAssignmentStore(state => state.ids[entryId])
  const legacy = usePromotionAssignmentStore(state => state.names[entryId])
  const assigned = assignedPromotionIds(row, ids, legacy, promotions)
  const others = promotions.filter(([id]) => id !== selectedPromotionId && assigned.includes(id)).map(([, promotion]) => promotion.name)
  return (
    <><tr className={[assigned.length ? 'is-assigned' : '', isTarget ? 'is-promotion-target' : ''].filter(Boolean).join(' ')}>
      <td>{row.broadcastTime || '—'}</td>
      <td className="promotion-pgm-name" title={row.pgmCodeName}><div className="promotion-pgm-name-content"><span>{row.pgmCodeName}</span>{isTarget && <span className="promotion-target-badge">대상 상품</span>}<button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>직전 3회 {expanded ? '▴' : '▾'}</button></div></td>
      <td><PromotionAssignmentSelect entryId={entryId} row={row} promotions={promotions} sourcePath={sourcePath} selectedPromotionId={selectedPromotionId} /></td>
      <td><span className={`promotion-other-names${others.length ? '' : ' is-empty'}`} title={others.join(', ')}>{others.join(', ') || '—'}</span></td>
      <td>{row.dealTypeConverted || row.dealType2 || row.dealType || '—'}</td>
      <td>{row.mdName || '—'}</td>
      <td className="promotion-number">{formatNumber(row.salesPerWeightedMin)}</td>
      <td className="promotion-number">{formatNumber(row.contributionProfitPerWeightedMin ?? row.profitPerWeightedMin)}</td>
      <td className="promotion-number">{formatNumber(row.expectedSales)}</td>
      <td className="promotion-number">{formatNumber(row.contributionProfit)}</td>
      <td className="promotion-number">{formatNumber(row.preorderExpectedSales)}</td>
    </tr>{expanded && <tr><td colSpan={11}><PreviousPerformance row={row} promotionStart={promotionStart} /></td></tr>}</>
  )
})
