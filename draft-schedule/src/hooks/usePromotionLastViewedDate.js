import { useCallback, useEffect, useRef, useState } from 'react'
import { db, ref, get, set } from '../api/firebase'

// Encode every code point so names containing Firebase key separators cannot collide.
const key = value => Array.from(value, char => char.codePointAt(0).toString(16)).join('-')

export default function usePromotionLastViewedDate(userName, promotionId, active, section = 'promotions') {
  const path = userName.trim() && promotionId
    ? `userPreferences/${key(userName.trim())}/${section}/${key(promotionId)}/lastViewedDate`
    : ''
  const [choices, setChoices] = useState({})
  const pending = useRef({})
  const choice = choices[path]

  useEffect(() => {
    if (!active || !path) return
    let cancelled = false
    get(ref(db, path)).then(snapshot => {
      if (cancelled) return
      const date = typeof snapshot.val() === 'string' ? snapshot.val() : ''
      setChoices(previous => ({ ...previous, [path]: { date, error: '' } }))
    }).catch(() => {
      if (!cancelled) setChoices(previous => ({ ...previous, [path]: { date: '', error: '마지막 조회 날짜를 불러오지 못했습니다. 최신 날짜로 표시합니다.' } }))
    })
    return () => { cancelled = true }
  }, [active, path])

  const canSelect = !!choice
  const selectDate = useCallback(date => {
    if (!path || !canSelect) return
    setChoices(previous => ({ ...previous, [path]: { date, error: '' } }))
    // Preserve the user's final choice even when arrow buttons are clicked rapidly.
    const write = (pending.current[path] || Promise.resolve())
      .catch(() => {})
      .then(() => set(ref(db, path), date))
    pending.current[path] = write
    write.catch(() => {
      setChoices(previous => previous[path]?.date === date
        ? { ...previous, [path]: { date, error: '조회 날짜를 저장하지 못했습니다. 날짜를 다시 선택해 저장해주세요.' } }
        : previous)
    }).finally(() => {
      if (pending.current[path] === write) delete pending.current[path]
    })
  }, [path, canSelect])

  return { date: choice?.date || '', ready: !path || !!choice, error: choice?.error || '', selectDate }
}
