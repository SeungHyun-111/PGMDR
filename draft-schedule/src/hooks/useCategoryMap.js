import { useMemo } from 'react'

// perfMap에는 category가 없으므로 proposalItems만으로 맵 구성
export default function useCategoryMap(proposalItems) {
  return useMemo(() => {
    const map = {}
    proposalItems.forEach(item => {
      if (item.pgmCodeName) map[item.pgmCodeName] = item.mdCategory || null
    })
    return map
  }, [proposalItems])
}