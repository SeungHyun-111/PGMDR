import { useState } from 'react'

export default function HelpTooltip({ text, position = 'top' }) {
  const [show, setShow] = useState(false)

  const posStyle = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%',   left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    right:  { left: '100%',  top: '50%',  transform: 'translateY(-50%)', marginLeft: 6 },
    left:   { right: '100%', top: '50%',  transform: 'translateY(-50%)', marginRight: 6 },
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text3)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help' }}>
        ?
      </div>
      {show && (
        <div style={{ position: 'absolute', ...posStyle[position], zIndex: 999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', minWidth: 180, maxWidth: 260, fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, boxShadow: '0 4px 12px rgba(0,0,0,.15)', pointerEvents: 'none', whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      )}
    </div>
  )
}