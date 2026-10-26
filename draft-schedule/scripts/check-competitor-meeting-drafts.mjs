import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'

const entryPath = resolve(`.meeting-draft-check-${process.pid}.jsx`)
const component = resolve('src/components/common/CompetitorMeetingNotes.jsx').replaceAll('\\', '/')
const fixtures = {
  meetings: `
    export const organizationKey = name => Array.from(name, c => c.codePointAt(0).toString(16)).join('-');
    window.saveCalls = []; window.listeners = new Set();
    window.testNotes = {
      41: { organization: 'A', channels: { SSG: { content: 'remote SSG' }, K: { content: 'remote K' } } },
      42: { organization: 'B', channels: {} }
    };
    export function subscribeCompetitorMeetings(week, onData) {
      window.listeners.add(onData); onData(window.testNotes);
      return () => window.listeners.delete(onData);
    }
    export async function saveCompetitorMeeting(week, org, company, content, user) {
      if (window.failSave) throw Error('test save failure');
      window.saveCalls.push({ week, org, company, content, user });
      window.testNotes[organizationKey(org)].channels[company] = { content, updatedAt: Date.now(), updatedBy: user };
      for (const fn of window.listeners) fn({ ...window.testNotes });
    }
  `,
  shares: `
    export async function fetchMeetingShares() {
      return { current: { total: 100, organizations: { A: 60, B: 40 } }, previous: { total: 100, organizations: { A: 50, B: 50 } } };
    }
    export function getWeeklyOrganizationShare(summary, org) {
      return { current: summary.current.organizations[org], difference: summary.current.organizations[org] - summary.previous.organizations[org] };
    }
  `,
}
const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import Notes from ${JSON.stringify(component)};
  const root = createRoot(document.getElementById('root'));
  window.showNotes = draftMode => root.render(React.createElement(Notes, {
    key: String(draftMode), week: '2026-10-19', organizations: ['A', 'B'], userName: 'Tester', draftMode,
    onSaved: () => { window.navigated = true; window.showNotes(false); }
  }));
  window.showNotes(true);
`

let browser
try {
  await writeFile(entryPath, entry)
  const result = await build({
    configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [{
      name: 'meeting-test-fixtures',
      enforce: 'pre',
      resolveId(id) {
        if (id.includes('competitorMeetings')) return '\0meetings'
        if (id.includes('competitorMeetingShares')) return '\0shares'
      },
      load(id) {
        if (id === '\0meetings') return fixtures.meetings
        if (id === '\0shares') return fixtures.shares
      },
    }, react()],
    build: { write: false, minify: false, lib: { entry: entryPath, formats: ['es'], fileName: 'test' } },
  })
  const output = Array.isArray(result) ? result[0].output : result.output
  const script = output.find(item => item.type === 'chunk' && item.isEntry).code
  const css = await readFile('src/pages/CompetitorPage.css', 'utf8')
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  await page.route('http://draft-test.local/**', route => route.fulfill(
    route.request().url().endsWith('/test.js')
      ? { contentType: 'application/javascript', body: script }
      : { contentType: 'text/html', body: `<style>:root{--bg:#fff;--bg2:#fff;--text:#111;--text3:#666;--border:#ddd;--accent:#555}#root{height:900px;display:flex}${css}</style><div id="root"></div><script type="module" src="/test.js"></script>` },
  ))
  const errors = []
  page.on('pageerror', error => { if (errors.length < 5) { errors.push(error.message); console.error(error.message) } })
  await page.goto('http://draft-test.local/')
  await page.locator('textarea').first().waitFor()
  assert.equal(await page.locator('textarea').count(), 2)
  await page.locator('select').selectOption('B')
  await page.evaluate(() => window.showNotes(false))
  await page.waitForFunction(() => !document.querySelector('select'))
  await page.evaluate(() => window.showNotes(true))
  await page.locator('select').waitFor()
  assert.equal(await page.locator('select').inputValue(), 'B')
  await page.reload()
  await page.locator('select').waitFor()
  assert.equal(await page.locator('select').inputValue(), 'B')
  await page.locator('select').selectOption('A')
  await page.locator('textarea').nth(0).fill('draft SSG')
  await page.locator('textarea').nth(1).fill('draft K')
  await page.locator('select').selectOption('B')
  await page.waitForTimeout(800)
  assert.equal(await page.evaluate(() => window.saveCalls.length), 0)
  await page.locator('select').selectOption('A')
  assert.equal(await page.locator('textarea').nth(0).inputValue(), 'draft SSG')
  assert.equal(await page.locator('textarea').nth(1).inputValue(), 'draft K')
  await page.reload()
  await page.locator('textarea').first().waitFor()
  assert.equal(await page.locator('textarea').nth(0).inputValue(), 'draft SSG')
  assert.equal(await page.locator('textarea').nth(1).inputValue(), 'draft K')
  assert.equal(await page.evaluate(() => window.saveCalls.length), 0)
  await page.evaluate(() => { window.failSave = true })
  await page.locator('.competitor-meeting-save').first().click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.evaluate(() => !!window.navigated), false)
  assert.equal(await page.locator('textarea').nth(0).inputValue(), 'draft SSG')
  await page.evaluate(() => { window.failSave = false })
  await page.locator('.competitor-meeting-save').first().click()
  await page.waitForFunction(() => window.navigated === true)
  assert.equal(await page.evaluate(() => window.saveCalls.length), 1)
  assert.equal(await page.evaluate(() => window.saveCalls[0].content), 'draft SSG')
  assert.equal(await page.evaluate(() => window.saveCalls[0].company), 'SSG')
  assert.equal(await page.locator('select').count(), 0)
  assert.equal(await page.locator('textarea').nth(0).inputValue(), 'draft SSG')
  assert.equal(await page.locator('textarea').nth(1).inputValue(), 'remote K')
  const drafts = await page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('pgmdr:competitor-meeting-draft:')).map(key => localStorage.getItem(key)))
  assert.equal(drafts.length, 1)
  assert.equal(JSON.parse(drafts[0]), 'draft K')
  assert.deepEqual(errors, [])
  console.log('PASS: draft restore, no automatic writes, save failure recovery, explicit save/navigation, other channel draft preserved')
} finally {
  await browser?.close()
  await unlink(entryPath)
}
