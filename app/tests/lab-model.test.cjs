const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../lab-model.js');
function near(a,b,tol=1e-8){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);}
function sampleAt(data,t){return data.reduce((best,d)=>Math.abs(d.x-t)<Math.abs(best.x-t)?d:best);}
test('RC defaults match the component range and exact charge in the course sheet',()=>{
 const p=M.defaults('rc'),r=M.rcSummary(p),data=M.simulate(p);
 near(r.tau,.00047);near(r.cutoff,1/(2*Math.PI*.00047));
 const s=sampleAt(data,p.switchTime);near(s.out,5*(1-Math.exp(-4)),1e-8);
 near(data.at(-1).out,5*(1-Math.exp(-4))*Math.exp(-6));
});
test('RC AC gain and phase at the cutoff are -3.01 dB and -45 degrees',()=>{
 const p=M.defaults('rc'),h=M.response(p,M.rcSummary(p).cutoff);
 near(h.magnitude,1/Math.sqrt(2));near(h.phase,-45);
});
test('RC probe loading changes DC attenuation and capacitance, with both channels included',()=>{
 const p=M.defaults('rc');Object.assign(p,{instrument:'direct',rg:50,scopeR:1e6,scopeC:120e-12});
 const h=M.response(p,0),expected=1e6/(1e6+p.R);near(h.real,expected);
 const source=M.response(p,0,'generator');assert.ok(source.real<h.real);
 const data=M.simulate(p);assert.ok(data.every(d=>Number.isFinite(d.out)&&Number.isFinite(d.vin)));
 assert.ok(sampleAt(data,p.switchTime).out<5);
});
test('a finite generator resistance changes the ideal RC time constant correctly',()=>{
 const p=M.defaults('rc');Object.assign(p,{instrument:'generator',rg:100000});p.wave1.kind='charge';p.duration=.003;
 const d=M.simulate(p),s=sampleAt(d,.00094);
 near(s.out,5*(1-Math.exp(-s.x/.00094)),1e-8);
});
test('standalone discharge and a negative initial capacitor voltage are preserved',()=>{
 const p=M.defaults('rc');p.wave1.kind='discharge';p.initial=-3;p.duration=.002;
 const data=M.simulate(p);near(data[0].out,-3);near(data.at(-1).out,-3*Math.exp(-p.duration/(p.R*p.C)));
});
test('the ideal inverting amplifier has gain -Rf/R1 at every frequency',()=>{
 const p=M.defaults('inverting');p.opamp='ideal';
 for(const f of [0,30,1000,1e6]){const h=M.response(p,f);near(h.real,-4.7);near(h.imag,0);}
 const data=M.simulate(p);for(const s of data)near(s.out,-4.7*s.vin);
});
test('finite open-loop gain and noise gain set the closed-loop bandwidth',()=>{
 const p=M.defaults('inverting'),ng=1+p.Rf/p.R1,g=-p.a0*(p.Rf/p.R1)/(p.a0+ng);
 near(M.response(p,0).real,g);
 const fc=p.gbw*(p.a0+ng)/(p.a0*ng);
 near(M.response(p,fc).magnitude,Math.abs(g)/Math.sqrt(2));
});
test('10 Vpp input saturates the simplified TL082 at the configured rails',()=>{
 const p=M.defaults('inverting');p.wave1.vpp=10;const d=M.simulate(p),limit=p.rail-p.headroom;
 assert.ok(d.some(s=>s.clipped));assert.ok(d.every(s=>Math.abs(s.out)<=limit));
 const curve=M.vtc(p);near(curve.at(-1).out,2*limit);
});
test('an input offset clips one half of the Vpp transfer curve first',()=>{
 const p=M.defaults('inverting');p.wave1.offset=2;p.wave1.frequency=1;
 const point=M.vtc(p).find(s=>s.x===2),gain=4.7*p.a0/(p.a0+5.7);
 near(point.out,p.rail-p.headroom-gain,1e-8);
});
test('the inverting Bode phase remains continuous through the amplifier pole',()=>{
 const p=M.defaults('inverting');p.fmax=1e8;const data=M.bode(p);
 assert.ok(data[0].phase<-180&&data[0].phase>-181);
 assert.ok(data.at(-1).phase<-269&&data.at(-1).phase>-270);
 for(let i=1;i<data.length;i++)assert.ok(Math.abs(data[i].phase-data[i-1].phase)<2);
});
test('derivative network corner and high-frequency gain match the practical circuit',()=>{
 const p=M.defaults('derivative');p.opamp='ideal';const fc=1/(2*Math.PI*p.R1*p.C1);
 near(M.response(p,fc).magnitude,4.7/Math.sqrt(2));
 near(M.response(p,fc*1e6).magnitude,4.7,1e-8);
 near(M.response(p,0).magnitude,0);
});
test('a triangular signal produces the expected inverted derivative plateau',()=>{
 const p=M.defaults('derivative');p.opamp='ideal';const d=M.simulate(p),s=sampleAt(d,.00025);
 near(s.out,-p.Rf*p.C1*(2*p.wave1.vpp*p.wave1.frequency),1e-6);
});
test('finite-band derivative time response agrees with its independent phasor solution',()=>{
 const p=M.defaults('derivative');p.wave1.kind='sine';p.wave1.frequency=1000;p.duration=.004;p.samples=6000;
 const h=M.response(p,1000),data=M.simulate(p);
 for(const s of data.filter(d=>d.x>.002).filter((_,i)=>i%57===0)){
  const expected=p.wave1.vpp/2*(h.real*Math.sin(2*Math.PI*1000*s.x)+h.imag*Math.cos(2*Math.PI*1000*s.x));
  near(s.out,expected,1e-5);
 }
});
test('difference amplifier cancels common mode and has opposite input gains',()=>{
 const p=M.defaults('difference');p.opamp='ideal';const c=M.coefficients(p);
 near(c.a1,-4.7);near(c.a2,4.7);near(c.ad,4.7);near(c.ac,0);assert.equal(c.cmrr,Infinity);
 p.drive='common';for(const s of M.simulate(p))near(s.out,0);
});
test('perfect common-mode cancellation has zero gain and no defined phase',()=>{
 const p=M.defaults('difference');p.bodeInput='common';
 for(const h of M.bode(p)){assert.equal(h.magnitude,0);assert.equal(h.db,-Infinity);assert.ok(Number.isNaN(h.phase));}
});
test('mismatched feedback ratios produce the correct finite CMRR',()=>{
 const p=M.defaults('difference');p.opamp='ideal';p.R4*=1.01;const c=M.coefficients(p);
 const a1=-p.Rf/p.R1,a2=(1+p.Rf/p.R1)*p.R4/(p.R3+p.R4);
 near(c.cmrr,20*Math.log10(Math.abs((a2-a1)/(2*(a1+a2)))));assert.ok(Number.isFinite(c.cmrr));
});
test('independent 1 kHz and 100 Hz channels and the two offset steps follow the sheet',()=>{
 const p=M.defaults('difference');p.opamp='ideal';const d0=M.simulate(p);
 p.wave1.offset=1;const d1=M.simulate(p);
 p.wave2.offset=1;const d2=M.simulate(p);
 for(let i=0;i<d0.length;i++){near(d1[i].out-d0[i].out,-4.7);near(d2[i].out,d0[i].out);}
});
test('V1-ground and V2-ground cases measure A2 and A1 separately',()=>{
 const p=M.defaults('difference');p.opamp='ideal';p.drive='v2';
 for(const s of M.simulate(p))near(s.out,4.7*s.vin2);
 p.drive='v1';for(const s of M.simulate(p))near(s.out,-4.7*s.vin);
});
test('project serialization preserves separate circuits and diagram layouts',()=>{
 const state={name:'Prova',experiment:'difference',analysis:'bode',circuits:{rc:M.defaults('rc'),difference:M.defaults('difference')},layouts:{difference:{R1:{x:350,y:60,rotation:90}}}};
 assert.deepEqual(M.parse(M.serialize(state)),state);
 assert.throws(()=>M.parse('{bad'));
 const invalid=JSON.parse(M.serialize(state));invalid.circuits.rc.R=0;assert.throws(()=>M.parse(JSON.stringify(invalid)));
});
test('old RC Studio projects still import with their original physical values',()=>{
 const R=require('../rc-model.js');const old={...R.DEFAULTS,resistance:47000};const p=M.parse(R.project(old));
 assert.equal(p.circuits.rc.R,47000);assert.equal(p.circuits.rc.wave1.kind,'cycle');
});
