import { mountBoardApp } from './app.js';
const root = document.querySelector('#app');
root.tabIndex = -1;
const collapsed=document.createElement('div');collapsed.className='ssb ssb-preview-collapsed';collapsed.setAttribute('role','status');collapsed.textContent='截图任务板已收起，当前编辑已保留；点击右下角「恢复截图任务板」继续。';collapsed.hidden=true;document.body.append(collapsed);
const restore=document.createElement('button');restore.className='ssb-launcher';restore.textContent='▣ 恢复截图任务板';restore.setAttribute('aria-label','恢复截图任务板');restore.hidden=true;document.body.append(restore);
window.screenshotBoard = mountBoardApp(root,{minimizeLabel:'收起预览',onMinimize:()=>{root.hidden=true;collapsed.dataset.theme=root.dataset.theme;collapsed.hidden=false;restore.hidden=false;restore.focus();}});
restore.addEventListener('click',()=>{root.hidden=false;collapsed.hidden=true;restore.hidden=true;window.screenshotBoard.resume();});
