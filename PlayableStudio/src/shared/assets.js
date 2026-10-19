// 资产模型：资源库里的每个素材是一个 item，配置只通过 id 引用它。
// item = {id, type, name, collection?, tags?, files:{角色:路径}, meta:{...}}
//   files 里的路径相对于资源包根目录，如 'outfit_001/p0.glb'。
export const ASSET_TYPES = {
  character: {name: '角色', files: ['rig', 'icon'], note: '骨架(glb) + meta.parts 里列出的各部件(glb，蒙皮到该骨架)'},
  look:      {name: '外观', files: ['head', 'body', 'eye', 'brow', 'lash', 'icon'], note: '同一模型的一组贴图(webp)'},
  partner:   {name: '男角色', files: ['rig'], note: '骨架 + 部件，结构同角色'},
  outfit:    {name: '服装', files: ['icon'], note: 'meta.parts 里列出 glb'},
  hair:      {name: '发型', files: ['icon'], note: '同服装'},
  shoes:     {name: '鞋', files: ['icon'], note: '同服装'},
  makeup:    {name: '妆容', files: ['tex', 'icon'], note: '头部 UV 的 RGBA 贴图(webp)'},
  anim:      {name: '动画', files: ['anim'], note: '紧凑 .anim；meta.kind = body | phone'},
  sound:     {name: '音效', files: ['audio'], note: 'mp3 / wav / ogg'},
  background:{name: '背景', files: ['image'], note: 'webp / jpg'},
  phone:     {name: '手机', files: ['model'], note: '静态网格 glb'},
};
export const WEARABLE = ['outfit', 'hair', 'shoes'];

const MIME = {glb: 'model/gltf-binary', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', anim: 'application/octet-stream', json: 'application/json'};
export const extOf = p => String(p).split('.').pop().toLowerCase();
export const mimeOf = p => MIME[extOf(p)] || 'application/octet-stream';
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
export const fmtBytes = n => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MiB' : (n / 1024).toFixed(0) + ' KB';
