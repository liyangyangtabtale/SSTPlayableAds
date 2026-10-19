// 占位资源包：把旧 PlayableWeb 里已有的资源整理成新的资源包格式(带材质的 glb、.anim、webp、wav)，只用来跑通流程，不是最终内容。
// 输出 assets/placeholder/{manifest.json, config.json, <id>/<role>.<ext>}；美术的新资源到位后由 Unity 导出工具生成同样格式的资源包。
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
import {NodeIO} from '@gltf-transform/core'; import {ALL_EXTENSIONS, EXTTextureWebP} from '@gltf-transform/extensions';
import {defaultConfig, STAGE_TYPES, SOUND_EVENTS} from '../src/shared/schema.js';
import {slug} from '../src/shared/assets.js';
import {optimizeDoc} from '../src/shared/glb-optimize.js'; import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import {LIMITS} from './lib/limits.mjs';

const LEG = path.resolve('../PlayableWeb/public'); const OUT = path.resolve('assets/placeholder');
const legacy = JSON.parse(fs.readFileSync(path.join(LEG, 'config.json'), 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});
const encodeImage = async (bytes, mime, {max, quality}) => ({bytes: new Uint8Array(await sharp(bytes).resize(max, max, {fit: 'inside', withoutEnlargement: true}).webp({quality: Math.round(quality * 100)}).toBuffer()), ext: 'webp'});
fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
const manifest = {}; const A = p => path.join(LEG, 'assets', p);
const nice = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function put(id, role, ext, bytes) { const rel = `${id}/${role}.${ext}`; fs.mkdirSync(path.join(OUT, id), {recursive: true}); fs.writeFileSync(path.join(OUT, rel), bytes); return rel; }
function item(id, type, name, files, meta = {}, extra = {}) { manifest[id] = {id, type, name, collection: 'placeholder', tags: ['placeholder'], files, meta, ...extra}; return manifest[id]; }

/** 把材质描述(旧工程导出的 {t:贴图,c:颜色,cut,cull,blend})写进 glb：贴图嵌进去(webp)，alphaMode / 双面也按 glTF 标准写 */
async function glbWithMaterials(modelFile, nodeMats) {
  const doc = await io.readBinary(fs.readFileSync(A(`model/${modelFile}.glb`)));
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const cache = new Map();
  const mat = d => {
    const key = JSON.stringify(d); if (cache.has(key)) return cache.get(key);
    const m = doc.createMaterial(d.t || 'mat').setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(d.cull === 0);
    if (d.t) { const f = A(`tex/${d.t}.webp`); if (fs.existsSync(f)) m.setBaseColorTexture(doc.createTexture(d.t).setImage(fs.readFileSync(f)).setMimeType('image/webp')); }
    if (d.c) m.setBaseColorFactor([d.c[0], d.c[1], d.c[2], 1]);
    if (d.cut > 0) m.setAlphaMode('MASK').setAlphaCutoff(d.cut); else if (d.blend) m.setAlphaMode('BLEND');
    cache.set(key, m); return m;
  };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const mats = nodeMats[node.getName()] || nodeMats['*']; if (!mats || !mats.length) continue;
    mesh.listPrimitives().forEach((p, j) => p.setMaterial(mat(mats[Math.min(j, mats.length - 1)])));
  }
  for (const m of doc.getRoot().listMaterials()) if (!m.listParents().some(p => p.propertyType === 'Primitive')) m.dispose();
  return Buffer.from(await io.writeBinary(doc));
}
/** 一组部件 [{model,node,mats}] -> 每个模型文件一个 glb(同一个模型里的多个节点共用一份文件)，返回 files 与 meta.parts */
async function buildParts(id, parts, roleOf) {
  const byModel = new Map(); for (const p of parts) { if (!byModel.has(p.model)) byModel.set(p.model, {}); byModel.get(p.model)[p.node || '*'] = p.mats || [p.mat]; }
  const files = {}, fileOf = {}; let n = 0;
  for (const [model, nm] of byModel) { const f = 'p' + n++; files[f] = put(id, f, 'glb', await glbWithMaterials(model, nm)); fileOf[model] = f; }
  return {files, parts: parts.map(p => ({file: fileOf[p.model], ...(p.node ? {node: p.node} : {}), ...(roleOf ? {role: roleOf(p)} : {})}))};
}
const tint = (buf, o) => sharp(buf).modulate(o).webp({quality: 80}).toBuffer();

