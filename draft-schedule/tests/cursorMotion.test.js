import test from 'node:test'
import assert from 'node:assert/strict'
import {moveRelativePointer,resetPointerMotion} from '../src/utils/handCoordinates.js'
import {DEFAULT_CURSOR_TUNING} from '../src/utils/cursorTuning.js'
const fresh=()=>({x:960,y:540,targetX:960,targetY:540,rawX:null,rawY:null})
function run(trace,{fps=60,sensitivity=1,config={},state=fresh(),source='Right'}={}){
 let sampleTime=0,raw=trace(0),maxStep=0
 for(let i=0;i<=fps*3;i++){
  const now=i*1000/fps
  if(i%Math.round(fps/15)===0){sampleTime=now;raw=trace(now)}
  const x=state.x,y=state.y
  moveRelativePointer(state,raw.x,raw.y,1920,1080,false,sensitivity,{now,sampleTime,source,config})
  maxStep=Math.max(maxStep,Math.hypot(state.x-x,state.y-y))
 }
 return {state,maxStep}
}
test('stationary landmark jitter stays within the dead zone',()=>{
 const {state}=run(t=>({x:.5+Math.sin(t*.1)*.0007,y:.5+Math.cos(t*.1)*.0005}))
 assert.ok(Math.hypot(state.x-960,state.y-540)<1)
})
test('a one-frame teleport is rejected without a cursor jump',()=>{
 const {state}=run(t=>({x:t>390&&t<460?.9:.5,y:.5}))
 assert.equal(state.x,960);assert.equal(state.y,540)
})
test('persistent relocation reanchors rather than travelling across the screen',()=>{
 const {state}=run(t=>({x:t>400?.85:.5,y:.5}))
 assert.equal(state.x,960)
})
test('intentional small movement survives smoothing and higher sensitivity moves farther',()=>{
 const trace=t=>({x:.5+Math.min(t/1200,1)*.018,y:.5})
 const a=run(trace,{sensitivity:1}).state.x-960,b=run(trace,{sensitivity:2}).state.x-960
 assert.ok(a>70);assert.ok(b>a*1.8)
})
test('per-frame movement is time based and bounded at 60 and 120 fps',()=>{
 for(const fps of [60,120]){
  const result=run(t=>({x:.5+Math.min(t/1000,1)*.1,y:.5+Math.min(t/1000,1)*.1}),{fps,sensitivity:3})
  assert.ok(result.maxStep<=DEFAULT_CURSOR_TUNING.maxDelta*60/fps+.01)
 }
})
test('pinch freeze, reacquisition, and hand changes cannot jump the pointer',()=>{
 const s=fresh();const options={now:0,sampleTime:0,source:'Right'}
 moveRelativePointer(s,.5,.5,1920,1080,false,1,options)
 moveRelativePointer(s,.55,.55,1920,1080,true,1,{...options,now:67,sampleTime:67})
 assert.equal(s.x,960)
 resetPointerMotion(s)
 moveRelativePointer(s,.8,.7,1920,1080,false,1,{...options,now:134,sampleTime:134})
 assert.equal(s.x,960)
 moveRelativePointer(s,.2,.2,1920,1080,false,1,{now:200,sampleTime:200,source:'Left'})
 assert.equal(s.x,960)
})
test('central active region clamps out-of-region movement',()=>{
 const {state}=run(t=>({x:.86+Math.min(t/1200,1)*.1,y:.5}))
 assert.equal(state.x,960)
})
test('small diagonal motion can still reach the corners gradually',()=>{
 const a=run(t=>({x:.5-Math.min(t/1200,1)*.08,y:.5-Math.min(t/1200,1)*.08})).state
 assert.ok(a.x<5);assert.ok(a.y<5)
 const b=run(t=>({x:.5+Math.min(t/1200,1)*.08,y:.5+Math.min(t/1200,1)*.08})).state
 assert.ok(b.x>1914);assert.ok(b.y>1074)
})
