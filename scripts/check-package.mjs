import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
assert.equal(pkg.name,'dsh-screenshot-board');assert.equal(pkg.type,'module');
assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml');assert.equal(pkg.dsh.client.platform,'web');
assert.deepEqual(pkg.dsh.client.inject,['@deepseek-ai/dsh-client-runtime','@deepseek-ai/dsh-client-locale']);
for(const p of [pkg.main,pkg.exports['./client'],pkg.dsh.bundle.patch,'README.md','LICENSE'])await access(resolve(root,p));
const yaml=await readFile(resolve(root,'cordis.patch.yml'),'utf8');
assert.match(yaml,/^- insert:\s*\n\s+- id: dsh-screenshot-board\s*\n\s+name: dsh-screenshot-board\s*$/);
const client=await readFile(resolve(root,pkg.exports['./client']),'utf8');
assert.ok(!/^\s*(?:import|export)\s/m.test(client),'Client must have no runtime ESM imports/exports');
let registration;
vm.runInNewContext(client,{document:{querySelector:()=>({})},window:{__ModuleLoader__:{load:info=>{registration=info;}}}},{timeout:1500});
assert.equal(registration.id,pkg.name);
const plugin=registration.factory(name=>{assert.equal(name,'react');return{createElement:(...args)=>args};});
assert.equal(plugin.name,pkg.name);assert.deepEqual(Array.from(plugin.inject),['slots','locale']);
const slots=[],cleanups=[];
plugin.apply({
  locale:{register:()=>()=>{},bind:()=>key=>key},
  effect(fn){const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);return cleanup;},
  slots:{inject(name,fn){const result=fn();if(result?.[Symbol.iterator])Array.from(result);},register(meta,component){assert.equal(typeof component,'function');slots.push(meta.name);return()=>{};}}
});
assert.deepEqual(slots,['settings.section','shell.overlay']);
for(const cleanup of cleanups)cleanup();
const build=JSON.parse(await readFile(resolve(root,'lib/build-info.json'),'utf8'));
assert.equal(build.version,pkg.version);
console.log('PASS manifest, patch identity, artifact entries, self-contained client and verified DSH registration contract');
