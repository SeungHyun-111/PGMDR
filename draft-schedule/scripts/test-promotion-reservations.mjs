import assert from 'node:assert/strict'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const firebaseMock = `
const data = {
  global: { promotions: {
    internal: { name: '내부', startDate: '2026-10-01', endDate: '2026-10-31' },
    special: { name: '스패페', startDate: '2026-10-01', endDate: '2026-10-31' }
  } },
  performanceMeta: { latestDate: '2026-10-20', updatedAt: 1 },
  performanceEntries: { '202610201031_item': { broadcastDate: '2026-10-20', broadcastTime: '10:31', broadcastTimestamp: 202610201031, pgmCodeName: '상품A', perfKey: '상품A', promotionName: '내부' } },
  performancePromotionNames: { '202610201031_item': '내부' }
};
const listeners = new Map();
const read = path => path.split('/').filter(Boolean).reduce((v, key) => v?.[key], data) ?? null;
const snapshot = path => ({ val: () => structuredClone(read(path)), exists: () => read(path) !== null });
function write(path, value) {
  const keys = path.split('/'); const key = keys.pop();
  let node = data; for (const part of keys) node = node[part] ||= {};
  if (value === null) delete node[key]; else node[key] = value;
}
function emit() { for (const [path, callbacks] of listeners) for (const callback of callbacks) callback(snapshot(path)); }
export const db = {};
export const ref = (_db, path = '') => path;
export function onValue(path, callback) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(callback); queueMicrotask(() => callback(snapshot(path)));
  return () => listeners.get(path).delete(callback);
}
export const get = async path => snapshot(typeof path === 'object' ? path.path : path);
export async function update(root, updates) { for (const [path, value] of Object.entries(updates)) write([root, path].filter(Boolean).join('/'), value); emit(); }
export async function set(path, value) { write(path, value); emit(); }
export async function runTransaction(path, fn) {
  // Model Firebase's first callback before the server value is cached.
  if (fn(null) === undefined) return { committed: false, snapshot: snapshot(path) };
  const value = fn(read(path));
  if (value === undefined) return { committed: false, snapshot: snapshot(path) };
  write(path, value); emit(); return { committed: true, snapshot: snapshot(path) };
}
export const query = path => ({ path });
export const orderByKey = () => {};
export const limitToLast = () => {};
export const startAt = () => {};
export const endAt = () => {};
export const push = path => path + '/new';
export const off = () => {};
export const onDisconnect = () => ({ remove() {} });
window.__promotionData = data;
`
const server = await createServer({
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react-dom', 'zustand'] },
  configFile: false, plugins: [react(), {
    name: 'isolated-promotion-fixtures',
    load(id) {
      const path = id.replaceAll('\\', '/')
      if (path.endsWith('/src/api/firebase.js')) return process.env.PGM_VISUAL_DATA
        ? firebaseMock.replace(/const data = [\s\S]*?const listeners =/, `const data = ${fs.readFileSync(process.env.PGM_VISUAL_DATA, 'utf8').replace(/^\uFEFF/, '')};\nconst listeners =`)
        : firebaseMock
      if (path.endsWith('/src/store/useScheduleStore.js')) return `const state = { userName: '검증' }; export default selector => selector(state);`
      if (path.endsWith('/src/hooks/useCultureCodeMaster.js')) return `export default () => ({ codes: [{ id: 'a', code: '상품A', searchText: '상품a', category: '' }], loaded: true, error: '', refresh: async () => 1 });`
      if (id === '\0promotion-test.jsx') return `import React from 'react'; import { createRoot } from 'react-dom/client'; import PromotionPage from '/src/pages/PromotionPage.jsx'; createRoot(document.getElementById('root')).render(React.createElement(PromotionPage));`
    },
    resolveId(id) { if (id === '/__promotion-entry.jsx') return '\0promotion-test.jsx' },
    configureServer(server) {
      server.middlewares.use('/__promotion-test', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end(`<html><head><style>:root { --bg:#fff; --bg2:#f8fafc; --bg3:#eee; --border:#ddd; --text:#222; --text3:#666; --accent:#1468c5; --red:#c22; } body { font:14px sans-serif; }</style></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true; import('/__promotion-entry.jsx');</script></body></html>`)
      })
    },
  }], server: { host: '127.0.0.1', port: 0 },
})
let browser
try {
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()) })
  await page.route('https://**/*.firebasedatabase.app/**', async route => {
    const url = route.request().url()
    const body = url.includes('cultureCodeMaster') ? { a: { code: '상품A' } } : await page.evaluate(() => window.__promotionData.performanceEntries)
    await route.fulfill({ json: body })
  })
  await page.goto(`http://127.0.0.1:${port}/__promotion-test`)
  await page.addStyleTag({ content: 'html, body, #root { height: 100%; margin: 0; } * { box-sizing: border-box; }' })
  await page.getByRole('tab', { name: '프로모션 PGM 선정', exact: true }).click()
  const selection = page.locator('#promotion-pgmSelection-panel')
  if (process.env.PGM_VISUAL_DATA) {
    await page.evaluate(async () => { const { applyTheme } = await import('/src/styles/theme.js'); applyTheme('light') })
    await page.locator('#promotion-pgm-selection').selectOption('-P4HKGoeh44v8v0BOq9C')
    await selection.locator('.promotion-performance-table tbody tr').first().waitFor()
    await page.screenshot({ path: path.join(process.env.TEMP, `pgmdr-selection-${process.env.PGM_VISUAL_LABEL || 'preview'}.png`) })
    await selection.getByRole('tab', { name: '예약', exact: true }).click()
    await selection.getByRole('cell', { name: '[흥국생명]암보험', exact: true }).first().waitFor()
    await page.screenshot({ path: path.join(process.env.TEMP, `pgmdr-reservations-${process.env.PGM_VISUAL_LABEL || 'preview'}.png`) })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.screenshot({ path: path.join(process.env.TEMP, `pgmdr-reservations-1280-${process.env.PGM_VISUAL_LABEL || 'preview'}.png`) })
    await page.evaluate(async () => { const { applyTheme } = await import('/src/styles/theme.js'); applyTheme('dark') })
    await page.addStyleTag({ content: 'body { background: var(--bg); color: var(--text); }' })
    await page.screenshot({ path: path.join(process.env.TEMP, `pgmdr-reservations-dark-${process.env.PGM_VISUAL_LABEL || 'preview'}.png`) })
    await selection.getByRole('tab', { name: '실적 선정', exact: true }).click()
    await page.screenshot({ path: path.join(process.env.TEMP, `pgmdr-selection-dark-${process.env.PGM_VISUAL_LABEL || 'preview'}.png`) })
    console.log('Visual previews saved with production data in an isolated browser; production writes disabled.')
    await browser.close()
    await server.close()
    process.exit(0)
  }
  await selection.getByRole('tab', { name: '예약', exact: true }).click()
  assert.equal(await selection.getByRole('heading', { name: '방송 예약 입력' }).isVisible(), true)
  assert.equal(await selection.getByLabel('방송일시', { exact: true }).isDisabled(), true)
  assert.equal(await selection.getByRole('combobox', { name: '예약 편성코드명', exact: true }).isDisabled(), true)
  await page.locator('#promotion-pgm-selection').selectOption('internal')
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport)
    for (const control of [selection.getByLabel('방송일시', { exact: true }), selection.getByRole('combobox', { name: '예약 편성코드명', exact: true }), selection.getByRole('button', { name: '예약 등록' })]) {
      const visible = await control.evaluate(element => {
        const box = element.getBoundingClientRect()
        if (box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth) return false
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (['hidden', 'auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) {
            const clip = parent.getBoundingClientRect()
            if (box.top < clip.top || box.bottom > clip.bottom) return false
          }
        }
        return true
      })
      assert.equal(visible, true, 'reservation controls must remain visible within the fixed-height panel')
    }
  }
  await selection.getByRole('tab', { name: '실적 선정', exact: true }).click()
  await selection.getByRole('button', { name: /상품A 내부 해제$/ }).waitFor()
  assert.equal(await selection.getByRole('button', { name: /상품A 내부 해제$/ }).getAttribute('aria-pressed'), 'true')
  await page.locator('#promotion-pgm-selection').selectOption('special')
  assert.equal(await selection.locator('.promotion-assignment-action input[type="checkbox"]').count(), 0)
  assert.equal(await selection.locator('.promotion-other-names').textContent(), '내부')
  await selection.getByRole('button', { name: /상품A 스패페 적용$/ }).click()
  await page.waitForFunction(() => window.__promotionData.performancePromotionIds['202610201031_item'].special === true)
  await selection.getByRole('button', { name: /상품A 스패페 해제$/ }).click()
  await page.waitForFunction(() => !window.__promotionData.performancePromotionIds['202610201031_item'].special)
  assert.equal(await selection.locator('.promotion-other-names').textContent(), '내부')
  await page.locator('#promotion-pgm-selection').selectOption('special')
  await selection.getByRole('tab', { name: '예약', exact: true }).click()
  assert.equal(await selection.locator('input[type="datetime-local"]').count(), 0)
  await selection.getByLabel('방송일시', { exact: true }).fill('10/20 1031')
  await selection.getByRole('combobox', { name: '예약 편성코드명', exact: true }).fill('없는상품')
  await selection.getByRole('button', { name: '예약 등록' }).click()
  assert.equal(await selection.getByText('1행: RTDB에 등록된 편성코드를 선택해주세요.', { exact: true }).isVisible(), true)
  await selection.getByRole('combobox', { name: '예약 편성코드명', exact: true }).fill('상품A')
  await page.getByRole('option').filter({ hasText: '상품A' }).click()
  await selection.getByRole('button', { name: '예약 등록' }).click()
  await selection.getByRole('cell', { name: '적용', exact: true }).waitFor()
  assert.equal(await selection.getByRole('columnheader', { name: '입력 확인', exact: true }).count(), 0)
  assert.equal(await selection.getByRole('columnheader', { name: '프로모션명', exact: true }).count(), 2)
  const applied = await page.evaluate(() => window.__promotionData.performancePromotionIds['202610201031_item'])
  assert.equal(applied.internal, true)
  assert.equal(applied.special, true)
  const dateInput = selection.getByLabel('방송일시', { exact: true })
  await dateInput.evaluate(element => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', '10/20\t10:32\t상품A\n10/20\t10:33\t상품A')
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
  })
  assert.equal(await selection.getByRole('combobox', { name: '2행 예약 편성코드명', exact: true }).inputValue(), '상품A')
  await selection.getByRole('button', { name: '예약 등록' }).click()
  await page.waitForFunction(() => Object.keys(window.__promotionData.promotionReservations).length === 3)
  const pendingRow = selection.locator('tr').filter({ hasText: '2026-10-20 10:32' })
  await pendingRow.getByRole('button', { name: '예약 수정', exact: true }).click()
  await selection.getByRole('textbox', { name: '예약 수정 방송일시', exact: true }).fill('10/20 1034')
  await selection.getByRole('button', { name: '수정 저장', exact: true }).click()
  const changedRow = selection.locator('tr').filter({ hasText: '2026-10-20 10:34' })
  await changedRow.waitFor()
  assert.equal(await pendingRow.count(), 0)
  await changedRow.getByRole('button', { name: '취소', exact: true }).click()
  await changedRow.getByRole('cell', { name: '미적용 · 예약 취소', exact: true }).waitFor()
  await page.evaluate(async () => {
    const { db, ref, update } = await import('/src/api/firebase.js')
    await update(ref(db), { 'performancePromotionIds/202610201031_item/special': null })
  })
  const originallyAppliedRow = selection.locator('tr').filter({ hasText: '2026-10-20 10:31' })
  await originallyAppliedRow.getByRole('cell', { name: '미적용', exact: true }).waitFor()
  await page.evaluate(async () => {
    const { db, ref, update } = await import('/src/api/firebase.js')
    await update(ref(db), { 'performancePromotionIds/202610201031_item/special': true })
  })
  await selection.getByRole('tab', { name: '실적 선정', exact: true }).click()
  assert.equal(await selection.getByRole('button', { name: /상품A 스패페 해제$/ }).getAttribute('aria-pressed'), 'true')
  assert.equal(await selection.locator('.promotion-other-names').textContent(), '내부')
  assert.deepEqual(errors, [])
  console.log('PASS: legacy migration, multiple selection/removal, strict RTDB code validation, reservation application and preserved assignments')
} finally {
  await browser?.close()
  await server.close()
}
