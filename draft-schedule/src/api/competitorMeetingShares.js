import dayjs from 'dayjs'
import { fetchScheduleWeek } from './competitorSchedule.js'

export function createWeeklyShareAccumulator(week) {
  const current = { total: 0, organizations: {} }
  const previous = { total: 0, organizations: {} }
  const accept = row => {
    const value = Number(row.weightedMin)
    if (!Number.isFinite(value) || value < 0) return
    const period = row.date >= week ? current : previous
    const organization = String(row.org || '').trim() || '조직 미등록'
    period.total += value
    period.organizations[organization] = (period.organizations[organization] || 0) + value
  }
  return { current, previous, accept }
}

export function getWeeklyOrganizationShare(summary, organization) {
  const current = summary.current.total > 0 ? (summary.current.organizations[organization] || 0) / summary.current.total * 100 : null
  const previous = summary.previous.total > 0 ? (summary.previous.organizations[organization] || 0) / summary.previous.total * 100 : null
  return { current, difference: current !== null && previous !== null ? current - previous : null }
}

export async function fetchMeetingShares(company, week, signal, currentSource) {
  const dates = Array.from({ length: 14 }, (_, i) => dayjs(week).add(i - 7, 'day').format('YYYY-MM-DD'))
  const summary = createWeeklyShareAccumulator(week)
  const reuseCurrent = currentSource?.company === company && Array.isArray(currentSource.rows)
  if (reuseCurrent) {
    for (const row of currentSource.rows) if (row.date >= week && row.date <= dates.at(-1)) summary.accept(row)
  }
  await fetchScheduleWeek(company, reuseCurrent ? dates.slice(0, 7) : dates, signal, summary.accept)
  return { current: summary.current, previous: summary.previous }
}
