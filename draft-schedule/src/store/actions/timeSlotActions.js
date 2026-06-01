import { db, ref, set, update } from '../../api/firebase'
import { timeToMin, minToTime } from '../../utils/weightedMin'
import { splitWeightedMin } from '../../utils/weightedMin'
import { getEffectivePgmSlots } from '../../utils/effectiveSlots'
import { getCurrentVersionPath } from '../../utils/sessionVersion'

export function createTimeSlotActions(setState, getState) {
  return {
    // 슬롯 시간 분할: slotId 슬롯을 newTimeText 기준으로 앞/뒤로 나눔
    async splitSlotTime(slotId, newTimeText) {
      const { startDate, poolType, pgmSlots, customSlots, scheduleBlocks, splitSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const effective = getEffectivePgmSlots(pgmSlots, customSlots)
      const slot = effective.find(s => s.slotId === slotId)
      if (!slot) return

      const origStart = timeToMin(slot.timeText)
      const newStart  = timeToMin(newTimeText)
      const origEnd   = origStart + slot.durationMin

      if (newStart <= origStart || newStart >= origEnd) return

      const firstDur  = newStart - origStart
      const secondDur = origEnd   - newStart
      const rate      = slot.durationMin > 0 ? slot.weightedMin / slot.durationMin : 0
      const firstWm   = Math.round(rate * firstDur)
      const secondWm  = Math.round(rate * secondDur)

      const customSlotId = `custom_${slotId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      // 원본(또는 기존 커스텀) 슬롯 duration 단축
      const prevOv = customSlots[slotId] || {}
      const slotEntry = prevOv.isCustom
        ? { ...prevOv, durationMin: firstDur, weightedMin: firstWm }  // 커스텀 슬롯: 기존 필드 유지
        : { durationMin: firstDur, weightedMin: firstWm }              // 원본 슬롯: override만 저장
      const fbPatch = {
        [`customSlots/${slotId}`]: slotEntry,
        [`customSlots/${customSlotId}`]: {
          slotId: customSlotId,
          dateKey: slot.dateKey,
          timeText: newTimeText,
          durationMin: secondDur,
          weightedMin: secondWm,
          channel: 'ALL',
          isCustom: true,
          parentSlotId: slotId,
        },
      }
      const block = scheduleBlocks[slotId]
      if (block) fbPatch[`scheduleBlocks/${slotId}`] = { ...block, durationMin: firstDur, weightedMin: firstWm }
      if (splitSlots[slotId]) {
        const { caWeighted, ipWeighted } = splitWeightedMin(firstWm, slot.dateKey, slot.timeText)
        const caBlock = scheduleBlocks[`${slotId}_CA`]
        const ipBlock = scheduleBlocks[`${slotId}_IP`]
        if (caBlock) fbPatch[`scheduleBlocks/${slotId}_CA`] = { ...caBlock, durationMin: firstDur, weightedMin: caWeighted }
        if (ipBlock) fbPatch[`scheduleBlocks/${slotId}_IP`] = { ...ipBlock, durationMin: firstDur, weightedMin: ipWeighted }
      }
      recordVersionPatchUndo(getState, versionPath, '시간 나누기 되돌리기', fbPatch)
      await update(ref(db, versionPath), fbPatch)
      getState()._writeLog('시간나누기', slotId, slot, { ...slot, durationMin: firstDur, weightedMin: firstWm }, {
        scope: 'schedule',
        detail: `시간나누기: ${slot.timeText} ${slot.durationMin}분 → ${slot.timeText} ${firstDur}분 + ${newTimeText} ${secondDur}분`,
      })
    },

    // 슬롯 시간 삭제: slotId 슬롯 제거 → 앞 슬롯이 그 시간을 흡수
    async deleteSlotTime(slotId) {
      const { startDate, poolType, pgmSlots, customSlots, scheduleBlocks, splitSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
      const versionPath = getCurrentVersionPath(getState, weekKey)
      const effective = getEffectivePgmSlots(pgmSlots, customSlots)
      const slot = effective.find(s => s.slotId === slotId)
      if (!slot) return

      const dateSlots = effective.filter(s => s.dateKey === slot.dateKey)
        .sort((a, b) => timeToMin(a.timeText) - timeToMin(b.timeText))
      const idx = dateSlots.findIndex(s => s.slotId === slotId)
      if (idx <= 0) return // 첫 슬롯은 삭제 불가

      const prev   = dateSlots[idx - 1]
      const newDur = prev.durationMin + slot.durationMin
      const newWm  = prev.weightedMin + slot.weightedMin

      const prevOv = customSlots[prev.slotId] || {}
      const prevEntry = prevOv.isCustom
        ? { ...prevOv, durationMin: newDur, weightedMin: newWm }
        : { durationMin: newDur, weightedMin: newWm }

      const fbPatch = {
        [`customSlots/${slotId}`]: slot.isCustom ? null : { deleted: true },
        [`customSlots/${prev.slotId}`]: prevEntry,
        [`scheduleBlocks/${slotId}`]: null,
      }
      if (splitSlots[slotId]) {
        fbPatch[`scheduleBlocks/${slotId}_CA`] = null
        fbPatch[`scheduleBlocks/${slotId}_IP`] = null
        fbPatch[`splitSlots/${slotId}`] = null
      }
      const prevBlock = scheduleBlocks[prev.slotId]
      if (prevBlock) fbPatch[`scheduleBlocks/${prev.slotId}`] = { ...prevBlock, durationMin: newDur, weightedMin: newWm }
      if (splitSlots[prev.slotId]) {
        const { caWeighted, ipWeighted } = splitWeightedMin(newWm, prev.dateKey, prev.timeText)
        const ca = scheduleBlocks[`${prev.slotId}_CA`]
        const ip = scheduleBlocks[`${prev.slotId}_IP`]
        if (ca) fbPatch[`scheduleBlocks/${prev.slotId}_CA`] = { ...ca, durationMin: newDur, weightedMin: caWeighted }
        if (ip) fbPatch[`scheduleBlocks/${prev.slotId}_IP`] = { ...ip, durationMin: newDur, weightedMin: ipWeighted }
      }
      recordVersionPatchUndo(getState, versionPath, '시간 삭제 되돌리기', fbPatch)
      await update(ref(db, versionPath), fbPatch)
      getState()._writeLog('시간삭제', slotId, slot, null, {
        scope: 'schedule',
        detail: `시간삭제: ${slot.timeText} 슬롯 삭제, 이전 슬롯 ${prev.timeText}에 합산`,
      })
    },
  }
}

function recordVersionPatchUndo(getState, versionPath, label, updates) {
  Object.entries(updates || {}).forEach(([relativePath, after]) => {
    getState().recordUndoChange(label, {
      path: `${versionPath}/${relativePath}`,
      before: readStatePath(getState(), relativePath),
      after,
      description: relativePath,
    })
  })
}

function readStatePath(state, relativePath) {
  const [root, ...parts] = relativePath.split('/')
  let value = state[root]
  for (const part of parts) {
    if (value == null) return null
    value = value[part]
  }
  return value === undefined ? null : value
}
