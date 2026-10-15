import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPromotionHistoryChart } from '../src/utils/promotionHistoryChart.js'

test('chart orders P-3 to promotion and shares weighted averages with the table', () => {
  const previous = [
    { weightedMin: 10, expectedSales: 1000, contributionProfit: 200, targetSales: 1000, preorderExpectedSales: 100, broadcastDate: '2026-09-20', multiChannel: 'CA' },
    { weightedMin: 30, expectedSales: 6000, contributionProfit: 1200, targetSales: 3000, preorderExpectedSales: 900 },
  ]
  const row = { weightedMin: 20, expectedSales: 6000, contributionProfit: 1000, targetSales: 2000, preorderExpectedSales: 1000 }
  const data = buildPromotionHistoryChart(row, previous)
  assert.deepEqual(data.map(point => point.label), ['P-3', 'P-2', 'P-1', '프로모션'])
  assert.equal(data[0].missing, true)
  assert.equal(data[0].salesPerMin, 0)
  assert.equal(data[2].broadcastDate, '2026-09-20')
  assert.equal(data[2].channel, 'CA')
  assert.equal(data[3].salesPerMin, 300)
  assert.equal(data[3].preorderRatio, 50)
  assert.ok(data.every(point => point.avgSalesPerMin === 175 && point.avgProfitPerMin === 35 && point.avgPreorderRatio === 25))
  assert.ok(data.every((point, i) => i === 0 || point.date - data[i - 1].date === 86400000))
})

test('chart handles missing histories and zero denominators without Infinity or NaN', () => {
  const data = buildPromotionHistoryChart({}, [])
  assert.ok(data.every(point => ['salesPerMin', 'profitPerMin', 'preorderRatio', 'avgSalesPerMin', 'avgProfitPerMin', 'avgPreorderRatio'].every(key => point[key] === 0)))
})
