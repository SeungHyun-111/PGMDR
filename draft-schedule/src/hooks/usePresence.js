import { useState, useEffect } from 'react'
import { db, ref, set, get, update, onValue, onDisconnect } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'

export default function usePresence() {
  const { userName, startDate, poolType } = useScheduleStore()

  // 48시간 이상 된 presence 항목 일괄 삭제 (앱 로드 시 1회)
  useEffect(() => {
    get(ref(db, 'presence')).then(snap => {
      if (!snap.exists()) return
      const cutoff = Date.now() - 48 * 60 * 60 * 1000
      const deletions = {}
      snap.forEach(weekSnap => {
        weekSnap.forEach(userSnap => {
          const d = userSnap.val()
          if (d && d.ts < cutoff) {
            deletions[`presence/${weekSnap.key}/${userSnap.key}`] = null
          }
        })
      })
      if (Object.keys(deletions).length) update(ref(db), deletions)
    })
  }, [])

  useEffect(() => {
    if (!startDate || !userName) return
    const weekKey = `${startDate}_${poolType}`
    const uid = `${userName}_${Date.now()}`
    const presenceRef = ref(db, `presence/${weekKey}/${uid}`)
    const connectedRef = ref(db, '.info/connected')

    // .info/connected: Firebase 소켓 연결 상태를 서버 측에서 실시간 감지
    // 연결됐을 때 presence 기록 + onDisconnect 등록 → 소켓 끊기면 서버가 자동 삭제
    const unsub = onValue(connectedRef, snap => {
      if (!snap.val()) return
      onDisconnect(presenceRef).remove()
      set(presenceRef, { userName, poolType, ts: Date.now() })
    })

    // heartbeat: ts 갱신 (마지막 활동 시간 유지)
    const interval = setInterval(() => {
      set(presenceRef, { userName, poolType, ts: Date.now() })
    }, 30000)

    return () => {
      unsub()
      clearInterval(interval)
      set(presenceRef, null)
    }
  }, [startDate, poolType, userName])
}

export function usePresenceUsers() {
  const { startDate, poolType } = useScheduleStore()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!startDate) return
    const weekKey = `${startDate}_${poolType}`
    const presenceRef = ref(db, `presence/${weekKey}`)

    const unsubscribe = onValue(presenceRef, snapshot => {
      const val = snapshot.val() || {}
      const now = Date.now()
      const list = Object.values(val)
        .filter(u => u && now - u.ts < 90000)
        .reduce((acc, u) => {
          if (!acc.find(x => x.userName === u.userName)) acc.push(u)
          return acc
        }, [])
      setUsers(list)
    })

    return () => unsubscribe()
  }, [startDate, poolType])

  return users
}

export function usePresenceCount() {
  const users = usePresenceUsers()
  return users.length
}
