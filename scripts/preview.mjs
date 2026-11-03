import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { BoardStore } from '../src/host/storage.js';
import { createHandler, ROUTE_PREFIX } from '../src/host/router.js';
const root=resolve(import.meta.dirname,'..'),pos=process.argv.indexOf('--port'),port=pos>=0?Number(process.argv[pos+1]):4387;
const dataIndex=process.argv.indexOf('--data-dir');
const store=new BoardStore(dataIndex>=0?resolve(root,process.argv[dataIndex+1]):join(root,'.preview-data'));
const handler=createHandler({store});
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>截图任务板 · 本地预览</title><style>html,body,#app{height:100%;margin:0}body{overflow:hidden}</style></head><body><div id="app"></div><script type="module" src="/preview.js"></script></body></html>';
const server=createServer(async(req,res)=>{
  if(new URL(req.url,'http://localhost').pathname.startsWith(ROUTE_PREFIX+'/'))return handler(req,res);
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'||path==='/preview.js'){
    try{
      res.writeHead(200,{'content-type':path==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'"});
      return res.end(path==='/'?html:await readFile(join(root,'lib/preview.js')));
    }catch(e){res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});return res.end('请先运行 build：'+e.message);}
  }
  res.writeHead(404);res.end('Not found');
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Screenshot Board preview: http://127.0.0.1:'+server.address().port+'\nData: '+store.root+'\nThis preview does not load, install or modify DSH.'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
