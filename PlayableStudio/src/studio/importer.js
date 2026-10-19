// 把上传的文件(或资源包)变成资源库里的素材：校验 -> 压缩 -> 生成图标 -> 登记。每个函数返回 {items, issues}；有 error 级问题时不会入库。
import JSZip from 'jszip';
import {analyzeGlb, optimizeGlb, glbToAnims, renderIcon, imageToWebp, probeAudio, rigBoneNames, LIMITS} from './pipeline.js';
import {slug, extOf} from '../shared/assets.js';

const fileBytes = async f => new Uint8Array(await f.arrayBuffer());
const stem = n => String(n).replace(/\.[^.]+$/, '');
const bad = issues => issues.some(i => i.level === 'error');
let rigCache = null;
async function rigNames(lib, rigPath) { const p = rigPath || lib.rigNamesSource(); if (!p) return null; if (!rigCache || rigCache.p !== p) rigCache = {p, names: await rigBoneNames(lib.bytes(p))}; return rigCache.names; }

/** 服装 / 发型 / 鞋：一个或多个 glb(多个 = 同一件的多个部件，如裙子 + 手套) */
export async function importWearable(lib, files, type, opts = {}) {
  const issues = [], store = new Map(), parts = [], bytesList = []; const rig = await rigNames(lib, opts.rig);
  const name = opts.name || stem(files[0].name); const id = lib.uniqueId(type + '_' + slug(name)); let tris = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; const raw = f instanceof Uint8Array ? f : await fileBytes(f); const tag = files.length > 1 ? `${f.name || '部件' + i}：` : '';
    const a = await analyzeGlb(raw, rig); for (const x of a.issues) issues.push({...x, msg: tag + x.msg}); if (bad(a.issues)) continue;
    tris += a.meta.tris; const out = await optimizeGlb(a.doc, {maxTex: LIMITS.tex[type] || 1024, quality: .78});
    const rel = `u/${id}/p${i}.glb`; store.set(rel, out); parts.push({file: 'p' + i, ...(opts.parts && opts.parts[i] && opts.parts[i].node ? {node: opts.parts[i].node} : {}), ...(opts.parts && opts.parts[i] && opts.parts[i].role ? {role: opts.parts[i].role} : {})}); bytesList.push(out);
  }
  if (bad(issues) || !parts.length) return {items: [], issues};
  const lim = (LIMITS.tris || {})[type]; if (lim && tris > lim) issues.push({level: 'warn', msg: `面数 ${Math.round(tris)} 超过建议上限 ${lim}`});
  const size = [...store.values()].reduce((s, b) => s + b.length, 0); if (size > 250 * 1024) issues.push({level: 'warn', msg: `压缩后 ${(size / 1024).toFixed(0)} KB，偏大(建议单件不超过 250 KB)`});
  const files2 = {}; for (const p of parts) files2[p.file] = `u/${id}/${p.file}.glb`;
  try { const ic = await renderIcon(bytesList); if (ic) { const rel = `u/${id}/icon.webp`; store.set(rel, ic.bytes); files2.icon = rel; } } catch (e) { issues.push({level: 'warn', msg: '图标生成失败：' + e.message}); }
  const item = {id, type, name, collection: opts.collection || 'upload', tags: [], files: files2, meta: {parts, tris: Math.round(tris), bytes: size}};
  await lib.add(item, store); return {items: [item], issues};
}

