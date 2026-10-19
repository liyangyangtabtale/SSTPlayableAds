// 运行时入口：读取注入的配置和资源包(window.__PLAYABLE__)，启动试玩。预览(Studio)和导出的成品共用这份代码。
import './style.css';
import {AssetStore} from './store.js';
import {Channel} from './channel.js';
import {UI} from './ui.js';
import {Game} from './game.js';
import {normalizeConfig} from '../shared/schema.js';

const stage = document.getElementById('stage');
function fallback(cfg, channel, msg) {   // WebGL 不可用(AppLovin 要求有降级)：只显示背景和 CTA 按钮
  const t = cfg ? cfg.theme.texts : {cta: 'Play Now'};
  document.getElementById('loading').remove();
  const b = document.createElement('div'); b.className = 'btn cta solo'; b.textContent = t.cta; b.onclick = () => channel.cta(); document.getElementById('ui').append(b);
  console.warn('降级：', msg);
}
(async () => {
  const P = window.__PLAYABLE__; if (!P) throw new Error('没有找到试玩数据 window.__PLAYABLE__');
  const cfg = normalizeConfig(P.config), store = new AssetStore(P.manifest, P.blobs), channel = new Channel(P.channel, cfg.export.storeUrls);
  window.__CFG = cfg;
  await channel.ready();
  const fit = () => { stage.style.setProperty('--sw', stage.clientWidth + 'px'); window.__GAME && window.__GAME.setSize(stage.clientWidth, stage.clientHeight); window.__UI && window.__UI.refit && window.__UI.refit(); };
  const ui = window.__UI = new UI(document.getElementById('ui'), stage); addEventListener('resize', fit);
  let game; try { game = window.__GAME = new Game(cfg, store, document.getElementById('gl'), ui, channel); } catch (e) { fit(); return fallback(cfg, channel, e.message); }
  fit(); await game.load(); fit(); game.start(); game.run();
  parent !== window && parent.postMessage({type: 'playable-ready'}, '*');
})().catch(e => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = '出错：' + e.message; parent !== window && parent.postMessage({type: 'playable-error', message: e.message}, '*'); });
