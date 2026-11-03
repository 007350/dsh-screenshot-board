import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, createZip } from '../src/core/zip.js';
import { createBoard, createTask } from '../src/core/board.js';
import { exportBoard } from '../src/host/export.js';
test('ZIP uses standard CRC32 and UTF-8 filenames with a valid central directory', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const zip = createZip([{ name: 'tasks.md', data: '中文任务' }, { name: 'images/01.png', data: Buffer.from([1,2,3]) }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(6), 0x800);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 2);
  const offset = zip.readUInt32LE(zip.length - 6);
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(zip.readUInt32LE(14), crc32(Buffer.from('中文任务')));
});
test('ZIP rejects traversal, absolute paths and duplicate names', () => {
  for (const name of ['../evil', '/root', 'D:/x', 'x\\file', 'a/../b']) assert.throws(() => createZip([{ name, data: '' }]));
  assert.throws(() => createZip([{ name: 'x', data: '' }, { name: 'x', data: '' }]));
});
test('actual export enforces readiness and emits one authoritative scope beside complete background',async()=>{
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const b=createBoard(),a={id:'a'.repeat(64)+'.png',mime:'image/png',width:1,height:1,size:bytes.length,name:'tiny.png'};
  const tasks=['todo','accepted'].map((status,i)=>Object.assign(createTask({x:0,y:0,w:1,h:1},i+1),{status,requirement:'要求'+i,acceptance:'条件'+i,clarity:'confirmed'}));
  b.screenshots=[{id:'shot',title:'page',original:a,after:null,tasks}];const store={asset:async()=>bytes},rendered={shot:'data:image/png;base64,'+bytes.toString('base64')};
  const zip=await exportBoard(store,b,rendered),entries={};let i=0;
  while(zip.readUInt32LE(i)===0x04034b50){const length=zip.readUInt16LE(i+26),extra=zip.readUInt16LE(i+28),size=zip.readUInt32LE(i+18),start=i+30+length+extra;entries[zip.toString('utf8',i+30,i+30+length)]=zip.subarray(start,start+size);i=start+size;}
  const manifest=JSON.parse(entries['handoff.json']),snapshot=JSON.parse(entries['board.json']);
  assert.deepEqual(manifest.executionTaskIds,[tasks[0].id]);assert.deepEqual(manifest.referenceTaskIds,[tasks[1].id]);assert.deepEqual(snapshot.handoff,manifest);assert.equal(snapshot.screenshots[0].tasks.length,2);
  tasks[0].kind='interaction';await assert.rejects(exportBoard(store,b,rendered,{executionTaskIds:[tasks[0].id]}),/复现/);
  await assert.rejects(exportBoard(store,b,{}),/完整批注图/);
});
