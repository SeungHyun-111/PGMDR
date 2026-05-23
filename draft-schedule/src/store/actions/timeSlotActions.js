import { db, ref, set } from '../../api/firebase'
import { timeToMin, minToTime } from '../../utils/weightedMin'
import { splitWeightedMin } from '../../utils/weightedMin'
import { getEffectivePgmSlots } from '../../utils/effectiveSlots'

export function createTimeSlotActions(setState, getState) {
  return {
    // 슬롯 시간 분할: slotId 슬롯을 newTimeText 기준으로 앞/뒤로 나눔
    async splitSlotTime(slotId, newTimeText) {
      const { startDate, poolType, pgmSlots, customSlots, scheduleBlocks, splitSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
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

      const customSlotId = `custom_${slotId}_${Date.now()}`

      // 원본(또는 기존 커스텀) 슬롯 duration 단축
      const prevOv = customSlots[slotId] || {}
      const slotEntry = prevOv.isCustom
        ? { ...prevOv, durationMin: firstDur, weightedMin: firstWm }  // 커스텀 슬롯: 기존 필드 유지
        : { durationMin: firstDur, weightedMin: firstWm }              // 원본 슬롯: override만 저장
      await set(ref(db, `sessions/${weekKey}/customSlots/${slotId}`), slotEntry)

      // 새 커스텀 슬롯 생성
      await set(ref(db, `sessions/${weekKey}/customSlots/${customSlotId}`), {
        slotId: customSlotId,
        dateKey: slot.dateKey,
        timeText: newTimeText,
        durationMin: secondDur,
        weightedMin: secondWm,
        channel: 'ALL',
        isCustom: true,
        parentSlotId: slotId,
      })

      // 기존 블록 durationMin/weightedMin 업데이트
      const block = scheduleBlocks[slotId]
      if (block) {
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}`), { ...block, durationMin: firstDur, weightedMin: firstWm })
      }
      if (splitSlots[slotId]) {
        const { caWeighted, ipWeighted } = splitWeightedMin(firstWm, slot.dateKey, slot.timeText)
        const caBlock = scheduleBlocks[`${slotId}_CA`]
        const ipBlock = scheduleBlocks[`${slotId}_IP`]
        if (caBlock) await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}_CA`), { ...caBlock, durationMin: firstDur, weightedMin: caWeighted })
        if (ipBlock) await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}_IP`), { ...ipBlock, durationMin: firstDur, weightedMin: ipWeighted })
      }
    },

    // 슬롯 시간 삭제: slotId 슬롯 제거 → 앞 슬롯이 그 시간을 흡수
    async deleteSlotTime(slotId) {
      const { startDate, poolType, pgmSlots, customSlots, scheduleBlocks, splitSlots } = getState()
      const weekKey = `${startDate}_${poolType}`
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

      // 삭제 슬롯 처리
      if (slot.isCustom) {
        await set(ref(db, `sessions/${weekKey}/customSlots/${slotId}`), null)
      } else {
        await set(ref(db, `sessions/${weekKey}/customSlots/${slotId}`), { deleted: true })
      }

      // 앞 슬롯 duration 확장
      const prevOv = customSlots[prev.slotId] || {}
      const prevEntry = prevOv.isCustom
        ? { ...prevOv, durationMin: newDur, weightedMin: newWm }
        : { durationMin: newDur, weightedMin: newWm }
      await set(ref(db, `sessions/${weekKey}/customSlots/${prev.slotId}`), prevEntry)

      // 삭제 슬롯 블록 제거
      await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}`), null)
      if (splitSlots[slotId]) {
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}_CA`), null)
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${slotId}_IP`), null)
        await set(ref(db, `sessions/${weekKey}/splitSlots/${slotId}`), null)
      }

      // 앞 슬롯 블록 duration 업데이트
      const prevBlock = scheduleBlocks[prev.slotId]
      if (prevBlock) {
        await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${prev.slotId}`), { ...prevBlock, durationMin: newDur, weightedMin: newWm })
      }
      if (splitSlots[prev.slotId]) {
        const { caWeighted, ipWeighted } = splitWeightedMin(newWm, prev.dateKey, prev.timeText)
        const ca = scheduleBlocks[`${prev.slotId}_CA`]
        const ip = scheduleBlocks[`${prev.slotId}_IP`]
        if (ca) await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${prev.slotId}_CA`), { ...ca, durationMin: newDur, weightedMin: caWeighted })
        if (ip) await set(ref(db, `sessions/${weekKey}/scheduleBlocks/${prev.slotId}_IP`), { ...ip, durationMin: newDur, weightedMin: ipWeighted })
      }
    },
  }
}