/* ---- 骨架 + 角色 ---- */
const charRole = p => ({head: 'head', body: 'body', eyeball: 'eye', eyelash: 'lash', eyebrow: 'brow'}[p.model] || p.role || p.model);
{
  const parts = legacy.character.parts.map(p => ({model: p.model, mats: [p.mat]}));
  const b = await buildParts('character', parts, charRole);
  item('character', 'character', 'Heroine (placeholder)', {rig: put('character', 'rig', 'glb', fs.readFileSync(A(`rig/${legacy.character.rig}.glb`))), ...b.files}, {parts: b.parts});
}
/* ---- 3 种外观：同一模型换贴图(这里用旧贴图调色得到占位) ---- */
{
  const tex = k => fs.readFileSync(A(`tex/${k}.webp`)); const P = Object.fromEntries(legacy.character.parts.map(p => [charRole(p), p.mat.t]));
  const looks = [['look_a', 'Look A · fair', {}], ['look_b', 'Look B · warm', {brightness: .88, saturation: .8, hue: 8}], ['look_c', 'Look C · deep', {brightness: .5, saturation: .85, hue: 4}]];
  for (const [id, name, mod] of looks) {
    const f = {}; for (const r of ['head', 'body', 'eye', 'brow', 'lash']) { const b = tex(P[r]); f[r] = put(id, r, 'webp', r === 'head' || r === 'body' ? (Object.keys(mod).length ? await tint(b, mod) : b) : b); }
    item(id, 'look', name, f, {swatch: id === 'look_a' ? '#f1c9a8' : id === 'look_b' ? '#d9a679' : '#7a4a2e'});
  }
}
/* ---- 服装 / 发型 / 鞋 / 妆容 ---- */
const typeName = {outfit: 'outfit', hair: 'hair', shoes: 'shoes', makeup: 'makeup'};
for (const [key, it] of Object.entries(legacy.items)) {
  const id = slug(key); const files = {};
  if (it.icon && fs.existsSync(A(`icons/${it.icon}.webp`))) files.icon = put(id, 'icon', 'webp', fs.readFileSync(A(`icons/${it.icon}.webp`)));
  if (it.type === 'makeup') { files.tex = put(id, 'tex', 'webp', (await encodeImage(fs.readFileSync(A(`tex/${it.tex}.webp`)), 'image/webp', {max: 768, quality: 0.6})).bytes); item(id, 'makeup', nice(key), files); continue; }
  const b = await buildParts(id, it.parts.map(p => ({model: p.model, node: p.node, mats: p.mats})));
  item(id, it.type, nice(key), {...files, ...b.files}, {parts: b.parts});
}
/* ---- 动画 ---- */
for (const f of fs.readdirSync(A('anim')).filter(f => f.endsWith('.anim'))) {
  const name = f.replace('.anim', ''); const buf = fs.readFileSync(A(`anim/${f}`)); const hl = buf.readUInt32LE(0); const head = JSON.parse(buf.slice(4, 4 + hl).toString());
  item('anim_' + slug(name), 'anim', nice(name), {anim: put('anim_' + slug(name), 'anim', 'anim', buf)}, {duration: +head.d.toFixed(2), kind: /^phone/.test(name) ? 'phone' : 'body', face: head.t.some(t => t.p === 'm')});
}
/* ---- 男角色 ---- */
{
  const pr = legacy.partner; const parts = pr.parts.map(p => ({model: p.model, mats: [p.mat]}));
  const role = p => p.model.replace(/^boy_/, ''); const b = await buildParts('partner', parts, role);
  item('partner', 'partner', 'Partner (placeholder)', {rig: put('partner', 'rig', 'glb', fs.readFileSync(A(`rig/${pr.rig}.glb`))), ...b.files}, {parts: b.parts});
}
/* ---- 手机 ---- */
{ const ph = legacy.phone; const buf = await glbWithMaterials(ph.model, {'*': [ph.mat]}); item('phone', 'phone', 'Phone (placeholder)', {model: put('phone', 'model', 'glb', buf)}); }
/* ---- 背景 ---- */
for (const [id, f, name] of [['bg_play', 'ui/bg.webp', 'Play background'], ['bg_end', 'ui/end_bg.webp', 'Ending background']]) if (fs.existsSync(A(f))) item(id, 'background', name, {image: put(id, 'image', 'webp', fs.readFileSync(A(f)))});
/* ---- 音效：合成的占位短音(8 kHz 单声道 16 位 wav)，正式音效到位后替换 ---- */
function wav(freqs, dur, vol = .35) {
  const sr = 8000, n = Math.floor(sr * dur), b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / sr, k = Math.min(1, t * 80) * Math.pow(1 - i / n, 2); const f = freqs[Math.min(freqs.length - 1, Math.floor(i / n * freqs.length))]; b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * f * t) * vol * k * 32767), 44 + i * 2); } return b;
}
const SND = {click: [[880], .06], dress: [[520, 700], .12], stageDone: [[660, 880, 1100], .22], transition: [[400, 300], .18], intro: [[523, 659, 784], .3], outroGood: [[523, 659, 784, 1047], .5], outroBad: [[392, 311, 262], .45], cta: [[784, 988], .2]};
for (const [ev, label] of SOUND_EVENTS) { const [f, d] = SND[ev]; item('sfx_' + ev, 'sound', 'SFX · ' + label + ' (placeholder)', {audio: put('sfx_' + ev, 'audio', 'wav', wav(f, d))}, {event: ev}); }

