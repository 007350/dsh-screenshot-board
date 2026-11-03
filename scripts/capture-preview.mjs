import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),arg=name=>{const n=process.argv.indexOf(name);return n<0?null:process.argv[n+1];};
const req=createRequire(arg('--playwright-root')?resolve(arg('--playwright-root'),'package.json'):resolve(root,'package.json'));
const {chromium}=req('playwright');
const browser=await chromium.launch({headless:true,...(arg('--browser')?{executablePath:arg('--browser')}:{})});
try{
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
await page.goto(arg('--url')||'http://127.0.0.1:4387/');
await page.getByRole('button',{name:'先看看示例',exact:true}).waitFor();
await page.screenshot({path:resolve(root,'artifacts/welcome.png'),animations:'disabled'});
const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/boards/')&&r.status()===200&&r.request().postDataJSON()?.screenshots?.[0]?.tasks?.length===3);
await page.getByRole('button',{name:'先看看示例',exact:true}).click();await saved;
await page.getByRole('status').waitFor({state:'hidden'});
await page.screenshot({path:resolve(root,'artifacts/preview.png'),animations:'disabled'});
await page.getByRole('button',{name:'对比',exact:true}).click();
await page.screenshot({path:resolve(root,'artifacts/compare-clean.png'),animations:'disabled'});
await page.getByRole('button',{name:'修改前',exact:true}).click();
await page.getByRole('button',{name:'切换明暗主题',exact:true}).click();
await page.screenshot({path:resolve(root,'artifacts/dark-clean.png'),animations:'disabled'});
await page.getByRole('button',{name:'切换明暗主题',exact:true}).click();
await page.setViewportSize({width:1280,height:800});
await page.waitForFunction(()=>{const f=document.querySelector('.ssb-image-frame'),s=document.querySelector('.ssb-stage');return f&&s&&f.getBoundingClientRect().width<=s.clientWidth-60;});
await page.screenshot({path:resolve(root,'artifacts/preview-1280.png'),animations:'disabled'});
console.log('Captured clean welcome, workspace, comparison, dark and 1280px views.');
}finally{await browser.close();}
