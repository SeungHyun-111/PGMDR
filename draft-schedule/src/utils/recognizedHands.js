import { hasOpenFingers } from './handPose.js'

export function readRecognizedHands(result) {
  const samples = result.landmarks.map((points, index) => {
    const gesture = result.gestures[index]?.[0]
    const side = result.handedness[index]?.[0]
    const scale = Math.hypot(points[0].x-points[9].x,points[0].y-points[9].y) || 1
    const palmIndices=[0,5,9,13,17]
    return { x:points[9].x,y:points[9].y,points,pointerX:1-points[8].x,pointerY:points[8].y,
      palmX:1-palmIndices.reduce((sum,i)=>sum+points[i].x,0)/5,palmY:palmIndices.reduce((sum,i)=>sum+points[i].y,0)/5,
      pinch:Math.hypot(points[4].x-points[8].x,points[4].y-points[8].y)/scale,
      gesture:gesture?.score>.5?gesture.categoryName:'None',gestureScore:gesture?.score??0,
      openPalm:(gesture?.categoryName==='Open_Palm'&&gesture.score>.5)||hasOpenFingers(points),
      side:side?.score>=.65?side.categoryName:null,sideScore:side?.score??0 }
  })
  // Use subject handedness on the unmirrored camera input, never screen position
  // or detection-array order. Mirroring happens only when rendering the cursor.
  const best = side => samples.filter(s=>s.side===side).sort((a,b)=>b.sideScore-a.sideScore)[0] || null
  const left=best('Left'),right=best('Right'),primary=right||left||samples[0]
  return primary?{...primary,hands:{left,right},anyOpenPalm:samples.some(s=>s.openPalm)}:null
}
