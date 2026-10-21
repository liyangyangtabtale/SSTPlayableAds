// 资源导入流水线(浏览器里运行)：校验 -> 压缩 -> 生成图标 -> 产出资源库 item。
// 上传的 glb / 图片 / 声音 / 动画都走这里；Unity 导出工具产出的资源包也走同一套检查。
import {WebIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {resample} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder as ThreeMeshopt} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {encodeAnim} from '../shared/anim-format.js';
import {optimizeDoc} from '../shared/glb-optimize.js';

const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder});
export const sanitize = n => String(n || '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
const stripDup = n => n.replace(/_\d+$/, '');
export const LIMITS = {tex: {outfit: 1024, hair: 512, shoes: 512, character: 1024, partner: 1024, phone: 512}, tris: {outfit: 20000, hair: 15000, shoes: 8000}};

/* ---------- 图片 ---------- */
/** TGA(无压缩/RLE，24/32 位)解码成 ImageData；浏览器不能直接读 TGA。不是 TGA 返回 null */
function decodeTga(b) {
  if (b.length < 18 || ![2, 10].includes(b[2]) || ![24, 32].includes(b[16]) || (b[1] !== 0 && b[1] !== 1)) return null;
  const idLen = b[0], type = b[2], w = b[12] | b[13] << 8, h = b[14] | b[15] << 8, bpp = b[16], desc = b[17], px = bpp / 8; if (!w || !h || w > 8192 || h > 8192) return null;
  let p = 18 + idLen + (b[1] ? (b[5] | b[6] << 8) * Math.ceil(b[7] / 8) : 0); const out = new Uint8ClampedArray(w * h * 4); let n = 0;
  const put = (o, i) => { out[o] = b[i + 2]; out[o + 1] = b[i + 1]; out[o + 2] = b[i]; out[o + 3] = px === 4 ? b[i + 3] : 255; };
  if (type === 2) for (; n < w * h && p + px <= b.length; n++, p += px) put(n * 4, p);
  else while (n < w * h && p < b.length) { const hd = b[p++], c = (hd & 127) + 1; if (hd & 128) { for (let k = 0; k < c && n < w * h; k++) put((n++) * 4, p); p += px; } else for (let k = 0; k < c && n < w * h; k++, p += px) put((n++) * 4, p); }
  const rows = new Uint8ClampedArray(w * h * 4), top = (desc & 0x20) !== 0; for (let y = 0; y < h; y++) { const sy = top ? y : h - 1 - y; rows.set(out.subarray(sy * w * 4, (sy + 1) * w * 4), y * w * 4); }
  return new ImageData(rows, w, h);
}
const isPngJpgWebp = b => (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x52 && b[1] === 0x49);
export async function imageToWebp(bytes, {max = 1024, quality = 0.8, mime = 'image/png', cover = null} = {}) {
  const tga = !isPngJpgWebp(bytes) ? decodeTga(bytes) : null;
  const bmp = tga ? await createImageBitmap(tga) : await createImageBitmap(new Blob([bytes], {type: mime}));
  let w = bmp.width, h = bmp.height, sx = 0, sy = 0, sw = w, sh = h;
  if (cover) { const r = cover[0] / cover[1]; if (w / h > r) { sw = Math.round(h * r); sx = Math.round((w - sw) / 2); } else { sh = Math.round(w / r); sy = Math.round((h - sh) / 2); } w = sw; h = sh; }
  const k = Math.min(1, max / Math.max(w, h)); const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = new OffscreenCanvas(cw, ch); cv.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
  let blob = await cv.convertToBlob({type: 'image/webp', quality});
  if (blob.type !== 'image/webp') blob = await cv.convertToBlob({type: 'image/png'});    // 浏览器不支持 webp 编码(如 Safari)时退回 png，建议用 Chrome / Edge
  return {bytes: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/webp' ? 'webp' : 'png', width: cw, height: ch};
}

/* ---------- glb ---------- */
export async function readGlb(bytes) { return io.readBinary(bytes); }
/** 检查一个服装/发型/鞋/角色部件 glb：骨骼是否都在统一骨架里、面数、贴图、材质 */
export async function analyzeGlb(bytes, rigNames) {
  const doc = await readGlb(bytes); const root = doc.getRoot(); const issues = []; const meta = {tris: 0, verts: 0, bones: 0, meshes: 0, morphs: 0, textures: [], materials: []};
  const skins = root.listSkins(); meta.bones = skins.reduce((a, s) => a + s.listJoints().length, 0);
  for (const m of root.listMeshes()) { meta.meshes++; for (const p of m.listPrimitives()) { const idx = p.getIndices(), pos = p.getAttribute('POSITION'); meta.verts += pos ? pos.getCount() : 0; meta.tris += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0); meta.morphs = Math.max(meta.morphs, p.listTargets().length); } }
  for (const t of root.listTextures()) { const s = t.getSize(); meta.textures.push({w: s ? s[0] : 0, h: s ? s[1] : 0, mime: t.getMimeType()}); }
  for (const m of root.listMaterials()) meta.materials.push({alpha: m.getAlphaMode(), double: m.getDoubleSided(), tex: !!m.getBaseColorTexture()});
  if (rigNames && skins.length) {
    const set = new Set([...rigNames].map(stripDup)); const missing = new Set();
    for (const s of skins) for (const j of s.listJoints()) { const n = sanitize(j.getName()); if (!rigNames.has(n) && !set.has(stripDup(n))) missing.add(n); }
    if (missing.size) issues.push({level: 'error', msg: `有 ${missing.size} 个骨骼不在统一骨架里（如 ${[...missing].slice(0, 3).join('、')}）`});
  }
  if (!skins.length) issues.push({level: 'warn', msg: '没有蒙皮信息，只能当静态网格使用'});
  if (!meta.materials.some(m => m.tex)) issues.push({level: 'warn', msg: '材质没有底色贴图'});
  if (!meta.meshes) issues.push({level: 'error', msg: '文件里没有网格'});
  return {doc, meta, issues};
}
/** 压缩(见 shared/glb-optimize.js)：浏览器里用 canvas 编码 webp */
export async function optimizeGlb(doc, {plain = false, maxTex = 1024, quality = 0.8} = {}) {
  await optimizeDoc(doc, {encodeImage: (b, mime, o) => imageToWebp(b, {...o, mime}), MeshoptEncoder, plain, maxTex, quality});
  return new Uint8Array(await io.writeBinary(doc));
}
/** 取出骨架 glb 里的骨骼名集合(统一骨架的“合同”) */
export async function rigBoneNames(bytes) { const doc = await readGlb(bytes); return new Set(doc.getRoot().listNodes().map(n => sanitize(n.getName()))); }

/* ---------- 动画 ---------- */
/** glb 里的每一段动画 -> 一个 .anim。只保留骨架里有的骨骼轨道 + 形变权重(脸部表情)轨道 */
export async function glbToAnims(bytes, rigNames, {tolerance = 0.0005} = {}) {
  const doc = await readGlb(bytes); const out = [];
  await doc.transform(resample({tolerance}));
  for (const anim of doc.getRoot().listAnimations()) {
    const tracks = []; let dur = 0;
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode(); if (!node) continue; const s = ch.getSampler(); const times = s.getInput().getArray(), vals = s.getOutput().getArray(); if (!times.length) continue;
      const n = sanitize(node.getName()), path = ch.getTargetPath(); dur = Math.max(dur, times[times.length - 1]);
      if (path === 'weights') tracks.push({n, p: 'm', times, values: vals, w: Math.round(vals.length / times.length)});
      else if (rigNames && !rigNames.has(n) && !rigNames.has(stripDup(n))) continue;
      else tracks.push({n, p: path === 'rotation' ? 'q' : path === 'scale' ? 's' : 't', times, values: vals});
    }
    if (tracks.length) out.push({name: anim.getName() || 'anim', duration: +dur.toFixed(3), bytes: encodeAnim(dur, tracks), face: tracks.some(t => t.p === 'm'), tracks: tracks.length});
  }
  return out;
}

