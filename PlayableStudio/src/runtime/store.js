// 资源包读取：manifest(资产清单) + blobs(路径 -> b91 字符串或字节)。运行时和 Studio 预览都用这个接口。
import {b91dec} from '../shared/b91.js';
import {mimeOf} from '../shared/assets.js';
export class AssetStore {
  constructor(manifest, blobs) { this.manifest = manifest || {}; this.blobs = blobs || {}; this.cache = {}; this.urls = {}; }
  item(id) { return this.manifest[id] || null; }
  has(id) { return !!this.manifest[id]; }
  path(id, role) { const it = this.manifest[id]; return it && it.files ? it.files[role] : null; }
  bytesAt(p) {
    if (this.cache[p]) return this.cache[p];
    const b = this.blobs[p]; if (b == null) throw new Error('资源包里没有文件 ' + p);
    return this.cache[p] = typeof b === 'string' ? b91dec(b) : b;
  }
  bytes(id, role) { const p = this.path(id, role); if (!p) throw new Error(`素材 ${id} 没有 ${role} 文件`); return this.bytesAt(p); }
  has2(id, role) { const p = this.path(id, role); return !!(p && this.blobs[p] != null); }
  url(id, role) {
    const p = this.path(id, role); if (!p || this.blobs[p] == null) return '';
    return this.urls[p] || (this.urls[p] = URL.createObjectURL(new Blob([this.bytesAt(p)], {type: mimeOf(p)})));
  }
}
