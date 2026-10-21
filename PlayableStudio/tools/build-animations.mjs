// 内置动画：把 Unity 工程 Assets/PlayableExport/Animations 下的 FBX 烘焙成 Studio 内置的 .anim 资源(assets/animations)。
// 动画不在 Studio 里替换，也不进资源包；以后改动画 = 换掉 Unity 里的 FBX 再跑一次构建(npm run build 会自动先跑这一步)。
// 只读 Unity 工程。用法：node tools/build-animations.mjs [Unity 工程根目录，默认 ..]
import fs from 'fs'; import path from 'path';
import {NodeIO} from '@gltf-transform/core'; import {ALL_EXTENSIONS} from '@gltf-transform/extensions'; import {resample} from '@gltf-transform/functions';
import {setProject, exportAnimations} from './unity-export/export.mjs';
import {encodeAnim} from '../src/shared/anim-format.js'; import {slug} from '../src/shared/assets.js';
import {FIXED_ANIMATIONS} from '../src/shared/schema.js';

const OUT = path.resolve('assets/animations'), LEGACY = path.resolve('assets/placeholder');
const sanitize = n => String(n || '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const project = process.argv[2] || '..';
try { setProject(project); } catch (e) { if (fs.existsSync(path.join(OUT, 'manifest.json'))) { console.log('没有找到 Unity 工程，沿用已有的内置动画：' + e.message); process.exit(0); } throw e; }

const rigNames = new Set((await io.read(path.join(LEGACY, 'character/rig.glb'))).getRoot().listNodes().map(n => sanitize(n.getName())));   // 内置角色的骨架：动画里骨架没有的骨骼轨道不要
const stripDup = n => n.replace(/_\d+$/, '');
const clips = await exportAnimations();
const newOut = {}; fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
const manifest = {};
const put = (id, bytes, name, meta) => { fs.mkdirSync(path.join(OUT, id), {recursive: true}); fs.writeFileSync(path.join(OUT, id, 'anim.anim'), bytes); manifest[id] = {id, type: 'anim', name, collection: 'builtin', tags: ['builtin'], files: {anim: `${id}/anim.anim`}, meta}; };

for (const c of clips) {
  const doc = await io.readBinary(c.bytes); await doc.transform(resample({tolerance: 0.0005}));
  const anim = doc.getRoot().listAnimations()[0]; const tracks = []; let dur = 0; const isPhone = /^phone/i.test(c.name);   // 手机动画的轨道是手机自己的节点
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode(); if (!node) continue; const s = ch.getSampler(), times = s.getInput().getArray(), vals = s.getOutput().getArray(); if (!times.length) continue;
    const n = sanitize(node.getName()), p = ch.getTargetPath(); dur = Math.max(dur, times[times.length - 1]);
    if (p === 'weights') tracks.push({n, p: 'm', times, values: vals, w: Math.round(vals.length / times.length)});
    else if (!isPhone && !rigNames.has(n) && !rigNames.has(stripDup(n))) continue;
    else tracks.push({n, p: p === 'rotation' ? 'q' : p === 'scale' ? 's' : 't', times, values: vals});
  }
  const id = 'anim_' + slug(c.name); const kind = /^phone/i.test(c.name) ? 'phone' : 'body';
  put(id, encodeAnim(dur, tracks), c.name, {duration: +dur.toFixed(2), kind, face: tracks.some(t => t.p === 'm'), source: c.file});
  console.log(`  ${id}  ${dur.toFixed(2)}s  ${tracks.length} 条轨道  (${c.file})`);
}
// Unity 的 Animations 里还没有的动画，沿用旧占位资源(等美术补了同名 FBX 就会被上面的覆盖)
for (const id of new Set(Object.values(FIXED_ANIMATIONS.animations).flat().concat([FIXED_ANIMATIONS.phone.take, FIXED_ANIMATIONS.phone.end]).filter(Boolean))) {
  if (manifest[id]) continue; const src = path.join(LEGACY, id, 'anim.anim'); if (!fs.existsSync(src)) { console.warn('  缺少内置动画 ' + id); continue; }
  const buf = fs.readFileSync(src), hl = buf.readUInt32LE(0), head = JSON.parse(buf.subarray(4, 4 + hl).toString());
  put(id, buf, id.replace(/^anim_/, ''), {duration: +head.d.toFixed(2), kind: /phone/.test(id) ? 'phone' : 'body', face: head.t.some(t => t.p === 'm'), source: '旧占位'}); console.log(`  ${id}  (旧占位，Unity 里还没有这条动画)`);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(`内置动画：${Object.keys(manifest).length} 条 → assets/animations`);
