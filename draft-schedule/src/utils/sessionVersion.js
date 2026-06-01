export const VERSION_DRAFT = 'draft'
export const VERSION_SALES = 'sales'

export const SESSION_VERSIONS = [
  { id: VERSION_DRAFT, label: '담당 작성' },
  { id: VERSION_SALES, label: '영업팀 공유' },
]

export const VERSION_DATA_KEYS = [
  'proposalItems',
  'scheduleBlocks',
  'entityProps',
  'splitSlots',
  'customSlots',
  'starred',
  'scheduledItemIds',
  'scheduledUniqueKeys',
  'manualInputs',
]

export function getVersionPath(weekKey, versionId = VERSION_DRAFT, child = '') {
  const base = `sessions/${weekKey}/versions/${versionId}`
  return child ? `${base}/${child}` : base
}

export function getVersionLabel(versionId) {
  return SESSION_VERSIONS.find(v => v.id === versionId)?.label || versionId
}

export function getCurrentVersionId(getState) {
  return getState().currentVersionId || VERSION_DRAFT
}

export function getCurrentVersionPath(getState, weekKey, child = '') {
  return getVersionPath(weekKey, getCurrentVersionId(getState), child)
}

export function buildVersionSnapshot(state) {
  return {
    proposalItems: (state.allProposalItems || []).map(({ _fbIdx, ...item }) => item),
    scheduleBlocks: state._rawBlocks || state.scheduleBlocks || {},
    entityProps: state.entityProps || {},
    splitSlots: state.splitSlots || {},
    customSlots: state.customSlots || {},
    starred: state.starred || {},
    scheduledItemIds: state.scheduledItemIds || {},
    scheduledUniqueKeys: state.scheduledUniqueKeys || {},
    manualInputs: state.manualInputs || {},
    publishedAt: Date.now(),
    sourceVersionId: VERSION_DRAFT,
  }
}
