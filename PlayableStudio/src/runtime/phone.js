// 开场手机：静态网格 + 自己的动画(位置/旋转/缩放)，和角色的 takePhone / endPhone 同时播放。
import * as THREE from 'three';
import {Rigged} from './rig.js';
import {loadGlb} from './loaders.js';
export class Phone extends Rigged {
  async build(store, id) {
    const gltf = await loadGlb(store, store.item(id).files.model);
    this.rig = new THREE.Group(); this.root.add(this.rig); this.attachStatic(gltf);
    this.mixer = new THREE.AnimationMixer(this.rig); this.pelvis = null;
  }
}
