import test from 'node:test'
import assert from 'node:assert/strict'
import XLSX from 'xlsx-js-style'
import { createPromotionWorkbook, exportCellValue } from '../src/utils/export/promotionPerformanceExport.js'

test('exports amounts and shares as numbers, dates and percentage points as text', () => {
  assert.deepEqual(exportCellValue('1,234'), { t: 'n', v: 1234, z: '#,##0' })
  assert.equal(exportCellValue('12.3%').t, 'n')
  assert.ok(Math.abs(exportCellValue('12.3%').v - 0.123) < 1e-12)
  assert.equal(exportCellValue('12.3%').z, '0.0%')
  assert.equal(exportCellValue('85%').z, '0%')
  assert.equal(exportCellValue('2026-10-01 10:00').t, 's')
  assert.equal(exportCellValue('+2.1%p').v, '+2.1%p')
  assert.equal(exportCellValue('—').v, '—')
})

test('workbook preserves 44 columns, merged groups, totals, numeric shares and change colors', () => {
  const cell = (text, extra = {}) => ({ text, ...extra })
  const groups = [17, 3, 8, 8, 8].map((colSpan, i) => cell(`그룹${i}`, { colSpan, header: true }))
  const headers = Array.from({ length: 44 }, (_, i) => cell(`열${i}`, { header: true }))
  const detailRow = Array.from({ length: 44 }, (_, i) => cell(i === 14 ? '12.3%' : String(i)))
  detailRow[4] = cell('00123')
  const workbook = createPromotionWorkbook({ promotion: { name: '테스트', startDate: '2026-10-01', endDate: '2026-10-15' }, filters: '심야 제외', tables: [
    { title: '비교', detail: false, rows: [[cell('항목', { header: true }), cell('차이', { header: true })], [cell('취급액'), cell('+1,234', { difference: true })], [cell('비중'), cell('-2.1%p', { difference: true })]] },
    { title: '프로모션 실적', detail: true, rows: [groups, headers, detailRow.map(item => ({ ...item, total: true })), detailRow] },
  ] })
  const sheet = workbook.Sheets['프로모션 실적']
  assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.c, 43)
  assert.equal(sheet['!merges'].length, 5)
  assert.ok(Math.abs(sheet.O8.v - 0.123) < 1e-12)
  assert.equal(sheet.A7.s.font.bold, true)
  assert.equal(sheet.E8.v, '00123')
  assert.equal(sheet.E8.t, 's')
  assert.equal(sheet['!autofilter'].ref, 'A6:AR8')
  assert.equal(workbook.Sheets['요약'].B7.s.font.color.rgb, '2563EB')
  assert.equal(workbook.Sheets['요약'].B8.s.font.color.rgb, 'DC2626')
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const reopened = XLSX.read(bytes, { type: 'buffer' })
  assert.deepEqual(reopened.SheetNames, ['요약', '프로모션 실적'])
  assert.ok(Math.abs(reopened.Sheets['프로모션 실적'].O8.v - 0.123) < 1e-12)
})
