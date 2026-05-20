import { useMemo } from 'react'

export default function useCategoryMap(proposalItems, performanceRows) {
  return useMemo(() => {
    const map = {}
    proposalItems.forEach(item => {
      if (item.pgmCodeName) map[item.pgmCodeName] = item.mdCategory || null
    })
    performanceRows.forEach(perf => {
      if (perf.pgmCodeName && !map[perf.pgmCodeName]) map[perf.pgmCodeName] = perf.category || null
    })
    return map
  }, [proposalItems, performanceRows])
}