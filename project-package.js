(function(root){
'use strict';
const MAGIC='MVMIX001',MAX=2*1024*1024*1024,HEADER=4*1024*1024;
const fail=()=>{throw Error('プロジェクトファイルの形式が不正です。');};
function validate(data,count){
 if(!data||data.version!==1||!Array.isArray(data.projects)||data.projects.length!==3||!Number.isInteger(data.selected)||data.selected<0||data.selected>2)fail();
 const num=(v,a,b)=>{if(!Number.isFinite(v)||v<a||v>b)fail();return v;};
 const ref=id=>{if(!Number.isInteger(id)||id<0||id>=count)fail();return id;};
 const validSlots=['human','mixed','android','background','humanChar','androidChar','lyrics'];
 return {version:1,selected:data.selected,projects:data.projects.map(p=>{
  if(!p||!['triptych','layers'].includes(p.mode)||!['linear','power'].includes(p.curve)||typeof p.loop!=='boolean'||!p.videos||Array.isArray(p.videos)||!Array.isArray(p.stems)||p.stems.length>128)fail();
  const videos={};for(const [key,value]of Object.entries(p.videos)){if(!validSlots.includes(key))fail();videos[key]=ref(value);}
  const stems=p.stems.map(s=>{if(!s||!['human','mixed','android','common'].includes(s.group))fail();const stem={file:ref(s.file),group:s.group,level:num(s.level,0,1)};
   if(s.automation){if(!Array.isArray(s.automation)||s.automation.length<2||s.automation.length>16)fail();let previous=-1;stem.automation=s.automation.map(q=>{if(!q||q.x<=previous)fail();previous=q.x;const h=q.h||[0,0,1,1];if(!Array.isArray(h)||h.length!==4)fail();return {x:num(q.x,0,1),y:num(q.y,0,1),h:h.map(v=>num(v,0,1))};});if(stem.automation[0].x!==0||stem.automation.at(-1).x!==1)fail();}
   return stem;});
  return {mode:p.mode,curve:p.curve,smooth:num(p.smooth,0,3000),volume:num(p.volume,0,100),mix:num(p.mix,0,1),loop:p.loop,videos,stems};
 })};
}
async function pack(projects,selected){
 const blobs=[],files=[],refs=new Map();let offset=0;
 const add=file=>{if(!(file instanceof Blob))fail();if(refs.has(file))return refs.get(file);const id=files.length;refs.set(file,id);files.push({name:file.name||'media',type:file.type||'application/octet-stream',size:file.size,offset,lastModified:file.lastModified||0});offset+=file.size;blobs.push(file);return id;};
 const data={version:1,selected,projects:projects.map(p=>({...p,videos:Object.fromEntries(Object.entries(p.videos).map(([k,f])=>[k,add(f)])),stems:p.stems.map(s=>({...s,file:add(s.file)}))}))};
 const clean=validate(data,files.length);const json=new TextEncoder().encode(JSON.stringify({...clean,files,createdAt:new Date().toISOString()}));if(json.length>HEADER||offset+json.length+12>MAX)throw Error('共有ファイルは2GB以下にしてください。');
 const header=new Uint8Array(12);header.set(new TextEncoder().encode(MAGIC));new DataView(header.buffer).setUint32(8,json.length,true);return new Blob([header,json,...blobs],{type:'application/octet-stream'});
}
async function unpack(blob){
 if(blob.size<12||blob.size>MAX)fail();const bytes=await blob.slice(0,12).arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,8))!==MAGIC)fail();const size=new DataView(bytes).getUint32(8,true);if(size>HEADER||size+12>blob.size)fail();
 let data;try{data=JSON.parse(await blob.slice(12,12+size).text());}catch{fail();}if(!Array.isArray(data.files)||data.files.length>405)fail();
 let end=0;for(const f of data.files){if(!f||typeof f.name!=='string'||!f.name.length||f.name.length>1024||typeof f.type!=='string'||f.type.length>256||!Number.isSafeInteger(f.size)||f.size<0||f.offset!==end||!Number.isFinite(f.lastModified))fail();end+=f.size;}
 if(end!==blob.size-12-size)fail();const clean=validate(data,data.files.length);const files=data.files.map(f=>new File([blob.slice(12+size+f.offset,12+size+f.offset+f.size)],f.name,{type:f.type,lastModified:f.lastModified}));
 for(const p of clean.projects){p.videos=Object.fromEntries(Object.entries(p.videos).map(([k,i])=>[k,files[i]]));p.stems=p.stems.map(s=>({...s,file:files[s.file]}));}return clean;
}
root.MVPackage={pack,unpack,MAX};
})(globalThis);
