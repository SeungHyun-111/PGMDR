import assert from 'node:assert/strict'
import test from 'node:test'
import { getLateNightPgmYn } from '../src/utils/lateNight.js'
import { previousThree } from '../src/utils/performanceQuery.js'

test('late-night start-time boundaries are 01:00 inclusive through 04:59', () => {
  for (const [time, expected] of [['00:41', 'N'], ['00:59', 'N'], ['01:00', 'Y'], ['1:00', 'Y'], ['04:59', 'Y'], ['05:00', 'N'], ['23:31', 'N']]) {
    assert.equal(getLateNightPgmYn(time), expected, time)
  }
})

test('actual start time overrides old flags and missing flags use timestamps', () => {
  assert.equal(getLateNightPgmYn({ broadcastTime: '00:41', lateNightPgmYn: 'Y' }), 'N')
  assert.equal(getLateNightPgmYn({ broadcastTime: '04:59', lateNightPgmYn: 'N' }), 'Y')
  assert.equal(getLateNightPgmYn({ broadcastTimestamp: 202610010100 }), 'Y')
  assert.equal(getLateNightPgmYn({ broadcastTimestamp: 202610010500 }), 'N')
})

test('previous three excludes night broadcasts even without a flag and keeps 00:41 despite an old Y flag', () => {
  const rows = [
    { broadcastTimestamp: 202610010500, broadcastTime: '05:00' },
    { broadcastTimestamp: 202610010459, broadcastTime: '04:59' },
    { broadcastTimestamp: 202610010100, broadcastTime: '01:00' },
    { broadcastTimestamp: 202610010059, broadcastTime: '00:59' },
    { broadcastTimestamp: 202610010041, broadcastTime: '00:41', lateNightPgmYn: 'Y' },
  ]
  assert.deepEqual(previousThree(rows, 202610021031).map(row => row.broadcastTime), ['05:00', '00:59', '00:41'])
})
