const DEFAULT_SCHEDULE_PATH = 'schedules'
const DEFAULT_CULTURE_PATH = 'culturePreschedule'

export async function fetchPrePgmPreScheduleRows(startDate) {
  const databaseUrl = getPrePgmDatabaseUrl()
  const weekDates = getWeekDates(startDate)
  const monthIds = [...new Set(weekDates.map(date => date.slice(0, 7)))]
  const weekDateSet = new Set(weekDates)

  const sessions = await Promise.all(monthIds.map(monthId => readPrePgmMonth(databaseUrl, monthId)))
  return sessions
    .flatMap(session => normalizePrePgmSession(session, weekDateSet))
    .filter(row => row.broadcastDateTime)
}

function getPrePgmDatabaseUrl() {
  const url = String(import.meta.env.VITE_PREPGM_DATABASE_URL || '').replace(/\/+$/, '')
  if (!url) throw new Error('VITE_PREPGM_DATABASE_URL이 설정되지 않았습니다.')
  return url
}

async function readPrePgmMonth(databaseUrl, monthId) {
  const schedulePath = cleanPath(import.meta.env.VITE_PREPGM_SCHEDULE_PATH || DEFAULT_SCHEDULE_PATH)
  const culturePath = cleanPath(import.meta.env.VITE_PREPGM_CULTURE_PRESCHEDULE_PATH || DEFAULT_CULTURE_PATH)
  const [scheduleSession, cultureSession] = await Promise.all([
    readJson(`${databaseUrl}/${schedulePath}/sessions/${monthId}.json`),
    readJson(`${databaseUrl}/${culturePath}/sessions/${monthId}.json`),
  ])
  return { scheduleSession, cultureSession }
}

async function readJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`prePGM RTDB 조회 실패: ${res.status}`)
  return res.json()
}

function normalizePrePgmSession({ scheduleSession, cultureSession }, weekDateSet) {
  return [
    ...collectRows(scheduleSession?.rows),
    ...collectRows(scheduleSession?.mdRows),
    ...collectRows(scheduleSession?.legacyRows),
    ...collectRows(cultureSession?.rows),
  ]
    .filter(row => row?.isApplied === 'applied')
    .map(row => toPreScheduleRow(row))
    .filter(row => weekDateSet.has(row.broadcastDateTime.slice(0, 10)))
}

function collectRows(rows) {
  if (Array.isArray(rows)) return rows.filter(Boolean)
  return Object.values(rows || {}).filter(Boolean)
}

function toPreScheduleRow(row) {
  const pgmCodeName = String(row.scheduleCodeName || '').trim()
  const dealType = String(row.dealType || '').trim()
  const dealTypeChar = extractDealTypeChar(dealType)
  const broadcastDateTime = normalizeBroadcastDateTime(row)
  const teamName = String(row.teamName || '').trim()

  return {
    pgmCodeName,
    broadcastDateTime,
    orgName: teamName,
    mdTeam: teamName,
    mdCategory: String(row.mdCategory || '').trim(),
    dealType,
    dealTypeChar,
  }
}

function normalizeBroadcastDateTime(row) {
  const direct = formatDateTime(row.scheduledDateTime || row.normalizedStartDateTime)
  if (direct) return direct

  const date = String(row.date || row.requestDate || '').trim()
  const time = normalizeTime(row.requestTimeSlot)
  return date && time ? `${date} ${time}` : ''
}

function formatDateTime(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${match[1]} ${Number(match[2])}:${match[3]}`
}

function normalizeTime(value) {
  const match = String(value || '').trim().match(/(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return ''
  return `${Number(match[1])}:${String(match[2] || '00').padStart(2, '0')}`
}

function extractDealTypeChar(dealType) {
  return String(dealType || '').match(/^\[(.)\]/)?.[1] || ''
}

function getWeekDates(startDate) {
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) throw new Error('startDate 형식이 올바르지 않습니다.')

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return formatDate(d)
  })
}

function formatDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function cleanPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '')
}
