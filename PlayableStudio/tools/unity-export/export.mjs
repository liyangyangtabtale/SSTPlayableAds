// Unity 资源导出：读取 Unity 工程(只读)，按约定的目录或 export.json 把角色、服装、发型、鞋、妆容、外观、动画、手机、背景、音效
// 转成 Studio 能导入的资源包(manifest.json + 文件，素材标 meta.raw=true，由 Studio 负责校验、压缩、生成图标)。
import fs from 'fs'; import path from 'path'; import os from 'os'; import {execFileSync} from 'child_process'; import sharp from 'sharp'; import JSZip from 'jszip';
import {NodeIO} from '@gltf-transform/core'; import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as yaml from 'js-yaml';
import {setProject, ASSETS, pathOf, readDocs, readMaterial, prefabRenderers, fbxNames, guidIndex} from './unity.mjs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const FBX2GLTF = path.resolve('node_modules/fbx2gltf/bin/' + ({darwin: 'Darwin', linux: 'Linux', win32: 'Windows_NT'}[process.platform]) + '/FBX2glTF' + (process.platform === 'win32' ? '.exe' : ''));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
const sanitize = n => String(n || '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
const stem = p => path.basename(p, path.extname(p));
const rel = p => path.relative(path.dirname(ASSETS), p).split(path.sep).join('/');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pstudio-'));

/* ---------- 贴图 / 材质 ---------- */
function tgaToPng(b) {      // sips 会丢掉部分 TGA 的 alpha，自己解码
  const idLen = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16], desc = b[17], px = bpp / 8; let p = 18 + idLen + (b[1] ? b.readUInt16LE(5) * Math.ceil(b[7] / 8) : 0);
  if (![2, 10].includes(type) || ![24, 32].includes(bpp)) throw new Error('不支持的 TGA 格式(请用 PNG)');
  const out = Buffer.alloc(w * h * 4); let n = 0; const put = (o, i) => { out[o] = b[i + 2]; out[o + 1] = b[i + 1]; out[o + 2] = b[i]; out[o + 3] = px === 4 ? b[i + 3] : 255; };
  if (type === 2) for (; n < w * h; n++, p += px) put(n * 4, p); else while (n < w * h) { const hd = b[p++], c = (hd & 127) + 1; if (hd & 128) { for (let k = 0; k < c && n < w * h; k++) put((n++) * 4, p); p += px; } else for (let k = 0; k < c && n < w * h; k++, p += px) put((n++) * 4, p); }
  const rows = Buffer.alloc(w * h * 4); const top = (desc & 0x20) !== 0; for (let y = 0; y < h; y++) { const sy = top ? y : h - 1 - y; out.copy(rows, y * w * 4, sy * w * 4, (sy + 1) * w * 4); }
  return sharp(rows, {raw: {width: w, height: h, channels: 4}}).png().toBuffer();
}
const texCache = new Map();
async function texPng(file) {     // 任何贴图 -> png 字节
  if (!texCache.has(file)) { const b = fs.readFileSync(file); texCache.set(file, /\.tga$/i.test(file) ? await tgaToPng(b) : /\.(png)$/i.test(file) ? b : await sharp(b).png().toBuffer()); }
  return texCache.get(file);
}
/** Unity 材质 -> glTF 材质语义：底色贴图 + 颜色 + alphaMode(镂空/半透明) + 双面。关键字在 m_ValidKeywords 里(Unity 2021+)，两处都读 */
function matInfo(matPath) {
  const m = readMaterial(matPath); if (!m) return null; const f = m.floats || {}, c = (m.colors || {})._Color;
  const cut = /_ALPHATEST_ON/.test(m.keywords) || f._Mode === 1, blend = f._DstBlend === 10 || /_ALPHABLEND_ON/.test(m.keywords) || f._Mode === 2;
  return {tex: m.mainTex, color: c ? [c.r, c.g, c.b] : null, alpha: cut ? {mode: 'MASK', cutoff: f._Cutoff ?? 0.5} : blend ? {mode: 'BLEND'} : null, double: f._Cull === 0, name: m.name};
}

