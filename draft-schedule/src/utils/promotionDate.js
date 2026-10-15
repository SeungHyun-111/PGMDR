export function normalizePromotionDate(value, year = new Date().getFullYear()) {
  const text = String(value || '').trim()
  if (!text) return ''
  let parts = text.split(/[-/.\s]+/)
  if (/^\d{8}$/.test(text)) parts = [text.slice(0, 4), text.slice(4, 6), text.slice(6)]
  if (/^\d{6}$/.test(text)) parts = [text.slice(0, 2), text.slice(2, 4), text.slice(4)]
  if (parts.length === 2) parts.unshift(String(year))
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) return null
  let [y, m, d] = parts.map(Number)
  if (parts[0].length <= 2) y += 2000
  if (y < 1000 || y > 9999) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
