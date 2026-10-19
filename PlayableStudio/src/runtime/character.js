// 女主角 / 男角色：骨架 + 部件(asset.meta.parts)，可换外观贴图(look)、服装/发型/鞋(wearable)、妆容。
import * as THREE from 'three';
import {Rigged} from './rig.js';
import {loadGlb, loadTexture} from './loaders.js';
import {setMap, setPaint} from './material.js';

export class Character extends Rigged {
  /** asset = character / partner 资产：files.rig + meta.parts:[{file,role,name}] */
  async build(store, id) {
    this.store = store; const it = store.item(id);
    this.initRig(await loadGlb(store, it.files.rig));
    this.parts = [];
    for (const p of it.meta.parts || []) {
      const gltf = await loadGlb(store, it.files[p.file]); const holder = this.attach(gltf, {node: p.node, role: p.role});
      this.parts.push({role: p.role, holder});
    }
  }
  materialsOf(role) { const out = []; for (const p of this.parts) if (p.role === role) p.holder.traverse(o => { if (o.isSkinnedMesh) out.push(o.material); }); return out; }
  /** 外观：一组贴图，按部位(head/body/eye/brow/lash)替换对应部件的底色贴图 */
  async setLook(id) {
    const roles = ['head', 'body', 'eye', 'brow', 'lash']; this.lookId = id;
    for (const r of roles) { const tex = this.store.has2(id, r) ? await loadTexture(this.store, id, r) : null; if (tex) for (const m of this.materialsOf(r)) setMap(m, tex); }
  }
  /** 换上一件服装/发型/鞋：同类的旧物品会被摘掉；连续点击只保留最后一次 */
  async equip(type, id) {
    this.eq = this.eq || {}; const n = this.eq[type] = (this.eq[type] || 0) + 1; const it = this.store.item(id); if (!it) return;
    const group = new THREE.Group(); group.name = 'slot_' + type;
    for (const p of it.meta.parts || [{file: 'model'}]) group.add(this.attach(await loadGlb(this.store, it.files[p.file]), {node: p.node}));
    if (this.eq[type] !== n) return; this.remove(type); this.rig.add(group); this.slots[type] = group;
  }
  /** 妆容 = 头部 UV 的 RGBA 贴图，盖在皮肤上；id=null 清除 */
  async makeup(id) { const tex = id ? await loadTexture(this.store, id, 'tex') : null; for (const m of this.materialsOf('head')) setPaint(m, tex); }
}
