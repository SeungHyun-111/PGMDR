import { db, ref, get, update, push } from './firebase'

/**
 * Weather Firebase sync module
 *
 * 작업 개요
 * - GAS를 거치지 않고 브라우저에서 기상청 API를 직접 호출한다.
 * - 결과는 특정 주차/session 아래가 아니라 Firebase 전역 경로에 누적 저장한다.
 * - 최신 스냅샷은 빠르게 읽을 수 있도록 latest에 저장하고, 실행 이력은 runs에 append한다.
 * - 8시간 TTL을 기준으로, 최근 갱신분이 있으면 API를 다시 호출하지 않는다.
 * - 이번 작업 범위는 Firebase DB push까지만이다. 프론트 렌더링/스케줄 화면 연결은 하지 않는다.
 *
 * Firebase 구조
 * globalWeather/kma/{locationKey}/latest
 * globalWeather/kma/{locationKey}/daily/{YYYY-MM-DD}
 * globalWeather/kma/{locationKey}/runs/{firebasePushKey}
 *
 * 저장 항목
 * - latest.provider: 데이터 제공처. 현재는 "KMA".
 * - latest.location: locationKey, 표시명, 단기 nx/ny, 중기 regId 정보.
 * - latest.base.shortTerm: 단기예보 호출에 사용한 base_date/base_time.
 * - latest.base.midTerm: 중기예보 호출에 사용한 tmFc.
 * - latest.rows: 날짜별 예보 배열.
 * - latest.updatedAt / updatedAtText: Firebase에 저장한 시각.
 * - latest.runId: 이번 갱신 이력의 push key.
 * - daily/{dateKey}: 날짜별 row를 바로 조회하기 위한 최신값.
 * - runs/{runId}: 갱신 이력 메타. 전체 row를 중복 저장하지 않고 base, rowCount, dateKeys만 저장.
 *
 * 날짜별 row 항목
 * - dateKey: YYYY-MM-DD
 * - weekday: 요일
 * - source: "short" 또는 "mid". 단기예보가 있으면 short가 중기값을 덮는다.
 * - minTemp / maxTemp: 최저/최고기온
 * - amWeather / pmWeather: 오전/오후 날씨 텍스트
 * - amPop / pmPop: 오전/오후 강수확률
 * - amEmoji / pmEmoji: 오전/오후 날씨 아이콘
 * - humidity: 단기예보에서 계산한 습도. 중기에는 없음.
 * - precipitation: 단기예보에서 계산한 강수량. 중기에는 없음.
 *
 * 단기/중기 호출 관리
 * - 단기예보(getVilageFcst)
 *   - DEFAULT_WEATHER_LOCATION.shortTerm의 nx/ny를 사용한다.
 *   - getVilageBaseDateTime()이 현재 KST 기준으로 가장 최근 발표 회차를 고른다.
 *   - 발표 회차는 02/05/08/11/14/17/20/23시이고, 발표 직후 지연을 감안해 +10분 이후부터 사용한다.
 *   - 응답을 fcstDate 기준으로 묶고, 06~11시는 오전, 12~18시는 오후 블록으로 요약한다.
 * - 중기예보(getMidLandFcst, getMidTa)
 *   - DEFAULT_WEATHER_LOCATION.midTerm의 landRegId/taRegId를 사용한다.
 *   - getMidTmFc()가 현재 KST 기준으로 06시/18시 중 가장 최근 회차를 고른다.
 *   - +3일~+10일 범위를 만든다.
 *   - +3일~+7일은 오전/오후 값을 따로 사용하고, +8일~+10일은 일 단위 값을 오전/오후에 복제한다.
 * - 병합 순서
 *   - 먼저 중기 rowMap을 만든다.
 *   - 이후 단기 row를 병합한다.
 *   - 같은 날짜가 겹치면 단기예보가 우선이며, 단기 최저/최고기온이 비어 있으면 기존 중기값을 보존한다.
 *
 * 8시간 갱신/덮어쓰기 로직
 * - App.jsx가 앱 진입 시 refreshKmaWeatherIfStale()을 1회 호출한다.
 * - refreshKmaWeatherIfStale()은 먼저 globalWeather/kma/{locationKey}/latest.updatedAt을 읽는다.
 * - latest.updatedAt이 있고 현재 시각과의 차이가 WEATHER_TTL_MS(8시간)보다 작으면 API를 호출하지 않고 skipped=true를 반환한다.
 * - 8시간 이상 지났거나 latest가 없으면 기상청 API를 새로 호출한다.
 * - 새 결과는 update(ref(db), updates)로 한 번에 저장한다.
 * - latest는 항상 새 결과로 통째로 덮어쓴다.
 * - daily/{YYYY-MM-DD}도 해당 날짜별 최신 row로 덮어쓴다.
 * - runs/{pushKey}는 매 갱신마다 새 이력으로 누적한다.
 * - React 개발 모드에서 StrictMode로 effect가 두 번 실행될 수 있어 refreshInFlight로 동시 중복 호출을 막는다.
 *
 * Q&A
 * Q. API 키가 프론트에 노출되어도 되나?
 * A. 현재 요구사항상 노출 허용이다. 그래서 VITE_KMA_SERVICE_KEY가 있으면 우선 사용하고,
 *    없으면 아래 DEFAULT_KMA_SERVICE_KEY를 사용한다.
 *
 * Q. "8시간마다 갱신"은 정확한 백그라운드 스케줄인가?
 * A. 프론트 직접 호출 방식에서는 앱이 실행될 때 stale 여부를 보고 갱신한다.
 *    사용자가 아무도 앱을 열지 않는 동안에는 브라우저 코드가 실행되지 않는다.
 *
 * Q. 왜 전역 DB인가?
 * A. 날씨는 주차별 편성 데이터가 아니라 날짜/지역 기준 외부 데이터라서
 *    sessions/{weekKey} 아래에 복제하지 않고 globalWeather 아래에 누적한다.
 *
 * Q. CORS 문제가 생기면?
 * A. 이 파일의 fetch 단계에서 실패한다. 그 경우에도 UI 코드는 아직 연결하지 않았으므로
 *    호출부에서 에러를 확인한 뒤 Vite proxy나 Firebase Functions 프록시로 바꾸면 된다.
 *
 * 확인 필요
 * - 실제 서비스 지역이 서울/경기 좌표(nx=58, ny=126)와 중기 코드(11B00000, 11B10101)가 맞는지.
 * - +3일 겹침 구간에서 단기예보 우선 정책을 계속 사용할지.
 * - daily 데이터를 날짜별 overwrite할지, 과거 예보 변경 이력까지 날짜 아래에 누적할지.
 */

