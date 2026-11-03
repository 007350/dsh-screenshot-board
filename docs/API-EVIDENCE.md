# DSH API 本地源码依据

核对日期：2026-11-03。只读取既有参考包，未修改参考包、profile 或运行安装命令。路径基准：C:/Users/zouxi/.dsh/profiles/desktop/node_modules/。

| 本插件能力 | 本地证据 |
| --- | --- |
| npm ESM Host、bundle patch、导出 ./client、platform/inject | dsh-pet/package.json、cordis.patch.yml；dsh-mobile-plugin/package.json |
| __ModuleLoader__.load({id,factory})、factory(require) 取 React | dsh-pet/src/client/index.ts:7 起；本插件仅以 React.createElement 承载入口 |
| locale.register / locale.bind / ctx.effect | dsh-pet/src/client/app.ts:67–74 起 |
| shell.overlay 插槽 | dsh-pet/src/client/app.ts:171–173 |
| settings.section 插槽 | dsh-pet/src/client/app.ts:178–183 |
| 设置组件可选 close 回调 | dsh-pet/lib/types/client/settings.d.ts:337–348，close?: () => void；启动工作台前关闭设置，使收起后露出原聊天界面 |
| Host 前缀路由注册 | dsh-pet/src/host/index.ts:2247–2255，ctx.effect / ctx.webServer.register({kind:'prefix',path,handler}) |
| resolveDshHome() 数据根 | dsh-pet/src/host/index.ts:102 导入、313 调用 |
| 同源相对 URL 保留代理 base path | dsh-mobile-plugin/lib/client.js 的 document-relative fetch；本插件通过 new URL('dsh-screenshot-board/api/', document.baseURI) 构造 API 根 |

更正旧归因：当前 dsh-mobile-plugin/lib/client.js:745 定义 sidebar.footer.action，1363–1374 附近注册该入口，已移除原设置入口。settings.section 以 dsh-pet 实际源码为准，不再引用 mobile 旧行为。

没有从本轮查阅的源码或声明核实专用「插件最小化」或「导航回聊天」服务；这不等于断言所有 DSH 版本都没有。方案使用普通 DOM：隐藏自身 .ssb-host，保留原实例与 root，经原 shell.overlay 入口恢复。不调用假定的窗口、会话或导航 API，关闭和插件卸载才 dispose。

隐藏的外层 host 显式使用 display:none；收起不阻塞于保存成功，也不重建编辑器。独立预览不具有 DSH 聊天环境。

发现当前 desktop/node_modules/dsh-screenshot-board 已有指向 D:/dsh-screenshot-board 的符号链接。这只能证明已有链接，不能证明任何版本的界面、接口或最小化已在 DSH 实机通过。本轮没有新增/删除链接、安装、重启或驱动 DSH。

包检查以 stub loader/context 验证注册契约；Client 浏览器 harness 加载真实 lib/client.js，但 slots/locale/React 外壳仍是模拟。二者都不能替代 DSH 实机验证。
