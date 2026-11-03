export const SENSITIVITY_KEY = 'pgmdr-hand-cursor-sensitivity'
export const SENSITIVITY_HOLD_MS = 400
export const SENSITIVITY_CONFIRM_MS = 200
export const clampSensitivity = value => Math.max(.25, Math.min(3, Math.round(value * 20) / 20))
export function readSensitivity() {
  try { const value=Number(localStorage.getItem(SENSITIVITY_KEY)); return Number.isFinite(value)&&value>=.25&&value<=3?clampSensitivity(value):1 } catch { return 1 }
}
export function createSensitivityState(value=1) {
  return { mode:'idle',since:null,base:value,value,originY:null,confirmSince:null,lostSince:null,awaitRelease:false }
}
export function cancelSensitivity(state,saved) {
  Object.assign(state,createSensitivityState(saved),{awaitRelease:true})
}
export function updateSensitivity(state,hand,now,saved,mouseBusy=false) {
  const left=hand.active?hand.hands?.left:null,right=hand.active?hand.hands?.right:null
  const fist=left?.gesture==='Closed_Fist'&&(left.gestureScore??1)>=.7
  const open=!!left?.openPalm&&left.gesture!=='Closed_Fist'
  const info={leftState:!left?'missing':fist?'fist':open?'open':'uncertain',rightDetected:!!right}
  if(state.awaitRelease){
    if(!left||fist)return {mode:'idle',value:saved,...info}
    state.awaitRelease=false
  }
  if(state.mode==='idle'){
    if(!fist||mouseBusy){state.since=null;return {mode:'idle',value:saved,...info}}
    state.since??=now
    const progress=Math.min(100,Math.floor((now-state.since)/SENSITIVITY_HOLD_MS*100))
    if(progress<100)return {mode:'arming',value:saved,progress,...info}
    state.mode='editing';state.base=saved;state.value=saved;state.originY=right?.y??null
    return {mode:'editing',value:saved,event:'opened',...info}
  }
  // Opening or losing the left switch freezes the value BEFORE consuming any
  // right-hand motion, so releasing the switch cannot alter the chosen value.
  if(open){
    state.lostSince=null;state.originY=null;state.confirmSince??=now
    const confirmProgress=Math.min(100,Math.floor((now-state.confirmSince)/SENSITIVITY_CONFIRM_MS*100))
    if(confirmProgress>=100){const value=state.value;cancelSensitivity(state,value);return {mode:'idle',value,event:'applied',...info}}
    return {mode:'editing',value:state.value,confirming:true,confirmProgress,...info}
  }
  state.confirmSince=null
  if(!fist){
    state.originY=null;state.lostSince??=now
    if(now-state.lostSince>=5000){cancelSensitivity(state,saved);return {mode:'idle',value:saved,event:'cancelled',...info}}
    return {mode:'editing',value:state.value,trackingLost:true,...info}
  }
  state.lostSince=null
  if(!right){state.originY=null;return {mode:'editing',value:state.value,...info}}
  // Reanchor after either hand returns instead of jumping to its new location.
  if(state.originY===null){state.originY=right.y;state.base=state.value}
  state.value=clampSensitivity(state.base+(state.originY-right.y)*7)
  return {mode:'editing',value:state.value,...info}
}
