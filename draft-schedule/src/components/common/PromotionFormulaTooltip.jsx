import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PromotionFormulaTooltip({ label, text, suffix = ' 계산식', maxWidth = 390, preferredHeight = 280, centered = false }) {
  const id = useId()
  const trigger = useRef(null)
  const popup = useRef(null)
  const closeTimer = useRef(null)
  const [position, setPosition] = useState(null)
  const show = () => {
    clearTimeout(closeTimer.current)
    const box = trigger.current.getBoundingClientRect()
    const width = Math.min(maxWidth, window.innerWidth - 24)
    if (centered) {
      setPosition({ width, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', maxHeight: 'calc(100dvh - 24px)' })
      return
    }
    const below = window.innerHeight - box.bottom
    const useBelow = below >= preferredHeight || below > box.top
    setPosition({ width, left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
      ...(useBelow ? { top: box.bottom + 8 } : { bottom: window.innerHeight - box.top + 8 }),
      maxHeight: Math.max(100, (useBelow ? below : box.top) - 20),
    })
  }
  const delayClose = () => {
    if (document.activeElement !== trigger.current) closeTimer.current = setTimeout(() => setPosition(null), centered ? 400 : 120)
  }
  useEffect(() => () => clearTimeout(closeTimer.current), [])
  useEffect(() => {
    if (!position) return
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && (trigger.current?.contains(event.target) || popup.current?.contains(event.target))) return
      if (event.type === 'scroll' && popup.current?.contains(event.target)) return
      setPosition(null)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [position])
  return (
    <>
      <button ref={trigger} type="button" className="promotion-formula-trigger" aria-label={`${label}${suffix}`} aria-describedby={position ? id : undefined}
        onMouseEnter={show} onMouseLeave={delayClose}
        onFocus={show} onBlur={() => setPosition(null)} onClick={show}>?</button>
      {position && createPortal(<div ref={popup} id={id} role="tooltip" className="promotion-formula-tooltip" style={position} onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={delayClose}><strong>{label}{suffix}</strong><div>{text}</div></div>, document.body)}
    </>
  )
}
