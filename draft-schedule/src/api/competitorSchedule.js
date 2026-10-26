import { readCompetitorJson } from './competitorRequestQueue.js'
import { competitorDiskCache } from './competitorDiskCache.js'
import { createCompetitorRepository } from './competitorRepository.js'

const BASE = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app/competitorInfo/monthly'
const repository = createCompetitorRepository({ readJson: readCompetitorJson, cache: competitorDiskCache })

export async function fetchScheduleMonths(signal) {
  return Object.keys(await readCompetitorJson(`${BASE}.json?shallow=true`, signal) || {}).sort()
}

export async function fetchScheduleWeek(company, dates, signal, onRow) {
  const rows = await repository.load(company, dates, signal)
  if (onRow) { for (const row of rows) onRow(row); return [] }
  return rows
}

export const clearCompetitorScheduleCache = () => repository.clear()
