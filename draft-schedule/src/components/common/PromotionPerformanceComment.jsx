import { useEffect, useRef, useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { savePromotionComment, subscribePromotionComment } from '../../api/promotionPerformanceComments'
import CommentTerminal from './CommentTerminal'

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
      setRemote(current => ({ ...current, text: edit.text }))
      setDraft(null)
      setStatus('저장됨')
    }).catch(() => {
      if (mounted.current && edit.version === version.current) {
        pending.current = edit
        setStatus('저장 실패')
      }
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
    <CommentTerminal id={`promotion-comment-${promotionId}`} status={loadError || status || (remote === null ? '불러오는 중…' : '자동 저장')} failed={!!loadError || status === '저장 실패'} onRetry={() => loadError ? setRetry(value => value + 1) : flush()} disabled={!active || remote === null || !!loadError} value={draft ?? remote?.text ?? ''} onChange={text => {
      setDraft(text)
      setStatus('저장 대기…')
      pending.current = { text, userName, version: ++version.current }
      clearTimeout(timer.current)
      timer.current = setTimeout(() => flushRef.current(), 600)
    }} onBlur={flush} />
  </section>
}
