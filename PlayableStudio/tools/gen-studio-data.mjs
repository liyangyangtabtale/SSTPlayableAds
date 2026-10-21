// 生成 Studio 内嵌的两份数据：自带基础资源包(占位资源) 和 试玩运行时模板。
import fs from 'fs'; import {readPackDir} from './lib/pack.mjs'; import {b91enc} from '../src/shared/b91.js';
fs.mkdirSync('src/studio/generated', {recursive: true});
const tpl = fs.readFileSync('dist/runtime/index.html', 'utf8');
if (!tpl.includes('window.__PLAYABLE__=null;/*PLAYABLE_DATA*/')) throw new Error('运行时模板里没有数据占位符，先运行 npm run build:runtime');
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const lit = s => JSON.stringify(s).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--').split(LS).join('\\u2028').split(PS).join('\\u2029');
fs.writeFileSync('src/studio/generated/runtime-template.js', 'export default ' + lit(tpl) + ';\n');
const pack = readPackDir('assets/placeholder'); const blobs = {};
// 动画固定内置：丢掉占位包里的旧动画，换成 assets/animations(tools/build-animations.mjs 从 Unity 烘焙)
// 服装/发型/鞋/妆容/外观 不再内置：全部从“导入资源包”进来(assets/makeup 里的 8 个妆容保留在仓库里，需要时可再并回来：见 tools/build-makeup.mjs)。
// 这里把占位包里这几类素材丢掉，并清空配置里对它们的引用(阶段选项、默认服装/发型、外观)。
const DROP = new Set(['outfit', 'hair', 'shoes', 'makeup', 'look']);
for (const id of Object.keys(pack.manifest)) if (DROP.has(pack.manifest[id].type)) { for (const rel of Object.values(pack.manifest[id].files)) pack.files.delete(rel); delete pack.manifest[id]; }
for (const s of pack.config.flow.stages) if (DROP.has(s.type)) s.options = [];
Object.assign(pack.config.character, {defaultOutfit: null, defaultHair: null, look: null});
for (const id of Object.keys(pack.manifest)) if (pack.manifest[id].type === 'anim') { for (const rel of Object.values(pack.manifest[id].files)) pack.files.delete(rel); delete pack.manifest[id]; }
const anims = readPackDir('assets/animations'); Object.assign(pack.manifest, anims.manifest); for (const [p, b] of anims.files) pack.files.set(p, b); for (const [p, b] of pack.files) blobs[p] = b91enc(new Uint8Array(b));
fs.writeFileSync('src/studio/generated/base-pack.js', 'export default JSON.parse(' + lit(JSON.stringify({manifest: pack.manifest, blobs, config: pack.config})) + ');\n');
console.log('Studio 数据：运行时模板', (tpl.length / 1024).toFixed(0), 'KB，基础资源', pack.files.size, '个文件');
