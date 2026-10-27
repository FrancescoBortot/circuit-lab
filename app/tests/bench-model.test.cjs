const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../free-model.js'),B=require('../bench-model.js'),L=require('../lab-model.js');
const copy=M.clone,real=(extra={})=>({...B.defaults(),mode:'real',wireR:0,...extra});
const z=(r,i=0)=>({r,i}),add=(a,b)=>z(a.r+b.r,a.i+b.i),mul=(a,b)=>z(a.r*b.r-a.i*b.i,a.r*b.i+a.i*b.r),div=(a,b)=>z((a.r*b.r+a.i*b.i)/(b.r*b.r+b.i*b.i),(a.i*b.r-a.r*b.i)/(b.r*b.r+b.i*b.i)),inv=a=>div(z(1),a),par=(...a)=>inv(a.reduce((s,v)=>add(s,inv(v)),z(0))),cap=(c,f)=>z(0,-1/(2*Math.PI*f*c));
function close(a,b,tol=1e-8){assert.ok(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);}
const ch=(target='output',kind='direct',coupling='dc',enabled=true,length=1)=>({target,kind,coupling,enabled,length});
function h(d,f){const p=M.bode(d,{frequencies:[f]}).data[0];return z(p.real,p.imag);}
function loadCircuit(){const d=M.example('rc');Object.assign(d.components.find(c=>c.id==='C1'),{type:'R',value:20000});Object.assign(d.settings,{analysis:'bode',acReference:'source'});return d;}
test('real setup is reversible, reconfiguration does not accumulate components, nominal value edits survive',()=>{
 const d=M.example('rc'),before=M.serialize(d),a=B.apply(d,real());assert.equal(M.serialize(d),before);assert.equal(M.serialize(B.remove(a)),before);const b=B.apply(a,real({rg:75}));assert.equal(b.components.length,a.components.length);b.components.find(c=>c.id==='R1').value=15000;assert.equal(B.remove(b).components.find(c=>c.id==='R1').value,15000);assert.equal(B.apply(b,{mode:'ideal'}).benchSetup,undefined);
});
test('rewired instrument branches are not silently discarded and failed changes are atomic',()=>{
 const d=B.apply(M.example('rc'),real());d.wires.find(w=>d.benchSetup.wires.includes(w.id)).b='G2:g';const before=M.serialize(d);assert.throws(()=>B.remove(d),/modificati/);assert.equal(M.serialize(d),before);const crowded=M.example('rc');for(let i=0;i<34;i++)crowded.components.push(M.component('J','J'+i));assert.throws(()=>B.apply(crowded,real()),/componenti/);assert.equal(crowded.benchSetup,undefined);
});
test('real setup rejects invalid numerical parameters and impossible AC probe compensation',()=>{
 for(const extra of [{rg:NaN},{wireR:-1},{scopeC:-1},{acC:0},{wireR:.001},{channels:[]}])assert.throws(()=>B.config(real(extra)));
 assert.throws(()=>B.config(real({probeR:1e6,channels:[ch('input','probe10','ac'),ch()]})),/Sonda AC/);
 for(const value of [0,-1,Infinity,1001]){const d=M.example('rc');d.settings.probeScaleOutput=value;assert.ok(M.validate(d).length);}
});
test('direct oscilloscope channels match independent complex RC loading, for both Bode references',()=>{
 for(const f of [1,100,1000,100000]){const d=M.example('rc');d.settings.acReference='source';const c=real(),a=B.apply(d,c),w=2*Math.PI*f,R=10000,C=100e-9,Zout=inv(z(1/c.scopeR,w*(C+c.scopeC+c.cableC))),Zinput=inv(z(1/c.scopeR,w*(c.scopeC+c.cableC))),Zin=par(Zinput,add(z(R),Zout)),expected=mul(div(Zin,add(z(c.rg),Zin)),div(Zout,add(z(R),Zout))),v=h(a,f);close(v.r,expected.r);close(v.i,expected.i);a.settings.acReference='input';const rel=h(a,f),e=div(Zout,add(z(R),Zout));close(rel.r,e.r);close(rel.i,e.i);}
});
test('direct AC coupling matches the series capacitor plus cable and scope impedance',()=>{
 const c=real({channels:[ch('input','direct','dc',false),ch('output','direct','ac')]}),d=B.apply(loadCircuit(),c);for(const f of [.1,8,1000,100000]){const Zscope=par(z(c.scopeR),cap(c.scopeC,f)),Zbranch=add(cap(c.acC,f),Zscope),Ztip=par(z(20000),cap(c.cableC,f),Zbranch),Zin=add(z(10000),Ztip),e=mul(div(Ztip,add(z(c.rg),Zin)),div(Zscope,Zbranch)),v=h(d,f);close(v.r,e.r);close(v.i,e.i);}
});
test('DC probe uses only the equivalent RE and CE, without counting the cable or scope again',()=>{
 const c=real({channels:[ch('input','direct','dc',false),ch('output','probe10','dc',true,10)]}),d=B.apply(loadCircuit(),c),parts=d.components.filter(p=>p.benchRole);assert.equal(parts.filter(p=>p.type==='C').length,1);assert.equal(parts.find(p=>p.type==='C').value,c.probeC);assert.equal(parts.some(p=>/^CO|^CC|^RO/.test(p.id)),false);for(const f of [1,1000,1e6]){const Z=inv(z(1/20000+1/c.probeR,2*Math.PI*f*c.probeC)),e=div(Z,add(z(10000+c.rg),Z)),v=h(d,f);close(v.r,e.r);close(v.i,e.i);}
});
test('AC probe compensated divider has the correct tip impedance and calibrated measured voltage',()=>{
 const c=real({channels:[ch('input','direct','dc',false),ch('output','probe10','ac')]}),d=B.apply(loadCircuit(),c);for(const f of [.1,10,1000,1e6]){const Zscope=par(z(c.scopeR),cap(c.scopeC,f)),Zac=add(cap(c.acC,f),Zscope),Zupper=par(z(c.probeR-c.scopeR),cap(c.probeC*c.probeR/(c.probeR-c.scopeR),f)),Zconnector=par(Zac,cap(c.probeC*c.probeR/c.scopeR-c.scopeC,f)),Ztip=par(z(20000),add(Zupper,Zconnector)),e=mul(mul(div(Ztip,add(z(10000+c.rg),Ztip)),div(Zconnector,add(Zupper,Zconnector))),mul(div(Zscope,Zac),z(c.probeR/c.scopeR))),v=h(d,f);close(v.r,e.r);close(v.i,e.i);}
 close(h(d,0).r,0);assert.equal(d.settings.probeScaleOutput,10);
});
test('lead resistances are included in the actual DC branch current',()=>{
 const c=real({wireR:.05,channels:[ch('input','direct','dc',false),ch('output','direct','dc',false)]}),base=loadCircuit();Object.assign(base.components[0].wave,{kind:'dc',level:5});const d=B.apply(base,c),r=M.operatingPoint(d).data[0],expected=5/(10000+20000+50+base.wires.length*c.wireR);close(r.currents.R1,expected,1e-12);assert.equal(d.components.filter(c=>c.id.startsWith('RW')).length,base.wires.length);
});
test('probe calibration affects readings and transfer ratio while physical node values and currents stay unchanged',()=>{
 const d=M.example('rc'),base=M.simulate(d,{steps:40});d.settings.probeScaleInput=2;d.settings.probeScaleOutput=10;const r=M.simulate(d,{steps:40});for(let i=0;i<r.data.length;i++){close(r.data[i].vin,2*base.data[i].vin);close(r.data[i].out,10*base.data[i].out);assert.deepEqual(r.data[i].values,base.data[i].values);assert.deepEqual(r.data[i].currents,base.data[i].currents);}d.components[0].wave.dc=5;close(M.operatingPoint(d).data[0].out,50);d.settings.acReference='input';const b=M.clone(d);delete b.settings.probeScaleInput;delete b.settings.probeScaleOutput;close(h(d,1000).r,5*h(b,1000).r);
});
test('added shunt capacitances inherit consistent initial voltages for a charged RC capacitor',()=>{
 const p=L.defaults('rc');p.initial=5;p.wave1.kind='discharge';p.bench=real();const d=L.network(p),values=M.initialVoltages(d);close(values[d.probes.output],5);const r=L.simulate(p);close(r[0].out,5);assert.ok(Math.abs(r.at(-1).out)<.02);assert.equal(B.remove(d).components.find(c=>c.id==='C1').initial,5);
});
test('ideal opamp with DC excitation initializes its real output load consistently',()=>{
 const p=L.defaults('inverting');p.opamp='ideal';p.wave1.kind='dc';p.wave1.level=.1;p.bench=real();const d=L.network(p),v=M.initialVoltages(d);assert.ok(v[d.probes.output]<-.4);assert.ok(v[d.probes.output]>-.5);
});
test('all four guided real circuits export the same physical network used for their simulation',()=>{
 for(const type of ['rc','inverting','derivative','difference']){const p=L.defaults(type);p.bench={...B.defaults(),mode:'real'};const doc={name:type,experiment:type,analysis:'time',circuits:{[type]:p},layouts:{}},d=L.circuit(doc);assert.equal(d.components.length,L.network(p).components.length);assert.equal(M.validate(d).length,0);const r=L.simulate(p);assert.ok(r.length>100);assert.ok(r.every(row=>Number.isFinite(row.out)));const q=L.parse(L.serialize(doc));assert.deepEqual(q.circuits[type].bench,p.bench);}
});
test('CMRR uses both source impedances and matches independent differential/common resistor equations',()=>{
 const p=L.defaults('difference');p.opamp='ideal';p.R4=48000;p.bench=real({channels:[ch('input','direct','dc',false),ch('output','direct','dc',false)]});const Rg=p.bench.rg,a1=-p.Rf/(p.R1+Rg),a2=(1+p.Rf/(p.R1+Rg))*p.R4/(p.R3+Rg+p.R4),ad=(a2-a1)/2,ac=a1+a2;close(L.response(p,1000,'differential').magnitude,Math.abs(ad));close(L.response(p,1000,'common').magnitude,Math.abs(ac));assert.equal(L.metrics(p).length,3);assert.match(L.metrics(p)[2].value,/dB/);
});
test('Bode cutoff extraction interpolates -3 dB relative to the displayed peak and handles zero response',()=>{
 const fc=1000,data=Array.from({length:601},(_,i)=>{const x=1*10**(6*i/600);return{x,magnitude:1/Math.hypot(1,x/fc)};}),m=L.curveMetrics(data);assert.match(m[0].value,/1 kHz/);assert.match(m[0].note,/maximum|massimo/);assert.deepEqual(L.curveMetrics(data.map(p=>({...p,magnitude:0}))),[]);
});