const DEFAULT_KMA_SERVICE_KEY =
  'ngx/BFtjRyWWjj+yPeRTo2TrinX/wrFwkYpu1ROLrnac5ZLI+ckoMTL1wptN0WfsHSUTLmOgwz1UiLEHd8FVAw=='

const KMA_SERVICE_KEY = import.meta.env.VITE_KMA_SERVICE_KEY || DEFAULT_KMA_SERVICE_KEY

const WEATHER_TTL_MS = 8 * 60 * 60 * 1000

let refreshInFlight = null

export const DEFAULT_WEATHER_LOCATION = {
  locationKey: 'seoul_58_126_11B00000_11B10101',
  label: '서울/경기',
  shortTerm: { nx: 58, ny: 126 },
  midTerm: {
    landRegId: '11B00000',
    taRegId: '11B10101',
  },
}

const KMA_URL = {
  vilage: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  midLand: 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst',
  midTa: 'https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa',
}

const SKY_TEXT = {
  1: { text: '맑음', emoji: '☀️' },
  3: { text: '구름많음', emoji: '☁️' },
  4: { text: '흐림', emoji: '☁️' },
}

const PTY_TEXT = {
  1: { text: '비', emoji: '🌧️' },
  2: { text: '비/눈', emoji: '🌨️' },
  3: { text: '눈', emoji: '❄️' },
  4: { text: '소나기', emoji: '🌦️' },
}

const MID_WF_EMOJI = [
  { match: ['소나기'], emoji: '🌦️' },
  { match: ['비'], emoji: '🌧️' },
  { match: ['눈'], emoji: '❄️' },
  { match: ['흐림'], emoji: '☁️' },
  { match: ['구름많음'], emoji: '☁️' },
  { match: ['맑음'], emoji: '☀️' },
]

