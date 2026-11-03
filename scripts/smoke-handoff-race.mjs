import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const require=createRequire(resolve(arg('--playwright-root')||root,'package.json')),{chromium}=require('playwright');
const browser=await chromium.launch({headless:true,...(arg('--browser')?{executablePath:arg('--browser')}:{})}),page=await browser.newPage();
const base=arg('--url')||'http://127.0.0.1:4388/';
let releaseSave,seenSave,releaseGet,seenGet;
const saveGate=new Promise(r=>releaseSave=r),saveSeen=new Promise(r=>seenSave=r),getGate=new Promise(r=>releaseGet=r),getSeen=new Promise(r=>seenGet=r);
try{
  await page.goto(base);await page.locator('.ssb-task-card').first().click();
  const target=await page.evaluate(async()=>{const list=await(await fetch('dsh-screenshot-board/api/boards')).json();const current=document.querySelector('.ssb-board-card.is-active')?.getAttribute('aria-label');return list.find(b=>b.title!==current)||list[1];});
  assert.ok(target,'needs at least two isolated preview boards');
  await page.route('**/api/boards/*',async route=>{
    const request=route.request();
    if(request.method()==='PUT'){seenSave();await saveGate;}
    if(request.method()==='GET'&&request.url().endsWith('/'+target.id)){seenGet();await getGate;}
    await route.continue();
  });
  await page.getByRole('textbox',{name:'原始批注',exact:true}).fill('slow-save race regression');
  const saving=page.evaluate(()=>window.screenshotBoard.flush());await saveSeen;
  await page.getByRole('button',{name:'交接与导出',exact:true}).click();
  await page.getByRole('button',{name:target.title,exact:true}).first().click();
  releaseSave();await saving;await getSeen;
  // The old-board preview can appear before navigation completes. It must be
  // removed once the requested new board becomes current.
  releaseGet();await page.waitForFunction(title=>document.querySelector('.ssb-board-meta h1')?.textContent===title,target.title);
  assert.equal(await page.getByRole('dialog',{name:'交接与导出',exact:true}).count(),0);
  await writeFile(resolve(root,'artifacts/handoff-race-results.json'),JSON.stringify({kind:'standalone-browser-preview',check:'delayed save + handoff + board switch removes stale dialog',passed:true,time:new Date().toISOString()},null,2));
  console.log('PASS delayed save + handoff + board switch removes stale dialog');
}finally{releaseSave();releaseGet();await browser.close();}
