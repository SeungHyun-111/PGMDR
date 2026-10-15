import assert from 'node:assert/strict'
import test from 'node:test'
import { filterPerformanceRows, percentChange, formatPercentagePointDifference, summarizePerformance, summarizePreviousSlots, summarizeVideoTypes } from '../src/utils/promotionStatistics.js'

test('summary uses aggregate amounts and weighted minutes, not arithmetic mean of row ratios', () => {
  const result = summarizePerformance([
    { weightedMin: 10, expectedSales: 100, targetSales: 50, contributionProfit: 20, targetContributionProfit: 40 },
    { weightedMin: 30, expectedSales: 900, targetSales: 950, contributionProfit: 180, targetContributionProfit: 160 },
  ])
  assert.equal(result.count, 2)
  assert.equal(result.weightedMin, 40)
  assert.equal(result.salesPerMin, 25)
  assert.equal(result.profitPerMin, 5)
  assert.equal(result.salesAchievement, 1)
  assert.equal(result.profitAchievement, 1)
  assert.equal(result.overallAchievement, 1)
  const mixed = summarizePerformance([{ weightedMin: 10, expectedSales: 150, targetSales: 100, contributionProfit: 50, targetContributionProfit: 100 }])
  assert.equal(mixed.overallAchievement, 1)
})

test('zero denominators do not produce Infinity or misleading growth percentages', () => {
  const empty = summarizePerformance([])
  assert.equal(empty.expectedSales, 0)
  assert.equal(empty.salesPerMin, null)
  assert.equal(empty.salesAchievement, null)
  assert.equal(empty.overallAchievement, null)
  assert.equal(percentChange(10, 0), null)
  assert.equal(percentChange(12, 10), 0.2)
  assert.equal(percentChange(0, 10), -1)
})

test('preorder share uses aggregate target sales and comparison uses percentage points', () => {
  const current = summarizePerformance([
    { preorderExpectedSales: 15, targetSales: 100 },
    { preorderExpectedSales: 45, targetSales: 300 },
  ])
  const previous = summarizePerformance([{ preorderExpectedSales: 10, targetSales: 100 }])
  assert.equal(current.preorderShare, 0.15)
  assert.equal(previous.preorderShare, 0.1)
  assert.equal(formatPercentagePointDifference(current.preorderShare, previous.preorderShare), '+5.0%p')
  assert.equal(formatPercentagePointDifference(0.1, 0.15), '-5.0%p')
  assert.equal(formatPercentagePointDifference(0.15, 0), '+15.0%p')
  assert.equal(formatPercentagePointDifference(null, 0), '—')
  assert.equal(formatPercentagePointDifference(0, 0), '0.0%p')
  assert.equal(summarizePerformance([{ preorderExpectedSales: 10, targetSales: 0 }]).preorderShare, null)
  assert.equal(percentChange(current.preorderShare, 0), null)
})

test('previous slots total P-1/P-2/P-3 individually and compare using actual historical weighted minutes', () => {
  const rows = [{ key: 'A' }, { key: 'A' }, { key: 'B' }]
  const result = summarizePreviousSlots(rows, {
    A: [{ expectedSales: 100, contributionProfit: 10, weightedMin: 10 }, { expectedSales: 600, contributionProfit: 60, weightedMin: 30 }],
    B: [{ expectedSales: 200, contributionProfit: 20, weightedMin: 20 }],
  }, row => row.key)
  assert.equal(result.slots[0].expectedSales, 400)
  assert.equal(result.slots[1].expectedSales, 1200)
  assert.equal(result.slots[2].expectedSales, 0)
  assert.equal(result.average.weightedMin, 100)
  assert.equal(result.average.salesPerMin, 16)
  assert.equal(result.average.profitPerMin, 1.6)
})

test('night, organization and category filters combine identically for promotion and non-promotion rows', () => {
  const entries = [
    ['a', { org: '식품팀', mdCategory: '식품', broadcastTime: '00:59' }],
    ['b', { org: '식품팀', mdCategory: '식품', broadcastTime: '01:00' }],
    ['c', { org: '뷰티팀', mdCategory: '뷰티', broadcastTime: '05:00' }],
    ['d', { org: '식품팀', mdCategory: '건강', broadcastTime: '05:00' }],
  ]
  const org = row => row.org
  assert.deepEqual(filterPerformanceRows(entries, { excludeLateNight: true, organizations: ['식품팀', '뷰티팀'], categories: ['식품', '뷰티'] }, org).map(([id]) => id), ['a', 'c'])
  assert.equal(filterPerformanceRows(entries, { excludeLateNight: false, organizations: [], categories: [] }, org).length, 4)
})

test('intangible exclusion removes cultural services without removing other organizations', () => {
  const entries = [['a', { org: '문화서비스팀', broadcastTime: '10:31' }], ['b', { org: '식품팀', broadcastTime: '10:31' }], ['c', { org: '식품팀', broadcastTime: '01:00' }]]
  const filters = { excludeLateNight: true, excludeIntangible: true, organizations: [], categories: [] }
  assert.deepEqual(filterPerformanceRows(entries, filters, row => row.org).map(([id]) => id), ['b'])
  assert.deepEqual(filterPerformanceRows(entries, { ...filters, excludeIntangible: false }, row => row.org).map(([id]) => id), ['a', 'b'])
})

test('video breakdown groups by current video type and reuses corresponding product histories for growth', () => {
  const rows = [
    { key: 'A', newProductType: '신상품', expectedSales: 200, weightedMin: 10 },
    { key: 'B', newProductType: '기존', expectedSales: 900, weightedMin: 30 },
    { key: 'C', newProductType: '신상품', expectedSales: 600, weightedMin: 30 },
    { key: 'D', newProductType: '재녹화', expectedSales: 100, weightedMin: 10 },
  ]
  const groups = summarizeVideoTypes(rows, {
    A: [{ newProductType: '기존', expectedSales: 100, weightedMin: 10 }],
    B: [], C: [{ expectedSales: 300, weightedMin: 30 }],
  }, row => row.key)
  assert.deepEqual(groups.map(group => group.type), ['재녹화', '기존', '신상품'])
  assert.equal(groups[2].current.count, 2)
  assert.equal(groups[2].current.salesPerMin, 20)
  assert.equal(groups[2].previous.salesPerMin, 10)
  assert.equal(percentChange(groups[2].current.salesPerMin, groups[2].previous.salesPerMin), 1)
  assert.equal(groups[0].missingHistory, true)
  assert.equal(groups[1].missingHistory, false)
})
