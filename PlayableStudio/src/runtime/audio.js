// 音效：第一次用户交互之后才出声(渠道/浏览器要求)；每个事件绑定一个声音资产，缺省则静音。
export class Sfx {
  constructor(store, cfg) { this.store = store; this.cfg = cfg; this.ctx = null; this.buf = {}; this.muted = false; this.unlocked = false; }
  /** 在第一次 pointerdown 里调用 */
  unlock() {
    if (this.unlocked) return; this.unlocked = true;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return; }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    for (const id of new Set(Object.values(this.cfg.events).filter(Boolean))) this.load(id);
  }
  async load(id) {
    if (this.buf[id] || !this.ctx || !this.store.has(id)) return;
    try { const u8 = this.store.bytes(id, 'audio'); this.buf[id] = await this.ctx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)); } catch (e) { console.warn('音效解码失败', id, e); }
  }
  setMuted(m) { this.muted = m; if (this.ctx) m ? this.ctx.suspend() : this.ctx.resume(); }
  play(event) {
    if (!this.cfg.enabled || this.muted || !this.ctx) return;
    const id = this.cfg.events[event]; const b = id && this.buf[id]; if (!b) return;
    const src = this.ctx.createBufferSource(); src.buffer = b; const g = this.ctx.createGain(); g.gain.value = this.cfg.volume; src.connect(g); g.connect(this.ctx.destination); src.start();
  }
}
