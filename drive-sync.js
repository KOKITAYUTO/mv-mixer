'use strict';
(()=>{
let FOLDER='';
const scope='https://www.googleapis.com/auth/drive.file',api='https://www.googleapis.com/drive/v3/files';
let token='',expires=0,client=null,config=null,folderGranted=false,working=false,authPending=false,authVersion=0,authTimer=null;
const el=id=>document.getElementById(id),say=t=>el('driveStatus').textContent=t;
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
function controls(){for(const id of ['drivePrepare','driveConnect','driveFolder','driveSave','driveLoad','driveDisconnect','packageExport','packageImport'])el(id).disabled=working||busy||(id==='driveConnect'&&!client)||(['driveFolder','driveSave','driveLoad','driveDisconnect'].includes(id)&&!token)||(id==='driveSave'&&!folderGranted);el('driveCancelAuth').hidden=!authPending;el('driveCancelAuth').disabled=!authPending;}
window.addEventListener('mv-lock-change',controls);
function finishAuth(message){clearTimeout(authTimer);authTimer=null;authPending=false;working=false;lock(false);controls();say(message);}
function tokenClient(version){return google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope,include_granted_scopes:false,error_callback:()=>{if(version!==authVersion)return;finishAuth('Google接続を完了できませんでした。ポップアップの許可を確認し、ChromeまたはEdgeで開いて再接続してください。');},callback:response=>{
 if(version!==authVersion||!authPending)return;
 if(response.error||!response.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,scope)){token='';finishAuth('Googleへの接続・アクセス許可が完了しませんでした。');}
 else{token=response.access_token;expires=Date.now()+Number(response.expires_in||3600)*1000-60000;folderGranted=false;finishAuth('Google接続済み。保存先を選択するか、共有版を読み込んでください。');}
}});}
async function operation(fn){if(working||busy)return;working=true;pause();lock(true);controls();try{await fn();}catch(e){say(e.message||String(e));}finally{working=false;lock(false);controls();}}
function requireToken(){if(!token||Date.now()>=expires){token='';folderGranted=false;controls();throw Error('Google接続の期限が切れました。「Googleに接続」を押してください。');}}
async function request(url,options={}){requireToken();const res=await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(120000)});if(res.status===401){token='';folderGranted=false;throw Error('接続の期限が切れました。Googleに再接続してください。');}if(!res.ok&&res.status!==308){throw Error(`Drive通信エラー (${res.status})。権限・容量・接続を確認してください。保存結果が不明な場合はDriveで確認してから再実行してください。`);}return res;}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Googleの接続ライブラリを読み込めません。ネット接続を確認してください。'));document.head.append(s);});}
try{const saved=JSON.parse(localStorage.getItem('mv-drive-client')||'null');if(saved){el('driveFolderId').value=saved.folderId||'';el('driveClientId').value=saved.clientId||'';el('driveApiKey').value=saved.apiKey||'';el('driveAppId').value=saved.appId||'';}}catch{}
el('drivePrepare').onclick=()=>operation(async()=>{
 config={folderId:el('driveFolderId').value.trim(),clientId:el('driveClientId').value.trim(),apiKey:el('driveApiKey').value.trim(),appId:el('driveAppId').value.trim()};
 if(!config.clientId.endsWith('.apps.googleusercontent.com')||!config.apiKey||!/^\d+$/.test(config.appId))throw Error('OAuthクライアントID・APIキー・プロジェクト番号を設定してください。');
 if(location.protocol==='file:')throw Error('Google接続はHTTPのlocalhostまたはHTTPSのサイトから開いてください。');
 if(!/^[A-Za-z0-9_-]+$/.test(config.folderId))throw Error('共有先フォルダーIDを入力してください。');FOLDER=config.folderId;token='';folderGranted=false;client=null;
 if(!window.google?.accounts)await loadScript('https://accounts.google.com/gsi/client');
 if(!window.gapi)await loadScript('https://apis.google.com/js/api.js');
 await new Promise((resolve,reject)=>gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Pickerを読み込めません。')),timeout:20000,ontimeout:()=>reject(Error('Pickerの読み込みがタイムアウトしました。'))}));
 client=tokenClient(++authVersion);
 try{localStorage.setItem('mv-drive-client',JSON.stringify(config));}catch{}say('準備完了。「Googleに接続」を押してください。');
});
el('driveConnect').onclick=()=>{if(working||busy||!client)return;pause();working=true;authPending=true;token='';folderGranted=false;const version=++authVersion;lock(true);controls();say('Googleの認証画面でアカウントと許可を確認してください。表示されない場合は「接続待ちを中止」を押し、ChromeまたはEdgeで開いてください。');authTimer=setTimeout(()=>{if(version!==authVersion)return;++authVersion;finishAuth('Google接続がタイムアウトしました。ポップアップの許可を確認し、再接続してください。');},120000);try{client=tokenClient(version);client.requestAccessToken({prompt:'select_account'});}catch(e){++authVersion;finishAuth('Google接続を開始できませんでした。ポップアップ設定を確認してください。');}};
el('driveCancelAuth').onclick=()=>{if(!authPending)return;++authVersion;finishAuth('接続待ちを中止しました。Googleの認証画面が残っている場合は閉じてください。');};
function picker(folder){requireToken();return new Promise((resolve,reject)=>{
 const view=new google.picker.DocsView(google.picker.ViewId.DOCS);
 if(!folder)view.setParent(FOLDER);
 if(folder)view.setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
 const dialog=new google.picker.PickerBuilder().setDeveloperKey(config.apiKey).setAppId(config.appId).setOAuthToken(token).setOrigin(location.origin).addView(view).setTitle(folder?'00_共有プロジェクト（素材と設定）を選択':'読み込む .mvm の版を選択').setCallback(result=>{
  if(result.action===google.picker.Action.PICKED){dialog.dispose();resolve(result.docs[0]);}
  else if(result.action===google.picker.Action.CANCEL){dialog.dispose();resolve(null);}
 }).build();dialog.setVisible(true);
});}
el('driveFolder').onclick=()=>operation(async()=>{const doc=await picker(true);if(!doc)return;if(doc.id!==FOLDER)throw Error('「I&Roid」内の「00_共有プロジェクト（素材と設定）」を選んでください。');const m=await (await request(api+'/'+encodeURIComponent(FOLDER)+'?fields=id,mimeType,capabilities')).json();if(m.mimeType!=='application/vnd.google-apps.folder'||!m.capabilities?.canAddChildren)throw Error('保存先への編集権限がありません。');folderGranted=true;say('保存先を確認しました。3テーマの素材・設定を新しい版として保存できます。');});
async function restore(blob){const data=await MVPackage.unpack(blob);if(!confirm('現在の3テーマを共有版に置き換えます。未保存の編集は失われます。続けますか？'))return false;const old=projects,oldSelected=selected;projects=data.projects;selected=data.selected;try{await rebuild();}catch(e){projects=old;selected=oldSelected;await rebuild();throw e;}return true;}
el('driveSave').onclick=()=>operation(async()=>{
 requireToken();if(!folderGranted)throw Error('保存先フォルダーを選択してください。');say('共有ファイルを準備中…');const blob=await MVPackage.pack(projects,selected);const name='I-Roid_'+stamp()+'_'+crypto.randomUUID().slice(0,8)+'.mvm';
 const begin=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,parents',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({name,mimeType:'application/octet-stream',parents:[FOLDER]})});
 const location=begin.headers.get('Location');if(!location)throw Error('アップロード先を取得できませんでした。');const u=new URL(location);if(u.protocol!=='https:'||u.hostname!=='www.googleapis.com')throw Error('Googleのアップロード先を確認できませんでした。');
 let offset=0,result;const chunk=8*1024*1024;
 while(offset<blob.size){const end=Math.min(offset+chunk,blob.size);const res=await request(location,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end)});
  if(res.status===308){const range=res.headers.get('Range'),match=/^bytes=0-(\d+)$/.exec(range||'');if(!match)throw Error('保存の進行状況を取得できません。Driveで確認してください。');const next=Number(match[1])+1;if(next<=offset||next>end)throw Error('保存の進行状況が不正です。');offset=next;}
  else{result=await res.json();offset=end;if(end!==blob.size)throw Error('アップロードが予定より早く終了しました。');}
  say('Driveへ保存中 '+Math.round(offset/blob.size*100)+'%');
 }
 if(!result?.id)throw Error('保存完了を確認できませんでした。Driveで確認してください。');const verified=await(await request(api+'/'+encodeURIComponent(result.id)+'?fields=id,name,size,parents')).json();if(Number(verified.size)!==blob.size||!verified.parents?.includes(FOLDER))throw Error('保存ファイルの確認に失敗しました。Driveで確認してください。');say('保存完了：'+verified.name+'。他の人は「Driveから読み込み」で選択できます。');
});
el('driveLoad').onclick=()=>operation(async()=>{const doc=await picker(false);if(!doc)return;const id=encodeURIComponent(doc.id);const meta=await(await request(api+'/'+id+'?fields=id,name,size,parents')).json();if(!meta.name?.endsWith('.mvm')||!meta.parents?.includes(FOLDER))throw Error('共有プロジェクトフォルダー内の .mvm を選択してください。');if(Number(meta.size)>MVPackage.MAX)throw Error('2GBを超える共有ファイルには対応していません。');say('Driveから読み込み中…');const blob=await(await request(api+'/'+id+'?alt=media')).blob();if(await restore(blob))say('読込完了：'+meta.name+'。必要なら「この端末に保存」を押してください。');else say('読み込みをキャンセルしました。');});
el('driveDisconnect').onclick=()=>{token='';expires=0;folderGranted=false;controls();say('切断しました。この画面の接続情報を破棄しました。');};
el('packageExport').onclick=()=>operation(async()=>{const blob=await MVPackage.pack(projects,selected),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='I-Roid_'+stamp()+'.mvm';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);say('共有ファイルを書き出しました。Driveへ手動アップロードして共有することもできます。');});
el('packageImport').onclick=()=>{if(working||busy)return;const input=document.createElement('input');input.type='file';input.accept='.mvm';input.onchange=()=>{if(input.files[0])operation(async()=>{if(await restore(input.files[0]))say('共有ファイルを読み込みました。必要なら「この端末に保存」を押してください。');});};input.click();};
controls();
})();
