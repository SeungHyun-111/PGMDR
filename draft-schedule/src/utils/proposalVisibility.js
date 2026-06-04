export function isItemScheduled(item, scheduledItemIds = {}, scheduledUniqueKeys = {}) {
  if (!item) return false
  const hasUniqueSchedule = Object.keys(scheduledUniqueKeys || {}).length > 0
  if (item.uniqueKey) {
    if (scheduledUniqueKeys[item.uniqueKey]) return true
    if (hasUniqueSchedule) return false
  }
  return !!(
    (item.itemId && scheduledItemIds[item.itemId])
  )
}

export function filterUnscheduledItems(items = [], scheduledItemIds = {}, scheduledUniqueKeys = {}) {
  return items.filter(item => item && !isItemScheduled(item, scheduledItemIds, scheduledUniqueKeys))
}

export function upsertByItemId(items = [], item) {
  if (!item?.uniqueKey && !item?.itemId) return items
  const matches = existing => item.uniqueKey
    ? existing?.uniqueKey === item.uniqueKey
    : existing?.itemId === item.itemId
  const cleanItems = items.filter(Boolean)
  const found = cleanItems.some(matches)
  return found
    ? cleanItems.map(existing => matches(existing) ? item : existing)
    : [...cleanItems, item]
}
