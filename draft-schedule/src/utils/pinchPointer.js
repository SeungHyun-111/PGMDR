export function createPinchPointer(){return {mode:'free',previousPinch:2,palm:null,resumeSince:null}}
export function createPinchPress(){return {pressed:false,pending:null,since:null,source:null}}
export function updatePinchPress(state,ratio,now,active,source){
  if(!active||source!==state.source){Object.assign(state,createPinchPress(),{source});if(!active)return false}
  const wanted=state.pressed?ratio<.55:ratio<.38
  if(wanted===state.pressed){state.pending=null;state.since=null;return state.pressed}
  if(state.pending!==wanted){state.pending=wanted;state.since=now}
  if(now-state.since>=(wanted?55:70)){state.pressed=wanted;state.pending=null;state.since=null}
  return state.pressed
}
export function planPinchPointer(state,hand,now,{mouseDown=false,heldSince=Infinity}={}){
  if(!hand.active){Object.assign(state,createPinchPointer());return {freeze:true,source:'finger',mode:'free'}}
  const ratio=hand.pinch??2
  const palm={x:hand.palmX??(hand.x+1)/2,y:hand.palmY??(hand.y+1)/2}
  const closing=ratio<.85&&state.previousPinch-ratio>.035&&hand.gesture!=='Closed_Fist'
  state.previousPinch=ratio
  // Lock BEFORE contact, rather than letting the index curl move the cursor.
  if(state.mode==='free'&&(closing||hand.pressed))state.mode='approach'
  if(hand.pressed){
    if(state.mode!=='held'&&state.mode!=='drag'){state.mode='held';state.palm=palm}
    if(mouseDown&&now-heldSince>=220&&Math.hypot(palm.x-state.palm.x,palm.y-state.palm.y)>.012)state.mode='drag'
    return {mode:state.mode,freeze:state.mode!=='drag',source:'palm',rawX:palm.x,rawY:palm.y}
  }
  if(state.mode==='held'||state.mode==='drag'){state.mode='release';state.resumeSince=null}
  if(state.mode!=='free'){
    if(ratio>.9){state.resumeSince??=now;if(now-state.resumeSince>=120){state.mode='free';state.palm=null;state.resumeSince=null}}
    else state.resumeSince=null
  }
  return {mode:state.mode,freeze:state.mode!=='free',source:'finger',rawX:hand.pointerX??.5,rawY:hand.pointerY??.5}
}
