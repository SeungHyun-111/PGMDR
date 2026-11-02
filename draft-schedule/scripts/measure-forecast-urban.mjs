import fs from 'node:fs'

// Called by the isolated forecast fixture. No production data or writes.
export async function measureForecastModes(page) {
  const cdp=await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const settle=async()=>{
    await page.mouse.move(1,1)
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,1900)))
    await cdp.send('HeapProfiler.collectGarbage')
  }
  const snapshot=async()=>{
    await settle()
    const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]))
    const dom=await cdp.send('Memory.getDOMCounters')
    return {heapMiB:metrics.JSHeapUsedSize/1048576,nodes:dom.nodes,listeners:dom.jsEventListeners,documents:dom.documents,
      layoutCount:metrics.LayoutCount,taskSeconds:metrics.TaskDuration,...await page.evaluate(()=>({renderedElements:document.querySelectorAll('*').length,tableRows:document.querySelectorAll('tbody tr').length,chartCount:document.querySelectorAll('.recharts-wrapper').length,blurPanels:document.querySelectorAll('.urban-surface').length,activeAnimations:document.getAnimations().filter(a=>a.playState==='running').length}))}
  }
  const results={fixtureBlocks:41,viewport:'1600x1100',browser:'Headless Edge; dev build; JS heap excludes GPU/image memory',cycles:[]}
  for(const mode of ['기본','Urban','기본','Urban','기본','Urban']){
    await page.getByRole('button',{name:mode,exact:true}).click()
    results.cycles.push({mode,...await snapshot()})
  }
  results.idle=await page.evaluate(async()=>{
    const read=()=>document.getAnimations().filter(a=>a.playState==='running').length
    const start=performance.now();let frames=0,gaps=[],prev=start
    await new Promise(resolve=>{const tick=now=>{gaps.push(now-prev);prev=now;frames++;if(now-start<1500)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)})
    return {frames,durationMs:prev-start,medianFrameMs:gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)],gapsOver50ms:gaps.filter(t=>t>50).length,activeAnimations:read()}
  })
  await page.getByRole('button',{name:'Urban',exact:true}).click()
  fs.mkdirSync('artifacts/forecast-urban',{recursive:true});fs.writeFileSync('artifacts/forecast-urban/performance-audit.json',JSON.stringify(results,null,2))
  console.log(JSON.stringify(results,null,2))
  await cdp.detach()
}
