import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createBoard, validateBoard, validateAsset, validId, fail, MAX_IMAGE_BYTES, MAX_EXPORT_BYTES, FORMAT } from '../core/board.js';
export function imageInfo(bytes) {
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(png) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(8) === 13 && bytes.subarray(-8, -4).toString() === 'IEND') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length-2] === 255 && bytes[bytes.length-1] === 217) {
    let pos = 2;
    while (pos + 4 < bytes.length) {
      if (bytes[pos++] !== 255) break;
      while (bytes[pos] === 255) pos++;
      const marker = bytes[pos++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const len = bytes.readUInt16BE(pos);
      if (len < 2 || pos + len > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && len >= 8) {
        return { width: bytes.readUInt16BE(pos+5), height: bytes.readUInt16BE(pos+3), mime: 'image/jpeg', ext: 'jpg' };
      }
      pos += len;
    }
  }
  fail('仅支持有效的 PNG 或 JPEG 图片');
}
export function decodeImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_IMAGE_BYTES * 1.4 + 100) fail('图片超过 8 MB 限制', 413);
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m || m[2].length % 4 !== 0) fail('图片数据格式不正确');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) fail('图片超过 8 MB 限制', 413);
  const info = imageInfo(bytes);
  if (info.mime !== m[1]) fail('图片内容与类型不一致');
  validateAsset({ ...info, id: 'a'.repeat(64) + '.' + info.ext, name: '', size: bytes.length });
  return { bytes, ...info };
}
export class BoardStore {
  constructor(root) { this.root = root; this.queues = new Map(); }
  async init() { await mkdir(join(this.root, 'boards'), { recursive: true }); await mkdir(join(this.root, 'assets'), { recursive: true }); }
  async locked(key, fn) {
    const prior = this.queues.get(key) || Promise.resolve();
    const next = prior.catch(() => {}).then(fn);
    this.queues.set(key, next);
    try { return await next; } finally { if (this.queues.get(key) === next) this.queues.delete(key); }
  }
  boardPath(id) { if (!validId(id)) fail('任务板标识无效'); return join(this.root, 'boards', id + '.json'); }
  async get(id) {
    try { return validateBoard(JSON.parse(await readFile(this.boardPath(id), 'utf8'))); }
    catch (e) { if (e.code === 'ENOENT') fail('任务板不存在', 404); throw e; }
  }
  async list() {
    await this.init();
    const files = (await readdir(join(this.root, 'boards'))).filter(f => /^[a-zA-Z0-9_-]+\.json$/.test(f));
    const result = [];
    for (const file of files) {
      try {
        const b = await this.get(file.slice(0, -5));
        const tasks = b.screenshots.flatMap(s => s.tasks);
        result.push({ id: b.id, title: b.title, projectPath: b.projectPath, updatedAt: b.updatedAt,
          screenshots: b.screenshots.length, tasks: tasks.length, accepted: tasks.filter(t => t.status === 'accepted').length });
      } catch (e) { console.warn('[dsh-screenshot-board] 无法读取任务板 ' + file + ': ' + e.message); }
    }
    return result.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async write(board) {
    await this.init();
    const target = this.boardPath(board.id), temp = target + '.' + randomUUID() + '.tmp';
    try { await writeFile(temp, JSON.stringify(board, null, 2), { encoding: 'utf8', flag: 'wx' }); await rename(temp, target); }
    finally { await unlink(temp).catch(e => { if (e.code !== 'ENOENT') console.warn(e.message); }); }
    return board;
  }
  async create(values = {}) { return this.write(validateBoard(createBoard(values))); }
  async save(input) {
    const board = validateBoard(input);
    return this.locked(board.id, async () => {
      const current = await this.get(board.id);
      if (board.revision !== current.revision) fail('任务板已在其他窗口更新。请先备份当前编辑，再重新载入。', 409);
      let total = 0;
      for (const shot of board.screenshots) for (const asset of [shot.original, shot.after].filter(Boolean)) {
        const actual = await this.asset(asset.id);
        const info = imageInfo(actual);
        if (info.width !== asset.width || info.height !== asset.height || actual.length !== asset.size) fail('图片信息不匹配');
        total += actual.length;
      }
      if (total > MAX_EXPORT_BYTES) fail('一个任务板的图片总量不能超过 48 MB', 413);
      board.createdAt = current.createdAt;
      board.updatedAt = new Date().toISOString();
      board.revision = current.revision + 1;
      return this.write(board);
    });
  }
  async remove(id, revision) {
    return this.locked(id, async () => {
      const current = await this.get(id);
      if (current.revision !== revision) fail('任务板已更新，请刷新后再删除', 409);
      await unlink(this.boardPath(id));
    });
  }
  async addAsset({ dataUrl, name }) {
    await this.init();
    const image = decodeImage(dataUrl);
    const id = createHash('sha256').update(image.bytes).digest('hex') + '.' + image.ext;
    const target = join(this.root, 'assets', id);
    try { await writeFile(target, image.bytes, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    return { id, name: basename(String(name || 'screenshot').replaceAll('\\', '/')).slice(0, 240), mime: image.mime, width: image.width, height: image.height, size: image.bytes.length };
  }
  async asset(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}\.(png|jpg)$/.test(id)) fail('图片标识无效');
    try { return await readFile(join(this.root, 'assets', id)); }
    catch(e) { if(e.code === 'ENOENT') fail('图片不存在', 404); throw e; }
  }
  async portable(input) {
    const board = validateBoard(input), assets = {};
    for (const s of board.screenshots) for (const a of [s.original, s.after].filter(Boolean)) {
      if (!assets[a.id]) assets[a.id] = 'data:' + a.mime + ';base64,' + (await this.asset(a.id)).toString('base64');
    }
    return { format: FORMAT, version: 1, board, assets };
  }
  async importPortable(input) {
    if (!input || input.format !== FORMAT || input.version !== 1 || !input.assets || typeof input.assets !== 'object' || Array.isArray(input.assets)) fail('请选择本插件导出的备份 JSON');
    const board = validateBoard(input.board);
    let total = 0;
    const checked = new Map();
    for (const s of board.screenshots) for (const a of [s.original, s.after].filter(Boolean)) if (!checked.has(a.id)) {
      const dataUrl = input.assets[a.id];
      const image = decodeImage(dataUrl);
      const hash = createHash('sha256').update(image.bytes).digest('hex') + '.' + image.ext;
      if (hash !== a.id || image.width !== a.width || image.height !== a.height || image.bytes.length !== a.size) fail('备份图片校验失败');
      total += image.bytes.length;
      if (total > MAX_EXPORT_BYTES) fail('备份图片总量超过 48 MB', 413);
      checked.set(a.id, { dataUrl, name: a.name });
    }
    for (const a of checked.values()) await this.addAsset(a);
    board.id = randomUUID();
    board.title = (board.title.slice(0, 110) + ' · 导入');
    board.revision = 0;
    board.createdAt = board.updatedAt = new Date().toISOString();
    return this.write(board);
  }
}
