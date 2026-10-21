// Studio 入口：资源库 + 配置面板 + 实时预览 + 校验 + 导出。
import './studio.css';
import {h, toast, modal, fmtBytes} from './ui.js';
import BASE from './generated/base-pack.js';
import {Library} from './library.js';
import {normalizeConfig, defaultConfig, usedAssetIds, validateConfig, CHANNELS} from '../shared/schema.js';
import {makePlayable, sizeReport, exportForChannel} from './build.js';
import {b91dec, b91enc} from '../shared/b91.js';
import {themePanel, flowPanel, characterPanel, layoutPanel, lightPanel, skinPanel, soundPanel, exportPanel, validationPanel} from './panels.js';
import {libraryView} from './libraryView.js';
import * as importer from './importer.js';

const KEY = 'playable-studio-project-v1';
const lib = new Library({manifest: BASE.manifest, blobs: BASE.blobs});
const app = {lib, cfg: null, open: {}, libTab: 'outfit', view: 'config'};
const pathGet = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
app.get = p => pathGet(app.cfg, p);
app.set = (p, v, rebuild) => { const ks = p.split('.'), last = ks.pop(); const o = ks.reduce((a, k) => a[k], app.cfg); o[last] = v; app.changed(rebuild); };
let previewT, panelsT;
/* ---------- 多主题：主题 = theme + 各阶段素材池 + 默认服装发型；切换时整体换掉这部分，其余(布局/灯光/动画/声音)共用 ---------- */
const bound = c => structuredClone({theme: c.theme, stages: c.flow.stages, outfit: c.character.defaultOutfit, hair: c.character.defaultHair});
const unbind = (c, b) => { c.theme = structuredClone(b.theme); c.flow.stages = structuredClone(b.stages); c.character.defaultOutfit = b.outfit; c.character.defaultHair = b.hair; };
function ensureThemes() { const c = app.cfg; if (!c.themes || !c.themes.length) { c.themes = [bound(c)]; c.themeIndex = 0; } }
function syncTheme() { ensureThemes(); app.cfg.themes[app.cfg.themeIndex] = bound(app.cfg); }
app.themes = {
  switch(i) { syncTheme(); app.cfg.themeIndex = i; unbind(app.cfg, app.cfg.themes[i]); app.changed(true); },
  add() { syncTheme(); const b = bound(app.cfg); b.theme.id = 'theme_' + (app.cfg.themes.length + 1); b.theme.name = (b.theme.name || '主题') + ' 副本'; app.cfg.themes.push(b); app.themes.switch(app.cfg.themes.length - 1); },
  remove() { syncTheme(); if (app.cfg.themes.length < 2) return toast('至少保留一个主题'); app.cfg.themes.splice(app.cfg.themeIndex, 1); app.cfg.themeIndex = 0; unbind(app.cfg, app.cfg.themes[0]); app.changed(true); },
};
app.changed = rebuild => {
  syncTheme(); try { localStorage.setItem(KEY, JSON.stringify(app.cfg)); } catch (e) {} clearTimeout(previewT); previewT = setTimeout(refreshPreview, 450); if (rebuild) { clearTimeout(panelsT); panelsT = setTimeout(renderPanels, 0); } else updateStatus(); };

function fixDefaults() {   // 配置里没有角色/男角色时，用资源库里的第一个
  const c = app.cfg.character; if (!c.model || !lib.has(c.model)) c.model = (lib.first('character') || {}).id || null; if (!c.partner || !lib.has(c.partner)) c.partner = (lib.first('partner') || {}).id || null;
}
/* ---------- 预览 ---------- */
const frame = h('iframe', {sandbox: 'allow-scripts allow-same-origin', title: 'preview'}); const spin = h('div', {class: 'spin'}, '生成预览…');
function refreshPreview() {
  fixDefaults(); spin.classList.add('on'); const t0 = performance.now();
  try { frame.srcdoc = makePlayable(app.cfg, lib); } catch (e) { toast('生成预览失败：' + e.message); }
  window.__previewMs = performance.now() - t0; updateStatus();
}
addEventListener('message', e => { if (e.source === frame.contentWindow) { if (e.data && e.data.type === 'playable-ready') spin.classList.remove('on'); if (e.data && e.data.type === 'playable-error') { spin.classList.remove('on'); toast('预览出错：' + e.data.message, 6000); } if (e.data && e.data.type === 'playable-cta') toast('点击了 CTA' + (e.data.url ? '：' + e.data.url : '（还没有填商店链接）')); } });

