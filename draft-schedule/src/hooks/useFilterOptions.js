import { useMemo } from 'react'

export default function useFilterOptions(proposalItems) {
  return useMemo(() => {
    const teams        = new Set()
    const dealTypes    = new Set()
    const newTypes     = new Set()
    const videoStatuses = new Set()

    proposalItems.forEach(item => {
      if (item.mdTeam || item.team) teams.add(item.mdTeam || item.team)
      if (item.dealTypeConverted || item.dealType) dealTypes.add(item.dealTypeConverted || item.dealType)
      if (item.newProductType) newTypes.add(item.newProductType)
      if (item.videoStatus) videoStatuses.add(item.videoStatus)
    })

    return {
      teams:         [...teams].sort(),
      dealTypes:     [...dealTypes].sort(),
      newTypes:      [...newTypes].sort(),
      videoStatuses: [...videoStatuses].sort(),
    }
  }, [proposalItems])
}