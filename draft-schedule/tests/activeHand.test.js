import test from 'node:test'
import assert from 'node:assert/strict'
import {createActiveHand,selectActiveHand} from '../src/utils/activeHand.js'
import {readRecognizedHands} from '../src/utils/recognizedHands.js'
import {hasClosedFingers,hasPointingIndex} from '../src/utils/handPose.js'
import {createHandSession,advanceHandSession} from '../src/utils/handControlState.js'
const make=(side,x=.4,openPalm=true)=>({side,sideScore:.95,openPalm,points:Array.from({length:21},()=>({x,y:.5,z:0}))})
const frame=(...samples)=>({samples})
test('activation hand stays owner despite other hand or array-order changes',()=>{
 const s=createActiveHand(),right=make('Right'),left=make('Left',.8)
 assert.equal(selectActiveHand(s,frame(right),0).sample.side,'Right')
 assert.equal(selectActiveHand(s,frame(left,right),67).sample.side,'Right')
 assert.equal(selectActiveHand(s,frame(right,left),134).sample.side,'Right')
})
test('the left hand can activate; right hand does not take over',()=>{
 const s=createActiveHand(),left=make('Left'),right=make('Right',.8)
 selectActiveHand(s,frame(left),0)
 assert.equal(selectActiveHand(s,frame(right,left),67).sample.side,'Left')
})
test('lost owner is never replaced within grace; release does not transfer control',()=>{
 const s=createActiveHand(),right=make('Right'),left=make('Left',.8,false)
 selectActiveHand(s,frame(right),0)
 assert.equal(selectActiveHand(s,frame(left),100).sample,null)
 assert.equal(selectActiveHand(s,frame(left),900).side,'Right')
 assert.equal(selectActiveHand(s,frame(left),1100).released,true)
 assert.equal(selectActiveHand(s,frame(left),1200).sample,null)
})
test('nearby owner returns without a hand switch; teleported same-side candidate is rejected',()=>{
 const s=createActiveHand();selectActiveHand(s,frame(make('Right')),0)
 assert.equal(selectActiveHand(s,frame(make('Right',.85)),100).sample,null)
 assert.equal(selectActiveHand(s,frame(make('Right',.42)),200).sample.side,'Right')
})
test('nearest same-side wrist wins; low-confidence continuity never crosses known sides',()=>{
 const s=createActiveHand();selectActiveHand(s,frame(make('Right')),0)
 assert.equal(selectActiveHand(s,frame(make('Right',.5),make('Right',.41)),100).sample.points[0].x,.41)
 assert.equal(selectActiveHand(s,frame(make(null,.42)),200).sample.side,'Right')
 assert.equal(selectActiveHand(s,frame(make('Left',.42)),300).sample,null)
})
test('pointer always uses index tip; other fingertip motion only changes gesture/pinch data',()=>{
 const points=Array.from({length:21},(_,i)=>({x:.4+i*.002,y:.7-i*.005,z:0}))
 const result={landmarks:[points],gestures:[[{categoryName:'Pointing_Up',score:.95}]],handedness:[[{categoryName:'Right',score:.95}]]}
 const before=readRecognizedHands(result).hands.right
 for(const i of [4,12,16,20]){points[i]={x:.9,y:.1,z:0}}
 const after=readRecognizedHands(result).hands.right
 assert.equal(before.pointerX,after.pointerX);assert.equal(before.pointerY,after.pointerY)
 assert.notEqual(before.pinchX,after.pinchX)
})
test('four curled fingers recognize a fist even if the model is uncertain',()=>{
 const points=Array.from({length:21},()=>({x:.5,y:.6,z:0}));points[0]={x:.5,y:.8};points[9]={x:.5,y:.6}
 for(const base of [5,9,13,17]){points[base]={x:.5,y:.6};points[base+1]={x:.5,y:.5};points[base+3]={x:.5,y:.63}}
 assert.equal(hasClosedFingers(points),true)
 const result=readRecognizedHands({landmarks:[points],gestures:[[{categoryName:'None',score:.4}]],handedness:[[{categoryName:'Left',score:.6}]]})
 assert.equal(result.hands.left.isFist,true);assert.equal(result.hands.left.gesture,'Closed_Fist')
})

test('an extended index with three curled fingers is pointing, not a fist',()=>{
 const p=Array.from({length:21},()=>({x:.5,y:.6,z:0}));p[0]={x:.5,y:.8,z:0};p[9]={x:.5,y:.6,z:0};p[4]={x:.7,y:.65,z:0}
 for(const base of [5,9,13,17]){p[base]={x:.5,y:.6,z:0};p[base+1]={x:.5,y:.5,z:0};p[base+3]={x:.5,y:base===5?.3:.63,z:0}}
 assert.equal(hasClosedFingers(p),false)
 assert.equal(hasPointingIndex(p),true)
 p[4]={x:.2,y:.9,z:0}
 assert.equal(hasPointingIndex(p),true)
 const result=readRecognizedHands({landmarks:[p],gestures:[[{categoryName:'Pointing_Up',score:.98}]],handedness:[[{categoryName:'Right',score:.99}]]})
 assert.equal(result.hands.right.isFist,false);assert.equal(result.hands.right.gesture,'Pointing_Up')
})

test('uncertain geometry does not overwrite a confident non-fist model result',()=>{
 const p=Array.from({length:21},()=>({x:.5,y:.6,z:0}));p[0]={x:.5,y:.8,z:0};p[9]={x:.5,y:.6,z:0}
 for(const base of [5,9,13,17]){p[base]={x:.5,y:.6,z:0};p[base+1]={x:.5,y:.5,z:0};p[base+3]={x:.5,y:.63,z:0}}
 const result=readRecognizedHands({landmarks:[p],gestures:[[{categoryName:'Pointing_Up',score:.98}]],handedness:[[{categoryName:'Right',score:.99}]]})
 assert.equal(result.hands.right.gesture,'Pointing_Up')
})

test('the five-second wake gesture cannot combine different hands',()=>{
 const lock=createActiveHand(),right=make('Right'),left=make('Left',.8)
 let session=createHandSession(),next
 for(let now=0;now<=3000;now+=100){const selection=selectActiveHand(lock,frame(right),now);if(selection.changed)session=createHandSession();next=advanceHandSession(session,selection.sample,now)}
 for(let now=3100;now<=5000;now+=100){const selection=selectActiveHand(lock,frame(left),now);if(selection.changed||selection.released)session=createHandSession();next=advanceHandSession(session,selection.sample,now)}
 assert.equal(next.active,false)
 for(let now=5100;now<=9200;now+=100){const selection=selectActiveHand(lock,frame(left),now);if(selection.changed)session=createHandSession();next=advanceHandSession(session,selection.sample,now)}
 assert.equal(next.active,true);assert.equal(lock.side,'Left')
})
