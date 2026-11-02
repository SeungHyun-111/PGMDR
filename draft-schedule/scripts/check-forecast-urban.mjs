import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer, transformWithOxc } from 'vite'
import { chromium } from 'playwright'
import react from '@vitejs/plugin-react'
import { themes } from '../src/styles/theme.js'
const teams=['뷰티팀','식품팀','리빙팀','가전팀']
const blocks={},manualInputs={sim_pgm_team:{expectedSalesPerWeightedMin:1000000,expectedProfitPerWeightedMin:300000}}
for(let day=0;day<10;day++)for(let team=0;team<4;team++){
 const key=`b${day}-${team}`
 blocks[key]={uniqueKey:key,blockKey:key,dateKey:`2026-11-${String(day+2).padStart(2,'0')}`,timeText:`${10+team}:31`,mdTeam:teams[team],mdCategory:['뷰티','일반식품','가구','가전'][team],pgmCodeName:`시각 확인 상품 ${team+1}`,dealType:'위수탁',weightedMin:45+team*5,perfKey:`sample${team}`}
 if(day!==3||team!==1)manualInputs[key]={expectedSalesPerWeightedMin:1000000+day*110000+team*180000,expectedProfitPerWeightedMin:280000+day*13000+team*21000}
}
blocks.pgm={uniqueKey:'pgm',blockKey:'pgm',dateKey:'2026-11-02',timeText:'15:31',mdTeam:'편성팀',pgmCodeName:'[편성팀]',memoCode:'[전사블록]',weightedMin:60}
const data={scheduleBlocks:blocks,pgmSlots:[],splitSlots:{},customSlots:{},proposalItems:[],perfMap:{},performanceHistoryByKey:{},manualInputs,weightedMinTargets:[],targetMetrics:{sales:[{name:'전사',value:1500000,isCompanyTotal:true}],profit:[{name:'전사',value:400000,isCompanyTotal:true}]},startDate:'2026-11-02',poolType:'A',currentVersionId:'fixture'}
const store=`import{useState,useCallback}from'react';const initial=${JSON.stringify(data)};export default function useStore(){const[state,setState]=useState(initial);const saveManualInput=useCallback(async(key,fields)=>{window.fixtureWrites||=[];window.fixtureWrites.push({key,fields});setState(p=>({...p,manualInputs:{...p.manualInputs,[key]:{...p.manualInputs[key],...fields}}}));},[]);return{...state,saveManualInput,ensurePerformanceKeys:()=>{},saveBlock:async()=>{},saveEntityProps:async()=>{}}}`
const entry=`import React from'react';import{createRoot}from'react-dom/client';import Page from'/src/pages/PerformanceForecast.jsx';import'/src/index.css';Object.entries(${JSON.stringify(themes.light)}).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));createRoot(document.getElementById('root')).render(<Page/>);`
const server=await createServer({configFile:false,cacheDir:'artifacts/forecast-urban/vite-cache',resolve:{alias:{'@':new URL('../src',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')}},optimizeDeps:{include:['react','react-dom','react-dom/client','recharts','motion/react','@number-flow/react'],noDiscovery:true},plugins:[react(),{name:'forecast-fixture',enforce:'pre',
 resolveId(id){if(id==='/__forecast-entry.jsx')return '\0forecast-entry.jsx';if(id.includes('useScheduleStore'))return '\0fixture-store'},
 async load(id){if(id==='\0forecast-entry.jsx')return(await transformWithOxc(entry,'fixture.jsx',{jsx:{runtime:'classic'}})).code;if(id==='\0fixture-store')return store},
 configureServer(s){s.middlewares.use('/__forecast-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head><style>html,body,#root{height:100%;font-family:Arial,"Malgun Gothic",sans-serif}</style></head><body><div id="root"></div><script type="module" src="/__forecast-entry.jsx"></script></body></html>')})},
}],server:{host:'127.0.0.1',port:0,hmr:false}})
let browser
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1100}});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message)});await page.route('**/*.firebasedatabase.app/**',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__forecast-test`);await page.locator('.urban-metric').first().waitFor();assert.equal(await page.locator('.urban-metric').count(),4)
 if(process.argv.includes('--perf'))await(await import('./measure-forecast-urban.mjs')).measureForecastModes(page)
 fs.mkdirSync('artifacts/forecast-urban',{recursive:true});await page.screenshot({path:'artifacts/forecast-urban/entrance.png'});await page.waitForFunction(()=>[...document.querySelectorAll('.urban-metric')].every(e=>getComputedStyle(e).opacity==='1'))
 await page.getByRole('button',{name:'한계이익',exact:true}).click();assert.equal(await page.getByRole('button',{name:'한계이익',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'취급고',exact:true}).click()
 const urbanMissing=await page.locator('[data-coach="forecast-missing-table"] tbody').innerText();const urbanDetail=await page.locator('[data-coach="forecast-detail-table"] tbody').innerText()
 const chart=await page.locator('.urban-trend .recharts-wrapper').boundingBox();await page.mouse.move(chart.x+chart.width*.52,chart.y+chart.height*.5);await page.mouse.click(chart.x+chart.width*.52,chart.y+chart.height*.5)
 await page.locator('.urban-reset').waitFor();assert.ok((await page.locator('[data-coach="forecast-detail-table"] tbody tr').count())<41);await page.locator('.urban-reset').click();assert.equal(await page.locator('[data-coach="forecast-detail-table"] tbody').innerText(),urbanDetail)
 await page.getByRole('button',{name:'기본',exact:true}).click();assert.equal(await page.locator('.is-urban').count(),0);assert.equal(await page.locator('[data-coach="forecast-detail-table"] tbody').innerText(),urbanDetail);assert.equal(await page.locator('[data-coach="forecast-missing-table"] tbody').innerText(),urbanMissing)
 await page.getByRole('button',{name:'Urban',exact:true}).click();await page.getByLabel('전사블록 분당취급고').fill('1600000');await page.waitForFunction(()=>window.fixtureWrites?.at(-1)?.fields.expectedSalesPerWeightedMin===1600000)
 assert.equal(await page.locator('.urban-pgm-editor input').first().inputValue(),'1600000')
 await page.getByRole('button',{name:'카테고리',exact:true}).click();await page.getByRole('heading',{name:'카테고리별 취급 효율',exact:true}).waitFor();await page.getByRole('button',{name:'팀별',exact:true}).click()
 await page.locator('[data-coach="forecast-page"]').evaluate(e=>{e.scrollTop=0});await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:'artifacts/forecast-urban/desktop.png'})
 await page.setViewportSize({width:820,height:1100});await page.screenshot({path:'artifacts/forecast-urban/tablet.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.getByRole('button',{name:'기본',exact:true}).click();await page.getByRole('button',{name:'Urban',exact:true}).click();assert.deepEqual(errors,[]);assert.ok((await page.locator('.urban-metric').first().innerText()).includes('예상 분당취급고'))
 console.log('Passed: Urban/default parity of financial detail and missing rows, chart switches, group filters, debounced scenario save, responsive layout, reduced motion; no production DB access.')
}finally{await browser?.close();await server.close()}