/* ---------- FBX -> GLB ---------- */
const fbxCache = new Map();
function fbxToGlbBytes(fbx) {
  if (!fbxCache.has(fbx)) { const o = path.join(TMP, slug(stem(fbx)) + '_' + fbxCache.size); execFileSync(FBX2GLTF, ['-b', '-i', fbx, '-o', o], {stdio: 'pipe'}); fbxCache.set(fbx, fs.readFileSync(o + '.glb')); }
  return fbxCache.get(fbx);
}
const readFbx = fbx => io.readBinary(fbxToGlbBytes(fbx));
function stripAnim(doc) { for (const a of doc.getRoot().listAnimations()) a.dispose(); }
/** 一个 FBX 里的网格节点，按节点名指定材质(Unity 材质路径数组，对应子网格)；'*' = 全部节点 */
async function wearableGlb(fbx, nodeMats) {
  const doc = await readFbx(fbx); stripAnim(doc); const cache = new Map();
  for (const t of doc.getRoot().listTextures()) t.dispose();
  const mk = async mp => {
    if (cache.has(mp)) return cache.get(mp); const info = matInfo(mp); if (!info) return null;
    const m = doc.createMaterial(info.name).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(info.double);
    if (info.tex && fs.existsSync(info.tex)) m.setBaseColorTexture(doc.createTexture(stem(info.tex)).setImage(await texPng(info.tex)).setMimeType('image/png'));
    if (info.color) m.setBaseColorFactor([...info.color, 1]); if (info.alpha) { m.setAlphaMode(info.alpha.mode); if (info.alpha.cutoff != null) m.setAlphaCutoff(info.alpha.cutoff); }
    cache.set(mp, m); return m;
  };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; const mats = nodeMats[node.getName()] || nodeMats['*']; if (!mats || !mats.length) continue;
    const prims = mesh.listPrimitives(); for (let j = 0; j < prims.length; j++) { const mp = mats[Math.min(j, mats.length - 1)]; const m = mp && await mk(mp); if (m) prims[j].setMaterial(m); }
  }
  for (const m of doc.getRoot().listMaterials()) if (!m.listParents().some(p => p.propertyType === 'Primitive')) m.dispose();
  return Buffer.from(await io.writeBinary(doc));
}
/** 仅骨骼节点(统一骨架) */
async function rigGlb(fbx) { const doc = await readFbx(fbx); stripAnim(doc); const r = doc.getRoot(); for (const m of r.listMeshes()) m.dispose(); for (const s of r.listSkins()) s.dispose(); for (const m of r.listMaterials()) m.dispose(); for (const t of r.listTextures()) t.dispose(); return Buffer.from(await io.writeBinary(doc)); }
/** prefab -> 一组 glb(同一个 FBX 一个文件) + parts 列表 */
async function prefabGlbs(prefab, label) {
  const rends = prefabRenderers(prefab); if (!rends.length) throw new Error(`${label}：prefab 里没有找到蒙皮网格渲染器`);
  const byFbx = new Map(); for (const r of rends) { if (!byFbx.has(r.fbx)) byFbx.set(r.fbx, {}); byFbx.get(r.fbx)[r.node || '*'] = r.materials; }
  const out = [], parts = []; let i = 0;
  for (const [fbx, nm] of byFbx) { const f = 'p' + i++; out.push([f, await wearableGlb(fbx, nm)]); for (const [node] of Object.entries(nm)) parts.push({file: f, ...(node !== '*' ? {node} : {})}); }
  return {files: out, parts};
}

