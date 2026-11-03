export function createCommandState() {
  return { mode: '', since: 0, anchor: null, previousY: null, swipe: null, swipeLock: null }
}

export function updateHandCommands(state, hand, now) {
  if (!hand.active) { Object.assign(state, createCommandState()); return null }
  const mode = hand.pressed ? 'pinch' : hand.openPalm ? 'palm' : hand.gesture === 'Victory' ? 'scroll' : hand.gesture === 'Pointing_Up' ? 'point' : 'rest'
  if (mode !== 'palm' && mode !== 'rest') state.swipeLock = null
  // Preserve the swipe origin across brief classifier uncertainty, not across
  // an explicit point, pinch, scroll, or loss of tracking.
  if (mode === 'palm') {
    // The index fingertip responds to a small finger/wrist flick, even if the
    // palm stays still. Fall back to palm coordinates for non-landmark inputs.
    const sx = hand.points ? 1 - hand.points[8].x * 2 : hand.x
    const sy = hand.points ? hand.points[8].y * 2 - 1 : hand.y
    if (state.swipeLock) {
      const lock = state.swipeLock
      const centered = Math.abs(sx - lock.startX) < .08 && lock.direction * (lock.endX - sx) > .08
      if (Math.hypot(sx - lock.stillX, sy - lock.stillY) > .025) {
        lock.stillX = sx; lock.stillY = sy; lock.stillSince = now
      }
      // Returning to center only rearms; it never counts as a reverse swipe.
      // A short stable pose also rearms, without a fixed post-action cooldown.
      if (centered || now - lock.stillSince >= 180) {
        state.swipeLock = null
        state.swipe = { x: sx, y: sy, started: now, lastPalm: now }
      }
      return null
    }
    if (!state.swipe || now - state.swipe.lastPalm > 300 || now - state.swipe.started > 1200) {
      state.swipe = { x: sx, y: sy, started: now, lastPalm: now }
    }
    state.swipe.lastPalm = now
    const dx = sx - state.swipe.x, dy = sy - state.swipe.y
    if (now - state.swipe.started >= 100 && Math.abs(dx) >= .12 && Math.abs(dx) > Math.abs(dy) * .4) {
      state.swipeLock = { direction: dx > 0 ? 1 : -1, startX: state.swipe.x, endX: sx, stillX: sx, stillY: sy, stillSince: now }
      state.swipe = null
      return { type: 'navigate', direction: dx > 0 ? 1 : -1 }
    }
  } else if (mode !== 'rest' || (state.swipe && now - state.swipe.lastPalm > 300)) state.swipe = null
  if (mode !== state.mode) {
    state.mode = mode; state.since = now; state.anchor = { x: hand.x, y: hand.y }; state.previousY = hand.y
  }
  if (mode === 'scroll') {
    const delta = hand.y - state.previousY
    if (now - state.since >= 150 && Math.abs(delta) > .008) { state.previousY = hand.y; return { type: 'scroll', delta } }
  }
  return null
}
