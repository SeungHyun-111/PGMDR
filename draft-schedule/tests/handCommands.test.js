import test from 'node:test'
import assert from 'node:assert/strict'
import { createCommandState, updateHandCommands } from '../src/utils/handCommands.js'


const palm = (x, extra = {}) => ({ active: true, openPalm: true, gesture: 'Open_Palm', pressed: false, x, y: 0, ...extra })
const step = (state, x, time, extra) => updateHandCommands(state, palm(x, extra), time)

test('one continuous sweep navigates only once', () => {
  const state = createCommandState()
  step(state, 0, 0)
  assert.deepEqual(step(state, .34, 150), { type: 'navigate', direction: 1 })
  for (let time = 200; time <= 1400; time += 50) assert.equal(step(state, .34 + time * .0004, time), null)
})

test('return to center rearms immediately without navigating on the return', () => {
  const state = createCommandState()
  step(state, 0, 0)
  assert.equal(step(state, .34, 150)?.direction, 1)
  assert.equal(step(state, .05, 220), null)
  assert.equal(step(state, .45, 370)?.direction, 1)
})

test('a stable 180ms pose rearms; a following swipe can reverse direction', () => {
  const state = createCommandState()
  step(state, 0, 0)
  step(state, .34, 150)
  assert.equal(step(state, .35, 250), null)
  assert.equal(step(state, .34, 330), null)
  assert.equal(step(state, -.01, 480)?.direction, -1)
})

test('brief classifier uncertainty does not reset the lock', () => {
  const state = createCommandState()
  step(state, 0, 0); step(state, .34, 150)
  step(state, .4, 180, { openPalm: false, gesture: 'None' })
  assert.equal(step(state, .7, 250), null)
})

test('pinch does not issue clicks from the navigation classifier', () => {
  const state = createCommandState()
  const point = { openPalm: false, gesture: 'Pointing_Up' }
  step(state, 0, 0, point); step(state, 0, 220, point)
  assert.equal(step(state, 0, 250, { ...point, pressed: true }), null)
  step(state, 0, 300, point); step(state, 0, 520, point)
  assert.equal(step(state, 0, 550, { ...point, pressed: true }), null)
})

test('small curved and diagonal swipes work in both directions', () => {
  for (const direction of [-1, 1]) {
    const state = createCommandState()
    step(state, 0, 0)
    step(state, direction * .04, 60, { y: .12 })
    step(state, direction * .08, 120, { y: -.07 })
    assert.equal(step(state, direction * .13, 190, { y: .25 })?.direction, direction)
  }
})

test('finger flick works without moving the palm', () => {
  const state = createCommandState()
  const points = x => Array.from({ length: 21 }, () => ({ x, y: .5 }))
  step(state, 0, 0, { points: points(.5) })
  assert.equal(step(state, 0, 150, { points: points(.435) })?.direction, 1)
})

test('small jitter and mainly vertical motion do not change menus', () => {
  const state = createCommandState()
  step(state, 0, 0)
  assert.equal(step(state, .03, 120, { y: .02 }), null)
  assert.equal(step(state, .13, 200, { y: .5 }), null)
})
