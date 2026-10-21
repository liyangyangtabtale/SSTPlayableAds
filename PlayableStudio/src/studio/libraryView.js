// 资源库页：按类型浏览素材，上传(校验 + 压缩 + 自动生成图标)，删除，导入/导出资源包。
import {h, modal, toast, fmtBytes} from './ui.js';
import {importWearable, importMakeup, importBackground, importSound, importLook, importZip, exportZip} from './importer.js';

const TABS = [
  ['outfit', '服装'], ['hair', '发型'], ['shoes', '鞋'], ['makeup', '妆容'], ['look', '外观'],
  ['sound', '音效'], ['background', '背景'],
];
const PACK = '来自 Unity 导出工具的资源包：点下面的“导入资源包(ZIP)”。';
const HINT = {
  outfit: PACK + '一件有多个部件(如裙子 + 手套)放在同一个 prefab 里，图标放在 prefab 旁边同名的 png。', hair: PACK, shoes: PACK,
  makeup: PACK + '妆容贴图是头部 UV 布局的 PNG(带透明通道)，图标和贴图同名加 _icon。', look: '同一个模型的一组贴图：头、身体必填，眼睛/眉毛/睫毛可选。',
  sound: '上传 mp3 / wav / ogg，建议 3 秒以内。', background: '上传图片，会按 9:16 居中裁切。',
};
const showIssues = (title, res) => {
  const all = res.issues.filter(i => i.level !== 'ok' || true); if (!all.length && res.items.length) { toast(`${title}：已加入 ${res.items.length} 个素材`); return; }
  modal(title, h('div', {}, res.items.length ? h('div', {class: 'val ok'}, `已加入：${res.items.map(i => i.name).join('、')}`) : null, ...all.map(i => h('div', {class: 'val ' + i.level}, i.msg))));
};
async function run(label, fn) { toast(label + '…', 60000); try { const r = await fn(); showIssues(label, r); } catch (e) { console.error(e); modal(label + ' 失败', h('div', {class: 'val error'}, e.message)); } finally { document.getElementById('toast').classList.remove('on'); } }
const pick = (accept, multiple, cb) => { const i = h('input', {type: 'file', accept, multiple}); i.onchange = () => i.files.length && cb([...i.files]); i.click(); };

export function libraryView(app, tab) {
  const lib = app.lib, type = tab || 'outfit'; const root = h('div', {class: 'libv'});
  root.append(h('div', {class: 'tabs2'}, TABS.map(([t, n]) => h('button', {class: t === type ? 'on' : '', onclick: () => { app.libTab = t; app.renderLibrary(); }}, `${n} ${lib.all(t).length}`))));
  const up = [];
  if (type === 'background') up.push(h('button', {class: 'pri', onclick: () => pick('image/*', true, fs => run('上传背景', async () => { const out = {items: [], issues: []}; for (const f of fs) { const r = await importBackground(lib, f); out.items.push(...r.items); out.issues.push(...r.issues); } return out; }))}, '＋ 上传背景'));
  if (type === 'sound') up.push(h('button', {class: 'pri', onclick: () => pick('audio/*,.mp3,.wav,.ogg', true, fs => run('上传音效', async () => { const out = {items: [], issues: []}; for (const f of fs) { const r = await importSound(lib, f); out.items.push(...r.items); out.issues.push(...r.issues); } return out; }))}, '＋ 上传音效'));
  if (type === 'look') up.push(h('button', {class: 'pri', onclick: () => lookDialog(app)}, '＋ 新建外观'));
  up.push(h('button', {onclick: () => pick('.zip', false, fs => run('导入资源包', () => importZip(lib, fs[0])))}, '导入资源包(ZIP)'));
  up.push(h('button', {onclick: async () => { const b = await exportZip(lib); const a = h('a', {href: URL.createObjectURL(b), download: 'my-assets.zip'}); document.body.append(a); a.click(); a.remove(); }}, '导出我的素材(ZIP)'));
  root.append(h('div', {class: 'up'}, ...up), h('div', {class: 'mut'}, HINT[type] || ''));
  const grid = h('div', {class: 'lgrid'});
  for (const it of lib.all(type)) {
    const img = it.files.icon ? h('img', {src: lib.url(it.id, 'icon')}) : it.files.image ? h('img', {src: lib.url(it.id, 'image')}) : it.type === 'look' ? h('div', {class: 'sw big', style: {background: it.meta.swatch || '#ddd'}}) : h('div', {class: 'ph'}, it.type === 'sound' ? '♪' : it.type === 'anim' ? '▶' : '3D');
    const meta = [fmtBytes(lib.itemSize(it)), it.meta && it.meta.duration ? it.meta.duration + 's' : null, it.meta && it.meta.tris ? it.meta.tris + ' 面' : null].filter(Boolean).join(' · ');
    grid.append(h('div', {class: 'lc'}, h('div', {class: 'lt'}, img), h('div', {class: 'ln', title: it.id}, it.name), h('div', {class: 'mut s'}, meta + (it.collection === 'placeholder' ? ' · 占位' : '')),
      lib.isUser(it.id) ? h('button', {class: 'sm del', onclick: () => { if (confirm(`删除「${it.name}」？配置里引用它的地方会提示缺失。`)) lib.remove(it.id).then(() => app.renderLibrary()); }}, '删除') : null));
  }
  if (!lib.all(type).length) grid.append(h('div', {class: 'mut'}, '还没有素材。'));
  root.append(grid); return root;
}
function lookDialog(app) {
  const imgs = {}, names = {head: '头部(必填)', body: '身体(必填)', eye: '眼睛', brow: '眉毛', lash: '睫毛'}; const nm = h('input', {type: 'text', placeholder: '外观名称，如 Asian'});
  const rows = Object.entries(names).map(([k, label]) => { const s = h('span', {class: 'mut'}, '未选'); return h('div', {class: 'row'}, h('label', {}, label), h('button', {onclick: () => pick('image/*,.tga', false, fs => { imgs[k] = fs[0]; s.textContent = fs[0].name; })}, '选择图片'), s); });
  modal('新建外观', h('div', {}, h('div', {class: 'row'}, h('label', {}, '名称'), nm), ...rows, h('div', {class: 'mut'}, '贴图要和基础模型的 UV 布局一致。支持 png / jpg / tga。')), [{text: '创建', primary: true, onclick: () => { run('创建外观', () => importLook(app.lib, imgs, {name: nm.value || '外观'})).then(() => app.renderLibrary()); }}, {text: '取消'}]);
}
