import { db, ref, onValue } from '../../api/firebase'
import { normalizeBlocksTeamNames } from '../../utils/teamName'
import { applyEntityProps } from '../../utils/mergeEntity'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'

const _subs = {}

export function subscribePath(path, handler) {
  if (_subs[path]) _subs[path]()
  const unsub = onValue(ref(db, path), handler)
  _subs[path] = unsub
}

export function unsubscribeAll() {
  Object.values(_subs).forEach(unsub => unsub())
  Object.keys(_subs).forEach(k => delete _subs[k])
}

function buildMergedBlocks(rawBlocks, entityProps, weightedMinTargets) {
  const normalized = normalizeBlocksTeamNames(rawBlocks, weightedMinTargets)
  return applyEntityProps(normalized, entityProps)
}

export function subscribeRealtimePaths(weekKey, setState, getState) {
  unsubscribeAll()
  const paths = {
    [`sessions/${weekKey}/scheduleBlocks`]: snap => {
      const raw = snap.exists() ? snap.val() : {}
      const { weightedMinTargets, entityProps } = getState()
      setState({
        _rawBlocks:     raw,
        scheduleBlocks: buildMergedBlocks(raw, entityProps, weightedMinTargets),
      })
    },
    [`sessions/${weekKey}/entityProps`]: snap => {
      const ep = snap.exists() ? snap.val() : {}
      const { _rawBlocks, weightedMinTargets, allProposalItems, scheduledItemIds, scheduledUniqueKeys } = getState()
      const allItems = applyEntityProps(allProposalItems, ep)
      setState({
        entityProps:    ep,
        scheduleBlocks: buildMergedBlocks(_rawBlocks, ep, weightedMinTargets),
        // 사이드바 아이템에도 최신 entityProps 반영
        allProposalItems: allItems,
        proposalItems:  filterUnscheduledItems(allItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`sessions/${weekKey}/splitSlots`]:       snap => setState({ splitSlots:       snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/customSlots`]:      snap => setState({ customSlots:      snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/starred`]:          snap => setState({ starred:          snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/scheduledItemIds`]: snap => {
      const scheduledItemIds = snap.exists() ? snap.val() : {}
      const { allProposalItems, scheduledUniqueKeys } = getState()
      setState({
        scheduledItemIds,
        proposalItems: filterUnscheduledItems(allProposalItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`sessions/${weekKey}/scheduledUniqueKeys`]: snap => {
      const scheduledUniqueKeys = snap.exists() ? snap.val() : {}
      const { allProposalItems, scheduledItemIds } = getState()
      setState({
        scheduledUniqueKeys,
        proposalItems: filterUnscheduledItems(allProposalItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`sessions/${weekKey}/manualInputs`]:     snap => setState({ manualInputs:     snap.exists() ? snap.val() : {} }),
  }
  Object.entries(paths).forEach(([path, handler]) => subscribePath(path, handler))
}
