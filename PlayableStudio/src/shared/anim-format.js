// 紧凑动画格式 .anim：glb 里每条通道的 JSON 开销比数据还大，所以导出/打包用这个格式。
// 头部 uint32 长度 + JSON {d:时长, t:[{n:节点名,p:类型,k:帧数,w?:形变数}]}，后面按轨道顺序放二进制。
//   q 旋转：时间 uint16(毫秒) + int16×4 归一化四元数 ｜ t/s 位移/缩放：时间 uint16 + float32×3 ｜ m 形变权重：时间 uint16 + uint16×w (0..1)
const ms = t => Math.min(65535, Math.round(t * 1000));
/** tracks: [{n,p,times:Float32Array|number[],values:Float32Array|number[],w?}] */
export function encodeAnim(duration, tracks) {
  const head = []; const blobs = []; let total = 0;
  for (const t of tracks) {
    const k = t.times.length; head.push({n: t.n, p: t.p, k, ...(t.p === 'm' ? {w: t.w} : {})});
    const tb = new Uint8Array(k * 2); const tdv = new DataView(tb.buffer); for (let i = 0; i < k; i++) tdv.setUint16(i * 2, ms(t.times[i]), true);
    let vb;
    if (t.p === 'q') { vb = new Uint8Array(k * 8); const dv = new DataView(vb.buffer); for (let i = 0; i < k; i++) { const q = [0, 1, 2, 3].map(j => t.values[i * 4 + j]); const l = Math.hypot(...q) || 1; for (let j = 0; j < 4; j++) dv.setInt16(i * 8 + j * 2, Math.round(q[j] / l * 32767), true); } }
    else if (t.p === 'm') { vb = new Uint8Array(k * t.w * 2); const dv = new DataView(vb.buffer); for (let i = 0; i < k * t.w; i++) dv.setUint16(i * 2, Math.round(Math.min(1, Math.max(0, t.values[i])) * 65535), true); }
    else { vb = new Uint8Array(k * 12); const dv = new DataView(vb.buffer); for (let i = 0; i < k * 3; i++) dv.setFloat32(i * 4, t.values[i], true); }
    blobs.push(tb, vb); total += tb.length + vb.length;
  }
  const hj = new TextEncoder().encode(JSON.stringify({d: duration, t: head}));
  const out = new Uint8Array(4 + hj.length + total); new DataView(out.buffer).setUint32(0, hj.length, true); out.set(hj, 4); let o = 4 + hj.length;
  for (const b of blobs) { out.set(b, o); o += b.length; }
  return out;
}
/** -> {duration, tracks:[{n,p,times:Float32Array,values:Float32Array,w?}]} */
export function decodeAnim(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const hl = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(u8.subarray(4, 4 + hl))); let o = 4 + hl; const tracks = [];
  for (const t of head.t) {
    const times = new Float32Array(t.k); for (let i = 0; i < t.k; i++) times[i] = dv.getUint16(o + i * 2, true) / 1000; o += t.k * 2;
    let values;
    if (t.p === 'q') { values = new Float32Array(t.k * 4); for (let i = 0; i < t.k * 4; i++) values[i] = dv.getInt16(o + i * 2, true) / 32767; o += t.k * 8; }
    else if (t.p === 'm') { values = new Float32Array(t.k * t.w); for (let i = 0; i < t.k * t.w; i++) values[i] = dv.getUint16(o + i * 2, true) / 65535; o += t.k * t.w * 2; }
    else { values = new Float32Array(t.k * 3); for (let i = 0; i < t.k * 3; i++) values[i] = dv.getFloat32(o + i * 4, true); o += t.k * 12; }
    tracks.push({n: t.n, p: t.p, times, values, w: t.w});
  }
  return {duration: head.d, tracks};
}
