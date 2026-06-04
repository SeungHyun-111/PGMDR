import { db, ref, onValue } from '../../api/firebase'
import { normalizeBlocksTeamNames } from '../../utils/teamName'
import { applyEntityProps } from '../../utils/mergeEntity'
import { filterUnscheduledItems } from '../../utils/proposalVisibility'
import { buildProposalItem, buildSlot } from '../helpers/blockBuilders'
import { getVersionPath } from '../../utils/sessionVersion'

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

export function subscribeRealtimePaths(weekKey, versionId, setState, getState) {
  unsubscribeAll()
  const versionPath = getVersionPath(weekKey, versionId)
  const paths = {
    [`${versionPath}/pgmSlots`]: snap => {
      const raw = snap.exists() ? snap.val() : []
      if (!Array.isArray(raw) || raw.length === 0) return
      setState({ pgmSlots: raw.map(buildSlot) })
    },
    [`${versionPath}/scheduleBlocks`]: snap => {
      const raw = snap.exists() ? snap.val() : {}
      const { weightedMinTargets, entityProps } = getState()
      setState({
        _rawBlocks:     raw,
        scheduleBlocks: buildMergedBlocks(raw, entityProps, weightedMinTargets),
      })
    },
    [`${versionPath}/entityProps`]: snap => {
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
    [`${versionPath}/proposalItems`]: snap => {
      const raw = snap.exists() ? snap.val() : []
      const entries = Array.isArray(raw)
        ? raw.flatMap((v, i) => v ? [{ ...v, _fbIdx: i }] : [])
        : Object.entries(raw).flatMap(([k, v]) => v ? [{ ...v, _fbIdx: k }] : [])
      const { entityProps, scheduledItemIds, scheduledUniqueKeys } = getState()
      const allProposalItems = applyEntityProps(entries.map(buildProposalItem), entityProps)
      setState({
        allProposalItems,
        proposalItems: filterUnscheduledItems(allProposalItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`${versionPath}/splitSlots`]:       snap => setState({ splitSlots:       snap.exists() ? snap.val() : {} }),
    [`${versionPath}/customSlots`]:      snap => setState({ customSlots:      snap.exists() ? snap.val() : {} }),
    [`${versionPath}/starred`]:          snap => setState({ starred:          snap.exists() ? snap.val() : {} }),
    [`${versionPath}/scheduledItemIds`]: snap => {
      const scheduledItemIds = snap.exists() ? snap.val() : {}
      const { allProposalItems, scheduledUniqueKeys } = getState()
      setState({
        scheduledItemIds,
        proposalItems: filterUnscheduledItems(allProposalItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`${versionPath}/scheduledUniqueKeys`]: snap => {
      const scheduledUniqueKeys = snap.exists() ? snap.val() : {}
      const { allProposalItems, scheduledItemIds } = getState()
      setState({
        scheduledUniqueKeys,
        proposalItems: filterUnscheduledItems(allProposalItems, scheduledItemIds, scheduledUniqueKeys),
      })
    },
    [`${versionPath}/manualInputs`]:     snap => setState({ manualInputs:     snap.exists() ? snap.val() : {} }),
  }
  Object.entries(paths).forEach(([path, handler]) => subscribePath(path, handler))
}
