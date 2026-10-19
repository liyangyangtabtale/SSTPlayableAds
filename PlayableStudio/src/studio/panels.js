// 左侧各配置面板。每个面板函数返回一个可折叠的 details；改动通过 app.set(path, value) 写回配置，预览自动刷新。
import {h, modal, toast, fields, fmtBytes} from './ui.js';
import {STAGE_LABELS, BANNER_STYLES, FONTS, SOUND_EVENTS, ANIM_EVENTS, CHANNELS, validateConfig, usedAssetIds} from '../shared/schema.js';
import {sizeReport, exportForChannel, makePlayable} from './build.js';

export function themePanel(app) {
  const F = fields(app); const T = 'theme.texts.';
  const c = app.cfg; if (!c.themes || !c.themes.length) c.themes = [{theme: c.theme, stages: c.flow.stages, outfit: c.character.defaultOutfit, hair: c.character.defaultHair}];
  const sw = h('div', {class: 'row'}, h('label', {}, '当前主题'), h('select', {onchange: e => app.themes.switch(+e.target.value)}, c.themes.map((b, i) => h('option', {value: i, selected: i === c.themeIndex}, (b.theme && b.theme.name) || ('主题 ' + (i + 1))))),
    h('button', {class: 'sm', onclick: () => app.themes.add()}, '＋ 复制为新主题'), h('button', {class: 'sm', onclick: () => confirm('删除当前主题？') && app.themes.remove()}, '删除'));
  return F.section('主题 / 文案', true, sw, F.text('theme.name', '主题名称'), h('div', {class: 'mut'}, '主题 = 文案、背景、横幅样式、各阶段素材池和好坏标记、默认服装发型；导出时只带当前主题。'),
    F.text(T + 'bannerTitle', '换装标题'), F.text(T + 'introSender', '短信发送者'), F.text(T + 'introMessage', '短信内容'),
    F.text(T + 'confirm', '确认按钮'), F.text(T + 'cta', 'CTA 按钮'),
    F.text(T + 'goodTitle', '好结局标题'), F.text(T + 'goodSub', '好结局副标题'), F.text(T + 'badTitle', '坏结局标题'), F.text(T + 'badSub', '坏结局副标题'),
    F.color('theme.colors.primary', '主色'), F.color('theme.colors.soft', '浅色(描边)'), F.color('theme.colors.ink', '文字色'),
    F.select('theme.banner.style', '横幅样式', BANNER_STYLES.map(b => [b.id, b.name])), F.select('theme.banner.font', '字体', FONTS.map(f => [f.id, f.name])),
    F.asset('theme.backgrounds.play', '开场/换装背景', 'background'), F.asset('theme.backgrounds.end', '结局背景', 'background'),
    h('div', {class: 'mut'}, '一个主题 = 2 张背景：开场和换装共用一张，结局一张。背景会按 9:16 居中裁切。'));
}

