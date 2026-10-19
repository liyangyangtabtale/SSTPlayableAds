// 资源包读写(Node 端)：目录 <-> {manifest, files}。
import fs from 'fs'; import path from 'path';
import {b91enc} from '../../src/shared/b91.js';
export function readPackDir(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); const files = new Map();
  for (const it of Object.values(manifest)) for (const rel of Object.values(it.files)) if (!files.has(rel)) files.set(rel, fs.readFileSync(path.join(dir, rel)));
  const cfgP = path.join(dir, 'config.json'); return {manifest, files, config: fs.existsSync(cfgP) ? JSON.parse(fs.readFileSync(cfgP, 'utf8')) : null};
}
/** 取一部分素材做成运行时用的 {manifest, blobs(b91)} */
export function subset(pack, ids) {
  const manifest = {}, blobs = {};
  for (const id of ids) { const it = pack.manifest[id]; if (!it) continue; manifest[id] = it; for (const rel of Object.values(it.files)) if (!blobs[rel]) blobs[rel] = b91enc(new Uint8Array(pack.files.get(rel))); }
  return {manifest, blobs};
}
