export const FORMAT = 'dsh-screenshot-board';
export const STATUSES = { todo: '待处理', doing: '处理中', review: '待验收', accepted: '已通过', returned: '需修改' };
export const PRIORITIES = { low: '低', normal: '中', high: '高' };
export const CONTEXT_FIELDS = { startup: '启动方式', url: '访问地址', entry: '页面入口', conditions: '必要操作条件', files: '相关文件线索', scope: '允许修改的范围', unknowns: '未知与待确认信息' };
function record(value, label) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(label + '格式不正确');
  return value;
}
export function projectContext(value) {
  const input = record(value, '项目背景');
  return Object.fromEntries(Object.keys(CONTEXT_FIELDS).map(key => [key, text(input[key], 6000)]));
}
function reproduction(value) {
  const input = record(value, '复现信息');
  return Object.fromEntries(['steps', 'actual', 'expected', 'environment'].map(key => [key, text(input[key], 6000)]));
}
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_EXPORT_BYTES = 48 * 1024 * 1024;
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function uid() { return crypto.randomUUID(); }
export function validId(value) { return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value); }
function text(value, max, fallback = '') {
  if (value == null) return fallback;
  if (typeof value !== 'string' || value.length > max) fail('文本长度或格式不正确');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) fail('时间格式不正确');
  return value;
}
function id(value) { if (!validId(value)) fail('标识无效'); return value; }
export function rectFromPoints(a, b) {
  const clamp = n => Math.max(0, Math.min(1, n));
  const x1 = clamp(a.x), y1 = clamp(a.y), x2 = clamp(b.x), y2 = clamp(b.y);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}
export function createBoard(values = {}) {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: uid(), title: values.title || '未命名任务板', projectPath: values.projectPath || '', description: '', context: projectContext(), revision: 0, createdAt: now, updatedAt: now, screenshots: [] };
}
export function createTask(rect, number) {
  return { id: uid(), title: '修改点 ' + number, note: '', requirement: '', acceptance: '', kind: 'visual', clarity: 'draft', clarification: '', reproduction: reproduction(), status: 'todo', priority: 'normal', rect, history: [] };
}
export function validateAsset(value) {
  if (!value || !/^[a-f0-9]{64}\.(png|jpg)$/.test(value.id)) fail('图片标识无效');
  const mime = value.id.endsWith('.png') ? 'image/png' : 'image/jpeg';
  if (value.mime !== mime) fail('图片类型不一致');
  for (const key of ['width', 'height', 'size']) if (!Number.isSafeInteger(value[key]) || value[key] < 1) fail('图片尺寸无效');
  if (value.width > 16000 || value.height > 16000 || value.width * value.height > 64000000 || value.size > MAX_IMAGE_BYTES) fail('图片过大');
  return { id: value.id, name: text(value.name, 240, 'screenshot'), mime, width: value.width, height: value.height, size: value.size };
}
export function validateBoard(value) {
  if (!value || value.schemaVersion !== 1) fail('不支持的任务板版本');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) fail('修订号无效');
  if (!Array.isArray(value.screenshots) || value.screenshots.length > 12) fail('每个任务板最多 12 张截图');
  const ids = new Set();
  const unique = value => { const result = id(value); if (ids.has(result)) fail('标识重复'); ids.add(result); return result; };
  let count = 0;
  const screenshots = value.screenshots.map(shot => {
    if (!shot || !Array.isArray(shot.tasks)) fail('截图任务格式不正确');
    count += shot.tasks.length;
    if (count > 300) fail('任务数量超过 300 条');
    return { id: unique(shot.id), title: text(shot.title, 120, '截图'), original: validateAsset(shot.original),
      after: shot.after ? validateAsset(shot.after) : null,
      tasks: shot.tasks.map(task => {
        if (!task || !Object.hasOwn(STATUSES, task.status)) fail('任务状态无效');
        if (!Object.hasOwn(PRIORITIES, task.priority)) fail('任务优先级无效');
        const kind = task.kind ?? 'visual', clarity = task.clarity ?? 'draft';
        if (!['visual', 'interaction'].includes(kind)) fail('问题类型无效');
        if (!['draft', 'confirmed'].includes(clarity)) fail('需求确认状态无效');
        const r = task.rect;
        if (!r || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 1) || r.w < .0001 || r.h < .0001 || r.x + r.w > 1.00000001 || r.y + r.h > 1.00000001) fail('批注区域无效');
        if (!Array.isArray(task.history) || task.history.length > 100) fail('历史记录格式不正确');
        return { id: unique(task.id), title: text(task.title, 160, '修改点'), note: text(task.note, 8000),
          requirement: text(task.requirement, 10000), acceptance: text(task.acceptance, 6000),
          kind, clarity, clarification: text(task.clarification, 6000), reproduction: reproduction(task.reproduction),
          status: task.status, priority: task.priority, rect: { x: r.x, y: r.y, w: r.w, h: r.h },
          history: task.history.map(h => ({ id: id(h.id), text: text(h.text, 2000), createdAt: date(h.createdAt) })) };
      }) };
  });
  return { schemaVersion: 1, id: id(value.id), title: text(value.title, 120, '未命名任务板'),
    projectPath: text(value.projectPath, 1000), description: text(value.description, 8000), context: projectContext(value.context),
    revision: value.revision, createdAt: date(value.createdAt), updatedAt: date(value.updatedAt), screenshots };
}
export function shotFiles(shot, index) {
  const prefix = 'images/' + String(index + 1).padStart(2, '0');
  return { original: prefix + '-original.' + (shot.original.mime === 'image/png' ? 'png' : 'jpg'), annotated: prefix + '-annotated.png',
    after: shot.after ? prefix + '-after.' + (shot.after.mime === 'image/png' ? 'png' : 'jpg') : null };
}