export function flowPanel(app) {
  const F = fields(app), cfg = app.cfg, st = cfg.flow.stages;
  const stageCard = (s, idx) => {
    const lib = app.lib; const pool = s.options;
    const mv = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; app.changed(true); };
    const rows = pool.map((o, i) => { const it = lib.get(o.asset); const vis = i < s.count;
      return h('div', {class: 'item' + (vis ? '' : ' off')}, it && it.files.icon ? h('img', {class: 'th', src: lib.url(it.id, 'icon')}) : h('div', {class: 'th ph'}),
        h('div', {class: 'nm', title: o.asset}, it ? it.name : o.asset + '(缺失)', vis ? '' : h('span', {class: 'tag'}, '超出可见数')),
        h('button', {class: 'sm gb ' + (o.good ? 'good' : 'bad'), onclick: () => { o.good = !o.good; app.changed(true); }}, o.good ? '好' : '坏'),
        h('button', {class: 'sm', onclick: () => mv(pool, i, -1)}, '↑'), h('button', {class: 'sm', onclick: () => mv(pool, i, 1)}, '↓'),
        h('button', {class: 'sm', onclick: () => { pool.splice(i, 1); app.changed(true); }}, '✕'));
    });
    return h('div', {class: 'stage'},
      h('div', {class: 'hd'}, h('input', {type: 'checkbox', checked: s.enabled, onchange: e => { s.enabled = e.target.checked; app.changed(true); }}), h('b', {}, STAGE_LABELS[s.type]), h('span', {style: {flex: 1}}),
        h('button', {class: 'sm', onclick: () => mv(st, idx, -1)}, '↑ 前移'), h('button', {class: 'sm', onclick: () => mv(st, idx, 1)}, '↓ 后移')),
      h('div', {class: 'bd'},
        F.row('网格列数', h('select', {onchange: e => { s.columns = +e.target.value; app.changed(); }}, [1, 2, 3, 4].map(n => h('option', {value: n, selected: s.columns === n}, n + ' 列'))),
          h('label', {class: 'inl'}, '可见数量'), h('input', {type: 'number', min: 1, value: s.count, oninput: e => { s.count = Math.max(1, +e.target.value || 1); app.changed(); }}), h('span', {class: 'mut'}, `/ 已选 ${pool.length}`)),
        h('div', {class: 'mut'}, '素材池（↑↓ 排序，“好/坏”决定选对还是选错）'), ...rows,
        h('button', {class: 'add', onclick: () => pickAssets(app, s)}, '＋ 从资源库选择素材')));
  };
  return F.section('流程 / 阶段 / 素材池', true,
    F.check('flow.intro.enabled', '开场', '开启(关闭则直接进入衣柜)'), F.num('flow.intro.idle', '　先待机', {min: 0, step: 0.1, unit: '秒'}), F.num('flow.intro.bubbleDelay', '　出气泡', {min: 0, step: 0.1, unit: '秒后'}), F.num('flow.intro.bubbleStay', '　停留', {min: 0, step: 0.1, unit: '秒后自动进入衣柜'}),
    F.num('flow.intro.bubble.offsetX', '　气泡左右', {step: 5, unit: '像素(相对手，右为正)'}), F.num('flow.intro.bubble.offsetY', '　气泡上下', {step: 5, unit: '像素(相对手，上为负)'}), F.range('flow.intro.bubble.scale', '　气泡大小', {min: 0.5, max: 1.6, step: 0.05}), F.check('flow.intro.bubble.follow', '　跟随手机', '开启后气泡每帧跟着手机移动(默认只在掏出手机后定一次位置)'),
    F.check('flow.outro.enabled', '结局', '开启(关闭则最后一个阶段后直接出 CTA 卡片)'), F.num('flow.outro.flash', '　闪白时长', {min: 0, step: 0.1, unit: '秒'}), F.num('flow.outro.uiDelay', '　文案延迟', {min: 0, step: 0.1, unit: '秒'}), F.num('flow.outro.ctaDelay', '　CTA 延迟', {min: 0, step: 0.1, unit: '秒'}),
    F.range('flow.goodThreshold', '好结局阈值', {min: 0, max: 1, step: 0.05}), h('div', {class: 'mut'}, '选对比例 ≥ 阈值 = 好结局'),
    h('div', {class: 'mut', style: {marginTop: '8px'}}, '阶段顺序就是游戏里页签的顺序；取消勾选可跳过该阶段。'), ...st.map(stageCard));
}
/** 从资源库里勾选这个阶段的素材池 */
function pickAssets(app, stage) {
  const items = app.lib.all(stage.type); const sel = new Set(stage.options.map(o => o.asset));
  const grid = h('div', {class: 'pick'}); const draw = () => { grid.textContent = ''; for (const it of items) grid.append(h('div', {class: 'pc' + (sel.has(it.id) ? ' on' : ''), onclick: () => { sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id); draw(); }}, it.files.icon ? h('img', {src: app.lib.url(it.id, 'icon')}) : h('div', {class: 'ph'}, it.name), h('div', {class: 'pn'}, it.name))); };
  draw();
  modal(`选择${STAGE_LABELS[stage.type]}素材（点击勾选）`, items.length ? grid : h('div', {class: 'mut'}, '资源库里还没有这个类型的素材，请先到“资源库”上传。'), [{text: '确定', primary: true, onclick: () => {
    const keep = stage.options.filter(o => sel.has(o.asset)); for (const it of items) if (sel.has(it.id) && !keep.some(o => o.asset === it.id)) keep.push({asset: it.id, good: true}); stage.options = keep; app.changed(true); }}, {text: '取消'}]);
}

export function characterPanel(app) {
  const F = fields(app), lib = app.lib, cur = app.cfg.character.look;
  const sw = h('div', {class: 'looks'}, lib.all('look').map(l => h('div', {class: 'look' + (l.id === cur ? ' on' : ''), onclick: () => app.set('character.look', l.id, true)}, h('div', {class: 'sw', style: {background: (l.meta && l.meta.swatch) || '#ddd'}}), h('div', {}, l.name))));
  return F.section('角色 / 外观', false,
    F.row('女主角', h('span', {class: 'mut'}, lib.get(app.cfg.character.model) ? lib.get(app.cfg.character.model).name : '资源库里没有角色模型')),
    h('div', {class: 'mut'}, '外观 = 同一个模型换一组贴图(肤色、眼色、眉睫)；发色跟随所选发型。'), sw,
    F.asset('character.defaultOutfit', '默认服装', 'outfit'), F.asset('character.defaultHair', '默认发型', 'hair'),
    F.check('character.partnerEnabled', '男角色', '结局出现(只播待机动画)'));
}

