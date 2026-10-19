// 灯光：模型一律不受光照影响(材质 unlit)，这里只保留 shader 用的默认 uniform 和脚下阴影参数。
import * as THREE from 'three';
const hex = h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };
export class LightRig {
  constructor() {
    this.u = {
      lightDir: {value: new THREE.Vector3(0, 0.5, 0.8)}, lightColor: {value: new THREE.Vector3(1, 1, 1)},
      ambient: {value: new THREE.Vector3(.35, .35, .35)}, wrapP: {value: 0.5},
      rimColor: {value: new THREE.Vector3(.67, .7, 1)}, rimPower: {value: 2.5}, rimStrength: {value: .4},
    };
    this.world = new THREE.Vector3(0, .5, .8); this.shadow = {enabled: true, opacity: .45, size: 1, off: new THREE.Vector2()};
  }
  apply(l) { Object.assign(this.shadow, l.shadow); this.shadow.off.set(l.shadow.offsetX || 0, 0); }   // 模型不受光照影响，只有脚下阴影可调
  updateView(camera) { this.u.lightDir.value.copy(this.world).transformDirection(camera.matrixWorldInverse); }
}