export async function refreshKmaWeatherIfStale(options = {}) {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshKmaWeatherIfStaleInternal(options).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function refreshKmaWeatherIfStaleInternal(options = {}) {
  const location = normalizeLocation(options.location)
  const ttlMs = Number(options.ttlMs || WEATHER_TTL_MS)
  const latestSnap = await get(ref(db, getLatestPath(location.locationKey)))
  const latest = latestSnap.exists() ? latestSnap.val() : null

  if (latest?.updatedAt && Date.now() - Number(latest.updatedAt) < ttlMs) {
    return {
      skipped: true,
      reason: 'fresh-cache',
      locationKey: location.locationKey,
      latest,
    }
  }

  return refreshKmaWeatherToFirebase({ location })
}

export async function refreshKmaWeatherToFirebase(options = {}) {
  const location = normalizeLocation(options.location)
  const fetchedAt = Date.now()
  const forecast = await fetchKmaForecast(location)
  const runRef = push(ref(db, getRunsPath(location.locationKey)))
  const runId = runRef.key
  const dailySnap = await get(ref(db, getDailyPath(location.locationKey)))
  const existingDaily = dailySnap.exists() ? dailySnap.val() : {}
  const rows = forecast.rows.map(row => mergeWithExistingDailyRow(row, existingDaily[row.dateKey]))

  const latest = {
    ...forecast,
    rows,
    location,
    runId,
    updatedAt: fetchedAt,
    updatedAtText: formatKst(new Date(fetchedAt), 'yyyy-MM-dd HH:mm:ss'),
  }

  const updates = {
    [getLatestPath(location.locationKey)]: latest,
    [getRunPath(location.locationKey, runId)]: {
      runId,
      updatedAt: latest.updatedAt,
      updatedAtText: latest.updatedAtText,
      base: forecast.base,
      rowCount: rows.length,
      dateKeys: rows.map(row => row.dateKey),
    },
  }

  rows.forEach(row => {
    updates[`${getDailyPath(location.locationKey)}/${row.dateKey}`] = {
      ...row,
      locationKey: location.locationKey,
      runId,
      updatedAt: latest.updatedAt,
      updatedAtText: latest.updatedAtText,
    }
  })

  await update(ref(db), updates)
  return { skipped: false, locationKey: location.locationKey, runId, latest }
}

export async function fetchKmaForecast(location = DEFAULT_WEATHER_LOCATION) {
  const now = new Date()
  const [shortByDate, midLand, midTa] = await Promise.all([
    fetchShortTermForecast(location, now),
    fetchMidLandForecast(location, now),
    fetchMidTemperatureForecast(location, now),
  ])

  const rowMap = {}
  mergeMidRows(rowMap, midLand, midTa, now)
  mergeShortRows(rowMap, shortByDate)

  const rows = Object.keys(rowMap)
    .sort()
    .map(dateKey => rowMap[dateKey])

  return {
    provider: 'KMA',
    base: {
      shortTerm: getVilageBaseDateTime(now),
      midTerm: getMidTmFc(now),
    },
    rows,
  }
}

async function fetchShortTermForecast(location, now) {
  const base = getVilageBaseDateTime(now)
  const items = await callKmaApi(KMA_URL.vilage, {
    pageNo: 1,
    numOfRows: 1000,
    dataType: 'JSON',
    base_date: base.date,
    base_time: base.time,
    nx: location.shortTerm.nx,
    ny: location.shortTerm.ny,
  })

  const byDate = {}
  items.forEach(item => {
    const date = item.fcstDate
    const time = item.fcstTime
    const category = item.category
    const value = item.fcstValue

    if (!byDate[date]) byDate[date] = { times: {}, TMN: '', TMX: '' }
    if (category === 'TMN') byDate[date].TMN = value
    else if (category === 'TMX') byDate[date].TMX = value
    else {
      if (!byDate[date].times[time]) byDate[date].times[time] = {}
      byDate[date].times[time][category] = value
    }
  })
  return byDate
}

async function fetchMidLandForecast(location, now) {
  const items = await callKmaApi(KMA_URL.midLand, {
    pageNo: 1,
    numOfRows: 10,
    dataType: 'JSON',
    regId: location.midTerm.landRegId,
    tmFc: getMidTmFc(now),
  })
  return items[0] || {}
}

async function fetchMidTemperatureForecast(location, now) {
  const items = await callKmaApi(KMA_URL.midTa, {
    pageNo: 1,
    numOfRows: 10,
    dataType: 'JSON',
    regId: location.midTerm.taRegId,
    tmFc: getMidTmFc(now),
  })
  return items[0] || {}
}

async function callKmaApi(url, params) {
  if (!KMA_SERVICE_KEY) throw new Error('KMA service key is missing')
  const qs = new URLSearchParams({ serviceKey: KMA_SERVICE_KEY, ...params })
  const res = await fetch(`${url}?${qs.toString()}`)
  const text = await res.text()

  if (!res.ok) throw new Error(`KMA HTTP ${res.status}: ${text.slice(0, 300)}`)

  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`KMA JSON parse failed: ${text.slice(0, 300)}`)
  }

  const header = json?.response?.header
  if (!header || header.resultCode !== '00') {
    throw new Error(`KMA API failed: ${header?.resultMsg || text.slice(0, 300)}`)
  }

  const item = json?.response?.body?.items?.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

