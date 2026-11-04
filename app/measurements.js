/* Measurements integrate the actual sample times, including nonuniform grids.
   Zero-duration one-sided event pairs carry no extra integration weight. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LabMeasurements=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function nearest(data,x){
    let lo=0,hi=data.length;
    while(lo<hi){const m=(lo+hi)>>1;if(data[m].x<=x)lo=m+1;else hi=m;}
    const i=Math.max(0,lo-1);return lo<data.length&&Math.abs(data[lo].x-x)<Math.abs(data[i].x-x)?data[lo]:data[i];
  }
  function stats(data,key,start=data[0]?.x,end=data.at(-1)?.x){
    if(!data.length||!Number.isFinite(start)||!Number.isFinite(end))return null;
    const from=Math.max(data[0].x,Math.min(start,end)),to=Math.min(data.at(-1).x,Math.max(start,end));
    if(to<=from)return null;
    let area=0,square=0,covered=0,min=Infinity,max=-Infinity;
    for(const d of data)if(d.x>=from&&d.x<=to&&Number.isFinite(d[key])){min=Math.min(min,d[key]);max=Math.max(max,d[key]);}
    for(let i=1;i<data.length;i++){
      const a=data[i-1],b=data[i],left=Math.max(from,a.x),right=Math.min(to,b.x);
      if(right<=left||!Number.isFinite(a[key])||!Number.isFinite(b[key]))continue;
      const value=x=>a[key]+(b[key]-a[key])*(x-a.x)/(b.x-a.x),u=value(left),v=value(right),dt=right-left;
      area+=dt*(u+v)/2;square+=dt*(u*u+u*v+v*v)/3;covered+=dt;min=Math.min(min,u,v);max=Math.max(max,u,v);
    }
    return covered>0?{from,to,min,max,pp:max-min,mean:area/covered,rms:Math.sqrt(Math.max(0,square/covered)),coverage:covered/(to-from)}:null;
  }
  function validateBaseline(settings={},duration){
    settings??={};
    const e={},mode=settings.baselineMode??'auto';
    if(!['auto','manual','interval'].includes(mode))e.baselineMode='Modalità della baseline non valida.';
    if(mode==='manual'&&(!Number.isFinite(settings.baselineValue)||Math.abs(settings.baselineValue)>1000))e.baselineValue='Baseline ammessa: da −1000 a 1000 V.';
    if(mode==='interval'){
      if(!Number.isFinite(settings.baselineStart)||settings.baselineStart<0)e.baselineStart='Inserisci un tempo iniziale maggiore o uguale a zero.';
      if(!Number.isFinite(settings.baselineEnd)||settings.baselineEnd<=settings.baselineStart||settings.baselineEnd>duration)e.baselineEnd='Scegli un intervallo crescente contenuto nel transitorio.';
    }
    return e;
  }
  // Explicit references change derived measurements, never the original samples.
  function baseline(data,key,settings={}){
    if(settings.baselineMode==='manual')return Number.isFinite(settings.baselineValue)?{value:settings.baselineValue,index:0,label:'Baseline manuale'}:null;
    if(settings.baselineMode!=='interval')return null;
    const {baselineStart:start,baselineEnd:end}=settings;
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<data[0]?.x||end>data.at(-1)?.x)return null;
    const m=stats(data,key,start,end);
    return m&&m.coverage>=1-1e-9?{value:m.mean,index:data.indexOf(nearest(data,start)),label:'Baseline · media sull’intervallo'}:null;
  }
  function reference(data,key,wave,settings={},dc,at){
    if(settings.baselineMode&&settings.baselineMode!=='auto')return baseline(data,key,settings);
    const m=pulse(data,key,wave,at);
    return m?{value:m.baseline,index:m.baselineIndex,label:'Baseline prima dell’impulso'}:Number.isFinite(dc)?{value:dc,index:0,label:'Baseline DC · equilibrio'}:null;
  }
  // First pulse only: use the last physical sample before its onset, never an invented zero.
  function pulse(data,key,wave,at,settings={}){
    if(!data.length||wave?.kind!=='pulse'||!Number.isFinite(wave.delay))return null;
    const period=wave.period>0?wave.period:Infinity;
    if(Number.isFinite(period)&&Number.isFinite(at)&&at>=wave.delay){const cycle=Math.max(0,Math.floor((at-wave.delay)/period+1e-12));wave={...wave,delay:wave.delay+cycle*period};}
    let baselineIndex=-1;for(let i=0;i<data.length;i++){const row=data[i];if(row.x<wave.delay&&Number.isFinite(row[key]))baselineIndex=i;else if(row.x===wave.delay&&data[i+1]?.x===wave.delay&&Number.isFinite(row[key])){baselineIndex=i;break;}else if(row.x>=wave.delay)break;}
    const explicit=settings.baselineMode&&settings.baselineMode!=='auto',ref=explicit?baseline(data,key,settings):null;
    if(explicit?!ref:baselineIndex<0)return null;
    const value=explicit?ref.value:data[baselineIndex][key];let maximum=-Infinity,minimum=Infinity,maxIndex=-1,minIndex=-1;
    for(let i=baselineIndex+1;i<data.length;i++){const row=data[i];if(row.x<wave.delay)continue;if(row.x>=wave.delay+period)break;if(!Number.isFinite(row[key]))continue;if(row[key]>maximum){maximum=row[key];maxIndex=i;}if(row[key]<minimum){minimum=row[key];minIndex=i;}}
    return maxIndex<0?null:{baseline:value,baselineIndex:explicit?ref.index:baselineIndex,baselineLabel:explicit?ref.label:'Baseline prima dell’impulso',maximum,minimum,maxIndex,minIndex,peak:maximum-value,trough:minimum-value,from:wave.delay,to:Math.min(data.at(-1).x,wave.delay+period)};
  }
  function excitation(doc){if(doc?.mode==='free'){const c=doc.components?.find(c=>c.id===doc.settings?.acSource)||doc.components?.find(c=>c.type==='V'||c.type==='I');return c?.wave?.kind==='pulse'?c.wave:null;}const p=doc?.circuits?.[doc.experiment];return p?.wave1?.kind==='pulse'?p.wave1:null;}
  return{nearest,stats,pulse,excitation,baseline,reference,validateBaseline};
});
