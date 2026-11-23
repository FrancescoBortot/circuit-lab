(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./lab-model'),require('./measurements'));
 else root.LabTransientComparison=factory(root.LabModel,root.LabMeasurements);
})(globalThis,function(L,M){
 'use strict';
 const S=L.semiconductor,R=L.radiation;
 const titles={
  rc:'Confronta la scarica con e senza sonda',
  inverting:'Confronta il Bode ideale e a banda finita',
  'shaper-buffer':'Confronta lo shaper con e senza buffer',
  'preamp-shaper':'Confronta la compensazione polo-zero',
  'pz-shaper':'Confronta la compensazione polo-zero',
  'mos-iv':'Confronta l’effetto del voltmetro',
  'nmos-nor':'Confronta NOR e NAND',
  'nmos-nand':'Confronta NOR e NAND',
  'half-wave-rc':'Confronta carico e frequenza',
  'mos-amplifier':'Confronta due ampiezze',
  'nmos-inverter':'Confronta nMOS e CMOS',
  'cmos-inverter':'Confronta nMOS e CMOS',
  'cmos-nor':'Confronta NOR e NAND CMOS',
  'cmos-nand':'Confronta NOR e NAND CMOS',
  'precision-rectifier':'Confronta i rapporti resistivi',
  'bridge-rectifier':'Confronta diodi e LED',
  'common-source':'Confronta bypass e carichi'
 };
 const rectifierCases=[
  ['probe','Sola sonda ×10 · 50 Hz'],
  ['load','Carico aggiunto · 50 Hz'],
  ['fast','Stesso carico · 1 kHz']
 ];
 const isInverter=type=>['nmos-inverter','cmos-inverter'].includes(type);
 const isGate=type=>S.extra.isLogic(type)||['nmos-nor','nmos-nand'].includes(type);
 const isCompensation=type=>['preamp-shaper','pz-shaper'].includes(type);
 const analysisFor=(type,mode)=>type==='mos-iv'?'mosOutput':
  type==='inverting'||type==='shaper-buffer'&&mode==='bode'?'bode':'time';

 function setup(doc,params,mode){
  const p=params;
  if(p.type==='rc'){
   const bench={...p.bench,mode:'ideal'};
   return [['direct','Cavo diretto',1e6,120e-12],['probe','Sonda ×10',10e6,12e-12]].map(([instrument,label,scopeR,scopeC])=>({
    label,params:{...p,bench,instrument,rg:50,scopeR,scopeC,initial:4,autoTime:false,duration:6*p.R*(p.C+120e-12),
     wave1:{...p.wave1,kind:'discharge'}}
   }));
  }
  if(p.type==='inverting')return [['Ideale','ideal'],['Banda finita',p.opamp==='physical'?'physical':'limited']].map(([label,opamp])=>({
   label,params:{...p,opamp,fmin:30,fmax:1e6,wave1:{...p.wave1,kind:'sine',frequency:1000,offset:0,vpp:1}}
  }));
  if(p.type==='shaper-buffer'){
   const reference={...R.applyPreset({...p,type:'shaper'},'probe').parameters,type:p.type};
   const common=mode==='bode'?R.applyPreset(reference,'bode').parameters:reference;
   return [['Senza buffer',false],['Con buffer',true]].map(([label,outputBuffer])=>({
    label,params:{...common,outputBuffer}
   }));
  }
  if(isCompensation(p.type)){
   const reference={...p,type:'pz-shaper',baselineMode:'auto'};
   return [['Senza compensazione','uncompensated'],['Con compensazione','compensated']].map(([label,key])=>({
    label,params:R.applyPreset(reference,key).parameters
   }));
  }
  if(p.type==='mos-iv'){
   const reference=S.applyPreset(p,'qpoint').parameters;
   return [['A monte di R₁',false],['A valle di R₁',true]].map(([label,gateMeter])=>({
    label,params:{...reference,gateMeter}
   }));
  }
  if(isGate(p.type)){
   const bench=L.defaults(p.type).bench;
   const prefix=S.extra.isLogic(p.type)?'cmos':'nmos';
   return [['NOR',prefix+'-nor'],['NAND',prefix+'-nand']].map(([label,type])=>({
    label,params:S.applyPreset({...p,type,bench},'logic').parameters
   }));
  }
  if(params.type==='half-wave-rc'){
   const pair=mode==='frequency'?rectifierCases.slice(1):rectifierCases.slice(0,2);
   const reference=S.applyPreset(params,'probe').parameters;
   return pair.map(([preset,label])=>({label,params:S.applyPreset(reference,preset).parameters}));
  }
  if(params.type==='mos-amplifier')return [
   {label:'100 mVpp',params:S.applyPreset(params,'small').parameters},
   {label:'1 Vpp',params:S.applyPreset(params,'large').parameters}
  ];
  if(p.type==='precision-rectifier'){
   const reference=S.applyPreset(p,'output').parameters;
   return [['R₂ = R₁a/2',1],['R₂ aumentata dell’1%',1.01]].map(([label,factor])=>({
    label,params:{...reference,R2:Math.max(1,reference.R1a/2*factor)}
   }));
  }
  if(p.type==='bridge-rectifier')return [['Diodi al silicio','diodes'],['LED','leds']].map(([label,key])=>({label,params:S.applyPreset(p,key).parameters}));
  if(p.type==='common-source'){
   const variants={
    bypass:['Senza C₃','unbypassed'],rin:['Con Rᵢ','rin'],rout:['Con Rᴸ','rout']
   };
   return [['Riferimento con C₃','gain'],variants[mode]||variants.bypass].map(([label,key])=>({label,params:S.applyPreset(p,key).parameters}));
  }
  const bench=L.defaults('nmos-inverter').bench;
  const {RD}=doc.circuits['nmos-inverter']||L.defaults('nmos-inverter');
  const {pKp,pVto,pLambda}=doc.circuits['cmos-inverter']||L.defaults('cmos-inverter');
  return [
   {label:'nMOS resistivo',params:S.applyPreset({...params,type:'nmos-inverter',RD,bench},'logic').parameters},
   {label:'CMOS',params:S.applyPreset({...params,type:'cmos-inverter',pKp,pVto,pLambda,bench},'logic').parameters}
  ];
 }

 // Keep both sides of discrete transitions, and interpolate only the window edges.
 function lastPeriod(data,period){
  if(data.length<2||!(period>0))throw Error('Finestra di simulazione non disponibile.');
  const first=data[0].x,end=data.at(-1).x;
  if(end-first<period*(1-1e-12))throw Error('Finestra di simulazione più breve di un periodo.');
  const start=Math.max(first,end-period);
  const rows=data.filter(row=>row.x>=start);
  if(rows[0].x>start){
   const hi=rows[0],lo=data[data.indexOf(hi)-1];
   const fraction=(start-lo.x)/(hi.x-lo.x);
   rows.unshift({x:start,vin:lo.vin+fraction*(hi.vin-lo.vin),out:lo.out+fraction*(hi.out-lo.out)});
  }
  return rows.map(row=>({...row,x:row.x-start}));
 }

 function series(result,params,{phase=false,normalized=false}={}){
  const period=1/params.wave1.frequency;
  const rows=lastPeriod(result.data,period);
  const output=M.stats(rows,'out'),input=M.stats(rows,'vin');
  if(!output||!input||normalized&&input.pp<=0)throw Error('Ampiezza insufficiente per normalizzare le curve.');
  return rows.map(row=>({
   x:phase?row.x/period:row.x,
   out:normalized?(row.out-output.mean)/input.pp:row.out
  }));
 }
 function interpolate(data,x,key){
  if(x<data[0].x||x>data.at(-1).x)return undefined;
  let lo=0,hi=data.length;
  while(lo<hi){const i=(lo+hi)>>1;if(data[i].x<=x)lo=i+1;else hi=i;}
  const a=data[lo-1],b=data[lo];
  return a.x===x||!b?a[key]:a[key]+(b[key]-a[key])*(x-a.x)/(b.x-a.x);
 }

 function cutoff(data){
  const level=data[0].db-10*Math.log10(2);
  const i=data.findIndex(row=>row.db<=level);
  if(i<1)return undefined;
  const a=data[i-1],b=data[i];
  return a.x*(b.x/a.x)**((level-a.db)/(b.db-a.db));
 }

 function bandPeak(data){
  const peak=data.reduce((a,b)=>a.db>=b.db?a:b);
  return peak;
 }

 function trace(curve,options){
  const {params:p,data}=curve;
  if(options.analysis==='bode')return data.map(row=>({x:row.x,out:row.db}));
  if(isCompensation(p.type)){
   const baseline=R.pulseSummary(p,data).baseline,delay=p.wave1.delay;
   return data.filter(row=>row.x>=delay).map(row=>({x:row.x-delay,out:row.out-baseline}));
  }
  if(['rc','shaper-buffer'].includes(p.type))return data.map(({x,out})=>({x,out}));
  const rows=series(curve,p,options);
  return isGate(p.type)?lastPeriod(data,1/p.wave1.frequency):rows;
 }

 function measurements(curve,analysis){
  const {params:p,data}=curve;
  if(p.type==='rc'){
   const level=p.initial/Math.E,i=data.findIndex(row=>row.out<=level);
   const a=data[i-1],b=data[i];
   return [i>0?a.x+(b.x-a.x)*(level-a.out)/(b.out-a.out):undefined,p.R*p.C];
  }
  if(p.type==='inverting')return [data[0].db,cutoff(data)];
  if(p.type==='shaper-buffer'){
   if(analysis==='bode'){const peak=bandPeak(data);return [peak.db,peak.x];}
   const highEnd=p.wave1.duty/100/p.wave1.frequency;
   const peak=data.filter(row=>row.x<highEnd).reduce((a,b)=>a.out>=b.out?a:b);
   return [peak.out,peak.x];
  }
  if(isCompensation(p.type)){
   const m=R.pulseSummary(p,data),at=p.wave1.delay+10*p.Rsh2*p.Csh2;
   const v=interpolate(data,at,'out');
   return [m.trough,Number.isFinite(v)?v-m.baseline:undefined];
  }
  return [];
 }
 return {titles,setup,series,analysisFor,isCompensation,isInverter,isGate,trace,measurements,interpolate};
});
