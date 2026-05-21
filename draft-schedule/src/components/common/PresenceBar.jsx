import { useState, useEffect } from 'react'
import { db, ref, onValue, off } from '../../api/firebase'
import useScheduleStore from '../../store/useScheduleStore'

const COLORS = ['#4a6cf7','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']

function getColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function PresenceBar() {
  const { startDate, poolType, userName } = useScheduleStore()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!startDate) return
    const weekKey = `${startDate}_${poolType}`
    const r = ref(db, `sessions/${weekKey}/presence`)

    onValue(r, snap => {
      if (!snap.exists()) { setUsers([]); return }
      const now = Date.now()
      const active = Object.values(snap.val())
        .filter(u => now - u.lastSeen < 60000)
        .sort((a, b) => a.joinedAt - b.joinedAt)
      setUsers(active)
    })

    return () => off(r)
  }, [startDate, poolType])

  if (users.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {users.map((u, i) => (
        <div key={i} title={u.userName}
          style={{ width: 24, height: 24, borderRadius: '50%', background: getColor(u.userName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', border: u.userName === userName ? '2px solid var(--accent)' : '2px solid var(--bg2)', cursor: 'default', flexShrink: 0 }}>
          {u.userName.slice(0, 1)}
        </div>
      ))}
      <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>
        {users.length}명 접속 중
      </span>
    </div>
  )
}