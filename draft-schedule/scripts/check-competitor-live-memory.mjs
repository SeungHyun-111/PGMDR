import assert from 'node:assert/strict'
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'

// Real RTDB reads and real UI; save acknowledgement is simulated to avoid editing user notes.
const entry = resolve(`.live-memory-${process.pid}.jsx`)
let browser
const results = []
try {
  await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/CompetitorPage.jsx';import './src/index.css';createRoot(document.getElementById('root')).render(<Page/>);`)
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const baseline of [true, false]) {
    const built = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{
      name: 'live-memory-check', enforce: 'pre',
      resolveId(id) {
        if (id.includes('useScheduleStore')) return '\0identity'
        if (id.includes('usePromotionLastViewedDate')) return '\0week'
      },
      async load(id) {
        if (id === '\0identity') return `export default selector=>selector({userName:'MemoryCheck'})`
        if (id === '\0week') return `export default ()=>({date:'2026-10-19',ready:true,error:'',selectDate:()=>{}})`
        if (id.replaceAll('\\', '/').endsWith('/api/competitorMeetings.js')) {
          const source = await readFile(id, 'utf8')
          return source.replace('export function saveCompetitorMeeting(', 'function unusedProductionSave(') + '\nexport async function saveCompetitorMeeting(){window.simulatedSaves=(window.simulatedSaves||0)+1}\n'
        }
      },
      transform(code, id) {
        if (!baseline || !id.replaceAll('\\', '/').endsWith('/pages/CompetitorPage.jsx')) return
        return code.replace("activeView === 'schedule' ? buildCompetitorTimeline(rows, days.map(date => date.format('YYYY-MM-DD')), company) : new Map()", "buildCompetitorTimeline(rows, days.map(date => date.format('YYYY-MM-DD')), company)")
          .replace('onSaved={() => setTooltip(null)}', "onSaved={() => { setTooltip(null); setActiveView('meeting') }}")
      },
    }, react()], build: { write: false, minify: true, lib: { entry, formats: ['es'], fileName: 'check' } } })
    const output = (Array.isArray(built) ? built[0] : built).output
    const js = output.find(item => item.type === 'chunk' && item.isEntry).code
    const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n')
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    page.setDefaultTimeout(60000)
    const errors = [], reads = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.url().includes('firebasedatabase.app') && request.method() === 'GET') reads.push(request.url()) })
    await page.route('http://live-memory.local/**', route => route.fulfill(route.request().url().endsWith('/check.js') ? { contentType: 'application/javascript', body: js } : { contentType: 'text/html', body: `<!doctype html><style>${css}#root{height:95vh}</style><div id="root"></div><script type="module" src="/check.js"></script>` }))
    const cdp = await context.newCDPSession(page)
    const sample = async label => {
      await cdp.send('HeapProfiler.collectGarbage')
      const heap = await cdp.send('Runtime.getHeapUsage')
      const dom = await cdp.send('Memory.getDOMCounters')
      return { label, heapMiB: +(heap.usedSize / 1048576).toFixed(3), nodes: dom.nodes, listeners: dom.jsEventListeners }
    }
    await page.goto('http://live-memory.local/')
    await page.locator('.competitor-program').first().waitFor()
    const cards = await page.locator('.competitor-program').count()
    await page.locator('.competitor-toolbar-actions input[type=checkbox]').last().check()
    await page.locator('textarea').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('.competitor-meeting-panel')?.textContent.includes('비중 조회 중'))
    const samples = [await sample('schedule+input')]
    const beforeReads = reads.length
    await page.locator('textarea').first().fill('Memory test: simulated save only')
    await page.locator('.competitor-meeting-save').first().click()
    await page.waitForFunction(() => window.simulatedSaves === 1)
    await page.waitForTimeout(1200)
    assert.equal(await page.locator('.competitor-grid-scroll').count(), baseline ? 0 : 1)
    samples.push(await sample('after-save'))
    const saveReads = reads.length - beforeReads
    const tab = view => page.locator('.competitor-view-tabs button').nth(view)
    await tab(1).click()
    await page.locator('textarea').first().waitFor()
    await page.waitForFunction(() => !document.querySelector('.competitor-meeting-panel')?.textContent.includes('비중 조회 중'))
    samples.push(await sample('meeting'))
    for (let i = 0; i < 15; i++) {
      await tab(0).click()
      await page.locator('.competitor-program').first().waitFor()
      await tab(1).click()
      await page.locator('textarea').first().waitFor()
      await page.waitForFunction(() => !document.querySelector('.competitor-meeting-panel')?.textContent.includes('비중 조회 중'))
      if ([4, 9, 14].includes(i)) samples.push(await sample(`meeting-cycle-${i + 1}`))
    }
    assert.deepEqual(errors, [])
    assert.equal(await page.locator('[role=alert]').count(), 0)
    results.push({ version: baseline ? 'before' : 'after', cards, saveReads, samples })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
  await mkdir('artifacts', { recursive: true })
  await writeFile('artifacts/competitor-live-memory.json', JSON.stringify({ note: 'Live RTDB reads; simulated save acknowledgement; isolated production bundles; GC before samples', results }, null, 2))
} finally {
  await browser?.close()
  await unlink(entry)
}
