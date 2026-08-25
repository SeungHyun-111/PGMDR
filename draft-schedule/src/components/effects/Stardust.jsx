import { useEffect, useRef } from 'react'

export default function Stardust({
  color = '122, 255, 72',
  density = 120,
  sizeScale = 1,
  alphaScale = 1,
  speedScale = 1,
  style,
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    let width = 0
    let height = 0
    let raf = 0
    let particles = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = Array.from({ length: density }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: (Math.random() * 1.7 + 0.35) * sizeScale,
        alpha: (Math.random() * 0.42 + 0.08) * alphaScale,
        speed: (Math.random() * 0.18 + 0.04) * speedScale,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const draw = time => {
      ctx.clearRect(0, 0, width, height)
      for (const particle of particles) {
        particle.y += particle.speed
        if (particle.y > height + 8) {
          particle.y = -8
          particle.x = Math.random() * width
        }
        const shimmer = 0.6 + Math.sin(time / 900 + particle.phase) * 0.4
        ctx.fillStyle = `rgba(${color}, ${particle.alpha * shimmer})`
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [alphaScale, color, density, sizeScale, speedScale])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
