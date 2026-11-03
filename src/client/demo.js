export function demoScreenshot(after = false) {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
  const x = c.getContext('2d');
  const font = 'system-ui, "Microsoft YaHei", sans-serif';
  function box(a,b,w,h,color,r=12) { x.fillStyle=color; x.beginPath(); x.roundRect(a,b,w,h,r); x.fill(); }
  function text(t,a,b,size,color='#222631',weight=400) { x.fillStyle=color; x.font=weight+' '+size+'px '+font; x.fillText(t,a,b); }
  box(0,0,1280,800,'#f6f7fb',0); box(0,0,218,800,'#fff',0);
  box(28,28,30,30,'#7660df',8); text('N',36,50,20,'#fff',700); text('Northstar',70,50,23,'#24243c',700);
  text('工作空间',28,109,12,'#9a9daa',600);
  const links=['总览','项目','任务','团队','文件'];
  links.forEach((t,i)=>{ if(i===0)box(16,130+i*50,186,40,'#f0ecff',8); text(['◈','▦','☑','◎','▧'][i],31,156+i*50,18,i===0?'#7758db':'#9195a4');text(t,65,156+i*50,15,i===0?'#7758db':'#7b8090',i===0?600:400); });
  text('工作空间设置',32,750,14,'#9195a4');
  text('工作台 / 总览',254,44,13,'#979baa');
  box(1150,22,94,32,'#eeebf9',16); text('演示界面',1168,43,12,'#7969af',600);
  text('项目总览',254,108,28,'#252938',650); text('欢迎回来，今天也有值得推进的事情。',254,138,14,'#8d93a3');
  box(1080,83,160,42,'#7760db',8); text('+ 创建项目',1110,110,15,'#fff',600);
  const metrics=[['进行中的项目','12','+2 本周新增'],['待完成任务','38','8 项需要关注'],['本周完成','24','比上周多 6 项']];
  metrics.forEach((m,i)=>{const a=254+i*335;box(a,170,315,130,'#fff',12);text(m[0],a+22,200,14,'#9499a8');text(m[1],a+22,246,34,'#303547',600);text(m[2],a+22,279,12,'#9ca2b0');});
  box(254,324,650,430,'#fff',12);text('最近项目',278,359,17,'#303547',600);text('查看全部 →',795,359,12,'#9da0ad');
  text('项目名称',279,403,12,'#9da3b1');text('进度',609,403,12,'#9da3b1');text('操作',824,403,12,'#9da3b1');
  const projects=['品牌官网改版','移动端体验优化','数据分析工作台','组件库 2.0'];
  projects.forEach((t,i)=>{const b=442+i*(after?60:70);box(279,b-12,30,30,['#ede8fc','#e5f2fb','#e8f5ed','#fff1e0'][i],8);text(['✧','▱','◫','▦'][i],287,b+9,16,'#8b78c5');text(t,324,b+1,14,'#4c5364',500);text('最近更新于今天',324,b+20,11,'#adb0bc');box(609,b-2,128,6,'#f0f0f6',3);box(609,b-2,[90,48,100,62][i],6,'#a793e5',3);text(after?'•••':'删除',824,b+8,after?18:12,after?'#9297a7':'#e6757a');});
  box(924,324,320,430,'#fff',12);text('团队动态',948,359,17,'#303547',600);
  ['更新了组件规范','完成了首页验收','添加了新的设计稿','整理了会议记录'].forEach((t,i)=>{box(948,394+i*70,30,30,['#e9e3f8','#e2f0eb','#e4edf8','#f6e9e2'][i],15);text(['Y','C','L','M'][i],959,414+i*70,12,'#8e82ab',600);text(t,991,409+i*70,13,'#7b8292');text((i+1)+' 小时前',991,430+i*70,11,'#b0b4bf');});
  if(after){text('修改后示例：紧凑列表 · 操作收纳',254,786,12,'#7f72a8');}
  return c.toDataURL('image/png');
}
