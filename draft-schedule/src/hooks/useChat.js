import { useState, useEffect } from 'react'
import { db, ref, set, onValue } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'

export default function useChat() {
  const { startDate, poolType, userName } = useScheduleStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!startDate) return
    const weekKey = `${startDate}_${poolType}`
    const r = ref(db, `chat/${weekKey}`)  // 루트 분리된 경로

    const unsub = onValue(r, snap => {
      if (!snap.exists()) { setMessages([]); return }
      const msgs = Object.values(snap.val())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-100)
      setMessages(msgs)
    })

    return () => unsub()
  }, [startDate, poolType])

  const sendMessage = async () => {
    if (!input.trim() || !startDate) return
    const weekKey = `${startDate}_${poolType}`
    await set(ref(db, `chat/${weekKey}/msg_${Date.now()}`), {
      userName,
      text: input.trim(),
      timestamp: Date.now(),
    })
    setInput('')
  }

  return { messages, input, setInput, sendMessage }
}