import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { create } from 'zustand'
import { createPerformanceCache } from '../src/utils/performanceQuery.js'

test('explicit refresh updates an already subscribed view even without a metadata event', async () => {
  let serverRows = {}
  let requests = 0
  const cache = createPerformanceCache(async () => {
    requests += 1
    return serverRows
  })
  const context = vm.createContext({})
  const dependencies = {
    zustand: { create },
    '../api/firebase': { db: {}, ref: () => {}, onValue: () => () => {} },
    '../api/performanceQuery': { performanceQueryCache: cache },
  }
  const module = new vm.SourceTextModule(await readFile(new URL('../src/store/usePerformanceQueryStore.js', import.meta.url), 'utf8'), { context })
  await module.link(specifier => {
    const exports = dependencies[specifier]
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  const store = module.namespace.default
  const date = '2026-10-20'
  let visibleRows = await cache.load('date', date)
  assert.equal(Object.keys(visibleRows).length, 0)
  let refreshRequest
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.revision !== previous.revision) {
      refreshRequest = cache.load('date', date).then(rows => { visibleRows = rows })
    }
  })
  try {
    serverRows = { broadcast: { broadcastDate: date } }
    module.namespace.refreshPerformanceQueries()
    await refreshRequest
    assert.equal(visibleRows, serverRows)
    assert.equal(requests, 2)
    // A second refresh must work even if updatedAt has not changed.
    module.namespace.refreshPerformanceQueries()
    await refreshRequest
    assert.equal(requests, 3)
  } finally {
    unsubscribe()
  }
})
