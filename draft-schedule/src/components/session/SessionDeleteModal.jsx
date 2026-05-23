import { useState } from 'react'

const WARNINGS = [
  '이 작업은 되돌릴 수 없습니다',
  '삭제된 데이터는 복구되지 않습니다',
  '내보내기로 백업하셨나요',
  '편성 데이터가 영구 삭제됩니다',
  '모든 편성 기록이 사라집니다',
]

function pickWarning(weekKey) {
  const idx = weekKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % WARNINGS.length
  return WARNINGS[idx]
}

export default function SessionDeleteModal({ session, onConfirm, onClose, isDeleting }) {
  const [input, setInput] = useState('')
  const warning = pickWarning(session.weekKey)
  const valid = input === warning

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px', width: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)', marginBottom: 6 }}>세션 삭제</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 4 }}>{session.weekKey}</code>
            {' '}세션의 모든 데이터(편성 블록·로그·채팅)가 Firebase에서 영구 삭제됩니다.
          </div>
        </div>

        <div style={{ background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 6 }}>삭제 전에 내보내기(Excel)로 백업을 권장합니다.</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
            확인을 위해 아래 문구를 그대로 입력하세요:
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.02em' }}>
            "{warning}"
          </div>
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={warning}
            style={{
              background: 'var(--bg3)', border: `1px solid ${valid ? 'var(--green)' : 'var(--border)'}`,
              color: 'var(--text)', padding: '9px 12px', borderRadius: 6, fontSize: 12,
              transition: 'border-color .15s',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={isDeleting}
            style={{ flex: 1, padding: '10px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={() => valid && onConfirm()} disabled={!valid || isDeleting}
            style={{ flex: 1, padding: '10px 0', background: valid ? 'var(--red)' : 'var(--bg4)', border: 'none', color: valid ? '#fff' : 'var(--text3)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', transition: 'all .15s' }}>
            {isDeleting ? '삭제 중...' : '영구 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
