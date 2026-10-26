export function createRequestQueue(limit = 8) {
  let active = 0
  const waiting = []
  const drain = () => {
    while (active < limit && waiting.length) {
      const job = waiting.shift()
      job.signal?.removeEventListener('abort', job.cancel)
      if (job.signal?.aborted) { job.reject(job.signal.reason || new DOMException('Aborted', 'AbortError')); continue }
      active++
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { active--; drain() })
    }
  }
  return (task, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason || new DOMException('Aborted', 'AbortError')); return }
    const job = { task, signal, resolve, reject }
    job.cancel = () => {
      const index = waiting.indexOf(job)
      if (index >= 0) waiting.splice(index, 1)
      reject(signal.reason || new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', job.cancel, { once: true })
    waiting.push(job)
    drain()
  })
}

export const queueCompetitorRequest = createRequestQueue(8)

export async function readCompetitorJson(url, signal) {
  return queueCompetitorRequest(async () => {
    const response = await fetch(url, { signal, cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || `경쟁사 DB 조회 실패 (${response.status})`)
    return data
  }, signal)
}
