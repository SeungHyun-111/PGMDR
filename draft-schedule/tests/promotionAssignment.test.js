import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { buildPromotionAssignmentUpdates } from '../src/utils/promotionAssignment.js'

test('same names skip writes; modern and legacy paths write names atomically', () => {
  assert.equal(buildPromotionAssignmentUpdates({ entryId: 'a', sourcePath: 'performanceEntries', name: '행사', currentName: '행사' }), null)
  for (const sourcePath of ['performanceEntries', 'performanceRows']) {
    assert.deepEqual(buildPromotionAssignmentUpdates({ entryId: 'a', sourcePath, name: '행사', currentName: '' }), {
      [`${sourcePath}/a/promotionName`]: '행사', 'performancePromotionNames/a': '행사',
    })
  }
  assert.deepEqual(buildPromotionAssignmentUpdates({ entryId: 'a', sourcePath: 'performanceEntries', name: '', currentName: '행사' }), {
    'performanceEntries/a/promotionName': '', 'performancePromotionNames/a': '',
  })
  assert.throws(() => buildPromotionAssignmentUpdates({ entryId: 'a/b', sourcePath: 'performanceEntries', name: '행사', currentName: '' }))
  assert.throws(() => buildPromotionAssignmentUpdates({ entryId: 'a', sourcePath: undefined, name: '행사', currentName: '' }))
})

test('one small subscription, no save-time reads, realtime updates, failures and cleanup', async () => {
  const writes = []
  let listener
  let listenerError
  let subscriptions = 0
  let stops = 0
  let rejectWrite = false
  const context = vm.createContext({})
  const firebase = new vm.SyntheticModule(['db', 'ref', 'onValue', 'update'], function () {
    this.setExport('db', {})
    this.setExport('ref', (_db, path = '') => path)
    this.setExport('onValue', (path, next, error) => {
      assert.equal(path, 'performancePromotionNames')
      subscriptions += 1
      listener = next
      listenerError = error
      return () => { stops += 1 }
    })
    this.setExport('update', async (path, updates) => {
      assert.equal(path, '')
      if (rejectWrite) throw new Error('permission denied')
      writes.push(updates)
      const [key, name] = Object.entries(updates).find(([key]) => key.startsWith('performancePromotionNames/'))
      const id = key.slice('performancePromotionNames/'.length)
      listener({ val: () => ({ ...store.default.getState().names, [id]: name }) })
    })
  }, { context })
  const zustand = new vm.SyntheticModule(['create'], function () {
    this.setExport('create', initialize => {
      let state = initialize()
      const hook = selector => selector(state)
      hook.getState = () => state
      hook.setState = patch => { state = { ...state, ...patch } }
      return hook
    })
  }, { context })
  const utils = new vm.SourceTextModule(await readFile(new URL('../src/utils/promotionAssignment.js', import.meta.url), 'utf8'), { context })
  await utils.link(() => { throw new Error('Unexpected utility import') })
  const module = new vm.SourceTextModule(await readFile(new URL('../src/store/usePromotionAssignmentStore.js', import.meta.url), 'utf8'), { context })
  await module.link(specifier => specifier === 'zustand' ? zustand : specifier.includes('api/firebase') ? firebase : utils)
  await module.evaluate()
  const store = module.namespace
  const first = store.subscribePromotionAssignments()
  const second = store.subscribePromotionAssignments()
  assert.equal(subscriptions, 1)
  await assert.rejects(store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '행사' }))
  listener({ val: () => ({}) })
  await store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '기존', fallbackName: '기존' })
  assert.equal(writes.length, 0)
  await store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '행사' })
  assert.equal(writes.length, 1)
  assert.equal(store.default.getState().names.a, '행사')
  await store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '행사' })
  assert.equal(writes.length, 1)
  // A remote user's update is visible without touching performanceRows.
  listener({ val: () => ({ a: '다른 행사' }) })
  assert.equal(store.default.getState().names.a, '다른 행사')
  await store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '' })
  assert.equal(store.default.getState().names.a, '')
  rejectWrite = true
  await assert.rejects(store.savePromotionAssignment({ entryId: 'a', sourcePath: 'performanceEntries', name: '실패' }))
  assert.equal(store.default.getState().names.a, '')
  listenerError(new Error('offline'))
  assert.equal(store.default.getState().ready, false)
  assert.ok(store.default.getState().error)
  first()
  assert.equal(stops, 0)
  second()
  assert.equal(stops, 1)
})
