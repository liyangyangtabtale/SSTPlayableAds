// 完整构建：运行时模板 -> Studio 内嵌数据 -> Studio 单文件。产物 dist/PlayableStudio.html，双击即可打开。
import {execSync} from 'child_process'; import fs from 'fs';
const run = c => { console.log('> ' + c); execSync(c, {stdio: 'inherit'}); };
run('node tools/build-skin.mjs');         // 角色皮肤材质：读 Unity 的 PlayableSkin
run('node tools/build-animations.mjs');   // 内置动画：从 Unity 的 Animations 目录烘焙
run('npx vite build --config vite.runtime.config.js');
run('node tools/gen-studio-data.mjs');
run('npx vite build --config vite.studio.config.js');
fs.copyFileSync('dist/studio/studio.html', 'dist/PlayableStudio.html');
console.log('dist/PlayableStudio.html', (fs.statSync('dist/PlayableStudio.html').size / 1048576).toFixed(2), 'MiB');
