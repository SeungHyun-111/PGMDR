import { useEffect, useRef } from 'react'

const FPS = 18
const DENSE_CHARS = ' `.^,:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
const DEFAULT_SHADES = ['#031000', '#0d3100', '#237800', '#6bd900', '#baff00']

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function charFor(value) {
  if (value <= 0.02) return '&nbsp;'
  const char = DENSE_CHARS[clamp(Math.floor(value * (DENSE_CHARS.length - 1)), 0, DENSE_CHARS.length - 1)]
  if (char === ' ') return '&nbsp;'
  if (char === '<') return '&lt;'
  if (char === '>') return '&gt;'
  if (char === '&') return '&amp;'
  return char
}

function colorFor(value, palette) {
  const index = clamp(Math.floor(value * (palette.length - 1)), 0, palette.length - 1)
  return palette[index]
}

function seed(buffer, width, height, intensity, wind) {
  const floor = (height - 1) * width
  const now = performance.now()
  for (let x = 0; x < width; x++) {
    const wave = Math.sin(now / 360 + x * 0.28) * 0.11
    const noise = Math.random() * 0.32
    buffer[floor + x] = clamp(intensity / 100 + wave + noise, 0, 1)

    if (Math.random() < 0.08) {
      const sparkX = clamp(x + Math.round(wind * Math.random() * 2), 0, width - 1)
      const sparkY = clamp(height - 4 - Math.floor(Math.random() * 12), 0, height - 1)
      buffer[sparkY * width + sparkX] = 1
    }
  }
}

function propagate(source, target, width, height, decay, wind) {
  const cooling = decay / 100
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width; x++) {
      const below = source[(y + 1) * width + x] || 0
      const left = source[(y + 1) * width + clamp(x - 1, 0, width - 1)] || 0
      const right = source[(y + 1) * width + clamp(x + 1, 0, width - 1)] || 0
      const low = source[clamp(y + 2, 0, height - 1) * width + x] || 0
      const drift = source[(y + 1) * width + clamp(x + wind, 0, width - 1)] || 0
      target[y * width + x] = clamp((below + left + right + low + drift) / 5 - cooling * Math.random(), 0, 1)
    }
  }
}

function render(buffer, width, height, palette, sparkColor) {
  const rows = []
  for (let y = 0; y < height; y++) {
    let row = ''
    for (let x = 0; x < width; x++) {
      const value = buffer[y * width + x]
      const spark = value > 0.88 && y < height - 4 && Math.random() < 0.18
      row += `<span style="color:${spark ? sparkColor : colorFor(value, palette)}">${charFor(value)}</span>`
    }
    rows.push(row)
  }
  return rows.join('<br/>')
}

export default function AsciiFlame({
  style,
  fontSize = 13,
  shades = DEFAULT_SHADES,
  intensity = 34,
  decay = 8,
  windDirection = 'left',
  windForce = 10,
  sparkColor = '#19ff00',
}) {
  const rootRef = useRef(null)
  const preRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const pre = preRef.current
    if (!root || !pre) return undefined

    const wind = windDirection === 'left' ? Math.ceil(windForce / 5) : -Math.ceil(windForce / 5)
    const palette = shades.length ? shades : DEFAULT_SHADES
    let width = 0
    let height = 0
    let current = new Float32Array(0)
    let next = new Float32Array(0)

    const resize = () => {
      const rect = root.getBoundingClientRect()
      width = Math.max(32, Math.floor(rect.width / (fontSize * 0.62)))
      height = Math.max(10, Math.floor(rect.height / (fontSize * 1.08)))
      current = new Float32Array(width * height)
      next = new Float32Array(width * height)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(root)

    const interval = window.setInterval(() => {
      seed(current, width, height, intensity, wind)
      propagate(current, next, width, height, decay, wind)
      pre.innerHTML = render(next, width, height, palette, sparkColor)
      const swap = current
      current = next
      next = swap
    }, 1000 / FPS)

    return () => {
      window.clearInterval(interval)
      observer.disconnect()
    }
  }, [decay, fontSize, intensity, shades, sparkColor, windDirection, windForce])

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace',
          fontSize,
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: 0,
          whiteSpace: 'pre',
          userSelect: 'none',
        }}
      />
    </div>
  )
}
