const DOTS = Array.from({ length: 1100 }, (_, i) => {
  const seed = n => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v) }
  return { angle: seed(1) * Math.PI * 2, radius: Math.sqrt(seed(2)), depth: seed(3), speed: .25 + seed(4) * .4, light: seed(5) }
})

// Transparent orb centered on the exact click position. No camera pixels.
export default function drawParticleCursor(ctx, { x, y, time, opacity, radius, pressed, hovered, reduced, pulse }) {
  const t = reduced ? 0 : time * .001
  ctx.save(); ctx.translate(x,y); ctx.globalAlpha=opacity
  // Dark outlines preserve contrast on white tables, without adding a panel.
  ctx.strokeStyle='#122c5077';ctx.lineWidth=3
  ctx.beginPath();ctx.arc(0,0,radius*1.12,0,Math.PI*2);ctx.stroke()
  ctx.strokeStyle=pressed?'#4D8DFF':'#6FA8FF';ctx.lineWidth=hovered?1.5:1
  ctx.setLineDash([radius*.33,radius*.15,2,radius*.17]);ctx.lineDashOffset=-t*9
  ctx.beginPath();ctx.arc(0,0,radius*1.12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])
  for(let j=0;j<3;j++){
    ctx.save();ctx.rotate(t*(j%2?-.35:.22)+j*1.1);ctx.scale(1,.35+j*.22)
    ctx.globalAlpha=opacity*(hovered?.65:.4);ctx.strokeStyle='#6FA8FF';ctx.lineWidth=.7
    ctx.beginPath();ctx.arc(0,0,radius*(.92+j*.05),.3,Math.PI*1.8);ctx.stroke();ctx.restore()
  }
  for(const p of DOTS){
    const a=p.angle+t*p.speed+(1-p.radius)*3
    const r=radius*p.radius
    const px=Math.cos(a)*r,py=Math.sin(a*2+p.depth*3+t*.2)*r*.7
    ctx.globalAlpha=opacity*(.25+p.light*.65)
    ctx.fillStyle=p.light>.87?'#d5edff':p.light>.45?'#6FA8FF':'#3975c3'
    const size=.55+p.light*.85
    ctx.fillRect(px,py,size,size)
  }
  ctx.globalAlpha=opacity
  const glow=ctx.createRadialGradient(0,0,0,0,0,11)
  glow.addColorStop(0,'#d9f3ffff');glow.addColorStop(.22,'#6FA8FFdd');glow.addColorStop(1,'#4D8DFF00')
  ctx.fillStyle=glow;ctx.fillRect(-11,-11,22,22)
  ctx.strokeStyle='#17304f';ctx.lineWidth=2;ctx.fillStyle='#e8f7ff'
  ctx.beginPath();ctx.arc(0,0,pressed?2:3,0,Math.PI*2);ctx.fill();ctx.stroke()
  if(pulse>=0&&pulse<400&&!reduced){ctx.globalAlpha=opacity*(1-pulse/400)*.8;ctx.strokeStyle='#6FA8FF';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,12+pulse*.12,0,Math.PI*2);ctx.stroke()}
  ctx.restore()
}
