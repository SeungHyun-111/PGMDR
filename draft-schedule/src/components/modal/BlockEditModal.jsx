import { useState } from 'react'

export default function BlockEditModal({ block, onSave, onClose }) {
  const [pgmCodeName, setPgmCodeName] = useState(block.pgmCodeName || '')
  const [memoCode, setMemoCode] = useState(block.memoCode || '')
  const [scheduleComment, setScheduleComment] = useState(block.scheduleComment || '')
  const [channel, setChannel] = useState(block.channel || 'CA')

  const handleSave = () => {
    onSave({ pgmCodeName, memoCode, scheduleComment, channel })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', minWidth: 340, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>블록 수정</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>방송일시</label>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{block.dateKey} {block.timeText} · {block.durationMin}분 · 가중분 {block.weightedMin}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>채널</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['CA', 'IP', 'ALL'].map(ch => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 5, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: channel === ch ? (ch === 'CA' ? 'var(--ca2)' : ch === 'IP' ? 'var(--ip2)' : 'var(--all2)') : 'var(--bg4)', borderColor: channel === ch ? 'transparent' : 'var(--border)', color: channel === ch ? '#fff' : 'var(--text2)' }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>편성코드명</label>
          <input
            value={pgmCodeName}
            onChange={e => setPgmCodeName(e.target.value)}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 5, fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>메모코드</label>
          <input
            value={memoCode}
            onChange={e => setMemoCode(e.target.value)}
            placeholder="[전사블록]"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 5, fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>편성C (코멘트)</label>
          <textarea
            value={scheduleComment}
            onChange={e => setScheduleComment(e.target.value)}
            rows={3}
            placeholder="편성 관련 코멘트를 입력하세요..."
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 5, fontSize: 12, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '9px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </div>
  )
}