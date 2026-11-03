import { useEffect, useRef } from 'react'
import { handToViewport } from '../../utils/handCoordinates'
import drawParticleCursor from './drawParticleCursor'

const BONES = [[0,1,2,3,4],[0,5,6,7,8],[5,9,13,17,0],[9,10,11,12],[13,14,15,16],[17,18,19,20]]

export default function HandPresence({ enabled, input, visualPointer }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    if (!ctx) return
    let width = 1, height = 1, frame, lastTime = 0, opacity = 0, previousPalm = null, trail = [], points = null, pinchBefore = false, pulseAt = -1000, cursorRadius = 32
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const particles = Array.from({ length: 40 }, (_, i) => ({ angle: i * 2.39996, radius: 22 + (i * 17 % 54), x: 0, y: 0, vx: 0, vy: 0, seeded: false }))
    const resize = () => { width = innerWidth; height = innerHeight; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr,0,0,dpr,0,0) }
    resize(); window.addEventListener('resize', resize)
    const render = now => {
      frame = requestAnimationFrame(render)
      if (document.hidden || now - lastTime < 16) return
      const dt = Math.min((now - lastTime) / 16.67 || 1, 2); lastTime = now
      const hand = input.current, detected = !!hand.detected && hand.points?.length === 21
      opacity += ((detected ? 1 : 0) - opacity) * .17
      ctx.clearRect(0,0,width,height)
      if (opacity < .015) { points = null; previousPalm = null; trail = []; particles.forEach(p => { p.seeded = false }); return }
      if (detected) {
        const mapped = hand.points.map(p => handToViewport(1 - p.x, p.y, width, height))
        const cursor = visualPointer?.current
        const dx = cursor ? cursor.x - mapped[8].x : 0, dy = cursor ? cursor.y - mapped[8].y : 0
        mapped.forEach(p => { p.x += dx; p.y += dy })
        points = mapped
      }
      if (!points) return
      const palm = { x: (points[0].x + points[5].x + points[9].x + points[13].x + points[17].x) / 5, y: (points[0].y + points[5].y + points[9].y + points[13].y + points[17].y) / 5 }
      const vx = previousPalm && detected ? palm.x - previousPalm.x : 0, vy = previousPalm && detected ? palm.y - previousPalm.y : 0
      previousPalm = palm
      const speed = Math.hypot(vx,vy), index = points[8], thumb = points[4]
      const pinch = detected ? Math.max(0, Math.min(1, (1 - hand.pinch) / .75)) : 0
      const pinched = detected && !!hand.pressed
      if (pinched !== pinchBefore && detected) pulseAt = now
      pinchBefore = pinched
      ctx.save(); ctx.globalAlpha = opacity
      // Ghost hand: subtle at rest, stronger while moving. Never show camera pixels.
      ctx.strokeStyle = '#7E93B8'; ctx.lineWidth = .8; ctx.globalAlpha = opacity * Math.min(.28, .08 + speed * .013)
      for (const chain of BONES) { ctx.beginPath(); chain.forEach((i,j) => j ? ctx.lineTo(points[i].x,points[i].y) : ctx.moveTo(points[i].x,points[i].y)); ctx.stroke() }
      for (const p of points) { ctx.beginPath(); ctx.arc(p.x,p.y,1.7,0,Math.PI*2); ctx.fillStyle='#9cafd0'; ctx.fill() }
      // Forty spring particles lag behind palm motion and converge on the pinch.
      for (let i=0;i<particles.length;i++) {
        const p=particles[i], a=p.angle+(reduced?0:now*.00018), radius=p.radius*(1-pinch*.82)
        const targetX=palm.x*(1-pinch)+(thumb.x+index.x)*.5*pinch+Math.cos(a)*radius
        const targetY=palm.y*(1-pinch)+(thumb.y+index.y)*.5*pinch+Math.sin(a)*radius*.7
        if (!p.seeded) { p.x=targetX; p.y=targetY; p.seeded=true }
        p.vx=(p.vx+(targetX-p.x)*.035*dt-vx*.12)*.84
        p.vy=(p.vy+(targetY-p.y)*.035*dt-vy*.12)*.84
        p.x+=p.vx*dt; p.y+=p.vy*dt
        ctx.globalAlpha=opacity*(.25+(i%5)*.07+pinch*.2); ctx.fillStyle=pinched?'#4D8DFF':pinch>.3?'#6FA8FF':'#7E93B8'
        ctx.shadowColor='#6FA8FF';ctx.shadowBlur=pinched?7:3
        ctx.beginPath();ctx.arc(p.x,p.y,.65+(i%3)*.3,0,Math.PI*2);ctx.fill()
      }
      ctx.shadowBlur=0
      if (detected && !reduced) trail.push({x:index.x,y:index.y,time:now})
      trail=trail.filter(p=>now-p.time<200)
      for(let i=1;i<trail.length;i++){ctx.strokeStyle='#6FA8FF';ctx.lineWidth=2.5;ctx.globalAlpha=opacity*(1-(now-trail[i].time)/200)*.55;ctx.beginPath();ctx.moveTo(trail[i-1].x,trail[i-1].y);ctx.lineTo(trail[i].x,trail[i].y);ctx.stroke()}
      if(pinch>.12){ctx.globalAlpha=opacity*pinch*.85;ctx.strokeStyle=pinched?'#4D8DFF':'#6FA8FF';ctx.lineWidth=pinched?1.8:.8;ctx.beginPath();ctx.moveTo(thumb.x,thumb.y);ctx.lineTo(index.x,index.y);ctx.stroke()}
      const hovered=visualPointer?.current?.hovered
      const interaction=visualPointer?.current?.interaction
      const sensitivityScale=visualPointer?.current?.sensitivityScale
      cursorRadius+=((interaction==='SENSITIVITY'?26+sensitivityScale*12:interaction==='DRAG'?30:pinched?13:hovered?45:hand.active?34:26)-cursorRadius)*.18
      drawParticleCursor(ctx,{x:index.x,y:index.y,time:now,opacity,radius:cursorRadius,pressed:pinched,hovered,reduced,pulse:now-pulseAt})
      ctx.globalAlpha=opacity;ctx.font='10px Consolas, monospace';ctx.fillStyle=pinched?'#4D8DFF':'#5286c9'
      ctx.fillText(!detected?'TRACK LOST':interaction|| (pinched?'PINCH':hovered?'HOVER':hand.active?'POINT':'DETECT'),index.x+cursorRadius+10,index.y-10)
      ctx.restore()
    }
    frame=requestAnimationFrame(render)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize',resize); ctx.clearRect(0,0,width,height) }
  }, [enabled,input,visualPointer])
  if (!enabled) return null
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:19999 }} />
}
