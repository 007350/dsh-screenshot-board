import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const require=createRequire(resolve(arg('--playwright-root')||root,'package.json')),{chromium}=require('playwright');
const browser=await chromium.launch({headless:true,...(arg('--browser')?{executablePath:arg('--browser')}:{})}),page=await browser.newPage({viewport:{width:1600,height:1000}});
const base=arg('--url')||'http://127.0.0.1:4388/',errors=[];page.on('pageerror',e=>errors.push(e.message));
const harness=`<!doctype html><html><head><meta charset="utf-8"></head><body><p id="chat">Client lifecycle harness (not DSH)</p><div id="settings"></div><script>
window.cleanups=[];window.settingsClosed=0;
const React={createElement(tag,attrs,...children){const node=document.createElement(tag);for(const [key,value]of Object.entries(attrs||{})){if(key==='onClick')node.addEventListener('click',value);else node.setAttribute(key==='className'?'class':key,value);}for(const child of children.flat(Infinity))if(child!=null)node.append(child instanceof Node?child:document.createTextNode(String(child)));return node;}};
window.__ModuleLoader__={load(reg){window.plugin=reg.factory(name=>{if(name!=='react')throw Error('unexpected module');return React;});window.plugin.apply({locale:{register:()=>()=>{},bind:()=>key=>key},effect(fn){const cleanup=fn();if(typeof cleanup==='function')window.cleanups.push(cleanup);},slots:{inject(name,fn){const result=fn();if(result?.[Symbol.iterator])Array.from(result);},register(meta,Component){if(meta.name==='shell.overlay')document.body.append(Component());if(meta.name==='settings.section')document.querySelector('#settings').append(Component({close(){window.settingsClosed++;document.querySelector('#settings').hidden=true;}}));return()=>{};}}});}};
</script><script type="module" src="/client-under-test.js"></script></body></html>`;
try{
  await page.route('**/client-harness',route=>route.fulfill({contentType:'text/html',body:harness}));
  await page.route('**/client-under-test.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile(resolve(root,'lib/client.js'),'utf8')}));
  await page.goto(new URL('client-harness',base).href);await page.getByRole('button',{name:'打开工作台',exact:true}).click();
  await page.locator('.ssb-host .ssb-board-meta h1').waitFor();assert.equal(await page.evaluate(()=>window.settingsClosed),1);
  await page.locator('.ssb-task-card').first().click();
  await page.getByRole('textbox',{name:'新增讨论记录',exact:true}).fill('真实 Client bundle 的未提交草稿');
  await page.evaluate(()=>{window.originalOverlay=document.querySelector('.ssb-host');window.originalInput=document.querySelector('[aria-label="新增讨论记录"]');});
  await page.locator('.ssb-header').getByRole('button',{name:'收起到聊天',exact:true}).click();assert.ok(await page.locator('.ssb-host').isHidden());
  await page.getByRole('button',{name:'打开或恢复截图任务板',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'新增讨论记录',exact:true}).inputValue(),'真实 Client bundle 的未提交草稿');
  assert.ok(await page.evaluate(()=>window.originalOverlay===document.querySelector('.ssb-host')&&window.originalInput===document.querySelector('[aria-label="新增讨论记录"]')));
  await page.getByRole('button',{name:'项目背景',exact:true}).click();await page.getByRole('textbox',{name:'启动方式',exact:true}).fill('尚未点保存的设置草稿');
  await page.getByRole('dialog').getByRole('button',{name:'收起到聊天',exact:true}).click();await page.getByRole('button',{name:'打开或恢复截图任务板',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'启动方式',exact:true}).inputValue(),'尚未点保存的设置草稿');await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.screenshot({path:resolve(root,'artifacts/client-harness.png')});
  await page.getByRole('button',{name:'关闭工作台',exact:true}).click();assert.equal(await page.locator('.ssb-host').count(),0);
  await page.getByRole('button',{name:'打开或恢复截图任务板',exact:true}).click();await page.locator('.ssb-board-meta h1').waitFor();
  await page.evaluate(()=>window.cleanups.forEach(fn=>fn()));assert.equal(await page.locator('.ssb-host').count(),0);assert.deepEqual(errors,[]);
  const checks=['settings optional close callback','outer overlay hidden CSS','same bundle DOM and discussion on restore','settings draft retained','close disposes and reopen mounts','plugin effect cleanup'];
  await writeFile(resolve(root,'artifacts/client-lifecycle-results.json'),JSON.stringify({kind:'stubbed-DSH-client-browser-harness',notLiveDSH:true,checks,errors,time:new Date().toISOString()},null,2));
  console.log('PASS '+checks.join(' / '));
}finally{await browser.close();}