export function layoutPanel(app) {
  const F = fields(app);
  return F.section('布局（角色 / 衣柜 / 结局）', false,
    h('b', {}, '换装时的角色'), F.range('layout.character.x', '左右', {min: -1.5, max: 1.5, step: 0.01}), F.range('layout.character.y', '上下', {min: -0.6, max: 0.6, step: 0.01}), F.range('layout.character.scale', '大小', {min: 0.5, max: 1.6, step: 0.01}),
    h('b', {}, '衣柜面板(参考 1080×1920 像素)'), F.num('layout.wardrobe.top', '距顶部', {step: 5}), F.num('layout.wardrobe.right', '距右侧', {step: 5}), F.num('layout.wardrobe.width', '宽度', {min: 300, max: 900, step: 10}), F.num('layout.wardrobe.gap', '格子间距', {min: 0, max: 60}), F.num('layout.wardrobe.confirmOffset', '确认按钮距面板', {step: 2}),
    h('b', {}, '结局：女主角'), F.range('layout.outro.girl.x', '左右', {min: -1.5, max: 1.5, step: 0.01}), F.range('layout.outro.girl.scale', '大小', {min: 0.5, max: 1.6, step: 0.01}), F.range('layout.outro.girl.yaw', '朝向', {min: -90, max: 90, step: 1}),
    h('b', {}, '结局：男角色'), F.range('layout.outro.boy.x', '左右', {min: -1.5, max: 1.5, step: 0.01}), F.range('layout.outro.boy.scale', '大小', {min: 0.5, max: 1.6, step: 0.01}), F.range('layout.outro.boy.yaw', '朝向', {min: -90, max: 90, step: 1}));
}

export function lightPanel(app) {
  const F = fields(app);
  return F.section('阴影 / 相机 / 旋转', false,
    h('b', {}, '地面阴影'), F.check('lighting.shadow.enabled', '显示', ''), F.range('lighting.shadow.opacity', '浓淡', {min: 0, max: 1, step: 0.05}), F.range('lighting.shadow.size', '大小', {min: 0.3, max: 2, step: 0.05}), F.range('lighting.shadow.offsetX', '左右位置', {min: -0.5, max: 0.5, step: 0.01}),
    h('b', {}, '相机'), F.range('camera.fov', '视角', {min: 15, max: 60, step: 1}), F.range('camera.distance', '距离(换装)', {min: 2, max: 8, step: 0.05}), F.range('camera.height', '高度(换装)', {min: 0, max: 2.5, step: 0.02}), F.range('camera.shiftX', '横向偏移(换装)', {min: -1, max: 1, step: 0.01}),
    F.range('camera.outroDistance', '距离(结局)', {min: 2, max: 10, step: 0.05}), F.range('camera.outroHeight', '高度(结局)', {min: 0, max: 2.5, step: 0.02}), F.range('camera.outroShiftX', '横向偏移(结局)', {min: -1, max: 1, step: 0.01}),
    h('b', {}, '3D 旋转'), F.check('rotation.enabled', '拖拽旋转', '换装阶段可拖拽转 360°'), F.range('rotation.inertia', '惯性', {min: 0.7, max: 0.99, step: 0.01}), F.check('rotation.nudge', '提示转动', '首次选衣后自动左右小转'),
    F.check('rotation.hint.enabled', '旋转提示图标', '显示'), F.select('rotation.hint.style', '提示样式', [['icon', '只用图标'], ['icon+text', '图标 + 文字']]));
}

