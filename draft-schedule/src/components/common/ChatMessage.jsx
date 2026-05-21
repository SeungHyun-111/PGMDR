const COLORS = ['#4a6cf7','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']

function getColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function ChatMessage({ msg, isMe }) {
  return (
    <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 6, marginBottom: 8, alignItems: 'flex-end' }}>
      {!isMe && (
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: getColor(msg.userName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {(msg.userName || '?').slice(0, 1)}
        </div>
      )}
      <div style={{ maxWidth: '70%' }}>
        {!isMe && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, paddingLeft: 4 }}>{msg.userName}</div>
        )}
        <div style={{ background: isMe ? 'var(--accent)' : 'var(--bg3)', color: isMe ? '#fff' : 'var(--text)', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '7px 10px', fontSize: 12, lineHeight: 1.4, border: isMe ? 'none' : '1px solid var(--border)', wordBreak: 'break-word' }}>
          {msg.text}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4 }}>
          {formatTime(msg.timestamp)}
        </div>
      </div>
    </div>
  )
}