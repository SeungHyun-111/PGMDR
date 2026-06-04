import { useState, useEffect } from 'react'
import { db, ref, get } from '../../api/firebase'
import { sessionEntriesToSortedList } from '../../utils/sessionSort'

const fmtDate = ts => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function SessionPickerScreen({ onJoin, onNew }) {
  const [sessions, setSessions] = useState(null) // null = 로딩 중

  useEffect(() => {
    get(ref(db, 'activeSessions')).then(snap => {
      if (!snap.exists()) { setSessions([]); return }
      setSessions(sessionEntriesToSortedList(snap.val()))
    }).catch(() => setSessions([]))
  }, [])

  if (sessions === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)' }}>세션 목록 불러오는 중...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
      <div style={{ width: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>편성 작업판</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>진입할 편성 세션을 선택하거나 새 편성을 시작하세요.</div>
        </div>

        {sessions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 2 }}>진행 중인 세션</div>
            {sessions.map(s => (
              <div key={s.weekKey}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{s.weekKey}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: s.poolType === 'B' ? 'rgba(249,115,22,.15)' : 'rgba(99,102,241,.15)', color: s.poolType === 'B' ? 'var(--orange)' : 'var(--accent)', fontWeight: 700 }}>풀 {s.poolType}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    생성: {fmtDate(s.createdAt)}{s.createdBy ? ` · ${s.createdBy}` : ''}
                  </div>
                </div>
                <button onClick={() => onJoin(s.startDate, s.poolType)}
                  style={{ padding: '8px 20px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  접속
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            진행 중인 세션이 없습니다.
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={onNew}
            style={{ width: '100%', padding: '11px 0', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + 새 편성 시작
          </button>
        </div>
      </div>
    </div>
  )
}
