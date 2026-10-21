// 配置格式(版本 1)：试玩运行时和 Studio 共用。运行时只读这份配置 + 资源包；Studio 编辑这份配置。
// 所有素材都通过资产 id 引用(资产在资源库里，见 assets.js)，配置里不出现文件路径。
import SKIN from './skin-params.js';   // 自动生成：tools/build-skin.mjs 读 Unity Assets/PlayableSkin 的材质

export const SCHEMA_VERSION = 1;
export const STAGE_TYPES = ['outfit', 'makeup', 'hair', 'shoes'];
const hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
/** 女主角头/身体的皮肤着色(LightweightSkin)默认配置：材质参数取自 Unity 的 Skin_head 材质，场景灯光取自 Unity 场景(平行光、Flat 环境色)。
 *  light.dir = 指向光源的方向(相机空间，+x 右 / +y 上 / +z 朝向镜头)，Unity 场景的平行光换算后 ≈ (0.28, 0.574, 0.77)。 */
export function defaultSkin() {
  const m = SKIN.head;
  return {
    enabled: true,
    mat: {color: hex(m.color), wrap: m.wrap, shadowTint: hex(m.shadowTint), brightTint: hex(m.brightTint), darkTint: hex(m.darkTint), ambientTint: hex(m.ambient), specColor: hex(m.specColor), specPower: m.specPower},
    light: {ambient: '#736e78', color: '#ffffff', intensity: 0.85, dir: {x: 0.28, y: 0.574, z: 0.77}},
  };
}
export const STAGE_LABELS = {outfit: '服装', makeup: '妆容', hair: '发型', shoes: '鞋'};
/** 声音事件：运行时在这些时机播放绑定的音效 */
export const SOUND_EVENTS = [
  ['click', '点击选项'], ['dress', '穿上衣服'], ['stageDone', '完成阶段'], ['transition', '转场'],
  ['intro', '开场'], ['outroGood', '结局·好'], ['outroBad', '结局·坏'], ['cta', 'CTA 出现'],
];
/** 动画固定内置在 Studio 里(由 tools/build-animations.mjs 从 Unity 的 Animations 目录烘焙)，不在面板里选择，也不会被项目文件覆盖。
 *  每个事件绑定一个“动作组”(可多个，随机挑，不连续重复)；换动画 = 换 Unity 里的 FBX 再重新构建。 */
export const FIXED_ANIMATIONS = {
  animations: {
    idle: ['anim_idle'], intro: ['anim_player_messageshort_new'], introReact: [], pickGood: ['anim_handclap'], pickBad: ['anim_no'],
    outroGood: ['anim_win'], outroBad: ['anim_lose'], partnerIdle: ['anim_boy'],
  },
  phone: {model: 'phone', take: 'anim_phone_messageshort_new', end: null},   // 手机(模型 + 动画)也固定内置，不在面板里设置
};
export const BANNER_STYLES = [
  {id: 'pill', name: '胶囊(圆角白底粉边)'},
  {id: 'flat', name: '扁平(纯色底)'},
  {id: 'ribbon', name: '丝带(两端折角)'},
];
export const FONTS = [
  {id: 'sans', name: '无衬线(系统)', css: 'Arial, Helvetica, sans-serif'},
  {id: 'rounded', name: '圆体(系统)', css: '"Arial Rounded MT Bold", "Hiragino Maru Gothic ProN", Arial, sans-serif'},
  {id: 'serif', name: '衬线(系统)', css: 'Georgia, "Times New Roman", serif'},
];
export const CHANNELS = [
  {id: 'applovin', name: 'AppLovin', format: 'html', limit: 5e6, mraid: 2, cta: 'mraid.open', note: '单个 HTML；交互前静音；需要 WebGL 降级'},
  {id: 'unity', name: 'Unity Ads', format: 'html', limit: 5e6, mraid: 3, cta: 'mraid.open', note: '单个内联 HTML；不依赖外部资源'},
  {id: 'mintegral', name: 'Mintegral', format: 'html', limit: 5e6, cta: 'window.install', note: '单个 HTML'},
  {id: 'meta', name: 'Meta', format: 'html', limit: 5e6, cta: 'FbPlayableAd.onCTAClick', note: '单个 HTML；竖屏；无外部调用'},
  {id: 'google', name: 'Google Ads', format: 'zip', limit: 5e6, cta: 'ExitApi.exit', note: 'ZIP(index.html 在根目录，≤512 个文件)；交互后才出声'},
  {id: 'tiktok', name: 'TikTok / Pangle', format: 'zip', limit: 5e6, cta: 'window.openAppStore', note: 'ZIP(index.html + config.json 在根目录)；不用 MRAID'},
  {id: 'ironsource', name: 'ironSource', format: 'html', limit: 4e6, mraid: 2, cta: 'mraid.open', note: '≤4 MB；HTTPS；不能有自定义关闭按钮'},
];

