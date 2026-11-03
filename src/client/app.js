import { createTask, uid, rectFromPoints, STATUSES, PRIORITIES, CONTEXT_FIELDS, MAX_IMAGE_BYTES, FORMAT } from '../core/board.js';
import { handoffForBoard, markdownForHandoff, taskIssues } from '../core/handoff.js';
import { el, icon, fileData, loadImage, download, fileName, readPref, writePref } from './dom.js';
import { demoScreenshot } from './demo.js';
import css from './style.css';
export function installStyle() {
  if (!document.querySelector('style[data-ssb-style]')) document.head.append(el('style', { 'data-ssb-style': '', text: css }));
}
export function mountBoardApp(root, options = {}) {
  installStyle(); root.classList.add('ssb');
  const minimizeLabel = options.minimizeLabel || '收起到聊天';
  root.dataset.theme = readPref('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const apiBase = new URL('dsh-screenshot-board/api/', document.baseURI);
  const state = { boards: [], board: null, shotId: null, taskId: null, mode: 'rect', view: 'original', zoom: null, filter: 'all', changes: 0, saved: 0, saving: null, timer: null, error: '', busy: false, redrawTaskId: null, disposed: false, suspended: false, dialog: null };
  const abort = new AbortController();
  let token = '', toastTimer, saveLabel, nav, taskPane, stage, footer, tools, tabs;
  const app = el('div', { class: 'ssb-app' }), notice = el('div', { class: 'ssb-toast', role: 'status', 'aria-live': 'polite', hidden: true });
  root.replaceChildren(app, notice);
  function toast(message, error = false) {
    if(state.disposed) return;
    notice.textContent = message; notice.classList.toggle('is-error', error); notice.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { notice.hidden = true; }, error ? 8000 : 3500);
  }
  function button(label, symbol, action, className = '', attrs = {}) {
    const b = el('button', { type: 'button', class: 'ssb-btn ' + className, title: label, 'aria-label': label, ...attrs }, symbol ? icon(symbol) : null, el('span', { text: label }));
    if(action) b.addEventListener('click', async () => {
      if(b.disabled) return; b.disabled = true;
      try { await action(); } catch(e) { if(e.name !== 'AbortError') toast(e.message || '操作失败', true); }
      finally { if(b.isConnected) b.disabled = false; }
    });
    return b;
  }
  async function api(path, method = 'GET', body) {
    const response = await fetch(new URL(path, apiBase), { method, credentials: 'same-origin', signal: abort.signal,
      headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-screenshot-board-token': token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if(!response.ok) { let msg; try { msg = (await response.json()).error; } catch {} throw Object.assign(new Error(msg || '请求失败：' + response.status), { status: response.status }); }
    return response.headers.get('content-type')?.includes('application/json') ? response.json() : response.blob();
  }
  const shot = () => state.board?.screenshots.find(s => s.id === state.shotId);
  const task = () => shot()?.tasks.find(t => t.id === state.taskId);
  const assetUrl = asset => new URL('assets/' + asset.id, apiBase).href;
  function updateSaveStatus() {
    if(!saveLabel) return;
    saveLabel.textContent = state.error ? '保存失败 · 点击重试' : state.saving ? '正在保存…' : state.changes !== state.saved ? '等待保存…' : state.board ? '已保存到本机' : '数据保存在本机';
    saveLabel.classList.toggle('is-error', !!state.error);saveLabel.classList.toggle('is-dirty', state.changes !== state.saved);
  }
  function changed() {
    state.changes++;state.error = '';updateSaveStatus();clearTimeout(state.timer);
    state.timer = setTimeout(() => { flush().catch(e => toast(e.message, true)); }, 600);renderCounts();
  }
  async function flush() {
    clearTimeout(state.timer);if(state.saving) await state.saving;
    if(!state.board || state.saved === state.changes) return;
    const current = state.board;
    const pending = (async () => {
      while(!state.disposed && state.board === current && state.saved !== state.changes) {
        const version = state.changes, snapshot = structuredClone(current), saved = await api('boards/' + current.id, 'PUT', snapshot);
        if(state.board !== current) return;
        current.revision=saved.revision;current.updatedAt=saved.updatedAt;current.createdAt=saved.createdAt;
        state.saved=version;state.error='';
        const summary={id:current.id,title:current.title,projectPath:current.projectPath,updatedAt:current.updatedAt,screenshots:current.screenshots.length,tasks:current.screenshots.reduce((n,s)=>n+s.tasks.length,0),accepted:current.screenshots.flatMap(s=>s.tasks).filter(t=>t.status==='accepted').length};
        state.boards=[summary,...state.boards.filter(b=>b.id!==current.id)];renderNav();
      }
    })();
    state.saving=pending;updateSaveStatus();
    try{await pending;}catch(e){state.error=e.message;throw e;}finally{if(state.saving===pending)state.saving=null;updateSaveStatus();}
  }
  async function openBoard(id) {
    await flush();const board=await api('boards/'+id);if(state.disposed)return;
    closeDialog();
    state.board=board;state.shotId=board.screenshots[0]?.id;state.taskId=null;state.redrawTaskId=null;state.changes=state.saved=0;state.error='';state.view='original';state.zoom=null;
    writePref('board',id);render();
  }
  async function createNew(values={}) {
    await flush();const board=await api('boards','POST',{title:values.title||'新任务板',projectPath:values.projectPath||''});
    state.boards=await api('boards');await openBoard(board.id);return state.board;
  }
  function closeDialog(){state.dialog?.remove();state.dialog=null;}
  function dialog(title,content,actions=[]) {
    closeDialog();
    const box=el('div',{class:'ssb-dialog',role:'dialog','aria-modal':'true','aria-label':title},
      el('div',{class:'ssb-dialog-head'},el('h2',{text:title}),el('div',{class:'ssb-header-actions'},options.onMinimize?button(minimizeLabel,'down',minimize):null,button('关闭','close',closeDialog,'ssb-icon-only'))),
      el('div',{class:'ssb-dialog-body'},content),actions.length?el('div',{class:'ssb-dialog-actions'},actions):null);
    const overlay=el('div',{class:'ssb-dialog-overlay'},box);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeDialog();});root.append(overlay);state.dialog=overlay;
    setTimeout(()=>box.querySelector('input, textarea, button')?.focus(),0);return box;
  }
  function field(label,input,help){return el('label',{class:'ssb-field'},el('span',{class:'ssb-field-label',text:label}),input,help?el('small',{text:help}):null);}
  function newBoardDialog() {
    if(state.busy)return toast('请等待图片处理完成');
    const title=el('input',{value:'新的界面修改',maxlength:120,'aria-label':'任务板名称'}),path=el('input',{placeholder:'例如 D:\\projects\\my-app',maxlength:1000,'aria-label':'项目路径'});
    dialog('新建任务板',el('div',{},field('任务板名称',title),field('关联项目路径（可选）',path,'通常填写真实、完整的项目根目录。仅写入交接材料，不检查目录或读写项目；填错不影响截图批注，但可能让 Agent 找错项目。')),[button('创建任务板','plus',async()=>{await createNew({title:title.value.trim()||'新任务板',projectPath:path.value.trim()});closeDialog();},'ssb-primary')]);
  }
  function pickFile(accept,callback,multiple=false) {
    const input=el('input',{type:'file',accept,multiple,hidden:true});root.append(input);
    input.addEventListener('change',async()=>{try{if(input.files?.length)await callback([...input.files]);}catch(e){toast(e.message,true);}finally{input.remove();}},{once:true});
    input.addEventListener('cancel',()=>input.remove(),{once:true});input.click();
  }
  async function uploadFile(file){
    if(!['image/png','image/jpeg'].includes(file.type))throw new Error('请选择 PNG 或 JPEG 图片');
    if(file.size>MAX_IMAGE_BYTES)throw new Error('单张图片不能超过 8 MB');
    let dataUrl=await fileData(file);const image=await loadImage(dataUrl);
    if(image.naturalWidth>16000||image.naturalHeight>16000||image.naturalWidth*image.naturalHeight>64000000)throw new Error('图片像素过大，请先缩小到 16000 px / 6400 万像素以内');
    if(file.type==='image/jpeg'){
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      canvas.getContext('2d').drawImage(image,0,0);dataUrl=canvas.toDataURL('image/jpeg',.96);
      if(dataUrl.length>MAX_IMAGE_BYTES*1.4)throw new Error('JPEG 方向规范化后超过 8 MB，请缩小图片');
    }
    return api('assets','POST',{dataUrl,name:file.name});
  }
  async function addFiles(files,after=false) {
    if(state.busy)throw new Error('请等待当前图片处理完成');state.busy=true;
    try{
      if(!state.board)await createNew({title:'截图修改任务'});
      const current=state.board;if(after&&!shot())throw new Error('请先添加原始截图');
      if(!after&&current.screenshots.length+files.length>12)throw new Error('一个任务板最多 12 张截图');
      const target=shot();
      const chosen=after?files.slice(0,1):files;
      for(const file of chosen){
        if(!['image/png','image/jpeg'].includes(file.type)||file.size>MAX_IMAGE_BYTES)throw new Error('请选择不超过 8 MB 的 PNG/JPEG 图片');
      }
      const uploaded=[];
      for(const file of chosen)uploaded.push({file,asset:await uploadFile(file)});
      if(state.board!==current)throw new Error('任务板已经切换，请重新添加图片');
      for(const {file,asset}of uploaded){
        if(after){target.after=asset;state.view='compare';break;}
        const s={id:uid(),title:file.name.replace(/\.[^.]+$/,'').slice(0,120)||'截图',original:asset,after:null,tasks:[]};
        current.screenshots.push(s);state.shotId=s.id;state.taskId=null;state.view='original';
      }
      state.zoom=null;changed();render();await flush();toast(after?'修改后截图已添加，可以逐项验收':'截图已添加，在图片上拖动即可框选');
    }finally{state.busy=false;renderNav();}
  }
  const pickScreenshots=()=>pickFile('image/png,image/jpeg',files=>addFiles(files),true);
  const pickAfter=()=>pickFile('image/png,image/jpeg',files=>addFiles(files,true));
  async function sample(){
    if(state.busy)return;state.busy=true;
    try{
      await createNew({title:'Northstar · 界面体验优化'});const current=state.board;
      current.description='演示任务板。所有截图和修改点均为虚构示例，可自由编辑或删除。';
      const original=await api('assets','POST',{dataUrl:demoScreenshot(),name:'示例-项目总览.png'}),after=await api('assets','POST',{dataUrl:demoScreenshot(true),name:'示例-修改后.png'});
      const a=createTask({x:.637,y:.505,w:.044,h:.318},1);
      Object.assign(a,{title:'收纳高风险操作',note:'删除按钮紧挨着项目列表，容易误触。',requirement:'把删除操作移到每行的更多菜单，保留二次确认。',acceptance:'默认列表不直接显示删除按钮；更多菜单能找到删除操作，取消确认不删除项目。',priority:'high',status:'review'});
      const b=createTask({x:.211,y:.526,w:.403,h:.361},2);
      Object.assign(b,{title:'让项目列表更紧凑',note:'项目之间的间距有些大，浏览时信息密度偏低。',requirement:'适当缩小行间距，保持项目名称和最近更新时间清晰可读。',acceptance:'桌面视图能同时看到四行项目，文字不重叠、不截断。'});
      const c=createTask({x:.731,y:.471,w:.231,h:.403},3);
      Object.assign(c,{title:'提高动态文字的对比度',note:'团队动态的次要信息有点浅。',requirement:'提高正文和时间文字的可读性，保留两级信息层次。',acceptance:'浅色主题下正文和时间均可辨认。',priority:'low'});
      for(const t of [a,b,c])t.clarity='confirmed';
      current.screenshots.push({id:uid(),title:'项目总览 · 演示截图',original,after,tasks:[a,b,c]});
      state.shotId=current.screenshots[0].id;state.taskId=a.id;state.zoom=null;changed();render();await flush();toast('演示任务板已创建，可试着修改批注');
    }finally{state.busy=false;renderNav();}
  }
  function renderNav(){
    if(!nav)return;
    nav.replaceChildren(
      el('div',{class:'ssb-nav-heading'},el('span',{text:'我的任务板'}),el('span',{class:'ssb-muted',text:state.boards.length})),button('新建任务板','plus',newBoardDialog,'ssb-new-board'),
      el('div',{class:'ssb-board-list'},state.boards.map(b=>{
        const card=button(b.title,'folder',()=>openBoard(b.id),'ssb-board-card'+(b.id===state.board?.id?' is-active':''),{disabled:state.busy});
        card.querySelector('span').append(el('small',{text:(b.screenshots||0)+' 张截图 · '+(b.tasks||0)+' 个任务'}));return card;
      })),
      el('div',{class:'ssb-nav-bottom'},
        button('导入备份','upload',()=>pickFile('.json,application/json',async files=>{
          if(state.busy)throw new Error('请等待图片处理完成');
          if(files[0].size>72*1024*1024)throw new Error('备份文件超过 72 MB');
          await flush();const result=await api('import','POST',JSON.parse(await files[0].text()));state.boards=await api('boards');await openBoard(result.id);toast('任务板已恢复为独立副本');
        })),button('试用示例','sparkle',sample),el('div',{class:'ssb-local-note'},el('span',{class:'ssb-dot'}),'本机保存 · 项目文件保持原样')));
  }
  function renderCounts(){
    if(!footer||!state.board)return;
    const tasks=state.board.screenshots.flatMap(s=>s.tasks),accepted=tasks.filter(t=>t.status==='accepted').length;
    footer.textContent=state.board.screenshots.length+' 张截图  /  '+tasks.length+' 个修改点  /  '+accepted+' 项已验收';
    const bar=root.querySelector('.ssb-progress-fill');if(bar)bar.style.width=(tasks.length?accepted/tasks.length*100:0)+'%';
  }
  function boardSettings(){
    if(state.busy)return toast('请等待图片处理完成');
    const board=state.board,title=el('input',{value:board.title,maxlength:120,'aria-label':'任务板名称'}),path=el('input',{value:board.projectPath,maxlength:1000,'aria-label':'项目路径',placeholder:'例如 D:\\projects\\my-app'}),description=el('textarea',{value:board.description,rows:4,maxlength:8000,'aria-label':'项目说明',placeholder:'项目背景、执行限制和其他交接说明'});
    const contextInputs=Object.fromEntries(Object.entries(CONTEXT_FIELDS).map(([key,label])=>[key,el('textarea',{value:board.context[key],rows:key==='startup'||key==='scope'?3:2,maxlength:6000,'aria-label':label,placeholder:({startup:'例如 npm run dev；在哪个目录运行？',url:'例如 http://localhost:3000',entry:'例如 侧栏 → 项目 → 列表',conditions:'测试账号、登录状态、数据或前置操作；不要填写密码',files:'例如 src/pages/Projects.js（仅是待核实的线索）',scope:'允许改哪些目录？哪些行为需要保留？',unknowns:'例如 尚不知道列表组件在哪个文件'})[key]})]));
    dialog('任务板设置',el('div',{},field('名称',title),field('项目路径（可选）',path,'通常填写真实、完整的项目根目录。仅记录，不检查、打开或修改项目。错误路径不影响批注，但会影响 Agent 定位。'),field('项目用途与说明',description),
      el('p',{class:'ssb-hint',text:'背景可以逐步补充并在后续交接复用。以下均为用户记录，插件没有验证；留空会在说明中标为未知/待补充。'}),
      Object.entries(CONTEXT_FIELDS).map(([key,label])=>field(label,contextInputs[key]))),[
      button('删除任务板','trash',async()=>{
        if(!confirm('删除这个任务板及其任务记录？建议先导出备份。'))return;
        await flush();await api('boards/'+board.id,'DELETE',{revision:board.revision});state.board=null;state.boards=await api('boards');state.changes=state.saved=0;closeDialog();render();toast('任务板已删除');
      },'ssb-danger'),
      button('保存设置','check',async()=>{
        board.title=title.value.trim()||'未命名任务板';board.projectPath=path.value.trim();board.description=description.value;
        for(const key of Object.keys(CONTEXT_FIELDS))board.context[key]=contextInputs[key].value;
        changed();await flush();closeDialog();render();
      },'ssb-primary')]);
  }
  function render(){
    const b=state.board;app.replaceChildren();
    const header=el('header',{class:'ssb-header'},
      el('div',{class:'ssb-brand'},el('div',{class:'ssb-brand-mark'},icon('frame',22)),el('div',{},el('strong',{text:'截图任务板'}),el('small',{text:'FRAMEBOARD / DSH'}))),
      el('div',{class:'ssb-breadcrumb'},el('span',{text:'工作空间'}),el('span',{text:'/'}),el('strong',{text:b?.title||'开始新的修改'})),
      el('div',{class:'ssb-header-actions'},button('切换明暗主题',root.dataset.theme==='dark'?'sun':'moon',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';writePref('theme',root.dataset.theme);},'ssb-icon-only'),
        b?button('交接与导出','download',handoff,'ssb-primary'):null,
        options.onMinimize?button(minimizeLabel,'down',minimize,'ssb-minimize',{title:'仅收起截图任务板，保留当前编辑；点击悬浮入口恢复'}):null,
        options.onClose?button('关闭工作台','close',async()=>{await flush();options.onClose();},'ssb-icon-only'):null));
    nav=el('aside',{class:'ssb-nav','aria-label':'任务板列表'});const content=el('main',{class:'ssb-main'}),bottom=el('footer',{class:'ssb-footer'});
    footer=el('span',{class:'ssb-foot-count'});saveLabel=el('button',{class:'ssb-save-status',type:'button',onclick:()=>flush().catch(e=>toast(e.message,true))});
    bottom.append(footer,el('span',{class:'ssb-foot-tip',text:'框选标记 · 任务交接 · 逐项验收'}),saveLabel);
    app.append(header,el('div',{class:'ssb-body'},nav,content),bottom);renderNav();updateSaveStatus();
    if(!b){
      content.append(el('div',{class:'ssb-welcome'},el('div',{class:'ssb-welcome-symbol'},icon('frame',44)),el('div',{class:'ssb-eyebrow',text:'从一张截图开始'}),
        el('h1',{text:'把「这里改一下」\n变成清晰的修改任务。'}),el('p',{text:'圈出需要调整的位置，留下你的想法。\n让下一个 Agent 带着完整的背景接手。'}),
        el('div',{class:'ssb-welcome-actions'},button('添加第一张截图','upload',pickScreenshots,'ssb-primary ssb-large'),button('先看看示例','sparkle',sample,'ssb-large')),
        el('div',{class:'ssb-flow'},['01  添加截图','02  框选批注','03  整理任务','04  交接验收'].map(t=>el('span',{text:t}))),el('small',{class:'ssb-muted',text:'支持 PNG / JPEG · 单张最多 8 MB · 可粘贴或拖入图片'})));
      footer.textContent='准备好开始了吗？';return;
    }
    const meta=el('section',{class:'ssb-board-meta'},
        el('div',{},el('div',{class:'ssb-eyebrow',text:'SCREENSHOT → TASK → HANDOFF'}),el('h1',{text:b.title}),el('p',{text:b.projectPath||'项目路径可选；可在项目背景中逐步补充'})),
      el('div',{class:'ssb-meta-actions'},button('项目背景','folder',boardSettings),button('任务板设置','more',boardSettings,'ssb-icon-only'),el('span',{class:'ssb-board-tag',text:'本地任务板'})));
    tools=el('div',{class:'ssb-tools'});tabs=el('div',{class:'ssb-shot-tabs'});stage=el('div',{class:'ssb-stage',tabindex:0,'aria-label':'截图画布'});
    const workspace=el('section',{class:'ssb-canvas-area'},tools,stage,tabs);taskPane=el('aside',{class:'ssb-inspector','aria-label':'修改任务'});
    content.append(meta,el('div',{class:'ssb-workspace'},workspace,taskPane));
    renderTools();renderTabs();renderCanvas();renderInspector();renderCounts();
  }
  function setMode(mode){state.mode=mode;if(mode!=='rect')state.redrawTaskId=null;renderTools();stage?.classList.toggle('is-pan',mode==='pan');}
  function renderTools(){
    if(!tools)return;const s=shot(),modes=el('div',{class:'ssb-tool-group'},
      button('框选','frame',()=>setMode('rect'),'ssb-tool'+(state.mode==='rect'?' is-active':'')),button('选择','arrow',()=>setMode('select'),'ssb-tool'+(state.mode==='select'?' is-active':'')),button('移动','hand',()=>setMode('pan'),'ssb-tool'+(state.mode==='pan'?' is-active':'')));
    const views=el('div',{class:'ssb-segment'});
    for(const [value,label]of[['original','修改前'],['after','修改后'],['compare','对比']])views.append(button(label,value==='compare'?'compare':null,()=>{
      if(value!=='original'&&!s?.after)return pickAfter();state.view=value;state.zoom=null;renderTools();renderCanvas();
    },state.view===value?'is-active':'',{disabled:!s}));
    tools.replaceChildren(modes,views,el('div',{class:'ssb-zoom'},button('缩小',null,()=>zoomBy(-.1),'ssb-icon-only',{text:'−'}),el('span',{class:'ssb-zoom-label',text:state.zoom?Math.round(state.zoom*100)+'%':'适应'}),button('放大','plus',()=>zoomBy(.1),'ssb-icon-only'),button('适应画布',null,()=>{state.zoom=null;renderTools();renderCanvas();},'ssb-fit')));
  }
  function zoomBy(delta){if(!shot())return;state.zoom=Math.max(.1,Math.min(3,(state.zoom||fitScale())+delta));renderTools();renderCanvas();}
  function fitScale(){
    const s=shot();if(!s||!stage)return 1;const compare=state.view==='compare'&&s.after;
    const a=state.view==='after'&&s.after?s.after:s.original,width=compare?s.original.width+s.after.width:a.width,height=compare?Math.max(s.original.height,s.after.height):a.height;
    return Math.max(.05,Math.min(1,(stage.clientWidth-(compare?100:64))/width,(stage.clientHeight-80)/height));
  }
  function renderTabs(){
    if(!tabs)return;
    tabs.replaceChildren(...state.board.screenshots.map((s,i)=>{
      const b=button(s.title,null,()=>{state.shotId=s.id;state.taskId=null;state.redrawTaskId=null;state.zoom=null;state.view='original';renderTabs();renderTools();renderCanvas();renderInspector();},'ssb-shot-tab'+(s.id===state.shotId?' is-active':''));
      b.prepend(el('span',{class:'ssb-shot-index',text:String(i+1).padStart(2,'0')}));b.append(el('span',{class:'ssb-tab-count',text:s.tasks.length}));return b;
    }),button('添加截图','plus',pickScreenshots,'ssb-add-shot'));
  }
  function renderCanvas(){
    if(!stage)return;const s=shot();stage.replaceChildren();stage.classList.toggle('is-pan',state.mode==='pan');
    if(!s){stage.append(el('div',{class:'ssb-canvas-empty'},icon('image',44),el('h2',{text:'添加需要修改的界面截图'}),el('p',{text:'拖入图片，或粘贴剪贴板中的截图'}),button('选择截图','upload',pickScreenshots,'ssb-primary')));return;}
    const scale=state.zoom||fitScale(),surface=el('div',{class:'ssb-surface'+(state.view==='compare'?' is-compare':'')});
    const images=state.view==='compare'&&s.after?[[s.original,true,'修改前'],[s.after,false,'修改后']]:[[state.view==='after'&&s.after?s.after:s.original,state.view!=='after',state.view==='after'?'修改后':'修改前']];
    for(const [asset,annotate,label]of images){
      const frame=el('div',{class:'ssb-image-frame','data-shot-id':s.id,style:'width:'+(asset.width*scale)+'px;height:'+(asset.height*scale)+'px'}),img=el('img',{src:assetUrl(asset),alt:s.title+' · '+label,draggable:false});
      img.addEventListener('error',()=>toast('截图加载失败，请检查图片数据是否仍在本机',true),{once:true});frame.append(img);
      if(annotate){
        for(const [i,t]of s.tasks.entries()){
          const r=t.rect,mark=el('button',{type:'button',class:'ssb-mark'+(t.id===state.taskId?' is-selected':'')+(t.status==='accepted'?' is-accepted':''),style:'left:'+r.x*100+'%;top:'+r.y*100+'%;width:'+r.w*100+'%;height:'+r.h*100+'%;','aria-label':'批注 '+(i+1)+'：'+t.title,'data-task-id':t.id},el('span',{class:'ssb-mark-badge',text:i+1}));
          if(state.redrawTaskId)mark.style.pointerEvents='none';
          mark.addEventListener('pointerdown',e=>{if(state.mode!=='pan')e.stopPropagation();});
          mark.addEventListener('click',e=>{if(state.mode==='pan')return;e.stopPropagation();state.taskId=t.id;renderCanvas();renderInspector();});frame.append(mark);
        }bindDrawing(frame);
      }surface.append(el('div',{class:'ssb-image-column'},el('div',{class:'ssb-image-label',text:label+(annotate?' · 拖动框选添加修改点':' · 验收参考')}),frame));
    }
    stage.append(surface);stage.onpointerdown=e=>{
      if(!(state.mode==='pan'||e.button===1)||e.button===2)return;e.preventDefault();
      const start={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};stage.setPointerCapture(e.pointerId);
      stage.onpointermove=event=>{stage.scrollLeft=start.left-(event.clientX-start.x);stage.scrollTop=start.top-(event.clientY-start.y);};
      const end=()=>{stage.onpointermove=null;stage.onpointerup=null;stage.onpointercancel=null;};stage.onpointerup=end;stage.onpointercancel=end;
    };
    stage.onwheel=e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoomBy(e.deltaY>0?-.1:.1);}};
  }
  function bindDrawing(frame){
    frame.addEventListener('pointerdown',e=>{
      if(state.mode!=='rect'||e.button!==0)return;e.preventDefault();e.stopPropagation();
      const bounds=frame.getBoundingClientRect(),point=event=>({x:(event.clientX-bounds.left)/bounds.width,y:(event.clientY-bounds.top)/bounds.height}),start=point(e),draft=el('div',{class:'ssb-draft'});frame.append(draft);frame.setPointerCapture(e.pointerId);
      let rect=null;frame.onpointermove=event=>{rect=rectFromPoints(start,point(event));draft.style.cssText='left:'+rect.x*100+'%;top:'+rect.y*100+'%;width:'+rect.w*100+'%;height:'+rect.h*100+'%;';};
      const clean=()=>{frame.onpointermove=null;frame.onpointerup=null;frame.onpointercancel=null;draft.remove();};frame.onpointercancel=clean;
      frame.onpointerup=event=>{
        rect=rectFromPoints(start,point(event));clean();if(rect.w*bounds.width<8||rect.h*bounds.height<8)return;
        const s=shot();if(s.tasks.length>=100){toast('当前截图修改点过多，请拆分任务板',true);return;}
        let t=s.tasks.find(t=>t.id===state.redrawTaskId);
        if(t){t.rect=rect;state.redrawTaskId=null;toast('标注区域已更新，任务内容保持不变');}
        else{t=createTask(rect,s.tasks.length+1);s.tasks.push(t);}
        state.taskId=t.id;changed();renderTabs();renderCanvas();renderInspector();taskPane.querySelector('[aria-label="任务标题"]')?.focus();
      };
    });
  }
  function renderTaskList(){
    const holder=taskPane?.querySelector('.ssb-task-list');if(!holder)return;
    const s=shot(),tasks=s?.tasks||[],shown=tasks.filter(t=>state.filter==='all'||t.status===state.filter);
    holder.replaceChildren(...shown.map(t=>{
      const n=tasks.indexOf(t)+1,b=el('button',{type:'button',class:'ssb-task-card'+(t.id===state.taskId?' is-active':''),'data-card-task-id':t.id,'aria-label':'选择任务 '+n+' '+t.title},
        el('span',{class:'ssb-number'+(t.status==='accepted'?' is-accepted':''),text:t.status==='accepted'?'✓':String(n).padStart(2,'0')}),
        el('div',{class:'ssb-task-card-text'},el('strong',{text:t.title||'未命名修改点'}),el('small',{},el('span',{class:'ssb-status-dot status-'+t.status}),STATUSES[t.status],el('span',{class:'ssb-priority',text:taskIssues(t).length?'待澄清':PRIORITIES[t.priority]+'优先级'}))),icon('down',14));
      b.addEventListener('click',()=>{state.taskId=t.id;renderCanvas();renderInspector();});return b;
    }));
    if(!shown.length)holder.append(el('div',{class:'ssb-list-empty',text:tasks.length?'这个筛选下还没有任务':'在截图上框选一个区域，添加第一个修改点。'}));
    const count=taskPane.querySelector('.ssb-task-count');if(count)count.textContent=tasks.length;
  }
  function renderInspector(){
    if(!taskPane)return;const s=shot(),t=task(),filter=el('select',{'aria-label':'筛选任务状态',onchange:e=>{state.filter=e.target.value;renderTaskList();}},el('option',{value:'all',text:'全部状态'}),Object.entries(STATUSES).map(([k,v])=>el('option',{value:k,text:v})));filter.value=state.filter;
    taskPane.replaceChildren(el('div',{class:'ssb-inspector-head'},el('div',{},el('strong',{text:'修改任务'}),el('span',{class:'ssb-task-count',text:s?.tasks.length||0})),filter),el('div',{class:'ssb-progress'},el('div',{class:'ssb-progress-fill'})),el('div',{class:'ssb-task-list'}),el('div',{class:'ssb-inspector-divider'}));
    renderTaskList();renderCounts();
    if(!s){taskPane.append(el('div',{class:'ssb-editor-empty'},icon('frame',32),el('p',{text:'截图里的每一个修改点，\n都会成为一张任务卡。'})));return;}
    if(!t){
      const title=el('input',{value:s.title,maxlength:120,'aria-label':'截图名称',oninput:e=>{s.title=e.target.value;changed();renderTabs();}});
      taskPane.append(el('div',{class:'ssb-editor'},field('截图名称',title),el('div',{class:'ssb-image-info',text:s.original.width+' × '+s.original.height+' px · '+(s.original.size/1024/1024).toFixed(2)+' MB'}),button(s.after?'替换修改后截图':'添加修改后截图','compare',pickAfter,'ssb-wide'),
        el('p',{class:'ssb-hint',text:'修改后截图用于人工对照验收。任务状态不会由图片自动判定。'}),
        button('移除这张截图','trash',()=>{if(!confirm('移除截图和它的全部任务？'))return;state.board.screenshots=state.board.screenshots.filter(x=>x.id!==s.id);state.shotId=state.board.screenshots[0]?.id;state.taskId=null;changed();render();},'ssb-text-danger')));return;
    }
    const index=s.tasks.indexOf(t),title=el('input',{value:t.title,maxlength:160,'aria-label':'任务标题',oninput:e=>{t.title=e.target.value;changed();renderTaskList();}}),
      note=el('textarea',{value:t.note,rows:3,maxlength:8000,placeholder:'你看到的问题，或最初的想法…','aria-label':'原始批注',oninput:e=>{t.note=e.target.value;changed();}}),
      requirement=el('textarea',{value:t.requirement,rows:3,maxlength:10000,placeholder:'位置 + 现状 + 期望，例如：列表行间距较大，希望更紧凑。','aria-label':'期望修改',oninput:e=>{t.requirement=e.target.value;requirementChanged();}}),
      acceptance=el('textarea',{value:t.acceptance,rows:3,maxlength:6000,placeholder:'可观察的完成条件，例如：同一窗口能看到四行，文字不重叠。','aria-label':'验收条件',oninput:e=>{t.acceptance=e.target.value;requirementChanged();}});
    const readiness=el('p',{class:'ssb-hint ssb-readiness','aria-live':'polite'}),confirmed=el('input',{type:'checkbox',checked:t.clarity==='confirmed','aria-label':'需求已由我确认',onchange:e=>{t.clarity=e.target.checked?'confirmed':'draft';changed();updateReadiness();}});
    function updateReadiness(){const issues=taskIssues(t);readiness.textContent=issues.length?'待澄清：'+issues.join('；'):'信息已齐全，可以在交接时选为执行任务。';renderTaskList();}
    function requirementChanged(){t.clarity='draft';confirmed.checked=false;changed();updateReadiness();}
    const kind=el('select',{'aria-label':'问题类型',onchange:e=>{t.kind=e.target.value;t.clarity='draft';changed();renderInspector();}},el('option',{value:'visual',text:'外观调整'}),el('option',{value:'interaction',text:'交互故障'}));kind.value=t.kind;
    const clarification=el('textarea',{value:t.clarification,rows:2,maxlength:6000,'aria-label':'待澄清问题',placeholder:'还没想清楚的方向或需要讨论的问题；确认后清空。',oninput:e=>{t.clarification=e.target.value;requirementChanged();}});
    const reproduction=t.kind==='interaction'?el('div',{class:'ssb-reproduction'},el('p',{class:'ssb-hint',text:'交互故障需要操作验证。例：进入列表 → 删除 → 取消；实际仍删除；预期项目保留。'}),
      [['steps','复现步骤','从哪个页面开始，依次点击什么？'],['actual','实际结果','实际发生了什么？'],['expected','预期结果','应该发生什么？'],['environment','环境与操作条件','按需填写：浏览器、窗口尺寸、登录/数据状态；不要填写密码。']].map(([key,label,placeholder])=>field(label,el('textarea',{value:t.reproduction[key],rows:2,maxlength:6000,'aria-label':label,placeholder,oninput:e=>{t.reproduction[key]=e.target.value;requirementChanged();}})))):null;
    const status=el('select',{'aria-label':'任务状态',onchange:e=>{try{setStatus(t,e.target.value);}catch(error){toast(error.message,true);}}},Object.entries(STATUSES).map(([k,v])=>el('option',{value:k,text:v})));status.value=t.status;
    const priority=el('select',{'aria-label':'任务优先级',onchange:e=>{t.priority=e.target.value;changed();renderTaskList();}},Object.entries(PRIORITIES).map(([k,v])=>el('option',{value:k,text:v+'优先级'})));priority.value=t.priority;
    const record=el('textarea',{rows:2,maxlength:2000,placeholder:'补充讨论、执行结果或验收说明…','aria-label':'新增讨论记录'});
    taskPane.append(el('div',{class:'ssb-editor'},
      el('div',{class:'ssb-editor-heading'},el('span',{class:'ssb-eyebrow',text:'修改点 '+String(index+1).padStart(2,'0')}),el('div',{class:'ssb-editor-order'},
        button('上移任务','up',()=>moveTask(-1),'ssb-icon-only',{disabled:index===0}),button('下移任务','down',()=>moveTask(1),'ssb-icon-only',{disabled:index===s.tasks.length-1}),
        button('删除任务','trash',()=>{if(!confirm('删除这个修改点？'))return;s.tasks.splice(index,1);state.taskId=null;changed();renderTabs();renderCanvas();renderInspector();},'ssb-icon-only'))),
      field('任务标题',title),el('div',{class:'ssb-field-row'},field('状态',status),field('优先级',priority)),field('问题类型',kind),field('原始批注',note),
      el('details',{class:'ssb-writing-help'},el('summary',{text:'还没想清楚怎么写？'}),el('p',{text:'先保留原话，再补充位置、现状、期望和完成条件。可选方向：列表更紧凑、标题层级更清楚、危险操作更难误触。这里只提供示例，不会自动写入尺寸、颜色或行为。'})),
      field('期望修改',requirement),field('验收条件',acceptance),reproduction,field('待澄清问题（可留空）',clarification),
      el('label',{class:'ssb-confirm'},confirmed,el('span',{text:'需求已由我确认'})),readiness,
      button('重画标注区域','frame',()=>{state.view='original';state.redrawTaskId=t.id;setMode('rect');renderCanvas();toast('请在原图上重新框选这个任务的区域');},'ssb-wide'),
      el('div',{class:'ssb-review-actions'},button('验收通过','check',()=>setStatus(t,'accepted'),'ssb-accept'),button('需要修改',null,()=>setStatus(t,'returned'))),
      button(s.after?'查看修改前后对比':'添加修改后截图','compare',()=>{if(!s.after)return pickAfter();state.view='compare';state.zoom=null;renderTools();renderCanvas();},'ssb-wide'),
      el('div',{class:'ssb-history-heading'},icon('history',16),el('strong',{text:'讨论与验收记录'})),record,
      button('添加记录','plus',()=>{if(!record.value.trim())return;if(t.history.length>=100)throw new Error('记录已满，请导出后另建任务');t.history.push({id:uid(),text:record.value.trim(),createdAt:new Date().toISOString()});changed();renderInspector();},'ssb-wide'),
      el('div',{class:'ssb-history'},[...t.history].reverse().map(h=>el('div',{class:'ssb-history-item'},el('small',{text:new Date(h.createdAt).toLocaleString('zh-CN')}),el('p',{text:h.text}))))));
    updateReadiness();
  }
  function moveTask(delta){const s=shot(),i=s.tasks.findIndex(t=>t.id===state.taskId),next=i+delta;if(next<0||next>=s.tasks.length)return;[s.tasks[i],s.tasks[next]]=[s.tasks[next],s.tasks[i]];changed();renderCanvas();renderInspector();}
  function setStatus(t,value){
    if(t.status===value)return;if(t.history.length>=100)throw new Error('记录已满，请先导出任务板');
    t.history.push({id:uid(),text:'状态：'+STATUSES[t.status]+' → '+STATUSES[value],createdAt:new Date().toISOString()});t.status=value;changed();renderCanvas();renderInspector();
  }
  async function annotatedImage(s){
    const img=await loadImage(assetUrl(s.original)),c=document.createElement('canvas');c.width=s.original.width;c.height=s.original.height;
    const x=c.getContext('2d');x.drawImage(img,0,0);const stroke=Math.max(2,c.width/450),font=Math.max(14,Math.min(36,c.width/45));
    for(const [i,t]of s.tasks.entries()){
      const r=t.rect,a=r.x*c.width,b=r.y*c.height,w=r.w*c.width,h=r.h*c.height;
      x.fillStyle=t.status==='accepted'?'#229b7218':'#7656d918';x.fillRect(a,b,w,h);x.strokeStyle=t.status==='accepted'?'#169b70':'#7956db';x.lineWidth=stroke;x.strokeRect(a,b,w,h);
      const size=font*1.5,by=Math.max(0,b-size+stroke);x.fillStyle=x.strokeStyle;x.beginPath();x.roundRect(a,by,size,size,Math.max(3,size*.15));x.fill();
      x.fillStyle='#fff';x.font='600 '+font+'px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(String(i+1),a+size/2,by+size/2);
    }
    const dataUrl=c.toDataURL('image/png');if(dataUrl.length>MAX_IMAGE_BYTES*1.4)throw new Error('批注图超过 8 MB，请缩小原图后重试');return dataUrl;
  }
  async function backup(){
    const board=structuredClone(state.board),assets={};
    for(const s of board.screenshots)for(const a of [s.original,s.after].filter(Boolean))if(!assets[a.id]){const blob=await api('assets/'+a.id);assets[a.id]=await fileData(blob);}
    download(new Blob([JSON.stringify({format:FORMAT,version:1,board,assets},null,2)],{type:'application/json'}),fileName(board.title,'.backup.json'));toast('备份已导出，包含当前编辑与全部图片');
  }
  async function exportZip(selection,expectedBoard){
    await flush();if(state.board!==expectedBoard)throw new Error('任务板已切换，请重新打开交接预览');
    const board=structuredClone(expectedBoard),revision=board.revision,rendered={};
    for(const s of board.screenshots)rendered[s.id]=await annotatedImage(s);
    const blob=await api('boards/'+board.id+'/export','POST',{revision,rendered,selection});download(blob,fileName(board.title,'.handoff.zip'));toast('交接包已导出：执行范围、任务说明和图片');
  }
  async function handoff(){
    if(state.busy)return toast('请等待图片处理完成');
    const expectedBoard=state.board;
    try{await flush();}catch(e){toast(e.message,true);}
    if(state.board!==expectedBoard||state.disposed)return;
    const board=state.board,initial=handoffForBoard(board),selection={executionTaskIds:[...initial.executionTaskIds],referenceTaskIds:[...initial.referenceTaskIds],clarificationTaskIds:[...initial.clarificationTaskIds]},
      preview=el('textarea',{class:'ssb-markdown-preview',readonly:true,'aria-label':'交接说明预览'}),summary=el('p',{class:'ssb-scope-summary','aria-live':'polite'}),choices=el('div',{class:'ssb-scope-list'});
    const currentMarkdown=()=>{if(state.board!==board)throw new Error('任务板已切换，请重新打开交接预览');return markdownForHandoff(board,handoffForBoard(board,selection));};
    function updatePreview(){const plan=handoffForBoard(board,selection);preview.value=markdownForHandoff(board,plan);summary.textContent=`执行 ${plan.executionTaskIds.length} 项 · 待澄清 ${plan.clarificationTaskIds.length} 项 · 参考 ${plan.referenceTaskIds.length} 项 · 不包含 ${plan.omittedTaskIds.length} 项`;}
    board.screenshots.forEach((s,i)=>s.tasks.forEach((t,n)=>{
      const issues=taskIssues(t),select=el('select',{'aria-label':`交接范围 ${i+1}.${n+1} ${t.title}`},
        el('option',{value:'executionTaskIds',text:'本次执行',disabled:!!issues.length}),el('option',{value:'clarificationTaskIds',text:'待澄清'}),el('option',{value:'referenceTaskIds',text:'仅供参考'}),el('option',{value:'omit',text:'不包含'}));
      select.value=Object.keys(selection).find(key=>selection[key].includes(t.id))||'omit';
      select.addEventListener('change',()=>{for(const key of Object.keys(selection))selection[key]=selection[key].filter(id=>id!==t.id);if(select.value!=='omit')selection[select.value].push(t.id);updatePreview();});
      choices.append(el('div',{class:'ssb-scope-row'},el('div',{},el('strong',{text:`${i+1}.${n+1} ${t.title}`}),el('small',{text:STATUSES[t.status]+(issues.length?' · '+issues.join('；'):' · 用户已确认')})),select));
    }));
    updatePreview();
    dialog('交接与导出',el('div',{},el('p',{class:'ssb-hint',text:'待处理、处理中、需修改且资料已确认的任务默认执行；待验收和已通过默认只供参考。未确认或缺信息的任务需先澄清。可逐项调整范围；图片和 board.json 仍保留完整背景。下载时记录实际 UTC 导出时间。'}),
      state.error?el('p',{class:'ssb-hint is-error',text:'当前编辑尚未保存，下面为本窗口预览。解决保存冲突前只能备份，不能导出执行包。'}):null,summary,choices,preview),[
      button('备份 JSON','save',backup),
      state.error?button('重新载入','history',async()=>{
        if(!confirm('重新载入会放弃本窗口未保存的修改。请先导出备份 JSON。继续吗？'))return;
        clearTimeout(state.timer);
        if(state.saving)await state.saving.catch(()=>{});
        const saved=await api('boards/'+state.board.id);
        state.board=saved;state.changes=state.saved=0;state.error='';state.shotId=saved.screenshots[0]?.id;state.taskId=null;
        closeDialog();render();toast('已载入本机保存的最新版本');
      }):null,
      button('下载说明','download',async()=>{await flush();download(new Blob([currentMarkdown()],{type:'text/markdown;charset=utf-8'}),fileName(board.title,'.tasks.md'));}),
      button('复制说明','copy',async()=>{await flush();await navigator.clipboard.writeText(currentMarkdown());toast('交接说明已复制');}),button('导出交接包','download',()=>exportZip(selection,board),'ssb-primary')]);
  }
  let resumeSnapshot=null;
  function minimize(){
    const active=document.activeElement;
    resumeSnapshot={active,selection:typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null,
      scroll:[...root.querySelectorAll('.ssb-stage,.ssb-inspector,.ssb-dialog-body,.ssb-task-list')].map(node=>[node,node.scrollLeft,node.scrollTop])};
    state.suspended=true;options.onMinimize?.();
    flush().catch(e=>toast(e.message,true));
  }
  function resume(){
    state.suspended=false;
    if(!resumeSnapshot)return;
    const saved=resumeSnapshot;
    requestAnimationFrame(()=>{if(state.suspended||state.disposed)return;for(const [node,left,top]of saved.scroll){node.scrollLeft=left;node.scrollTop=top;}if(saved.active?.isConnected){saved.active.focus({preventScroll:true});if(saved.selection)saved.active.setSelectionRange(...saved.selection);}});
  }
  function beforeUnload(e){if(state.changes!==state.saved){e.preventDefault();e.returnValue='';}}
  async function onPaste(e){
    if(state.disposed||state.suspended||state.dialog||!root.contains(document.activeElement))return;
    const file=[...(e.clipboardData?.items||[])].find(i=>i.kind==='file'&&['image/png','image/jpeg'].includes(i.type))?.getAsFile();
    if(file){e.preventDefault();try{await addFiles([file]);}catch(error){toast(error.message,true);}}
  }
  root.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();root.classList.add('ssb-drop-active');}});
  root.addEventListener('dragleave',e=>{if(!root.contains(e.relatedTarget))root.classList.remove('ssb-drop-active');});
  root.addEventListener('drop',async e=>{root.classList.remove('ssb-drop-active');if(!e.dataTransfer?.files.length)return;e.preventDefault();try{await addFiles([...e.dataTransfer.files]);}catch(error){toast(error.message,true);}});
  root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(state.dialog)closeDialog();else setMode('select');return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flush().then(()=>toast('已保存')).catch(error=>toast(error.message,true));}
  });
  document.addEventListener('paste',onPaste);window.addEventListener('beforeunload',beforeUnload);
  let resizeTimer,lastWidth=0,lastHeight=0;const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);if(state.suspended||!root.clientWidth||!root.clientHeight)return;
    const width=root.clientWidth,height=root.clientHeight;if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;
    resizeTimer=setTimeout(()=>{if(!state.suspended&&!state.zoom&&state.board){const left=stage?.scrollLeft||0,top=stage?.scrollTop||0;renderCanvas();if(stage){stage.scrollLeft=left;stage.scrollTop=top;}}},80);});observer.observe(root);
  const ready=(async()=>{
    app.append(el('div',{class:'ssb-loading',text:'正在打开本地任务板…'}));
    try{token=(await api('session')).token;state.boards=await api('boards');const last=readPref('board'),selected=state.boards.find(b=>b.id===last)||state.boards[0];if(selected)await openBoard(selected.id);else render();}
    catch(e){if(e.name!=='AbortError')app.replaceChildren(el('div',{class:'ssb-loading'},el('h2',{text:'暂时无法打开任务板'}),el('p',{text:e.message}),button('重试','history',()=>location.reload())));}
  })();
  return {ready,flush,resume,dispose(){state.disposed=true;abort.abort();clearTimeout(state.timer);clearTimeout(toastTimer);clearTimeout(resizeTimer);observer.disconnect();document.removeEventListener('paste',onPaste);window.removeEventListener('beforeunload',beforeUnload);root.replaceChildren();}};
}