function mergeMidRows(rowMap, land, ta, today) {
  for (let offset = 3; offset <= 10; offset += 1) {
    const dateKey = addDaysKey(today, offset)
    const hasHalfDay = offset <= 7
    const wfAm = hasHalfDay ? land[`wf${offset}Am`] : land[`wf${offset}`]
    const wfPm = hasHalfDay ? land[`wf${offset}Pm`] : land[`wf${offset}`]
    const popAm = hasHalfDay ? land[`rnSt${offset}Am`] : land[`rnSt${offset}`]
    const popPm = hasHalfDay ? land[`rnSt${offset}Pm`] : land[`rnSt${offset}`]

    rowMap[dateKey] = {
      dateKey,
      weekday: weekday(dateKey),
      source: 'mid',
      minTemp: valueOr(ta[`taMin${offset}`]),
      maxTemp: valueOr(ta[`taMax${offset}`]),
      amWeather: valueOr(wfAm, '-'),
      pmWeather: valueOr(wfPm, '-'),
      amPop: valueOr(popAm),
      pmPop: valueOr(popPm),
      amEmoji: midWfToEmoji(wfAm),
      pmEmoji: midWfToEmoji(wfPm),
      humidity: '',
      precipitation: '',
    }
  }
}

function mergeShortRows(rowMap, byDate) {
  Object.keys(byDate).forEach(ymd => {
    const dateKey = ymdToDateKey(ymd)
    const day = byDate[ymd]
    const am = summarizeBlock(day.times, 600, 1100)
    const pm = summarizeBlock(day.times, 1200, 1800)
    const hasShortWeather = am.weather !== '-' || pm.weather !== '-'

    if (!hasShortWeather) return

    const prev = rowMap[dateKey] || {}
    rowMap[dateKey] = {
      dateKey,
      weekday: weekday(dateKey),
      source: 'short',
      minTemp: valueOr(day.TMN, valueOr(prev.minTemp)),
      maxTemp: valueOr(day.TMX, valueOr(prev.maxTemp)),
      amWeather: am.weather,
      pmWeather: pm.weather,
      amPop: am.pop,
      pmPop: pm.pop,
      amEmoji: am.emoji,
      pmEmoji: pm.emoji,
      humidity: pm.humidity !== '' ? pm.humidity : am.humidity,
      precipitation: pm.precipitation !== '' ? pm.precipitation : am.precipitation,
    }
  })
}

function summarizeBlock(times, fromHHMM, toHHMM) {
  const keys = Object.keys(times || {})
    .filter(time => {
      const n = Number(time)
      return n >= fromHHMM && n <= toHHMM
    })
    .sort()

  if (!keys.length) {
    return { weather: '-', emoji: '', pop: '', humidity: '', precipitation: '' }
  }

  const mid = keys[Math.floor(keys.length / 2)]
  const weather = skyPtyToWeather(times[mid]?.SKY, times[mid]?.PTY)
  const pop = keys.reduce((max, time) => Math.max(max, Number(times[time]?.POP || 0)), 0)

  let humiditySum = 0
  let humidityCount = 0
  let precipitation = 0
  let hasPrecipitation = false

  keys.forEach(time => {
    const row = times[time] || {}
    if (row.REH != null && row.REH !== '') {
      humiditySum += Number(row.REH)
      humidityCount += 1
    }
    const pcp = parsePrecipitation(row.PCP)
    if (pcp > 0) {
      precipitation += pcp
      hasPrecipitation = true
    }
  })

  return {
    weather: weather.text,
    emoji: weather.emoji,
    pop,
    humidity: humidityCount ? Math.round(humiditySum / humidityCount) : '',
    precipitation: hasPrecipitation ? Math.round(precipitation * 10) / 10 : 0,
  }
}

