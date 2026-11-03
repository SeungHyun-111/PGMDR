export function createPinchPointer(){return {mode:'free',previousPinch:2,palm:null,resumeSince:null,approachSince:null,approachArmed:true}}
export function createPinchPress(){return {pressed:false,pending:null,since:null,source:null}}
export function updatePinchPress(state,ratio,now,active,source,config={}){
  if(!active||source!==state.source){Object.assign(state,createPinchPress(),{source});if(!active)return false}
  const enter=config.pinchEnter??.38,exit=config.pinchExit??.55
  const wanted=state.pressed?ratio<exit:ratio<enter
  if(!state.pressed&&ratio<enter*.6){state.pressed=true;state.pending=null;state.since=null;return true}
  if(wanted===state.pressed){state.pending=null;state.since=null;return state.pressed}
  if(state.pending!==wanted){state.pending=wanted;state.since=now}
  if(now-state.since>=(wanted?55:70)){state.pressed=wanted;state.pending=null;state.since=null}
  return state.pressed
}
export function planPinchPointer(state,hand,now,{mouseDown=false,heldSince=Infinity}={}){
  if(!hand.active){Object.assign(state,createPinchPointer());return {freeze:true,source:'finger',mode:'free'}}
  const ratio=hand.pinch??2
  const palm={x:hand.palmX??(hand.x+1)/2,y:hand.palmY??(hand.y+1)/2}
  // Pre-contact locking is brief and near contact only. It must never require
  // spreading the thumb far away just to resume ordinary index movement.
  if(ratio>.7)state.approachArmed=true
  const closing=state.approachArmed&&ratio<.55&&state.previousPinch-ratio>.04&&hand.gesture!=='Closed_Fist'
  state.previousPinch=ratio
  // Lock BEFORE contact, rather than letting the index curl move the cursor.
  if(state.mode==='free'&&(closing||hand.pressed)){state.mode='approach';state.approachSince=now;state.approachArmed=false}
  if(state.mode==='approach'&&!hand.pressed&&(ratio>.65||now-state.approachSince>=220))state.mode='free'
  if(hand.pressed){
    if(state.mode!=='held'&&state.mode!=='drag'){state.mode='held';state.palm=palm}
    if(mouseDown&&now-heldSince>=220&&Math.hypot(palm.x-state.palm.x,palm.y-state.palm.y)>.012)state.mode='drag'
    return {mode:state.mode,freeze:state.mode!=='drag',source:'pinch-midpoint',rawX:hand.pinchX??palm.x,rawY:hand.pinchY??palm.y}
  }
  if(state.mode==='held'||state.mode==='drag'){state.mode='release';state.resumeSince=null}
  if(state.mode!=='free'){
    if(state.mode==='release'){
      state.resumeSince??=now
      if(now-state.resumeSince>=120){state.mode='free';state.palm=null;state.resumeSince=null}
    }
  }
  return {mode:state.mode,freeze:state.mode!=='free',source:'finger',rawX:hand.pointerX??.5,rawY:hand.pointerY??.5}
}
