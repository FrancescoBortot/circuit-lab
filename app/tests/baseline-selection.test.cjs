const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../measurements'),L=require('../lab-model'),F=require('../free-model'),T=require('../student-tools'),N=require('../notebook-model');
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const ramp=[{x:0,out:2},{x:.1,out:2.2},{x:.9,out:3.8},{x:1,out:4}];
test('interval baseline integrates physical time and clipped edges, independent of sample density',()=>{
 const settings={baselineMode:'interval',baselineStart:.2,baselineEnd:.8},before=JSON.stringify(ramp);
 near(M.baseline(ramp,'out',settings).value,3); // Integral mean of 2 + 2t over [0.2, 0.8].
 near(M.baseline([{x:0,out:2},{x:1,out:4}],'out',settings).value,3);
 assert.equal(JSON.stringify(ramp),before);
 for(const [start,end]of [[.5,.5],[.8,.2],[-.1,.5],[0,2]])assert.equal(M.baseline(ramp,'out',{...settings,baselineStart:start,baselineEnd:end}),null);
 assert.equal(M.baseline([{x:0,out:1},{x:.5,out:NaN},{x:1,out:2}],'out',settings),null);
});
test('manual and interval pulse references preserve absolute peaks and support a single pulse',()=>{
 const data=[{x:0,out:2},{x:1,out:2},{x:1,out:3},{x:1.5,out:5},{x:2,out:2}],wave={kind:'pulse',delay:1,period:0};
 const auto=M.pulse(data,'out',wave),manual=M.pulse(data,'out',wave,undefined,{baselineMode:'manual',baselineValue:1});
 near(auto.baseline,2);near(auto.peak,3);near(M.reference(data,'out',wave,{},undefined,1.5).value,2);near(manual.maximum,5);near(manual.baseline,1);near(manual.peak,4);
 const interval=M.pulse(data,'out',wave,undefined,{baselineMode:'interval',baselineStart:0,baselineEnd:.5});near(interval.baseline,2);
 assert.equal(M.pulse(data,'out',wave,undefined,{baselineMode:'interval',baselineStart:3,baselineEnd:4}),null);
 const shifted=M.pulse([{x:1,out:3},{x:2,out:5}],'out',wave,undefined,{baselineMode:'manual',baselineValue:1});near(shifted.peak,4);
});
test('baseline validation and project roundtrip cover every guided circuit and old files',()=>{
 for(const type of new Set(L.CATALOG.map(c=>c.type))){
  const p=L.defaults(type),project={experiment:L.CATALOG.find(c=>c.type===type).id,circuits:{[type]:p},analysis:L.analyses(p)[0][0],layouts:{}};
  assert.equal(L.parse(L.serialize(project)).circuits[type].baselineMode,undefined);
  for(const mode of ['manual','interval']){
   Object.assign(p,{baselineMode:mode,baselineValue:-.2,baselineStart:0,baselineEnd:p.duration/10});
   assert.deepEqual(L.validate(p),{});const saved=L.parse(L.serialize(project)).circuits[type];assert.equal(saved.baselineMode,mode);near(saved.baselineValue,-.2);near(saved.baselineEnd,p.duration/10);
   const free=L.circuit(project);assert.equal(free.settings.baselineMode,mode);near(free.settings.baselineValue,-.2);
  }
  p.baselineEnd=p.duration*2;assert.ok(L.validate(p).baselineEnd);assert.throws(()=>L.parse(L.serialize(project)));
  p.baselineMode='manual';p.baselineValue=NaN;assert.ok(L.validate(p).baselineValue);
  p.baselineMode='bad';assert.ok(L.validate(p).baselineMode);
 }
 assert.deepEqual(M.validateBaseline(undefined,1),{});
 const d=F.example('rc');Object.assign(d.settings,{baselineMode:'interval',baselineStart:0,baselineEnd:d.settings.duration*2});assert.ok(F.validate(d).length);assert.throws(()=>F.parse(F.serialize(d)));
});
test('manual and interval references reach cards, notebook and CSV with original voltages preserved',()=>{
 for(const settings of [{baselineMode:'manual',baselineValue:-1},{baselineMode:'interval',baselineStart:.2,baselineEnd:.8}]){
  const expected=settings.baselineMode==='manual'?-1:3,config={data:ramp,series:[{key:'out',label:'OUT'}],baselineSettings:settings,xUnit:'s',yUnit:'V',dcBaseline:{out:100}};
  near(T.readings(config).find(r=>r.label.startsWith('Baseline')).value,expected);
  const capture=N.capture(config,2,{},'time','fixture');near(capture.values.find(r=>r.label.startsWith('Baseline')).value,expected);near(capture.values.find(r=>r.label==='OUT − baseline').value,3.8-expected);
  const p={...L.defaults('rc'),...settings},csv=L.csv(p,'time',ramp).split('\r\n'),headers=csv[0].split(','),row=csv[3].split(',').map(Number);near(row[headers.indexOf('OUT_baseline_V')],expected);near(row.at(-1),3.8-expected);
 }
});
test('free and guided simulation samples are unchanged by the baseline choice and CSVs agree',()=>{
 const p=L.defaults('rc');p.wave1.kind='charge';p.wave1.level=2;p.opamp='ideal';const original=L.simulate(p);
 Object.assign(p,{baselineMode:'manual',baselineValue:.25});assert.deepEqual(L.simulate(p),original);
 const tau=p.R*p.C,at=original.find(r=>r.x>=tau);near(at.out,2*(1-Math.exp(-at.x/tau)),1e-9);
 const doc=L.circuit({experiment:'rc',circuits:{rc:p},analysis:'time'}),result=F.simulate(doc),before=JSON.stringify(result.data);
 for(const settings of [{baselineMode:'manual',baselineValue:.25},{baselineMode:'interval',baselineStart:0,baselineEnd:p.duration/10}]){
  Object.assign(doc.settings,settings);const reopened=F.parse(F.serialize(doc));assert.equal(reopened.settings.baselineMode,settings.baselineMode);
  const csv=F.csv(doc,result).split('\r\n'),header=csv[0].split(','),row=csv[2].split(',').map(Number),ref=M.baseline(result.data,'out',settings);near(row[header.indexOf('OUT_baseline_V')],ref.value);near(row.at(-1),result.data[1].out-ref.value);
 }
 assert.equal(JSON.stringify(result.data),before);
});
test('charge scan applies selected manual baseline while retaining Qin and absolute maxima',()=>{
 const p=L.defaults('preamp');Object.assign(p,{opamp:'ideal',chargePoints:3});const auto=L.charge(p),manual=L.charge({...p,baselineMode:'manual',baselineValue:-.1});
 manual.forEach((r,i)=>{near(r.x,auto[i].x,1e-20);near(r.maximum,auto[i].maximum);near(r.baseline,-.1);near(r.out,r.maximum+.1);});
});
