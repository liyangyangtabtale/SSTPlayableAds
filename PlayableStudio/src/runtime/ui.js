// DOM 版 UI：横幅、开场气泡、衣柜面板(页签 + 网格 + 确认)、结局卡片、CTA、旋转提示、闪白。位置和样式来自配置(theme / layout)。
import {FONTS} from '../shared/schema.js';
const U = v => `calc(var(--u)*${v})`;
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const ICON = {
  outfit: '<svg viewBox="0 0 24 24"><path d="M12 6a2 2 0 1 1 2 2c-1 .4-2 1-2 2v1"/><path d="M3 19l9-8 9 8z"/></svg>',
  makeup: '<svg viewBox="0 0 24 24"><path d="M9 21v-9h6v9z"/><path d="M10 12V8l4-4v8"/></svg>',
  hair: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M6 7v10M9 7v10M12 7v10M15 7v10M18 7v10"/></svg>',
  shoes: '<svg viewBox="0 0 24 24"><path d="M3 15c0-3 3-3 4-6l4 3 7 1 3 3v2H3z"/></svg>',
};
const HAND = '<svg viewBox="0 0 24 24"><path d="M9 11V5a1.5 1.5 0 0 1 3 0v5l5 1a2 2 0 0 1 1.6 2.3L17.5 19a2 2 0 0 1-2 1.6H11a3 3 0 0 1-2.5-1.3L5 14l1-1 3 2z"/></svg>';
const ARROW_L = '<svg class="ar" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', ARROW_R = '<svg class="ar" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

export class UI {
  constructor(root, stage) { this.root = root; this.stage = stage; this.layer = null; }
  get u() { return (this.stage.clientWidth || 1080) / 1080; }
  applyTheme(theme) {
    const s = this.stage.style, c = theme.colors;
    s.setProperty('--primary', c.primary); s.setProperty('--soft', c.soft); s.setProperty('--ink', c.ink);
    const f = FONTS.find(x => x.id === theme.banner.font) || FONTS[0]; s.setProperty('--font', f.css); document.body.style.fontFamily = f.css;
    this.bannerStyle = theme.banner.style;
  }
  refit() { for (const e of [this.banner, this.card, this.panel]) if (e) this.fit(e.querySelectorAll ? [e, ...e.querySelectorAll('.nm,.t,.s')] : e); }
  hideAll() { for (const k of ['banner', 'bubble', 'panel', 'card', 'cta', 'rhint']) { if (this[k]) { this[k].remove(); this[k] = null; } } }

  /* ---------- 横幅 ---------- */
  showBanner(text) { this.hideBanner(); this.banner = el(`<div class="banner ${this.bannerStyle || 'pill'}"></div>`); this.banner.textContent = text; this.root.append(this.banner); this.fit(this.banner); }
  hideBanner() { if (this.banner) { this.banner.remove(); this.banner = null; } }

  /* ---------- 开场气泡：位置由游戏每帧按手机的屏幕位置更新 ---------- */
  showBubble(sender, msg, scale = 1) {
    this.hideBubble(); this.bubbleScale = scale; this.bubble = el(`<div class="bubble pop"><div class="who"></div><div class="msg"></div></div>`);
    this.bubble.querySelector('.who').textContent = sender || ''; if (!sender) this.bubble.querySelector('.who').remove(); this.bubble.querySelector('.msg').textContent = msg; this.root.append(this.bubble);
  }
  placeBubble(x, y) { if (this.bubble) { const W = this.stage.clientWidth, hw = this.bubble.offsetWidth * (this.bubbleScale || 1) / 2 + 8; x = Math.min(Math.max(x, hw), W - hw);   // 不让气泡超出屏幕
    this.bubble.style.left = x + 'px'; this.bubble.style.top = y + 'px'; this.bubble.style.transform = `translate(-50%, calc(-100% - var(--u) * 34)) scale(${this.bubbleScale || 1})`; } }
  hideBubble() { if (this.bubble) { this.bubble.remove(); this.bubble = null; } }

