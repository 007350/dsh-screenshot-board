import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, validateBoard, rectFromPoints } from '../src/core/board.js';
import { markdownForHandoff as markdownForBoard } from '../src/core/handoff.js';
test('rectangles remain normalized when drawn backwards and outside the image', () => {
  assert.deepEqual(rectFromPoints({ x: 1.2, y: .9 }, { x: .2, y: -.1 }), { x: .2, y: 0, w: .8, h: .9 });
});
test('a board has identity and cannot retain arbitrary imported fields', () => {
  const board = createBoard({ title: '测试', projectPath: 'D:\\work' });
  assert.equal(board.revision, 0);
  assert.equal(validateBoard({ ...board, evil: 'ignored' }).evil, undefined);
  assert.throws(() => validateBoard({ ...board, id: '../escape' }));
});
test('task geometry and accepted states are checked', () => {
  const b = createBoard();
  const image = { id: 'a'.repeat(64) + '.png', name: 'sample.png', width: 100, height: 80, mime: 'image/png', size: 100 };
  const shot = { id: 'shot-1', title: '页面', original: image, after: null, tasks: [
    { id: 'task-1', title: '按钮', note: '', requirement: '移动', acceptance: '可以点击', status: 'review', priority: 'normal', rect: { x: .5, y: .2, w: .2, h: .3 }, history: [] }
  ] };
  b.screenshots.push(shot);
  assert.equal(validateBoard(b).screenshots[0].tasks[0].status, 'review');
  shot.tasks[0].rect.w = .8;
  assert.throws(() => validateBoard(b), /区域/);
  shot.tasks[0].rect.w = .2;
  shot.tasks[0].status = 'completed-without-evidence';
  assert.throws(() => validateBoard(b), /状态/);
});
test('handoff keeps user requirements, unchecked work and relative image links', () => {
  const b = createBoard({ title: 'Demo\n# injected', projectPath: 'D:\\repo' });
  const md = markdownForBoard(b);
  assert.match(md, /项目路径/);
  assert.match(md, /未知\/待补充/);
  assert.ok(!md.includes('\n# injected'));
  assert.match(md, /不会自动执行/);
});
