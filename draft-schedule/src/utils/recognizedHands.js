import { hasOpenFingers, hasClosedFingers, hasPointingIndex } from './handPose.js'

export function readRecognizedHands(result, previousFrame = null) {
  const samples = result.landmarks.map((points, index) => {
    const gesture = result.gestures[index]?.[0]
    const side = result.handedness[index]?.[0]
    const scale = Math.hypot(points[0].x-points[9].x,points[0].y-points[9].y) || 1
    const palmIndices=[0,5,9,13,17]
    const modelFist=gesture?.categoryName==='Closed_Fist'&&gesture.score>.55
    // Geometry is a fallback, not permission to overwrite a confident point/palm.
    const isFist=modelFist||((!gesture||gesture.categoryName==='None'||gesture.score<.7)&&hasClosedFingers(points))
    return { x:points[9].x,y:points[9].y,points,pointerX:1-points[8].x,pointerY:points[8].y,
      palmX:1-palmIndices.reduce((sum,i)=>sum+points[i].x,0)/5,palmY:palmIndices.reduce((sum,i)=>sum+points[i].y,0)/5,
      pinch:Math.hypot(points[4].x-points[8].x,points[4].y-points[8].y)/scale,
      pinchX:1-(points[4].x+points[8].x)/2,pinchY:(points[4].y+points[8].y)/2,
      isFist,indexPointing:hasPointingIndex(points),gesture:isFist?'Closed_Fist':gesture?.score>.5?gesture.categoryName:'None',gestureScore:gesture?.score??0,
      openPalm:!isFist&&((gesture?.categoryName==='Open_Palm'&&gesture.score>.5)||hasOpenFingers(points)),
      side:side?.score>=.55?side.categoryName:null,sideScore:side?.score??0 }
  })
  // Use subject handedness on the unmirrored camera input, never screen position
  // or detection-array order. Mirroring happens only when rendering the cursor.
  const best = side => samples.filter(s=>s.side===side).sort((a,b)=>b.sideScore-a.sideScore)[0] || null
  const hands={left:best('Left'),right:best('Right')}
  const assigned=new Set([hands.left,hands.right].filter(Boolean))
  for(const role of ['left','right']){
    if(hands[role]||!previousFrame?.hands[role])continue
    const previous=previousFrame.hands[role].points[0]
    const unknown=samples.filter(s=>!s.side&&!assigned.has(s))
      .filter(s=>Math.hypot(s.points[0].x-previous.x,s.points[0].y-previous.y)<.08)
      .sort((a,b)=>Math.hypot(a.points[0].x-previous.x,a.points[0].y-previous.y)-Math.hypot(b.points[0].x-previous.x,b.points[0].y-previous.y))[0]
    if(unknown){assigned.add(unknown);hands[role]={...unknown,side:role==='left'?'Left':'Right'}}
  }
  // Parsing exposes every hand. Only activeHand.js may choose cursor ownership.
  return samples.length?{samples,hands}:null
}
