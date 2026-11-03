import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const baseline = process.argv.includes('--baseline');
const output = resolve(root, 'artifacts/real-agent-validation');
const require = createRequire(resolve(arg('--playwright-root') || 'D:/explorepro', 'package.json'));
const { chromium } = require('playwright');
const url = arg('--url') || 'http://127.0.0.1:4388/';
const browserPath = arg('--browser') || 'C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' });
const page = await context.newPage();
const checks = [], errors = [], screenshots = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir(output, { recursive: true });
const record = name => { checks.push(name); console.log('PASS ' + name); };
const button = name => page.getByRole('button', { name, exact: true });
const input = name => page.getByRole('textbox', { name, exact: true });
const flush = () => page.evaluate(() => window.screenshotBoard.flush());
const capture = async name => { const file = name + '.png'; await page.screenshot({ path: resolve(output, file), animations: 'disabled' }); screenshots.push(file); };
const hash = value => createHash('sha256').update(value).digest('hex');
let bundleHash;
try {
  const served = await context.request.get(new URL('/preview.js', url).href);
  assert.equal(served.status(), 200);
  bundleHash = hash(await served.body());
  assert.equal(bundleHash, hash(await readFile(resolve(root, 'lib/preview.js'))));
  await page.goto(url);
  await page.evaluate(() => window.screenshotBoard.ready);
  await button('试用示例').click();
  await page.locator('.ssb-task-card').first().waitFor();
  await flush();

  if (baseline) {
    await page.locator('.ssb-header').getByRole('button', { name: '收起到聊天', exact: true }).click();
    assert.ok(await page.locator('#app').evaluate(node => node.hidden));
    assert.ok(await button('恢复截图任务板').isVisible());
    assert.equal(await page.locator('.ssb-preview-collapsed').count(), 0);
    await capture('before-1.1-minimized-1600');
    await button('恢复截图任务板').click();
    record('1.1 reproduced: standalone preview says 收起到聊天 and shows only restore after minimizing');
    await page.setViewportSize({ width: 800, height: 800 });
    assert.ok(!(await page.locator('[aria-label="项目背景"]').isVisible()));
    assert.ok(!(await page.locator('[aria-label="任务板设置"]').isVisible()));
    await capture('before-1.2-editor-800');
    record('1.2 reproduced: both background/settings entries are hidden at 800 × 800');
  } else {
    assert.ok(await page.locator('.ssb-header').getByRole('button', { name: '收起预览', exact: true }).isVisible());
    assert.equal(await button('收起到聊天').count(), 0);
    await page.getByRole('combobox', { name: '筛选任务状态', exact: true }).selectOption('review');
    await button('查看修改前后对比').click();
    await button('放大').click();
    await input('新增讨论记录').fill('1.1 未提交讨论：收起恢复后仍保留。');
    const zoom = await page.locator('.ssb-zoom-label').textContent();
    await page.evaluate(() => { window.retainedEditor = document.querySelector('[aria-label="新增讨论记录"]'); });
    await capture('after-1.1-editor-1600');
    await page.locator('.ssb-header').getByRole('button', { name: '收起预览', exact: true }).click();
    assert.ok(await page.locator('#app').evaluate(node => node.hidden));
    const hint = page.getByRole('status').filter({ hasText: '截图任务板已收起' });
    await hint.waitFor();
    assert.match(await hint.textContent(), /当前编辑已保留.*右下角.*恢复截图任务板/);
    assert.ok(await button('恢复截图任务板').isVisible());
    await capture('after-1.1-minimized-1600');
    await button('恢复截图任务板').click();
    assert.ok(!(await hint.isVisible()));
    assert.equal(await input('新增讨论记录').inputValue(), '1.1 未提交讨论：收起恢复后仍保留。');
    assert.ok(await page.evaluate(() => window.retainedEditor === document.querySelector('[aria-label="新增讨论记录"]')));
    assert.equal(await page.locator('.ssb-zoom-label').textContent(), zoom);
    assert.equal(await page.locator('.ssb-image-frame').count(), 2);
    assert.equal(await page.getByRole('combobox', { name: '筛选任务状态', exact: true }).inputValue(), 'review');
    record('1.1: preview label, explicit collapsed hint, restore, same DOM, discussion draft, filter, compare and zoom at 1600px');

    await page.setViewportSize({ width: 800, height: 800 });
    assert.ok(await button('项目背景').isVisible());
    const box = await button('项目背景').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 800 && box.y + box.height <= 800);
    assert.equal(await page.evaluate(() => document.body.scrollWidth), 800);
    await capture('after-1.2-editor-800');
    await button('项目背景').click();
    const settings = page.getByRole('dialog', { name: '任务板设置', exact: true });
    const initialStartup = await input('启动方式').inputValue();
    await input('启动方式').fill('取消草稿，不应写入任务板');
    await settings.getByRole('button', { name: '关闭', exact: true }).click();
    await button('项目背景').click();
    assert.equal(await input('启动方式').inputValue(), initialStartup);
    record('1.2: visible background entry opens the same settings dialog at 800 × 800; closing cancels its draft');

    const startup = 'node scripts/preview.mjs --port 4388（1.2 窄窗口保存验证）';
    await input('启动方式').fill(startup);
    await page.evaluate(() => { window.retainedSettings = document.querySelector('[aria-label="启动方式"]'); });
    await settings.getByRole('button', { name: '收起预览', exact: true }).click();
    await hint.waitFor();
    await capture('after-1.1-minimized-800');
    await button('恢复截图任务板').click();
    assert.equal(await input('启动方式').inputValue(), startup);
    assert.ok(await page.evaluate(() => window.retainedSettings === document.querySelector('[aria-label="启动方式"]')));
    await capture('after-1.2-context-800');
    await button('保存设置').click();
    await settings.waitFor({ state: 'hidden' });
    await flush();
    await page.reload();
    await page.evaluate(() => window.screenshotBoard.ready);
    await button('项目背景').click();
    assert.equal(await input('启动方式').inputValue(), startup);
    record('1.2: startup saved from 800px dialog survives refresh; settings draft also survives minimize/restore');

    const retryStartup = startup + '；失败重试后保存';
    await input('启动方式').fill(retryStartup);
    const failSave = async route => {
      if (route.request().method() === 'PUT') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '验证注入：保存暂时失败' }) });
      else await route.continue();
    };
    await page.route('**/dsh-screenshot-board/api/boards/*', failSave);
    await button('保存设置').click();
    await page.locator('.ssb-toast.is-error').waitFor();
    assert.ok(await settings.isVisible());
    assert.equal(await input('启动方式').inputValue(), retryStartup);
    await settings.getByRole('button', { name: '收起预览', exact: true }).click();
    await hint.waitFor();
    await button('恢复截图任务板').click();
    assert.equal(await input('启动方式').inputValue(), retryStartup);
    await capture('after-save-failure-retained-800');
    await page.unroute('**/dsh-screenshot-board/api/boards/*', failSave);
    await button('保存设置').click();
    await settings.waitFor({ state: 'hidden' });
    await flush();
    await page.reload();
    await page.evaluate(() => window.screenshotBoard.ready);
    await button('项目背景').click();
    assert.equal(await input('启动方式').inputValue(), retryStartup);
    await settings.getByRole('button', { name: '关闭', exact: true }).click();
    record('1.1/1.2: injected HTTP 503 keeps settings and edits, permits minimize/restore, then retry persists after refresh');

    await page.setViewportSize({ width: 1600, height: 1000 });
    await button('项目背景').click();
    assert.equal(await input('启动方式').inputValue(), retryStartup);
    await capture('after-1.2-context-1600');
    await settings.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.ssb-task-card').first().click();
    await capture('after-editor-1600');
    assert.equal(await page.evaluate(() => document.body.scrollWidth), 1600);
    record('1.2: 1600px workspace and original background dialog remain usable without body overflow');

    const client = await context.newPage();
    client.on('pageerror', e => errors.push(e.message));
    const clientCode = await readFile(resolve(root, 'lib/client.js'), 'utf8');
    await client.addInitScript(() => { window.__ModuleLoader__ = { load: descriptor => { window.clientDescriptor = descriptor; } }; });
    await client.route('**/handoff-client-check', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/handoff-client.js"></script></body></html>' }));
    await client.route('**/handoff-client.js', route => route.fulfill({ contentType: 'text/javascript', body: clientCode }));
    await client.goto(new URL('/handoff-client-check', url).href);
    await client.waitForFunction(() => !!window.clientDescriptor);
    await client.evaluate(() => {
      const plugin = window.clientDescriptor.factory(() => ({ createElement: (type, props, ...children) => ({ type, props, children }) }));
      plugin.apply({
        locale: { register() {}, bind: () => value => value },
        effect: fn => fn(),
        slots: {
          inject(name, fn) { const value = fn(); if (value?.next) Array.from(value); },
          register(meta, component) { if (meta.name === 'shell.overlay') window.clientLauncher = component; return () => {}; }
        }
      });
      window.clientLauncher().props.onClick();
    });
    const clientHeader = client.locator('.ssb-header');
    await clientHeader.getByRole('button', { name: '收起到聊天', exact: true }).waitFor();
    assert.equal(await client.getByRole('button', { name: '收起预览', exact: true }).count(), 0);
    await client.getByRole('button', { name: '项目背景', exact: true }).click();
    await client.getByRole('dialog', { name: '任务板设置', exact: true }).getByRole('button', { name: '收起到聊天', exact: true }).waitFor();
    await client.getByRole('button', { name: '关闭', exact: true }).click();
    await client.locator('.ssb-task-card').first().click();
    await client.getByRole('textbox', { name: '新增讨论记录', exact: true }).fill('Client 默认挂载的未提交讨论');
    await client.evaluate(() => { window.clientEditor = document.querySelector('[aria-label="新增讨论记录"]'); });
    await clientHeader.getByRole('button', { name: '收起到聊天', exact: true }).click();
    assert.ok(await client.locator('.ssb-host').evaluate(node => node.hidden));
    await client.evaluate(() => window.clientLauncher().props.onClick());
    assert.equal(await client.getByRole('textbox', { name: '新增讨论记录', exact: true }).inputValue(), 'Client 默认挂载的未提交讨论');
    assert.ok(await client.evaluate(() => window.clientEditor === document.querySelector('[aria-label="新增讨论记录"]')));
    const clientScreenshot = 'after-client-default-harness-1600.png';
    await client.screenshot({ path: resolve(output, clientScreenshot), animations: 'disabled' });
    screenshots.push(clientScreenshot);
    await client.close();
    record('1.1: compiled Client in a local loader/React harness defaults to 收起到聊天 in toolbar/dialog and retains the same DOM on collapse/restore (not an actual DSH run)');
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, baseline ? 'baseline.json' : 'results.json'), JSON.stringify({ kind: 'standalone-browser-preview', baseline, url, viewportSizes: ['1600x1000', '800x800'], browser: browserPath, previewBundleSha256: bundleHash, time: new Date().toISOString(), checks, errors, screenshots, actualDshRun: false }, null, 2) + '\n');
} catch (error) {
  await capture(baseline ? 'baseline-unexpected-failure' : 'unexpected-failure').catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ baseline, time: new Date().toISOString(), error: error.stack, checks, errors, screenshots }, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
