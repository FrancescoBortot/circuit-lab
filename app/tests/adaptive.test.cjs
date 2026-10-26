const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../free-model.js');
function rc(tau=.001){const d=M.example('rc');d.settings.samples=400;d.settings.integration='adaptive';d.components.find(c=>c.type==='C').value=tau/1e4;return d;}
test('adaptive RC resolves a fast initial layer to the declared scale',()=>{
  const d=rc(1e-6);d.settings.duration=.006;d.settings.rtol=1e-7;const r=M.simulate(d);
  const error=Math.max(...r.data.map(p=>Math.abs(p.out-5*(-Math.expm1(-p.x/1e-6)))));
  assert.ok(error<2e-5,error);assert.ok(r.numerics.rejected>0);assert.ok(r.numerics.maxErrorRatio<=1);assert.ok(r.numerics.minStep<1e-7);assert.equal(r.data.at(-1).x,.006);
});
test('tighter adaptive tolerance improves RC without changing the initial constraint',()=>{
  const d=rc(1e-5);d.settings.duration=.001;d.settings.rtol=.001;
  const loose=M.simulate(d);d.settings.rtol=1e-7;const tight=M.simulate(d);
  const error=r=>Math.max(...r.data.map(p=>Math.abs(p.out-5*(-Math.expm1(-p.x/1e-5)))));
  assert.ok(error(tight)<error(loose)/5);assert.equal(tight.data[0].out,0);assert.ok(tight.maxResidual<1e-5);
});
test('adaptive integration preserves both sides of source events and capacitor continuity',()=>{
  const d=rc();Object.assign(d.components[0].wave,{kind:'pulse',delay:.001,width:.002});const r=M.simulate(d);
  for(const time of [.001,.003]){const rows=r.data.filter(p=>p.x===time);assert.equal(rows.length,2);assert.ok(Math.abs(rows[0].out-rows[1].out)<1e-10);assert.notEqual(rows[0].vin,rows[1].vin);}
  const expected=5*(1-Math.exp(-2))*Math.exp(-3);assert.ok(Math.abs(r.data.at(-1).out-expected)<1e-5);
});
test('adaptive RLC tracks an independent underdamped analytical step',()=>{
  const d=rc();d.components.find(c=>c.type==='R').value=100;d.components.find(c=>c.type==='C').value=1e-6;
  d.components.push(Object.assign(M.component('L','L1'),{value:.01}));d.wires.find(w=>w.a==='R1:b').a='L1:b';d.wires.push({id:'WL',a:'R1:b',b:'L1:a'});
  d.settings.duration=.002;d.settings.rtol=1e-6;
  const a=5000,w=Math.sqrt(1e8-a*a),r=M.simulate(d);
  const error=Math.max(...r.data.map(p=>Math.abs(p.out-5*(1-Math.exp(-a*p.x)*(Math.cos(w*p.x)+a/w*Math.sin(w*p.x))))));
  assert.ok(error<2e-4,error);assert.ok(r.data.some(p=>p.out>5));
});
test('progress is monotonic and cancellation never returns a completed solution',()=>{
  const d=rc(),progress=[];M.simulate(d,{onProgress:x=>progress.push(x)});assert.equal(progress[0],0);assert.equal(progress.at(-1),1);assert.ok(progress.every((v,i)=>!i||v>=progress[i-1]));
  let count=0;assert.throws(()=>M.simulate(d,{cancelled:()=>++count>2}),/annullato/);
});
test('adaptive settings reject invalid tolerances and remain portable',()=>{
  const d=rc();assert.deepEqual(M.parse(M.serialize(d)),d);d.settings.rtol=0;assert.throws(()=>M.simulate(d),/Tolleranza/);
});
test('adaptive opamp clipping remains inside the feedback constraints and releases',()=>{
  const d=M.example('inverting');d.components[0].wave.vpp=10;Object.assign(d.settings,{integration:'adaptive',samples:400,rtol:1e-6});
  const r=M.simulate(d);assert.ok(r.data.some(p=>p.clipped));assert.ok(r.data.every(p=>Math.abs(p.out)<=13.50000001));assert.ok(Math.abs(r.data.at(-1).out)<.2);assert.ok(r.maxResidual<1e-5);
});
test('adaptive endpoints do not create a spurious near-zero final step',()=>{
  for(const samples of [400,1200,2400,12000]){const d=rc();Object.assign(d.settings,{samples,rtol:1e-7});const r=M.simulate(d);assert.equal(r.data.at(-1).x,d.settings.duration);assert.ok(r.maxResidual<1e-5);assert.ok(r.numerics.minStep>1e-12);}
});
test('factorization reuse never rounds the time step and corrupts an inductor residual',()=>{
  for(const integration of ['fixed','adaptive']){const d=rc();Object.assign(d.components.find(c=>c.id==='C1'),{type:'L',value:1});d.components.find(c=>c.id==='R1').value=1000;Object.assign(d.settings,{samples:1200,integration,rtol:1e-7});const r=M.simulate(d);assert.ok(r.maxResidual<1e-7,r.maxResidual);assert.ok(Math.abs(r.data.at(-1).out-5*Math.exp(-6))<2e-6);}
});