export function animPanel(app) {
  const F = fields(app), lib = app.lib, A = app.cfg.animations;
  const evCard = ([ev, label]) => {
    const list = A[ev] || (A[ev] = []); const opts = lib.all('anim').filter(a => (a.meta.kind || 'body') !== 'phone' && !list.includes(a.id));
    return h('div', {class: 'evt'}, h('div', {class: 'eh'}, h('b', {}, label), list.length > 1 ? h('span', {class: 'mut'}, ' · 动作组：随机挑，不连续重复') : null),
      ...list.map((id, i) => { const a = lib.get(id); return h('div', {class: 'item'}, h('div', {class: 'nm'}, a ? `${a.name}（${a.meta.duration}s${a.meta.face ? ' · 含表情' : ''}）` : id + '(缺失)'), h('button', {class: 'sm', onclick: () => { list.splice(i, 1); app.changed(true); }}, '✕')); }),
      h('select', {onchange: e => { if (e.target.value) { list.push(e.target.value); app.changed(true); } }}, h('option', {value: ''}, '＋ 添加动画…'), opts.map(a => h('option', {value: a.id}, `${a.name}（${a.meta.duration}s）`))));
  };
  const phoneAnims = a => (a.meta.kind || 'body') === 'phone';
  return F.section('动画 / 手机', false, h('div', {class: 'mut'}, '每个事件是一个“动作组”：放一个就固定播它，放多个就随机挑。新动画上传到资源库后在这里加入。'), ...ANIM_EVENTS.map(evCard),
    h('b', {}, '开场手机'), F.asset('phone.model', '手机模型', 'phone'), F.asset('phone.take', '拿起动画', 'anim', {filter: phoneAnims}), F.asset('phone.end', '放下动画', 'anim', {filter: phoneAnims}));
}

let actx;
function playTest(app, id) {
  const it = app.lib.get(id); if (!it) return; actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const u8 = app.lib.bytes(it.files.audio);
  actx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)).then(b => { const s = actx.createBufferSource(); s.buffer = b; const g = actx.createGain(); g.gain.value = app.cfg.sound.volume; s.connect(g); g.connect(actx.destination); s.start(); });
}
export function soundPanel(app) {
  const F = fields(app);
  return F.section('声音', false, F.check('sound.enabled', '音效', '开启(玩家第一次点击之后才会出声)'), F.range('sound.volume', '音量', {min: 0, max: 1, step: 0.05}),
    ...SOUND_EVENTS.map(([ev, label]) => { const id = app.cfg.sound.events[ev]; const r = F.asset('sound.events.' + ev, label, 'sound'); if (id) r.append(h('button', {class: 'sm', onclick: () => playTest(app, id)}, '▶')); return r; }),
    h('div', {class: 'mut'}, '“占位”音效是合成的短音，只用来测试；正式音效上传到资源库后在这里替换。'));
}

export function exportPanel(app) {
  const F = fields(app), cfg = app.cfg; const ch = CHANNELS.find(c => c.id === cfg.export.channel) || CHANNELS[0]; const rep = sizeReport(cfg, app.lib);
  const pct = Math.min(100, rep.bytes / ch.limit * 100); const bar = h('div', {class: 'bar'}, h('i', {class: rep.bytes > ch.limit ? 'over' : pct > 95 ? 'warn' : '', style: {width: pct + '%'}}));
  const doExport = async () => { try { const r = await exportForChannel(cfg, app.lib); const a = h('a', {href: URL.createObjectURL(r.blob), download: r.file}); document.body.append(a); a.click(); a.remove(); toast(`已导出 ${r.file}（${fmtBytes(r.bytes)}）`); } catch (e) { toast('导出失败：' + e.message); } };
  const test = () => { const w = window.open(URL.createObjectURL(new Blob([makePlayable(cfg, app.lib)], {type: 'text/html'})), '_blank'); if (!w) toast('浏览器拦截了新窗口'); };
  return F.section('导出', true,
    F.select('export.channel', '渠道', CHANNELS.map(c => [c.id, c.name]), {rebuild: true}), h('div', {class: 'mut'}, `${ch.note}；体积上限 ${(ch.limit / 1e6).toFixed(0)} MB；CTA：${ch.cta}`),
    F.text('export.storeUrls.ios', 'iOS 链接', 'https://apps.apple.com/…'), F.text('export.storeUrls.android', 'Android 链接', 'https://play.google.com/…'),
    h('div', {class: 'sizeh'}, `当前体积 ${fmtBytes(rep.bytes)} / ${(ch.limit / 1e6).toFixed(0)} MB`), bar,
    h('div', {class: 'mut'}, `运行时 ${fmtBytes(rep.template)}；占用最大的素材：`), ...rep.rows.slice(0, 6).map(r => h('div', {class: 'sz'}, h('span', {}, r.name), h('span', {class: 'mut'}, fmtBytes(r.bytes)))),
    h('div', {class: 'btns'}, h('button', {onclick: test}, '在新窗口试玩'), h('button', {class: 'pri', onclick: doExport}, `导出 ${ch.name} 包`)));
}

export function validationPanel(app) {
  const rep = sizeReport(app.cfg, app.lib); const res = validateConfig(app.cfg, app.lib, rep); const F = fields(app);
  return {el: F.section('校验', true, ...res.map(r => h('div', {class: 'val ' + r.level}, r.msg))), errors: res.filter(r => r.level === 'error').length, warns: res.filter(r => r.level === 'warn').length};
}
