import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BoardStore } from '../src/host/storage.js';
test('optimistic revision and atomic write prevent stale overwrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssb-store-'));
  try {
    const store = new BoardStore(dir);
    const initial = await store.create({ title: 'Original' });
    const results = await Promise.allSettled([
      store.save({ ...initial, title: 'A' }), store.save({ ...initial, title: 'B' })
    ]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(results.find(x => x.status === 'rejected').reason.status, 409);
    const saved = await store.get(initial.id);
    assert.equal(saved.revision, 1);
    assert.equal((await store.list())[0].id, initial.id);
    assert.equal(JSON.parse(await readFile(join(dir, 'boards', initial.id + '.json'), 'utf8')).revision, 1);
    await assert.rejects(store.get('../x'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('uploads validate bytes, dimensions and type; identical image data deduplicates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssb-image-'));
  try {
    const store = new BoardStore(dir);
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const a = await store.addAsset({ dataUrl, name: 'test.png' });
    const b = await store.addAsset({ dataUrl, name: '../../another.png' });
    assert.equal(a.id, b.id);
    assert.equal(a.width, 1);
    assert.equal(a.height, 1);
    await assert.rejects(store.addAsset({ dataUrl: 'data:image/png;base64,ZXZpbA==', name: 'evil.png' }));
    await assert.rejects(store.asset('../../x'));
    await assert.rejects(store.addAsset({ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', name: 'x.svg' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('optional context and task evidence survive save, portable backup and independent import',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ssb-evidence-'));
  try{
    const store=new BoardStore(dir),b=await store.create({title:'Evidence'});
    const a=await store.addAsset({name:'tiny.png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='});
    b.context.startup='npm run dev';b.context.scope='frontend only';
    b.screenshots.push({id:'shot',title:'page',original:a,after:null,tasks:[{id:'task',title:'cancel',note:'原话',requirement:'保留',acceptance:'仍在列表',kind:'interaction',clarity:'confirmed',clarification:'',reproduction:{steps:'delete → cancel',actual:'deleted',expected:'retained',environment:'logged in'},status:'todo',priority:'high',rect:{x:0,y:0,w:1,h:1},history:[]}]});
    const saved=await store.save(b),portable=await store.portable(saved),copy=await store.importPortable(portable);
    assert.equal(copy.context.startup,'npm run dev');assert.deepEqual(copy.screenshots[0].tasks,saved.screenshots[0].tasks);assert.notEqual(copy.id,saved.id);
  }finally{await rm(dir,{recursive:true,force:true});}
});
