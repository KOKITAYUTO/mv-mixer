'use strict';
function stemGain(stem,x,hasMixed){return (stem.automation?StemCurves.evaluate(stem.automation,x):M.gain(stem.group,x,p().curve,hasMixed))*stem.level;}
function openCurve(stem){
  const dialog=document.querySelector('#curveDialog');
  let points=structuredClone(stem.automation||[0,.5,1].map(x=>({x,y:M.gain(stem.group,x,p().curve,p().stems.some(s=>s.group==='mixed')),h:[0,0,1,1]}))),selectedPoint=0,drag=null;
  const plot=dialog.querySelector('canvas'),c=plot.getContext('2d'),list=dialog.querySelector('#pointList');
  const left=50,top=24,w=640,h=270;
  dialog.querySelector('h2').textContent=stem.file.name+' — 音量カーブ';
  const xy=ev=>{const r=plot.getBoundingClientRect();return {x:M.clamp(((ev.clientX-r.left)*plot.width/r.width-left)/w),y:M.clamp(1-((ev.clientY-r.top)*plot.height/r.height-top)/h)};};
  function draw(){
    c.clearRect(0,0,plot.width,plot.height);c.fillStyle='#111519';c.fillRect(0,0,plot.width,plot.height);c.font='12px sans-serif';
    for(let i=0;i<=10;i++){c.strokeStyle='#303842';c.beginPath();c.moveTo(left+i*w/10,top);c.lineTo(left+i*w/10,top+h);c.stroke();}
    for(let i=0;i<=4;i++){const y=top+h*i/4;c.strokeStyle='#303842';c.beginPath();c.moveTo(left,y);c.lineTo(left+w,y);c.stroke();c.fillStyle='#b6c0cc';c.fillText((100-i*25)+'%',4,y+4);}
    c.fillStyle='#b6c0cc';c.fillText('人間 0%',left,320);c.fillText('混合 50%',left+w/2-25,320);c.fillText('100% アンドロイド',left+w-105,320);
    c.strokeStyle='#d8e7eb';c.lineWidth=2;c.beginPath();for(let i=0;i<=400;i++){const x=i/400,y=StemCurves.evaluate(points,x);i?c.lineTo(left+x*w,top+(1-y)*h):c.moveTo(left+x*w,top+(1-y)*h);}c.stroke();
    points.forEach((q,i)=>{c.fillStyle=i===selectedPoint?'#ffbd7c':'#91d6e9';c.beginPath();c.arc(left+q.x*w,top+(1-q.y)*h,7,0,Math.PI*2);c.fill();});
    const a=points[selectedPoint],b=points[selectedPoint+1];
    if(b){const handles=a.h||StemCurves.presets.linear;for(let i=0;i<2;i++){const x=a.x+(b.x-a.x)*handles[i*2],y=a.y+(b.y-a.y)*handles[i*2+1];const anchor=i?b:a;c.strokeStyle='#b68fd1';c.beginPath();c.moveTo(left+anchor.x*w,top+(1-anchor.y)*h);c.lineTo(left+x*w,top+(1-y)*h);c.stroke();c.fillStyle='#b68fd1';c.fillRect(left+x*w-5,top+(1-y)*h-5,10,10);}}
    list.replaceChildren(...points.map((q,i)=>new Option(`${i+1}：位置 ${Math.round(q.x*100)}% / 音量 ${Math.round(q.y*100)}%`,i)));list.value=selectedPoint;
    dialog.querySelector('#pointX').value=Math.round(a.x*1000)/10;dialog.querySelector('#pointY').value=Math.round(a.y*1000)/10;
    dialog.querySelector('#pointX').disabled=selectedPoint===0||selectedPoint===points.length-1;
    dialog.querySelector('#deletePoint').disabled=selectedPoint===0||selectedPoint===points.length-1;
    dialog.querySelectorAll('[data-h]').forEach((input,i)=>{input.disabled=!b;input.value=(a.h||StemCurves.presets.linear)[i];});
  }
  function movePoint(x,y){const q=points[selectedPoint];if(selectedPoint>0&&selectedPoint<points.length-1)q.x=M.clamp(x,points[selectedPoint-1].x+.005,points[selectedPoint+1].x-.005);q.y=M.clamp(y);draw();}
  plot.onpointerdown=ev=>{const q=xy(ev),a=points[selectedPoint],b=points[selectedPoint+1];drag=null;
    if(!points.some(p=>Math.hypot((q.x-p.x)*w,(q.y-p.y)*h)<9)&&b&&Math.abs(b.y-a.y)>.0001){for(let i=0;i<2;i++){const v=a.h||StemCurves.presets.linear;if(Math.hypot((q.x-(a.x+(b.x-a.x)*v[i*2]))*w,(q.y-(a.y+(b.y-a.y)*v[i*2+1]))*h)<12)drag={handle:i};}}
    if(!drag){const i=points.findIndex(p=>Math.hypot((q.x-p.x)*w,(q.y-p.y)*h)<14);if(i<0)return;selectedPoint=i;drag={point:true};}plot.setPointerCapture(ev.pointerId);draw();};
  plot.onpointermove=ev=>{if(!drag)return;const q=xy(ev);if(drag.point)movePoint(q.x,q.y);else{const a=points[selectedPoint],b=points[selectedPoint+1];a.h=[...(a.h||StemCurves.presets.linear)];a.h[drag.handle*2]=M.clamp((q.x-a.x)/(b.x-a.x));a.h[drag.handle*2+1]=M.clamp((q.y-a.y)/(b.y-a.y));draw();}};
  plot.onpointerup=plot.onpointercancel=()=>drag=null;
  list.onchange=()=>{selectedPoint=Number(list.value);draw();};
  dialog.querySelector('#pointX').onchange=ev=>movePoint(Number(ev.target.value)/100,points[selectedPoint].y);
  dialog.querySelector('#pointY').onchange=ev=>movePoint(points[selectedPoint].x,Number(ev.target.value)/100);
  dialog.querySelectorAll('[data-h]').forEach((input,i)=>input.onchange=()=>{const a=points[selectedPoint];a.h=[...(a.h||StemCurves.presets.linear)];a.h[i]=M.clamp(Number(input.value)||0);draw();});
  dialog.querySelectorAll('[data-preset]').forEach(btn=>btn.onclick=()=>{points[selectedPoint].h=[...StemCurves.presets[btn.dataset.preset]];draw();});
  dialog.querySelector('#addPoint').onclick=()=>{if(points.length>=16)return;let i=Math.min(selectedPoint,points.length-2);const x=(points[i].x+points[i+1].x)/2;if(points[i+1].x-points[i].x<.02)return;points.splice(i+1,0,{x,y:StemCurves.evaluate(points,x),h:[0,0,1,1]});selectedPoint=i+1;draw();};
  dialog.querySelector('#deletePoint').onclick=()=>{if(selectedPoint>0&&selectedPoint<points.length-1){points.splice(selectedPoint,1);selectedPoint--;draw();}};
  dialog.querySelector('#applyCurve').onclick=()=>{stem.automation=points;updateGains();audioNotice();renderUI();dialog.close();};
  dialog.querySelector('#resetCurve').onclick=()=>{delete stem.automation;updateGains();renderUI();dialog.close();};
  dialog.querySelector('#cancelCurve').onclick=()=>dialog.close();draw();dialog.showModal();
}