export function defaultConfig() {
  return {
    schema: SCHEMA_VERSION,
    name: 'Meet My Crush',
    themes: [], themeIndex: 0,      // 多主题：Studio 里保存的主题快照(主题 = 文案/背景/横幅 + 各阶段素材池与好坏标记 + 默认服装发型)；导出时只带当前主题
    theme: {
      id: 'crush', name: 'Meet My Crush',
      backgrounds: {play: null, end: null},      // 资产 id；开场与换装共用 play，结局用 end
      colors: {primary: '#f566a3', soft: '#fc9ecc', ink: '#3d2640'},
      banner: {style: 'pill', font: 'sans'},
      texts: {
        bannerTitle: 'MEET MY CRUSH',
        introSender: 'My Crush', introMessage: 'Tonight? Let\'s go out!',
        confirm: 'Confirm', cta: 'Play Now',
        goodTitle: 'Perfect Date Look!', goodSub: 'Your crush can\'t take their eyes off you',
        badTitle: 'Oh no...', badSub: 'That outfit was a fashion disaster',
      },
    },
    flow: {
      intro: {enabled: true, idle: 1.2, bubbleDelay: 1, bubbleStay: 1,
        bubble: {offsetX: 0, offsetY: -70, scale: 1, follow: false}},   // 气泡：掏出手机后在手附近显示一次，默认不跟随；offsetX/Y 是相对手的偏移(参考 1080×1920 像素，Y 负数 = 往上)   // 先待机 idle 秒 → 看手机 → bubbleDelay 秒后出气泡 → 停留 bubbleStay 秒自动进入衣柜(不需要点击)
      outro: {enabled: true, flash: 0.6, uiDelay: 0.3, ctaDelay: 2},      // 关闭时最后一个阶段后直接出 CTA 卡片
      goodThreshold: 0.6,
      stages: STAGE_TYPES.map(type => ({type, enabled: true, columns: 2, count: 6, options: []})),   // options: [{asset, good}]
    },
    character: {
      model: null, partner: null,   // 女主角 / 男角色资产 id(各只有一个)
      look: null,                 // 外观(look 资产 id)，同一模型换贴图
      defaultOutfit: null, defaultHair: null,
      partnerEnabled: true,
    },
    layout: {
      character: {x: 0, y: 0, scale: 1},                       // 换装时的角色：屏幕左右偏移(世界单位)、上下、缩放
      wardrobe: {right: 30, top: 250, width: 480, gap: 14, cellW: 212, cellH: 250, confirmOffset: 36},   // 参考分辨率 1080x1920 下的像素
      outro: {girl: {x: -0.55, scale: 1, yaw: 15}, boy: {x: 0.55, scale: 1, yaw: -15}},
    },
    skin: defaultSkin(),   // 只影响女主角的头/身体；关闭后和其他模型一样只显示贴图颜色
    lighting: {
      shadow: {enabled: true, opacity: 0.75, size: 1.0, offsetX: 0},   // 模型不受光照影响，这里只剩脚下的地面阴影；offsetX：左右位置(<0 偏左，>0 偏右)
    },
    camera: {fov: 30, distance: 4.3, height: 0.98, pitch: 0, shiftX: 0.27, outroShiftX: 0, outroDistance: 5.8, outroHeight: 1.25, outroPitch: 0},   // shiftX > 0：镜头右移，角色在屏幕上偏左(给右侧衣柜让位)
    rotation: {enabled: true, inertia: 0.92, hint: {enabled: true, style: 'icon+text'}, nudge: true},
    animations: JSON.parse(JSON.stringify(FIXED_ANIMATIONS.animations)),   // 动画固定内置，见 FIXED_ANIMATIONS
    phone: {...FIXED_ANIMATIONS.phone},
    sound: {enabled: true, volume: 0.8, events: Object.fromEntries(SOUND_EVENTS.map(([k]) => [k, null]))},
    export: {storeUrls: {ios: '', android: ''}, channel: 'applovin'},
  };
}

/** 深度合并：用默认值补齐旧项目缺的字段，方便以后升级格式 */
export function normalizeConfig(cfg) {
  const base = defaultConfig();
  const merge = (a, b) => {
    if (Array.isArray(a) || a === null || typeof a !== 'object') return b === undefined ? a : b;
    const out = {...a};
    for (const k of Object.keys(b || {})) out[k] = k in a ? merge(a[k], b[k]) : b[k];
    return out;
  };
  const out = merge(base, cfg || {});
  out.schema = SCHEMA_VERSION;
  if (out.skin && out.skin.mat) delete out.skin.mat.revise;   // 新版皮肤 shader 没有妆容颜色系数了
  if (out.lighting) { delete out.lighting.light; delete out.lighting.ambient; }   // 早先版本把平行光/环境光放在 lighting 下，现在在 skin.light，旧项目里的残留去掉
  out.animations = JSON.parse(JSON.stringify(FIXED_ANIMATIONS.animations)); out.phone = {...FIXED_ANIMATIONS.phone};   // 动画不可配置：旧项目里的动画绑定一律以内置为准
  // 阶段补齐
  for (const t of STAGE_TYPES) if (!out.flow.stages.some(s => s.type === t)) out.flow.stages.push({type: t, enabled: false, columns: 2, count: 6, options: []});
  return out;
}

