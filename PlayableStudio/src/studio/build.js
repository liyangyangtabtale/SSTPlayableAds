// 生成试玩：把配置 + 用到的资源注入运行时模板。预览(iframe)和各渠道导出共用。
import JSZip from 'jszip';
import TEMPLATE from './generated/runtime-template.js';
import {normalizeConfig, usedAssetIds, CHANNELS} from '../shared/schema.js';
const MARK = 'window.__PLAYABLE__=null;/*PLAYABLE_DATA*/';
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const jsonSafe = o => JSON.stringify(o).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
export function makePlayable(cfg, lib, {channel = 'preview', zipSafe = false} = {}) {
  const c = {...normalizeConfig(cfg), themes: []}; const {manifest, blobs} = lib.runtime(usedAssetIds(c));   // 导出只带当前主题
  let html = TEMPLATE.replace(MARK, () => 'window.__PLAYABLE__=' + jsonSafe({config: c, manifest, blobs, channel}) + ';');
  if (channel === 'google') html = html.replace('<head>', '<head><meta name="ad.orientation" content="portrait">');
  return html;
}
/** 体积估算(不真的拼接字符串)：模板 + 配置 + 每个用到的文件(b91 后的长度) */
export function sizeReport(cfg, lib) {
  const c = {...normalizeConfig(cfg), themes: []}; const ids = usedAssetIds(c); const rows = []; let total = TEMPLATE.length + JSON.stringify(c).length + 200;
  for (const id of ids) { const it = lib.get(id); if (!it) continue; let s = 0; for (const p of Object.values(it.files)) { const b = lib.b91(p); s += (b ? b.length : 0) + p.length + 8; } rows.push({id, name: it.name, type: it.type, bytes: s}); total += s; }
  rows.sort((a, b) => b.bytes - a.bytes); return {bytes: total, template: TEMPLATE.length, rows};
}
/** 按渠道导出：返回 [{name, data(string|Uint8Array), mime}] */
export async function exportForChannel(cfg, lib) {
  const ch = CHANNELS.find(x => x.id === cfg.export.channel) || CHANNELS[0]; const html = makePlayable(cfg, lib, {channel: ch.id});
  const base = (cfg.name || 'playable').replace(/[^\w一-龥-]+/g, '_') + '_' + ch.id;
  if (ch.format === 'html') return {file: base + '.html', blob: new Blob([html], {type: 'text/html'}), bytes: new TextEncoder().encode(html).length};
  const z = new JSZip(); z.file('index.html', html);
  if (ch.id === 'tiktok') z.file('config.json', JSON.stringify({playable_orientation: 0, playable_languages: ['en']}));   // 声明竖屏；字段以 TikTok 官方文档为准，导出前请核对
  const blob = await z.generateAsync({type: 'blob', compression: 'DEFLATE', compressionOptions: {level: 9}});
  return {file: base + '.zip', blob, bytes: blob.size};
}
