const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker}=require('node:worker_threads');
const M=require('../free-model.js');
const sourceFile=fs.readFileSync(path.join(__dirname,'../solver-source.js'),'utf8'),scope={window:{}};
vm.runInNewContext(sourceFile,scope);
const bridge="const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.module=undefined;self.postMessage=x=>parentPort.postMessage(x);parentPort.on('message',data=>self.onmessage({data}));\n";
function execute(action,payload){return new Promise((resolve,reject)=>{const w=new Worker(bridge+scope.window.CircuitSolverSource,{eval:true}),progress=[];w.on('message',m=>{if(m.type==='progress')progress.push(m.fraction);else{w.terminate();m.type==='error'?reject(new Error(m.message)):resolve({result:m.result,progress});}});w.on('error',reject);w.postMessage({action,...payload});});}
test('local worker reproduces the direct adaptive solution and reports progress',async()=>{
  const doc=M.example('rc');doc.settings.integration='adaptive';const expected=M.simulate(doc),{result,progress}=await execute('time',{doc});
  assert.deepEqual(result,expected);assert.ok(progress.includes(1));
});
test('worker handles Bode, guided simulation and independent measurement context',async()=>{
  const doc=M.example('rc'),bode=await execute('bode',{doc});assert.deepEqual(bode.result,M.bode(doc));
  const p=require('../lab-model.js').defaults('rc'),guided=await execute('guidedTime',{params:p});assert.deepEqual(guided.result,require('../lab-model.js').simulate(p));
  const ctx=await execute('context',{text:M.serialize(doc)});assert.equal(ctx.result.points.length,M.simulate(doc).data.length);assert.equal(ctx.result.voltageGain,true);
});
test('worker errors remain explicit and unsupported actions cannot invoke model properties',async()=>{
  await assert.rejects(execute('time',{doc:M.blank()}),/Aggiungi/);await assert.rejects(execute('constructor',{}),/non supportata/);
});
test('worker includes days 3–4 and computes the same charge linearity as the direct model',async()=>{
 const L=require('../lab-model.js'),p=L.defaults('preamp');p.chargePoints=3;
 const run=await execute('guidedCharge',{params:p});assert.deepEqual(run.result,L.charge(p));assert.ok(run.progress.includes(1));
 const q=L.defaults('pz-shaper');assert.deepEqual((await execute('guidedBode',{params:q})).result,L.bode(q));
});
test('worker DC analyses preserve static powers and the declared sweep axis',async()=>{
 const doc=M.example('inverting');doc.components[0].wave.dc=1;
 assert.deepEqual((await execute('op',{doc})).result,M.operatingPoint(doc));
 Object.assign(doc.settings,{dcSource:'V1',dcStart:-1,dcStop:1,dcPoints:17});
 assert.deepEqual((await execute('dc',{doc})).result,M.dcSweep(doc));
});
test('worker propagates a shared calibration budget without any network',async()=>{
 const X=require('../metrology.js'),doc=M.example('rc');doc.rcStudy={dataset:{points:require('../rc-analysis.js').demo()},from:null,to:null,method:'voltage',finalMode:'fit',finalValue:0,commonSigma:null};const s=X.defaults();s.uTimeScale=.01;
 assert.deepEqual((await execute('metrologyData',{doc,study:s})).result,X.analyze(doc,s));
});
test('worker nonlinear simulation and seeded parameter studies match the direct model',async()=>{
 const doc=M.example('rectifier');doc.settings.samples=400;doc.settings.duration=.025;
 assert.deepEqual((await execute('time',{doc})).result,M.simulate(doc));
 const P=require('../parameter-study.js'),rc=M.example('rc'),s={...P.defaults(rc),metric:'tau',mode:'montecarlo',count:8};
 assert.deepEqual((await execute('parameterStudy',{doc:rc,study:s})).result,P.run(rc,s));
});
test('task cancellation terminates the running worker and ignores late results',async()=>{
  class FakeWorker{constructor(){FakeWorker.last=this;}postMessage(){}terminate(){this.terminated=true;}}
  const revoked=[],scope={window:{CircuitSolverSource:'trusted'},Worker:FakeWorker,Blob:class{},URL:{createObjectURL:()=> 'blob:local',revokeObjectURL:x=>revoked.push(x)}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../solver-tasks.js'),'utf8'),scope);
  const client=new scope.window.CircuitTasks(),a=client.run('time',{}),old=FakeWorker.last;client.cancel();await assert.rejects(a,e=>e.name==='AbortError');assert.equal(old.terminated,true);assert.equal(revoked.length,1);
  const b=client.run('bode',{});old.onmessage({data:{type:'result',result:'stale'}});FakeWorker.last.onmessage({data:{type:'result',result:'fresh'}});assert.equal(await b,'fresh');
});

test('worker real instrument models match direct transient and calibrated AC probe calculations',async()=>{const L=require('../lab-model.js'),B=require('../bench-model.js'),p=L.defaults('rc');p.bench={...B.defaults(),mode:'real'};assert.deepEqual((await execute('guidedTime',{params:p})).result,L.simulate(p));for(const ch of p.bench.channels){ch.kind='probe10';ch.coupling='ac';}assert.deepEqual((await execute('guidedBode',{params:p})).result,L.bode(p));});

test('worker preserves guided diagnostics and compares personal data on the same numerical models',async()=>{
 const L=require('../lab-model'),Q=require('../lab-quality'),D=require('../comparison-data'),E=require('../experiment-comparison'),p=L.defaults('shaper');assert.deepEqual((await execute('guidedResult',{params:p,analysis:'time'})).result,Q.analyze(p));const doc={experiment:'shaper',analysis:'time',circuits:{shaper:p}},dataset=D.parse('t,y\n0,0\n0.01,0',{xUnit:'ms'});assert.deepEqual((await execute('compareObservations',{doc,dataset})).result,E.compare(doc,dataset));
});