/** 配置用到的全部资产 id */
export function usedAssetIds(cfg) {
  const s = new Set();
  const add = id => { if (id) s.add(id); };
  add(cfg.theme.backgrounds.play); add(cfg.theme.backgrounds.end);
  add(cfg.character.model); add(cfg.character.look); add(cfg.character.defaultOutfit); add(cfg.character.defaultHair);
  for (const st of cfg.flow.stages) if (st.enabled) for (const o of st.options.slice(0, st.count)) add(o.asset);
  for (const k of Object.keys(cfg.animations)) { if (k === 'partnerIdle' && !cfg.character.partnerEnabled) continue; (cfg.animations[k] || []).forEach(add); }
  if (cfg.character.partnerEnabled) add(cfg.character.partner); add(cfg.phone.model); add(cfg.phone.take); add(cfg.phone.end);
  if (cfg.sound.enabled) Object.values(cfg.sound.events).forEach(add);
  return [...s];
}

/** 校验：返回 [{level:'error'|'warn'|'ok', msg, where?}] */
export function validateConfig(cfg, lib, sizeInfo) {
  const out = []; const add = (level, msg, where) => out.push({level, msg, where});
  const has = id => !id || (lib && lib.has(id));
  const active = cfg.flow.stages.filter(s => s.enabled);
  if (!active.length) add('error', '没有启用任何换装阶段', 'flow');
  for (const s of active) {
    const n = STAGE_LABELS[s.type]; const vis = s.options.slice(0, s.count);
    if (!s.options.length) add('error', `${n}：素材池为空`, 'flow');
    else {
      if (s.count > s.options.length) add('warn', `${n}：可见数量(${s.count})大于已选素材(${s.options.length})`, 'flow');
      if (!vis.some(o => o.good)) add('warn', `${n}：可见素材里没有“好”，玩家无法选对`, 'flow');
      if (!vis.some(o => !o.good)) add('warn', `${n}：可见素材里没有“坏”，不会有选错反馈`, 'flow');
    }
    if (![1, 2, 3, 4].includes(s.columns)) add('warn', `${n}：网格列数异常`, 'flow');
  }
  if (!cfg.character.model) add('error', '没有选择女主角模型', 'character');
  if (!cfg.character.look) add('warn', '没有选择角色外观', 'character');
  if (!cfg.theme.backgrounds.play) add('warn', '没有设置开场/换装背景', 'theme');
  if (cfg.flow.outro.enabled && !cfg.theme.backgrounds.end) add('warn', '结局已开启但没有设置结局背景', 'theme');
  for (const id of usedAssetIds(cfg)) if (!has(id)) add('error', `资源库里找不到素材：${id}`, 'assets');
  if (!cfg.animations.idle.length) add('warn', '没有设置待机动画', 'animations');
  const t = cfg.theme.texts;
  for (const [k, label] of [['bannerTitle', '标题'], ['confirm', '确认按钮'], ['cta', 'CTA 按钮'], ['goodTitle', '好结局标题'], ['badTitle', '坏结局标题']]) if (!String(t[k] || '').trim()) add('warn', `${label}为空`, 'theme');
  if (!cfg.export.storeUrls.ios && !cfg.export.storeUrls.android) add('warn', '没有填商店链接：点击 CTA 只会触发渠道的跳转接口，不会打开商店', 'export');
  if (sizeInfo) {
    const ch = CHANNELS.find(c => c.id === cfg.export.channel) || CHANNELS[0];
    if (sizeInfo.bytes > ch.limit) add('error', `试玩体积 ${(sizeInfo.bytes / 1e6).toFixed(2)} MB 超过 ${ch.name} 的上限 ${(ch.limit / 1e6).toFixed(0)} MB`, 'size');
    else if (sizeInfo.bytes > ch.limit * 0.95) add('warn', `试玩体积 ${(sizeInfo.bytes / 1e6).toFixed(2)} MB 接近 ${ch.name} 的上限 ${(ch.limit / 1e6).toFixed(0)} MB`, 'size');
  }
  if (!out.some(x => x.level !== 'ok')) add('ok', '配置没有问题');
  return out;
}
