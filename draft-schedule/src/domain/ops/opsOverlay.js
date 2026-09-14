import { normalizeDealType } from '../../hooks/usePerformanceMap.js'

export const OPS_ENTITY_FIELDS = [
  'requestNote',
  'scheduleComment',
  'annotation',
  'memoCode',
  'memoCodeCode',
]

export const OPS_MANUAL_FIELDS = [
  'expectedSalesPerWeightedMin',
  'expectedProfitPerWeightedMin',
]

export const OPS_CONFLICT_KEEP_CURRENT = 'current'
export const OPS_CONFLICT_USE_SOURCE = 'source'

export function getOpsScheduleCode(block = {}) {
  return String(block.pgmCode || '').trim()
}

export function makeOpsExactKey(block = {}) {
  const dateKey = String(block.dateKey || '').trim()
  const timeText = normalizeTimeText(block.timeText)
  const dealType = normalizeDealType(block.dealTypeConverted || block.dealType || '')
  const pgmCode = getOpsScheduleCode(block)
  if (!dateKey || !timeText || !dealType || !pgmCode) return ''
  return [dateKey, timeText, dealType, pgmCode].join('|')
}

export function makeOpsMoveKey(block = {}) {
  const dateKey = String(block.dateKey || '').trim()
  const dealType = normalizeDealType(block.dealTypeConverted || block.dealType || '')
  const pgmCode = getOpsScheduleCode(block)
  if (!dateKey || !dealType || !pgmCode) return ''
  return [dateKey, dealType, pgmCode].join('|')
}

export function extractOpsEntityOverlay(source = {}) {
  const out = {}
  OPS_ENTITY_FIELDS.forEach(field => {
    out[field] = normalizeOverlayValue(source[field])
  })
  return out
}

export function extractOpsManualOverlay(source = {}) {
  const out = {}
  OPS_MANUAL_FIELDS.forEach(field => {
    out[field] = normalizeOverlayValue(source[field])
  })
  return out
}

export function extractOpsOverlayRecord(block = {}, entityProps = {}, manualInputs = {}) {
  const uniqueKey = block.uniqueKey
  const entity = uniqueKey ? (entityProps?.[uniqueKey] || {}) : {}
  const manual = uniqueKey ? (manualInputs?.[uniqueKey] || {}) : {}
  return {
    entity: extractOpsEntityOverlay({ ...block, ...entity }),
    manual: extractOpsManualOverlay(manual),
  }
}

