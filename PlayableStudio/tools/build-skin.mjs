// 皮肤材质：读 Unity 工程 Assets/PlayableSkin 里的 LightweightSkin.shader 和 Skin_head / Skin_body 材质，生成 src/shared/skin-params.js。
// 材质里没写的属性取 shader Properties 里的默认值(和 Unity 里实际渲染一致)。固定内置，不在面板里改；改材质/shader 后重新构建即可。
// 只读 Unity 工程。用法：node tools/build-skin.mjs [Unity 工程根目录，默认 ..]
import fs from 'fs'; import path from 'path';
import {setProject, ASSETS, readMaterial} from './unity-export/unity.mjs';

const OUT = path.resolve('src/shared/skin-params.js');
try { setProject(process.argv[2] || '..'); } catch (e) { if (fs.existsSync(OUT)) { console.log('没有找到 Unity 工程，沿用已有的皮肤参数：' + e.message); process.exit(0); } throw e; }
const dir = path.join(ASSETS, 'PlayableSkin'), shaderSrc = fs.readFileSync(path.join(dir, 'LightweightSkin.shader'), 'utf8');

/** shader Properties 里的默认值：Color -> [r,g,b,a]，Range/Float -> 数字 */
const defaults = {};
for (const m of shaderSrc.matchAll(/^\s*(?:\[[^\]]*\]\s*)*(_\w+)\s*\(\s*"[^"]*"\s*,\s*(\w+)(?:\([^)]*\))?\s*\)\s*=\s*(\([^)]*\)|[-\d.]+|"[^"]*"\s*\{\})/gm)) {
  const [, name, type, val] = m; if (type === 'Color' || type === 'Vector') defaults[name] = val.replace(/[()]/g, '').split(',').map(Number); else if (type === 'Range' || type === 'Float') defaults[name] = Number(val);
}
const NAMES = {color: '_Color', wrap: '_Wrap', shadowTint: '_ShadowTint', brightTint: '_BrightTint', darkTint: '_DarkTint', ambient: '_AmbientColor', specColor: '_SkinSpecColor', specPower: '_SpecPower'};
const rgb = c => [c.r, c.g, c.b].map(v => +v.toFixed(4));
function params(matFile) {
  const m = readMaterial(path.join(dir, matFile)); if (!m) throw new Error('读不了材质 ' + matFile);
  const out = {}; const note = [];
  for (const [k, prop] of Object.entries(NAMES)) {
    const own = prop in m.colors ? rgb(m.colors[prop]) : prop in m.floats ? m.floats[prop] : null;
    const def = defaults[prop]; const v = own ?? (Array.isArray(def) ? def.slice(0, 3) : def);
    if (v === undefined || v === null) throw new Error(`${matFile}：没有 ${prop} 的值，shader 里也没有默认值`);
    out[k] = Array.isArray(v) ? v.slice(0, 3).map(x => +x.toFixed(4)) : v; if (own === null) note.push(prop + '(shader 默认)');
  }
  if (m.colors._SpecColor && !('_SkinSpecColor' in m.colors)) note.push('材质里的 _SpecColor 不是 shader 的属性名(shader 用 _SkinSpecColor)，已忽略，与 Unity 渲染一致');
  console.log(`  ${m.name}：${note.join('，') || '全部取自材质'}`); return out;
}
const body = params('Skin_body.mat'), head = params('Skin_head.mat');
fs.writeFileSync(OUT, `// 自动生成：node tools/build-skin.mjs(读 Unity Assets/PlayableSkin 的材质和 shader 默认值)。不要手改。\nexport default ${JSON.stringify({head, body}, null, 1)};\n`);
console.log('皮肤参数 → src/shared/skin-params.js');
