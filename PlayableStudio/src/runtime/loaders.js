import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {decodeAnim} from '../shared/anim-format.js';
THREE.ColorManagement.enabled = false;      // 按原始 sRGB 数值计算，和美术软件里看到的一致(不做线性空间转换)

const gl = new GLTFLoader(); gl.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
/** 解析 glb 字节(按路径缓存) */
export function loadGlb(store, path) {
  if (!cache.has(path)) { const u8 = store.bytesAt(path); const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); cache.set(path, new Promise((res, rej) => gl.parse(ab, '', res, rej))); }
  return cache.get(path);
}
const texCache = new Map();
export function loadTexture(store, id, role) {
  const key = id + '/' + role; if (texCache.has(key)) return texCache.get(key);
  const url = store.url(id, role); if (!url) return Promise.resolve(null);
  const p = new Promise((res, rej) => new THREE.TextureLoader().load(url, t => { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; res(t); }, undefined, rej));
  texCache.set(key, p); return p;
}
const clipCache = new Map();
/** 动画资产 -> THREE.AnimationClip */
export function loadClip(store, id) {
  if (clipCache.has(id)) return clipCache.get(id);
  const {duration, tracks} = decodeAnim(store.bytes(id, 'anim'));
  const out = tracks.map(t => t.p === 'q' ? new THREE.QuaternionKeyframeTrack(`${t.n}.quaternion`, t.times, t.values)
    : t.p === 'm' ? new THREE.NumberKeyframeTrack(`${t.n}.morphTargetInfluences`, t.times, t.values)
    : new THREE.VectorKeyframeTrack(`${t.n}.${t.p === 's' ? 'scale' : 'position'}`, t.times, t.values));
  const clip = new THREE.AnimationClip(id, duration, out); clipCache.set(id, clip); return clip;
}
export function clearCaches() { cache.clear(); texCache.clear(); clipCache.clear(); }
