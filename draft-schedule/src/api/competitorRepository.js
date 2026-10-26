const BASE = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app/competitorInfo/monthly'
const aborted = signal => signal?.reason || new DOMException('Aborted', 'AbortError')

function observe(job, promise, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted(signal)); return }
    job.consumers++
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', cancel)
      job.consumers--
      callback(value)
      if (!job.done && job.consumers === 0) job.controller.abort()
    }
    const cancel = () => finish(reject, aborted(signal))
    signal?.addEventListener('abort', cancel, { once: true })
    promise.then(value => finish(resolve, value), error => finish(reject, error))
  })
}

export function createCompetitorRepository({ readJson, cache }) {
  const days = new Map(), metadata = new Map()
  let generation = 0
  const monthFor = date => date.slice(0, 7).replace('-', '')
  const readRevision = async (month, signal) => {
    const value = await readJson(`${BASE}/${month}/updatedAt.json`, signal)
    return typeof value === 'string' && value.trim() || typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const version = (month, signal) => {
    let job = metadata.get(month)
    if (!job || job.controller.signal.aborted) {
      job = { controller: new AbortController(), consumers: 0, done: false }
      metadata.set(month, job)
      job.promise = Promise.resolve().then(() => readRevision(month, job.controller.signal)).finally(() => {
        job.done = true
        if (metadata.get(month) === job) metadata.delete(month)
      })
    }
    return observe(job, job.promise, signal)
  }

  async function loadOnce(company, dates, signal) {
    signal?.throwIfAborted()
    const epoch = generation
    const months = [...new Set(dates.map(monthFor))]
    const versions = new Map(await Promise.all(months.map(async month => [month, await version(month, signal)])))
    signal?.throwIfAborted()
    const revisions = new Map(dates.map(date => [`${company}:${date}`, versions.get(monthFor(date))]))
    const cached = await cache.read([...revisions.keys()], revisions)
    signal?.throwIfAborted()
    if (generation !== epoch) throw new DOMException('Cache refreshed', 'AbortError')
    const missing = [], waiting = [], values = new Map()
    const batch = { controller: new AbortController(), consumers: 0, done: false }
    for (const date of dates) {
      const key = `${company}:${date}`
      if (cached.has(key)) { values.set(date, cached.get(key)); continue }
      const requestKey = `${epoch}:${key}:${JSON.stringify(revisions.get(key))}`
      let slot = days.get(requestKey)
      if (!slot || slot.job.controller.signal.aborted) {
        slot = { key, date, requestKey, job: batch }
        slot.promise = new Promise((resolve, reject) => { slot.resolve = resolve; slot.reject = reject })
        missing.push(slot)
        days.set(requestKey, slot)
      }
      waiting.push(observe(slot.job, slot.promise, signal).then(rows => values.set(date, rows)))
    }
    if (missing.length) {
      // Dates share one pending read; cancelling one view never cancels another view's read.
      const run = async () => {
        try {
          const buckets = new Map(missing.map(slot => [slot.date, []]))
          const targetMonths = [...new Set(missing.map(slot => monthFor(slot.date)))]
          for (const month of targetMonths) {
            const targetDates = missing.filter(slot => monthFor(slot.date) === month).map(slot => slot.date)
            const params = new URLSearchParams({ orderBy: JSON.stringify('date'), startAt: JSON.stringify(targetDates[0]), endAt: JSON.stringify(targetDates.at(-1)) })
            let payload
            try { payload = await readJson(`${BASE}/${month}/data/${company}.json?${params}`, batch.controller.signal) }
            catch (error) {
              if (/Index not defined/i.test(error.message)) throw new Error(`경쟁사 ${month}/${company}의 date 인덱스가 필요합니다. 월 전체 다운로드는 실행하지 않았습니다.`, { cause: error })
              throw error
            }
            for (const [key, row] of Object.entries(payload || {})) {
              if (row && buckets.has(row.date)) buckets.get(row.date).push({ ...row, id: `${month}-${key}` })
            }
          }
          const after = await Promise.all(targetMonths.map(month => readRevision(month, batch.controller.signal)))
          if (after.some((value, index) => value !== versions.get(targetMonths[index]))) {
            const error = new Error('조회 중 원본이 갱신되어 다시 조회합니다.')
            error.code = 'STALE_REVISION'
            throw error
          }
          batch.controller.signal.throwIfAborted()
          if (generation !== epoch) throw new DOMException('Cache refreshed', 'AbortError')
          await cache.write(missing.map(slot => ({ key: slot.key, rows: buckets.get(slot.date), revision: revisions.get(slot.key) })), () => generation === epoch)
          batch.controller.signal.throwIfAborted()
          if (generation !== epoch) throw new DOMException('Cache refreshed', 'AbortError')
          batch.done = true
          for (const slot of missing) slot.resolve(buckets.get(slot.date))
        } catch (error) {
          batch.done = true
          for (const slot of missing) slot.reject(error)
        } finally {
          for (const slot of missing) if (days.get(slot.requestKey) === slot) days.delete(slot.requestKey)
        }
      }
      void run()
    }
    await Promise.all(waiting)
    signal?.throwIfAborted()
    return dates.flatMap(date => values.get(date) || []).sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.minute - b.minute)
  }

  return {
    async load(company, inputDates, signal) {
      if (!['SSG', 'K'].includes(company)) throw new Error('지원하지 않는 채널입니다.')
      const dates = [...new Set(inputDates)].sort()
      if (!dates.length) return []
      if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('조회 날짜가 올바르지 않습니다.')
      try { return await loadOnce(company, dates, signal) }
      catch (error) {
        if (error.code !== 'STALE_REVISION') throw error
        return loadOnce(company, dates, signal)
      }
    },
    async clear() {
      generation++
      for (const slot of days.values()) slot.job.controller.abort()
      for (const job of metadata.values()) job.controller.abort()
      days.clear(); metadata.clear()
      await cache.clear()
    },
    get pendingCount() { return days.size + metadata.size },
  }
}
