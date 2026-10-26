import { readCompetitorJson } from './competitorRequestQueue.js'

const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const COMPETITOR_ROOT = 'competitorInfo'
const MAX_PARALLEL_READS = 8

export function normalizeCompetitorSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, '')
}

function encodeGram(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function getQueryGrams(query) {
  const characters = Array.from(query)
  const gramLength = characters.length >= 2 ? 2 : 1
  const grams = new Set()

  for (let index = 0; index <= characters.length - gramLength; index += 1) {
    grams.add(characters.slice(index, index + gramLength).join(''))
  }
  return [...grams]
}

async function readJson(path, signal) {
  const [pathname, query] = String(path).split('?')
  const url = `${FIREBASE_BASE_URL}/${pathname}.json${query ? `?${query}` : ''}`
  return readCompetitorJson(url, signal)
}

async function mapWithConcurrency(items, mapper, signal, limit = MAX_PARALLEL_READS) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      signal?.throwIfAborted()
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function parseDocumentId(documentId) {
  const matched = String(documentId).match(/^(SSG|SK|K)_(\d+)$/)
  if (!matched) return null
  return { company: matched[1], rowIndex: matched[2] }
}

export function getBroadcastSortValue(row) {
  const compactDate = String(row?.date || row?.sourceMonth || '').replace(/\D/g, '')
  const hour = String(row?.hour ?? '').padStart(2, '0')
  const minute = String(row?.minute ?? '').padStart(2, '0')
  return Number(`${compactDate}${hour}${minute}`) || 0
}

export function compareCompetitorBroadcastDesc(a, b) {
  const broadcastCompare = getBroadcastSortValue(b) - getBroadcastSortValue(a)
  if (broadcastCompare) return broadcastCompare
  return Number(b.sourceRowIndex || 0) - Number(a.sourceRowIndex || 0)
}

export function matchesCompetitorSearch(row, type, searchText) {
  const query = normalizeCompetitorSearchText(searchText)
  if (type === 'brand') {
    return normalizeCompetitorSearchText(row?.brand).includes(query)
  }

  return [row?.dataProductName, row?.productName]
    .some((value) => normalizeCompetitorSearchText(value).includes(query))
}

export async function fetchCompetitorSearchMonths(signal) {
  const payload = await readJson(`${COMPETITOR_ROOT}/searchIndex?shallow=true`, signal)
  return Object.keys(payload || {}).sort((a, b) => b.localeCompare(a))
}

export async function searchCompetitorInfo({ month, type, searchText, signal }) {
  const query = normalizeCompetitorSearchText(searchText)
  if (!query) return []
  if (!month) throw new Error('검색할 월을 선택해 주세요.')
  if (!['brand', 'product'].includes(type)) throw new Error('지원하지 않는 검색 유형입니다.')

  const grams = getQueryGrams(query)
  let ids
  for (const gram of grams) {
    signal?.throwIfAborted()
    const documents = await readJson(`${COMPETITOR_ROOT}/searchIndex/${month}/grams/${type}/${encodeGram(gram)}`, signal)
    ids = ids === undefined ? Object.keys(documents || {}) : ids.filter(id => documents?.[id])
    if (!ids.length) return []
  }
  const references = (ids || [])
    .map(parseDocumentId)
    .filter(Boolean)

  const rows = await mapWithConcurrency(references, async ({ company, rowIndex }) => {
    const row = await readJson(`${COMPETITOR_ROOT}/monthly/${month}/data/${company}/${rowIndex}`, signal)
    if (!row || !matchesCompetitorSearch(row, type, query)) return null
    return { ...row, companyKey: company, sourceMonth: month, sourceRowIndex: Number(rowIndex) }
  }, signal)

  return rows
    .filter(Boolean)
    .sort(compareCompetitorBroadcastDesc)
}

export async function searchCompetitorMonths({ months, type, searchText, signal }) {
  const groups = await mapWithConcurrency(months, month => searchCompetitorInfo({ month, type, searchText, signal }), signal, 2)
  signal?.throwIfAborted()
  return groups.flat().sort(compareCompetitorBroadcastDesc)
}
