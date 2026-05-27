import { makePerfKey } from '../hooks/usePerformanceMap'

export function getUniqueKey(item) {
  if (!item) return null
  return item.uniqueKey || item.itemId || null
}

export function getManualKey(item) {
  return getUniqueKey(item)
}

export function getResolvedEntity(item, entityProps) {
  if (!item) return item
  const key = getUniqueKey(item)
  if (!key || !entityProps) return item
  const ep = entityProps[key]
  return ep ? { ...item, ...ep } : item
}

export function getResolvedPerfKey(item, entityProps) {
  const resolved = getResolvedEntity(item, entityProps)
  if (!resolved) return null
  if (resolved.perfKey) return resolved.perfKey
  const dealType = resolved.dealTypeConverted || resolved.dealType || ''
  const pgmCodeName = resolved.pgmCodeName || ''
  return pgmCodeName ? makePerfKey(dealType, pgmCodeName) : null
}

export function getLastPerf(item, entityProps, perfMap) {
  if (!item || !perfMap) return null
  const perfKey = getResolvedPerfKey(item, entityProps)
  return perfKey ? (perfMap[perfKey] || null) : null
}

export function getManualInput(item, manualInputs) {
  const key = getManualKey(item)
  if (!key || !manualInputs) return {}
  return manualInputs[key] || {}
}