export function buildOpsOverlayResult({
  mode,
  sourceBlocks = {},
  sourceEntityProps = {},
  salesVersion = {},
  currentOpsVersion = {},
  dirtyByUniqueKey = {},
  orphans = {},
  now = Date.now(),
}) {
  const baseVersion = mode === 'initial' ? salesVersion : currentOpsVersion
  const baseBlocks = baseVersion.scheduleBlocks || {}
  const baseEntityProps = baseVersion.entityProps || {}
  const baseManualInputs = baseVersion.manualInputs || {}

  const exactBase = indexBlocks(baseBlocks, makeOpsExactKey)
  const moveBase = indexBlocks(baseBlocks, makeOpsMoveKey)
  const conflicts = []
  const matchedBaseKeys = new Set()
  const matchedOrphanKeys = new Set()
  const entityProps = {}
  const manualInputs = {}
  const scheduledUniqueKeys = {}
  const nextDirtyByUniqueKey = {}

  Object.entries(sourceBlocks).forEach(([blockKey, sourceBlock]) => {
    if (!sourceBlock) return
    const exactKey = makeOpsExactKey(sourceBlock)
    const moveKey = makeOpsMoveKey(sourceBlock)
    const exactMatch = exactKey ? getNextIndexedMatch(exactBase[exactKey], matchedBaseKeys) : null
    let baseMatch = exactMatch
    let matchType = exactMatch ? 'exact' : ''

    if (!baseMatch && mode === 'refresh' && moveKey) {
      const moveMatch = getSingleUnmatchedIndexedMatch(moveBase[moveKey], matchedBaseKeys)
      if (moveMatch.match) {
        baseMatch = moveMatch.match
        matchType = 'timeMove'
      } else if (moveMatch.candidates.length > 1) {
        conflicts.push(makeAmbiguousConflict(sourceBlock, blockKey, moveMatch.candidates))
      }
    }

    if (baseMatch) matchedBaseKeys.add(baseMatch.blockKey)

    const orphan = exactKey ? orphans[exactKey] : null
    if (orphan && exactKey) matchedOrphanKeys.add(exactKey)
    const sourceUniqueKey = sourceBlock.uniqueKey || ''
    const uniqueKey = baseMatch?.block?.uniqueKey || orphan?.uniqueKey || sourceUniqueKey
    const sourceEntity = extractOpsEntityOverlay(sourceEntityProps[sourceUniqueKey] || sourceBlock)
    const baselineEntity = baseMatch
      ? extractOpsEntityOverlay(baseMatch.block)
      : extractOpsEntityOverlay(orphan?.entity || {})
    const currentEntity = baseMatch
      ? extractOpsEntityOverlay({ ...baseMatch.block, ...(baseEntityProps[baseMatch.block.uniqueKey] || {}) })
      : extractOpsEntityOverlay(orphan?.entity || {})
    const baselineManual = baseMatch
      ? extractOpsManualOverlay(baseManualInputs[baseMatch.block.uniqueKey] || {})
      : extractOpsManualOverlay(orphan?.manual || {})
    const currentManual = baselineManual
    const dirty = baseMatch ? (dirtyByUniqueKey[baseMatch.block.uniqueKey] || {}) : (orphan?.dirty || {})

    const entityPatch = resolveFieldGroup({
      mode,
      fields: OPS_ENTITY_FIELDS,
      group: 'entity',
      dirty,
      baseline: baselineEntity,
      current: currentEntity,
      source: sourceEntity,
      block: sourceBlock,
      blockKey,
      uniqueKey,
      matchType,
      conflicts,
    })
    const manualPatch = resolveFieldGroup({
      mode,
      fields: OPS_MANUAL_FIELDS,
      group: 'manual',
      dirty,
      baseline: baselineManual,
      current: currentManual,
      source: baselineManual,
      block: sourceBlock,
      blockKey,
      uniqueKey,
      matchType,
      conflicts,
    })

    const nextBlock = { ...sourceBlock, uniqueKey }
    entityProps[uniqueKey] = {
      ...(sourceEntityProps[sourceUniqueKey] || {}),
      ...entityPatch,
    }
    const compactManual = compactObject(manualPatch)
    if (Object.keys(compactManual).length) manualInputs[uniqueKey] = compactManual
    scheduledUniqueKeys[uniqueKey] = true
    sourceBlocks[blockKey] = nextBlock

    const nextDirty = remapDirty(dirty, uniqueKey, conflicts)
    if (nextDirty) nextDirtyByUniqueKey[uniqueKey] = nextDirty
  })

  const nextOrphans = {}
  Object.entries(baseBlocks).forEach(([blockKey, block]) => {
    if (!block || matchedBaseKeys.has(blockKey)) return
    const uniqueKey = block.uniqueKey
    const exactKey = makeOpsExactKey(block)
    if (!uniqueKey || !exactKey) return
    const dirty = dirtyByUniqueKey[uniqueKey]
    const manual = extractOpsManualOverlay(baseManualInputs[uniqueKey] || {})
    const entity = extractOpsEntityOverlay({ ...block, ...(baseEntityProps[uniqueKey] || {}) })
    if (!dirty && !hasOverlayValue(entity) && !hasOverlayValue(manual)) return
    nextOrphans[exactKey] = { uniqueKey, entity, manual, dirty: dirty || null, lastSeenAt: now }
  })

  Object.entries(orphans || {}).forEach(([key, orphan]) => {
    if (!key || nextOrphans[key] || matchedOrphanKeys.has(key)) return
    nextOrphans[key] = { ...orphan, lastSeenAt: orphan?.lastSeenAt || now }
  })

  return {
    scheduleBlocks: sourceBlocks,
    entityProps,
    manualInputs,
    scheduledUniqueKeys,
    opsOverlay: {
      dirtyByUniqueKey: nextDirtyByUniqueKey,
      orphans: nextOrphans,
      lastSyncAt: now,
    },
    conflicts,
  }
}

export function applyOpsConflictResolutions(versionData = {}, conflicts = [], resolutions = {}) {
  const entityProps = { ...(versionData.entityProps || {}) }
  const manualInputs = { ...(versionData.manualInputs || {}) }
  const dirtyByUniqueKey = { ...(versionData.opsOverlay?.dirtyByUniqueKey || {}) }

  conflicts.forEach(conflict => {
    const choice = resolutions[conflict.id]
    if (!choice || choice === OPS_CONFLICT_KEEP_CURRENT || conflict.type !== 'field') return
    const uniqueKey = conflict.uniqueKey
    if (!uniqueKey) return
    if (conflict.group === 'manual') {
      manualInputs[uniqueKey] = {
        ...(manualInputs[uniqueKey] || {}),
        [conflict.field]: conflict.sourceValue ?? null,
      }
    } else {
      entityProps[uniqueKey] = {
        ...(entityProps[uniqueKey] || {}),
        [conflict.field]: conflict.sourceValue ?? '',
      }
    }
    dirtyByUniqueKey[uniqueKey] = clearDirtyField(dirtyByUniqueKey[uniqueKey], conflict.group, conflict.field)
    if (!dirtyByUniqueKey[uniqueKey]) delete dirtyByUniqueKey[uniqueKey]
  })

  return {
    entityProps,
    manualInputs,
    opsOverlay: {
      ...(versionData.opsOverlay || {}),
      dirtyByUniqueKey,
    },
  }
}

