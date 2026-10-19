// 面板的小组件：h() 建节点、弹窗、提示、表单字段(绑定到配置的路径)。
export const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
let toastT; export function toast(msg, ms = 2400) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
export function modal(title, body, buttons = [{text: '关闭'}]) {
  const m = h('div', {class: 'modal'}), close = () => m.remove();
  const box = h('div', {class: 'box'}, h('div', {class: 'mh'}, h('b', {}, title), h('button', {class: 'x', onclick: close}, '×')), h('div', {class: 'mb'}, body),
    h('div', {class: 'mf'}, buttons.map(b => h('button', {class: b.primary ? 'pri' : '', onclick: () => { if (!b.onclick || b.onclick() !== false) close(); }}, b.text))));
  m.append(box); m.addEventListener('mousedown', e => { if (e.target === m) close(); }); document.body.append(m); return {close};
}
export const fmtBytes = n => n >= 1e6 ? (n / 1e6).toFixed(2) + ' MB' : (n / 1e3).toFixed(0) + ' KB';   // 渠道上限按十进制 MB 算，这里统一用十进制

/** 表单字段：绑定到 app.cfg 的路径 */
export function fields(app) {
  const F = {};
  const row = (label, ...ctl) => h('div', {class: 'row'}, h('label', {}, label), ...ctl);
  F.row = row;
  F.text = (path, label, ph) => row(label, h('input', {type: 'text', value: app.get(path) ?? '', placeholder: ph || '', oninput: e => app.set(path, e.target.value)}));
  F.num = (path, label, o = {}) => { const inp = h('input', {type: 'number', min: o.min, max: o.max, step: o.step || 1, value: app.get(path), oninput: e => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) app.set(path, v); }}); return row(label, inp, o.unit ? h('span', {class: 'mut'}, o.unit) : null); };
  F.range = (path, label, o = {}) => { const val = h('span', {class: 'mut v'}, String(app.get(path))); const r = h('input', {type: 'range', min: o.min, max: o.max, step: o.step || 0.01, value: app.get(path), oninput: e => { const v = parseFloat(e.target.value); val.textContent = v; app.set(path, v); }}); return row(label, r, val); };
  F.check = (path, label, text) => row(label, h('label', {class: 'chk'}, h('input', {type: 'checkbox', checked: !!app.get(path), onchange: e => app.set(path, e.target.checked, true)}), text || ''));
  F.color = (path, label) => { const val = h('span', {class: 'mut'}, app.get(path)); return row(label, h('input', {type: 'color', value: app.get(path), oninput: e => { val.textContent = e.target.value; app.set(path, e.target.value); }}), val); };
  F.select = (path, label, opts, o = {}) => row(label, h('select', {onchange: e => app.set(path, e.target.value === '' ? null : e.target.value, o.rebuild)}, opts.map(([v, t]) => h('option', {value: v ?? '', selected: (app.get(path) ?? '') === (v ?? '')}, t))));
  /** 从资源库选一个素材(按类型)，带缩略图 */
  F.asset = (path, label, type, o = {}) => {
    const items = app.lib.all(type).filter(o.filter || (() => true)); const cur = app.get(path); const it = cur && app.lib.get(cur);
    const sel = h('select', {onchange: e => app.set(path, e.target.value || null, true)}, h('option', {value: ''}, '(无)'), items.map(i => h('option', {value: i.id, selected: i.id === cur}, i.name + (i.collection === 'placeholder' ? ' · 占位' : ''))));
    const thumb = it && (it.files.icon || it.files.image) ? h('img', {class: 'th', src: app.lib.url(it.id, it.files.icon ? 'icon' : 'image')}) : null; return row(label, thumb, sel);
  };
  F.section = (title, open, ...kids) => { const d = h('details', {open: open || null}, h('summary', {}, title), h('div', {class: 'body'}, ...kids)); d.addEventListener('toggle', () => { app.open[title] = d.open; }); if (title in app.open) d.open = app.open[title]; return d; };
  return F;
}