/** 妆容：头部 UV 的 RGBA 贴图 */
export async function importMakeup(lib, file, opts = {}) {
  const name = opts.name || stem(file.name || 'makeup'); const id = lib.uniqueId('makeup_' + slug(name)); const raw = file instanceof Uint8Array ? file : await fileBytes(file);
  const tex = await imageToWebp(raw, {max: 1024, quality: .85, mime: file.type || 'image/png'}); const issues = [];
  if (tex.width !== tex.height) issues.push({level: 'warn', msg: '妆容贴图应该是正方形(和头部贴图同一布局)'});
  const cv = new OffscreenCanvas(256, 256), g = cv.getContext('2d'); g.fillStyle = '#eec9ac'; g.fillRect(0, 0, 256, 256);
  const bmp = await createImageBitmap(new Blob([tex.bytes], {type: 'image/' + tex.ext})); g.drawImage(bmp, 0, 0, 256, 256);
  const icon = new Uint8Array(await (await cv.convertToBlob({type: 'image/webp', quality: .85})).arrayBuffer());
  const item = {id, type: 'makeup', name, collection: 'upload', tags: [], files: {tex: `u/${id}/tex.${tex.ext}`, icon: `u/${id}/icon.webp`}, meta: {}};
  await lib.add(item, new Map([[item.files.tex, tex.bytes], [item.files.icon, icon]])); return {items: [item], issues};
}
/** 背景：按 9:16 居中裁切，最长边不超过 1920 */
export async function importBackground(lib, file, opts = {}) {
  const name = opts.name || stem(file.name || 'background'); const id = lib.uniqueId('bg_' + slug(name)); const raw = file instanceof Uint8Array ? file : await fileBytes(file);
  const r = await imageToWebp(raw, {max: 1920, quality: .8, mime: file.type || 'image/png', cover: [9, 16]});
  const item = {id, type: 'background', name, collection: 'upload', tags: [], files: {image: `u/${id}/image.${r.ext}`}, meta: {w: r.width, h: r.height}};
  await lib.add(item, new Map([[item.files.image, r.bytes]])); return {items: [item], issues: [{level: 'ok', msg: `已按 9:16 裁切为 ${r.width}x${r.height}`}]};
}
/** 音效：mp3 / wav / ogg，原样保存(只检查能不能解码) */
export async function importSound(lib, file, opts = {}) {
  const name = opts.name || stem(file.name || 'sound'); const id = lib.uniqueId('sfx_' + slug(name)); const raw = file instanceof Uint8Array ? file : await fileBytes(file); const issues = [];
  let meta = {}; try { meta = await probeAudio(raw); } catch (e) { return {items: [], issues: [{level: 'error', msg: '无法解码这个音频文件：' + e.message}]}; }
  if (meta.duration > 3) issues.push({level: 'warn', msg: `时长 ${meta.duration} 秒偏长，音效建议 3 秒以内`});
  if (raw.length > 80 * 1024) issues.push({level: 'warn', msg: `${(raw.length / 1024).toFixed(0)} KB 偏大，会占用包体预算`});
  const ext = extOf(file.name || 'x.mp3'); const item = {id, type: 'sound', name, collection: 'upload', tags: [], files: {audio: `u/${id}/audio.${ext}`}, meta};
  await lib.add(item, new Map([[item.files.audio, raw]])); return {items: [item], issues};
}
/** 动画：glb 里的每一段动画各成一个素材。kind = body(角色) | phone(手机)；角色动画只保留统一骨架里有的骨骼 */
export async function importAnims(lib, file, kind = 'body', opts = {}) {
  const raw = file instanceof Uint8Array ? file : await fileBytes(file); const rig = kind === 'body' ? await rigNames(lib, opts.rig) : null; const issues = [];
  const list = await glbToAnims(raw, rig); if (!list.length) return {items: [], issues: [{level: 'error', msg: '文件里没有可用的动画(或骨骼名都对不上统一骨架)'}]};
  const items = [];
  for (const a of list) {
    const nm = opts.name && list.length === 1 ? opts.name : (list.length === 1 ? stem(file.name || a.name) : a.name); const id = lib.uniqueId('anim_' + slug(nm));
    const item = {id, type: 'anim', name: nm, collection: 'upload', tags: [], files: {anim: `u/${id}/anim.anim`}, meta: {duration: a.duration, kind, face: a.face}};
    await lib.add(item, new Map([[item.files.anim, a.bytes]])); items.push(item);
    if (a.bytes.length > 150 * 1024) issues.push({level: 'warn', msg: `「${nm}」${(a.bytes.length / 1024).toFixed(0)} KB 偏大，可以减少关键帧或去掉不用的骨骼`});
  }
  return {items, issues};
}
/** 外观：同一模型的一组贴图 */
export async function importLook(lib, imgs, opts = {}) {
  const name = opts.name || '外观'; const id = lib.uniqueId('look_' + slug(name)); const store = new Map(), files = {}; let sw = '#d9a679';
  for (const role of ['head', 'body', 'eye', 'brow', 'lash']) {
    const f = imgs[role]; if (!f) continue; const raw = f instanceof Uint8Array ? f : await fileBytes(f); const r = await imageToWebp(raw, {max: role === 'head' || role === 'body' ? 1024 : 512, quality: .85, mime: f.type || 'image/png'});
    files[role] = `u/${id}/${role}.${r.ext}`; store.set(files[role], r.bytes);
    if (role === 'body') { const bmp = await createImageBitmap(new Blob([r.bytes], {type: 'image/' + r.ext})); const c = new OffscreenCanvas(8, 8).getContext('2d'); c.drawImage(bmp, 0, 0, 8, 8); const d = c.getImageData(0, 0, 8, 8).data; let R = 0, G = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } if (n) sw = `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`; }
  }
  if (!files.head || !files.body) return {items: [], issues: [{level: 'error', msg: '外观至少需要头部和身体两张贴图'}]};
  const item = {id, type: 'look', name, collection: 'upload', tags: [], files, meta: {swatch: sw}}; await lib.add(item, store); return {items: [item], issues: []};
}
export async function importPhone(lib, file, opts = {}) {
  const raw = file instanceof Uint8Array ? file : await fileBytes(file); const a = await analyzeGlb(raw, null); if (bad(a.issues)) return {items: [], issues: a.issues};
  const out = await optimizeGlb(a.doc, {plain: true, maxTex: 512, quality: .8}); const name = opts.name || stem(file.name || 'phone'); const id = lib.uniqueId('phone_' + slug(name));
  const item = {id, type: 'phone', name, collection: 'upload', tags: [], files: {model: `u/${id}/model.glb`}, meta: {tris: Math.round(a.meta.tris)}}; await lib.add(item, new Map([[item.files.model, out]])); return {items: [item], issues: a.issues};
}

