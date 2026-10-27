(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rc-model.js'),require('./free-model.js'),require('./local-projects.js'),require('./guided-trials.js'),require('./bench-model.js'));
  else root.LabModel = factory(root.RCModel,root.FreeModel,root.LocalProjects,root.GuidedTrials,root.BenchModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(RC,Free,Files,Trials,Bench) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const signal = (kind, vpp, frequency) => ({kind, vpp, frequency, offset:0, phase:0, duty:50, level:5});
  const base = {R:100000, C:4.7e-9, R1:10000, Rf:47000, R3:10000, R4:47000,
    C1:1.5e-9, initial:0, autoTime:true, duration:.0047, switchTime:.00188, samples:1600,
    opamp:'limited', a0:200000, gbw:4e6, rail:15, headroom:1.5,
    instrument:'ideal', rg:50, scopeR:1e6, scopeC:120e-12,
    drive:'independent', fmin:10, fmax:1e6, sweepMax:10, bodeInput:'differential'};
  const CATALOG = [
    {id:'rc',type:'rc',day:1,step:'1a',name:'Circuito RC',short:'RC',page:'3–4',description:'Carica, scarica e risposta del passa basso.'},
    {id:'inverting',type:'inverting',day:1,step:'1b',name:'Amplificatore invertente',short:'−A',page:'4',description:'Guadagno, inversione e saturazione.'},
    {id:'bandwidth',type:'inverting',day:2,step:'2',name:'Invertente · VTC e banda',short:'↗',page:'5',description:'Linearità e banda passante dello stesso circuito.'},
    {id:'derivative',type:'derivative',day:2,step:'3',name:'Derivatore',short:'d/dt',page:'6',description:'Derivatore invertente con resistenza in serie.'},
    {id:'difference',type:'difference',day:2,step:'4',name:'Amplificatore delle differenze',short:'Δ',page:'7–8',description:'Due ingressi, modo comune e CMRR.'}
  ];
  function defaults(type='rc') {
    const p={...clone(base),type,wave1:signal(type==='rc'?'cycle':type==='derivative'?'triangle':'sine',1,type==='rc'?50:type==='derivative'?500:1000),wave2:signal('square',2,100)};
    if(type==='difference')p.duration=.02;
    return normalizeTime(p);
  }
  function selectExperience(project,id){
    const experiment=CATALOG.find(c=>c.id===id);if(!experiment)return null;
    const next=clone(project),previousType=CATALOG.find(c=>c.id===project.experiment)?.type,previous=next.circuits[previousType];
    if(!next.circuits[experiment.type]){
      const p=defaults(experiment.type);
      if(previous&&previous.type!=='rc'&&experiment.type!=='rc'){p.R1=previous.R1;p.Rf=previous.Rf;if(experiment.type==='difference'){p.R3=p.R1;p.R4=p.Rf;}}
      next.circuits[experiment.type]=normalizeTime(p);
    }
    next.experiment=id;next.analysis=id==='bandwidth'?'vtc':'time';return next;
  }
  function activeWaves(p) {return p.type==='difference' && p.drive==='independent'?[p.wave1,p.wave2]:[p.wave1];}
  function normalizeTime(p) {
    p=clone(p);
    if(p.autoTime){
      if(p.type==='rc' && ['charge','discharge','cycle'].includes(p.wave1.kind)){
        let tau=rcSummary(p).tau;if(Bench.real(p)){const b=Bench.config(p.bench);tau=Math.max(tau,...b.channels.filter(ch=>ch.enabled&&ch.coupling==='ac').map(ch=>(ch.kind==='probe10'?b.probeR:b.scopeR)*b.acC));}p.duration=tau*(p.wave1.kind==='cycle'?10:6);p.switchTime=4*tau;
      } else {
        const frequencies=activeWaves(p).filter(w=>!['dc','ground','charge','discharge','cycle'].includes(w.kind)).map(w=>w.frequency);
        p.duration=frequencies.length?2/Math.min(...frequencies):.002;
      }
    }
    return p;
  }
  function validate(p) {
    const e={};
    if(p.bench!==undefined)try{Bench.config(p.bench);}catch(error){e.bench=error.message;}
    if(p.benchReference!==undefined&&!['source','input'].includes(p.benchReference))e.benchReference='Riferimento Bode non valido.';
    if(typeof p.autoTime!=='boolean')e.autoTime='Impostazione del tempo automatico non valida.';
    if(!['differential','v1','v2','common'].includes(p.bodeInput))e.bodeInput='Ingresso dell’analisi non valido.';
    if(!['rc','inverting','derivative','difference'].includes(p.type))e.type='Circuito non valido.';
    for(const k of (p.type==='rc'?['R','C']:p.type==='derivative'?['R1','Rf','C1']:p.type==='difference'?['R1','Rf','R3','R4']:['R1','Rf'])){
      if(!Number.isFinite(p[k])||p[k]<=0)e[k]='Inserisci un valore maggiore di zero.';
      else if(p[k]>(k.startsWith('C')?1:1e10)||p[k]<(k.startsWith('C')?1e-14:.01))e[k]='Valore fuori dall’intervallo del modello didattico.';
    }
    if(!Number.isFinite(p.duration)||p.duration<1e-10||p.duration>100)e.duration='Durata ammessa: da 0,1 ns a 100 s.';
    if(!Number.isFinite(p.initial)||Math.abs(p.initial)>1000)e.initial='La tensione iniziale deve essere tra −1000 e 1000 V.';
    if(p.type==='rc'&&p.wave1.kind==='cycle'&&(!Number.isFinite(p.switchTime)||p.switchTime<=0||p.switchTime>=p.duration))e.switchTime='Scegli un istante compreso tra zero e la durata.';
    for(const [i,w] of [[1,p.wave1],[2,p.wave2]]){
      if(!w||!['sine','square','triangle','dc','ground','charge','discharge','cycle'].includes(w.kind)){e['wave'+i]='Segnale non valido.';continue;}
      for(const k of ['vpp','frequency','offset','phase','duty','level'])if(!Number.isFinite(w[k]))e[`wave${i}.${k}`]='Inserisci un numero valido.';
      if(w.vpp<0||w.vpp>200)e[`wave${i}.vpp`]='Ampiezza ammessa: 0–200 Vpp.';
      if(w.frequency<.01||w.frequency>1e8)e[`wave${i}.frequency`]='Frequenza ammessa: 0,01 Hz–100 MHz.';
      if(Math.abs(w.phase)>360)e[`wave${i}.phase`]='Fase ammessa: da −360° a +360°.';
      if(w.duty<=0||w.duty>=100)e[`wave${i}.duty`]='Duty cycle compreso tra 0 e 100%, estremi esclusi.';
      if(Math.abs(w.offset)>1000||Math.abs(w.level)>1000)e[`wave${i}.offset`]='Tensione ammessa: ±1000 V.';
    }
    if(!['ideal','limited','physical'].includes(p.opamp))e.opamp='Modello operazionale non valido.';
    if(p.opamp==='physical'){const q=Free.physical(p);for(const [key,value]of Object.entries(q))if(!Number.isFinite(value))e[key]='Inserisci un numero valido.';if(q.positive-q.negative<=2*p.headroom||q.positive>1000||q.negative< -1000)e.positive='Le alimentazioni devono includere due margini di uscita.';if(q.slew<1||q.slew>1e10)e.slew='Slew rate ammesso: 1–10¹⁰ V/s.';if(q.rout<.01||q.rout>1e6)e.rout='Resistenza di uscita ammessa: 0,01 Ω–1 MΩ.';if(q.ilimit<1e-9||q.ilimit>100)e.ilimit='Limite di corrente ammesso: 1 nA–100 A.';}
    if(p.sweepPoints!==undefined&&(!Number.isInteger(p.sweepPoints)||p.sweepPoints<11||p.sweepPoints>101))e.sweepPoints='Scegli da 11 a 101 punti della VTC.';
    if(!['ideal','generator','direct','probe','custom'].includes(p.instrument))e.instrument='Configurazione strumenti non valida.';
    if(!['independent','v1','v2','common','differential'].includes(p.drive))e.drive='Eccitazione non valida.';
    if(!Number.isFinite(p.a0)||p.a0<10||p.a0>1e8)e.a0='Guadagno aperto ammesso: 10–10⁸.';
    if(!Number.isFinite(p.gbw)||p.gbw<10||p.gbw>1e9)e.gbw='GBW ammessa: 10 Hz–1 GHz.';
    if(!Number.isFinite(p.rail)||p.rail<1||p.rail>30)e.rail='Alimentazione simmetrica ammessa: ±1–±30 V.';
    if(!Number.isFinite(p.headroom)||p.headroom<0||p.headroom>=p.rail)e.headroom='Il margine deve essere minore dell’alimentazione.';
    if(!Number.isFinite(p.rg)||p.rg<0||p.rg>1e7)e.rg='Resistenza del generatore ammessa: 0–10 MΩ.';
    if(!Number.isFinite(p.scopeR)||p.scopeR<1||p.scopeR>1e12)e.scopeR='Resistenza d’ingresso ammessa: 1 Ω–1 TΩ.';
    if(!Number.isFinite(p.scopeC)||p.scopeC<0||p.scopeC>1e-3)e.scopeC='Capacità parassita ammessa: 0–1 mF.';
    if(!Number.isInteger(p.samples)||p.samples<400||p.samples>10000)e.samples='Scegli da 400 a 10 000 punti minimi.';
    if(!Number.isFinite(p.fmin)||!Number.isFinite(p.fmax)||p.fmin<=0||p.fmax<=p.fmin||p.fmax>1e9)e.fmax='Imposta 0 < frequenza minima < massima ≤ 1 GHz.';
    if(!Number.isFinite(p.sweepMax)||p.sweepMax<=0||p.sweepMax>200)e.sweepMax='Ampiezza massima ammessa: 0–200 Vpp.';
    if(activeWaves(p).some(w=>['sine','square','triangle'].includes(w.kind)&&w.frequency*p.duration>400))e.duration='Riduci durata o frequenza: massimo 400 periodi visibili.';
    return e;
  }
  function assert(p){const e=validate(p);if(Object.keys(e).length)throw new Error(Object.values(e)[0]);}
  function network(p,drive=null){
    const q={...clone(p),instrument:'ideal',...(drive?{drive}:{})},d=Free.example(p.type,q),b=Bench.config(p.bench);d.probes.input='R1:a';
    if(p.type==='difference'&&['v1','v2'].includes(q.drive))b.sourceIds=(b.sourceIds||['V1','V2']).filter(id=>id===(q.drive==='v1'?'V1':'V2'));
    for(const c of d.components){c.x*=1.6;c.y*=1.25;}const out=Bench.apply(d,b);out.settings.integration='adaptive';out.settings.rtol=1e-5;out.settings.acReference=p.type==='rc'?(p.benchReference||'input'):'source';if(p.type==='difference')out.settings.acWeights=drives(drive||p.bodeInput);return out;
  }
  function instrument(p){
    if(p.instrument==='ideal')return{rg:0,scopeR:Infinity,scopeC:0};
    if(p.instrument==='generator')return{rg:p.rg,scopeR:Infinity,scopeC:0};
    return{rg:p.rg,scopeR:p.scopeR,scopeC:p.scopeC};
  }
  function rcSummary(p){if(Bench.real(p))return{tau:p.R*p.C,cutoff:1/(2*Math.PI*p.R*p.C),nominal:true};const s=instrument(p),rp=1/(1/(p.R+s.rg)+1/s.scopeR);let tau=rp*(p.C+s.scopeC);
    if(s.rg>0&&s.scopeC>0){const a=system(p).A,tr=(a[0]+a[3])/2,q=Math.sqrt((a[0]-a[3])**2/4+a[1]*a[2]);tau=-1/(tr+q);}
    return{tau,cutoff:1/(2*Math.PI*(1/(1/p.R+1/s.scopeR))*(p.C+s.scopeC))};}
  function coefficients(p){const k=p.Rf/p.R1,ng=1+k,a1=-k,a2=ng*p.R4/(p.R3+p.R4),factor=p.opamp==='ideal'?1:p.a0/(p.a0+ng);return{a1:a1*factor,a2:a2*factor,ad:(a2-a1)/2*factor,ac:(a1+a2)*factor,noiseGain:ng,cmrr:Math.abs(a1+a2)<1e-13*Math.max(1,Math.abs(a1),Math.abs(a2))?Infinity:20*Math.log10(Math.abs((a2-a1)/(2*(a1+a2))))};}
  // Linear state-space networks. Every source is specified at V1/V2 for op-amps;
  // the RC instrument model includes the generator and both oscilloscope channels.
  function system(p){
    if(Bench.real(p))return{n:network(p).components.filter(c=>['C','L'].includes(c.type)).length,descriptor:true};
    const z={n:0,A:[],B:[],out:[],direct:[0,0],vin:null,initial:[]};
    if(p.type==='rc'){
      const ins=instrument(p),g=1/p.R,gs=1/ins.scopeR,co=p.C+ins.scopeC;
      if(ins.rg>0&&ins.scopeC>0){const gg=1/ins.rg,ci=ins.scopeC;
        return{...z,n:2,A:[-(gg+g+gs)/ci,g/ci,g/co,-(g+gs)/co],B:[[gg/ci,0],[0,0]],out:[0,1],direct:[0,0],vin:[1,0],initial:[0,p.initial]};
      }
      const gg=ins.rg?1/ins.rg:Infinity,alpha=ins.rg?gg/(gg+g+gs):1,beta=ins.rg?g/(gg+g+gs):0;
      return{...z,n:1,A:[(g*beta-g-gs)/co],B:[[g*alpha/co,0]],out:[1],vin:{alpha,beta},initial:[p.initial]};
    }
    const k=p.Rf/p.R1,ng=1+k;
    if(p.opamp==='ideal'){
      if(p.type==='derivative')return{...z,n:1,A:[-1/(p.R1*p.C1)],B:[[1/(p.R1*p.C1),0]],out:[k],direct:[-k,0],initial:[0]};
      if(p.type==='difference'){const c=coefficients(p);return{...z,direct:[c.a1,c.a2]};}
      return{...z,direct:[-k,0]};
    }
    const wp=2*Math.PI*p.gbw/p.a0;
    if(p.type==='derivative'){
      const sum=p.R1+p.Rf,a=1/(sum*p.C1),b=wp*p.a0*p.Rf/sum;
      return{...z,n:2,A:[-a,-a,b,-wp*(1+p.a0*p.R1/sum)],B:[[a,0],[-b,0]],out:[0,1],initial:[0,0]};
    }
    const pole=wp*(1+p.a0/ng),c=coefficients(p);
    return{...z,n:1,A:[-pole],B:[[(p.type==='difference'?c.a1:-k*p.a0/(p.a0+ng))*pole,p.type==='difference'?c.a2*pole:0]],out:[1],initial:[0]};
  }
  function wave(w,t,p,side='right'){
    if(w.kind==='ground'||w.kind==='discharge')return 0;
    if(w.kind==='dc'||w.kind==='charge')return w.level;
    if(w.kind==='cycle')return t<p.switchTime||(t===p.switchTime&&side==='left')?w.level:0;
    let cycles=t*w.frequency+w.phase/360;
    if(side==='left')cycles-=1e-12;
    const q=((cycles%1)+1)%1,amp=w.vpp/2;
    return w.offset+amp*(w.kind==='sine'?Math.sin(2*Math.PI*q):w.kind==='square'?(q<w.duty/100?1:-1):q<.25?4*q:q<.75?2-4*q:4*q-4);
  }
  function inputs(p,t,side){const a=wave(p.wave1,t,p,side),b=wave(p.wave2,t,p,side);if(p.type!=='difference')return[a,0];return p.drive==='v1'?[a,0]:p.drive==='v2'?[0,a]:p.drive==='common'?[a,a]:p.drive==='differential'?[-a/2,a/2]:[a,b];}
  const mul=(a,b)=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];
  const mv=(a,v)=>[a[0]*v[0]+a[1]*v[1],a[2]*v[0]+a[3]*v[1]];
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const times=(a,f)=>a.map(x=>x*f);
  function stepper(s,dt){
    if(!s.n)return x=>x;
    if(s.n===1){const a=s.A[0],z=a*dt,E=Math.exp(z),em=Math.expm1(z),F=em/a,G=Math.abs(z)<1e-4?dt*dt*(.5+z/6+z*z/24+z*z*z/120):(em-z)/(a*a);
      return(x,u,v)=>[E*x[0]+s.B[0].reduce((sum,b,j)=>sum+b*(F*u[j]+G*(v[j]-u[j])/dt),0)];
    }
    const A=s.A,[a,b,c,d]=A,norm=Math.max(...A.map(Math.abs))*dt;
    let E,F,G;
    if(norm<1e-3){
      const I=[1,0,0,1];E=[...I];F=times(I,dt);G=times(I,dt*dt/2);
      let power=[...I],factorial=1;
      for(let k=1;k<=8;k++){power=mul(power,times(A,dt));factorial*=k;E=add(E,times(power,1/factorial));F=add(F,times(power,dt/(factorial*(k+1))));G=add(G,times(power,dt*dt/(factorial*(k+1)*(k+2))));}
    }else{
      const tr=(a+d)/2,disc=(a-d)*(a-d)/4+b*c;let C,S;
      if(disc>=0){const q=Math.sqrt(disc),e1=Math.exp((tr+q)*dt),e2=Math.exp((tr-q)*dt);C=(e1+e2)/2;S=q<Math.abs(tr)*1e-12?dt*Math.exp(tr*dt):(e1-e2)/(2*q);}
      else{const q=Math.sqrt(-disc),f=Math.exp(tr*dt);C=f*Math.cos(q*dt);S=f*Math.sin(q*dt)/q;}
      E=[C+S*(a-tr),S*b,S*c,C+S*(d-tr)];
      const det=a*d-b*c,inv=[d/det,-b/det,-c/det,a/det],em=[E[0]-1,E[1],E[2],E[3]-1];
      F=mul(inv,em);G=mul(inv,add(F,[-dt,0,0,-dt]));
    }
    return(x,u,v)=>{
      const bu=s.B.map(row=>row[0]*u[0]+row[1]*u[1]),slope=s.B.map(row=>(row[0]*(v[0]-u[0])+row[1]*(v[1]-u[1]))/dt);
      return add(add(mv(E,x),mv(F,bu)),mv(G,slope));
    };
  }
  function events(p){const e=new Map();
    for(const w of activeWaves(p)){
      if(w.kind==='cycle'){e.set(p.switchTime,true);continue;}
      if(!['square','triangle'].includes(w.kind))continue;
      const phases=w.kind==='square'?[0,w.duty/100]:[.25,.75];
      for(let n=-2;n<=Math.ceil(p.duration*w.frequency)+2;n++)for(const phase of phases){const t=(n+phase-w.phase/360)/w.frequency;if(t>0&&t<p.duration)e.set(t,w.kind==='square'||e.get(t)===true);}
    }return e;
  }
  function simulateLinear(p){
    assert(p);const s=system(p),ev=events(p),freq=Math.max(...activeWaves(p).filter(w=>['sine','square','triangle'].includes(w.kind)).map(w=>w.frequency),0);
    const count=Math.min(50000,Math.max(p.samples,Math.ceil(p.duration*freq*100)));
    const ts=new Set([0,p.duration,...ev.keys()]);for(let i=1;i<count-1;i++)ts.add(p.duration*i/(count-1));
    const grid=[...ts].sort((a,b)=>a-b),data=[],cache=new Map();let state=[...s.initial];
    function record(t,u){
      const raw=s.out.reduce((sum,c,i)=>sum+c*state[i],s.direct[0]*u[0]+s.direct[1]*u[1]);
      const out=raw;
      const vin=p.type==='rc'?(Array.isArray(s.vin)?state[0]:s.vin.alpha*u[0]+s.vin.beta*state[0]):u[0];
      data.push({x:t,vin,vin2:u[1],source:u[0],out,linear:raw,current:p.type==='rc'?(vin-out)/p.R:NaN,clipped:out!==raw});
    }
    record(0,inputs(p,0));
    for(let i=1;i<grid.length;i++){
      const t0=grid[i-1],t=grid[i],dt=t-t0,u=inputs(p,t0),v=inputs(p,t,'left'),key=dt.toPrecision(11);
      let step=cache.get(key);if(!step){step=stepper(s,dt);cache.set(key,step);}
      state=step(state,u,v);
      if(ev.get(t))record(t,v);
      record(t,inputs(p,t));
    }
    return data;
  }
  function simulate(p){
    assert(p);
    if(Bench.real(p)){const d=network(p),result=Free.simulate(d),t=Free.topology(d),node=t.nodes['R3:a'];return result.data.map((row,i)=>({...row,source:inputs(p,row.x,i+1<result.data.length&&result.data[i+1].x===row.x?'left':'right')[0],vin2:node>=0?row.values['N'+(node+1)]:0,linear:p.type==='rc'||p.opamp==='ideal'?row.out:NaN,current:row.currents.R1}));}
    if(p.type==='rc'||p.opamp==='ideal')return simulateLinear(p);
    const result=Free.simulate(Free.example(p.type,p)),linear=simulateLinear(p);let i=0;
    return result.data.map((d,j)=>{
      while(i+1<linear.length&&linear[i+1].x<=d.x)i++;
      const a=linear[i],b=linear[Math.min(i+1,linear.length-1)],f=b.x===a.x?0:(d.x-a.x)/(b.x-a.x),u=inputs(p,d.x,j+1<result.data.length&&result.data[j+1].x===d.x?'left':'right');
      return{x:d.x,vin:d.vin,vin2:u[1],source:u[0],out:d.out,linear:a.out+f*(b.out-a.out),current:NaN,clipped:d.clipped,limits:d.limits||[]};
    });
  }
  const complex=(r=0,i=0)=>({r,i}),ca=(a,b)=>complex(a.r+b.r,a.i+b.i),cm=(a,b)=>complex(a.r*b.r-a.i*b.i,a.r*b.i+a.i*b.r),cd=(a,b)=>{const d=b.r*b.r+b.i*b.i;return complex((a.r*b.r+a.i*b.i)/d,(a.i*b.r-a.r*b.i)/d);};
  const scale=(a,b)=>complex(a.r*b,a.i*b);
  function response(p,frequency,input='default'){
    if(Bench.real(p)){const d=network(p,p.type==='difference'?(input==='default'?p.bodeInput:input):null);if(p.type==='rc'&&input==='generator')d.settings.acReference='source';return Free.bode(d,{frequencies:[frequency],ignoreBias:true}).data[0];}
    if(p.opamp==='physical'&&p.type!=='rc'){const d=Free.example(p.type,p);if(p.type==='difference')d.settings.acWeights=drives(input==='default'?p.bodeInput:input);return Free.bode(d,{frequencies:[frequency],ignoreBias:true}).data[0];}
    const s=system(p),w=2*Math.PI*frequency;
    let drive=input==='v1'?[1,0]:input==='v2'?[0,1]:input==='common'?[1,1]:input==='differential'?[-.5,.5]:p.type==='difference'?(p.bodeInput==='v1'?[1,0]:p.bodeInput==='v2'?[0,1]:p.bodeInput==='common'?[1,1]:[-.5,.5]):[1,0];
    const B=s.B.map(row=>row[0]*drive[0]+row[1]*drive[1]);let state=[];
    if(s.n===1)state=[cd(complex(B[0]),complex(-s.A[0],w))];
    if(s.n===2){const[a,b,c,d]=s.A,A=complex(-a,w),D=complex(-d,w),det=ca(cm(A,D),complex(-b*c));state=[cd(ca(scale(D,B[0]),complex(b*B[1])),det),cd(ca(complex(c*B[0]),scale(A,B[1])),det)];}
    let H=complex(s.direct[0]*drive[0]+s.direct[1]*drive[1]);for(let i=0;i<s.n;i++)H=ca(H,scale(state[i],s.out[i]));
    if(p.type==='rc'){
      const Vin=Array.isArray(s.vin)?state[0]:ca(complex(s.vin.alpha),scale(state[0],s.vin.beta));
      if(input!=='generator')H=cd(H,Vin);
    }
    const magnitude=Math.hypot(H.r,H.i);
    return{real:H.r,imag:H.i,magnitude,db:magnitude===0?-Infinity:20*Math.log10(magnitude),phase:magnitude===0?NaN:Math.atan2(H.i,H.r)*180/Math.PI};
  }
  function bode(p){assert(p);if(Bench.real(p)){const d=network(p,p.type==='difference'?p.bodeInput:null);return Free.bode(d,{frequencies:Array.from({length:601},(_,i)=>p.fmin*(p.fmax/p.fmin)**(i/600))}).data;}if(p.type!=='rc'&&p.opamp!=='ideal'){const d=Free.example(p.type,p);if(p.type==='difference')d.settings.acWeights=drives(p.bodeInput);return Free.bode(d,{frequencies:Array.from({length:601},(_,i)=>p.fmin*(p.fmax/p.fmin)**(i/600))}).data;}const data=[];let previous;for(let i=0;i<601;i++){const f=p.fmin*(p.fmax/p.fmin)**(i/600),h=response(p,f);if(previous===undefined&&h.phase>90)h.phase-=360;if(previous!==undefined){while(h.phase-previous>180)h.phase-=360;while(h.phase-previous < -180)h.phase+=360;}previous=h.phase;data.push({x:f,...h});}return data;}
  const drives=mode=>({v1:{V1:1,V2:0},v2:{V1:0,V2:1},common:{V1:1,V2:1},differential:{V1:-.5,V2:.5}})[mode]||{V1:1};
  function vtc(p,options={}){
    assert(p);if(p.type==='rc')throw new Error('La VTC in ampiezza richiede un amplificatore.');
    const frequency=p.wave1.frequency,period=1/frequency,h=response(p,frequency),count=p.sweepPoints??41,data=[];
    const interpolate=(rows,t)=>{let lo=0,hi=rows.length-1;while(hi-lo>1){const k=(lo+hi)>>1;if(rows[k].x<=t)lo=k;else hi=k;}const a=rows[lo],b=rows[hi],f=b.x===a.x?0:(t-a.x)/(b.x-a.x);return Object.fromEntries(Object.keys(a.values).map(k=>[k,a.values[k]+f*(b.values[k]-a.values[k])]).concat(Object.keys(a.states||{}).map(k=>[k,a.states[k]+f*(b.states[k]-a.states[k])])));};
    for(let i=0;i<count;i++){
      if(options.cancelled?.())throw new Error('Calcolo annullato.');const x=p.sweepMax*i/(count-1),q=clone(p);q.drive=p.type==='difference'?p.bodeInput:'v1';Object.assign(q.wave1,{kind:'sine',vpp:x,phase:0});let settled=false,result,cycles,state=null,delta=0;
      for(cycles=8;cycles<=128;cycles+=8){
        const d=Bench.real(q)?network(q,q.drive):Free.example(p.type,q);d.settings.duration=8*period;if(d.settings.duration>100)throw new Error('Per la VTC scegli una frequenza di almeno 0,08 Hz.');d.settings.samples=1024;d.settings.integration='fixed';
        const sampleTimes=[];for(let n=0;n<=128;n++)sampleTimes.push((6+n/64)*period);
        result=Free.simulate(d,{sampleTimes,steps:4096,initialState:state});state=result.finalState;delta=0;let scale=1;
        for(let n=0;n<=64;n++){const a=interpolate(result.data,(6+n/64)*period),b=interpolate(result.data,(7+n/64)*period);for(const k of Object.keys(a)){delta=Math.max(delta,Math.abs(a[k]-b[k]));scale=Math.max(scale,Math.abs(a[k]),Math.abs(b[k]));}}
        if(delta<=1e-5*scale){settled=true;break;}
      }
      if(!settled)throw new Error('VTC non a regime dopo 128 periodi (ampiezza '+x+' Vpp). Rivedi circuito e frequenza.');
      const last=result.data.filter(row=>row.x>=7*period),values=last.map(row=>row.out),out=Math.max(...values)-Math.min(...values);
      data.push({x,out,linear:x*h.magnitude,cycles,steady:true,clipped:last.some(row=>row.clipped),limits:[...new Set(last.flatMap(row=>row.limits||[]))]});options.onProgress?.((i+1)/count);
    }
    return data;
  }
  function summary(p){
    if(Bench.real(p)){const b=Bench.config(p.bench);return[...(p.type==='rc'?[{label:'τ nominale R·C',value:format(p.R*p.C,'s'),primary:true},{label:'f_taglio nominale RC',value:format(1/(2*Math.PI*p.R*p.C),'Hz'),primary:true}]:[]),{label:'Montaggio',value:'Reale · R/C espliciti'},{label:'R_G per generatore attivo',value:format(b.rg,'Ω')},{label:'R per collegamento',value:format(b.wireR,'Ω')},{label:'Riferimento Bode',value:p.type==='rc'&&p.benchReference!=='source'?'CH2 / CH1':'Uscita / generatore ideale'}];}
    if(p.type==='rc'){const r=rcSummary(p);return[{label:'Costante di tempo',value:RC.format(r.tau,'s')},{label:'Frequenza di taglio Vout/V1',value:RC.format(r.cutoff,'Hz')},{label:'Carico di misura',value:p.instrument==='ideal'?'Nessuno':p.instrument==='generator'?'Solo generatore':p.instrument==='probe'?'Sonde 10×':'Oscilloscopio'}];}
    const c=coefficients(p),gain=p.type==='difference'?c.ad:c.a1;
    if(p.type==='difference')return[{label:'Guadagno differenziale Aᴅ',value:format(c.ad)+' V/V'},{label:'Guadagno di modo comune Aᴄ',value:format(c.ac)+' V/V'},{label:'CMRR dei rapporti resistivi',value:Number.isFinite(c.cmrr)?format(c.cmrr)+' dB':'∞ · rapporti bilanciati'}];
    return[{label:p.type==='derivative'?'Guadagno HF ideale':'Guadagno a bassa frequenza',value:RC.format(p.type==='derivative'?-p.Rf/p.R1:gain,'')+' V/V'},{label:p.type==='derivative'?'Taglio della rete R₁C₁':'Banda del modello',value:p.type==='derivative'?RC.format(1/(2*Math.PI*p.R1*p.C1),'Hz'):p.opamp==='ideal'?'Infinita':RC.format(p.gbw*(p.a0+1+p.Rf/p.R1)/(p.a0*(1+p.Rf/p.R1)),'Hz')},{label:'Escursione di uscita',value:p.opamp==='ideal'?'Illimitata (ideale)':p.opamp==='physical'?format(Free.physical(p).negative+p.headroom,'V')+' … '+format(Free.physical(p).positive-p.headroom,'V')+' · prima del carico':'±'+RC.format(p.rail-p.headroom,'V')}];
  }
  function csv(p,analysis,data){const keys=analysis==='time'?['x','source','vin','vin2','out','linear','current']:analysis==='bode'?['x','magnitude','db','phase']:['x','out','linear'];const headers=analysis==='time'?(Bench.real(p)?'tempo_s,Vg_V,IN_lettura_V,V2_nodo_V,OUT_lettura_V,Vout_lineare_V,corrente_R1_A':'tempo_s,Vg_V,V1_V,V2_V,Vout_V,Vout_lineare_V,corrente_R_A'):analysis==='bode'?'frequenza_Hz,guadagno_V_V,guadagno_dB,fase_gradi':'Vin_Vpp,Vout_Vpp,Vout_lineare_Vpp';return '\uFEFF'+headers+'\r\n'+data.map(d=>keys.map(k=>Number.isFinite(d[k])?d[k].toExponential(12):'').join(',')).join('\r\n');}
  function metrics(p,excitation=null){if(!Bench.real(p)||p.type!=='difference')return[];const f=p.wave1.frequency,base=network(p,excitation),read=drive=>{const d=clone(base);d.settings.acWeights=drives(drive);return Free.bode(d,{frequencies:[f]}).data[0].magnitude;},ad=read('differential'),ac=read('common'),limited=ac<=Math.max(1e-15,ad*1e-12);return[{label:'A_D a '+format(f,'Hz'),value:format(ad,'V/V'),primary:true},{label:'A_C a '+format(f,'Hz'),value:format(ac,'V/V'),primary:true},{label:'CMRR a '+format(f,'Hz'),value:ad<=1e-15?'Non definito · A_D nullo':limited?'Cancellazione entro risoluzione':format(20*Math.log10(ad/ac),'dB'),primary:true,note:'Stesso montaggio e punto di lavoro per A_D e A_C. Comprende gli strumenti; il CMRR intrinseco del chip non è modellato.'}];}
  function curveMetrics(data){if(!data?.length)return[];let peak=-1,index=-1;for(let i=0;i<data.length;i++)if(Number.isFinite(data[i].magnitude)&&data[i].magnitude>peak){peak=data[i].magnitude;index=i;}if(!(peak>0))return[];const level=peak/Math.SQRT2,cross=(a,b)=>Math.exp(Math.log(a.x)+(Math.log(level)-Math.log(a.magnitude))/(Math.log(b.magnitude)-Math.log(a.magnitude))*(Math.log(b.x)-Math.log(a.x)));let low=null,high=null;for(let i=1;i<=index;i++)if(data[i-1].magnitude<level&&data[i].magnitude>=level)low=cross(data[i-1],data[i]);for(let i=index+1;i<data.length;i++)if(data[i-1].magnitude>level&&data[i].magnitude<=level){high=cross(data[i-1],data[i]);break;}return[...(low?[{label:'f bassa −3 dB',value:format(low,'Hz'),primary:true}]:[]),{label:'f alta −3 dB',value:high?format(high,'Hz'):'Fuori intervallo',primary:true,note:'Rispetto al massimo della risposta nell’intervallo visualizzato; interpolazione logaritmica.'}];}
  function serialize(project){return JSON.stringify({application:'Circuit Lab',version:2,...project},null,2);}
  function parse(text){const d=Files.readJSON(text);
    if(!d||typeof d!=='object')throw new Error('Il file non contiene un progetto.');
    if(d.application==='RC Studio'&&d.version===1){const old=RC.readProject(text).parameters,p=defaults('rc');Object.assign(p,{R:old.resistance,C:old.capacitance,initial:old.initial,duration:old.duration,switchTime:old.switchTime,samples:old.samples,autoTime:old.autoTime});p.wave1.kind=old.mode;p.wave1.level=old.voltage;return{experiment:'rc',analysis:'time',circuits:{rc:p},layouts:{},name:'Circuito RC importato'};}
    if(d.application!=='Circuit Lab'||d.version!==2||!d.circuits||!CATALOG.some(c=>c.id===d.experiment))throw new Error('Progetto non compatibile.');
    for(const [key,p]of Object.entries(d.circuits)){if(!['rc','inverting','derivative','difference'].includes(key)||!p||p.type!==key)throw new Error('Circuito non valido nel progetto.');assert(p);}
    if(!d.circuits[CATALOG.find(c=>c.id===d.experiment).type])throw new Error('Il circuito attivo manca nel progetto.');
    if(!['time','bode','vtc'].includes(d.analysis))throw new Error('Analisi non valida.');
    const layouts=d.layouts??{};
    if(!layouts||typeof layouts!=='object'||Array.isArray(layouts))throw new Error('Disposizione dei componenti non valida.');
    for(const [type,items]of Object.entries(layouts)){
      if(!['rc','inverting','derivative','difference'].includes(type)||!items||typeof items!=='object'||Array.isArray(items)||Object.keys(items).length>40)throw new Error('Disposizione dei componenti non valida.');
      for(const [id,at]of Object.entries(items))if(!/^[A-Za-z][A-Za-z0-9]{0,10}$/.test(id)||!at||!Number.isFinite(at.x)||!Number.isFinite(at.y)||Math.abs(at.x)>10000||Math.abs(at.y)>10000||(at.rotation!==undefined&&![0,90,180,270].includes(at.rotation)))throw new Error('Posizione del componente '+id+' non valida.');
    }
    Files.checkRCStudy(d.rcStudy);Files.checkACStudy(d.acStudy);Files.checkOpampStudy(d.opampStudy);Files.checkMetrologyStudy(d.metrologyStudy);Files.checkParameterStudy(d.parameterStudy);
    Trials.validate(d,CATALOG);
    const normalized={...(d.session===undefined?{}:{session:d.session}),...(d.guidedTrials===undefined?{}:{guidedTrials:d.guidedTrials}),experiment:d.experiment,analysis:d.analysis,circuits:d.circuits,layouts,name:typeof d.name==='string'?d.name.slice(0,80):'Il mio laboratorio',...(d.rcStudy===undefined?{}:{rcStudy:d.rcStudy}),...(d.acStudy===undefined?{}:{acStudy:d.acStudy}),...(d.opampStudy===undefined?{}:{opampStudy:d.opampStudy}),...(d.metrologyStudy===undefined?{}:{metrologyStudy:d.metrologyStudy}),...(d.parameterStudy===undefined?{}:{parameterStudy:d.parameterStudy})};Files.readJSON(serialize(normalized));return normalized;
  }
  function circuit(project){
    const p=project.circuits[CATALOG.find(c=>c.id===project.experiment)?.type];if(!p)throw new Error('Esperienza non disponibile.');assert(p);
    const d=Bench.real(p)?network(p,p.type==='difference'&&project.analysis!=='time'?p.bodeInput:null):Free.example(p.type,p);if(Bench.real(p))for(const part of d.components)Object.assign(part,project.layouts?.[p.type]?.[part.id]||{});d.name=(project.name||d.name).slice(0,80);d.settings.analysis=project.analysis==='bode'?'bode':'time';
    if(p.type==='rc'){if(!Bench.real(p)){d.probes.input='R1:a';d.settings.acReference='input';}for(const key of ['rcStudy','acStudy'])if(project[key])d[key]=clone(project[key]);if(d.acStudy?.reference==='after-generator')d.acStudy.reference='input';}
    if(project.metrologyStudy)d.metrologyStudy=clone(project.metrologyStudy);if(project.parameterStudy)d.parameterStudy=clone(project.parameterStudy);
    if(p.type!=='rc'&&project.opampStudy)d.opampStudy=clone(project.opampStudy);
    if(p.type==='difference'){d.settings.acWeights=drives(p.bodeInput||'differential');}
    return Free.parse(Free.serialize(d));
  }
  const format=(value,unit='',digits=3)=>!Number.isFinite(value)?'—':!unit||['dB','°'].includes(unit)?new Intl.NumberFormat('it-IT',{maximumSignificantDigits:digits}).format(Object.is(value,-0)?0:value)+(unit?' '+unit:''):RC.format(Number(value.toPrecision(digits)),unit,digits);
  return{physical:Free.physical,network,real:Bench.real,metrics,curveMetrics,circuit,CATALOG,defaults,selectExperience,normalizeTime,validate,system,simulate,response,bode,vtc,summary,coefficients,rcSummary,instrument,inputs,csv,serialize,parse,format,clone};
});
