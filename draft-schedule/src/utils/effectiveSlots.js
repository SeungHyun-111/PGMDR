import { timeToMin } from './weightedMin'

export function getEffectivePgmSlots(pgmSlots, customSlots) {
  if (!customSlots || !Object.keys(customSlots).length) return pgmSlots

  const result = []
  for (const slot of pgmSlots) {
    const ov = customSlots[slot.slotId]
    if (ov?.deleted) continue
    result.push(ov && !ov.isCustom
      ? { ...slot, durationMin: ov.durationMin ?? slot.durationMin, weightedMin: ov.weightedMin ?? slot.weightedMin }
      : slot
    )
  }

  for (const c of Object.values(customSlots)) {
    if (c?.isCustom && !c.deleted) result.push(c)
  }

  result.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
    return timeToMin(a.timeText) - timeToMin(b.timeText)
  })

  return result
}
