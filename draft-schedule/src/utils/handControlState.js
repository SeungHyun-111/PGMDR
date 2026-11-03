export const PALM_HOLD_MS = 5000
export const IDLE_MS = 60000

export function createHandSession() {
  return { active: false, palmSince: null, lastPalmAt: null, lastActivity: 0, previous: null }
}

export function advanceHandSession(state, sample, now) {
  if (!state.active) {
    if (sample?.openPalm) {
      if (state.lastPalmAt !== null && now - state.lastPalmAt > 450) state.palmSince = null
      state.palmSince ??= now
      state.lastPalmAt = now
    } else if (state.lastPalmAt === null || now - state.lastPalmAt > 450) {
      state.palmSince = null
      state.lastPalmAt = null
    }
    if (sample?.openPalm && state.palmSince !== null && now - state.palmSince >= PALM_HOLD_MS) {
      state.active = true
      state.lastActivity = now
      state.previous = sample
      state.palmSince = null
    }
  } else {
    // Compare with the last meaningful pose so slow motion counts, jitter does not.
    if (sample && (!state.previous || Math.hypot(sample.x - state.previous.x, sample.y - state.previous.y) > .025 || Math.hypot((sample.pointerX ?? 0) - (state.previous.pointerX ?? 0), (sample.pointerY ?? 0) - (state.previous.pointerY ?? 0)) > .025 || sample.gesture !== state.previous.gesture || Math.abs(sample.pinch - state.previous.pinch) > .08)) {
      state.lastActivity = now
      state.previous = sample
    }
    if (now - state.lastActivity >= IDLE_MS) Object.assign(state, createHandSession())
  }
  return {
    active: state.active,
    countdown: state.palmSince === null ? null : Math.max(1, Math.ceil((PALM_HOLD_MS - now + state.palmSince) / 1000)),
    remaining: state.active ? Math.max(0, Math.ceil((IDLE_MS - now + state.lastActivity) / 1000)) : null,
  }
}
