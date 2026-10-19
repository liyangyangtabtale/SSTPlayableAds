// 带骨架的角色基类：把蒙皮部件按骨骼名重绑到同一套骨架上，动画播放(淡入淡出、播完接下一个)，骨盆锁定。
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {styleMaterial} from './material.js';

const sanitize = n => String(n || '').replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
const stripDup = n => n.replace(/_\d+$/, '');
export const FADE = 0.25;

export class Rigged {
  constructor(light) { this.light = light; this.root = new THREE.Group(); this.slots = {}; this.queue = []; this.cur = null; this.clipCache = new Map(); }

  /** rigGltf = 只含骨骼节点的 glb */
  initRig(rigGltf) {
    this.rig = SkeletonUtils.clone(rigGltf.scene); this.root.add(this.rig);
    this.bones = {}; this.rig.traverse(o => { if (!this.bones[o.name]) this.bones[o.name] = o; });
    this.mixer = new THREE.AnimationMixer(this.rig);
    this.pelvis = Object.values(this.bones).find(b => /pelvis/i.test(b.name)) || null;
    if (this.pelvis) { this.rig.position.set(0, 0, 0); this.root.updateMatrixWorld(true); this.pelvisRest = this.root.worldToLocal(this.pelvis.getWorldPosition(new THREE.Vector3())); }
  }

  /** 挂一个部件：gltf 里的蒙皮网格按骨骼名绑到本骨架。opts.node 只取该节点下的网格；opts.role 写进材质 userData，方便按部位换贴图 */
  attach(gltf, opts = {}) {
    const scene = SkeletonUtils.clone(gltf.scene); const holder = new THREE.Group(); holder.name = 'part';
    const want = opts.node ? sanitize(opts.node) : null; const meshes = [];
    scene.traverse(o => { if (!o.isSkinnedMesh) return; if (want && o.name !== want && !(o.parent && o.parent.name === want)) return; meshes.push(o); });
    if (want && !meshes.length) console.warn('找不到网格节点', opts.node);
    for (const m of meshes) {
      const sk = m.skeleton;
      const bones = sk.bones.map(b => this.bones[b.name] || this.bones[stripDup(b.name)] || b);   // 重名后缀 _1 去掉再找；找不到就用部件自带的骨骼
      m.parent && m.parent.remove(m); m.frustumCulled = false;
      m.bind(new THREE.Skeleton(bones, sk.boneInverses), m.bindMatrix);
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      m.material = styleMaterial(src, this.light); m.material.userData.role = opts.role || null;
      m.renderOrder = m.material.userData.order || 0; holder.add(m);
    }
    this.rig.add(holder); return holder;
  }
  attachStatic(gltf, opts = {}) {    // 非蒙皮网格(手机等)：整个场景直接挂到 rig 上
    const scene = gltf.scene.clone(true);
    scene.traverse(o => { if (o.isMesh) { const src = Array.isArray(o.material) ? o.material[0] : o.material; o.material = styleMaterial(src, this.light); o.frustumCulled = false; } });
    this.rig.add(scene); return scene;
  }
  remove(slot) { const h = this.slots[slot]; if (!h) return; this.rig.remove(h); h.traverse(o => { if (o.isSkinnedMesh) o.skeleton.dispose && o.skeleton.dispose(); }); delete this.slots[slot]; }

  /* ---------- 动画 ---------- */
  /** 去掉本角色里找不到节点的轨道(同一段动画给不同角色用时，避免 three 一直报警告) */
  fit(clip) {
    if (this.clipCache.has(clip)) return this.clipCache.get(clip);
    const tracks = clip.tracks.filter(t => { const n = t.name.slice(0, t.name.lastIndexOf('.')); return this.rig.getObjectByName(n); });
    const c = new THREE.AnimationClip(clip.name, clip.duration, tracks); this.clipCache.set(clip, c); return c;
  }
  step(clip, loop, maxLen) { if (!clip) return null; const c = this.fit(clip); return {clip: c, loop, length: maxLen > 0 ? Math.min(maxLen, c.duration) : c.duration}; }
  begin(step, fade = FADE) {
    if (!step) return;
    const a = this.mixer.clipAction(step.clip); a.reset(); a.setLoop(step.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true; a.timeScale = 1; a.play();
    if (this.cur && this.cur.action !== a) this.cur.action.crossFadeTo(a, Math.max(.01, fade), false);
    this.cur = {action: a, step, fade: Math.max(.01, fade)};
  }
  /** 播放 clip；非循环播完后接着循环 then(没有就停在最后一帧) */
  play(clip, {loop = true, then = null, fade = FADE, max = 0} = {}) {
    this.queue = []; if (then) { const s = this.step(then, true); if (s) this.queue.push(s); }
    const s = this.step(clip, loop, max); if (s) this.begin(s, fade); else if (this.queue.length) this.begin(this.queue.shift(), fade);
  }
  /** 依次播放 [{clip,max}]，前面的各播一遍，最后一个循环 */
  playSeq(list) {
    const steps = list.map(x => this.step(x.clip, false, x.max || 0)).filter(Boolean); if (!steps.length) return;
    steps[steps.length - 1].loop = true; this.queue = steps.slice(1); this.begin(steps[0], FADE);
  }
  update(dt) {
    if (!this.mixer) return;
    this.mixer.update(dt);
    const c = this.cur;
    if (c && !c.step.loop) {
      const t = c.action.time;
      if (this.queue.length) { if (t >= c.step.length - c.fade) this.begin(this.queue.shift(), FADE); }
      else if (t >= c.step.length - 0.02) c.action.timeScale = 0;     // 停在最后一帧
    }
    this.lockPelvis();
  }
  /** 动画里骨盆会水平位移，这里把骨架反向拉回，让角色位置只由 root 决定 */
  lockPelvis() {
    if (!this.pelvis) return;
    this.rig.position.set(0, 0, 0); this.root.updateMatrixWorld(true);
    const p = this.root.worldToLocal(this.pelvis.getWorldPosition(new THREE.Vector3()));
    this.rig.position.x = -(p.x - this.pelvisRest.x); this.rig.position.z = -(p.z - this.pelvisRest.z);
  }
}
