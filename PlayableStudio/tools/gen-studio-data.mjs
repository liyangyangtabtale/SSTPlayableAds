// 生成 Studio 内嵌的两份数据：自带基础资源包(占位资源) 和 试玩运行时模板。
import fs from 'fs'; import {readPackDir} from './lib/pack.mjs'; import {b91enc} from '../src/shared/b91.js';
fs.mkdirSync('src/studio/generated', {recursive: true});
const tpl = fs.readFileSync('dist/runtime/index.html', 'utf8');
if (!tpl.includes('window.__PLAYABLE__=null;/*PLAYABLE_DATA*/')) throw new Error('运行时模板里没有数据占位符，先运行 npm run build:runtime');
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const lit = s => JSON.stringify(s).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--').split(LS).join('\\u2028').split(PS).join('\\u2029');
fs.writeFileSync('src/studio/generated/runtime-template.js', 'export default ' + lit(tpl) + ';\n');
const pack = readPackDir('assets/placeholder'); const blobs = {}; for (const [p, b] of pack.files) blobs[p] = b91enc(new Uint8Array(b));
fs.writeFileSync('src/studio/generated/base-pack.js', 'export default JSON.parse(' + lit(JSON.stringify({manifest: pack.manifest, blobs, config: pack.config})) + ');\n');
console.log('Studio 数据：运行时模板', (tpl.length / 1024).toFixed(0), 'KB，基础资源', pack.files.size, '个文件');
