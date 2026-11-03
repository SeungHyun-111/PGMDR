export const CURSOR_TUNING_KEY = 'pgmdr-cursor-tuning-v1'
export const DEFAULT_CURSOR_TUNING = { deadZone:.002, minCutoff:1.2, beta:7, maxDelta:45, pinchEnter:.45, pinchExit:.65, activeLeft:.15, activeRight:.85, activeTop:.15, activeBottom:.85 }
const finite = (value,fallback,min,max) => Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback
export function normalizeCursorTuning(value={}) {
  const pinchEnter=finite(value.pinchEnter,.45,.2,.65)
  return {...DEFAULT_CURSOR_TUNING,pinchEnter,pinchExit:Math.max(pinchEnter+.1,finite(value.pinchExit,.65,.4,.9)),
    deadZone:finite(value.deadZone,.002,0,.012),minCutoff:finite(value.minCutoff,1.2,.3,4),beta:finite(value.beta,7,0,15),maxDelta:finite(value.maxDelta,45,15,90),
    activeLeft:finite(value.activeLeft,.15,0,.4),activeRight:finite(value.activeRight,.85,.6,1),activeTop:finite(value.activeTop,.15,0,.4),activeBottom:finite(value.activeBottom,.85,.6,1)}
}
export function readCursorTuning(){try{return normalizeCursorTuning(JSON.parse(localStorage.getItem(CURSOR_TUNING_KEY)||'{}'))}catch{return {...DEFAULT_CURSOR_TUNING}}}
