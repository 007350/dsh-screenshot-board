# 0.2.0 验证记录

日期：2026-11-03（Asia/Shanghai）。从 D:/dsh-screenshot-board 延续已有实现，在 D:/plugin/dsh-screenshot-board 完成隔离修改和验证，再将交付文件同步回原目录。当轮未运行 DSH 安装命令、未重启或驱动 DSH；交付后另在 desktop profile 实机安装并试用 0.2.0，结果见下表。未写入关联项目或用户任务板数据。

## 结果与证据边界

| 层级 | 本轮结果 | 证据 |
| --- | --- | --- |
| 模型 / 存储 / HTTP | 19/19 通过，覆盖新字段、状态默认范围、错误选择、复现缺项、修订冲突、实际 ZIP、完整备份/导入 | artifacts/node-tests.txt |
| 旧数据兼容 | 8 份旧测试板通过读取、保存、完整备份/导入；任务原文、要求、区域、状态和历史保持 | artifacts/legacy-results.json；只读原 artifacts/verification-data-20261102，输出隔离 |
| 原有浏览器流程 | 13 组通过，0 页面错误：框选/重画/排序、上传、EXIF、下载、导入重载、主题、1280px、保存冲突 | artifacts/ui-results.json；handoff.zip、board.backup.json、conflict.backup.json |
| 新交接浏览器流程 | 6 组通过，0 页面错误：项目背景、交互信息/确认、逐项范围/预览、空清单、备份与收起恢复 | artifacts/next-stage-results.json；next-stage-handoff.zip、next-stage-empty-scope.zip、截图 |
| 切板竞态 | 延迟保存期间同时打开交接并切板，新板就绪后旧 dialog 被移除 | artifacts/handoff-race-results.json |
| Client 注册与生命周期 | 包注册契约通过；真实 Client bundle 在 stub 外壳中验证设置 close 回调、隐藏、原 DOM 恢复、草稿、关闭及 effect 清理 | artifacts/client-lifecycle-results.json；check-package.mjs。**不是 DSH 实机** |
| 导出文件 | 实际下载 ZIP 的 CRC、图片解码及尺寸、范围 ID 完整分区、board/handoff 快照一致性通过 | artifacts/export-results.json、next-stage-export-results.json |
| 无前文 Agent 真实项目交接 | 2 项真实插件修改完成并提供前后截图，6 组检查通过；无需追问，未越界，尚待用户人工验收 | docs/REAL-AGENT-HANDOFF.md；artifacts/real-agent-validation/ |
| DSH 实机 | 0.2.0 已安装到 desktop profile 并试用通过 | 插件入口、工作台打开、收起恢复、交接流程由实机确认；GET /dsh-screenshot-board/api/session 返回 version=0.2.0。仅覆盖 Windows 与单一 profile |
| npm tarball / 源码归档 | 预构建 Client、patch 身份、声明依赖和运行文件检查；交付时解包核对内容并生成 SHA-256 | dist/ 中包、源码 ZIP、.sha256 和 delivery-manifest.json |

源工作目录的证据在 artifacts/。同步到原项目后，本轮证据放在 **artifacts/next-stage-20261103/**，避免覆盖历史证据。npm 包不包含测试数据、图片或浏览器证据；源码 ZIP 也不包含运行数据，证据留在源码目录。

## 可复现命令

```text
node scripts/build.mjs --esbuild-root D:/NodeGlobal/node_modules/vercel
node --test tests/*.test.mjs
node scripts/check-package.mjs
node scripts/preview.mjs --port 4388 --data-dir artifacts/next-stage-preview-data
node scripts/smoke-ui.mjs --playwright-root D:/explorepro --browser C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe --url http://127.0.0.1:4388/
node scripts/smoke-next-stage.mjs --playwright-root D:/explorepro --browser C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe --url http://127.0.0.1:4388/
node scripts/smoke-handoff-race.mjs --playwright-root D:/explorepro --browser C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe --url http://127.0.0.1:4388/
node scripts/smoke-client-lifecycle.mjs --playwright-root D:/explorepro --browser C:/Users/zouxi/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe --url http://127.0.0.1:4388/
node scripts/smoke-real-handoff.mjs
node scripts/verify-legacy.mjs --data-root D:/dsh-screenshot-board/artifacts/verification-data-20261102
python scripts/verify-export.py
python scripts/verify-export.py --archive artifacts/next-stage-handoff.zip --output artifacts/next-stage-export-results.json
npm pack --pack-destination dist --cache .npm-cache
```

浏览器命令按顺序运行，使用隔离数据，会创建测试板。复用已有 esbuild、Playwright、Chromium、Pillow，未安装依赖或浏览器。部分 Node 存储/HTTP 测试在沙箱中因 EPERM 原子重命名或 EACCES 本机连接失败；在获准的本机执行环境重跑后通过，未通过改动产品逻辑规避环境限制。

最后回归发现旧 smoke-ui 的文件选择器流程在异步上传完成前就读取板，断言可能看到上一状态；已改为等待对应 PUT 保存成功后再检查，重跑 13 组通过。新预览收起文案引起的旧选择器也已统一更新。

## 未验证与限制

- 已在 Windows + desktop profile 实机试用，但未覆盖其他 DSH 版本、其他平台与多 profile 并发；焦点陷阱、窗口层叠等细节仍以用户实际使用为准。本轮最小化只使用有依据的插槽和普通 DOM；未引入未核实 DSH API。
- 真实 Agent 交接针对本插件两个明确的小改动，不能推断所有复杂项目交接均有效；该次材料没有参考/澄清任务，三类混合范围另由模型、Host 和浏览器导出流程验证。
- 需求仍需用户确认；文字示例不等于用户同意具体规格。交互修复需要实际操作验证。程序与 Agent 均未替用户标记验收通过。
- 收起保留当前页面与草稿；关闭/重载/应用退出不保证保留未提交 DOM 文本。保存失败先备份。
- 旧 README 的 DSH 实机结论此前无法核实；本轮已实机复验 0.2.0，实机结论以本文件表格为准，范围仍限于 Windows 与单一 profile。
