// Broadcasts starting at 01:00 through 04:59 are late night; 05:00 is excluded.
export function getLateNightPgmYn(value) {
  const row = typeof value === 'object' && value ? value : null
  let time = String(row ? row.broadcastStartTime || row.startTime || row.broadcastTime || row.timeText || '' : value || '').trim()
  if (!time && row?.broadcastTimestamp) {
    const stamp = String(row.broadcastTimestamp)
    if (/^\d{12}$/.test(stamp)) time = `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`
  }
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\D|$)/)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return row?.lateNightPgmYn === 'Y' ? 'Y' : 'N'
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 60 && minutes < 300 ? 'Y' : 'N'
}
