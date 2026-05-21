import { useState, useEffect } from 'react'
import { db, ref, set, onValue, off } from '../api/firebase'
import useScheduleStore from '../store/useScheduleStore'

export default function useChat() {
  const { startDate, poolType, userName } = useScheduleStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!startDate) return
    const weekKey = `${startDate}_${poolType}`
    const r = ref(db, `sessions/${weekKey}/chat`)

    onValue(r, snap => {
      if (!snap.exists()) { setMessages([]); return }
      const msgs = Object.values(snap.val())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-100) // 최근 100개
      setMessages(msgs)
    })

    return () => off(r)
  }, [startDate, poolType])

  const sendMessage = async () => {
    if (!input.trim() || !startDate) return
    const weekKey = `${startDate}_${poolType}`
    const msgKey = `msg_${Date.now()}`
    await set(ref(db, `sessions/${weekKey}/chat/${msgKey}`), {
      userName,
      text: input.trim(),
      timestamp: Date.now(),
    })
    setInput('')
  }

  return { messages, input, setInput, sendMessage }
}