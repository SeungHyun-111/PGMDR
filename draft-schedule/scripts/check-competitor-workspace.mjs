import assert from 'node:assert/strict'
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { themes } from '../src/styles/theme.js'

const visual = process.argv.includes('--visual')
const captureLabel = process.argv.find(argument => argument.startsWith('--label='))?.slice(8) || 'current'

const entryPath = resolve(`.workspace-check-${process.pid}.jsx`)
const component = resolve('src/pages/CompetitorPage.jsx').replaceAll('\\', '/')
const rows = Array.from({ length: 24 }, (_, i) => ({
  id: String(i), date: '2026-10-19', hour: 8 + Math.floor(i / 2), minute: 0,
  org: i < 16 ? 'A' : 'B', brand: `Brand${i}`, productName: `Product ${i}`, simpleMin: 60,
  weightedMin: 10 + i, revenue: 1000 + i * 100,
}))
const fixtures = {
  store: `export default function useStore(selector){return selector({userName:'Tester'})}`,
  date: `export default function useDate(){return {date:'2026-10-19',ready:true,error:'',selectDate:()=>{}}}`,
  schedule: `export async function clearCompetitorScheduleCache(){} export async function fetchScheduleMonths(){return ['202610']} export async function fetchScheduleWeek(company,dates,signal,accept){const rows=${JSON.stringify(rows)};if(accept){for(const row of rows)accept({...row,date:'2026-10-12',weightedMin:row.weightedMin/2,revenue:row.revenue/2});return []}return rows}`,
  meetings: `export const organizationKey=value=>Array.from(value,c=>c.codePointAt(0).toString(16)).join('-');export function subscribeCompetitorMeetings(week,onData){onData({});return ()=>{}}export async function saveCompetitorMeeting(){throw Error('No production writes in workspace check')}`,
  shares: `export async function fetchMeetingShares(){return {current:{total:100,organizations:{A:100}},previous:{total:100,organizations:{A:100}}}}export function getWeeklyOrganizationShare(){return {current:100,difference:0}}`,
}
let browser
try {
  await writeFile(entryPath, `import React from 'react';import{createRoot}from'react-dom/client';import Page from ${JSON.stringify(component)};createRoot(document.getElementById('root')).render(React.createElement(Page));`)
  const result = await build({
    configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [{
      name: 'workspace-fixtures', enforce: 'pre',
      resolveId(id) {
        if (id.includes('useScheduleStore')) return '\0store'
        if (id.includes('usePromotionLastViewedDate')) return '\0date'
        if (id.includes('/api/competitorSchedule')) return '\0schedule'
        if (id.includes('/api/competitorMeetings')) return '\0meetings'
        if (id.includes('/api/competitorMeetingShares')) return '\0shares'
      },
      load(id) { if (id.startsWith('\0') && fixtures[id.slice(1)]) return fixtures[id.slice(1)] },
    }, react()],
    build: { write: false, minify: false, lib: { entry: entryPath, formats: ['es'], fileName: 'test' } },
  })
  const output = Array.isArray(result) ? result[0].output : result.output
  const script = output.find(item => item.type === 'chunk' && item.isEntry).code
  const css = await readFile('src/pages/CompetitorPage.css', 'utf8')
  const globalCss = await readFile('src/index.css', 'utf8')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => { if (errors.length < 5) errors.push(error.message) })
  await page.route('http://workspace-test.local/**', route => route.fulfill(
    route.request().url().endsWith('/test.js')
      ? { contentType: 'application/javascript', body: script }
      : { contentType: 'text/html', body: `<!doctype html><html><head><style>${globalCss}#root{height:95vh}${css}</style></head><body><div id="root"></div><script type="module" src="/test.js"></script></body></html>` },
  ))
  await page.goto('http://workspace-test.local/')
  await page.locator('.competitor-program').first().waitFor()
  await page.locator('.competitor-grid-scroll').evaluate(element => { element.scrollTop = 8 * 60 * 1.584 })
  const firstProgram = await page.locator('.competitor-program').first().boundingBox()
  const pointer = { x: firstProgram.x + 24, y: firstProgram.y + 20 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.locator('.competitor-program-tooltip').waitFor()
  assert.ok((await page.locator('.competitor-program-tooltip').boundingBox()).y >= pointer.y + 8)
  await page.mouse.move(pointer.x + 10, pointer.y + 10)
  await page.waitForFunction(y => document.querySelector('.competitor-program-tooltip')?.getBoundingClientRect().top >= y + 8, pointer.y + 10)
  await page.mouse.move(10, 10)
  if (visual) {
    await mkdir('artifacts/competitor-css', { recursive: true })
    for (const width of [1920, 1440, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator('.competitor-grid-scroll').evaluate(element => { element.scrollTop = 8 * 60 * 1.584 })
      await page.screenshot({ path: `artifacts/competitor-css/${captureLabel}-${width}.png` })
      console.log(JSON.stringify(await page.evaluate(() => {
        const groups = [...document.querySelectorAll('.competitor-toolbar>div')].map(element => ({ name: element.className, rect: element.getBoundingClientRect().toJSON() }))
        const overlaps = groups.flatMap((a, i) => groups.slice(i + 1).filter(b => Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 2 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 2).map(b => [a.name, b.name]))
        return { width: innerWidth, toolbarHeight: document.querySelector('.competitor-toolbar').getBoundingClientRect().height, overlaps, pageOverflow: document.documentElement.scrollWidth > innerWidth }
      })))
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  const originalPositions = await page.locator('.competitor-program').evaluateAll(elements => elements.map(element => [element.style.top, element.style.left, element.style.height]))
  await page.locator('.competitor-org-filter summary').click()
  await page.getByRole('listbox', { name: '조직명 다중 선택' }).selectOption(['A'])
  assert.equal(await page.locator('.competitor-program').count(), 24)
  assert.equal(await page.locator('.competitor-program.organization-hit').count(), 16)
  assert.equal(await page.locator('.competitor-program.organization-miss').count(), 8)
  assert.equal(await page.locator('.competitor-program.organization-miss').first().evaluate(element => getComputedStyle(element).opacity), '0.2')
  assert.deepEqual(await page.locator('.competitor-program').evaluateAll(elements => elements.map(element => [element.style.top, element.style.left, element.style.height])), originalPositions)
  await page.getByRole('searchbox').fill('Brand')
  assert.equal(await page.locator('.competitor-program.search-hit').count(), 16)
  assert.equal(await page.locator('.competitor-highlight-summary').getByText('16', { exact: true }).count(), 1)
  await page.getByRole('button', { name: '하이라이트 검색 지우기' }).click()
  if (visual) {
    await page.locator('.competitor-grid-scroll').evaluate(element => { element.scrollTop = 13 * 60 * 1.584 })
    await page.screenshot({ path: `artifacts/competitor-css/${captureLabel}-organization-highlight.png` })
  }
  await page.locator('.competitor-org-filter summary').click()
  await page.getByRole('listbox', { name: '조직명 다중 선택' }).selectOption(['A', 'B'])
  assert.equal(await page.locator('.competitor-program.organization-hit').count(), 24)
  await page.locator('.competitor-org-dropdown').getByRole('button', { name: '전체', exact: true }).click()
  assert.equal(await page.locator('.competitor-program.organization-miss').count(), 0)
  await page.locator('.competitor-org-filter summary').click()
  await page.getByRole('checkbox', { name: '회의자료 입력', exact: true }).check()
  await page.locator('textarea').first().waitFor()
  await page.locator('.competitor-brand-summary-trigger').click()
  const summary = page.getByRole('dialog', { name: '조직별 브랜드 요약' })
  await summary.getByRole('columnheader', { name: '전체 편성비중' }).waitFor()
  assert.equal(await summary.locator('tfoot th').innerText(), '계')
  assert.ok((await summary.locator('tfoot').innerText()).includes('280분'))
  assert.equal(await summary.locator('tbody small').first().evaluate(element => getComputedStyle(element).display), 'inline')
  await page.locator('.competitor-toolbar-actions').getByRole('button', { name: 'RTDB 갱신', exact: true }).click()
  await page.getByRole('dialog', { name: '경쟁사 RTDB 갱신' }).waitFor()
  assert.ok(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.competitor-refresh-overlay')).zIndex) > Number(getComputedStyle(document.querySelector('.competitor-brand-summary-panel')).zIndex)))
  await page.getByRole('dialog', { name: '경쟁사 RTDB 갱신' }).getByRole('button', { name: '닫기', exact: true }).click()
  if (visual) {
    await page.screenshot({ path: `artifacts/competitor-css/${captureLabel}-summary-meeting.png` })
    await page.evaluate(theme => { for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(key, value) }, themes.dark)
    assert.equal(await summary.locator('.brand-growth-positive').first().evaluate(element => getComputedStyle(element).color), 'rgb(245, 107, 107)')
    await page.screenshot({ path: `artifacts/competitor-css/${captureLabel}-dark.png` })
    await page.evaluate(theme => { for (const [key, value] of Object.entries(theme)) document.documentElement.style.setProperty(key, value) }, themes.light)
  }
  const before = await page.locator('.competitor-meeting-input-sidebar').boundingBox()
  await page.locator('textarea').first().fill('Draft while summary is open')
  assert.equal(await summary.count(), 1)
  const handle = await page.getByRole('separator').boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2, handle.y - 150, { steps: 6 })
  await page.mouse.up()
  const after = await page.locator('.competitor-meeting-input-sidebar').boundingBox()
  assert.ok(after.height > before.height + 60)
  await page.waitForFunction(() => {
    const popup = document.querySelector('.competitor-brand-summary-panel').getBoundingClientRect()
    const calendar = document.querySelector('.competitor-grid-scroll').getBoundingClientRect()
    const editor = document.querySelector('.competitor-meeting-input-sidebar').getBoundingClientRect()
    return popup.bottom <= calendar.bottom + 1 && popup.bottom < editor.top
  })
  await summary.locator('.competitor-brand-name').first().hover()
  await page.getByRole('tooltip').waitFor()
  assert.equal(await page.locator('.competitor-brand-broadcast-tooltip br').count(), 0)
  assert.equal(await page.locator('.competitor-brand-broadcast-tooltip td').first().evaluate(element => getComputedStyle(element).whiteSpace), 'nowrap')
  assert.ok(await page.evaluate(() => {
    const tooltip = document.querySelector('.competitor-brand-broadcast-tooltip').getBoundingClientRect()
    return tooltip.bottom <= document.querySelector('.competitor-grid-scroll').getBoundingClientRect().bottom + 1
  }))
  await page.locator('textarea').first().fill('Still editable after resizing')
  assert.equal(await summary.count(), 1)
  await page.setViewportSize({ width: 1280, height: 850 })
  await page.waitForFunction(() => {
    const popup = document.querySelector('.competitor-brand-summary-panel').getBoundingClientRect()
    const calendar = document.querySelector('.competitor-grid-scroll').getBoundingClientRect()
    return popup.bottom <= calendar.bottom + 1 && popup.right <= calendar.right + 1
  })
  assert.equal(await page.locator('textarea').first().inputValue(), 'Still editable after resizing')
  const savedHeight = await page.getByRole('separator').getAttribute('aria-valuenow')
  await page.reload()
  await page.getByRole('checkbox', { name: '회의자료 입력', exact: true }).check()
  assert.equal(await page.getByRole('separator').getAttribute('aria-valuenow'), savedHeight)
  assert.deepEqual(errors, [])
  console.log('PASS: summary totals, cached draggable height restored on reload, summary/tooltip avoid editor, typing keeps summary open, viewport resize preserves draft')
} finally {
  await browser?.close()
  await unlink(entryPath)
}