test('redundant ideal amplifier IC currents stay unreported and incompatible output ICs are rejected',()=>{const p=L.defaults('inverting');p.opamp='ideal';p.wave1.kind='dc';p.wave1.level=.1;p.bench=real();const d=L.network(p),r=M.simulate(d,{steps:10});assert.ok(Number.isNaN(r.data[0].currents.U1));assert.ok(r.data.every(row=>Math.abs(row.out+.47)<.01));assert.ok(Math.abs(r.data.at(-1).out-M.operatingPoint(d).data[0].out)<1e-6);const c=d.components.find(c=>c.benchRole?.includes('CH2')&&c.type==='C');c.initial=1;assert.throws(()=>M.initialVoltages(d),/incompatibil/);});
test('instrument ngspice references match the current model files exactly',()=>{const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.join(__dirname,'..'),r=JSON.parse(fs.readFileSync(path.join(root,'benchmark/instruments/results.json')));assert.equal(r.pass,true);assert.equal(r.externalConnectionDuringSimulation,false);assert.equal(r.cases.length,8);assert.ok(r.cases.every(c=>c.pass&&c.compared>100&&c.maxAbsoluteError<c.tolerance));for(const[file,hash]of Object.entries(r.hashes))assert.equal(hash,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'));});
test('initial current ambiguity does not admit floating voltages or incompatible ideal sources',()=>{const d=M.example('rc');d.components.push(M.component('R','Floating',100,100));assert.throws(()=>M.initialVoltages(d));const bad=M.example('rc');bad.wires.push({id:'Bad',a:'V1:p',b:'G1:g'});assert.throws(()=>M.initialVoltages(bad));});
test('guided real VTC converges for the default DC-coupled instrument configuration',()=>{const p=L.defaults('inverting');p.bench={...B.defaults(),mode:'real'};p.sweepPoints=11;p.sweepMax=.2;const d=L.vtc(p);assert.equal(d.length,11);assert.ok(d.every(row=>Number.isFinite(row.out)));assert.ok(d.at(-1).out>.9&&d.at(-1).out<.95);});

test('CMRR uses one DC operating point for both excitations and never calls 0/0 infinite rejection',()=>{const p=L.defaults('difference');p.wave1.offset=10;p.drive='v1';p.bench={...B.defaults(),mode:'real'};const rows=L.metrics(p);assert.match(rows[2].value,/Non definito/);assert.match(rows[2].note,/Stesso montaggio e punto di lavoro/);});

test('AC probe initial capacitor divider reports the nominal node voltage, not a spurious 10x jump',()=>{const p=L.defaults('rc');p.initial=5;p.wave1.kind='discharge';p.bench=real({channels:[ch('input','direct','dc',false),ch('output','probe10','ac')]});const d=L.network(p),row=M.simulate(d,{steps:100}).data[0];close(row.out,5);const C=d.components.find(c=>c.id==='CP1');close(C.initial,4.5);});
test('real AC-coupled RC measurement context preserves its valid Bode without inventing a DC ratio',()=>{const p=L.defaults('rc');p.bench=real({channels:[ch('input','direct','ac'),ch('output','direct','ac')]});const d={name:'RC AC',experiment:'rc',analysis:'bode',circuits:{rc:p},layouts:{}},ctx=require('../study-context.js').build(L.serialize(d));assert.equal(ctx.bode.length,601);assert.equal(ctx.acError,null);assert.equal(ctx.dcGain,null);assert.equal(ctx.onePole,false);});

test('real transient exports label calibrated readings and leave unavailable unlimited predictions blank',()=>{const p=L.defaults('inverting');p.bench={...B.defaults(),mode:'real'};const r=L.simulate(p);assert.ok(r.every(row=>Number.isNaN(row.linear)));const csv=L.csv(p,'time',r);assert.match(csv,/IN_lettura_V/);assert.equal(csv.split('\r\n')[1].split(',')[5],'');});
