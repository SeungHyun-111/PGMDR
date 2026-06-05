import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, ref, set, onValue } from '../api/firebase'

const MEMO_CODES_PATH = 'settings/memoCodes'

function normalizeMemoCodes(value) {
  const list = Array.isArray(value)
    ? value
    : Object.values(value || {})

  return list
    .filter(Boolean)
    .map((row, idx) => ({
      no: String(row.no || idx + 1),
      code: String(row.code || '').trim(),
      name: String(row.name || '').trim(),
      use: row.use === 'N' ? 'N' : 'Y',
      owner: String(row.owner || '').trim(),
    }))
    .filter(row => row.code || row.name)
}

export default function useMemoCodes({ activeOnly = false } = {}) {
  const [memoCodes, setMemoCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, MEMO_CODES_PATH),
      snapshot => {
        setMemoCodes(normalizeMemoCodes(snapshot.val()))
        setLoading(false)
        setError(null)
      },
      err => {
        setError(err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

  const filteredMemoCodes = useMemo(
    () => activeOnly ? memoCodes.filter(row => row.use === 'Y') : memoCodes,
    [memoCodes, activeOnly]
  )

  const saveMemoCodes = useCallback(async nextRows => {
    const normalized = normalizeMemoCodes(nextRows)
    await set(ref(db, MEMO_CODES_PATH), normalized)
  }, [])

  return { memoCodes: filteredMemoCodes, allMemoCodes: memoCodes, loading, error, saveMemoCodes }
}

export { MEMO_CODES_PATH }
