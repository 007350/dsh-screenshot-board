# 截图任务板 0.2.0 实施计划

目标：在已有插件上，让无聊天背景的执行者能识别项目、执行范围、复现方法和未确认要求；交付源码与包，不安装。

架构：沿用纯 DOM Client、Host JSON 存储和 ZIP 导出。schemaVersion 1 增加可选字段，读取旧板时补默认值；交接使用共享的范围计算函数，预览和 Host 导出应用同一规则。最小化隐藏现有 DOM，恢复复用实例，不调用无源码依据的 DSH API。

工作副本：D:/plugin/dsh-screenshot-board，来源 D:/dsh-screenshot-board。完成后将变更同步回原项目；不复制或改写原 artifacts、用户板数据及 DSH profile。

1. **模型与范围**（src/core/board.js、src/core/handoff.js、tests/handoff.test.mjs）：先测试旧数据默认、背景字段、确认与复现缺项、五种状态默认范围、无效/重复/过期选择，再实现。运行 `node --test tests/*.test.mjs`。
2. **交接契约**（src/host/export.js、src/host/router.js、tests/router.test.mjs）：ZIP 同时提供明确的执行、待澄清、参考章节及 handoff.json 快照；校验修订号、选择和批注图。备份仍保留完整板。HTTP 测试覆盖真实导出与导入。
3. **编辑界面**（src/client/app.js、src/client/style.css）：项目背景分组、可选路径说明、轻量需求提示、交互复现字段、确认状态及逐任务交接选择/即时预览。不把模糊意见擅自写成已确认规格。
4. **收起恢复**（src/client/index.js、src/client/preview.js）：复用同一个工作台 DOM，保留选中项、视图、滚动、对话框和未提交文本；保存失败仍可收起和恢复。由包注册 harness 与浏览器流程验证，明确与 DSH 实机测试的区别。
5. **验证与交付**（scripts/smoke-ui.mjs、docs/API-EVIDENCE.md、docs/VALIDATION.md、README.md、package.json）：已有回归与新增流程、独立预览视觉检查、包结构与 tarball 内容/哈希检查。尽可能对本插件做真实无背景 Agent 交接；无法完成的验证明确列出。构建 0.2.0，打包，不安装。

验证边界：独立浏览器、Host HTTP、Client 注册 harness、DSH 实机和真实 Agent 执行分别记载。历史互相矛盾的安装表述不能作为本轮实机证据。

## 完成记录

步骤 1–5 已完成：19 项核心测试，原有 13 组与新增 6 组浏览器流程、Client 生命周期、切板竞态、8 份旧测试板兼容及实际 ZIP 验证通过。真实无背景 Agent 依据实际交接包完成本插件两项界面修复，未追问或越界，结果见 REAL-AGENT-HANDOFF.md。构建与 npm 包内容通过检查，源码和产物以哈希核对后同步回原项目。未安装或启动 DSH；实机表现与人工最终验收仍待用户验证。
