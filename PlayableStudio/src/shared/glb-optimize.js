// glb 压缩(浏览器和 Node 共用)：贴图转 webp(限尺寸)、模型 16 位量化 + meshopt。
// 注意：不用 gltf-transform 的 meshopt() 便捷函数——它默认带低精度量化(位置 14 位、权重 8 位)，会让角色变形，所以这里显式用 16 位量化再挂 meshopt 扩展。
// plain=true：静态网格(手机)的节点缩放可能被动画驱动，量化会把缩放写进节点而被动画覆盖，所以不量化不压缩。
import {EXTMeshoptCompression, EXTTextureWebP} from '@gltf-transform/extensions';
import {prune, dedup, quantize} from '@gltf-transform/functions';
/** encodeImage(bytes, mime, {max, quality}) -> Promise<{bytes, ext}> */
export async function optimizeDoc(doc, {encodeImage, MeshoptEncoder, plain = false, maxTex = 1024, quality = 0.8}) {
  if (MeshoptEncoder && MeshoptEncoder.ready) await MeshoptEncoder.ready;
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage(); if (!img) continue;
    const r = await encodeImage(img, t.getMimeType() || 'image/png', {max: maxTex, quality}); t.setImage(r.bytes).setMimeType(r.ext === 'webp' ? 'image/webp' : 'image/png');
  }
  await doc.transform(prune({keepAttributes: true, keepLeaves: true}), dedup());
  if (!plain) {
    await doc.transform(quantize({quantizePosition: 16, quantizeNormal: 16, quantizeTexcoord: 16, quantizeWeight: 16, quantizeGeneric: 16}));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  }
  return doc;
}
