import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
 const page=await browser.newPage(), failures=[]
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('localhost:5173'))failures.push(`${r.status()} ${r.url()}`)})
 await page.goto('http://localhost:5173/')
 const type=await page.evaluate(async()=>typeof(await import('/src/pages/PerformanceForecast.jsx')).default)
 assert.equal(type,'function');assert.deepEqual(failures,[])
 console.log('Passed: actual localhost:5173 forecast dynamic import, Motion and NumberFlow loaded without HTTP errors. No login or data edits performed.')
}finally{await browser.close()}
