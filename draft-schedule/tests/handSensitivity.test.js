import test from 'node:test'
import assert from 'node:assert/strict'
import {createSensitivityState,updateSensitivity as step,cancelSensitivity} from '../src/utils/handSensitivity.js'
import {readRecognizedHands} from '../src/utils/recognizedHands.js'
import {moveRelativePointer} from '../src/utils/handCoordinates.js'
const left={gesture:'Closed_Fist',gestureScore:.95,y:.5,openPalm:false}
const right={gesture:'Pointing_Up',gestureScore:.95,y:.5,openPalm:false}
const hand=(l=left,r=right)=>({active:true,hands:{left:l,right:r}})
const opened=()=>{const s=createSensitivityState();step(s,hand(),0,1);step(s,hand(),400,1);return s}
test('only a left fist opens; right fists and pinches do not',()=>{
 const s=createSensitivityState()
 assert.equal(step(s,hand(null,{...right,gesture:'Closed_Fist'}),0,1).mode,'idle')
 assert.equal(step(s,hand(),100,1).mode,'arming')
 assert.equal(step(s,hand(),499,1).mode,'arming')
 assert.equal(step(s,hand(),500,1).event,'opened')
})
test('only right movement changes sensitivity while left fist is held',()=>{
 const s=opened()
 assert.equal(step(s,hand({...left,y:.1}),500,1).value,1)
 assert.equal(step(s,hand(left,{...right,y:.4}),600,1).value,1.7)
 assert.equal(step(s,hand(left,{...right,y:.6}),700,1).value,.3)
})
test('left opening freezes value before right motion, then saves',()=>{
 const s=opened();step(s,hand(left,{...right,y:.4}),500,1)
 const open={...left,gesture:'Open_Palm',openPalm:true}
 assert.equal(step(s,hand(open,{...right,y:.9}),600,1).value,1.7)
 assert.equal(step(s,hand(open,{...right,y:.1}),799,1).mode,'editing')
 const result=step(s,hand(open,{...right,y:.1}),800,1)
 assert.equal(result.event,'applied');assert.equal(result.value,1.7)
})
test('right loss freezes and reanchors on return',()=>{
 const s=opened();step(s,hand(left,{...right,y:.4}),500,1)
 assert.equal(step(s,hand(left,null),600,1).value,1.7)
 assert.equal(step(s,hand(left,{...right,y:.8}),700,1).value,1.7)
 assert.equal(step(s,hand(left,{...right,y:.7}),800,1).value,2.4)
})
test('left loss freezes, does not save, then cancels after five seconds',()=>{
 const s=opened();step(s,hand(left,{...right,y:.4}),500,1)
 assert.equal(step(s,hand(null,{...right,y:.9}),600,1).value,1.7)
 assert.equal(step(s,hand(null,right),5599,1).mode,'editing')
 assert.equal(step(s,hand(null,right),5600,1).event,'cancelled')
})
test('mouse hold blocks entry and Esc-style cancellation restores saved value',()=>{
 const s=createSensitivityState();assert.equal(step(s,hand(),0,1,true).mode,'idle')
 assert.equal(step(s,hand(),2000,1,true).mode,'idle')
 step(s,hand(),2100,1);step(s,hand(),2500,1);step(s,hand(left,{...right,y:.4}),2600,1)
 cancelSensitivity(s,1);assert.equal(s.value,1);assert.equal(step(s,hand(),4000,1).mode,'idle')
})
test('right-hand geometry stays attached to its role when detection order changes',()=>{
 const points=x=>Array.from({length:21},(_,i)=>({x:x+i*.001,y:.5-i*.002,z:0}))
 const result=(sides)=>({landmarks:sides.map(s=>points(s==='Left'?.7:.3)),gestures:sides.map(s=>[{categoryName:s==='Left'?'Closed_Fist':'Pointing_Up',score:.95}]),handedness:sides.map(s=>[{categoryName:s,score:.95}])})
 for(const sides of [['Left','Right'],['Right','Left']]){
  const s=readRecognizedHands(result(sides));assert.equal(s.hands.right.side,'Right');assert.equal(s.hands.left.gesture,'Closed_Fist');assert.equal(s.hands.right.gesture,'Pointing_Up')
 }
})
test('sensitivity multiplier still affects cursor movement',()=>{
 const delta=factor=>{const s={x:500,y:400,targetX:500,targetY:400,rawX:null,rawY:null};moveRelativePointer(s,.5,.5,1000,800,false,factor,{now:0,sampleTime:0});for(let i=1;i<60;i++)moveRelativePointer(s,.51,.5,1000,800,false,factor,{now:i*67,sampleTime:i*67});return s.x-500}
 assert.ok(delta(1)>20);assert.ok(Math.abs(delta(2)/delta(1)-2)<.03)
})
