import XLSX from 'xlsx-js-style'

const border = { style: 'thin', color: { rgb: 'D7DFEA' } }
const colors = ['24518A', '687B35', '147D83', '73549B', 'B76725']
const groupIndex = column => column < 17 ? 0 : column < 20 ? 1 : column < 28 ? 2 : column < 36 ? 3 : 4

export function exportCellValue(text) {
  const cleaned = text.trim().replaceAll(',', '')
  if (/^[+-]?\d+(\.\d+)?%$/.test(cleaned)) return { t: 'n', v: Number.parseFloat(cleaned) / 100, z: cleaned.includes('.') ? '0.0%' : '0%' }
  if (/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return { t: 'n', v: Number(cleaned), z: '#,##0' }
  return { t: 's', v: text.trim() }
}

export function readPromotionExportTables(root) {
  return [...root.querySelectorAll('table')].map(table => {
    const detail = table.id === 'promotion-results-detail-table'
    const heading = table.closest('.promotion-comparison-card')?.querySelector('h3') || table.closest('.promotion-video-summary')?.querySelector('summary')
    const headingCopy = heading?.cloneNode(true)
    headingCopy?.querySelectorAll('button, .promotion-video-click-hint').forEach(node => node.remove())
    return {
      detail,
      title: detail ? '프로모션 실적' : headingCopy?.textContent.trim() || '실적 비교',
      rows: [...table.rows].map(row => [...row.cells].map(cell => {
        const copy = cell.cloneNode(true)
        copy.querySelectorAll('.promotion-formula-trigger').forEach(node => node.remove())
        copy.querySelectorAll('.promotion-sort-header').forEach(node => node.replaceWith(node.querySelector('span').textContent))
        return { text: copy.textContent.trim(), colSpan: cell.colSpan, rowSpan: cell.rowSpan, header: row.parentElement.tagName === 'THEAD', total: row.classList.contains('promotion-results-totals'), difference: row.classList.contains('promotion-comparison-difference') || cell.classList.contains('promotion-video-growth') }
      })),
    }
  })
}

function appendTable(sheet, table, startRow) {
  const occupied = new Set()
  const merges = sheet['!merges'] ||= []
  let maxColumn = 0
  table.rows.forEach((row, r) => {
    let c = 0
    row.forEach(item => {
      while (occupied.has(`${r}:${c}`)) c++
      const colSpan = item.colSpan || 1
      const rowSpan = item.rowSpan || 1
      for (let y = r; y < r + rowSpan; y++) for (let x = c; x < c + colSpan; x++) occupied.add(`${y}:${x}`)
      if (colSpan > 1 || rowSpan > 1) merges.push({ s: { r: startRow + r, c }, e: { r: startRow + r + rowSpan - 1, c: c + colSpan - 1 } })
      const textColumn = table.detail && ([0, 1, 3, 4, 5, 15, 16].includes(c) || c >= 20 && (c - 20) % 8 === 0)
      const value = item.header || textColumn ? { t: 's', v: item.text } : exportCellValue(item.text)
      const sign = item.difference ? Number.parseFloat(item.text.replaceAll(',', '')) : 0
      value.s = {
        font: { name: '맑은 고딕', sz: 10, bold: item.header || item.total || item.difference, color: { rgb: item.header ? 'FFFFFF' : sign > 0 ? '2563EB' : sign < 0 ? 'DC2626' : '243247' } },
        fill: { fgColor: { rgb: item.header ? (table.detail ? colors[groupIndex(c)] : '24518A') : item.total ? 'DFEAF6' : r % 2 ? 'F3F6FA' : 'FFFFFF' } },
        alignment: { vertical: 'center', horizontal: item.header ? 'center' : value.t === 'n' ? 'right' : 'left', wrapText: item.header },
        border: { top: border, bottom: border, left: border, right: border },
      }
      sheet[XLSX.utils.encode_cell({ r: startRow + r, c })] = value
      c += colSpan
      maxColumn = Math.max(maxColumn, c)
    })
    sheet['!rows'] ||= []
    sheet['!rows'][startRow + r] = { hpt: row.some(cell => cell.header) ? 34 : 24 }
  })
  const endRow = startRow + table.rows.length - 1
  const prior = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : { e: { c: 0, r: 0 } }
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(prior.e.r, endRow), c: Math.max(prior.e.c, maxColumn - 1) } })
  if (table.detail) sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: startRow + 1, c: 0 }, e: { r: endRow, c: maxColumn - 1 } }) }
  return endRow + 3
}

export function createPromotionWorkbook({ promotion, filters, tables, coverage }) {
  const workbook = XLSX.utils.book_new()
  for (const detail of [false, true]) {
    const selectedTables = tables.filter(table => table.detail === detail)
    if (!selectedTables.length) continue
    const sheet = XLSX.utils.aoa_to_sheet([[promotion.name || '프로모션 실적'], [`기간: ${promotion.startDate} ~ ${promotion.endDate}`], [filters]])
    sheet.A1.s = { font: { name: '맑은 고딕', sz: 16, bold: true, color: { rgb: '24518A' } } }
    let startRow = 4
    if (!detail && coverage) {
      XLSX.utils.sheet_add_aoa(sheet, [[coverage]], { origin: { r: startRow, c: 0 } })
      startRow += 2
    }
    selectedTables.forEach(table => {
      if (!detail) {
        XLSX.utils.sheet_add_aoa(sheet, [[table.title]], { origin: { r: startRow, c: 0 } })
        sheet[XLSX.utils.encode_cell({ r: startRow, c: 0 })].s = { font: { name: '맑은 고딕', bold: true, sz: 12 } }
        startRow++
      }
      startRow = appendTable(sheet, table, startRow)
    })
    const columns = XLSX.utils.decode_range(sheet['!ref']).e.c + 1
    sheet['!cols'] = Array.from({ length: columns }, (_, c) => ({ wch: detail ? c === 4 ? 35 : c === 0 || c >= 20 && (c - 20) % 8 === 0 ? 23 : c === 1 || c === 2 || c === 3 || c === 5 ? 12 : 21 : c === 0 ? 24 : 23 }))
    XLSX.utils.book_append_sheet(workbook, sheet, detail ? '프로모션 실적' : '요약')
  }
  return workbook
}

export function downloadPromotionPerformance({ root, promotion, filters }) {
  const coverage = root.querySelector('.promotion-coverage')?.cloneNode(true)
  coverage?.querySelectorAll('button').forEach(node => node.remove())
  const workbook = createPromotionWorkbook({ promotion, filters, tables: readPromotionExportTables(root), coverage: coverage ? [...coverage.children].map(node => node.textContent.trim()).join(' · ') : '' })
  const name = (promotion.name || '프로모션').replace(/[\\/:*?"<>|]/g, '_').replaceAll(String.fromCharCode(0), '')
  XLSX.writeFile(workbook, `프로모션실적_${name}_${promotion.startDate}_${promotion.endDate}.xlsx`)
}
