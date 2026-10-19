// 开发用：把占位资源包 + 配置写成 public/dev-data.js，运行时 dev server 直接读。
import fs from 'fs'; import {readPackDir, subset} from './lib/pack.mjs';
import {normalizeConfig, usedAssetIds} from '../src/shared/schema.js';
const pack = readPackDir('assets/placeholder'); const config = normalizeConfig(pack.config);
const {manifest, blobs} = subset(pack, usedAssetIds(config));
fs.writeFileSync('public/dev-data.js', 'window.__PLAYABLE__=' + JSON.stringify({config, manifest, blobs, channel: 'preview'}) + ';');
console.log('public/dev-data.js', (fs.statSync('public/dev-data.js').size / 1048576).toFixed(2), 'MiB');
