function getSessionDate(session = {}) {
  const fromStartDate = session.startDate || ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromStartDate)) return fromStartDate
  const fromWeekKey = session.weekKey || ''
  const match = fromWeekKey.match(/^\d{4}-\d{2}-\d{2}/)
  return match?.[0] || ''
}

export function sessionEntriesToSortedList(raw) {
  return Object.entries(raw || {})
    .map(([weekKey, session]) => ({ weekKey, ...(session || {}) }))
    .sort((a, b) => {
      const dateCmp = getSessionDate(b).localeCompare(getSessionDate(a))
      if (dateCmp) return dateCmp

      const poolCmp = String(a.poolType || '').localeCompare(String(b.poolType || ''))
      if (poolCmp) return poolCmp

      return (b.createdAt || 0) - (a.createdAt || 0)
    })
}
