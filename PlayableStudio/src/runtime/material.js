// 把 glb 里的材质转成运行时材质。服装/鞋/发型/手机等：只显示贴图颜色(unlit)。女主角的头和身体：skinMaterial(移植自 Unity 的 LightweightSkin.shader，吃面板里的皮肤/灯光配置)。
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
uniform sampler2D map; uniform vec3 tint; uniform float opacity; uniform float cutoff;
uniform float hasPaint; uniform sampler2D paint;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec4 tex=texture2D(map,vUv);
  vec3 albedo=tex.rgb*tint;
  if(hasPaint>0.5){ vec4 p=texture2D(paint,vUv); albedo=mix(albedo,p.rgb,p.a); }   // 妆容：头部 UV 的 RGBA 贴图盖在皮肤上
  float a=tex.a*opacity;
  if(cutoff>0.0&&a<cutoff) discard;
  gl_FragColor=vec4(albedo,a);
}`;
const white = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
const clear = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); t.needsUpdate = true; return t; })();

/** src = GLTFLoader 产出的材质(MeshStandardMaterial)；light 只有 skinMaterial 用 */
export function styleMaterial(src, light) {
  const blend = !!src.transparent && !(src.alphaTest > 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: src.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: blend, depthWrite: !blend,
    uniforms: {
      map: {value: src.map || white}, tint: {value: new THREE.Vector3(1, 1, 1)},   // 只显示贴图颜色：不乘材质自带的底色(Unity 里皮肤材质 _Color≈0.63，会把贴图压暗)
      opacity: {value: blend ? src.opacity : 1}, cutoff: {value: src.alphaTest > 0 ? src.alphaTest : 0},   // 不受光照影响，只显示贴图颜色
      hasPaint: {value: 0}, paint: {value: clear},
    },
  });
  if (src.map) { src.map.colorSpace = THREE.NoColorSpace; }
  m.userData = {...(src.userData || {}), order: (src.userData && src.userData.renderOrder) || 0};
  return m;
}
/* ---------- 角色皮肤：移植自 Unity Assets/PlayableSkin/LightweightSkin.shader(ForwardBase 一遍) ----------
 * 参数默认取自 Unity 的 Skin_head / Skin_body 材质(见 shared/skin-params.js)，面板里可调；光照 = 面板里的平行光 + 环境光(相机空间方向)。
 * 和 Unity 的差别：没有投影(atten=1)、没有雾；
 * 灯光方向在观察空间里算，所以 view = -viewPos(透视相机)。 */
const SKIN_FRAG = `
precision highp float;
uniform sampler2D map; uniform float hasPaint; uniform sampler2D paint;
uniform vec3 lightDir; uniform vec3 lightColor; uniform vec3 ambientColor;
uniform vec3 skinColor; uniform float wrapV; uniform vec3 shadowTint; uniform vec3 brightTint; uniform vec3 darkTint; uniform vec3 ambientTint; uniform vec3 specColor; uniform float specPower;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec4 base=texture2D(map,vUv);   // RGB = 颜色，A = 高光遮罩
  vec3 albedo=base.rgb*skinColor;
  if(hasPaint>0.5){ vec4 p=texture2D(paint,vUv); albedo=mix(albedo,p.rgb,p.a); }   // 妆容：先给底色上色，再按 alpha 盖上脸绘(alpha 管覆盖度，满 alpha = 完全替换底色)
  vec3 n=normalize(vN); vec3 l=normalize(lightDir);
  float ndl=clamp(dot(n,l),-1.0,1.0);
  float wrap=clamp(wrapV,0.0,1.0);
  float d=clamp((ndl+wrap)/(1.0+wrap),0.0,1.0);
  vec3 diffuse=d*mix(shadowTint,vec3(1.0),d);
  float brightWeight=smoothstep(0.15,0.85,d);
  vec3 litColor=albedo*(ambientColor*ambientTint+diffuse*lightColor);
  vec3 darkColor=albedo*darkTint;
  vec3 col=mix(darkColor,litColor*brightTint,brightWeight);
  vec3 v=normalize(vV); vec3 sumLV=l+v; vec3 h=sumLV*inversesqrt(max(dot(sumLV,sumLV),1e-6));
  float spec=pow(clamp(dot(n,h),0.0,1.0),max(specPower,4.0));
  spec*=clamp(ndl*4.0,0.0,1.0)*base.a;
  col+=specColor*spec*lightColor;
  gl_FragColor=vec4(col,1.0);
}`;
/** src = GLTFLoader 材质(只取贴图)；rig = SkinRig(参数和灯光都在它的 uniform 里) */
export function skinMaterial(src, rig) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: SKIN_FRAG, side: THREE.FrontSide,
    uniforms: {map: {value: src.map || white}, hasPaint: {value: 0}, paint: {value: clear}, ...rig.u},
  });
  if (src.map) src.map.colorSpace = THREE.NoColorSpace;
  m.userData = {...(src.userData || {}), order: 0};
  return m;
}
export const setMap = (mat, tex) => { mat.uniforms.map.value = tex || white; };
export const setPaint = (mat, tex) => { mat.uniforms.paint.value = tex || clear; mat.uniforms.hasPaint.value = tex ? 1 : 0; };
