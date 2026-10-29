const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../lab-model'),R=L.radiation,F=require('../free-model'),B=require('../bench-model'),T=require('../guided-trials'),S=require('../session-files'),Files=require('../lab-files'),BB=require('../breadboard-model');
const near=(a,b,atol=1e-6,rtol=0)=>assert.ok(Math.abs(a-b)<=atol+rtol*Math.abs(b),`${a} != ${b}`);
const project=(p,analysis='time')=>({name:'Collaudo giornate 3 e 4',experiment:p.type,circuits:{[p.type]:p},analysis,layouts:{},session:{id:'local-days34-tests',createdAt:'2026-10-29T12:00:00.000Z'}});
test('four days contain the original five entries and all seven new circuits',()=>{
 assert.deepEqual([1,2,3,4].map(day=>L.CATALOG.filter(c=>c.day===day).length),[2,3,3,4]);
 for(const c of R.CATALOG){const p=L.defaults(c.type),d=project(p);assert.deepEqual(L.validate(p),{});assert.equal(L.parse(L.serialize(d)).experiment,c.id);assert.deepEqual(F.validate(L.circuit(d)),[]);assert.deepEqual(BB.verify(BB.create(L.circuit(d))),[]);}
});
test('ideal preamplifier integrates a finite pulse and discharges with Rf Cf',()=>{
 const p=L.defaults('preamp');p.opamp='ideal';p.wave1.period=.01;p.autoTime=false;p.duration=.001;p.samples=800;
 const tau=p.Rfpre*p.Cfpre,Tp=p.wave1.width,t0=p.wave1.delay,gain=-p.wave1.level*p.Rfpre/p.Rin,peak=gain*(-Math.expm1(-Tp/tau));
 for(const row of L.simulate(p)){const t=row.x-t0,expected=t<=0?0:t<Tp?gain*(-Math.expm1(-t/tau)):peak*Math.exp(-(t-Tp)/tau);near(row.out,expected,8e-6);}
 for(const f of [10,1/(2*Math.PI*tau),1e4,1e6]){const h=L.response(p,f),w=2*Math.PI*f*tau,k=p.Rfpre/p.Rin;near(h.real,-k/(1+w*w),1e-9);near(h.imag,k*w/(1+w*w),1e-9);}
});
test('equal CR RC step follows t/tau exp(-t/tau), and the Bode peak is one half',()=>{
 const p=L.defaults('shaper');p.opamp='ideal';p.wave1.kind='pulse';Object.assign(p.wave1,{level:1,low:0,delay:0,width:.003,period:.01});p.duration=.0003;p.autoTime=false;p.samples=800;const tau=p.Rsh1*p.Csh1;
 for(const r of L.simulate(p))near(r.out,r.x/tau*Math.exp(-r.x/tau),9e-6);
 const h=L.response(p,1/(2*Math.PI*tau));near(h.magnitude,.5,1e-10);near(h.phase,0,1e-9);
});
test('pole-zero compensation cancels the preamp pole, removes undershoot and preserves the designed transfer',()=>{
 const a=L.defaults('preamp-shaper'),b=L.defaults('pz-shaper');a.opamp=b.opamp='ideal';a.duration=b.duration=.001;a.autoTime=b.autoTime=false;
 const ra=L.simulate(a),rb=L.simulate(b);assert.ok(Math.min(...ra.map(r=>r.out))<-.005);assert.ok(Math.min(...rb.map(r=>r.out))>-2e-6);
 const k=b.Rfpre/b.Rin*b.Rsh1/(b.Rpz+b.Rsh1),t1=b.Csh1/(1/b.Rpz+1/b.Rsh1),t2=b.Rsh2*b.Csh2;
 for(const f of [10,1000,1e4,1e6]){const w=2*Math.PI*f,re=1-w*w*t1*t2,im=w*(t1+t2),den=re*re+im*im,h=L.response(b,f);near(h.real,-k*re/den,1e-9);near(h.imag,k*im/den,1e-9);}
});
test('optional output buffer isolates the shaper from the oscilloscope load',()=>{
 const a=L.defaults('shaper-buffer');a.opamp='ideal';a.duration=.0004;a.autoTime=false;a.bench={...B.defaults(),mode:'real',rg:0,wireR:0,scopeR:10000,scopeC:0,channels:[{enabled:false,target:'input',kind:'direct',coupling:'dc',length:0},{enabled:true,target:'output',kind:'direct',coupling:'dc',length:0}]};
 const b=F.clone(a);b.outputBuffer=false;const buffered=Math.max(...L.simulate(a).map(r=>r.out)),loaded=Math.max(...L.simulate(b).map(r=>r.out));near(buffered,1/Math.E,2e-5);assert.ok(loaded<buffered*.8);
});
test('simple and biased final stages meet both DAQ targets; full chain can include real instruments',()=>{
 for(const type of ['noninverting','detector-chain'])for(const key of ['simple','bias']){
  const p=R.applyPreset(L.defaults(type),key).parameters,rows=L.simulate(p),base=rows.filter(r=>r.x<p.wave1.delay).at(-1).out,peak=Math.max(...rows.map(r=>r.out))-base;
  near(base,key==='bias'?-.9:0,2e-4);near(peak,key==='bias'?1.8:3,3e-3);
  const d=L.circuit(project(p)),bias=d.components.find(c=>c.id==='Vbias');assert.equal(Boolean(bias),key==='bias');assert.deepEqual(BB.verify(BB.create(d)),[]);
 }
 const p=L.defaults('detector-chain');p.bench={mode:'real'};const d=L.network(p);assert.ok(d.components.length>40);assert.deepEqual(F.validate(d),[]);assert.equal(B.remove(d).components.length,R.network({...p,bench:{mode:'ideal'}}).components.length);
});
test('charge linearity has physical charge units, a fitted slope, residuals and repeatable reopened results',()=>{
 const p=L.defaults('preamp');p.opamp='ideal';p.chargePoints=5;const rows=L.charge(p),tau=p.Rfpre*p.Cfpre;
 for(const r of rows){near(r.x,Math.abs(p.wave1.level)*r.width/p.Rin,1e-22);near(r.out,p.Rfpre/p.Rin*(-Math.expm1(-r.width/tau)),1e-5);near(r.residual,r.out-r.linear,1e-12);}
 const d=project(p,'charge');T.select(d,'linearity',L.CATALOG);const record=S.capture(null,L.serialize(d),{analysis:'charge',quantity:'voltage',csv:L.csv(p,'charge',rows),svg:'<svg xmlns="http://www.w3.org/2000/svg"/>',count:rows.length});
 const bundle=S.bundle([record],d.name,d.session),archive=Files.unzipSession(Files.zipSession(bundle.files)),entry=bundle.manifest.trials[0],reopened=L.parse(new TextDecoder().decode(archive[entry.project]));
 assert.deepEqual(L.charge(reopened.circuits.preamp),rows);assert.match(new TextDecoder().decode(archive[entry.project.slice(0,-5)+'-charge.csv']),/Qin_C,Vout_picco_V/);
 const changed=F.clone(d);changed.circuits.preamp.Cfpre*=2;assert.deepEqual(S.capture(record,L.serialize(changed)).analyses,{});
 const layout=F.clone(d);layout.layouts.preamp={Rin:{x:300,y:250}};assert.ok(S.capture(record,L.serialize(layout)).analyses.charge);
});
test('every new situation produces a valid portable circuit and keeps its identity',()=>{
 for(const c of R.CATALOG)for(const[key]of T.PRESETS[c.type]){
  const trial=R.applyPreset(L.defaults(c.type),key),p=trial.parameters,d=project(p,trial.analysis);assert.deepEqual(L.validate(p),{},c.id+' '+key);T.select(d,key,L.CATALOG);
  const reopened=L.parse(L.serialize(d));assert.equal(T.current(reopened,L.CATALOG).modified,false);assert.deepEqual(F.validate(L.circuit(reopened)),[]);
  if(trial.analysis==='time'){try{assert.ok(L.simulate(p).every(r=>Number.isFinite(r.out)));}catch(e){throw Error(c.id+' / '+key+': '+e.message);}}
 }
});
test('invalid new parameters are rejected without changing the saved project',()=>{
 const p=L.defaults('preamp'),d=project(p),original=L.serialize(d);
 for(const mutation of [q=>q.Rin=0,q=>q.Cfpre=-1,q=>q.wave1.width=0,q=>q.wave1.period=1e-9,q=>q.chargePoints=100,q=>q.chargeMax=q.chargeMin]){const changed=F.clone(d);mutation(changed.circuits.preamp);assert.throws(()=>L.parse(L.serialize(changed)));assert.equal(L.serialize(d),original);}
});
test('new stages reuse the measured components when first added to a guided session',()=>{
 const a=project(L.defaults('preamp'));a.circuits.preamp.Cfpre=330e-12;a.circuits.preamp.Rin=220e3;
 const b=L.selectExperience(a,'shaper');b.circuits.shaper.Csh1=3.3e-9;b.circuits.shaper.Rsh1=22000;
 const c=L.selectExperience(b,'pz-shaper'),p=c.circuits['pz-shaper'];assert.equal(p.Cfpre,330e-12);assert.equal(p.Rin,220e3);assert.equal(p.Csh1,3.3e-9);assert.equal(p.Rsh1,22000);near(p.Rpz,p.Rfpre*p.Cfpre/p.Csh1,1e-9);
 assert.equal(a.circuits.preamp.Cfpre,330e-12);assert.equal(a.circuits.shaper,undefined);
});
test('reports declare the charge scan and time CSV preserves the intermediate stage signals',()=>{
 const p=L.defaults('detector-chain'),d=project(p,'charge'),before=L.serialize(d),html=Files.report(d);assert.match(html,/Qin =/);assert.match(html,/residuo = picco/);assert.match(html,/Durata minima/);assert.match(html,/Nessuna incertezza sperimentale/);assert.equal(L.serialize(d),before);
 const rows=L.simulate(p),csv=L.csv(p,'time',rows);assert.match(csv,/tempo_s,Vg_V,IN_V,PRE_V,SHAPER_V,OUT_V,I_Rin_A/);const line=csv.trim().split('\r\n')[100].split(',').map(Number);near(line[3],rows[99].pre,1e-12);near(line[4],rows[99].shaper,1e-12);
});
test('physical opamp model is usable in every new network',()=>{
 for(const c of R.CATALOG){const p=L.defaults(c.type);p.opamp='physical';const rows=L.simulate(p);assert.ok(rows.length>400,c.type);assert.ok(rows.every(r=>Number.isFinite(r.out)),c.type);}
});
