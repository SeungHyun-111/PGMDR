import { normalizePromotionDate } from './promotionDate.js'
import { reservationTimestamp } from './promotionAssignment.js'

export function normalizeReservationInput(value, year = new Date().getFullYear()) {
  const text = String(value || '').trim()
  let dateText, timeText
  if (/^\d{12}$/.test(text)) { dateText = text.slice(0, 8); timeText = text.slice(8) }
  else {
    const match = text.match(/^(.+?)[T\s]+(\d{1,4}(?::\d{1,2})?(?::\d{2})?)$/)
    if (!match) throw new Error('예: 10/29 2331 또는 2026-10-29 23:31')
    ;[, dateText, timeText] = match
  }
  const date = normalizePromotionDate(dateText, year)
  if (!date) throw new Error('방송 날짜를 확인해주세요.')
  let hour, minute
  if (timeText.includes(':')) [hour, minute] = timeText.split(':')
  else if (timeText.length <= 2) { hour = timeText; minute = '00' }
  else { hour = timeText.slice(0, -2); minute = timeText.slice(-2) }
  const result = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  reservationTimestamp(result)
  return result
}

export function parseReservationPaste(text) {
  return String(text).replace(/\r/g, '').trimEnd().split('\n').filter(line => line.trim()).map(line => {
    const cells = line.split('\t').map(cell => cell.trim())
    return cells.length >= 3 ? { dateTime: `${cells[0]} ${cells[1]}`, code: cells[2] } : { dateTime: cells[0], code: cells[1] || '' }
  })
}
