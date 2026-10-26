/* Explicit educational device subset, 27 °C. No hidden leakage or model downloads. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Semiconductors=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';const VT=1.38064852e-23/1.6021766208e-19*300.15,pins={D:['a','b'],Q:['c','b','e'],M:['d','g','s']};
 function junction(v,is,n=1){const a=v/(n*VT);if(a>80)throw Error('Tensione di giunzione fuori dal campo numerico del modello: aggiungi una resistenza o verifica la polarità.');const exp=Math.exp(a);return{i:is*Math.expm1(a),g:is*exp/(n*VT)};}
 function device(c,v){
  if(c.type==='D'){const j=junction(v[0]-v[1],c.is,c.n);return{currents:[j.i,-j.i],jacobian:[[j.g,-j.g],[-j.g,j.g]],region:v[0]>v[1]?'diretta':'inversa (senza breakdown)'};}
  const q=c.polarity==='p'?-1:1;
  if(c.type==='Q'){const f=junction(q*(v[1]-v[2]),c.is),r=junction(q*(v[1]-v[0]),c.is),ic=q*(f.i-(1+1/c.br)*r.i),ib=q*(f.i/c.bf+r.i/c.br),jc=[(1+1/c.br)*r.g,f.g-(1+1/c.br)*r.g,-f.g],jb=[-r.g/c.br,f.g/c.bf+r.g/c.br,-f.g/c.bf];return{currents:[ic,ib,-ic-ib],jacobian:[jc,jb,jc.map((a,i)=>-a-jb[i])],region:q*(v[1]-v[2])>0?q*(v[1]-v[0])>0?'saturazione':'attiva diretta':q*(v[1]-v[0])>0?'attiva inversa':'interdizione'};}
  if(c.type==='M'){
   const vd=q*(v[0]-v[2]),vg=q*(v[1]-v[2]);let d=vd,g=vg,reverse=d<0;if(reverse){g-=d;d=-d;}const u=g-c.vto;let current=0,gd=0,gm=0,region='interdizione';
   if(u>0){if(d<u){const raw=u*d-d*d/2;current=c.kp*raw*(1+c.lambda*d);gd=c.kp*((u-d)*(1+c.lambda*d)+c.lambda*raw);gm=c.kp*d*(1+c.lambda*d);region='triodo';}else{current=.5*c.kp*u*u*(1+c.lambda*d);gd=.5*c.kp*u*u*c.lambda;gm=c.kp*u*(1+c.lambda*d);region='saturazione';}}
   if(reverse){current=-current;gd+=gm;gm=-gm;region+=' · D/S invertiti';}const body=junction(-vd,c.bodyIs),id=q*(current-body.i),jd=[gd+body.g,gm,-gd-body.g-gm];return{currents:[id,0,-id],jacobian:[jd,[0,0,0],jd.map(v=>-v)],region:body.i>1e-6?region+' · diodo di corpo attivo':region};
  }
  throw Error('Dispositivo non lineare non supportato.');
 }
 function evaluate(system,x){const current=Array(x.length).fill(0),jacobian=Array.from({length:x.length},()=>Array(x.length).fill(0)),terminals={},regions={};for(const c of system.nonlinear||[]){const ns=pins[c.type].map(p=>system.node(c,p)),d=device(c,ns.map(n=>n<0?0:x[n]));terminals[c.id]=d.currents;regions[c.id]=d.region;for(let i=0;i<ns.length;i++){if(ns[i]<0)continue;current[ns[i]]+=d.currents[i];for(let j=0;j<ns.length;j++)if(ns[j]>=0)jacobian[ns[i]][ns[j]]+=d.jacobian[i][j];}}return{current,jacobian,terminals,regions};}
 function solve(system,A,b,factor,seed=null){
  if(!system.nonlinear?.length)return factor(A)(b);const n=A.length;let x=seed?Array.from({length:n},(_,i)=>seed[i]||0):Array(n).fill(0),previousStep=Infinity;
  const scales=A.map((row,i)=>Math.max(i<system.topo.count?1e-6:1,Math.abs(b[i]),row.reduce((s,v)=>s+Math.abs(v),0))),residual=(v)=>{const nl=evaluate(system,v),f=A.map((row,i)=>row.reduce((s,a,j)=>s+a*v[j],-b[i])+nl.current[i]);return{nl,f,merit:f.reduce((s,v,i)=>s+(v/scales[i])**2,0),norm:Math.max(...f.map((v,i)=>Math.abs(v)/(1e-13+1e-10*scales[i])))};};
  for(let iteration=0;iteration<120;iteration++){
   const r=residual(x);if(r.norm<=1&&previousStep<=1e-8){system.newton??={solves:0,maxIterations:0};system.newton.solves++;system.newton.maxIterations=Math.max(system.newton.maxIterations,iteration);return x;}
   const J=A.map((row,i)=>row.map((v,j)=>v+r.nl.jacobian[i][j])),delta=factor(J)(r.f.map(v=>-v));let alpha=1;
   // Limit only Newton's trial length; the accepted point still obeys the original exponential equations.
   for(const c of system.nonlinear){const ns=pins[c.type].map(p=>system.node(c,p)),dv=ns.map(i=>i<0?0:delta[i]),q=c.polarity==='p'?-1:1,pairs=c.type==='D'?[[0,1]]:c.type==='Q'?[[1,2],[1,0]]:[[2,0]];for(const[a,z]of pairs){const change=(c.type==='D'?1:q)*(dv[a]-dv[z]);if(change>.2)alpha=Math.min(alpha,.2/change);}}
   let accepted=false,next;
   for(let k=0;k<30;k++){next=x.map((v,i)=>v+alpha*delta[i]);try{const m=residual(next);if(m.merit<=r.merit*(1-1e-4*alpha)||m.norm<=1){accepted=true;break;}}catch{}alpha*=.5;}
   if(!accepted)throw Error('Newton non converge per i semiconduttori: controlla polarizzazione, connessioni e passo temporale.');previousStep=Math.max(...delta.map((v,i)=>Math.abs(alpha*v)/(i<system.topo.count?1:100)));x=next;
  }
  throw Error('Newton ha raggiunto 120 iterazioni: verifica il circuito o usa un passo adattivo. Nessuna soluzione parziale valida.');
 }
 return{VT,pins,junction,device,evaluate,solve};
});
