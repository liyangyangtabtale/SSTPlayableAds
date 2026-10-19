#!/usr/bin/env node
// 用法：node tools/unity-export/cli.mjs --project <Unity 工程根目录> --out <输出.zip> [--spec export.json] [--dir Assets/PlayableExport]
// 只读 Unity 工程，不会修改里面任何文件。输出的 ZIP 用 Studio 的“资源库 → 导入资源包”导入。
import fs from 'fs'; import path from 'path';
import {setProject, exportSpec, writeZip, discover} from './export.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a, []));
if (!args.project || !args.out) { console.error('用法：node tools/unity-export/cli.mjs --project <Unity 工程根目录> --out <输出.zip> [--spec export.json] [--dir Assets/PlayableExport]'); process.exit(1); }
setProject(args.project);
const spec = args.spec ? JSON.parse(fs.readFileSync(args.spec, 'utf8')) : discover(args.dir || 'Assets/PlayableExport');
console.log('导出：', args.project); const r = await exportSpec(spec);
await writeZip(r, args.out); const n = Object.keys(r.items).length;
console.log(`完成：${n} 个素材 → ${args.out}（${(fs.statSync(args.out).size / 1048576).toFixed(2)} MiB）`);
if (r.warn.length) { console.log('\n警告：'); for (const w of r.warn) console.log('  - ' + w); process.exitCode = 0; }
