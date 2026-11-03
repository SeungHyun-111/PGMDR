// Rotation-independent fallback when the gesture classifier is uncertain.
export function hasOpenFingers(points) {
  if (!points || points.length < 21) return false
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0))
  const straight = [5, 9, 13, 17].every(base => {
    const a = points[base], joint = points[base + 1], tip = points[base + 3]
    const ux = a.x - joint.x, uy = a.y - joint.y, uz = (a.z || 0) - (joint.z || 0)
    const vx = tip.x - joint.x, vy = tip.y - joint.y, vz = (tip.z || 0) - (joint.z || 0)
    const cosine = (ux * vx + uy * vy + uz * vz) / (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1)
    return cosine < -.65 && distance(tip, points[0]) > distance(joint, points[0]) * 1.12
  })
  const palmSize = distance(points[0], points[9])
  return straight && distance(points[4], points[5]) > palmSize * .35
}

export function hasClosedFingers(points) {
  if(!points || points.length!==21)return false
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0))
  const scale=dist(points[0],points[9])
  if(scale<.02)return false
  return [5,9,13,17].every(base=>dist(points[base+3],points[0])<dist(points[base+1],points[0])*1.18 && dist(points[base+3],points[base])<scale*.9)
}

export function hasPointingIndex(points){
  if(!points||points.length!==21)return false
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0))
  const a=points[5],joint=points[6],tip=points[8]
  const u=[a.x-joint.x,a.y-joint.y,(a.z||0)-(joint.z||0)],v=[tip.x-joint.x,tip.y-joint.y,(tip.z||0)-(joint.z||0)]
  const cosine=u.reduce((sum,n,i)=>sum+n*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)||1)
  const curled=[9,13,17].filter(base=>d(points[base+3],points[0])<d(points[base+1],points[0])*1.18).length
  return cosine<-.6&&d(tip,points[0])>d(joint,points[0])*1.1&&curled>=2
}
