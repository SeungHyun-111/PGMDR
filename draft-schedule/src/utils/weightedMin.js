// CA 비중 테이블 (시간대별 요일별)
// 행: 시간(0~23), 열: 요일(0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일)
const CA_RATIO_TABLE = [
  [30, 30, 30, 30, 30, 30, 30], // 00시
  [40, 40, 40, 40, 40, 40, 40], // 01시
  [40, 40, 40, 40, 40, 40, 40], // 02시
  [40, 40, 40, 40, 40, 40, 40], // 03시
  [40, 40, 40, 40, 40, 40, 40], // 04시
  [25, 25, 25, 25, 25, 25, 25], // 05시
  [25, 25, 25, 25, 25, 25, 25], // 06시
  [25, 25, 25, 25, 25, 25, 25], // 07시
  [25, 25, 25, 25, 25, 25, 25], // 08시
  [25, 25, 25, 25, 25, 25, 25], // 09시
  [25, 25, 25, 25, 25, 25, 25], // 10시
  [25, 25, 25, 25, 25, 25, 25], // 11시
  [25, 25, 25, 25, 25, 25, 25], // 12시
  [25, 25, 25, 25, 25, 25, 25], // 13시
  [25, 25, 25, 25, 25, 25, 25], // 14시
  [25, 25, 25, 25, 25, 25, 25], // 15시
  [25, 25, 25, 25, 25, 25, 25], // 16시
  [25, 25, 25, 25, 25, 25, 25], // 17시
  [25, 25, 25, 25, 25, 25, 25], // 18시
  [25, 25, 25, 25, 25, 20, 20], // 19시
  [20, 20, 20, 20, 20, 20, 20], // 20시
  [20, 20, 20, 20, 20, 20, 20], // 21시
  [20, 20, 20, 20, 20, 20, 20], // 22시
  [20, 20, 20, 20, 20, 20, 20], // 23시
]

// 요일 인덱스 (dateKey 기준)
function getDayIndex(dateKey) {
  if (!dateKey) return 0
  const d = new Date(dateKey + 'T00:00:00')
  const day = d.getDay() // 0=일, 1=월 ... 6=토
  // 월=0, 화=1, 수=2, 목=3, 금=4, 토=5, 일=6
  return day === 0 ? 6 : day - 1
}

// 시간대 인덱스 (timeText 기준 - 슬롯 시작 시간)
function getHourIndex(timeText) {
  if (!timeText) return 0
  const h = parseInt(String(timeText).split(':')[0])
  return h % 24
}

// CA 비중 조회
export function getCaRatio(dateKey, timeText) {
  const dayIdx = getDayIndex(dateKey)
  const hourIdx = getHourIndex(timeText)
  return CA_RATIO_TABLE[hourIdx][dayIdx]
}

// 분리 시 가중분 계산
// caWeighted + ipWeighted = weightedMin
export function splitWeightedMin(weightedMin, dateKey, timeText) {
  const caRatio = getCaRatio(dateKey, timeText)
  const caWeighted = Math.round(weightedMin * caRatio / 100)
  const ipWeighted = weightedMin - caWeighted
  return { caWeighted, ipWeighted, caRatio, ipRatio: 100 - caRatio }
}

// 기존 함수 유지
export function calcWeightedMin(pgmSlots, startTime, endTime) {
  const startTotal = timeToMin(startTime)
  const endTotal = timeToMin(endTime)
  if (endTotal <= startTotal) return 0
  let total = 0
  for (const slot of pgmSlots) {
    const slotStart = timeToMin(slot.timeText)
    const slotEnd = slotStart + Number(slot.durationMin)
    const slotRate = slot.durationMin > 0 ? slot.weightedMin / slot.durationMin : 0
    const overlapStart = Math.max(startTotal, slotStart)
    const overlapEnd = Math.min(endTotal, slotEnd)
    const overlap = overlapEnd - overlapStart
    if (overlap > 0) total += overlap * slotRate
  }
  return Math.round(total * 100) / 100
}

export function timeToMin(timeText) {
  if (!timeText) return 0
  const [h, m] = String(timeText).split(':').map(Number)
  return h * 60 + m
}

export function minToTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}