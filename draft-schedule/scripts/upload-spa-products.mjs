import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const base = 'https://pgmdr-87328-default-rtdb.asia-southeast1.firebasedatabase.app'
async function read(path) {
  const response = await fetch(`${base}/${path}.json`)
  if (!response.ok) throw new Error(`Read failed: ${response.status}`)
  return response.json()
}
const names = (await readFile(new URL('./spa-promotion-products.txt', import.meta.url), 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
if (new Set(names).size !== names.length) throw new Error('Duplicate product names')
const promotions = await read('global/promotions')
const matches = Object.entries(promotions || {}).filter(([, p]) => p.name?.trim() === '스패페')
if (matches.length !== 1) throw new Error('Expected exactly one 스패페 promotion')
const [id] = matches[0]
const path = `global/promotions/${id}/products`
const response = await fetch(`${base}/${path}.json`, { headers: { 'X-Firebase-ETag': 'true' } })
if (!response.ok) throw new Error(`Read failed: ${response.status}`)
const products = await response.json() || {}
const existing = new Set(Object.values(products).map(p => p.pgmCodeName?.trim()).filter(Boolean))
const blanks = Object.keys(products).filter(key => !products[key].pgmCodeName?.trim()).sort()
let added = 0
for (const name of names) {
  if (existing.has(name)) continue
  const key = blanks.shift() || `spa_${String(names.indexOf(name) + 1).padStart(3, '0')}_${createHash('sha256').update(name).digest('hex').slice(0, 10)}`
  if (products[key]?.pgmCodeName?.trim()) throw new Error('Product key collision')
  products[key] = { ...products[key], pgmCodeName: name, createdAt: products[key]?.createdAt || Date.now() }
  added++
}
if (added) {
  const write = await fetch(`${base}/${path}.json`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': response.headers.get('etag') },
    body: JSON.stringify(products),
  })
  if (!write.ok) throw new Error(`Upload failed: ${write.status}; retry after checking concurrent changes`)
}
const saved = Object.values(await read(path) || {})
if (names.some(name => !saved.some(p => p.pgmCodeName === name))) throw new Error('Verification failed')
console.log(JSON.stringify({ promotion: '스패페', requested: names.length, added, verified: saved.length }))
