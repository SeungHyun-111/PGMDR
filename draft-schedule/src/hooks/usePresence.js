import { useState, useEffect } from 'react'
import { db, ref, set, get, update, onValue } from '../api/firebase'
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

    const data = {
      userName,
      poolType,
      ts: Date.now()
    }

    set(presenceRef, data)

    const interval = setInterval(() => {
      set(presenceRef, {
        ...data,
        ts: Date.now()
      })
    }, 30000)

    return () => {
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
          if (!acc.find(x => x.userName === u.userName)) {
            acc.push(u)
          }
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