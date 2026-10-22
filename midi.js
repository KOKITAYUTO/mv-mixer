/* One-way USB MIDI input. No SysEx, output, or motor-fader commands. */
(()=>{
  'use strict';
  const el=id=>document.getElementById(id), key='between-midi-v1';
  let access=null, learning=false, pending=false, bound=new Map();
  let config={device:'',channel:null,cc:null,invert:false};
  try{const c=JSON.parse(localStorage.getItem(key));if(c&&typeof c.device==='string'&&(c.channel===null||Number.isInteger(c.channel)&&c.channel>=0&&c.channel<16)&&(c.cc===null||Number.isInteger(c.cc)&&c.cc>=0&&c.cc<120))config={device:c.device,channel:c.channel,cc:c.cc,invert:!!c.invert};}catch{}
  el('midiInvert').checked=config.invert;
  function say(s){el('midiStatus').textContent=s;}
  function save(){try{localStorage.setItem(key,JSON.stringify(config));}catch{say('機器設定を保存できません。次回は再登録してください。');}}
  function label(){el('midiValue').textContent=config.cc===null?'未登録':`登録：Ch ${config.channel+1} / CC ${config.cc}`;}
  function receive(event){
    if(busy||!access||event.target.id!==config.device||event.target.state!=='connected')return;
    const d=event.data;
    if(!d||d.length!==3||(d[0]&0xf0)!==0xb0||d[1]>=120||d[2]>127)return;
    const channel=d[0]&15,cc=d[1],value=d[2];
    if(learning){config.channel=channel;config.cc=cc;learning=false;el('midiLearn').textContent='フェーダーを登録';say('登録しました。実物のフェーダーで映像と音楽を操作できます。');save();}
    if(channel!==config.channel||cc!==config.cc)return;
    let x=value/127;if(config.invert)x=1-x;
    setMix(x);
    el('midiValue').textContent=`受信：Ch ${channel+1} / CC ${cc} / 値 ${value} → ${Math.round(x*100)}%`;
  }
  function refresh(){
    learning=false;el('midiLearn').textContent='フェーダーを登録';
    for(const port of bound.values())port.removeEventListener('midimessage',receive);bound.clear();
    const select=el('midiInput');select.replaceChildren(new Option('入力機器を選択',''));
    for(const port of access.inputs.values())if(port.state==='connected'){
      select.add(new Option(port.name||port.id,port.id));port.addEventListener('midimessage',receive);bound.set(port.id,port);
    }
    if(config.device&&!bound.has(config.device))select.add(new Option('登録した機器は未接続',config.device));
    select.value=config.device;
    if(!bound.size)say('MIDI入力機器が見つかりません。USB接続・電源・MIDIモードを確認してください。');
    else if(config.device&&!bound.has(config.device))say('登録機器が切断されています。再接続すると操作を再開できます。');
    else if(!config.device)say('入力機器を選んで「フェーダーを登録」を押してください。');
    else say(config.cc===null?'接続済み。「フェーダーを登録」を押して実物のフェーダーを動かしてください。':'登録した機器に接続しました。実物のフェーダーを動かしてください。');
    label();
  }
  el('midiConnect').onclick=async()=>{
    if(pending)return;
    if(!navigator.requestMIDIAccess){say('このブラウザーではMIDIを利用できません。ChromeまたはEdgeで開いてください。');return;}
    if(!window.isSecureContext){say('MIDIには安全な実行環境が必要です。ローカルのindex.htmlをChromeで直接開いてください。');return;}
    pending=true;el('midiConnect').disabled=true;
    try{if(!access){access=await navigator.requestMIDIAccess({sysex:false});access.onstatechange=refresh;}refresh();}
    catch(e){say(e.name==='NotAllowedError'?'MIDIへのアクセスが許可されませんでした。ブラウザーの権限設定を確認し、再度接続してください。':'MIDIを開始できませんでした：'+e.message);}
    finally{pending=false;el('midiConnect').disabled=false;}
  };
  el('midiInput').onchange=()=>{config.device=el('midiInput').value;config.channel=null;config.cc=null;learning=false;el('midiLearn').textContent='フェーダーを登録';label();say('「フェーダーを登録」を押して、割り当てたい実物のフェーダーだけを動かしてください。');save();};
  el('midiLearn').onclick=()=>{
    if(!access||!bound.has(config.device)){say('先にMIDI機器に接続し、入力機器を選んでください。');return;}
    learning=!learning;el('midiLearn').textContent=learning?'登録をキャンセル':'フェーダーを登録';say(learning?'登録待ち：割り当てたいフェーダーだけを動かしてください。最初のCC信号を登録します。':'登録をキャンセルしました。以前の割り当てを維持します。');
  };
  el('midiClear').onclick=()=>{learning=false;config.channel=null;config.cc=null;el('midiLearn').textContent='フェーダーを登録';label();say('割り当てを解除しました。画面のフェーダーは引き続き使えます。');save();};
  el('midiInvert').onchange=()=>{config.invert=el('midiInvert').checked;save();say('次のMIDI入力から方向設定を反映します。');};
  label();
})();
