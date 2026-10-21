// 女主角头/身体的皮肤着色参数(材质 + 场景灯光)：所有皮肤材质共用这一份 uniform，配置在 cfg.skin。
import * as THREE from 'three';
const col = h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };
export class SkinRig {
  constructor(cfg) {
    const m = cfg.mat, L = cfg.light, k = L.intensity;
    const lc = col(L.color).multiplyScalar(k), ac = col(L.ambient);
    this.enabled = !!cfg.enabled; this.dirWorld = new THREE.Vector3(L.dir.x, L.dir.y, L.dir.z).normalize();   // 相机空间里的方向，不随相机/角色转动变化
    this.u = {
      lightDir: {value: this.dirWorld.clone()}, lightColor: {value: lc}, ambientColor: {value: ac},
      skinColor: {value: col(m.color)}, wrapV: {value: m.wrap}, shadowTint: {value: col(m.shadowTint)}, brightTint: {value: col(m.brightTint)},
      darkTint: {value: col(m.darkTint)}, ambientTint: {value: col(m.ambientTint)}, specColor: {value: col(m.specColor)}, specPower: {value: m.specPower},
    };
  }
}
