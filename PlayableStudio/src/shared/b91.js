// base91 变种：字母表去掉了 " \ < （可直接放进 JS 双引号字符串、所以不会出现脚本结束标签），体积开销约 23%，比 base64 的 33% 少。
const AL=(()=>{ let s=''; for(let c=33;c<=126;c++){ const ch=String.fromCharCode(c); if(ch!=='"'&&ch!=='\\'&&ch!=='<') s+=ch; } return s; })();
export function b91enc(u8){
  let b=0,n=0,out=''; 
  for(let i=0;i<u8.length;i++){ b|=u8[i]<<n; n+=8; if(n>13){ let v=b&8191; if(v>88){ b>>=13; n-=13; } else { v=b&16383; b>>=14; n-=14; } out+=AL[v%91]+AL[(v/91)|0]; } }
  if(n){ out+=AL[b%91]; if(n>7||b>90) out+=AL[(b/91)|0]; }
  return out;
}
export function b91dec(str){
  const T=b91dec.T||(b91dec.T=(()=>{ const t=new Int16Array(128).fill(-1); for(let i=0;i<AL.length;i++) t[AL.charCodeAt(i)]=i; return t; })());
  const out=new Uint8Array(Math.ceil(str.length*14/16)+2); let o=0,v=-1,b=0,n=0;
  for(let i=0;i<str.length;i++){ const d=T[str.charCodeAt(i)]; if(d<0) continue;
    if(v<0) v=d; else { v+=d*91; b|=v<<n; n+=(v&8191)>88?13:14; do{ out[o++]=b&255; b>>=8; n-=8; }while(n>7); v=-1; } }
  if(v>-1) out[o++]=(b|v<<n)&255;
  return out.subarray(0,o);
}
