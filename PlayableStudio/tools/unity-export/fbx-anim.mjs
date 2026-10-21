// FBX2glTF 读不了的动画 FBX(带有找不到图片的贴图引用时会段错误)的兜底：用 three 的 FBXLoader 解析，
// 再拼成 gltf-transform 文档(骨骼 translation/rotation + 形变 weights)，和 FBX2glTF 的产物走同一条后续流程。
import fs from 'fs'; import path from 'path'; import {pathToFileURL} from 'url';
import {Document} from '@gltf-transform/core';

const NM=path.resolve('node_modules/three');
let FBXLoader;
async function loader(){
  if(FBXLoader) return FBXLoader;
  const el=()=>({style:{},addEventListener(){},removeEventListener(){},set src(v){}});   // FBXLoader 会为贴图创建 <img>，node 里给个空壳
  globalThis.document=globalThis.document||{createElementNS:el,createElement:el}; globalThis.self=globalThis.self||globalThis;
  ({FBXLoader}=await import(pathToFileURL(path.join(NM,'examples/jsm/loaders/FBXLoader.js')).href));
  return FBXLoader;
}
const sanitize=n=>String(n||'').replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'');

/** rigNames：骨架里的原始节点名(FBXLoader 的名字空格被替换成了下划线，靠它还原)。位移单位 cm -> m(同 FBX2glTF；顶层节点另有 0.1 缩放，见下)。 */
export async function fbxAnimDoc(src,rigNames){
  const L=await loader(); const b=fs.readFileSync(src);
  const g=new (L)().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const clip=g.animations[0]; if(!clip) throw new Error('FBX 里没有动画: '+src);
  const top=new Set(g.children.map(o=>o.name));   // 场景顶层节点(骨架根/Dummy)：FBX2glTF 里挂在 RootNode 下并带 0.1 缩放，位移系数是 0.001 而不是 0.01
  const back={}; for(const n of rigNames) back[sanitize(n)]=n;
  const doc=new Document(); const buf=doc.createBuffer(); const scene=doc.createScene(); const anim=doc.createAnimation(clip.name);
  const nodes={};
  const getNode=nm=>{ if(!nodes[nm]){ const n=doc.createNode(nm); scene.addChild(n); nodes[nm]=n; } return nodes[nm]; };
  const acc=(type,arr)=>doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const add=(n,path_,times,vals,type)=>{
    const s=doc.createAnimationSampler().setInput(acc('SCALAR',Float32Array.from(times))).setOutput(acc(type,Float32Array.from(vals))).setInterpolation('LINEAR');
    anim.addSampler(s); anim.addChannel(doc.createAnimationChannel().setTargetNode(n).setTargetPath(path_).setSampler(s));
  };
  const weights={};   // 网格名 -> [{i,times,values}]
  for(const t of clip.tracks){
    const m=t.name.match(/^(.*?)\.(position|quaternion|scale|morphTargetInfluences)(?:\[(\d+)\])?$/); if(!m) continue;
    const [,nm,prop,idx]=m;
    if(prop==='morphTargetInfluences'){ (weights[nm]||(weights[nm]=[])).push({i:Number(idx),times:t.times,values:t.values}); continue; }
    const n=getNode(back[nm]||nm);
    if(prop==='position') add(n,'translation',t.times,Array.from(t.values,v=>v*(top.has(nm)?0.001:0.01)),'VEC3');
    else if(prop==='quaternion') add(n,'rotation',t.times,t.values,'VEC4');
    else if(Array.from(t.values).some(v=>Math.abs(v-1)>1e-4)) add(n,'scale',t.times,t.values,'VEC3');   // 恒为 1 的缩放轨道没意义
  }
  for(const [nm,list] of Object.entries(weights)){
    list.sort((a,c)=>a.i-c.i); const times=list[0].times,N=list.length; const out=new Array(times.length*N);
    for(let k=0;k<times.length;k++) list.forEach((w,j)=>{ out[k*N+j]=w.values[k]; });
    add(getNode(nm),'weights',times,out,'SCALAR');
  }
  return doc;
}
