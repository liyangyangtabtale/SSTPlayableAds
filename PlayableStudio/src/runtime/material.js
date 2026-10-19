// 把 glb 里的材质(贴图、颜色、alphaMode、双面)转成“风格化光照”材质：贴图 × (环境光 + 包裹漫反射 × 灯光色) + 轮廓光。
// 光照参数来自 LightRig，所有部件统一，所以面板里调灯光就能让角色融入背景。
import * as THREE from 'three';
const VERT = `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
#include <common>
#include <skinning_pars_vertex>
#include <morphtarget_pars_vertex>
void main(){
  vUv=uv;
  #include <beginnormal_vertex>
  #include <morphinstance_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  vN=normalize(normalMatrix*objectNormal);
  vec4 mv=modelViewMatrix*vec4(transformed,1.0);
  vV=normalize(-mv.xyz);
  gl_Position=projectionMatrix*mv;
}`;
const FRAG = `
precision highp float;
uniform sampler2D map; uniform vec3 tint; uniform float opacity; uniform float cutoff; uniform float unlit;
uniform vec3 lightDir; uniform vec3 lightColor; uniform vec3 ambient; uniform float wrapP;
uniform vec3 rimColor; uniform float rimPower; uniform float rimStrength;
uniform float hasPaint; uniform sampler2D paint;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec4 tex=texture2D(map,vUv);
  vec3 albedo=tex.rgb*tint;
  if(hasPaint>0.5){ vec4 p=texture2D(paint,vUv); albedo=mix(albedo,p.rgb,p.a); }   // 妆容：头部 UV 的 RGBA 贴图盖在皮肤上
  float a=tex.a*opacity;
  if(cutoff>0.0&&a<cutoff) discard;
  if(unlit>0.5){ gl_FragColor=vec4(albedo,a); return; }
  vec3 n=normalize(vN);
  float diff=clamp(dot(n,lightDir)*(1.0-wrapP)+wrapP,0.0,1.5);
  vec3 col=albedo*(ambient+lightColor*diff);
  float rim=pow(1.0-clamp(dot(normalize(vV),n),0.0,1.0),rimPower);
  col+=rimColor*rim*rimStrength;
  gl_FragColor=vec4(col,a);
}`;
const white = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
const clear = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); t.needsUpdate = true; return t; })();

/** src = GLTFLoader 产出的材质(MeshStandardMaterial)；light = LightRig */
export function styleMaterial(src, light) {
  const blend = !!src.transparent && !(src.alphaTest > 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: src.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: blend, depthWrite: !blend,
    uniforms: {
      map: {value: src.map || white}, tint: {value: new THREE.Vector3(1, 1, 1)},   // 只显示贴图颜色：不乘材质自带的底色(Unity 里皮肤材质 _Color≈0.63，会把贴图压暗)
      opacity: {value: blend ? src.opacity : 1}, cutoff: {value: src.alphaTest > 0 ? src.alphaTest : 0}, unlit: {value: 1},   // 所有模型都不受光照影响，只显示贴图颜色
      hasPaint: {value: 0}, paint: {value: clear}, ...light.u,
    },
  });
  if (src.map) { src.map.colorSpace = THREE.NoColorSpace; }
  m.userData = {...(src.userData || {}), order: (src.userData && src.userData.renderOrder) || 0};
  return m;
}
export const setMap = (mat, tex) => { mat.uniforms.map.value = tex || white; };
export const setPaint = (mat, tex) => { mat.uniforms.paint.value = tex || clear; mat.uniforms.hasPaint.value = tex ? 1 : 0; };
