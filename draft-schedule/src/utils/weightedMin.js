export function calcWeightedMin(pgmSlots, startTime, endTime) {
  const startTotal = timeToMin(startTime)
  const endTotal = timeToMin(endTime)
  if (endTotal <= startTotal) return 0

  let total = 0
  for (const slot of pgmSlots) {
    const slotStart = timeToMin(slot.timeText)
    const slotEnd = slotStart + Number(slot.durationMin)
    const slotRate = slot.durationMin > 0 ? slot.weightedMin / slot.durationMin : 0
    const overlapStart = Math.max(startTotal, slotStart)
    const overlapEnd = Math.min(endTotal, slotEnd)
    const overlap = overlapEnd - overlapStart
    if (overlap > 0) total += overlap * slotRate
  }
  return Math.round(total * 100) / 100
}

export function timeToMin(timeText) {
  if (!timeText) return 0
  const [h, m] = String(timeText).split(':').map(Number)
  return h * 60 + m
}

export function minToTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}