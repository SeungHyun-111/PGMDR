import { useEffect } from 'react'
import { db, ref, set, onValue, off } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'

export default function usePresence() {
  const { userName, startDate, poolType } = useScheduleStore()

  useEffect(() => {
    if (!startDate || !userName) return
    const weekKey = `${startDate}_${poolType}`
    const uid = `${userName}_${Date.now()}`
    const presenceRef = ref(db, `sessions/${weekKey}/presence/${uid}`)

    const data = {
      userName,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    }

    set(presenceRef, data)

    // 30초마다 lastSeen 갱신
    const interval = setInterval(() => {
      set(presenceRef, { ...data, lastSeen: Date.now() })
    }, 30000)

    // 탭 닫힐 때 제거
    const cleanup = () => set(presenceRef, null)
    window.addEventListener('beforeunload', cleanup)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', cleanup)
      set(presenceRef, null)
    }
  }, [startDate, poolType, userName])
}

export function usePresenceList() {
  const { startDate, poolType } = useScheduleStore()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!startDate) return
    const weekKey = `${startDate}_${poolType}`
    const r = ref(db, `sessions/${weekKey}/presence`)

    onValue(r, snap => {
      if (!snap.exists()) { setUsers([]); return }
      const now = Date.now()
      const active = Object.values(snap.val())
        .filter(u => now - u.lastSeen < 60000) // 1분 이내
        .sort((a, b) => a.joinedAt - b.joinedAt)
      setUsers(active)
    })

    return () => off(r)
  }, [startDate, poolType])

  return users
}