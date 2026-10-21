import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeReservationInput, parseReservationPaste } from '../src/utils/promotionReservationInput.js'

test('reservation text accepts short dates, compact times and Excel-formatted date/time', () => {
  for (const value of ['10/29 2331', '10.29 23:31', '2026-10-29 23:31', '2026/10/29 23:31:00', '202610292331', '2026-10-29T23:31']) {
    assert.equal(normalizeReservationInput(value, 2026), '2026-10-29T23:31', value)
  }
  assert.equal(normalizeReservationInput('10/29 631', 2026), '2026-10-29T06:31')
  for (const value of ['2/30 1031', '10/29 2460', '10/29', 'invalid']) assert.throws(() => normalizeReservationInput(value, 2026))
})

test('Excel paste accepts date/time plus code or separate date, time and code columns', () => {
  assert.deepEqual(parseReservationPaste('10/29 2331\t상품A\r\n10/30 1031\t상품B\r\n'), [
    { dateTime: '10/29 2331', code: '상품A' }, { dateTime: '10/30 1031', code: '상품B' },
  ])
  assert.deepEqual(parseReservationPaste('2026-10-29\t23:31\t상품A'), [{ dateTime: '2026-10-29 23:31', code: '상품A' }])
})