/** 一个部件：prefab(推荐)，或者 FBX + 材质(没有 prefab 的老资源) */
async function partGlbs(p, label, A) {
  if (p.prefab) return prefabGlbs(A(p.prefab), label);
  if (!p.fbx) throw new Error(label + '：需要 prefab，或 fbx + material');
  return {files: [['p0', await wearableGlb(A(p.fbx), {'*': p.material ? [A(p.material)] : []})]], parts: [{file: 'p0'}]};
}

/* ---------- 动画：一个 FBX 里可能有多段(.meta 的 clipAnimations)，每段切成一个只含动画的 glb ---------- */
async function animClips(fbx) {
  const meta = (yaml.load(fs.readFileSync(fbx + '.meta', 'utf8').replace(/^(\s+\d+): (-?\d{15,})\s*$/gm, '$1: "$2"')) || {}).ModelImporter || {};
  const clips = ((meta.animations || {}).clipAnimations || []).map(c => ({name: c.name, first: +c.firstFrame, last: +c.lastFrame}));
  const base = await readFbx(fbx); const r = base.getRoot(); const anims = r.listAnimations(); if (!anims.length) throw new Error(stem(fbx) + '：FBX 里没有动画');
  const longest = anims.reduce((a, b) => (L(b) > L(a) ? b : a)); function L(a) { return Math.max(...a.listSamplers().map(s => s.getInput().getMax([0])[0])); }
  const list = clips.length ? clips : [{name: stem(fbx), first: 0, last: Math.round(L(longest) * 30)}]; const out = [];
  for (const c of list) {
    const doc = await readFbx(fbx); const root = doc.getRoot(); for (const m of root.listMeshes()) m.dispose(); for (const s of root.listSkins()) s.dispose(); for (const m of root.listMaterials()) m.dispose(); for (const t of root.listTextures()) t.dispose();
    const as = root.listAnimations(); const keep = as.reduce((a, b) => (L(b) > L(a) ? b : a)); for (const a of as) if (a !== keep) a.dispose(); keep.setName(c.name);
    const t0 = c.first / 30, t1 = c.last / 30; const snap = new Map(); for (const s of keep.listSamplers()) { const inp = s.getInput(); if (!snap.has(inp)) snap.set(inp, inp.getArray().slice()); }
    for (const s of keep.listSamplers()) {      // 按帧范围切段(30fps)；边界按插值补点，常量轨道也能切
      const inp = s.getInput(), o = s.getOutput(), ts = snap.get(inp), ov = o.getArray(), N = Math.round(ov.length / ts.length), step = s.getInterpolation() === 'STEP';
      const at = tt => { let i = 0; while (i < ts.length - 1 && ts[i + 1] <= tt) i++; const j = Math.min(i + 1, ts.length - 1), f = step || ts[j] === ts[i] ? 0 : Math.min(1, Math.max(0, (tt - ts[i]) / (ts[j] - ts[i]))); const v = new Array(N); for (let q = 0; q < N; q++) v[q] = ov[i * N + q] * (1 - f) + ov[j * N + q] * f; return v; };
      const times = [t0]; ts.forEach(tt => { if (tt > t0 + 1e-4 && tt < t1 - 1e-4) times.push(tt); }); times.push(t1);
      const nt = new Float32Array(times.length), nv = new Float32Array(times.length * N); times.forEach((tt, k) => { nt[k] = tt - t0; const v = at(tt); for (let q = 0; q < N; q++) nv[k * N + q] = v[q]; }); inp.setArray(nt); o.setArray(nv);
    }
    out.push({name: c.name, bytes: Buffer.from(await io.writeBinary(doc))});
  }
  return out;
}

/* ---------- 汇总 ---------- */
/**
 * spec(也是 export.json 的格式)：
 * { character:{rig:'Assets/..fbx', parts:[{role:'head',prefab:'Assets/..prefab'},…]}, partner:{…同上}, looks:[{name, head,body,eye,brow,lash(贴图路径)}],
 *   outfits:[{name,prefab,icon?}], hair:[…], shoes:[…], makeup:[{name,texture}], animations:[{fbx, prefix?, kind?}], phone:{prefab}, backgrounds:[{name,image}], sounds:[{name,file}] }
 */
