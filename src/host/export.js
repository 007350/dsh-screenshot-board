import { createZip } from '../core/zip.js';
import { shotFiles, MAX_EXPORT_BYTES, fail } from '../core/board.js';
import { handoffForBoard, markdownForHandoff } from '../core/handoff.js';
import { decodeImage } from './storage.js';
export async function exportBoard(store, board, rendered = {}, selection) {
  if (!rendered || typeof rendered !== 'object' || Array.isArray(rendered)) fail('批注图格式不正确');
  const handoff = handoffForBoard(board, selection);
  const entries = [], index = [];
  let total = 0;
  async function add(name, bytes) {
    total += bytes.length;
    if (total > MAX_EXPORT_BYTES * 2) fail('交接包图片超过 96 MB', 413);
    entries.push({ name, data: bytes });
  }
  for (let i = 0; i < board.screenshots.length; i++) {
    const shot = board.screenshots[i], paths = shotFiles(shot, i);
    const original = await store.asset(shot.original.id);
    await add(paths.original, original);
    if (Object.hasOwn(rendered, shot.id) && rendered[shot.id]) {
      const annotation = decodeImage(rendered[shot.id]);
      if (annotation.mime !== 'image/png' || annotation.width !== shot.original.width || annotation.height !== shot.original.height) fail('批注图尺寸与原图不一致');
      await add(paths.annotated, annotation.bytes);
    } else {
      if (shot.tasks.length || shot.original.mime !== 'image/png') fail('请通过任务板导出，以生成完整批注图');
      await add(paths.annotated, original);
    }
    if (shot.after) await add(paths.after, await store.asset(shot.after.id));
    index.push({ id: shot.id, files: paths });
  }
  entries.push({ name: 'tasks.md', data: markdownForHandoff(board, handoff) });
  entries.push({ name: 'handoff.json', data: JSON.stringify(handoff, null, 2) });
  entries.push({ name: 'board.json', data: JSON.stringify({ ...board, snapshotPurpose:'完整背景快照；执行范围以 handoff.json 为准，未选任务不执行', handoff, exportedFiles: index }, null, 2) });
  entries.push({ name: 'README.txt', data: '截图任务交接包\n\n先阅读 tasks.md。只执行「本次执行任务」；待澄清任务需先询问用户；参考与未选任务不要重新修改。\nhandoff.json 是导出时的任务范围、板修订号和 UTC 时间快照。board.json 及全部图片是完整背景，不是额外执行清单。编号采用截图号.批注号，与编号图一致。\n交互问题需要操作验证，修改后截图仅为部分证据。按任务号回交改动、验证结果及遗留问题，由用户人工验收。\n此 ZIP 用于交接；恢复插件使用「备份 JSON」。本包不会自动执行代码。\n' });
  return createZip(entries);
}
