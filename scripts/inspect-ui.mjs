import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require=createRequire('C:/Users/zouxi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'artifacts'),{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
try{
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4387/');
await page.getByRole('button',{name:'先看看示例',exact:true}).waitFor();
await page.screenshot({path:resolve(root,'artifacts/welcome.png')});
await page.getByRole('button',{name:'先看看示例',exact:true}).click();
await page.locator('.ssb-mark').nth(2).waitFor();
await page.evaluate(()=>window.screenshotBoard.flush());
await page.screenshot({path:resolve(root,'artifacts/workspace.png')});
const metrics=await page.evaluate(()=>({body:{w:document.body.scrollWidth,h:document.body.scrollHeight},frame:(()=>{const r=document.querySelector('.ssb-image-frame').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})(),editor:document.querySelector('.ssb-inspector').scrollHeight}));
await writeFile(resolve(root,'artifacts/initial-check.json'),JSON.stringify({errors,metrics},null,2));
console.log(JSON.stringify({errors,metrics}));
}finally{await browser.close();}
