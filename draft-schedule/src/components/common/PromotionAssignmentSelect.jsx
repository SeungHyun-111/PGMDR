import { useState } from 'react'
import usePromotionAssignmentStore, { savePromotionAssignment } from '../../store/usePromotionAssignmentStore'

export default function PromotionAssignmentSelect({ entryId, row, names, sourcePath }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const current = usePromotionAssignmentStore(state => state.names[entryId] ?? row.promotionName ?? '')
  const ready = usePromotionAssignmentStore(state => state.ready)
  const save = async name => {
    if (saving || name === current) return
    setSaving(true)
    setError('')
    try {
      await savePromotionAssignment({ entryId, sourcePath, name, fallbackName: row.promotionName || '' })
    } catch {
      setError('저장에 실패했습니다. 다시 선택해주세요.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <select className="promotion-assignment-select" aria-label={`${row.broadcastTime || ''} ${row.pgmCodeName} 프로모션명`} value={current} disabled={saving || !ready || !sourcePath} onChange={event => save(event.target.value)}>
        {names.map(name => <option key={name} value={name}>{name}</option>)}
        {current && !names.includes(current) && <option value={current}>{current}</option>}
        <option value="">미지정</option>
      </select>
      {saving && <span className="promotion-assignment-status" role="status">저장 중…</span>}
      {error && <span className="promotion-products-error" role="alert">{error}</span>}
    </>
  )
}
