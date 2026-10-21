import { useState } from 'react'
import usePromotionAssignmentStore, { togglePromotionAssignment } from '../../store/usePromotionAssignmentStore'
import { assignedPromotionIds } from '../../utils/promotionAssignment'

export default function PromotionAssignmentSelect({ entryId, row, promotions, sourcePath, selectedPromotionId }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ids = usePromotionAssignmentStore(state => state.ids[entryId])
  const legacy = usePromotionAssignmentStore(state => state.names[entryId])
  const ready = usePromotionAssignmentStore(state => state.ready)
  const current = assignedPromotionIds(row, ids, legacy, promotions)
  const selected = promotions.find(([id]) => id === selectedPromotionId)?.[1]
  const applied = current.includes(selectedPromotionId)
  const save = async (promotionId, assigned) => {
    setSaving(true)
    setError('')
    try {
      await togglePromotionAssignment({ entryId, sourcePath, promotionId, assigned, row, promotions })
    } catch (error) {
      setError(error.message || '저장에 실패했습니다. 다시 선택해주세요.')
    } finally { setSaving(false) }
  }
  return <div className="promotion-assignment-action">
    <button type="button" className={`promotion-apply-button${applied ? ' is-applied' : ''}`} aria-pressed={applied}
      aria-label={`${row.broadcastTime || ''} ${row.pgmCodeName} ${selected?.name || ''} ${applied ? '해제' : '적용'}`}
      title={applied ? '클릭하면 이 프로모션만 해제합니다.' : '클릭하면 선택한 프로모션을 추가합니다.'}
      disabled={saving || !ready || !sourcePath || !selectedPromotionId} onClick={() => save(selectedPromotionId, !applied)}>
      <span aria-hidden="true">{applied ? '✓' : '+'}</span><span>{saving ? '저장 중…' : selected?.name || '프로모션 선택'}</span>
    </button>
    {error && <span className="promotion-products-error" role="alert">{error}</span>}
  </div>
}
