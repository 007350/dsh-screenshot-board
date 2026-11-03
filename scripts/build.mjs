import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
const position=process.argv.indexOf('--esbuild-root');
const require=createRequire(position>=0?resolve(process.argv[position+1],'package.json'):resolve(root,'package.json'));
let esbuild;
try { esbuild=require('esbuild'); } catch { throw new Error('Build needs esbuild. Use npm install in this source folder, or --esbuild-root PATH to an existing development tool installation. No DSH installation is needed.'); }
await mkdir(resolve(root,'lib'),{recursive:true});
const shared={bundle:true,target:'es2022',logLevel:'info',sourcemap:false,legalComments:'none'};
await esbuild.build({...shared,entryPoints:[resolve(root,'src/host/index.js')],outfile:resolve(root,'lib/index.js'),platform:'node',format:'esm',packages:'external'});
await esbuild.build({...shared,entryPoints:[resolve(root,'src/client/index.js')],outfile:resolve(root,'lib/client.js'),platform:'browser',format:'esm',loader:{'.css':'text'},minify:false});
await esbuild.build({...shared,entryPoints:[resolve(root,'src/client/preview.js')],outfile:resolve(root,'lib/preview.js'),platform:'browser',format:'esm',loader:{'.css':'text'}});
const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
await writeFile(resolve(root,'lib/build-info.json'),JSON.stringify({name:manifest.name,version:manifest.version,bundler:'esbuild '+esbuild.version},null,2)+'\n');
console.log('Built host + self-contained client + standalone preview. No plugin installed.');
