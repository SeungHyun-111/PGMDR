import { useRef, useEffect } from 'react'
import useChat from '../../hooks/useChat'
import useScheduleStore from '../../store/useScheduleStore'
import ChatMessage from './ChatMessage'

export default function ChatPanel({ onClose }) {
  const { userName } = useScheduleStore()
  const { messages, input, setInput, sendMessage } = useChat()
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div data-coach="chat-panel" style={{ position: 'fixed', right: 16, bottom: 16, width: 320, height: 440, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,.2)', zIndex: 500 }}>

      {/* 헤더 */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💬 팀 채팅</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      {/* 메시지 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 40 }}>
            아직 메시지가 없습니다.
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} msg={msg} isMe={msg.userName === userName} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="메시지 입력... (Enter 전송)"
          rows={2}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: 6, fontSize: 12, resize: 'none', lineHeight: 1.4 }}
        />
        <button onClick={sendMessage}
          style={{ padding: '0 12px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          전송
        </button>
      </div>
    </div>
  )
}
