import { useEffect, useState } from 'react'
import { organizationKey } from '../../api/competitorMeetings'
import { WEEKLY_WORK_OWNERS, saveWeeklyWork, subscribeWeeklyWork } from '../../api/weeklyWork'

function WorkEditor({ week, owner, field, label, record, userName }) {
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    setStatus('저장 중…')
    try {
      await saveWeeklyWork(week, owner, field, draft ?? record?.content ?? '', userName)
      setDraft(null)
      setStatus('저장됨')
    } catch (error) { setStatus(`저장 실패: ${error.message}`) }
    finally { setSaving(false) }
  }
  return <div className="weekly-work-editor">
    <textarea aria-label={`${owner} ${label}`} value={draft ?? record?.content ?? ''} disabled={saving}
      onChange={event => { setDraft(event.target.value); setStatus('미저장') }} />
    <div className="weekly-work-save"><span role="status">{status}</span><button type="button" disabled={saving || draft === null} onClick={save} aria-label={`${owner} ${label} 저장`}>저장</button></div>
  </div>
}
export default function WeeklyWork({ week, userName }) {
  const [notes, setNotes] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!week) return
    return subscribeWeeklyWork(week, setNotes, error => setError(`주간업무를 불러오지 못했습니다: ${error.message}`))
  }, [week])
  return <section className="competitor-meeting-panel weekly-work-panel" aria-label="편성파트 주간업무">
    <div className="competitor-meeting-heading"><h3>편성파트 주간업무</h3><span>{week ? `${week} 주차` : '주차 선택'}</span><span>항목별 작성 후 저장</span></div>
    {error && <p role="alert">{error}</p>}
    {!notes && !error && <p role="status">주간업무를 불러오는 중…</p>}
    {notes && !error && <div className="competitor-meeting-table-scroll"><table className="weekly-work-table">
      <colgroup><col style={{ width: 100 }} /><col style={{ width: 85 }} /><col /><col style={{ width: '22%' }} /></colgroup>
      <thead><tr><th scope="col">담당자</th><th scope="col">구분</th><th scope="col">업무내용</th><th scope="col">비고</th></tr></thead>
      {WEEKLY_WORK_OWNERS.map(owner => {
        const record = notes[organizationKey(owner)] || {}
        return <tbody key={owner}>{[['previous', '전주'], ['current', '금주']].map(([field, label], index) => <tr key={field} className={field === 'current' ? 'weekly-work-current' : ''}>
          {index === 0 && <th scope="rowgroup" rowSpan={2} className="weekly-work-owner">{owner}</th>}
          <th scope="row">{label}</th>
          <td><WorkEditor week={week} owner={owner} field={field} label={`${label} 업무내용`} record={record[field]} userName={userName} /></td>
          {index === 0 && <td rowSpan={2}><WorkEditor week={week} owner={owner} field="remarks" label="비고" record={record.remarks} userName={userName} /></td>}
        </tr>)}</tbody>
      })}
    </table></div>}
  </section>
}
