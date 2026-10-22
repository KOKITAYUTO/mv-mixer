(function(root){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  function weights(x){x=clamp(x);return [Math.max(0,1-2*x),1-Math.abs(2*x-1),Math.max(0,2*x-1)];}
  // A visual plateau only; the audio crossfade keeps its original curve.
  function visualPosition(x){x=clamp(x);return x<.4?x/.8:x>.6?.5+(x-.6)/.8:.5;}
  function visualWeights(x){return weights(visualPosition(x));}
  function percentages(x){const android=Math.round(clamp(x)*100);return [100-android,android];}
  function gain(group,x,curve,hasMixed){
    if(group==='common')return 1;
    const w=hasMixed?weights(x):[1-clamp(x),0,clamp(x)];
    const v=w[{human:0,mixed:1,android:2}[group]]||0;
    return curve==='power'?Math.sin(v*Math.PI/2):v;
  }
  function duration(items){const ds=items.filter(v=>Number.isFinite(v)&&v>0);return ds.length?Math.min(...ds):60;}
  const api={clamp,weights,visualPosition,visualWeights,percentages,gain,duration};root.MixerMath=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