/* ---------- 图标：把单件服装/发型/鞋从正面渲染成统一角度和灯光的小图 ---------- */
const gl = new GLTFLoader(); gl.setMeshoptDecoder(ThreeMeshopt);
let iconRenderer = null;
export async function renderIcon(glbList, {size = 256, yaw = 0} = {}) {
  const list = Array.isArray(glbList) ? glbList : [glbList];
  const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(1, 2, 3); scene.add(d);
  const group = new THREE.Group(); scene.add(group);
  for (const bytes of list) {
    const gltf = await new Promise((res, rej) => gl.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', res, rej));
    gltf.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.side = THREE.DoubleSide; }); } }); group.add(gltf.scene);
  }
  group.rotation.y = yaw; group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group); if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); const cam = new THREE.PerspectiveCamera(25, 1, .05, 100);
  const dist = (Math.max(sz.y, sz.x) * .62) / Math.tan(THREE.MathUtils.degToRad(12.5)); cam.position.set(c.x, c.y, c.z + dist + sz.z); cam.lookAt(c);
  iconRenderer = iconRenderer || new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true}); iconRenderer.setSize(size, size, false); iconRenderer.setClearColor(0, 0); iconRenderer.render(scene, cam);
  const png = new Uint8Array(await (await new Promise(res => iconRenderer.domElement.toBlob(res, 'image/png'))).arrayBuffer());
  return imageToWebp(png, {max: size, quality: .85});
}

/* ---------- 声音 ---------- */
export async function probeAudio(bytes) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); try { const b = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); return {duration: +b.duration.toFixed(2)}; } finally { ctx.close(); }
}
