import { useEffect, useState } from 'react'
import { db, ref, onValue } from '../api/firebase'
import useCultureCodeMaster from '../hooks/useCultureCodeMaster'
import useScheduleStore from '../store/useScheduleStore'
import PromotionCodeInput from '../components/common/PromotionCodeInput'
import { savePromotionReservation, cancelPromotionReservation, editPromotionReservation } from '../api/promotionReservations'
import usePromotionAssignmentStore from '../store/usePromotionAssignmentStore'
import { PROMOTION_RESERVATIONS_PATH } from '../utils/promotionAssignment'
import { normalizeReservationInput, parseReservationPaste } from '../utils/promotionReservationInput'

export default function PromotionReservationsTab({ promotionId, promotion = {}, active }) {
  const { codes, loaded, error: codeError } = useCultureCodeMaster()
  const userName = useScheduleStore(state => state.userName)
  const [drafts, setDrafts] = useState(() => Array.from({ length: 2 }, () => ({ dateTime: '', code: '', error: '' })))
  const [reservations, setReservations] = useState({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const assignments = usePromotionAssignmentStore(state => state.ids)
  const assignmentsReady = usePromotionAssignmentStore(state => state.ready)
  useEffect(() => {
    if (!active || !promotionId) return
    return onValue(ref(db, PROMOTION_RESERVATIONS_PATH), snapshot => {
      setReservations(snapshot.val() || {})
      setReady(true)
    }, () => { setReady(false); setError('예약 목록을 불러오지 못했습니다.') })
  }, [active, promotionId])
  const perform = async action => {
    setBusy(true)
    setError('')
    try { await action() } catch (error) { setError(error.message || '예약 처리에 실패했습니다.') } finally { setBusy(false) }
  }
  const rows = Object.entries(reservations).filter(([, item]) => item.promotionId === promotionId)
    .sort(([, a], [, b]) => a.broadcastTimestamp - b.broadcastTimestamp)
  const isApplied = item => Object.keys(item.appliedEntryIds || {}).some(entryId => assignments[entryId]?.[item.promotionId] === true)
  const appliedCount = rows.filter(([, item]) => isApplied(item)).length
  const pendingCount = rows.filter(([, item]) => item.status === 'pending').length
  const edit = (index, field, value) => setDrafts(current => current.map((row, i) => i === index ? { ...row, error: '', [field]: value } : row))
  const year = Number(promotion.startDate?.slice(0, 4)) || new Date().getFullYear()
  const paste = (event, index) => {
    const text = event.clipboardData.getData('text/plain')
    if (!/[\t\n]/.test(text)) return
    event.preventDefault()
    const incoming = parseReservationPaste(text)
    setDrafts(current => {
      const next = [...current]
      incoming.forEach((row, offset) => { next[index + offset] = { ...row, error: '' } })
      return next
    })
  }
  return <div className="promotion-reservations">
    <div className="promotion-reservation-heading"><h3>방송 예약 입력</h3><span>엑셀 붙여넣기 지원</span></div>
    {!promotionId && <p className="promotion-reservation-guide" role="status">위에서 프로모션을 선택한 뒤 방송일시와 편성코드명을 입력해주세요.</p>}
    {promotionId && <p className="promotion-reservation-guide">{promotion.name} · {promotion.startDate || '시작일 미설정'} ~ {promotion.endDate || '종료일 미설정'}</p>}
    <p className="promotion-products-description">예: 10/29 2331 · 엑셀에서 방송일시와 편성코드명을 복사해 첫 칸에 붙여넣으세요.</p>
    <form className="promotion-reservation-form" onSubmit={event => {
      event.preventDefault()
      if (!promotionId) return
      perform(async () => {
        if (!loaded || codeError) throw new Error('편성코드 목록을 불러온 뒤 등록해주세요.')
        const prepared = drafts.map(row => {
          if (!row.dateTime.trim() && !row.code.trim()) return { ...row, empty: true }
          try {
            const dateTime = normalizeReservationInput(row.dateTime, year)
            if (!promotion.startDate || !promotion.endDate || dateTime.slice(0, 10) < promotion.startDate || dateTime.slice(0, 10) > promotion.endDate) throw new Error('프로모션 기간 안의 일시를 입력해주세요.')
            if (!codes.some(item => item.code === row.code.trim())) throw new Error('RTDB에 등록된 편성코드를 선택해주세요.')
            return { ...row, dateTime, error: '' }
          } catch (error) { return { ...row, error: error.message } }
        })
        setDrafts(prepared)
        if (prepared.some(row => row.error)) throw new Error(prepared.map((row, index) => row.error ? `${index + 1}행: ${row.error}` : '').filter(Boolean).join(' / '))
        if (prepared.every(row => row.empty)) throw new Error('방송일시와 편성코드명을 입력해주세요.')
        for (let index = 0; index < prepared.length; index++) {
          const row = prepared[index]
          if (row.empty) continue
          try {
            await savePromotionReservation({ promotionId, broadcastDateTime: row.dateTime, pgmCodeName: row.code, userName })
            setDrafts(current => current.map((item, i) => i === index ? { dateTime: '', code: '', error: '' } : item))
          } catch (error) { edit(index, 'error', error.message); throw error }
        }
      })
    }}>
      <fieldset className="promotion-reservation-grid-fieldset" disabled={!promotionId || busy}>
      <legend className="promotion-sr-only">예약할 방송 정보</legend>
      <div className="promotion-products-table-wrap"><table className="promotion-table promotion-reservation-grid">
        <thead><tr><th>No</th><th>방송일시</th><th>편성코드명</th><th>프로모션명</th></tr></thead>
        <tbody>{drafts.map((row, index) => <tr key={index}>
          <td>{index + 1}</td>
          <td onPaste={event => paste(event, index)}><input type="text" aria-label={index ? `${index + 1}행 방송일시` : '방송일시'} autoComplete="off" placeholder="10/29 2331" value={row.dateTime}
            onChange={event => edit(index, 'dateTime', event.target.value)}
            onBlur={() => { if (!row.dateTime.trim()) return; try { edit(index, 'dateTime', normalizeReservationInput(row.dateTime, year).replace('T', ' ')) } catch { /* Leave incomplete input editable. */ } }}
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              const table = event.currentTarget.closest('table')
              if (index === drafts.length - 1) setDrafts(current => [...current, { dateTime: '', code: '', error: '' }])
              requestAnimationFrame(() => table.querySelectorAll('tbody tr')[index + 1]?.querySelector('input')?.focus())
            }} /></td>
          <td><PromotionCodeInput label={index ? `${index + 1}행 예약 편성코드명` : '예약 편성코드명'} value={row.code} onChange={value => edit(index, 'code', value)} onSave={value => edit(index, 'code', value)} codes={codes} strict /></td>
          <td className="promotion-reservation-name">{promotion.name || '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="promotion-reservation-actions"><button type="button" onClick={() => setDrafts(current => [...current, { dateTime: '', code: '', error: '' }])}>+ 행 추가</button><button type="submit" disabled={busy}>{busy ? '등록 중…' : '예약 등록'}</button></div>
      </fieldset>
    </form>
    {(error || codeError) && <p role="alert" className="promotion-products-error">{error || codeError}</p>}
    <div className="promotion-reservation-list-heading"><h3>등록된 예약 <span>{rows.length}</span></h3><div><span>실적 적용 <strong>{assignmentsReady ? appliedCount : '—'}</strong></span><span>적용 대기 <strong>{pendingCount}</strong></span></div></div>
    <div className="promotion-products-table-wrap promotion-reservation-list-wrap"><table className="promotion-table promotion-products-table promotion-reservation-list">
      <colgroup><col style={{ width: 180 }} /><col /><col style={{ width: 160 }} /><col style={{ width: 150 }} /><col style={{ width: 180 }} /></colgroup>
      <thead><tr><th>방송일시</th><th>편성코드명</th><th>프로모션명</th><th>실적 적용 여부</th><th>관리</th></tr></thead>
      <tbody>{rows.map(([id, item]) => {
        const applied = isApplied(item)
        const isEditing = editing?.id === id
        return <tr key={id}>
          <td>{isEditing ? <input aria-label="예약 수정 방송일시" type="text" value={editing.dateTime} onChange={event => setEditing(current => ({ ...current, dateTime: event.target.value }))} /> : item.broadcastDateTime.replace('T', ' ')}</td>
          <td>{isEditing ? <PromotionCodeInput label="예약 수정 편성코드명" value={editing.code} onChange={code => setEditing(current => ({ ...current, code }))} onSave={code => setEditing(current => ({ ...current, code }))} codes={codes} strict /> : item.pgmCodeName}</td>
          <td><span className="promotion-name-tag">{promotion.name || '—'}</span></td>
          <td><span className={`promotion-reservation-status${applied ? ' is-applied' : item.status === 'cancelled' ? ' is-cancelled' : ''}`}>{!assignmentsReady ? '확인 중' : applied ? '적용' : item.status === 'cancelled' ? '미적용 · 예약 취소' : item.status === 'applying' ? '적용 중' : '미적용'}</span></td>
          <td><div className="promotion-reservation-row-actions">{isEditing ? <>
            <button type="button" disabled={busy} onClick={() => perform(async () => {
              await editPromotionReservation(id, { promotionId, broadcastDateTime: normalizeReservationInput(editing.dateTime, year), pgmCodeName: editing.code })
              setEditing(null)
            })}>수정 저장</button><button type="button" disabled={busy} onClick={() => setEditing(null)}>닫기</button>
          </> : <>
            <button type="button" disabled={busy || item.status !== 'pending'} title={item.status === 'pending' ? '' : '대기 중인 예약만 수정할 수 있습니다.'} onClick={() => setEditing({ id, dateTime: item.broadcastDateTime.replace('T', ' '), code: item.pgmCodeName })}>예약 수정</button>
            <button type="button" disabled={busy || item.status !== 'pending'} title={item.status === 'pending' ? '' : '적용된 방송은 실적 선정에서 해제해주세요.'} onClick={() => perform(() => cancelPromotionReservation(id))}>취소</button>
          </>}</div></td>
        </tr>
      })}{!rows.length && <tr><td colSpan={5} className="promotion-products-empty">{!promotionId ? '프로모션을 선택하면 예약 목록을 확인할 수 있습니다.' : ready ? '등록된 예약이 없습니다.' : '예약 목록을 불러오는 중입니다.'}</td></tr>}</tbody>
    </table></div>
    <p className="promotion-products-description">적용 완료 건은 실적 선정 탭에서 프로모션을 해제할 수 있습니다.</p>
  </div>
}
