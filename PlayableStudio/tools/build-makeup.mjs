// 妆容(第一版内置)：Unity 导出目录 Assets/PlayableExport/Makeup/*.png(头部 UV 的 RGBA 贴图) -> assets/makeup/{manifest.json, <id>/tex.webp, <id>/icon.webp}
// 图标 = 把妆容盖在内置肤色头部贴图上，裁出脸部区域。运行：node tools/build-makeup.mjs [Unity 工程根目录]
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
const PROJ = path.resolve(process.argv[2] || '..'); const SRC = path.join(PROJ, 'Assets/PlayableExport/Makeup'); const OUT = path.resolve('assets/makeup');
const SKIN = 'assets/placeholder/look_a/head.webp';     // 只用来衬底生成图标
fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
const files = fs.readdirSync(SRC).filter(f => /\.png$/i.test(f) && !/_icon\.png$/i.test(f)).sort(); const manifest = {};
const skin = await sharp(SKIN).resize(1024, 1024, {fit: 'fill'}).png().toBuffer(); let total = 0;
for (const f of files) {
  const id = path.basename(f, '.png'); const raw = fs.readFileSync(path.join(SRC, f));
  const tex = await sharp(raw).resize(1024, 1024, {fit: 'inside', withoutEnlargement: true}).webp({quality: 72, alphaQuality: 80}).toBuffer();
  const full = await sharp(raw).resize(1024, 1024, {fit: 'fill'}).png().toBuffer();
  const comp = await sharp(skin).composite([{input: full}]).png().toBuffer();
  const iconSrc = path.join(SRC, id + '_icon.png');   // 美术给了图标就直接用，没给才自动生成
  const icon = fs.existsSync(iconSrc) ? await sharp(iconSrc).resize(192, 192, {fit: 'cover'}).webp({quality: 75}).toBuffer() : await sharp(comp).extract({left: 80, top: 10, width: 860, height: 860}).resize(192, 192).webp({quality: 75}).toBuffer();
  fs.mkdirSync(path.join(OUT, id), {recursive: true}); fs.writeFileSync(path.join(OUT, id, 'tex.webp'), tex); fs.writeFileSync(path.join(OUT, id, 'icon.webp'), icon);
  manifest[id] = {id, type: 'makeup', name: id.replace(/^makeup_/, 'Makeup '), collection: 'builtin', tags: ['builtin'], files: {tex: `${id}/tex.webp`, icon: `${id}/icon.webp`}, meta: {}}; total += tex.length + icon.length;
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest)); console.log(`妆容：${files.length} 个，${(total / 1024).toFixed(0)} KB`);
