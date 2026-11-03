import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fail } from '../core/board.js';
import { exportBoard } from './export.js';
export const ROUTE_PREFIX = '/dsh-screenshot-board';
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function readJson(req, limit) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) fail('请求需要 JSON 格式', 415);
  if (Number(req.headers['content-length'] || 0) > limit) fail('请求超过大小限制', 413);
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > limit) fail('请求超过大小限制', 413); chunks.push(chunk); }
  let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('JSON 数据不完整或格式不正确'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('请求需要 JSON 对象');
  return value;
}
export function createHandler({ store, log = console }) {
  const token = randomBytes(32).toString('hex');
  return async (req, res) => {
    try {
      let path = new URL(req.url || '/', 'http://localhost').pathname;
      if (path.startsWith(ROUTE_PREFIX + '/')) path = path.slice(ROUTE_PREFIX.length);
      const method = req.method || 'GET';
      if (path === '/api/session' && method === 'GET') return json(res, 200, { token, version: '0.2.0' });
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) fail('不支持的请求方式', 405);
      if (method !== 'GET') {
        const received = req.headers['x-screenshot-board-token'];
        if (typeof received !== 'string' || Buffer.byteLength(received) !== token.length || !timingSafeEqual(Buffer.from(received), Buffer.from(token))) fail('操作验证已失效，请重新打开任务板', 403);
      }
      if (path === '/api/boards' && method === 'GET') return json(res, 200, await store.list());
      if (path === '/api/boards' && method === 'POST') return json(res, 201, await store.create(await readJson(req, 32000)));
      if (path === '/api/assets' && method === 'POST') return json(res, 201, await store.addAsset(await readJson(req, 12 * 1024 * 1024)));
      if (path === '/api/import' && method === 'POST') return json(res, 201, await store.importPortable(await readJson(req, 72 * 1024 * 1024)));
      const assetMatch = /^\/api\/assets\/([a-f0-9]{64}\.(?:png|jpg))$/.exec(path);
      if (assetMatch && method === 'GET') {
        const data = await store.asset(assetMatch[1]);
        res.writeHead(200, { 'content-type': assetMatch[1].endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
        return res.end(data);
      }
      const match = /^\/api\/boards\/([a-zA-Z0-9_-]+)(?:\/(export|portable|markdown))?$/.exec(path);
      if (match) {
        const [, id, action] = match;
        if (!action && method === 'GET') return json(res, 200, await store.get(id));
        if (!action && method === 'PUT') {
          const input = await readJson(req, 4 * 1024 * 1024);
          if (input.id !== id) fail('任务板标识不一致');
          return json(res, 200, await store.save(input));
        }
        if (!action && method === 'DELETE') {
          const input = await readJson(req, 1000);
          await store.remove(id, input.revision);
          return json(res, 200, { ok: true });
        }
        const board = await store.get(id);
        if (action === 'portable' && method === 'GET') return json(res, 200, await store.portable(board));
        if (action === 'markdown' && method === 'GET') {
          const { markdownForHandoff } = await import('../core/handoff.js');
          return json(res, 200, { markdown: markdownForHandoff(board) });
        }
        if (action === 'export' && method === 'POST') {
          const input = await readJson(req, 72 * 1024 * 1024);
          if (input.revision !== board.revision) fail('任务板已更新，请保存后重试导出', 409);
          const zip = await exportBoard(store, board, input.rendered, input.selection);
          res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="screenshot-handoff.zip"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
          return res.end(zip);
        }
      }
      fail('接口不存在', 404);
    } catch (e) {
      if (res.destroyed || res.writableEnded) return;
      const status = Number.isInteger(e.status) ? e.status : 500;
      if (status === 500) log.error?.('[dsh-screenshot-board]', e);
      json(res, status, { error: status === 500 ? '操作失败，请检查宿主日志或磁盘空间' : e.message });
    }
  };
}