/* ---------- 顶部状态：体积、校验 ---------- */
const sizeEl = h('span', {class: 'size'}), badge = h('span', {class: 'badge'});
function updateStatus() {
  const rep = sizeReport(app.cfg, lib), ch = CHANNELS.find(c => c.id === app.cfg.export.channel) || CHANNELS[0]; const res = validateConfig(app.cfg, lib, rep);
  const err = res.filter(r => r.level === 'error').length, warn = res.filter(r => r.level === 'warn').length;
  sizeEl.textContent = `体积 ${fmtBytes(rep.bytes)} / ${(ch.limit / 1e6).toFixed(0)} MB`; sizeEl.className = 'size ' + (rep.bytes > ch.limit ? 'over' : rep.bytes > ch.limit * .95 ? 'warn' : '');
  badge.textContent = err ? `${err} 个错误` : warn ? `${warn} 个提示` : '校验通过'; badge.className = 'badge ' + (err ? 'err' : warn ? 'warn' : 'ok');
  const v = document.getElementById('valbox'); if (v) { v.replaceWith(validationBox()); }
}
function validationBox() { const p = validationPanel(app); p.el.id = 'valbox'; return p.el; }

/* ---------- 项目 ---------- */
async function saveProject() {
  const assets = {}; const ids = new Set(usedAssetIds(app.cfg)); syncTheme(); for (const b of app.cfg.themes) { const c2 = structuredClone(app.cfg); unbind(c2, b); usedAssetIds(c2).forEach(i => ids.add(i)); }
  for (const id of ids) if (lib.isUser(id)) { const it = lib.get(id); const files = {}; for (const p of Object.values(it.files)) files[p] = lib.b91(p); assets[id] = {item: it, files}; }
  const blob = new Blob([JSON.stringify({format: 'playable-studio-project', v: 1, cfg: app.cfg, assets})], {type: 'application/json'});
  const a = h('a', {href: URL.createObjectURL(blob), download: (app.cfg.name || 'project').replace(/\W+/g, '_') + '.stylist.json'}); document.body.append(a); a.click(); a.remove(); toast('项目已保存（包含用到的上传素材）');
}
function openProject() {
  const i = h('input', {type: 'file', accept: '.json'}); i.onchange = async () => {
    try { const p = JSON.parse(await i.files[0].text()); if (p.format !== 'playable-studio-project') throw new Error('不是项目文件');
      for (const {item, files} of Object.values(p.assets || {})) await lib.add(item, new Map(Object.entries(files).map(([k, v]) => [k, b91dec(v)])));
      app.cfg = normalizeConfig(p.cfg); fixDefaults(); app.changed(true); renderLibrary(); toast('已打开项目'); } catch (e) { toast('打开失败：' + e.message); }
  }; i.click();
}
function resetProject() { if (!confirm('丢弃当前配置，恢复为默认配置？(上传的素材不会删除)')) return; app.cfg = normalizeConfig(BASE.config); fixDefaults(); app.changed(true); }

/* ---------- 布局 ---------- */
const left = h('div', {id: 'left'}), panelBox = h('div', {id: 'panels'}), libBox = h('div', {id: 'libbox', class: 'hide'}), valHolder = h('div', {id: 'valholder'});
function renderPanels() { const y = left.scrollTop; panelBox.textContent = ''; panelBox.append(themePanel(app), flowPanel(app), characterPanel(app), skinPanel(app), layoutPanel(app), lightPanel(app), soundPanel(app), exportPanel(app)); valHolder.textContent = ''; valHolder.append(validationBox()); left.scrollTop = y; updateStatus(); }
function renderLibrary() { libBox.textContent = ''; libBox.append(libraryView(app, app.libTab)); }
app.renderLibrary = renderLibrary;
function setView(v) { app.view = v; panelBox.classList.toggle('hide', v !== 'config'); valHolder.classList.toggle('hide', v !== 'config'); libBox.classList.toggle('hide', v !== 'library'); tabBtns.forEach(([k, b]) => b.classList.toggle('on', k === v)); if (v === 'library') renderLibrary(); else renderPanels(); }
const tabBtns = [['config', h('button', {onclick: () => setView('config')}, '配置')], ['library', h('button', {onclick: () => setView('library')}, '资源库')]];
left.append(h('div', {class: 'tabs1'}, tabBtns.map(t => t[1])), panelBox, valHolder, libBox);

const nameIn = h('input', {class: 'pname', type: 'text', value: '', oninput: e => app.set('name', e.target.value)});
const header = h('header', {}, h('h1', {}, 'Super Stylist · Playable Studio'), nameIn,
  h('button', {onclick: openProject}, '打开项目'), h('button', {onclick: saveProject}, '保存项目'), h('button', {onclick: resetProject}, '重置'), h('span', {style: {flex: 1}}), sizeEl, badge);
const right = h('div', {id: 'right'}, h('div', {id: 'phone'}, frame, spin), h('div', {class: 'pbar'}, h('button', {onclick: refreshPreview}, '重新开始预览')));
document.body.prepend(header); document.getElementById('main').append(left, right);

(async () => {
  await lib.init();
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  app.cfg = normalizeConfig(saved && saved.schema ? saved : BASE.config); fixDefaults(); nameIn.value = app.cfg.name || '';
  setView('config'); refreshPreview(); window.__app = app; window.__importer = importer; window.__build = {makePlayable, sizeReport, exportForChannel};
})();
