import test from 'node:test'
import assert from 'node:assert/strict'
import {createPinchPointer,planPinchPointer,createPinchPress,updatePinchPress} from '../src/utils/pinchPointer.js'
import {moveRelativePointer} from '../src/utils/handCoordinates.js'
const hand={active:true,pinch:1.5,gesture:'Pointing_Up',pointerX:.5,pointerY:.5,palmX:.5,palmY:.6,x:0,y:.2,pressed:false}
test('approaching pinch freezes before contact while index curls upward',()=>{
 const s=createPinchPointer();planPinchPointer(s,hand,0)
 assert.equal(planPinchPointer(s,{...hand,pinch:.8,pointerY:.46},67).freeze,true)
 assert.equal(planPinchPointer(s,{...hand,pinch:.5,pointerY:.4},134).freeze,true)
 assert.equal(planPinchPointer(s,{...hand,pinch:.3,pressed:true,pointerY:.35},201).freeze,true)
})
test('holding a pinch cannot drag just because the fingertip moves',()=>{
 const s=createPinchPointer();planPinchPointer(s,{...hand,pinch:.3,pressed:true},0)
 const plan=planPinchPointer(s,{...hand,pinch:.3,pressed:true,pointerY:.2},500,{mouseDown:true,heldSince:0})
 assert.equal(plan.freeze,true);assert.equal(plan.mode,'held')
})
test('intentional palm movement starts drag and releasing reanchors the finger',()=>{
 const s=createPinchPointer();planPinchPointer(s,{...hand,pinch:.3,pressed:true},0)
 const plan=planPinchPointer(s,{...hand,pinch:.3,pressed:true,palmX:.53},400,{mouseDown:true,heldSince:0})
 assert.equal(plan.mode,'drag');assert.equal(plan.source,'palm');assert.equal(plan.rawX,.53)
 assert.equal(planPinchPointer(s,{...hand,pinch:.6},500).freeze,true)
 assert.equal(planPinchPointer(s,hand,600).freeze,true)
 assert.equal(planPinchPointer(s,hand,721).freeze,false)
})
test('a complete finger curl and uncurl leaves click position unchanged',()=>{
 const s=createPinchPointer(),motion={x:500,y:400,targetX:500,targetY:400,rawX:null,rawY:null}
 const frames=[hand,{...hand,pinch:.8,pointerY:.45},{...hand,pinch:.3,pressed:true,pointerY:.35},{...hand,pinch:.3,pressed:true,pointerY:.3},{...hand,pinch:.6,pointerY:.4},hand,hand]
 frames.forEach((h,i)=>{const now=i*100,plan=planPinchPointer(s,h,now,{mouseDown:i>=2&&i<=4,heldSince:200});moveRelativePointer(motion,plan.rawX??h.pointerX,plan.rawY??h.pointerY,1000,800,plan.freeze,1,{now,sampleTime:now,source:plan.source})})
 assert.equal(motion.x,500);assert.equal(motion.y,400)
})
test('pinch hysteresis and debounce ignore brief contact and boundary noise',()=>{
 const s=createPinchPress(),step=(r,t,active=true)=>updatePinchPress(s,r,t,active,'Right')
 assert.equal(step(.3,0),false);assert.equal(step(.5,40),false)
 assert.equal(step(.3,100),false);assert.equal(step(.3,160),true)
 assert.equal(step(.48,220),true);assert.equal(step(.6,280),true)
 assert.equal(step(.48,320),true);assert.equal(step(.6,400),true)
 assert.equal(step(.6,480),false);assert.equal(step(.3,550),false)
 assert.equal(step(.3,620),true);assert.equal(step(.3,680,false),false)
})