  /* ---------- 衣柜 ---------- */
  /** stages: [{type,columns,options:[{id,asset,icon,label}]}]；handlers: {onPick(opt), onConfirm()} */
  showWardrobe(stages, index, L, confirmText, h) {
    this.hideWardrobe(); const st = stages[index], cols = st.columns, opts = st.options;
    const gap = L.gap, cw = (L.width - 32 - gap * (cols - 1)) / cols, ch = cw * (L.cellH / L.cellW);
    const rows = Math.ceil(opts.length / cols), gh = rows * ch + Math.max(0, rows - 1) * gap, ph = 130 + gh + 20;
    const p = this.panel = el(`<div class="panel pop" style="right:${U(L.right)};top:${U(L.top)};width:${U(L.width)};height:${U(ph)}"></div>`);
    const tabs = el('<div class="tabs"></div>'); stages.forEach((s, i) => tabs.append(el(`<div class="tab ${i === index ? 'on' : ''}">${ICON[s.type] || ''}</div>`))); p.append(tabs);
    const grid = el(`<div class="grid" style="grid-template-columns:repeat(${cols},${U(cw)});grid-auto-rows:${U(ch)};gap:${U(gap)}"></div>`); p.append(grid);
    const confirm = el(`<div class="btn confirm dis" style="top:calc(100% + ${U(L.confirmOffset)})"></div>`); confirm.textContent = confirmText; p.append(confirm);
    let sel = null;
    for (const o of opts) {
      const c = el('<div class="cell"></div>');
      if (o.icon) { const im = new Image(); im.src = o.icon; im.draggable = false; c.append(im); } else { const n = el('<div class="nm"></div>'); n.textContent = o.label; c.append(n); }
      c.onclick = e => { e.stopPropagation(); if (sel) sel.querySelector('.ring').remove(); sel = c; c.append(el('<div class="ring"></div>')); confirm.classList.remove('dis'); h.onPick(o); };
      grid.append(c);
    }
    confirm.onclick = e => { e.stopPropagation(); if (!confirm.classList.contains('dis')) h.onConfirm(); };
    this.root.append(p); this.fit(p.querySelectorAll('.nm'));
  }
  hideWardrobe() { if (this.panel) { this.panel.remove(); this.panel = null; } }

  /* ---------- 结局 / CTA ---------- */
  showOutro(title, sub, cta, onCta) {
    this.card = el(`<div class="card pop hide"><div class="t"></div><div class="s"></div></div>`); this.card.querySelector('.t').textContent = title; this.card.querySelector('.s').textContent = sub;
    this.makeCta(cta, onCta, false); this.root.append(this.card);
  }
  /** 结局关闭时：直接出一张 CTA 卡片(只有按钮) */
  showCtaOnly(cta, onCta) { this.makeCta(cta, onCta, true); this.showCta(true); }
  makeCta(text, onCta, solo) { if (this.cta) this.cta.remove(); this.cta = el(`<div class="btn cta pop hide ${solo ? 'solo' : ''}"></div>`); this.cta.textContent = text; this.cta.onclick = onCta; this.root.append(this.cta); }
  showCard(v) { if (this.card) { this.card.classList.toggle('hide', !v); if (v) this.fit(this.card.querySelectorAll('.t,.s')); } }
  showCta(v) { if (this.cta) this.cta.classList.toggle('hide', !v); }

  /* ---------- 旋转提示 ---------- */
  showRotateHint(style) {
    if (this.rhint) return; this.rhint = el(`<div class="rhint"><div class="rh-ic">${ARROW_L}${HAND}${ARROW_R}</div>${style === 'icon' ? '' : '<span>Drag to rotate</span>'}</div>`); this.root.append(this.rhint);
  }
  hideRotateHint() { if (this.rhint) { this.rhint.remove(); this.rhint = null; } }

  /** 全屏闪白：淡入变白，白屏时调用 onPeak，再淡出。duration 为总时长(秒) */
  async flash(duration, onPeak) {
    if (!(duration > 0)) { onPeak && onPeak(); return; }
    const f = el('<div style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:20"></div>'); this.root.append(f);
    const sleep = ms => new Promise(r => setTimeout(r, ms)); const inT = duration * .35 * 1000, outT = duration * .65 * 1000;
    f.style.transition = `opacity ${inT}ms linear`; void f.offsetWidth; f.style.opacity = 1; await sleep(inT);
    onPeak && onPeak(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    f.style.transition = `opacity ${outT}ms linear`; f.style.opacity = 0; await sleep(outT); f.remove();
  }
  /** 长文案自动缩小字号放进容器(最小到 55%) */
  fit(els) {
    for (const e of (els.length === undefined ? [els] : els)) {
      if (!e.isConnected) continue; const base = parseFloat(getComputedStyle(e).fontSize); let s = base;
      while (s > base * .55 && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) { s -= 1; e.style.fontSize = s + 'px'; }
    }
  }
}