/* ---- 默认配置(把占位资产串起来) ---- */
const cfg = defaultConfig(); const L = legacy;
cfg.theme.backgrounds = {play: 'bg_play', end: 'bg_end'};
cfg.character.model = 'character'; cfg.character.partner = 'partner'; cfg.character.look = 'look_a';
cfg.character.defaultOutfit = slug(L.defaults.outfits[L.defaults.outfitIndex] || L.defaults.outfits[0]); cfg.character.defaultHair = slug(L.defaults.hair);
for (const s of cfg.flow.stages) { const ls = L.stages.find(x => x.type === s.type); if (ls) { s.enabled = ls.enabled; s.columns = ls.columns; s.count = ls.count; s.options = ls.options.map(o => ({asset: slug(o.item), good: !!o.good})); } }
const an = n => 'anim_' + slug(n);
cfg.animations = {idle: [an(L.anims.idle)], intro: [an(L.anims.intro)], introReact: [an(L.anims.introReact)], pickGood: [an(L.anims.pickGood)], pickBad: [an(L.anims.pickBad)], outroGood: [an(L.anims.good)], outroBad: [an(L.anims.bad)], partnerIdle: [an(L.partner.anims.idle)]};
cfg.phone = {model: 'phone', take: an(L.phone.anims.take), end: an(L.phone.anims.end)};
cfg.sound.events = Object.fromEntries(SOUND_EVENTS.map(([k]) => ['sfx_' + k, 'sfx_' + k]).map(([k, v]) => [k.slice(4), v]));
/* ---- 压缩所有 glb 部件(骨架只有节点，不动) ---- */
for (const it of Object.values(manifest)) for (const [role, rel] of Object.entries(it.files)) {
  if (!rel.endsWith('.glb') || role === 'rig') continue; const f = path.join(OUT, rel);
  const doc = await io.readBinary(fs.readFileSync(f)); await optimizeDoc(doc, {encodeImage, MeshoptEncoder, plain: it.type === 'phone', maxTex: LIMITS.tex[it.type] || 1024, quality: 0.68});
  fs.writeFileSync(f, Buffer.from(await io.writeBinary(doc)));
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest)); fs.writeFileSync(path.join(OUT, 'config.json'), JSON.stringify(cfg, null, 1));
const total = Object.values(manifest).reduce((a, it) => a + Object.values(it.files).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0), 0);
console.log(`占位资源包：${Object.keys(manifest).length} 个素材，${(total / 1048576).toFixed(2)} MiB`);
const by = {}; for (const it of Object.values(manifest)) by[it.type] = (by[it.type] || 0) + 1; console.log(by);
