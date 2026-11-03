export const HAND_LOCK_GRACE_MS=1000
export function createActiveHand(){return {side:null,wrist:null,index:null,missingSince:null,acquiredAt:0}}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)
export function selectActiveHand(lock,frame,now){
  const candidates=frame?.samples||[]
  if(!lock.side){
    const wake=candidates.filter(s=>s.side&&s.openPalm).sort((a,b)=>b.sideScore-a.sideScore)[0]
    if(!wake)return {sample:null,changed:false,tracking:'WAIT',side:null}
    lock.side=wake.side;lock.wrist={...wake.points[0]};lock.index={...wake.points[8]};lock.missingSince=null;lock.acquiredAt=now
    return {sample:{...wake,side:lock.side},changed:true,tracking:'CANDIDATE',side:lock.side}
  }
  const same=candidates.filter(s=>s.side===lock.side || (!s.side&&distance(s.points[0],lock.wrist)<.06))
    .filter(s=>distance(s.points[0],lock.wrist)<.2 && distance(s.points[8],lock.index)<.28)
    .sort((a,b)=>(distance(a.points[0],lock.wrist)*2+distance(a.points[8],lock.index))-(distance(b.points[0],lock.wrist)*2+distance(b.points[8],lock.index)))
  if(same.length){
    const found=same[0];lock.wrist={...found.points[0]};lock.index={...found.points[8]};lock.missingSince=null
    return {sample:{...found,side:lock.side},changed:false,tracking:'LOCKED',side:lock.side}
  }
  lock.missingSince??=now
  const side=lock.side
  if(now-lock.missingSince>=HAND_LOCK_GRACE_MS){Object.assign(lock,createActiveHand());return {sample:null,changed:false,released:true,tracking:'LOST',side}}
  return {sample:null,changed:false,tracking:'LOST',side}
}
