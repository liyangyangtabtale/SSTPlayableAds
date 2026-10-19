// 只读 Unity 工程：GUID 索引、YAML 资源解析、FBX 内部网格名表。这里不会写 Unity 工程里的任何文件。
import fs from 'fs'; import path from 'path'; import * as yaml from 'js-yaml';
export let ROOT=null, ASSETS=null;
let guidMap=null;
/** 指定要读取的 Unity 工程根目录(含 Assets 的那一层) */
export function setProject(root){ ROOT=path.resolve(root); ASSETS=path.join(ROOT,'Assets'); if(!fs.existsSync(ASSETS)) throw new Error('不是 Unity 工程目录(找不到 Assets)：'+ROOT); guidMap=null; for(const k of Object.keys(metaCache)) delete metaCache[k]; }
function walk(d,out){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p,out); else if(e.name.endsWith('.meta')) out.push(p); } }
/** guid -> 资源文件的绝对路径 */
export function guidIndex(){
  if(guidMap) return guidMap; guidMap={}; const metas=[]; walk(ASSETS,metas);
  for(const m of metas){ const g=(fs.readFileSync(m,'utf8').match(/^guid: (\w+)/m)||[])[1]; if(g) guidMap[g]=m.slice(0,-5); }
  return guidMap;
}
export const pathOf=ref=>ref&&ref.guid?guidIndex()[ref.guid]||null:null;
export const rel=p=>p&&path.relative(ROOT,p);
export const baseName=p=>p&&path.basename(p,path.extname(p));

/** 解析 Unity YAML(可含多个文档)。返回 [{type,id,body}]，body 是去掉最外层类名后的字段表 */
export function readDocs(file){
  const txt=fs.readFileSync(file,'utf8'); const docs=[];
  const parts=txt.split(/^--- !u!(\d+) &(-?\d+)(?: stripped)?\s*$/m);
  for(let i=1;i<parts.length;i+=3){
    // fileID 可能超过 2^53，先加引号当字符串读，避免精度丢失
    const data=yaml.load((parts[i+2]||'').replace(/fileID: (-?\d+)/g,'fileID: "$1"'))||{}; const cls=Object.keys(data)[0];
    docs.push({type:Number(parts[i]),id:parts[i+1],cls,body:data[cls]||{}});
  }
  return docs;
}

const metaCache={};
/** FBX 的 .meta 里 internalIDToNameTable：fileID -> 名字(网格 type 43、动画 type 74) */
export function fbxNames(fbxPath){
  if(metaCache[fbxPath]) return metaCache[fbxPath];
  // 哈希形式的 fileID 超过 2^53，先加引号按字符串读，避免精度丢失
  const m=yaml.load(fs.readFileSync(fbxPath+'.meta','utf8').replace(/^(\s+\d+): (-?\d{15,})\s*$/gm,'$1: "$2"'))||{};
  const tbl=(m.ModelImporter||{}).internalIDToNameTable||[]; const out={mesh:{},anim:{}};
  for(const e of tbl){ const [t,id]=Object.entries(e.first)[0]; if(Number(t)===43) out.mesh[id]=e.second; if(Number(t)===74) out.anim[id]=e.second; }
  return metaCache[fbxPath]=out;
}

/** 材质文件 -> {shader, mainTex(路径或null), color, keywords, floats} */
export function readMaterial(matPath){
  const d=readDocs(matPath).find(x=>x.cls==='Material'); if(!d) return null;
  const sp=d.body.m_SavedProperties||{}; const texEnvs={}; for(const e of sp.m_TexEnvs||[]){ const k=Object.keys(e)[0]; texEnvs[k]=e[k]; }
  const colors={}; for(const e of sp.m_Colors||[]){ const k=Object.keys(e)[0]; colors[k]=e[k]; }
  const floats={}; for(const e of sp.m_Floats||[]){ const k=Object.keys(e)[0]; floats[k]=e[k]; }
  const mt=texEnvs._MainTex&&texEnvs._MainTex.m_Texture;
  return {path:matPath,name:d.body.m_Name,shaderGuid:(d.body.m_Shader||{}).guid,keywords:[d.body.m_ShaderKeywords||'',...(d.body.m_ValidKeywords||[])].join(' '),   // Unity 2021+ 把启用的关键字存在 m_ValidKeywords 里(m_ShaderKeywords 常为空)，两处都要读
    renderQueue:d.body.m_CustomRenderQueue,
    mainTex:mt&&mt.guid?pathOf(mt):null,facePaintTex:texEnvs._FacePaintTex&&pathOf(texEnvs._FacePaintTex.m_Texture),colors,floats};
}

/** 预制体里的渲染器：[{node:'FBX 里的节点名', fbx:'FBX路径', materials:[材质路径|null,...]}]
 *  网格靠渲染器所在 GameObject 的名字对应 FBX 节点（FBX 的 .meta 里网格 fileID 是哈希，没法直接换成名字）。 */
export function prefabRenderers(prefabPath){
  if(prefabPath.toLowerCase().endsWith('.fbx')) return [];
  const docs=readDocs(prefabPath); const byId=Object.fromEntries(docs.map(d=>[d.id,d])); const out=[];
  for(const d of docs){
    if(d.type!==137&&d.type!==23) continue; // SkinnedMeshRenderer / MeshRenderer
    const goId=String(d.body.m_GameObject&&d.body.m_GameObject.fileID);
    let meshRef=d.body.m_Mesh;
    if(!meshRef||!meshRef.guid){ const mf=docs.find(x=>x.type===33&&String(x.body.m_GameObject&&x.body.m_GameObject.fileID)===goId); meshRef=mf&&mf.body.m_Mesh; }
    const fbx=pathOf(meshRef); if(!fbx) continue;
    out.push({node:byId[goId]?byId[goId].body.m_Name:null,fbx,materials:(d.body.m_Materials||[]).map(r=>pathOf(r))});
  }
  return out;
}
