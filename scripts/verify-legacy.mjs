import assert from 'node:assert/strict';
import { readdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { BoardStore } from '../src/host/storage.js';
const root=resolve(import.meta.dirname,'..'),pos=process.argv.indexOf('--data-root');
if(pos<0)throw Error('Pass --data-root pointing to read-only legacy board/assets fixtures');
const legacyRoot=resolve(process.argv[pos+1]),legacy=new BoardStore(legacyRoot),destination=new BoardStore(resolve(root,'artifacts/legacy-roundtrip-data'));
const results=[];
for(const file of (await readdir(join(legacyRoot,'boards'))).filter(name=>name.endsWith('.json'))){
  const raw=JSON.parse(await readFile(join(legacyRoot,'boards',file),'utf8')),normalized=await legacy.get(raw.id);
  for(const [i,s]of raw.screenshots.entries())for(const [n,t]of s.tasks.entries())for(const key of ['id','title','note','requirement','acceptance','rect','history','status','priority'])assert.deepEqual(normalized.screenshots[i].tasks[n][key],t[key]);
  const portable=await legacy.portable(raw),imported=await destination.importPortable(portable),saved=await destination.save(imported);
  assert.equal(saved.screenshots.length,raw.screenshots.length);
  for(const [i,s]of raw.screenshots.entries())assert.deepEqual(saved.screenshots[i].tasks,normalized.screenshots[i].tasks);
  results.push({legacyBoardId:raw.id,screenshots:raw.screenshots.length,tasks:raw.screenshots.reduce((n,s)=>n+s.tasks.length,0),readSaveBackupImport:'passed'});
}
await writeFile(resolve(root,'artifacts/legacy-results.json'),JSON.stringify({kind:'read-only legacy fixtures; output isolated',results},null,2));
console.log('PASS '+results.length+' legacy boards: original notes/requirements/history/geometry retained; read/save/backup/import');
