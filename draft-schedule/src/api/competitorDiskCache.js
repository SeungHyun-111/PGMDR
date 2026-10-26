const MAX_DAYS = 180
const MAX_BYTES = 24 * 1024 * 1024
let opening

function openCache() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!opening) opening = new Promise(resolve => {
    let settled = false
    const finish = db => {
      if (settled) { db?.close(); return }
      settled = true
      resolve(db)
    }
    const request = indexedDB.open('pgmdr-competitor-cache-v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('days', { keyPath: 'key' })
      request.result.createObjectStore('metadata', { keyPath: 'key' })
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); opening = undefined }
      finish(db)
    }
    request.onerror = () => { opening = undefined; finish(null) }
    request.onblocked = () => { opening = undefined; finish(null) }
  })
  return opening
}

export const competitorDiskCache = {
  async read(keys, revisions) {
    try {
      const db = await openCache()
      if (!db) return new Map()
      return await new Promise(resolve => {
        const result = new Map()
        const tx = db.transaction(['days', 'metadata'], 'readwrite')
        for (const key of keys) {
          const request = tx.objectStore('days').get(key)
          request.onsuccess = () => {
            const entry = request.result
            const revision = revisions.get(key)
            if (revision != null && entry?.revision === revision && Array.isArray(entry.rows)) {
              result.set(key, entry.rows)
              tx.objectStore('metadata').put({ key, usedAt: Date.now(), bytes: entry.bytes })
            }
          }
        }
        tx.oncomplete = () => resolve(result)
        tx.onerror = tx.onabort = () => resolve(new Map())
      })
    } catch { return new Map() }
  },
  async write(entries, isCurrent = () => true) {
    try {
      const db = await openCache()
      if (!db || !isCurrent()) return
      await new Promise(resolve => {
        const tx = db.transaction(['days', 'metadata'], 'readwrite')
        const metadata = tx.objectStore('metadata')
        for (const entry of entries) {
          if (entry.revision == null) continue
          const bytes = new TextEncoder().encode(JSON.stringify(entry.rows)).length
          tx.objectStore('days').put({ ...entry, bytes })
          metadata.put({ key: entry.key, usedAt: Date.now(), bytes })
        }
        // Only small metadata records are loaded to prune; historical row arrays stay on disk.
        const request = metadata.getAll()
        request.onsuccess = () => {
          const records = request.result.sort((a, b) => a.usedAt - b.usedAt)
          let bytes = records.reduce((sum, row) => sum + row.bytes, 0), count = records.length
          for (const record of records) {
            if (count <= MAX_DAYS && bytes <= MAX_BYTES) break
            tx.objectStore('days').delete(record.key)
            metadata.delete(record.key)
            count--; bytes -= record.bytes
          }
        }
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
      })
    } catch { /* Cache is optional; never block RTDB reads or meeting drafts. */ }
  },
  async clear() {
    try {
      const db = await openCache()
      if (!db) return
      await new Promise(resolve => {
        const tx = db.transaction(['days', 'metadata'], 'readwrite')
        tx.objectStore('days').clear(); tx.objectStore('metadata').clear()
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
      })
    } catch { /* The request generation still prevents reuse of older in-flight data. */ }
  },
}
