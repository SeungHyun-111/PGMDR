import { genKey } from './uniqueKey'

export function getCompetitionItems(block) {
  if (!block) return []
  if (Array.isArray(block.items)) return block.items.flatMap(getCompetitionItems)
  if (block.isCompeting) return [block.item1, block.item2].filter(Boolean).flatMap(getCompetitionItems)
  return [toCompetitionItem(block)].filter(Boolean)
}

export function toCompetitionItem(src, weightedMin) {
  if (!src) return null
  return {
    ...(src.itemId ? { itemId: src.itemId } : {}),
    ...(src.uniqueKey ? { uniqueKey: src.uniqueKey } : {}),
    pgmCodeName: src.pgmCodeName || '',
    pgmCode: src.pgmCode || '',
    mdTeam: src.mdTeam || src.orgName || '',
    orgName: src.orgName || src.mdTeam || '',
    mdCategory: src.mdCategory || '',
    dealType: src.dealTypeConverted || src.dealType || '',
    dealTypeConverted: src.dealTypeConverted || src.dealType || '',
    dealTypeChar: src.dealTypeChar || '',
    memoCode: src.memoCode || '',
    memoCode2: src.memoCode2 || '',
    requestNote: src.requestNote || '',
    scheduleComment: src.scheduleComment || '',
    annotation: src.annotation || '',
    newProductType: src.newProductType || '',
    ...(src.perfKey ? { perfKey: src.perfKey } : {}),
    weightedMin: weightedMin ?? src.weightedMin ?? 0,
  }
}

export function makeCompetitionBlock({ slot, blockKey, channel, weightedMin, items }) {
  const normalizedItems = items.map(item => toCompetitionItem(item, weightedMin)).filter(Boolean)
  const brands = normalizedItems.map(item => brandName(item.pgmCodeName)).filter(Boolean)
  const pgmCodeName = `[${brands.join('*') || '경쟁'}]`
  return {
    slotId: slot.slotId,
    blockKey,
    dateKey: slot.dateKey,
    timeText: slot.timeText,
    durationMin: slot.durationMin,
    weightedMin,
    channel,
    isCompeting: true,
    isPreSchedule: false,
    isDefault: false,
    pgmCodeName,
    uniqueKey: genKey('3'),
    items: normalizedItems,
    item1: normalizedItems[0] || null,
    item2: normalizedItems[1] || null,
    assignedAt: Date.now(),
  }
}

export function competitionItemKey(item, index) {
  return item?.uniqueKey || item?.itemId || `${item?.pgmCodeName || 'item'}_${index}`
}

export function competitionItemToBlock(item, sourceBlock) {
  return {
    slotId: sourceBlock.slotId,
    blockKey: sourceBlock.blockKey || sourceBlock.slotId,
    dateKey: sourceBlock.dateKey,
    timeText: sourceBlock.timeText,
    durationMin: sourceBlock.durationMin,
    weightedMin: sourceBlock.weightedMin,
    channel: sourceBlock.channel || 'ALL',
    itemId: item.itemId,
    uniqueKey: item.uniqueKey,
    pgmCodeName: item.pgmCodeName || '',
    pgmCode: item.pgmCode || '',
    mdTeam: item.mdTeam || item.orgName || '',
    orgName: item.orgName || item.mdTeam || '',
    mdCategory: item.mdCategory || '',
    dealType: item.dealTypeConverted || item.dealType || '',
    dealTypeConverted: item.dealTypeConverted || item.dealType || '',
    dealTypeChar: item.dealTypeChar || '',
    memoCode: item.memoCode || '',
    memoCode2: item.memoCode2 || '',
    requestNote: item.requestNote || '',
    scheduleComment: item.scheduleComment || '',
    annotation: item.annotation || '',
    newProductType: item.newProductType || '',
    ...(item.perfKey ? { perfKey: item.perfKey } : {}),
    isDefault: false,
    isPreSchedule: false,
    assignedAt: Date.now(),
  }
}

function brandName(name) {
  return String(name || '').replace(/^\[(.+?)\].*/, '$1')
}
