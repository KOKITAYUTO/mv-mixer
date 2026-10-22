'use strict';
const $=s=>document.querySelector(s), M=MixerMath;
const titles=['恋人','ライバル','家族'], english=['LOVERS','RIVALS','FAMILY'];
const fresh=()=>({mode:'triptych',videos:{},stems:[],curve:'linear',smooth:250,volume:65,mix:.5,loop:true});
let projects=[fresh(),fresh(),fresh()], selected=0, media={}, decoded=[], urls=[], ctx=null, master=null, compressor=null, sources=[];
let running=false,busy=false,offset=0,started=0,total=60,target=.5,actual=.5,lastFrame=performance.now(),audioMix=.5,exhibition=false;
const canvas=$('#screen'),g=canvas.getContext('2d');
const ambient=$('#ambient'),ambientContext=ambient.getContext('2d');
let lastAmbient=0;
const p=()=>projects[selected];
const slotNames={human:'人間 MV',mixed:'混合 MV',android:'アンドロイド MV',background:'共通背景',humanChar:'人間キャラ（透過）',androidChar:'アンドロイドキャラ（透過）',lyrics:'共通歌詞（透過）'};
function slots(){return p().mode==='triptych'?['human','mixed','android']:['background','humanChar','androidChar','lyrics'];}
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function audioContext(){if(!ctx){ctx=new AudioContext();master=ctx.createGain();compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-3;compressor.knee.value=0;compressor.ratio.value=20;master.connect(compressor).connect(ctx.destination);}master.gain.value=document.querySelector("#wwiseMute")?.checked?0:p().volume/100;return ctx;}
function now(){return running?M.clamp(offset+ctx.currentTime-started,0,total):offset;}
function stopSources(){for(const s of sources){try{s.source.stop();}catch{}s.source.disconnect();s.gain.disconnect();}sources=[];}
function pause(){if(running)offset=now();running=false;stopSources();Object.values(media).forEach(m=>{if(m instanceof HTMLVideoElement)m.pause();});$('#play').textContent='▶ 再生';}
function dispose(){pause();Object.values(media).forEach(m=>{if(m instanceof HTMLVideoElement){m.removeAttribute('src');m.load();}});urls.forEach(URL.revokeObjectURL);urls=[];media={};decoded=[];}
function lock(value){busy=value;document.querySelectorAll('aside button, aside input, aside select, #themes button, #play, #reset, #seek').forEach(e=>e.disabled=value);}
async function task(fn){if(busy)return;lock(true);try{await fn();}catch(e){pause();status(e.message||String(e),true);}finally{lock(false);}}
async function loadMedia(file){
  const url=URL.createObjectURL(file);urls.push(url);
  const image=file.type.startsWith('image/')||/\.(png|jpe?g|webp)$/i.test(file.name);
  const el=image?new Image():document.createElement('video');
  if(!image){el.muted=true;el.playsInline=true;el.preload='auto';}
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('読み込みがタイムアウトしました：'+file.name)),30000);const event=image?'load':'loadeddata';function finish(err){clearTimeout(timer);el.removeEventListener(event,ok);el.removeEventListener('error',bad);err?reject(err):resolve();}const ok=()=>finish();const bad=()=>finish(new Error('この形式は再生できません：'+file.name));el.addEventListener(event,ok);el.addEventListener('error',bad);el.src=url;});
  if(!image){if(!Number.isFinite(el.duration)||el.duration<=0)throw Error('尺を取得できません：'+file.name);el.addEventListener('error',()=>{pause();status('映像の再生エラー：'+file.name,true);});}
  return el;
}
async function rebuild(){
  dispose();offset=0;status('素材を読み込み中…');
  try{
    for(const key of slots())if(p().videos[key])media[key]=await loadMedia(p().videos[key]);
    if(p().stems.length){audioContext();for(const stem of p().stems){let buffer;try{buffer=await ctx.decodeAudioData(await stem.file.arrayBuffer());}catch{throw Error('音声を読み込めません：'+stem.file.name);}decoded.push({stem,buffer});}}
    const lengths=[...Object.values(media).filter(m=>m instanceof HTMLVideoElement).map(m=>m.duration),...decoded.map(d=>d.buffer.duration)];
    total=M.duration(lengths);$('#seek').max=total;
    const missing=slots().filter(k=>!media[k]);
    const warnings=[];
    if(p().mode==='triptych'&&Object.keys(media).length&&missing.length)warnings.push('未登録：'+missing.map(k=>slotNames[k]).join('・')+'（その視点は黒画面）');
    if(lengths.length&&Math.max(...lengths)-total>.1)warnings.push('尺が異なるため最短 '+format(total)+' で終了');
    if(Object.keys(media).length&&!decoded.length)warnings.push('音声未登録（無音）');
    status(warnings.length?warnings.join(' ／ '):Object.keys(media).length||decoded.length?'素材を読み込みました。再生できます。':'素材未登録：無音のデモ映像です。');
  }catch(e){dispose();total=60;$('#seek').max=60;throw e;}
  renderUI();
}
function renderUI(){
  $('#wwiseMix').value=p().wwiseMix||'MV_Mix';$('#mode').value=p().mode;$('#curve').value=p().curve;$('#smooth').value=p().smooth;$('#volume').value=p().volume;$('#loop').checked=p().loop;
  $('#stageTheme').textContent=String(selected+1).padStart(2,'0')+' / '+english[selected];
  document.querySelectorAll('[data-theme]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.theme)===selected);b.setAttribute('aria-pressed',Number(b.dataset.theme)===selected);});
  $('#videoSlots').replaceChildren();
  for(const key of slots()){
    const row=document.createElement('div');row.className='slot';const description=document.createElement('div');const title=document.createElement('strong');title.textContent=slotNames[key];const name=document.createElement('span');name.className='filename';name.textContent=p().videos[key]?.name||'未登録';description.append(title,name);
    if(p().videos[key]){const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label',slotNames[key]+'を削除');del.onclick=()=>task(async()=>{delete p().videos[key];await rebuild();});description.append(del);}
    const label=document.createElement('label');label.append('選択');const input=document.createElement('input');input.type='file';input.accept='video/mp4,video/webm,image/png,image/jpeg,image/webp';input.setAttribute('aria-label',slotNames[key]);input.onchange=()=>{const file=input.files[0];if(file)task(async()=>{const old=p().videos[key];p().videos[key]=file;try{await rebuild();}catch(e){if(old)p().videos[key]=old;else delete p().videos[key];await rebuild();throw e;}});};label.append(input);row.append(description,label);$('#videoSlots').append(row);
  }
  $('#stems').replaceChildren();
  for(const stem of p().stems){const row=document.createElement('div');row.className='stem';const name=document.createElement('div');name.className='name';name.textContent=stem.file.name;const controls=document.createElement('div');controls.className='stem-controls';const group=document.createElement('select');group.setAttribute('aria-label',stem.file.name+' の役割');for(const [value,text] of Object.entries({common:'共通（固定）',human:'人間（左）',mixed:'混合（中央）',android:'アンドロイド（右）'})){const opt=new Option(text,value);group.add(opt);}group.value=stem.group;group.onchange=()=>{stem.group=group.value;updateGains();audioNotice();};const gain=document.createElement('input');gain.type='range';gain.min=0;gain.max=100;gain.value=stem.level*100;gain.setAttribute('aria-label',stem.file.name+' の音量');gain.oninput=()=>{stem.level=Number(gain.value)/100;updateGains();};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label',stem.file.name+'を削除');del.onclick=()=>task(async()=>{p().stems=p().stems.filter(s=>s!==stem);await rebuild();});controls.append(group,gain,del);const meter=document.createElement('meter');meter.min=0;meter.max=1;meter.className='stem-meter';meter.setAttribute('aria-label',stem.file.name+' の適用音量');const readout=document.createElement('div');readout.className='gain-readout';const edit=document.createElement('button');edit.textContent=stem.automation?'カーブを編集（設定済み）':'音量カーブを編集';edit.onclick=()=>openCurve(stem);const rtpc=document.createElement('input');rtpc.type='text';rtpc.placeholder='Wwise楽器RTPC名（任意）';rtpc.value=stem.rtpc||'';rtpc.setAttribute('aria-label',stem.file.name+' のWwise RTPC名');rtpc.onchange=()=>{stem.rtpc=rtpc.value.trim();};rtpc.className='rtpc-name';row.append(name,controls,meter,readout,edit,rtpc);$('#stems').append(row);}
  $('#modeBadge').textContent=Object.keys(media).length?'LOCAL MEDIA':'DEMO';$('#demoLabel').hidden=!!Object.keys(media).length;$('#demoLabel').textContent=decoded.length?'映像未登録・デモ映像':'素材未登録・無音デモ';
  setMix(p().mix,true);audioNotice();
}
function setMix(x,immediate=false){target=M.clamp(x);p().mix=target;$('#fader').value=target*1000;if(immediate)actual=target;$('#mixReadout').textContent=M.percentages(target).join(' / ');}
function updateGains(){if(!ctx)return;const mixed=decoded.some(d=>d.stem.group==='mixed');for(const s of sources){const v=stemGain(s.stem,actual,mixed);s.gain.gain.setTargetAtTime(v,ctx.currentTime,.015);}audioMix=actual;}
async function seekMedia(t){await Promise.all(Object.values(media).filter(m=>m instanceof HTMLVideoElement).map(m=>new Promise((resolve,reject)=>{if(Math.abs(m.currentTime-t)<.01&&m.readyState>=2)return resolve();const timer=setTimeout(()=>done(new Error('映像のシークがタイムアウトしました')),10000);function done(err){clearTimeout(timer);m.removeEventListener('seeked',ok);m.removeEventListener('error',bad);err?reject(err):resolve();}const ok=()=>done();const bad=()=>done(new Error('映像のシークに失敗しました'));m.addEventListener('seeked',ok);m.addEventListener('error',bad);m.currentTime=t;})));}
async function play(){
  if(running)return pause();audioContext();await ctx.resume();if(ctx.state!=='running')throw Error('音声の再生を開始できません。再生ボタンをもう一度押してください。');
  if(offset>=total-.02)offset=0;await seekMedia(offset);
  const videos=Object.values(media).filter(m=>m instanceof HTMLVideoElement);
  try{await Promise.all(videos.map(v=>v.play()));}catch{videos.forEach(v=>v.pause());throw Error('映像を開始できません。素材の形式を確認してください。');}
  started=ctx.currentTime;running=true;
  const mixed=decoded.some(d=>d.stem.group==='mixed');
  for(const d of decoded){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=d.buffer;gain.gain.value=stemGain(d.stem,actual,mixed);source.connect(gain).connect(master);source.start(started,offset);sources.push({source,gain,stem:d.stem});}
  $('#play').textContent='Ⅱ 一時停止';status('再生中 · '+titles[selected]+(decoded.length?'':' · 無音'));if(exhibition)requestWake();
}
async function jump(t){const was=running;pause();offset=M.clamp(t,0,total);await seekMedia(offset);if(was&&offset<total)await play();}
function format(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');}
function fit(image,alpha=1,composite='source-over',extendEdges=false){
  if(alpha<=0)return;
  const w=image.videoWidth||image.naturalWidth,h=image.videoHeight||image.naturalHeight;if(!w||!h)return;
  const scale=Math.min(canvas.width/w,canvas.height/h),dw=w*scale,dh=h*scale;
  const x=(canvas.width-dw)/2,y=(canvas.height-dh)/2;
  g.save();g.globalAlpha=alpha;g.globalCompositeOperation=composite;
  // Fill only the letterbox area; never brighten or crop the original MV.
  if(extendEdges&&(x>.1||y>.1)){
    g.save();g.beginPath();
    if(x>.1){g.rect(0,0,x,canvas.height);g.rect(x+dw,0,x,canvas.height);}
    if(y>.1){g.rect(0,0,canvas.width,y);g.rect(0,y+dh,canvas.width,y);}
    g.clip();g.filter='blur(24px) brightness(0.65)';
    // Repeat edge strips outward, not a second copy of the full picture.
    if(x>.1){const strip=Math.max(1,w*.04);g.drawImage(image,0,0,strip,h,-40,-40,x+80,canvas.height+80);g.drawImage(image,w-strip,0,strip,h,x+dw-40,-40,x+80,canvas.height+80);}
    if(y>.1){const strip=Math.max(1,h*.04);g.drawImage(image,0,0,w,strip,-40,-40,canvas.width+80,y+80);g.drawImage(image,0,h-strip,w,strip,-40,y+dh-40,canvas.width+80,y+80);}
    g.restore();
  }
  g.drawImage(image,x,y,dw,dh);g.restore();
}
function demo(t){
  const bg=g.createLinearGradient(0,0,1280,720);bg.addColorStop(0,'#322c31');bg.addColorStop(.5,'#171e2a');bg.addColorStop(1,'#173446');g.fillStyle=bg;g.fillRect(0,0,1280,720);
  g.strokeStyle='#ffffff09';g.lineWidth=1;for(let x=0;x<1280;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,720);g.stroke();}for(let y=0;y<720;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(1280,y);g.stroke();}
  const visual=M.visualPosition(actual);
  const motion=Math.sin(t*.35)*30, humanAlpha=M.clamp(2*(1-visual)),aiAlpha=M.clamp(2*visual);
  const orb=(x,y,color,a,angular)=>{g.save();g.globalAlpha=a;g.shadowColor=color;g.shadowBlur=60;g.strokeStyle=color;g.lineWidth=2;g.beginPath();if(angular){for(let i=0;i<=6;i++){const angle=i*Math.PI/3+t*.08;const px=x+Math.cos(angle)*110,py=y+Math.sin(angle)*110;i?g.lineTo(px,py):g.moveTo(px,py);}}else g.ellipse(x,y,100+Math.sin(t)*4,118,Math.sin(t*.2)*.1,0,Math.PI*2);g.stroke();g.shadowBlur=0;g.beginPath();g.arc(x,y,76,0,Math.PI*2);g.strokeStyle=color+'55';g.stroke();g.restore();};
  orb(490+motion,325,'#f3b68e',humanAlpha,false);orb(790-motion,325,'#8ad4fa',aiAlpha,true);
}
let lastSync=0;
function frame(stamp){
  const dt=Math.min((stamp-lastFrame)/1000,.1);lastFrame=stamp;const tau=p().smooth/1000;actual=tau?actual+(target-actual)*(1-Math.exp(-dt/tau)):target;if(Math.abs(actual-target)<.0001)actual=target;
  if(Math.abs(actual-audioMix)>.00001)updateGains();const t=now();
  g.globalAlpha=1;g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,1280,720);
  if(!Object.keys(media).length)demo(t);else if(p().mode==='triptych'){const w=M.visualWeights(actual);['human','mixed','android'].forEach((key,i)=>{if(media[key])fit(media[key],w[i],'lighter',true);});}else{const visual=M.visualPosition(actual);if(media.background)fit(media.background,1,'source-over',true);if(media.humanChar)fit(media.humanChar,M.clamp(2*(1-visual)));if(media.androidChar)fit(media.androidChar,M.clamp(2*visual));if(media.lyrics)fit(media.lyrics);}
  if(stamp-lastAmbient>=80){ambientContext.drawImage(canvas,0,0,ambient.width,ambient.height);lastAmbient=stamp;}
  $('#time').textContent=format(t)+' / '+format(total);if(!$('#seek').matches(':active'))$('#seek').value=t;
  if(running&&t>=total-.015&&!busy){task(async()=>{pause();offset=0;if(p().loop)await play();else{offset=total;status('再生が終了しました。');}});}
  if(running&&stamp-lastSync>100){lastSync=stamp;for(const v of Object.values(media).filter(m=>m instanceof HTMLVideoElement)){if(v.readyState<2||v.ended&&t<total-.2){pause();status('映像の読み込みが追いつかないため停止しました。素材の解像度・形式を確認し、再生を押してください。',true);break;}if(Math.abs(v.currentTime-t)>.08&&!v.seeking)v.currentTime=t;else v.playbackRate=Math.abs(v.currentTime-t)<.025?1:v.currentTime<t?1.02:.98;}}
  renderAudioLevels();requestAnimationFrame(frame);
}
$('#play').onclick=()=>task(play);$('#reset').onclick=()=>task(()=>jump(0));$('#seek').onchange=()=>task(()=>jump(Number($('#seek').value)));$('#fader').oninput=()=>setMix(Number($('#fader').value)/1000);
document.querySelectorAll('[data-mix]').forEach(b=>b.onclick=()=>setMix(Number(b.dataset.mix)));
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>task(async()=>{pause();selected=Number(b.dataset.theme);await rebuild();}));
$('#mode').onchange=()=>task(async()=>{p().mode=$('#mode').value;await rebuild();});
$('#curve').onchange=()=>{p().curve=$('#curve').value;updateGains();};$('#smooth').onchange=()=>{$('#smooth').value=p().smooth=M.clamp(Number($('#smooth').value)||0,0,3000);};$('#volume').oninput=()=>{p().volume=Number($('#volume').value);if(master)master.gain.setTargetAtTime(p().volume/100,ctx.currentTime,.02);};$('#loop').onchange=()=>p().loop=$('#loop').checked;
$('#addStem').onclick=()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.wav,audio/wav';input.onchange=()=>task(async()=>{const old=[...p().stems];const role=$('#addRole').value;for(const file of input.files){const group=role==='auto'?(!p().stems.some(s=>s.group==='human')?'human':!p().stems.some(s=>s.group==='android')?'android':'common'):role;p().stems.push({file,group,level:.7});}try{await rebuild();}catch(e){p().stems=old;await rebuild();throw e;}});input.click();};

function audioNotice(){
  const stems=p().stems, allCommon=stems.length>0&&stems.every(s=>s.group==='common'&&!s.automation);
  $('#repairPair').hidden=!(allCommon&&stems.length===2);
  $('#audioNotice').className=allCommon?'audio-warning':'audio-info';
  $('#audioNotice').textContent=stems.some(s=>s.automation)?'個別カーブ設定済みの楽器は、役割と全体フェードより個別カーブを優先します。':allCommon?'すべて「共通」のため、フェーダーでは音量が変わりません。切り替える音声を「人間」と「アンドロイド」に設定してください。':stems.some(s=>s.group==='mixed')?'3点フェード：中央は「混合」と「共通」のみ鳴ります。':stems.length?'2点フェード：左で人間、右でアンドロイド。「共通」は一定です。':'';
}
function renderAudioLevels(){
  const mixed=p().stems.some(s=>s.group==='mixed');
  document.querySelectorAll('#stems .stem').forEach((row,i)=>{
    const stem=p().stems[i];if(!stem)return;
    const source=sources.find(s=>s.stem===stem);
    const value=source?source.gain.gain.value:stemGain(stem,actual,mixed);
    row.querySelector('meter').value=value;
    row.querySelector('.gain-readout').textContent=(running?'適用音量 ':'再生時の音量 ')+Math.round(value*100)+'%'+(stem.automation?' · 個別カーブ':stem.group==='common'?' · フェーダー対象外':'')+'（マスター前）';
  });
}
$('#repairPair').onclick=()=>{
  if(busy||p().stems.length!==2||!p().stems.every(s=>s.group==='common'))return;
  p().stems[0].group='human';p().stems[1].group='android';
  const position=actual;renderUI();actual=position;updateGains();
  status('上の音声を人間、下の音声をアンドロイドに設定しました。フェーダーで切り替えられます。');
};

$('#clear').onclick=()=>{if(confirm(titles[selected]+'の登録素材と設定をリセットします。保存済みデータは「このPCに保存」を押すまで変更されません。'))task(async()=>{projects[selected]=fresh();await rebuild();});};
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open('between-mv-mixer',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('保存領域を開けません。このブラウザーの保存設定を確認してください。'));});}
async function dbAction(write){const db=await dbOpen();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('projects',write?'readwrite':'readonly');const store=tx.objectStore('projects');const req=write?store.put({version:1,projects,selected},'show'):store.get('show');tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(new Error('保存／復元に失敗しました。空き容量とブラウザーの設定を確認してください。'));});}finally{db.close();}}
$('#save').onclick=()=>task(async()=>{await dbAction(true);status('3テーマの素材と設定をこのPCのブラウザーに保存しました。');});
$('#restore').onclick=()=>task(async()=>{const data=await dbAction(false);if(!data)return status('保存済みの展示データがありません。');if(data.version!==1||data.projects.length!==3)throw Error('保存データの形式が異なります。');pause();projects=data.projects;selected=data.selected;await rebuild();status('保存済みの3テーマを復元しました。');});
let wake=null;
async function requestWake(){try{if('wakeLock' in navigator&&!wake){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>wake=null);}}catch{}}
async function showExhibit(value){exhibition=value;document.body.classList.toggle('exhibition',value);if(value)revealExhibitControls();else clearTimeout(exhibitHideTimer);if(value){try{await document.documentElement.requestFullscreen();}catch{}requestWake();}else{if(document.fullscreenElement)await document.exitFullscreen();if(wake){await wake.release();wake=null;}}}
$('#exhibit').onclick=()=>showExhibit(true);$('#exitExhibit').onclick=()=>showExhibit(false);document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&exhibition){exhibition=false;document.body.classList.remove('exhibition');if(wake)wake.release();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();status('画面が非表示になったため停止しました。展示時はこの画面を前面にしてください。');}if(!document.hidden&&exhibition)requestWake();});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea,button')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();task(play);}if(e.key==='ArrowLeft'){e.preventDefault();setMix(target-.025);}if(e.key==='ArrowRight'){e.preventDefault();setMix(target+.025);}if(['1','2','3'].includes(e.key))setMix((Number(e.key)-1)/2);if(e.key.toLowerCase()==='f')showExhibit(!exhibition);if(e.key==='Escape'&&exhibition)showExhibit(false);});
renderUI();requestAnimationFrame(frame);

// Exhibition controls overlay the picture and do not reserve video space.
let exhibitHideTimer;
function revealExhibitControls(){
  if(!exhibition)return;
  document.body.classList.add('controls-visible');
  clearTimeout(exhibitHideTimer);
  exhibitHideTimer=setTimeout(hideExhibitControls,2800);
}
function hideExhibitControls(){
  if(!exhibition)return;
  if(busy||document.querySelector('.transport :active, #themes :active, .transport :focus-visible, #themes :focus-visible, #exitExhibit:focus-visible')){
    exhibitHideTimer=setTimeout(hideExhibitControls,1000);return;
  }
  document.body.classList.remove('controls-visible');
}
for(const event of ['pointermove','pointerdown','keydown','focusin'])document.addEventListener(event,revealExhibitControls,{passive:true});
