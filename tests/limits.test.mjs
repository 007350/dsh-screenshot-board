import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BoardStore } from '../src/host/storage.js';
import { createBoard,validateBoard } from '../src/core/board.js';
test('associated project path is metadata and creates no project files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ssb-metadata-'));
  try{const project=join(dir,'uncreated-project'),store=new BoardStore(join(dir,'data'));const b=await store.create({title:'Metadata',projectPath:project});await store.save(b);await assert.rejects(access(project),{code:'ENOENT'});}
  finally{await rm(dir,{recursive:true,force:true});}
});
test('malformed schema, duplicate screenshot ids and invalid coordinates are rejected',()=>{
  assert.throws(()=>validateBoard({...createBoard(),schemaVersion:2}));
  const b=createBoard();
  const asset={id:'a'.repeat(64)+'.png',mime:'image/png',width:10,height:10,size:50,name:'x'};
  const s={id:'same',title:'x',original:asset,after:null,tasks:[]};
  b.screenshots=[s,{...s}];assert.throws(()=>validateBoard(b),/重复/);
});