function skyPtyToWeather(sky, pty) {
  const precipitation = PTY_TEXT[String(pty)]
  if (precipitation) return precipitation
  return SKY_TEXT[String(sky)] || { text: '-', emoji: '' }
}

function midWfToEmoji(wf) {
  if (!wf) return ''
  const text = String(wf)
  return MID_WF_EMOJI.find(rule => rule.match.some(keyword => text.includes(keyword)))?.emoji || ''
}

function parsePrecipitation(value) {
  if (value == null || value === '' || value === '강수없음') return 0
  const text = String(value)
  if (text.includes('미만')) return 0.5
  const match = text.match(/[\d.]+/)
  return match ? Number(match[0]) : 0
}

function getVilageBaseDateTime(now) {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23]
  const kst = getKstParts(now)
  let baseDate = new Date(kst.year, kst.month - 1, kst.day, 12)
  let picked = null

  for (let i = slots.length - 1; i >= 0; i -= 1) {
    if (kst.hour > slots[i] || (kst.hour === slots[i] && kst.minute >= 10)) {
      picked = slots[i]
      break
    }
  }

  if (picked === null) {
    baseDate.setDate(baseDate.getDate() - 1)
    picked = 23
  }

  return {
    date: formatKst(baseDate, 'yyyyMMdd'),
    time: `${String(picked).padStart(2, '0')}00`,
  }
}

function getMidTmFc(now) {
  const kst = getKstParts(now)
  const baseDate = new Date(kst.year, kst.month - 1, kst.day, 12)
  let slot = 18

  if (kst.hour >= 18) slot = 18
  else if (kst.hour >= 6) slot = 6
  else baseDate.setDate(baseDate.getDate() - 1)

  return `${formatKst(baseDate, 'yyyyMMdd')}${String(slot).padStart(2, '0')}00`
}

function normalizeLocation(location) {
  return {
    ...DEFAULT_WEATHER_LOCATION,
    ...(location || {}),
    shortTerm: {
      ...DEFAULT_WEATHER_LOCATION.shortTerm,
      ...((location || {}).shortTerm || {}),
    },
    midTerm: {
      ...DEFAULT_WEATHER_LOCATION.midTerm,
      ...((location || {}).midTerm || {}),
    },
  }
}

function getLatestPath(locationKey) {
  return `globalWeather/kma/${locationKey}/latest`
}

function getDailyPath(locationKey) {
  return `globalWeather/kma/${locationKey}/daily`
}

function getRunsPath(locationKey) {
  return `globalWeather/kma/${locationKey}/runs`
}

function getRunPath(locationKey, runId) {
  return `${getRunsPath(locationKey)}/${runId}`
}

function valueOr(value, fallback = '') {
  return value === undefined || value === null || value === '' ? fallback : value
}

function mergeWithExistingDailyRow(row, existing) {
  if (!existing) return row
  return {
    ...row,
    minTemp: valueOr(row.minTemp, existing.minTemp),
    maxTemp: valueOr(row.maxTemp, existing.maxTemp),
  }
}

function ymdToDateKey(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

function addDaysKey(today, days) {
  const kst = getKstParts(today)
  const date = new Date(kst.year, kst.month - 1, kst.day, 12)
  date.setDate(date.getDate() + days)
  return formatKst(date, 'yyyy-MM-dd')
}

function weekday(dateKey) {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(`${dateKey}T12:00:00+09:00`).getDay()]
}

function getKstParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)

  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  }
}

function formatKst(date, pattern) {
  const parts = getKstParts(date)
  const yyyy = String(parts.year)
  const MM = String(parts.month).padStart(2, '0')
  const dd = String(parts.day).padStart(2, '0')
  const HH = String(parts.hour).padStart(2, '0')
  const mm = String(parts.minute).padStart(2, '0')

  if (pattern === 'yyyyMMdd') return `${yyyy}${MM}${dd}`
  if (pattern === 'yyyy-MM-dd') return `${yyyy}-${MM}-${dd}`
  if (pattern === 'yyyy-MM-dd HH:mm:ss') return `${yyyy}-${MM}-${dd} ${HH}:${mm}:00`
  return `${yyyy}-${MM}-${dd}`
}
