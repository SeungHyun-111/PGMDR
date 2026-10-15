import { useEffect, useRef, useState } from 'react'
import { normalizePromotionDate } from '../utils/promotionDate'

let libraryPromise
function loadDatepicker() {
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://cdn.jsdelivr.net/npm/air-datepicker@3.6.0/air-datepicker.css'
      document.head.append(css)
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/air-datepicker@3.6.0/air-datepicker.js'
      script.onload = () => resolve(window.AirDatepicker)
      script.onerror = () => { script.remove(); css.remove(); libraryPromise = null; reject(new Error('달력을 불러오지 못했습니다. 날짜를 직접 입력해주세요.')) }
      document.head.append(script)
    })
  }
  return libraryPromise
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

const locale = {
  days: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  daysShort: ['일', '월', '화', '수', '목', '금', '토'],
  daysMin: ['일', '월', '화', '수', '목', '금', '토'],
  months: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
  monthsShort: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
  today: '오늘', clear: '지우기', dateFormat: 'yyyy-MM-dd', timeFormat: 'HH:mm', firstDay: 0,
}

export default function PromotionDateInput({ value = '', min, max, label, onSave }) {
  const input = useRef(null)
  const trigger = useRef(null)
  const calendarAnchor = useRef(null)
  const picker = useRef(null)
  const latest = useRef({})
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const current = draft ?? value

  const commit = async text => {
    const normalized = normalizePromotionDate(text)
    if (normalized === null) { setError('올바른 날짜를 입력해주세요. 예: 10/1, 10.1, 26/1/1'); return }
    if (normalized && ((min && normalized < min) || (max && normalized > max))) { setError('종료일은 시작일보다 앞설 수 없습니다.'); return }
    setError('')
    setDraft(normalized)
    const saved = await onSave(normalized)
    if (saved) setDraft(previous => previous === normalized ? null : previous)
  }
  useEffect(() => { latest.current = { commit, current } })

  useEffect(() => {
    let cancelled = false
    loadDatepicker().then(AirDatepicker => {
      if (cancelled) return
      // Use a separate input: non-input anchors force this library into inline mode.
      picker.current = new AirDatepicker(calendarAnchor.current, {
        locale, dateFormat: 'yyyy-MM-dd', autoClose: true, toggleSelected: false,
        showEvent: 'datepicker-open', keyboardNav: false,
        container: document.body,
        position: ({ $datepicker, $pointer }) => {
          const box = input.current.getBoundingClientRect()
          const width = $datepicker.offsetWidth
          const height = $datepicker.offsetHeight
          const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8))
          const top = box.bottom + height + 8 <= window.innerHeight ? box.bottom + 8 : Math.max(8, box.top - height - 8)
          Object.assign($datepicker.style, { position: 'fixed', left: `${left}px`, top: `${top}px` })
          $pointer.style.display = 'none'
        },
        classes: 'promotion-calendar', buttons: ['today', 'clear'],
        isMobile: window.matchMedia('(max-width: 640px)').matches,
        navTitles: {
          days: dp => `${dp.viewDate.getFullYear()}년 ${dp.viewDate.getMonth() + 1}월`,
          months: dp => `${dp.viewDate.getFullYear()}년`,
          years: dp => {
            const decade = Math.floor(dp.viewDate.getFullYear() / 10) * 10
            return `${decade}년 – ${decade + 9}년`
          },
        },
        selectedDates: parseDate(latest.current.current) ? [parseDate(latest.current.current)] : [],
        onSelect: ({ formattedDate }) => {
          const next = formattedDate || ''
          setDraft(next)
          latest.current.commit(next)
        },
      })
      picker.current.update({ minDate: parseDate(input.current.dataset.min) || false, maxDate: parseDate(input.current.dataset.max) || false })
    }).catch(reason => { if (!cancelled) setError(reason.message) })
    return () => { cancelled = true; picker.current?.destroy(); picker.current = null }
  }, [])

  useEffect(() => {
    if (!picker.current) return
    picker.current.update({ minDate: parseDate(min) || false, maxDate: parseDate(max) || false })
  }, [min, max])

  useEffect(() => {
    const closeOnOutside = event => {
      if (!picker.current?.visible) return
      if (trigger.current?.contains(event.target) || picker.current.$datepicker?.contains(event.target)) return
      picker.current.hide()
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape' && picker.current?.visible) {
        picker.current.hide()
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const openCalendar = () => {
    if (!picker.current) return
    if (picker.current.visible) {
      picker.current.hide()
      return
    }
    const date = parseDate(normalizePromotionDate(current))
    if (date) {
      picker.current.selectDate(date, { silent: true })
      picker.current.setViewDate(date)
    } else picker.current.clear({ silent: true })
    picker.current.show()
  }

  return (
    <div className="promotion-date-field">
      <div className="promotion-date-control">
        <input ref={calendarAnchor} type="text" tabIndex={-1} aria-hidden="true" className="promotion-calendar-anchor" />
        <input ref={input} type="text" data-min={min || ''} data-max={max || ''} aria-label={label} aria-invalid={!!error} title={error || `${label} · 예: 10/1, 10.1, 26/1/1`} placeholder="예: 10/1" autoComplete="off" maxLength={20}
          value={current} onChange={event => { setDraft(event.target.value); setError('') }}
          onBlur={() => { if (draft !== null) commit(current) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(current); picker.current?.hide() } }} />
        <button ref={trigger} type="button" className="promotion-calendar-trigger" aria-label={`${label} 달력 열기`} onClick={openCalendar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" /></svg>
        </button>
      </div>
      {error && <span className="promotion-date-error" role="alert">{error}</span>}
    </div>
  )
}
