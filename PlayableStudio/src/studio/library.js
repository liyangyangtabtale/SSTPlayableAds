// 资源库：自带的基础资源(只读，内嵌在 Studio 里) + 用户上传的资源(保存在浏览器 IndexedDB，可导出/导入资源库文件备份和共享)。
import {b91enc, b91dec} from '../shared/b91.js';
import {mimeOf} from '../shared/assets.js';

const DB = 'playable-studio-lib', V = 1;
const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, V); r.onupgradeneeded = () => { r.result.createObjectStore('items', {keyPath: 'id'}); r.result.createObjectStore('files'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = (db, store, mode, fn) => new Promise((res, rej) => { const t = db.transaction(store, mode); const out = fn(t.objectStore(store)); t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); });

export class Library {
  constructor(base) { this.baseManifest = base.manifest; this.baseBlobs = base.blobs; this.user = {}; this.userBlobs = new Map(); this.cache = new Map(); this.enc = new Map(); this.subs = new Set(); this.db = null; }
  async init() {
    try {
      this.db = await open();
      const items = await new Promise(r => { const q = this.db.transaction('items').objectStore('items').getAll(); q.onsuccess = () => r(q.result); });
      for (const it of items) { this.user[it.id] = it; for (const p of Object.values(it.files)) if (!this.userBlobs.has(p)) { const b = await new Promise(r => { const q = this.db.transaction('files').objectStore('files').get(p); q.onsuccess = () => r(q.result); }); if (b) this.userBlobs.set(p, new Uint8Array(b)); } }
    } catch (e) { console.warn('资源库本地存储不可用，上传的资源只在本次打开期间有效', e); this.db = null; }
  }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit() { for (const f of this.subs) f(); }
  isUser(id) { return !!this.user[id]; }
  get(id) { return this.user[id] || this.baseManifest[id] || null; }
  has(id) { return !!this.get(id); }
  all(type) { const out = [...Object.values(this.baseManifest).filter(i => !this.user[i.id]), ...Object.values(this.user)]; return type ? out.filter(i => i.type === type) : out; }
  first(type) { return this.all(type)[0] || null; }
  bytes(path) {
    if (this.userBlobs.has(path)) return this.userBlobs.get(path);
    if (this.cache.has(path)) return this.cache.get(path);
    const b = this.baseBlobs[path]; if (b == null) return null; const u8 = b91dec(b); this.cache.set(path, u8); return u8;
  }
  b91(path) { if (this.userBlobs.has(path)) { if (!this.enc.has(path)) this.enc.set(path, b91enc(this.userBlobs.get(path))); return this.enc.get(path); } return this.baseBlobs[path]; }
  url(id, role) { const it = this.get(id); const p = it && it.files[role]; if (!p) return ''; const k = 'url:' + p; if (!this.cache.has(k)) { const b = this.bytes(p); if (!b) return ''; this.cache.set(k, URL.createObjectURL(new Blob([b], {type: mimeOf(p)}))); } return this.cache.get(k); }
  itemSize(it) { return Object.values(it.files).reduce((a, p) => a + ((this.userBlobs.get(p) || {}).length || Math.round(((this.baseBlobs[p] || '').length) * 0.81)), 0); }
  uniqueId(base) { let id = base, i = 2; while (this.has(id)) id = base + '_' + i++; return id; }
  /** files: Map(相对路径 -> Uint8Array)；item.files 里的路径要和它对应 */
  async add(item, files) {
    for (const [p, b] of files) { this.userBlobs.set(p, b); this.enc.delete(p); }
    this.user[item.id] = item;
    if (this.db) { await tx(this.db, 'items', 'readwrite', s => s.put(item)); for (const [p, b] of files) await tx(this.db, 'files', 'readwrite', s => s.put(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), p)); }
    this.emit(); return item;
  }
  async remove(id) {
    const it = this.user[id]; if (!it) return; delete this.user[id];
    for (const p of Object.values(it.files)) { this.userBlobs.delete(p); this.cache.delete(p); this.cache.delete('url:' + p); this.enc.delete(p); }
    if (this.db) { await tx(this.db, 'items', 'readwrite', s => s.delete(id)); for (const p of Object.values(it.files)) await tx(this.db, 'files', 'readwrite', s => s.delete(p)); }
    this.emit();
  }
  /** 运行时用的资源包：只带这些 id 的素材，文件用 b91 字符串 */
  runtime(ids) {
    const manifest = {}, blobs = {};
    for (const id of ids) { const it = this.get(id); if (!it) continue; manifest[id] = it; for (const p of Object.values(it.files)) if (blobs[p] == null) { const b = this.b91(p); if (b != null) blobs[p] = b; } }
    return {manifest, blobs};
  }
  rigNamesSource() { const c = this.first('character'); return c ? c.files.rig : null; }
}
