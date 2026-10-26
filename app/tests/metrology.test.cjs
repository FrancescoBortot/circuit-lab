const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../free-model.js'),G=require('../lab-model.js');
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('RC branch currents obey KCL with their documented signs',()=>{
 const doc=F.example('rc'),r=F.simulate(doc);
 assert.ok(Number.isNaN(r.data[0].currents.C1));
 for(const d of r.data.slice(1).filter((_,i)=>i%37===0)){
  near(d.currents.R1,(d.vin-d.out)/10000);near(d.currents.C1,d.currents.R1,1e-11);near(d.currents.V1,-d.currents.R1,1e-11);
 }
});
test('SDIRK2 converges at second order on a smooth RC discharge',()=>{
 const doc=F.example('rc');doc.settings.duration=.006;doc.settings.samples=400;
 doc.components.find(c=>c.id==='V1').wave.level=0;doc.components.find(c=>c.id==='C1').initial=5;
 const coarse=F.simulate(doc),fine=F.simulate(doc,{refinement:2}),expected=5*Math.exp(-6);
 const a=Math.abs(coarse.data.at(-1).out-expected),b=Math.abs(fine.data.at(-1).out-expected);
 assert.ok(a/b>3.8&&a/b<4.2);assert.ok(coarse.maxResidual<1e-5);
 const q=F.convergence(doc,coarse);assert.ok(q.relative<.0001&&q.fine>q.coarse);
});
test('a lossless LC oscillation keeps its frequency and energy under refinement',()=>{
 const d=F.example('rc');d.components.find(c=>c.id==='R1').type='L';d.components.find(c=>c.id==='R1').value=1;d.components.find(c=>c.id==='R1').initial=0;
 d.components.find(c=>c.id==='C1').value=1e-6;d.components.find(c=>c.id==='C1').initial=1;
 d.components.find(c=>c.id==='V1').wave.level=0;d.settings.duration=.02;d.settings.samples=4000;
 const r=F.simulate(d);for(const row of r.data.filter((_,i)=>i%101===0)){
  near(row.out,Math.cos(1000*row.x),1e-5);near(.5e-6*row.out**2+.5*row.currents.R1**2,.5e-6,1e-10);
 }
});
test('limited opamps use the identical transient in guided and free modes',()=>{
 for(const type of ['inverting','derivative','difference']){
  const p=G.defaults(type);p.wave1.vpp=10;if(type==='difference'){p.drive='common';p.R4*=1.01;}
  const a=G.simulate(p),b=F.simulate(F.example(type,p)).data;
  assert.equal(a.length,b.length);for(let i=0;i<a.length;i+=61){near(a[i].out,b[i].out);assert.equal(a[i].clipped,b[i].clipped);}
 }
});
test('differential source conversion preserves inversion for an asymmetric duty cycle',()=>{
 const p=G.defaults('difference');p.drive='differential';p.wave1.kind='square';p.wave1.duty=30;
 const doc=F.example('difference',p),a=doc.components.find(c=>c.id==='V1'),b=doc.components.find(c=>c.id==='V2');
 assert.deepEqual(F.parse(F.serialize(doc)),doc);
 for(const time of [.00001,.0002,.0004,.0008]){const u=G.inputs(p,time);near(F.source(a.wave,time),u[0]);near(F.source(b.wave,time),u[1]);}
});
test('voltage and current probes round-trip, retain terminal references and enter CSV',()=>{
 const doc=F.example('rc');doc.traces=[{id:'P1',kind:'voltage',positive:'R1:a',negative:'C1:a'},{id:'P2',kind:'current',component:'R1'}];
 assert.deepEqual(F.parse(F.serialize(doc)),doc);const result=F.simulate(doc),row=result.data[100];
 near(F.traceValue(doc,row,doc.traces[0]),row.vin-row.out);near(F.traceValue(doc,row,doc.traces[1]),row.currents.R1);
 const csv=F.csv(doc,result);assert.match(csv,/I_R1_A/);assert.match(csv,/P1_V,P2_A/);
 doc.traces[0].positive='MISSING:a';assert.throws(()=>F.serialize(doc),/sonda non valido/);
});
test('opamp output current is positive when delivered to its feedback resistor',()=>{
 const doc=F.example('inverting'),r=F.simulate(doc);
 for(const row of r.data.slice(1).filter((_,i)=>i%131===0))near(row.currents.U1,-row.currents.Rf,1e-10);
});
test('loaded RC slide benchmark matches an independent two-node AC equation',()=>{
 const doc=require('../esempi/rc-caricato-slide.json');
 const div=(ar,ai,br,bi)=>[(ar*br+ai*bi)/(br*br+bi*bi),(ai*br-ar*bi)/(br*br+bi*bi)];
 for(const f of [1,1000,1e6]){
  doc.settings.fmin=f;doc.settings.fmax=f*10;
  const g=1/100000,gg=1/50,go=1/1e7,w=2*Math.PI*f;
  const ar=gg+g,ai=w*100e-12,br=g+go,bi=w*(10e-9+15e-12);
  const [re,im]=div(gg*g,0,ar*br-ai*bi-g*g,ar*bi+ai*br),actual=F.bode(doc).data[0];
  near(actual.real,re,1e-10);near(actual.imag,im,1e-10);
 }
});
