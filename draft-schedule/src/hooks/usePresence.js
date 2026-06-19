import { useState, useEffect } from 'react'
import { db, ref, set, get, update, onValue, onDisconnect } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'
import { VERSION_DRAFT } from '../utils/sessionVersion'

const STALE_MS = 90000
const CLEANUP_MS = 48 * 60 * 60 * 1000

function presenceKey(userName) {
  const safeName = String(userName || 'user').replace(/[.#$/[\]]/g, '_')
  return `${safeName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function addPresence(map, user, now) {
  if (!user || now - (user.ts || 0) >= STALE_MS) return
  const key = user.userName || user.uid
  const prev = map.get(key)
  if (!prev || (user.ts || 0) > (prev.ts || 0)) map.set(key, user)
}

function flattenPresence(raw = {}) {
  const now = Date.now()
  const latestByUser = new Map()

  Object.entries(raw).forEach(([key, value]) => {
    if (!value) return
    if (value.userName) {
      addPresence(latestByUser, { ...value, uid: key }, now)
      return
    }

    // Legacy shape: presence/{weekKey}/{uid}
    if (typeof value === 'object') {
      Object.entries(value).forEach(([uid, nestedValue]) => {
        if (!nestedValue?.userName) return
        addPresence(latestByUser, { ...nestedValue, uid, weekKey: nestedValue.weekKey || key }, now)
      })
    }
  })

  return [...latestByUser.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0))
}

export default function usePresence(activeTab = 'draft') {
  const { userName, startDate, poolType, currentVersionId } = useScheduleStore()

  useEffect(() => {
    get(ref(db, 'presence')).then(snap => {
      if (!snap.exists()) return
      const cutoff = Date.now() - CLEANUP_MS
      const deletions = {}

      snap.forEach(childSnap => {
        const child = childSnap.val()
        if (child?.userName) {
          if ((child.ts || 0) < cutoff) deletions[`presence/${childSnap.key}`] = null
          return
        }

        childSnap.forEach(userSnap => {
          const value = userSnap.val()
          if (value && (value.ts || 0) < cutoff) {
            deletions[`presence/${childSnap.key}/${userSnap.key}`] = null
          }
        })
      })

      if (Object.keys(deletions).length) update(ref(db), deletions)
    })
  }, [])

  useEffect(() => {
    if (!startDate || !userName) return

    const weekKey = `${startDate}_${poolType}`
    const presenceRef = ref(db, `presence/${presenceKey(userName)}`)
    const connectedRef = ref(db, '.info/connected')
    const writePresence = () => set(presenceRef, {
      userName,
      startDate,
      poolType,
      weekKey,
      versionId: currentVersionId || VERSION_DRAFT,
      tabId: activeTab,
      ts: Date.now(),
    })

    const unsub = onValue(connectedRef, snap => {
      if (!snap.val()) return
      onDisconnect(presenceRef).remove()
      writePresence()
    })

    const interval = setInterval(writePresence, 30000)

    return () => {
      unsub()
      clearInterval(interval)
      set(presenceRef, null)
    }
  }, [startDate, poolType, userName, currentVersionId, activeTab])
}

export function usePresenceUsers() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    const presenceRef = ref(db, 'presence')

    const unsubscribe = onValue(presenceRef, snapshot => {
      setUsers(flattenPresence(snapshot.val() || {}))
    })

    const tick = setInterval(() => {
      get(presenceRef).then(snapshot => setUsers(flattenPresence(snapshot.val() || {})))
    }, 15000)

    return () => {
      unsubscribe()
      clearInterval(tick)
    }
  }, [])

  return users
}

export function usePresenceCount() {
  const users = usePresenceUsers()
  return users.length
}
