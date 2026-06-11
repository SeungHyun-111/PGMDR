/**
 * Weather display helpers
 *
 * Work scope
 * - Convert Firebase weather daily rows into compact header display models.
 * - Rendering target is the schedule date header in ScheduleGrid.jsx.
 * - Left weather badge: emoji line + min/max temperature line.
 * - Right detail badge: humidity and precipitation in the circled date-body header area, not inside the time-axis cell.
 *
 * Layout decision
 * - Left side, time-axis blank cell:
 *   line 1: weather emoji flow, e.g. sun->rain
 *   line 2: min/max temperature, e.g. 19/30
 * - Right side, date-body header area:
 *   line 1: humidity, e.g. 54%
 *   line 2: precipitation, e.g. 8mm
 * - If humidity/precipitation are missing because the row is from mid-term forecast,
 *   show nothing on the right side. Do not fall back to precipitation probability.
 *
 * Q&A
 * Q. Why not put detail next to the left weather badge?
 * A. It overflows in narrow date columns. The detail belongs in the right side of the date-body header area.
 *
 * Q. Why use "->" instead of slash?
 * A. Slash is already used for min/max temperature. Arrow makes AM to PM flow clearer.
 *
 * Q. Why can humidity and precipitation be missing?
 * A. Short-term forecast has humidity and precipitation amount. Mid-term forecast generally does not,
 *    so mid-term rows use precipitation probability as fallback.
 */

export const DEFAULT_WEATHER_LOCATION_KEY = 'seoul_58_126_11B00000_11B10101'

export function buildWeatherBadgeModel(weatherRow) {
  if (!weatherRow) return null

  const emojiText = buildEmojiText(weatherRow.amEmoji, weatherRow.pmEmoji)
  const tempText = buildTempText(weatherRow.minTemp, weatherRow.maxTemp)
  if (!emojiText && !tempText) return null

  const detailLines = buildDetailLines(weatherRow)
  const title = buildTitle(weatherRow, detailLines)

  return {
    emojiText,
    tempText,
    detailLines,
    detailText: detailLines.join(' / '),
    title,
    source: weatherRow.source || '',
  }
}

export function buildWeatherByDate(rawDaily = {}) {
  return Object.fromEntries(
    Object.entries(rawDaily || {})
      .map(([dateKey, row]) => [dateKey, buildWeatherBadgeModel(row)])
      .filter(([, model]) => !!model)
  )
}

function buildEmojiText(amEmoji, pmEmoji) {
  const am = String(amEmoji || '').trim()
  const pm = String(pmEmoji || '').trim()
  if (am && pm && am !== pm) return `${am}->${pm}`
  return am || pm || ''
}

function buildTempText(minTemp, maxTemp) {
  const min = normalizeNumberText(minTemp)
  const max = normalizeNumberText(maxTemp)
  if (min && max) return `${min}/${max}°`
  if (min) return `${min}°`
  if (max) return `${max}°`
  return ''
}

function buildDetailLines(row) {
  const humidityText = normalizeNumberText(row.humidity)
  const precipitationText = normalizeNumberText(row.precipitation)
  const lines = []

  if (humidityText) lines.push(`${humidityText}%`)
  if (precipitationText) lines.push(`${precipitationText}mm`)
  return lines.slice(0, 2)
}

function buildTitle(row, detailLines) {
  const am = row.amWeather ? `AM ${row.amWeather}` : ''
  const pm = row.pmWeather ? `PM ${row.pmWeather}` : ''
  const temp = buildTempText(row.minTemp, row.maxTemp)
  const detail = detailLines.join(' / ')
  const source = row.source === 'short' ? 'short-term forecast' : row.source === 'mid' ? 'mid-term forecast' : ''

  return [am && pm ? `${am} / ${pm}` : am || pm, temp && `min/max ${temp}`, detail, source]
    .filter(Boolean)
    .join('\n')
}

function normalizeNumberText(value) {
  if (value === undefined || value === null || value === '') return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value).trim()
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10)
}