export async function exportSpec(spec, log = console.log) {
  const items = {}, files = new Map(); const warn = [];
  const add = (it, fl) => { items[it.id] = {...it, collection: it.collection || 'unity', tags: it.tags || [], meta: {raw: true, ...(it.meta || {})}}; for (const [p, b] of fl) files.set(p, b); };
  const A = p => { const f = path.isAbsolute(p) ? p : path.join(path.dirname(ASSETS), p); if (!fs.existsSync(f)) throw new Error('找不到文件 ' + p); return f; };
  const wearables = async (list, type) => { for (const w of list || []) { try {
    const id = slug(type + '_' + w.name), g = await partGlbs(w, w.name, A), fl = new Map(), fm = {};
    for (const [f, b] of g.files) { fm[f] = `${id}/${f}.glb`; fl.set(fm[f], b); }
    if (w.icon) { fm.icon = `${id}/icon.png`; fl.set(fm.icon, fs.readFileSync(A(w.icon))); }
    add({id, type, name: w.name, files: fm, meta: {parts: g.parts}}, fl); log(`  ${type} ${w.name}`); } catch (e) { warn.push(`${type} ${w.name}：${e.message}`); } } };
  const rigged = async (spec2, type) => {
    if (!spec2) return; const id = type; const fl = new Map(), fm = {}, parts = []; fm.rig = `${id}/rig.glb`; fl.set(fm.rig, await rigGlb(A(spec2.rig)));
    let n = 0; for (const p of spec2.parts) { const g = await partGlbs(p, p.role, A); for (const [f, b] of g.files) { const k = 'p' + n++; fm[k] = `${id}/${k}.glb`; fl.set(fm[k], b); for (const x of g.parts.filter(q => q.file === f)) parts.push({file: k, role: p.role, ...(x.node ? {node: x.node} : {})}); } }
    add({id, type, name: type === 'partner' ? 'Partner' : 'Heroine', files: fm, meta: {parts}}, fl); log('  ' + type);
  };
  await rigged(spec.character, 'character'); await rigged(spec.partner, 'partner');
  for (const l of spec.looks || []) { const id = slug('look_' + l.name), fl = new Map(), fm = {}; for (const r of ['head', 'body', 'eye', 'brow', 'lash']) if (l[r]) { fm[r] = `${id}/${r}.png`; fl.set(fm[r], await texPng(A(l[r]))); } add({id, type: 'look', name: l.name, files: fm}, fl); log('  look ' + l.name); }
  await wearables(spec.outfits, 'outfit'); await wearables(spec.hair, 'hair'); await wearables(spec.shoes, 'shoes');
  for (const m of spec.makeup || []) { const id = slug('makeup_' + m.name), p = `${id}/tex.png`; add({id, type: 'makeup', name: m.name, files: {tex: p}}, new Map([[p, await texPng(A(m.texture))]])); log('  makeup ' + m.name); }
  for (const b of spec.backgrounds || []) { const id = slug('bg_' + b.name), ext = path.extname(b.image).toLowerCase().replace('.', '') || 'png', p = `${id}/image.${ext}`; add({id, type: 'background', name: b.name, files: {image: p}}, new Map([[p, /tga/.test(ext) ? await texPng(A(b.image)) : fs.readFileSync(A(b.image))]])); log('  background ' + b.name); }
  for (const s of spec.sounds || []) { const id = slug('sfx_' + s.name), ext = path.extname(s.file).toLowerCase().replace('.', ''), p = `${id}/audio.${ext}`; add({id, type: 'sound', name: s.name, files: {audio: p}, meta: {event: s.event}}, new Map([[p, fs.readFileSync(A(s.file))]])); log('  sound ' + s.name); }
  if (spec.phone) { const g = await prefabGlbs(A(spec.phone.prefab), 'phone'); add({id: 'phone', type: 'phone', name: 'Phone', files: {model: 'phone/model.glb'}}, new Map([['phone/model.glb', g.files[0][1]]])); log('  phone'); }
  for (const a of spec.animations || []) { try { for (const c of await animClips(A(a.fbx))) { const nm = (a.prefix || '') + c.name, id = slug('anim_' + nm), p = `${id}/anim.glb`; add({id, type: 'anim', name: nm, files: {anim: p}, meta: {kind: a.kind || (/^phone/i.test(nm) ? 'phone' : 'body')}}, new Map([[p, c.bytes]])); log('  anim ' + nm); } } catch (e) { warn.push(`动画 ${a.fbx}：${e.message}`); } }
  return {items, files, warn};
}
export async function writeZip(result, out) {
  const z = new JSZip(); for (const [p, b] of result.files) z.file(p, b); z.file('manifest.json', JSON.stringify(Object.fromEntries(Object.entries(result.items).map(([id, it]) => [id, {...it}]))));
  fs.writeFileSync(out, await z.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: {level: 6}}));
}

