import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'

const entry = resolve(`.competitor-cache-check-${process.pid}.jsx`)
const source = name => JSON.stringify(resolve(name).replaceAll('\\', '/'))
let browser
try {
  await writeFile(entry, `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Search from ${source('src/components/common/CompetitorSearch.jsx')};
    import {fetchScheduleWeek,clearCompetitorScheduleCache} from ${source('src/api/competitorSchedule.js')};
    import {competitorDiskCache} from ${source('src/api/competitorDiskCache.js')};
    window.loadRows=(dates)=>fetchScheduleWeek('SSG',dates);
    window.clearRows=clearCompetitorScheduleCache; window.disk=competitorDiskCache;
    createRoot(document.getElementById('root')).render(React.createElement(Search));
    window.ready=true;
  `)
  const built = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, plugins: [react()], build: { write: false, minify: false, lib: { entry, formats: ['es'], fileName: 'test' } } })
  const output = Array.isArray(built) ? built[0].output : built.output
  const script = output.find(item => item.type === 'chunk' && item.isEntry).code
  const css = await readFile('src/index.css', 'utf8')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let revision = 'version-1', dataReads = 0, active = 0, maximum = 0, rowReads = 0, slow = false
  const cloud = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app/**'
  const attach = async context => {
    await context.route('http://cache-search-test.local/**', route => route.fulfill(route.request().url().endsWith('/test.js')
      ? { contentType: 'application/javascript', body: script }
      : { contentType: 'text/html', body: `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>` }))
    await context.route(cloud, async route => {
      active++; maximum = Math.max(maximum, active)
      try {
        const url = new URL(route.request().url())
        const path = url.pathname
        let payload
        if (path.endsWith('/updatedAt.json')) payload = revision
        else if (path.endsWith('/searchIndex.json')) payload = { '202610': true, '202609': true, '202608': true }
        else if (path.includes('/searchIndex/')) payload = path.includes('/202610/') ? Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`SSG_${i}`, true])) : {}
        else if (url.searchParams.has('orderBy')) {
          dataReads++
          const date = JSON.parse(url.searchParams.get('startAt'))
          payload = { 0: { date, hour: 9, minute: 0, brand: 'Acme', productName: 'Product', weightedMin: 1, revenue: revision } }
        } else {
          rowReads++
          const index = Number(path.match(/\/(\d+)\.json$/)?.[1])
          await new Promise(resolve => setTimeout(resolve, slow ? 120 : 3))
          payload = { date: '2026-10-19', hour: index % 24, minute: 0, brand: 'Acme', productName: `Acme ${index}`, weightedMin: 1, revenue: 1000 }
        }
        await route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(payload) })
      } catch { /* Aborting browser fetches intentionally cancels mocked responses. */ }
      finally { active-- }
    })
  }
  await attach(context)
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://cache-search-test.local/')
  await page.waitForFunction(() => window.ready)
  await page.evaluate(() => window.loadRows(['2026-10-19']))
  assert.equal(dataReads, 1)
  await page.reload()
  await page.waitForFunction(() => window.ready)
  await page.evaluate(() => window.loadRows(['2026-10-19']))
  assert.equal(dataReads, 1, 'IndexedDB survives browser reload')
  revision = 'version-2'
  const fresh = await page.evaluate(() => window.loadRows(['2026-10-19']))
  assert.equal(dataReads, 2)
  assert.equal(fresh[0].revenue, 'version-2')
  await page.evaluate(async () => {
    localStorage.setItem('meeting-draft-test', 'unsaved note')
    await window.disk.write(Array.from({ length: 190 }, (_, i) => ({ key: `test:${i}`, rows: [], revision: '1' })))
  })
  const records = await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('pgmdr-competitor-cache-v1')
    request.onsuccess = () => {
      const tx = request.result.transaction('metadata')
      const count = tx.objectStore('metadata').count()
      count.onsuccess = () => resolve(count.result)
      tx.oncomplete = () => request.result.close()
    }
  }))
  assert.ok(records <= 180)
  await page.evaluate(() => window.clearRows())
  assert.equal(await page.evaluate(() => localStorage.getItem('meeting-draft-test')), 'unsaved note')

  await page.getByTestId('competitor-search-trigger').click()
  await page.getByTestId('brand-search-input').fill('Acme')
  await page.getByTestId('brand-search-button').click()
  const pages = page.getByRole('navigation', { name: 'SSG 검색 결과 페이지' })
  await pages.waitFor()
  assert.equal(await page.locator('tbody tr').count(), 100)
  assert.ok((await pages.innerText()).includes('250'))
  await pages.getByRole('button', { name: '다음', exact: true }).click()
  assert.equal(await page.locator('tbody tr').count(), 100)
  await pages.getByRole('button', { name: '다음', exact: true }).click()
  assert.equal(await page.locator('tbody tr').count(), 50)
  assert.ok(maximum <= 8, `global requests exceeded limit: ${maximum}`)
  assert.equal(rowReads, 250)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByTestId('competitor-search-trigger').click()
  assert.equal(await page.locator('tbody tr').count(), 0)
  assert.equal(await page.getByTestId('brand-search-input').inputValue(), '')
  slow = true
  const before = rowReads
  await page.getByTestId('brand-search-input').fill('Acme')
  await page.getByTestId('brand-search-button').click()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.waitForTimeout(400)
  assert.ok(rowReads - before < 250, 'closing must stop remaining row requests')
  await page.getByTestId('competitor-search-trigger').click()
  assert.equal(await page.locator('tbody tr').count(), 0, 'late responses must not refill results')
  assert.equal(await page.getByTestId('brand-search-input').inputValue(), '')

  const unavailable = await browser.newContext()
  await attach(unavailable)
  await unavailable.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Storage disabled') } }))
  const fallbackPage = await unavailable.newPage()
  await fallbackPage.goto('http://cache-search-test.local/')
  await fallbackPage.waitForFunction(() => window.ready)
  const readsBefore = dataReads
  await fallbackPage.evaluate(() => window.loadRows(['2026-10-19']))
  await fallbackPage.evaluate(() => window.loadRows(['2026-10-19']))
  assert.equal(dataReads, readsBefore + 2, 'storage denial must use network without breaking the view')
  assert.deepEqual(errors, [])
  console.log('PASS: persistent IndexedDB hits, monthly invalidation, LRU cap, draft isolation, 100-row pages, global concurrency, close cancellation, late-response guard, storage failure fallback')
} finally {
  await browser?.close()
  await unlink(entry)
}
