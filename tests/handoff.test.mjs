import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, createTask, validateBoard } from '../src/core/board.js';
import { handoffForBoard, markdownForHandoff, taskIssues } from '../src/core/handoff.js';
function fixture() {
  const b = createBoard({title:'真实项目',projectPath:'D:/app'});
  const tasks = ['todo','doing','review','accepted','returned'].map((status,i)=>Object.assign(createTask({x:.1,y:.1,w:.2,h:.2},i+1),{title:status,status,note:'原话保留',requirement:'取消时保留项目',acceptance:'取消后项目数不变',clarity:'confirmed'}));
  b.screenshots.push({id:'shot',title:'项目页',original:{id:'a'.repeat(64)+'.png',mime:'image/png',width:100,height:80,size:100,name:'page'},after:null,tasks});
  return b;
}
test('legacy boards retain all content and gain conservative defaults',()=>{
  const b=fixture();delete b.context;
  for(const t of b.screenshots[0].tasks){delete t.kind;delete t.clarity;delete t.reproduction;}
  const migrated=validateBoard(b);
  assert.equal(migrated.description,b.description);
  assert.equal(migrated.context.startup,'');
  assert.equal(migrated.screenshots[0].tasks[0].note,'原话保留');
  assert.equal(migrated.screenshots[0].tasks[0].clarity,'draft');
  assert.equal(handoffForBoard(migrated).executionTaskIds.length,0);
});
test('defaults execute ready pending work and retain review/accepted only as reference',()=>{
  const b=fixture(),plan=handoffForBoard(b),tasks=b.screenshots[0].tasks;
  assert.deepEqual(plan.executionTaskIds,[tasks[0].id,tasks[1].id,tasks[4].id]);
  assert.deepEqual(plan.referenceTaskIds,[tasks[2].id,tasks[3].id]);
  assert.equal(plan.revision,b.revision);assert.ok(Date.parse(plan.exportedAt));
});
test('interaction requirements require steps, actual and expected results, and explicit confirmation',()=>{
  const b=fixture(),t=b.screenshots[0].tasks[0];t.kind='interaction';
  assert.equal(taskIssues(t).length,3);
  assert.throws(()=>handoffForBoard(b,{executionTaskIds:[t.id],referenceTaskIds:[],clarificationTaskIds:[]}),/复现/);
  t.reproduction={steps:'列表 → 删除 → 取消',actual:'项目被删除',expected:'项目保留',environment:'未登录，1280 × 800'};
  assert.deepEqual(taskIssues(t),[]);
  t.clarity='draft';assert.match(taskIssues(t).join(' '),/确认/);
  assert.ok(handoffForBoard(b).clarificationTaskIds.includes(t.id));
});
test('selection rejects unknown/duplicate IDs and does not silently broaden a partial selection',()=>{
  const b=fixture(),ids=b.screenshots[0].tasks.map(t=>t.id);
  for(const choice of [{executionTaskIds:['missing']},{executionTaskIds:[ids[0],ids[0]]},{executionTaskIds:[ids[0]],referenceTaskIds:[ids[0]]}])assert.throws(()=>handoffForBoard(b,choice));
  const plan=handoffForBoard(b,{executionTaskIds:[ids[0]]});
  assert.deepEqual(plan.executionTaskIds,[ids[0]]);assert.deepEqual(plan.referenceTaskIds,[]);assert.equal(plan.omittedTaskIds.length,4);
});
test('markdown distinguishes execution, clarification and reference and exposes unknown project context',()=>{
  const b=fixture(),tasks=b.screenshots[0].tasks;
  b.context={startup:'npm run dev',url:'http://localhost:3000',entry:'项目列表',conditions:'测试账号',files:'src/list.js（定位线索）',scope:'仅前端',unknowns:'浏览器版本未知'};
  tasks[1].clarity='draft';tasks[1].note='好看一点';
  const md=markdownForHandoff(b,handoffForBoard(b));
  assert.match(md,/本次执行任务/);assert.match(md,/待澄清/);assert.match(md,/仅供参考/);assert.match(md,/好看一点/);
  assert.match(md,/npm run dev/);assert.match(md,/浏览器版本未知/);assert.match(md,/操作验证/);assert.match(md,/images\/01-annotated.png/);
  assert.match(md,/用户记录/);assert.match(markdownForHandoff(createBoard()),/未知\/待补充/);
});
test('context and reproduction survive validation without accepting malformed new fields',()=>{
  const b=fixture();b.context={startup:'npm run dev'};
  const t=b.screenshots[0].tasks[0];t.kind='interaction';t.reproduction={steps:'a',actual:'b',expected:'c'};t.clarification='需核实触发条件';
  const next=validateBoard(b);assert.equal(next.context.startup,'npm run dev');assert.equal(next.screenshots[0].tasks[0].reproduction.actual,'b');
  assert.throws(()=>validateBoard({...b,context:[]}),/背景/);
  t.kind='made-up';assert.throws(()=>validateBoard(b),/类型/);
});
