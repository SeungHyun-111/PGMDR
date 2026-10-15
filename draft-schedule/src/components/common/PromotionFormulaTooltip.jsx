import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PromotionFormulaTooltip({ label, text }) {
  const id = useId()
  const trigger = useRef(null)
  const popup = useRef(null)
  const closeTimer = useRef(null)
  const [position, setPosition] = useState(null)
  const show = () => {
    clearTimeout(closeTimer.current)
    const box = trigger.current.getBoundingClientRect()
    const width = Math.min(390, window.innerWidth - 24)
    const below = window.innerHeight - box.bottom
    const useBelow = below >= 280 || below > box.top
    setPosition({ width, left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
      ...(useBelow ? { top: box.bottom + 8 } : { bottom: window.innerHeight - box.top + 8 }),
      maxHeight: Math.max(100, (useBelow ? below : box.top) - 20),
    })
  }
  const delayClose = () => {
    if (document.activeElement !== trigger.current) closeTimer.current = setTimeout(() => setPosition(null), 120)
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
      <button ref={trigger} type="button" className="promotion-formula-trigger" aria-label={`${label} 계산식`} aria-describedby={position ? id : undefined}
        onMouseEnter={show} onMouseLeave={delayClose}
        onFocus={show} onBlur={() => setPosition(null)} onClick={show}>?</button>
      {position && createPortal(<div ref={popup} id={id} role="tooltip" className="promotion-formula-tooltip" style={position} onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={delayClose}><strong>{label} 계산식</strong><div>{text}</div></div>, document.body)}
    </>
  )
}
