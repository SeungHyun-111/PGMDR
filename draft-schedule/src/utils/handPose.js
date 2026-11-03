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
