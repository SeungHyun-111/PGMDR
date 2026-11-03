import {DEFAULT_CURSOR_TUNING} from './cursorTuning.js'
import {createOneEuro,filterOneEuro} from './oneEuroFilter.js'
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
export function handToViewport(x,y,width,height){return {x:clamp((x-.15)/.7,0,1)*(width-1),y:clamp((y-.15)/.7,0,1)*(height-1)}}
export function resetPointerMotion(state){state.rawX=null;state.rawY=null;state.pipeline=null;state.targetX=state.x;state.targetY=state.y}
function anchor(state,rawX,rawY,now,sampleTime,source){
 state.rejectedJump=false
 state.rawX=rawX;state.rawY=rawY;state.targetX=state.x;state.targetY=state.y
 state.pipeline={fx:createOneEuro(rawX,sampleTime),fy:createOneEuro(rawY,sampleTime),acceptedX:rawX,acceptedY:rawY,anchorX:rawX,anchorY:rawY,lastRender:now,lastSample:sampleTime,source,vx:0,vy:0,candidate:null}
}
export function moveRelativePointer(state,rawX,rawY,width,height,pressed=false,sensitivity=1,options={}){
 const now=options.now??performance.now(),sampleTime=options.sampleTime??now,source=options.source??'hand',config={...DEFAULT_CURSOR_TUNING,...options.config}
 if(!Number.isFinite(rawX)||!Number.isFinite(rawY))return {x:state.x,y:state.y}
 if(state.rawX===null||!state.pipeline||state.pipeline.source!==source||sampleTime-state.pipeline.lastSample>350){anchor(state,rawX,rawY,now,sampleTime,source);return {x:state.x,y:state.y}}
 let p=state.pipeline
 const dt=clamp((now-p.lastRender)/1000,1/240,.05);p.lastRender=now
 if(pressed){anchor(state,rawX,rawY,now,sampleTime,source);return {x:state.x,y:state.y}}
 state.rejectedJump=false
 if(sampleTime!==p.lastSample){
  p.lastSample=sampleTime
  if(Math.hypot(rawX-p.acceptedX,rawY-p.acceptedY)>.12){
   state.rejectedJump=true
   if(p.candidate&&Math.hypot(rawX-p.candidate.x,rawY-p.candidate.y)<.04)p.candidate.count++
   else p.candidate={x:rawX,y:rawY,count:1}
   p.vx=0;p.vy=0;state.targetX=state.x;state.targetY=state.y
   if(p.candidate.count>=3)anchor(state,rawX,rawY,now,sampleTime,source)
   return {x:state.x,y:state.y}
  }
  p.candidate=null;p.acceptedX=rawX;p.acceptedY=rawY
  const filteredX=filterOneEuro(p.fx,rawX,sampleTime,config),filteredY=filterOneEuro(p.fy,rawY,sampleTime,config)
  const fx=clamp(filteredX,config.activeLeft,config.activeRight),fy=clamp(filteredY,config.activeTop,config.activeBottom)
  const ax=clamp(p.anchorX,config.activeLeft,config.activeRight),ay=clamp(p.anchorY,config.activeTop,config.activeBottom)
  const dx=fx-ax,dy=fy-ay,distance=Math.hypot(dx,dy)
  if(distance>config.deadZone){
   // Remove the dead band instead of releasing accumulated noise as a jump.
   const amount=(distance-config.deadZone)/distance
   const gain=1+Math.min(1,Math.max(0,(distance-config.deadZone)/.012))*.8
   state.targetX=clamp(state.targetX+dx*amount*width*8*gain*sensitivity,0,width-1)
   state.targetY=clamp(state.targetY+dy*amount*height*12*gain*sensitivity,0,height-1)
   p.anchorX=filteredX;p.anchorY=filteredY
  }
 }
 // Interpolate only toward accepted measurements. No prediction/extrapolation.
 const dx=state.targetX-state.x,dy=state.targetY-state.y
 const response=1-Math.exp(-dt/.045)
 let vx=dx*response/dt,vy=dy*response/dt
 const maxSpeed=config.maxDelta*60,speed=Math.hypot(vx,vy)
 if(speed>maxSpeed){vx*=maxSpeed/speed;vy*=maxSpeed/speed}
 const dvx=vx-p.vx,dvy=vy-p.vy,dv=Math.hypot(dvx,dvy),maxAcceleration=12000*dt
 if(dv>maxAcceleration){vx=p.vx+dvx/dv*maxAcceleration;vy=p.vy+dvy/dv*maxAcceleration}
 let mx=vx*dt,my=vy*dt
 if(mx*dx<0)mx=0;if(my*dy<0)my=0
 mx=Math.sign(mx)*Math.min(Math.abs(mx),Math.abs(dx));my=Math.sign(my)*Math.min(Math.abs(my),Math.abs(dy))
 state.x=clamp(state.x+mx,0,width-1);state.y=clamp(state.y+my,0,height-1)
 p.vx=mx/dt;p.vy=my/dt
 return {x:state.x,y:state.y}
}
