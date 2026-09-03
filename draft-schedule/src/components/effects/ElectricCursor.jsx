import { useEffect, useRef } from 'react'

export default function ElectricCursor({
  color = '#FF4FD8',
  accentColor = '#4FF8FF',
  label = false,
  labelText = 'hover',
  style,
}) {
  const boxRef = useRef(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    let lx = 0
    let ly = 0
    let has = false
    let idle = 0
    const set = (prop, value) => box.style.setProperty(prop, value)

    const onMove = e => {
      const r = box.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top

      if (has) {
        const dx = x - lx
        const dy = y - ly
        const d = Math.hypot(dx, dy)
        if (d > 0.5) set('--angle', `${Math.atan2(dy, dx).toFixed(3)}rad`)
        set('--speed', Math.min(1, d / 32).toFixed(3))
      }

      set('--x', `${x.toFixed(1)}px`)
      set('--y', `${y.toFixed(1)}px`)
      box.classList.toggle('is-near', Math.hypot(x - r.width / 2, y - r.height / 2) < 60)
      box.classList.add('is-active')
      lx = x
      ly = y
      has = true

      window.clearTimeout(idle)
      idle = window.setTimeout(() => set('--speed', '0'), 120)
    }

    const onLeave = () => {
      box.classList.remove('is-active', 'is-near')
      set('--speed', '0')
      has = false
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)

    return () => {
      window.clearTimeout(idle)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={boxRef}
      className="cur cur-neon"
      data-cursor="neon"
      role="img"
      aria-label="Nightclub cursor demo"
      style={{
        '--ink': 'currentColor',
        '--ink-2': color,
        '--ink-3': accentColor,
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {label && <span className="cur-hint mono" aria-hidden="true">{labelText}</span>}
      <span className="cur-word" aria-hidden="true" />
      <i className="cursor" style={{ '--i': 0 }} />
    </div>
  )
}
