import { useEffect, useRef, useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { savePromotionComment, subscribePromotionComment } from '../../api/promotionPerformanceComments'

export default function PromotionPerformanceComment({ promotionId, active }) {
  const userName = useScheduleStore(state => state.userName)
  const [remote, setRemote] = useState(null)
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('')
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const pending = useRef(null)
  const timer = useRef(null)
  const version = useRef(0)
  const mounted = useRef(true)
  const flush = () => {
    clearTimeout(timer.current)
    const edit = pending.current
    if (!edit) return
    pending.current = null
    if (mounted.current) setStatus('저장 중…')
    savePromotionComment(promotionId, edit.text, edit.userName).then(() => {
      if (!mounted.current || edit.version !== version.current) return
      setDraft(null)
      setStatus('저장됨')
    }).catch(() => {
      if (mounted.current && edit.version === version.current) setStatus('저장 실패 · 다시 저장해주세요.')
    })
  }
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush })
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; flushRef.current() }
  }, [])
  useEffect(() => {
    if (!active) return
    const unsubscribe = subscribePromotionComment(promotionId, value => { setRemote(value); setLoadError('') }, () => setLoadError('담당자 코멘트를 불러오지 못했습니다.'))
    return () => { unsubscribe(); flushRef.current() }
  }, [promotionId, active, retry])
  return <section className="promotion-performance-comment" aria-label="담당자 코멘트">
    <header><label htmlFor={`promotion-comment-${promotionId}`}>담당자 코멘트</label><span role={status.startsWith('저장 실패') ? 'alert' : 'status'}>{status || (remote === null && !loadError ? '불러오는 중…' : '')}</span><button type="button" disabled={!active || remote === null || !!loadError || status === '저장 중…'} onClick={() => {
      pending.current = { text: draft ?? remote?.text ?? '', userName, version: ++version.current }
      flush()
    }}>저장</button></header>
    {loadError && <p role="alert">{loadError} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p>}
    <textarea id={`promotion-comment-${promotionId}`} aria-label="담당자 코멘트 내용" placeholder="담당자 코멘트를 작성해주세요." disabled={!active || remote === null || !!loadError} value={draft ?? remote?.text ?? ''} onChange={event => {
      const text = event.target.value
      setDraft(text)
      setStatus('')
      pending.current = { text, userName, version: ++version.current }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => flushRef.current(), 600)
    }} onBlur={flush} />
  </section>
}
