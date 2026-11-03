import { mountBoardApp, installStyle } from './app.js';
window.__ModuleLoader__.load({
  id: 'dsh-screenshot-board',
  factory(require) {
    const React = require('react');
    let instance = null, overlay = null;
    function open() {
      if(overlay?.isConnected) { overlay.hidden=false;instance?.resume();return; }
      installStyle();
      overlay = document.createElement('div'); overlay.className = 'ssb-host';
      const root = document.createElement('div');root.tabIndex = -1;overlay.append(root);document.body.append(overlay);
      instance = mountBoardApp(root,{onMinimize:()=>{overlay.hidden=true;document.querySelector('.ssb-launcher')?.focus();},onClose:()=>{instance?.dispose();overlay?.remove();instance=null;overlay=null;}});
      root.focus();
    }
    function Launcher() {
      return React.createElement('button',{className:'ssb-launcher',onClick:open,type:'button','aria-label':'打开或恢复截图任务板',title:'打开或恢复截图任务板；收起后保留当前编辑'},'▣ 截图任务板');
    }
    function Settings(props) {
      return React.createElement('div',{className:'ssb-setting-launch'},
        React.createElement('div',null,React.createElement('h3',null,'截图任务板'),React.createElement('p',null,'框选批注、整理修改任务、导出交接材料并逐项验收。')),
        React.createElement('button',{type:'button',onClick:()=>{props?.close?.();open();}},'打开工作台'));
    }
    return {
      name:'dsh-screenshot-board',
      inject:['slots','locale'],
      apply(ctx) {
        installStyle();
        ctx.effect(()=>ctx.locale.register('dsh-screenshot-board',{zh:{nav:'截图任务板'},en:{nav:'Screenshot Board'}}),'screenshot-board: locale');
        const t=ctx.locale.bind('dsh-screenshot-board');
        ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'dsh-screenshot-board',order:35,label:()=>t('nav')},Settings));
        ctx.slots.inject('shell.overlay',function*(){yield ctx.slots.register({name:'shell.overlay',id:'dsh-screenshot-board',order:900},Launcher);});
        ctx.effect(()=>()=>{instance?.dispose();overlay?.remove();instance=null;overlay=null;},'screenshot-board: workspace lifecycle');
      }
    };
  }
});