function resolveFieldGroup({ mode, fields, group, dirty, baseline, current, source, block, blockKey, uniqueKey, matchType, conflicts }) {
  const out = {}
  fields.forEach(field => {
    if (mode === 'initial') {
      const currentValue = normalizeOverlayValue(current[field])
      out[field] = currentValue === '' ? normalizeOverlayValue(source[field]) : currentValue
      return
    }

    const fieldDirty = isFieldDirty(dirty, group, field)
    const baselineValue = normalizeOverlayValue(baseline[field])
    const currentValue = normalizeOverlayValue(current[field])
    const sourceValue = normalizeOverlayValue(source[field])
    const sourceChanged = !sameOverlayValue(baselineValue, sourceValue)

    if (!fieldDirty) {
      out[field] = sourceValue
      return
    }

    if (sourceChanged) {
      conflicts.push({
        id: `${uniqueKey || blockKey}:${group}:${field}`,
        type: 'field',
        group,
        field,
        uniqueKey,
        blockKey,
        pgmCode: getOpsScheduleCode(block),
        pgmCodeName: block.pgmCodeName || '',
        dateKey: block.dateKey || '',
        timeText: block.timeText || '',
        matchType,
        currentValue,
        sourceValue,
      })
    }
    out[field] = currentValue
  })
  return out
}

function indexBlocks(blocks, keyFn) {
  const index = {}
  Object.entries(blocks || {}).forEach(([blockKey, block]) => {
    if (!block) return
    const key = keyFn(block)
    if (!key) return
    if (!index[key]) index[key] = []
    index[key].push({ blockKey, block })
  })
  return index
}

function getNextIndexedMatch(list, matchedBaseKeys) {
  if (!Array.isArray(list)) return null
  return list.find(candidate => !matchedBaseKeys.has(candidate.blockKey)) || null
}

function getSingleUnmatchedIndexedMatch(list, matchedBaseKeys) {
  const candidates = (Array.isArray(list) ? list : []).filter(candidate => !matchedBaseKeys.has(candidate.blockKey))
  return {
    candidates,
    match: candidates.length === 1 ? candidates[0] : null,
  }
}

function isFieldDirty(dirty, group, field) {
  if (!dirty) return false
  if (group === 'manual') return !!dirty.manual?.[field]
  return !!dirty[field]
}

function remapDirty(dirty, uniqueKey, conflicts) {
  if (!dirty) return null
  const hasConflict = conflicts.some(conflict => conflict.uniqueKey === uniqueKey && conflict.type === 'field')
  if (hasConflict) return dirty
  return Object.keys(dirty).length ? dirty : null
}

function clearDirtyField(dirty, group, field) {
  if (!dirty) return null
  const next = { ...dirty }
  if (group === 'manual') {
    next.manual = { ...(next.manual || {}) }
    delete next.manual[field]
    if (!Object.keys(next.manual).length) delete next.manual
  } else {
    delete next[field]
  }
  return Object.keys(next).length ? next : null
}

function makeAmbiguousConflict(sourceBlock, blockKey, candidates) {
  return {
    id: `${blockKey}:ambiguous-time-move`,
    type: 'ambiguous',
    blockKey,
    pgmCode: getOpsScheduleCode(sourceBlock),
    pgmCodeName: sourceBlock.pgmCodeName || '',
    dateKey: sourceBlock.dateKey || '',
    timeText: sourceBlock.timeText || '',
    candidates: candidates.map(candidate => ({
      blockKey: candidate.blockKey,
      uniqueKey: candidate.block?.uniqueKey || '',
      timeText: candidate.block?.timeText || '',
      pgmCodeName: candidate.block?.pgmCodeName || '',
    })),
  }
}

function normalizeTimeText(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?/)
  if (!match) return ''
  return `${String(Number(match[1]) || 0).padStart(2, '0')}:${String(Number(match[2] || 0) || 0).padStart(2, '0')}`
}

function normalizeOverlayValue(value) {
  if (value === undefined) return ''
  if (value === null) return ''
  return value
}

function sameOverlayValue(a, b) {
  return String(normalizeOverlayValue(a)) === String(normalizeOverlayValue(b))
}

function hasOverlayValue(obj = {}) {
  return Object.values(obj || {}).some(value => normalizeOverlayValue(value) !== '')
}

function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => normalizeOverlayValue(value) !== '')
  )
}
