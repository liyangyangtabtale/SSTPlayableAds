// 试玩流程：开场(可选) → 各换装阶段(选择 + 确认) → 结局(可选)；相机、灯光、旋转、音效、动作组。全部由配置驱动。
import * as THREE from 'three';
import {Character} from './character.js';
import {Phone} from './phone.js';
import {LightRig} from './lighting.js';
import {SkinRig} from './skin.js';
import {loadClip} from './loaders.js';
import {Sfx} from './audio.js';
import {STAGE_LABELS} from '../shared/schema.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const smoothDamp = (cur, target, vel, smooth, dt) => {
  smooth = Math.max(.0001, smooth); const om = 2 / smooth, x = om * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
  const ch = cur - target; const tmp = (vel.v + om * ch) * dt; vel.v = (vel.v - om * tmp) * e; return target + (ch + tmp) * e;
};
const rad = d => d * Math.PI / 180;

export class Game {
  constructor(cfg, store, canvas, ui, channel) {
    this.cfg = cfg; this.store = store; this.ui = ui; this.channel = channel;
    this.renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true});   // 没有 WebGL 时这里会抛错，由 main 做降级
    this.renderer.setClearColor(0, 0); this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(cfg.camera.fov, 9 / 16, .1, 200);
    this.light = new LightRig(); this.light.apply(cfg.lighting); this.sfx = new Sfx(store, cfg.sound);
    this.clock = new THREE.Clock(); this.token = 0; this.groups = {}; this.last = {};
    this.camT = {x: 0, y: 1, z: 4, fov: cfg.camera.fov, pitch: 0}; this.vel = [{v: 0}, {v: 0}, {v: 0}, {v: 0}, {v: 0}];
    this.rotY = 0; this.canRotate = false; this.rotVel = 0; this.dragged = false; this.phase = 'init';
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setBg(which) {
    const id = this.cfg.theme.backgrounds[which] || this.cfg.theme.backgrounds.play; const bg = document.getElementById('bg'); if (!bg) return;
    const url = id ? this.store.url(id, 'image') : ''; bg.style.background = url ? `url(${url}) center/cover` : '';
  }

  async load() {
    const cfg = this.cfg, st = this.store;
    this.ui.applyTheme(cfg.theme); this.setBg('play');
    for (const [ev, ids] of Object.entries(cfg.animations)) this.groups[ev] = (ids || []).filter(id => st.has(id)).map(id => loadClip(st, id));
    if (!cfg.character.model || !st.has(cfg.character.model)) throw new Error('配置里没有角色模型，或资源包里缺少它');
    this.girl = new Character(this.light); if (cfg.skin && cfg.skin.enabled) this.girl.skinRig = new SkinRig(cfg.skin);   // 皮肤着色只给女主角
    await this.girl.build(st, cfg.character.model);
    if (cfg.character.look && st.has(cfg.character.look)) await this.girl.setLook(cfg.character.look);
    const jobs = [];
    if (cfg.character.defaultOutfit) jobs.push(this.girl.equip('outfit', cfg.character.defaultOutfit));
    if (cfg.character.defaultHair) jobs.push(this.girl.equip('hair', cfg.character.defaultHair));
    this.scene.add(this.girl.root); this.girlShadow = this.makeShadow(); this.scene.add(this.girlShadow);
    if (cfg.character.partnerEnabled && cfg.character.partner && st.has(cfg.character.partner)) {
      this.boy = new Character(this.light); await this.boy.build(st, cfg.character.partner); this.boy.root.visible = false;
      this.boyShadow = this.makeShadow(); this.boyShadow.visible = false; this.scene.add(this.boy.root, this.boyShadow);
    }
    if (cfg.phone.model && st.has(cfg.phone.model)) {
      this.phone = new Phone(this.light); await this.phone.build(st, cfg.phone.model); this.phone.root.visible = false; this.girl.root.add(this.phone.root);
      this.phoneClips = {take: cfg.phone.take && st.has(cfg.phone.take) ? loadClip(st, cfg.phone.take) : null, end: cfg.phone.end && st.has(cfg.phone.end) ? loadClip(st, cfg.phone.end) : null};
    }
    // 衣柜里每个阶段的选项(取素材池前 count 个)
    this.stages = cfg.flow.stages.filter(s => s.enabled && s.options.length).map(s => ({
      type: s.type, columns: s.columns,
      options: s.options.slice(0, s.count).filter(o => st.has(o.asset)).map(o => ({asset: o.asset, good: o.good, icon: st.url(o.asset, 'icon'), label: st.item(o.asset).name})),
    }));
    await Promise.all(jobs); this.attachRotation();
  }
  /** 脚下的接触阴影：一层深色的柔边椭圆(中心浓、边缘渐隐)。位置跟着角色，方向和大小由灯光配置控制 */
  makeShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(15,6,10,1)'); grd.addColorStop(.5, 'rgba(15,6,10,.85)'); grd.addColorStop(.8, 'rgba(15,6,10,.35)'); grd.addColorStop(1, 'rgba(15,6,10,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.6, .4), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false}));
    m.rotation.x = -Math.PI / 2; m.renderOrder = -1; return m;
  }

  /* ---------- 动作组：每个事件一个动作组，随机挑，不连续重复 ---------- */
  pick(ev) {
    const g = this.groups[ev] || []; if (!g.length) return null; if (g.length === 1) return g[0];
    let i; do { i = Math.floor(Math.random() * g.length); } while (i === this.last[ev]); this.last[ev] = i; return g[i];
  }
  idleClip() { return (this.groups.idle || [])[0] || null; }

  /* ---------- 相机 / 布局 ---------- */
  shot(which, snap) {
    const c = this.cfg.camera, T = this.camT;
    if (which === 'outro') Object.assign(T, {x: c.outroShiftX, y: c.outroHeight, z: c.outroDistance, pitch: c.outroPitch || 0}); else Object.assign(T, {x: c.shiftX, y: c.height, z: c.distance, pitch: c.pitch || 0});
    T.fov = c.fov; if (snap) { this.camera.position.set(T.x, T.y, T.z); this.camera.fov = T.fov; this.camera.updateProjectionMatrix(); }
  }
  layout(mode) {
    const L = this.cfg.layout;
    if (mode === 'play') { const c = L.character; this.girl.root.position.set(c.x, c.y, 0); this.girl.root.scale.setScalar(c.scale); this.girl.root.rotation.y = this.rotY; }
    else { const o = L.outro; this.girl.root.position.set(o.girl.x, 0, 0); this.girl.root.scale.setScalar(o.girl.scale); this.girl.root.rotation.y = rad(o.girl.yaw);
      if (this.boy) { this.boy.root.position.set(o.boy.x, 0, 0); this.boy.root.scale.setScalar(o.boy.scale); this.boy.root.rotation.y = rad(o.boy.yaw); } }
  }

  /* ---------- 旋转：拖拽 360°，松手带惯性；第一次选衣后自动左右小转并显示提示 ---------- */
  attachRotation() {
    const cv = this.renderer.domElement; let down = false, lx = 0;
    const R = this.cfg.rotation;
    cv.addEventListener('pointerdown', e => { this.sfx.unlock(); if (!R.enabled || !this.canRotate) return; down = true; lx = e.clientX; this.rotVel = 0; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!down) return; const d = (e.clientX - lx) * 0.012; lx = e.clientX; this.rotY += d; this.rotVel = d; if (!this.dragged && Math.abs(this.rotY) > .05) { this.dragged = true; this.ui.hideRotateHint(); } });
    const up = () => { down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    document.addEventListener('pointerdown', () => this.sfx.unlock(), {once: true});
    this.channel.onVisibility(hidden => this.sfx.setMuted(hidden));
  }
  async nudge() {      // 角色左右小幅转动，告诉玩家“可以转”
    const my = this.token, t0 = performance.now(); const R = this.cfg.rotation;
    if (R.hint.enabled) this.ui.showRotateHint(R.hint.style);
    if (!R.nudge) return;
    await new Promise(res => { const f = () => { if (this.token !== my || this.dragged) return res(); const t = (performance.now() - t0) / 1600; if (t >= 1) { this.rotY = 0; return res(); } this.rotY = Math.sin(t * Math.PI * 2) * .55; requestAnimationFrame(f); }; f(); });
  }

  /* ---------- 流程 ---------- */
  start() {
    this.ui.hideAll(); const my = ++this.token, cfg = this.cfg, F = cfg.flow;
    this.picked = 0; this.good = 0; this.si = 0; this.rotY = 0; this.dragged = false; this.canRotate = false; this.phase = 'intro';
    document.getElementById('loading') && document.getElementById('loading').remove();
    this.setBg('play'); this.shot('play', true); this.layout('play');
    if (this.boy) { this.boy.root.visible = false; this.boyShadow.visible = false; }
    if (this.phone) this.phone.root.visible = false;
    this.girl.play(this.idleClip(), {loop: true});
    if (!F.intro.enabled) { this.startStage(0); return; }
    this.sfx.play('intro');
    (async () => {
      await sleep(F.intro.idle * 1000); if (this.token !== my) return;
      const a = this.pick('intro'), b = this.pick('introReact');
      this.girl.playSeq([{clip: a}, {clip: b}, {clip: this.idleClip()}].filter(x => x.clip)); this.phoneSeq(my, a, b);
      await sleep(F.intro.bubbleDelay * 1000); if (this.token !== my) return;
      this.bubbleAnchor = this.anchorScreen();      // 掏出手机后，在手的位置定一次；follow 打开才会每帧跟着手机
      this.ui.showBubble(cfg.theme.texts.introSender, cfg.theme.texts.introMessage, F.intro.bubble.scale); this.sfx.play('transition');
      await sleep(F.intro.bubbleStay * 1000); if (this.token !== my) return;
      this.ui.hideBubble(); this.startStage(0);
    })();
  }
  /** 手机：显示，与角色的看手机/放下手机同时播放，结束(角色转入待机)后收起 */
  async phoneSeq(my, a, b) {
    const P = this.phone; if (!P) return; const pc = this.phoneClips; if (!pc.take && !pc.end) return;
    P.root.visible = true; P.playSeq([{clip: pc.take}, {clip: pc.end}].filter(x => x.clip));
    const len = c => c ? this.girl.fit(c).duration : 0;
    await sleep((Math.max(0, len(a) - .25) + Math.max(0, len(b) - .25)) * 1000); if (this.token === my) P.root.visible = false;
  }
  startStage(i) {
    this.si = i; if (i >= this.stages.length) { this.ending(); return; }
    this.phase = 'play'; this.canRotate = true; this.layout('play'); this.sel = false;
    const T = this.cfg.theme.texts; this.ui.hideBubble(); this.ui.showBanner(T.bannerTitle); this.shot('play');
    this.ui.showWardrobe(this.stages, i, this.cfg.layout.wardrobe, T.confirm, {onPick: o => this.onPick(o), onConfirm: () => { this.ui.hideRotateHint(); this.sfx.play('stageDone'); this.startStage(this.si + 1); }});
    if (i > 0) this.sfx.play('transition');
  }
  onPick(o) {
    if (this.sel && this.curGood) this.good--; if (!this.sel) this.picked++;
    this.sel = true; this.curGood = o.good; if (o.good) this.good++;
    this.sfx.play('click'); const type = this.stages[this.si].type;
    (type === 'makeup' ? this.girl.makeup(o.asset) : this.girl.equip(type, o.asset)).then(() => this.sfx.play('dress'));
    const c = this.pick(o.good ? 'pickGood' : 'pickBad'); if (c) this.girl.play(c, {loop: false, then: this.idleClip()});
    if (!this.nudged) { this.nudged = true; this.nudge(); }
  }
  async ending() {
    const cfg = this.cfg, T = cfg.theme.texts, my = this.token, F = cfg.flow; this.canRotate = false; this.phase = 'outro'; this.ui.hideRotateHint();
    const score = this.picked ? this.good / this.picked : 0, good = score >= F.goodThreshold;
    const onCta = () => this.channel.cta();
    if (!F.outro.enabled) {      // 结局关闭：最后一个阶段后直接出 CTA 卡片
      this.ui.hideWardrobe(); this.ui.hideBanner(); this.ui.showCtaOnly(T.cta, onCta); this.sfx.play('cta'); return;
    }
    await this.ui.flash(F.outro.flash, () => {
      this.ui.hideWardrobe(); this.ui.hideBanner(); this.setBg('end'); this.shot('outro', true); this.layout('outro');
      this.ui.showOutro(good ? T.goodTitle : T.badTitle, good ? T.goodSub : T.badSub, T.cta, onCta);
      this.girl.play(this.idleClip(), {loop: true});
      if (this.boy) { this.boy.root.visible = true; this.boyShadow.visible = true; this.boy.play((this.groups.partnerIdle || [])[0] || this.idleClip(), {loop: true}); }
    });
    await sleep(300); if (this.token !== my) return;
    this.girl.play(this.pick(good ? 'outroGood' : 'outroBad'), {loop: false}); this.sfx.play(good ? 'outroGood' : 'outroBad');
    await sleep(F.outro.uiDelay * 1000); if (this.token !== my) return; this.ui.showCard(true);
    await sleep(F.outro.ctaDelay * 1000); if (this.token !== my) return; this.ui.showCta(true); this.sfx.play('cta');
  }

  /* ---------- 每帧 ---------- */
  updateCamera(dt) {
    const T = this.camT, c = this.camera, p = this.camP || (this.camP = new THREE.Vector3().copy(c.position)), sm = .35;
    p.set(smoothDamp(p.x, T.x, this.vel[0], sm, dt), smoothDamp(p.y, T.y, this.vel[1], sm, dt), smoothDamp(p.z, T.z, this.vel[2], sm, dt));
    c.fov = smoothDamp(c.fov, T.fov, this.vel[3], sm, dt); c.updateProjectionMatrix();
    this.pitch = smoothDamp(this.pitch || 0, T.pitch, this.vel[4], sm, dt); const ph = this.pitch * Math.PI / 180; c.rotation.x = -ph; c.position.set(p.x, p.y + p.z * Math.sin(ph), p.z * Math.cos(ph));   // 俯仰角：镜头绕角色(看向的点 x,高度,0)转，正数从上往下看(俯视)，负数从下往上看(仰视)；角色始终留在画面里
  }
  placeShadow(s, root) { const sh = this.light.shadow; s.visible = sh.enabled && root.visible; s.position.set(root.position.x + sh.off.x * root.scale.x, .01, root.position.z + (sh.off.y + .12) * root.scale.x); s.scale.setScalar(root.scale.x * sh.size); s.material.opacity = sh.opacity; }   // 略往镜头一侧偏一点(+.12)，斜着看时才看得见
  frame() {
    const dt = Math.min(.05, this.clock.getDelta());
    if (this.phase === 'play') { if (!this.dragged || Math.abs(this.rotVel) > 1e-4) { /* 惯性 */ } this.rotVel *= this.cfg.rotation.inertia; if (Math.abs(this.rotVel) > 1e-4) this.rotY += this.rotVel; this.girl.root.rotation.y = this.rotY; }
    this.girl.update(dt); if (this.boy && this.boy.root.visible) this.boy.update(dt);
    if (this.phone && this.phone.root.visible) { this.phone.update(dt); this.phone.root.position.set(this.girl.rig.position.x, 0, this.girl.rig.position.z); }
    this.updateCamera(dt); this.camera.updateMatrixWorld(); this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert(); this.light.updateView(this.camera);
    this.placeShadow(this.girlShadow, this.girl.root); if (this.boy) this.placeShadow(this.boyShadow, this.boy.root);
    if (this.ui.bubble) this.anchorBubble();
    this.renderer.render(this.scene, this.camera);
  }
  /** 手(手机)当前在屏幕上的位置，0..1 的比例(没有手机就用角色头顶) */
  anchorScreen() {
    const v = new THREE.Vector3();
    if (this.phone && this.phone.root.visible) { const m = this.phone.rig.getObjectByProperty('isMesh', true); (m || this.phone.rig).getWorldPosition(v); } else this.girl.root.localToWorld(v.set(0, 1.55, 0));
    v.project(this.camera); return {x: v.x * .5 + .5, y: -v.y * .5 + .5};
  }
  anchorBubble() {
    const B = this.cfg.flow.intro.bubble; if (B.follow || !this.bubbleAnchor) this.bubbleAnchor = this.anchorScreen();
    const cv = this.renderer.domElement, u = this.ui.u; this.ui.placeBubble(this.bubbleAnchor.x * cv.clientWidth + B.offsetX * u, this.bubbleAnchor.y * cv.clientHeight + B.offsetY * u);
  }
  run() { const loop = () => { this.frame(); requestAnimationFrame(loop); }; loop(); }
}
