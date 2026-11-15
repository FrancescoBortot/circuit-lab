const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../lab-model');
const Q=require('../lab-quality');
const C=require('../lab-transient-comparison');

test('rectifier compares only load and then only frequency while retaining the filter',()=>{
 const params={...L.defaults('half-wave-rc'),C1:33e-6,RL:3900};
 Object.assign(params.wave1,{vpp:8,offset:.2,phase:45});
 const doc={circuits:{'half-wave-rc':params}};
 const baseline=JSON.stringify(params);
 const load=C.setup(doc,params,'load'),frequency=C.setup(doc,params,'frequency');
 assert.deepEqual(load.map(c=>c.params.externalLoad),[false,true]);
 assert.deepEqual(frequency.map(c=>c.params.wave1.frequency),[50,1000]);
 assert.deepEqual(frequency.map(c=>c.params.externalLoad),[true,true]);
 for(const {params:p} of [...load,...frequency]){
  assert.equal(p.C1,33e-6);
  assert.equal(p.RL,3900);
  assert.equal(p.wave1.vpp,10);
  assert.equal(p.wave1.offset,0);
  assert.equal(p.wave1.phase,0);
  assert.deepEqual(p.bench,load[0].params.bench);
 }
 assert.equal(JSON.stringify(params),baseline);
 const low=Q.analyze(frequency[0].params),high=Q.analyze(frequency[1].params);
 assert.ok(high.values.ripple<low.values.ripple);
 const normalized=C.series(high,frequency[1].params,{phase:true});
 assert.ok(Math.abs(normalized[0].x)<1e-12);
 assert.ok(Math.abs(normalized.at(-1).x-1)<1e-12);
});

test('amplifier normalization preserves gain and removes the time-weighted output mean',()=>{
 const params=L.defaults('mos-amplifier');
 const cases=C.setup({circuits:{}},params,'load');
 assert.deepEqual(cases.map(c=>c.params.wave1.vpp),[.1,1]);
 assert.deepEqual(cases.map(c=>c.params.wave1.frequency),[3000,3000]);
 const {params:p}=cases[0],period=1/p.wave1.frequency;
 const data=[{x:0,vin:0,out:8},{x:period/2,vin:2,out:2},{x:period,vin:0,out:8}];
 const normalized=C.series({data},p,{normalized:true});
 assert.deepEqual(normalized.map(row=>row.out),[1.5,-1.5,1.5]);
});

test('both inverter entry points preserve the active nMOS model, paired parts and square-wave transitions',()=>{
 const n={...L.defaults('nmos-inverter'),RD:12000,mosVto:1.7};
 const c={...L.defaults('cmos-inverter'),pKp:.0011};
 const doc={circuits:{[n.type]:n,[c.type]:c}};
 const trials=C.setup(doc,n);
 assert.equal(trials[0].params.RD,12000);
 assert.equal(trials[1].params.pKp,.0011);
 assert.deepEqual(C.setup(doc,c).map(t=>t.params.mosVto),[c.mosVto,c.mosVto]);
 const values=trials.map(({params})=>Q.analyze(params));
 assert.ok(values[0].values.truth[1].out>values[1].values.truth[1].out);
 const p=trials[0].params,period=1/p.wave1.frequency;
 const rows=C.series({data:[
  {x:0,vin:0,out:5},{x:period*.75,vin:0,out:5},
  {x:period*1.5,vin:0,out:5},{x:period*1.5,vin:5,out:.1},{x:period*2,vin:5,out:.1}
 ]},p);
 assert.deepEqual(rows.slice(1,3).map(row=>row.out),[5,.1]);
 assert.equal(rows[1].x,rows[2].x);
});

test('guided comparisons isolate the intended instrument, circuit or model change',()=>{
 const compare=(type,mode='')=>{
  const source=L.defaults(type),before=JSON.stringify(source),analysis=C.analysisFor(type,mode);
  const curves=C.setup({circuits:{}},source,mode).map(trial=>{
   assert.deepEqual(L.validate(trial.params),{});
   return {...trial,...Q.analyze(trial.params,analysis)};
  });
  assert.equal(JSON.stringify(source),before);
  return {curves,metrics:curves.map(curve=>C.measurements(curve,analysis))};
 };
 const rc=compare('rc');
 assert.ok(rc.metrics[0][0]<rc.metrics[1][0]);
 assert.ok(Math.abs(rc.metrics[1][0]-rc.metrics[1][1])<.02*rc.metrics[1][1]);
 const bode=compare('inverting');
 assert.equal(bode.metrics[0][1],undefined);
 const {a0,gbw,R1,Rf}=bode.curves[1].params,noiseGain=1+Rf/R1;
 assert.ok(Math.abs(bode.metrics[1][1]/(gbw*(a0+noiseGain)/(a0*noiseGain))-1)<.001);
 const step=compare('shaper-buffer'),ac=compare('shaper-buffer','bode');
 assert.ok(step.metrics[1][0]>step.metrics[0][0]);
 assert.ok(ac.metrics[1][1]>ac.metrics[0][1]);
 const pz=compare('pz-shaper');
 assert.ok(Math.abs(pz.metrics[1][0])<Math.abs(pz.metrics[0][0]));
 assert.ok(Math.abs(pz.metrics[1][1])<.05*Math.abs(pz.metrics[0][1]));
 const mos=compare('mos-iv').curves.map(c=>c.values);
 assert.ok(mos[1].id<mos[0].id);
 assert.ok(mos[1].vgs<mos[0].vgs);
 const gates=compare('nmos-nor').curves;
 assert.deepEqual(gates.map(c=>c.values.truth.map(row=>row.level)),[['1','0','0','0'],['1','1','1','0']]);
 const gate=gates[0],rows=C.trace(gate,{analysis:'time'});
 assert.ok(Number.isFinite(C.interpolate(rows,.006,'vin2')));
});