/** 资源包(ZIP)：manifest.json + 文件。Unity 导出工具产出 meta.raw=true 的素材(还没压缩的 glb/图片)，这里按类型补做校验、压缩、图标；已处理好的素材直接入库 */
export async function importZip(lib, file) {
  const z = await JSZip.loadAsync(file); const mf = z.file('manifest.json'); if (!mf) return {items: [], issues: [{level: 'error', msg: '资源包里没有 manifest.json'}]};
  const manifest = JSON.parse(await mf.async('string')); const items = [], issues = [];
  const get = async p => { const f = z.file(p); if (!f) throw new Error('资源包里缺少文件 ' + p); return new Uint8Array(await f.async('uint8array')); };
  for (const src of Object.values(manifest)) {
    try {
      const tag = `[${src.name || src.id}] `; let r;
      if (src.meta && src.meta.raw) r = await importRaw(lib, src, get);
      else r = await importProcessed(lib, src, get);
            items.push(...r.items); issues.push(...r.issues.map(i => ({...i, msg: tag + i.msg})));
    } catch (e) { issues.push({level: 'error', msg: `[${src.name || src.id}] ${e.message}`}); }
  }
  return {items, issues};
}
async function importProcessed(lib, src, get) {
  const store = new Map(), files = {}; for (const [role, p] of Object.entries(src.files)) { const rel = 'u/' + p; store.set(rel, await get(p)); files[role] = rel; }
  const item = {...src, files, collection: src.collection || 'pack'}; await lib.add(item, store); return {items: [item], issues: []};
}
async function importRaw(lib, src, get) {
  const wrap = async role => { const b = await get(src.files[role]); const u = new Uint8Array(b); return Object.assign(u, {name: src.files[role], type: ''}); };
  switch (src.type) {
    case 'outfit': case 'hair': case 'shoes': { const fs = []; for (const p of src.meta.parts || [{file: 'model'}]) fs.push(await wrap(p.file)); return importWearable(lib, fs, src.type, {name: src.name, parts: src.meta.parts}); }
    case 'makeup': return importMakeup(lib, await wrap('tex'), {name: src.name});
    case 'background': return importBackground(lib, await wrap('image'), {name: src.name});
    case 'sound': return importSound(lib, await wrap('audio'), {name: src.name});
    case 'phone': return importPhone(lib, await wrap('model'), {name: src.name});
    case 'anim': return importAnims(lib, await wrap('anim'), src.meta.kind || 'body', {name: src.name});
    case 'look': { const imgs = {}; for (const r of ['head', 'body', 'eye', 'brow', 'lash']) if (src.files[r]) imgs[r] = await wrap(r); return importLook(lib, imgs, {name: src.name}); }
    case 'character': case 'partner': return importCharacter(lib, src, get);
  }
  return {items: [], issues: [{level: 'error', msg: '不认识的素材类型 ' + src.type}]};
}
/** 角色 / 男角色：骨架(原样) + 各部件(按这套骨架校验、压缩) */
async function importCharacter(lib, src, get) {
  const id = lib.uniqueId(src.type === 'partner' ? 'partner' : 'character'); const store = new Map(), files = {}, issues = [];
  const rigBytes = await get(src.files.rig); files.rig = `u/${id}/rig.glb`; store.set(files.rig, rigBytes); const names = await rigBoneNames(rigBytes);
  for (const p of src.meta.parts || []) {
    const a = await analyzeGlb(await get(src.files[p.file]), names); for (const x of a.issues) issues.push({...x, msg: `${p.role || p.file}：${x.msg}`}); if (bad(a.issues)) continue;
    files[p.file] = `u/${id}/${p.file}.glb`; store.set(files[p.file], await optimizeGlb(a.doc, {maxTex: 1024, quality: .85}));
  }
  if (bad(issues)) return {items: [], issues};
  const item = {id, type: src.type, name: src.name || id, collection: 'pack', tags: [], files, meta: {parts: src.meta.parts}}; await lib.add(item, store); rigCache = null; return {items: [item], issues};
}

/** 把资源库(用户素材)导出成资源包 ZIP，方便备份和团队共享 */
export async function exportZip(lib, ids) {
  const z = new JSZip(); const manifest = {};
  for (const id of ids || Object.keys(lib.user)) { const it = lib.user[id]; if (!it) continue; const files = {}; for (const [role, p] of Object.entries(it.files)) { const rel = p.replace(/^u\//, ''); z.file(rel, lib.bytes(p)); files[role] = rel; } manifest[id] = {...it, files}; }
  z.file('manifest.json', JSON.stringify(manifest)); return z.generateAsync({type: 'blob', compression: 'DEFLATE'});
}
