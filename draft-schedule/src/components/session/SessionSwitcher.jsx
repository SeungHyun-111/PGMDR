import { useState, useEffect, useRef } from 'react'
import { db, ref, get } from '../../api/firebase'
import SessionDeleteModal from './SessionDeleteModal'
import useScheduleStore from '../../store/useScheduleStore'

const fmtDate = ts => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()}`
}

export default function SessionSwitcher({ currentWeekKey }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const ref_ = useRef(null)
  const { loadInitData, deleteSession } = useScheduleStore()

  const loadSessions = () => {
    get(ref(db, 'activeSessions')).then(snap => {
      if (!snap.exists()) { setSessions([]); return }
      const list = Object.values(snap.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setSessions(list)
    }).catch(() => setSessions([]))
  }

  useEffect(() => {
    if (open) loadSessions()
  }, [open])

  useEffect(() => {
    const handler = e => { if (ref_.current && !ref_.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitch = (s) => {
    if (s.weekKey === currentWeekKey) { setOpen(false); return }
    localStorage.setItem('lastWeekKey', s.weekKey)
    loadInitData(s.startDate, s.poolType)
    setOpen(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    await deleteSession(deleteTarget.weekKey)
    setIsDeleting(false)
    setDeleteTarget(null)
    loadSessions()
    if (deleteTarget.weekKey === currentWeekKey) {
      localStorage.removeItem('lastWeekKey')
    }
  }

  return (
    <>
      <div ref={ref_} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>{currentWeekKey}</span>
          <span style={{ fontSize: 9, color: 'var(--text3)' }}>▼</span>
        </button>

        {open && (
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,.14)', zIndex: 300 }}>
            <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.5px' }}>세션 선택</div>
            {sessions.length === 0 ? (
              <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text3)' }}>세션 없음</div>
            ) : sessions.map(s => (
              <div key={s.weekKey}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', gap: 8, background: s.weekKey === currentWeekKey ? 'var(--bg3)' : 'transparent' }}>
                <button onClick={() => handleSwitch(s)}
                  style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: s.weekKey === currentWeekKey ? 'var(--accent)' : 'var(--text)' }}>{s.weekKey}</span>
                  {s.weekKey === currentWeekKey && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 6 }}>현재</span>}
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{fmtDate(s.createdAt)}{s.createdBy ? ` · ${s.createdBy}` : ''}</div>
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(s); setOpen(false) }}
                  title="세션 삭제"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--border2)', padding: '2px 4px', borderRadius: 3, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <SessionDeleteModal
          session={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}
