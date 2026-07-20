const FIREBASE_BASE_URL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const COMPETITOR_ROOT = 'competitorInfo'
const MAX_PARALLEL_READS = 30

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

async function readJson(path) {
  const [pathname, query] = String(path).split('?')
  const url = `${FIREBASE_BASE_URL}/${pathname}.json${query ? `?${query}` : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`경쟁사 DB 조회 실패 (${response.status}): ${detail}`)
  }
  return response.json()
}

async function mapWithConcurrency(items, mapper) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workerCount = Math.min(MAX_PARALLEL_READS, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function intersectDocumentIds(documentMaps) {
  if (!documentMaps.length) return []
  const [first, ...rest] = documentMaps
  const firstIds = Object.keys(first || {})
  return firstIds.filter((id) => rest.every((map) => map?.[id]))
}

function parseDocumentId(documentId) {
  const matched = String(documentId).match(/^(SSG|SK|K)_(\d+)$/)
  if (!matched) return null
  return { company: matched[1], rowIndex: matched[2] }
}

export function matchesCompetitorSearch(row, type, searchText) {
  const query = normalizeCompetitorSearchText(searchText)
  if (type === 'brand') {
    return normalizeCompetitorSearchText(row?.brand).includes(query)
  }

  return [row?.dataProductName, row?.productName]
    .some((value) => normalizeCompetitorSearchText(value).includes(query))
}

export async function fetchCompetitorSearchMonths() {
  const payload = await readJson(`${COMPETITOR_ROOT}/searchIndex?shallow=true`)
  return Object.keys(payload || {}).sort((a, b) => b.localeCompare(a))
}

export async function searchCompetitorInfo({ month, type, searchText }) {
  const query = normalizeCompetitorSearchText(searchText)
  if (!query) return []
  if (!month) throw new Error('검색할 월을 선택해 주세요.')
  if (!['brand', 'product'].includes(type)) throw new Error('지원하지 않는 검색 유형입니다.')

  const grams = getQueryGrams(query)
  const documentMaps = await Promise.all(
    grams.map((gram) => readJson(
      `${COMPETITOR_ROOT}/searchIndex/${month}/grams/${type}/${encodeGram(gram)}`,
    )),
  )
  const references = intersectDocumentIds(documentMaps)
    .map(parseDocumentId)
    .filter(Boolean)

  const rows = await mapWithConcurrency(references, async ({ company, rowIndex }) => {
    const row = await readJson(`${COMPETITOR_ROOT}/monthly/${month}/data/${company}/${rowIndex}`)
    if (!row || !matchesCompetitorSearch(row, type, query)) return null
    return { ...row, companyKey: company, sourceMonth: month, sourceRowIndex: Number(rowIndex) }
  })

  return rows
    .filter(Boolean)
    .sort((a, b) => {
      const dateCompare = String(a.date || '').localeCompare(String(b.date || ''))
      if (dateCompare) return dateCompare
      const hourCompare = Number(a.hour || 0) - Number(b.hour || 0)
      if (hourCompare) return hourCompare
      return Number(a.minute || 0) - Number(b.minute || 0)
    })
}
