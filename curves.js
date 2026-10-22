(function(root){
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x));
  const presets={linear:[0,0,1,1],easeIn:[.42,0,1,1],easeOut:[0,0,.58,1],easeInOut:[.42,0,.58,1]};
  function ease(t,h){
    t=clamp(t);if(t===0||t===1)return t;
    const bez=(u,a,b)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
    let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(bez(mid,h[0],h[2])<t)lo=mid;else hi=mid;}
    return clamp(bez((lo+hi)/2,h[1],h[3]));
  }
  function evaluate(points,x){
    x=clamp(x);if(x<=points[0].x)return points[0].y;
    for(let i=1;i<points.length;i++)if(x<=points[i].x){const a=points[i-1],b=points[i];return clamp(a.y+(b.y-a.y)*ease((x-a.x)/(b.x-a.x),a.h||presets.linear));}
    return points[points.length-1].y;
  }
  const api={presets,ease,evaluate};root.StemCurves=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
