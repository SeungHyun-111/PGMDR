import { useEffect, useLayoutEffect, useState } from 'react'

const PADDING = 7

export default function CoachMark({ steps, stepIndex, onStepChange, onClose }) {
  const [rect, setRect] = useState(null)
  const [targetRect, setTargetRect] = useState(null)
  const step = steps[stepIndex]

  const updateRect = () => {
    const target = document.querySelector(step.target)
    if (!target) {
      setRect(null)
      setTargetRect(null)
      return false
    }
    const targetBox = target.getBoundingClientRect()
    setTargetRect({
      top: Math.max(6, targetBox.top - PADDING),
      left: Math.max(6, targetBox.left - PADDING),
      width: Math.min(window.innerWidth - 12, targetBox.width + PADDING * 2),
      height: targetBox.height + PADDING * 2,
    })
    const boxes = [targetBox, step.include ? document.querySelector(step.include)?.getBoundingClientRect() : null]
      .filter(Boolean)
    const box = boxes.reduce((acc, current) => ({
      top: Math.min(acc.top, current.top),
      left: Math.min(acc.left, current.left),
      right: Math.max(acc.right, current.right),
      bottom: Math.max(acc.bottom, current.bottom),
    }))
    setRect({
      top: Math.max(6, box.top - PADDING),
      left: Math.max(6, box.left - PADDING),
      width: Math.min(window.innerWidth - 12, box.right - box.left + PADDING * 2),
      height: box.bottom - box.top + PADDING * 2,
    })
    return true
  }

  useLayoutEffect(() => {
    const target = document.querySelector(step.target)
    target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    updateRect()
    const frame = requestAnimationFrame(updateRect)
    const observer = new MutationObserver(updateRect)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [stepIndex, step.target, step.include])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && stepIndex < steps.length - 1) onStepChange(stepIndex + 1)
      if (event.key === 'ArrowLeft' && stepIndex > 0) onStepChange(stepIndex - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onStepChange, stepIndex, steps.length])

  if (!rect) {
    const isLast = stepIndex === steps.length - 1
    return (
      <div className="coach" role="dialog" aria-modal="true" aria-label="화면 사용 안내">
        <div className="coach__shade" style={{ inset: 0 }} />
        <section className="coach__card" style={{ top: '50%', left: '50%', width: Math.min(380, window.innerWidth - 32), transform: 'translate(-50%, -50%)' }}>
          <div className="coach__eyebrow">
            <span>{String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
            <div className="coach__progress">
              {steps.map((_, index) => <i key={index} className={index <= stepIndex ? 'is-on' : ''} />)}
            </div>
            <button className="coach__close" onClick={onClose} aria-label="안내 닫기">×</button>
          </div>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
          <div className="coach__actions">
            <button className="coach__skip" onClick={onClose}>건너뛰기</button>
            <div>
              {stepIndex > 0 && <button className="coach__back" onClick={() => onStepChange(stepIndex - 1)}>이전</button>}
              <button className="coach__next" onClick={() => isLast ? onClose() : onStepChange(stepIndex + 1)}>
                {isLast ? '안내 완료' : '다음'} <span>→</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const cardWidth = Math.min(380, window.innerWidth - 32)
  const preferredBelow = rect.top + rect.height + 236 < window.innerHeight
  const cardTop = preferredBelow ? rect.top + rect.height + 12 : Math.max(16, rect.top - 228)
  const cardLeft = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.left + rect.width / 2 - cardWidth / 2))
  const isLast = stepIndex === steps.length - 1

  return (
    <div className="coach" role="dialog" aria-modal="true" aria-label="화면 사용 안내">
      <div className="coach__shade" style={{ top: 0, left: 0, right: 0, height: rect.top }} />
      <div className="coach__shade" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
      <div className="coach__shade" style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }} />
      <div className="coach__shade" style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }} />
      <div className="coach__focus" style={rect} />
      {targetRect && step.include && <div className="coach__target" style={targetRect} />}
      <section className="coach__card" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
        <div className="coach__eyebrow">
          <span>{String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
          <div className="coach__progress">
            {steps.map((_, index) => <i key={index} className={index <= stepIndex ? 'is-on' : ''} />)}
          </div>
          <button className="coach__close" onClick={onClose} aria-label="안내 닫기">×</button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="coach__actions">
          <button className="coach__skip" onClick={onClose}>건너뛰기</button>
          <div>
            {stepIndex > 0 && <button className="coach__back" onClick={() => onStepChange(stepIndex - 1)}>이전</button>}
            <button className="coach__next" onClick={() => isLast ? onClose() : onStepChange(stepIndex + 1)}>
              {isLast ? '안내 완료' : '다음'} <span>→</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
