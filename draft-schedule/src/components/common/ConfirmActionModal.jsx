import { useEffect } from 'react'

export default function ConfirmActionModal({
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
  children,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, onConfirm])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.42)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: '18px 20px',
          boxShadow: '0 16px 48px rgba(0,0,0,.45)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>{description}</div>
        )}
        {children}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{ flex: 1, padding: '8px 0', background: danger ? 'var(--red)' : 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