/* ---------- 按约定的目录自动发现(Assets/PlayableExport/…)，没有 export.json 时用 ---------- */
export function discover(root = 'Assets/PlayableExport') {
  const base = path.join(path.dirname(ASSETS), root); if (!fs.existsSync(base)) throw new Error(`没有找到约定目录 ${root}，也没有指定 --spec export.json`);
  const ls = (d, re) => fs.existsSync(path.join(base, d)) ? fs.readdirSync(path.join(base, d)).filter(f => re.test(f)).map(f => path.join(root, d, f)) : [];
  const spec = {};
  const rigFbx = ls('Character', /^rig\.fbx$/i)[0]; if (rigFbx) spec.character = {rig: rigFbx, parts: ls('Character', /\.prefab$/i).map(p => ({role: stem(p).toLowerCase(), prefab: p}))};
  const pRig = ls('Partner', /^rig\.fbx$/i)[0]; if (pRig) spec.partner = {rig: pRig, parts: ls('Partner', /\.prefab$/i).map(p => ({role: stem(p).toLowerCase(), prefab: p}))};
  const lookDirs = fs.existsSync(path.join(base, 'Looks')) ? fs.readdirSync(path.join(base, 'Looks'), {withFileTypes: true}).filter(e => e.isDirectory()) : [];
  spec.looks = lookDirs.map(d => { const o = {name: d.name}; for (const f of fs.readdirSync(path.join(base, 'Looks', d.name))) { const m = f.match(/^(head|body|eye|brow|lash)\.(png|tga|jpg)$/i); if (m) o[m[1].toLowerCase()] = path.join(root, 'Looks', d.name, f); } return o; });
  const w = (d) => ls(d, /\.prefab$/i).map(p => { const ic = ['png', 'jpg'].map(e => p.replace(/\.prefab$/i, '.' + e)).find(f => fs.existsSync(path.join(path.dirname(ASSETS), f))); return {name: stem(p), prefab: p, ...(ic ? {icon: ic} : {})}; });
  spec.outfits = w('Outfits'); spec.hair = w('Hair'); spec.shoes = w('Shoes');
  spec.makeup = ls('Makeup', /\.(png|tga)$/i).map(p => ({name: stem(p), texture: p}));
  spec.backgrounds = ls('Backgrounds', /\.(png|jpg|jpeg|tga)$/i).map(p => ({name: stem(p), image: p}));
  spec.sounds = ls('Sounds', /\.(mp3|wav|ogg)$/i).map(p => ({name: stem(p), file: p, event: stem(p)}));
  const ph = ls('Phone', /\.prefab$/i)[0]; if (ph) spec.phone = {prefab: ph};
  spec.animations = ls('Animations', /\.fbx$/i).map(f => ({fbx: f}));
  return spec;
}
export {setProject};
