const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../lab-model'),F=require('../free-model'),Q=require('../lab-quality'),B=require('../breadboard-model');
const Physical=require('../breadboard-layout'),Guide=require('../measurement-guide'),Schematic=require('../guided-schematic');
const Files=require('../lab-files'),Spice=require('../spice-netlist'),Trials=require('../guided-trials'),Comparison=require('../experiment-comparison');
const S=L.semiconductor;
const catalog=L.CATALOG.filter(entry=>entry.group==='extra');
const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected} (±${tolerance})`);
const project=(type,p=L.defaults(type),analysis='time')=>({name:'Appendice 1',experiment:type,analysis,circuits:{[type]:p},layouts:{}});
const mount=(p,analysis='time')=>B.create(L.network(p,analysis),{semiconductorType:p.type,channels:p.bench?.channels});
const trial=(type,key)=>S.applyPreset(L.defaults(type),key);

test('Appendice 1 groups all five selectable circuits and each trial has a valid project and physical mounting',()=>{
  assert.deepEqual(catalog.map(c=>c.step),['A1.1','A1.2','A2','A3','A4']);
  for(const {type} of catalog){
    for(const [key] of S.PRESETS[type]){
      const {parameters:p,analysis}=trial(type,key);
      const doc=project(type,p,analysis);
      Trials.select(doc,key,L.CATALOG);
      const restored=L.parse(L.serialize(doc));
      assert.equal(Trials.current(restored,L.CATALOG).preset,key);
      assert.deepEqual(restored.circuits[type],p);
      const board=mount(p,analysis),ref=Physical.reference(board);
      const result=Physical.check(Physical.proposed(ref),ref);
      assert.deepEqual(result.errors,[],type+' '+key);
      assert.ok(Guide.forCircuit(p).every(step=>step.points.every(point=>F.validPin(board.doc,point.ref))),type+' '+key);
      if(type==='precision-rectifier')assert.equal(board.packages.length,1);
      const full=L.circuit(restored),schematic=Schematic.layout(full,type,p);
      assert.deepEqual(F.validate(schematic),[],type);
      const nominal=F.topology(board.doc).nodes,drawing=F.topology(schematic).nodes;
      const terminals=Object.keys(nominal).filter(pin=>Object.hasOwn(drawing,pin));
      for(const a of terminals)for(const b of terminals)
        assert.equal(drawing[a]===drawing[b],nominal[a]===nominal[b],type+' '+a+' / '+b);
    }
  }
});

test('the CMOS truth tables match Boolean logic and the physical pin pairs in Figure 9',()=>{
  for(const [type,expected,pairs] of [
    ['cmos-nor','1000',[[13,1],[2,4],[4,8],[5,7]]],
    ['cmos-nand','1110',[[14,1],[5,8],[2,4],[4,13]]]
  ]){
    const {parameters:p}=trial(type,'logic'),{data,values}=Q.analyze(p,'time');
    assert.deepEqual(values.truth.map(row=>row.a+row.b),['00','01','10','11']);
    assert.equal(values.truth.map(row=>row.level).join(''),expected);
    for(const row of values.truth)near(row.out,Number(row.level)*p.VDD,1e-4);
    assert.ok(data.some(row=>row.vin>4&&row.vin2>4));
    const board=mount(p),pin=n=>board.devicePins.find(holder=>holder.number===n);
    for(const [a,b] of pairs)assert.equal(pin(a).node,pin(b).node);
    assert.match(S.truthCsv(p,values.truth),/A,B,VA_V,VB_V,Y,VY_V/);
  }
});

test('the precision rectifier agrees with the piecewise circuit equations even when CH2 is moved',()=>{
  const {parameters:p}=trial('precision-rectifier','v2'),result=Q.analyze(p,'time'),{positive,negative}=result.values;
  for(const row of [positive,negative])near(row.out,Math.abs(row.vin),.001);
  near(positive.v2,-positive.vin,.001);
  near(negative.v2,0,.001);
  assert.ok(positive.aux<positive.v2&&negative.aux>0);
  near(positive.ch2,positive.v2,1e-9);
  assert.ok(result.data.every(row=>Number.isFinite(row.aux)));
  assert.match(L.csv(p,'time',result.data),/V1_V,OUT_V,V2_V,Vo_primo_V/);
});

test('bridge exports the signed load difference and the two conducting pairs',()=>{
  const p=L.defaults('bridge-rectifier'),result=Q.analyze({...p,bench:undefined},'time');
  const positive=result.data.reduce((a,b)=>a.vin>b.vin?a:b),negative=result.data.reduce((a,b)=>a.vin<b.vin?a:b);
  assert.ok(positive.iD1>1e-3&&positive.iD2>1e-3&&negative.iD3>1e-3&&negative.iD4>1e-3);
  const thermalVoltage=1.380649e-23*300.15/1.602176634e-19;
  let low=0,high=positive.vin/p.R1;
  for(let i=0;i<60;i++){
    const current=(low+high)/2;
    const drops=2*p.diodeN*thermalVoltage*Math.log1p(current/p.diodeIs);
    if(p.R1*current+drops>positive.vin)high=current;
    else low=current;
  }
  near(positive.out,-p.R1*(low+high)/2,2e-6);
  near(positive.out,positive.b-positive.a,1e-12);
  near(positive.out,negative.out,1e-4);
  assert.ok(result.data.every(row=>row.out<=1e-8));
  const leds=trial(p.type,'leds').parameters;
  assert.ok(Q.analyze(leds,'time').values.minimum>result.values.minimum+1);
  const circuit=L.circuit(project(p.type));
  const netlist=Spice.exportText(circuit).text;
  assert.match(netlist,/N\d+ = A/);
  assert.match(netlist,/N\d+ = B/);
  assert.deepEqual(circuit.traces[0],{id:'P1',kind:'voltage',positive:'R1:b',negative:'R1:a'});
  const csv=L.csv(p,'time',Q.analyze(p,'time').data);
  assert.match(csv,/VA_V,VB_V,VB_meno_VA_V/);
  const raw='0,0\n'+positive.x+','+positive.out;
  const format={kind:'time',header:false,delimiter:',',decimal:'.',xColumn:0,yColumn:1,xUnit:'s',yUnit:'V',side:'right'};
  const resultCompare=Comparison.compare(project(p.type,{...p,bench:undefined}),{raw,format});
  near(resultCompare.rows[1].residual,0,1e-6);
  const archive=Files.archive(JSON.parse(L.serialize(project(p.type,p))));
  assert.equal(L.parse(Files.projectFromArchive(archive)).experiment,p.type);
});

test('Common Source Q, midband gain and resistance trials agree with independent circuit relations',()=>{
  const {parameters:p}=trial('common-source','gain'),r=Q.analyze(p,'time'),q=r.values;
  const vg=p.VDD*p.R1/(p.R1+p.R2),equation=i=>{
    const vds=p.VDD-i*(p.RD+p.RS),overdrive=vg-i*p.RS-p.mosVto;
    return .5*p.mosKp*Math.max(0,overdrive)**2*(1+p.mosLambda*vds)-i;
  };
  let lo=0,hi=vg/p.RS;
  for(let i=0;i<60;i++){
    const current=(lo+hi)/2;
    if(equation(current)>0)lo=current;
    else hi=current;
  }
  near(q.id,(lo+hi)/2,5e-10);
  assert.equal(q.region,'saturazione');
  const ro=(1+p.mosLambda*q.vds)/(p.mosLambda*q.id),gm=2*q.id/(q.vgs-p.mosVto);
  const expected=gm/(1/p.RD+1/ro+1/p.bench.probeR);
  near(q.ppGain,expected,.08);
  const bode=Q.analyze(trial('common-source','bode').parameters,'bode');
  const row=bode.data.reduce((a,b)=>Math.abs(a.x-10000)<Math.abs(b.x-10000)?a:b);
  near(row.magnitude,expected,.08);
  near(Math.abs(row.phase),180,2);
  const input=Q.analyze(trial('common-source','rin').parameters,'time').values;
  near(input.rinMeasured,1/(1/p.R1+1/p.R2),400);
  const loaded=Q.analyze(trial('common-source','rout').parameters,'time').values;
  near(p.RL*(q.ppGain/loaded.ppGain-1),1/(1/p.RD+1/ro+1/p.bench.probeR),150);
  const without=trial('common-source','unbypassed').parameters;
  const gain=Q.analyze(without,'time').values.ppGain;
  assert.ok(gain<q.ppGain/2);
  near(Q.analyze(without,'time',{refinement:2}).values.ppGain,gain,.01);
});

test('A2 keeps independent channel mappings into one original CSV and compares the selected node',()=>{
  const D=require('../comparison-data'),C=require('../study-context');
  const type='precision-rectifier',p={...L.defaults(type),bench:undefined},doc=project(type,p);
  const data=L.simulate(p),nearPeaks=[.00025,.00075].map(t=>{
    const low=data.findLast(row=>row.x<t),high=data.find(row=>row.x>t);
    return {x:t,...Object.fromEntries(['out','v2','aux'].map(key=>[
      key,low[key]+(high[key]-low[key])*(t-low.x)/(high.x-low.x)
    ]))};
  }),samples=[data[0],...nearPeaks];
  const raw='tempo_s;OUT_V;V2_V;Vo_V\r\n'+samples.map(row=>[row.x,row.out,row.v2,row.aux].join(';')).join('\r\n');
  doc.comparisonStudy={version:1,records:{}};
  for(const [name,yColumn] of [['',1],['v2',2],['aux',3]]){
    const dataset=D.parse(raw,{xUnit:'s',yColumn,...(name?{target:name}:{})});
    const key=type+':time'+(name?':'+name:'');
    doc.comparisonStudy.records[key]={raw,name:name||'OUT',modelStamp:C.stamp(doc),format:dataset.format};
    const result=Comparison.compare(doc,dataset);
    assert.equal(result.stats.compared,3);
    assert.ok(result.stats.maxAbsolute<1e-4);
    if(name)assert.equal(result.channel,D.channels[name]);
  }
  const reopened=L.parse(L.serialize(doc));
  assert.equal(Object.keys(reopened.comparisonStudy.records).length,3);
  const files=Files.unzip(Files.archive(JSON.parse(L.serialize(reopened))));
  assert.deepEqual(Object.keys(files).filter(k=>k.startsWith('confronto-')).sort(),['confronto-time-aux.csv','confronto-time-v2.csv','confronto-time.csv']);
  assert.throws(()=>Comparison.compare(project('rc'),D.parse(raw,{xUnit:'s',yColumn:2,target:'v2'})),/Canale/);
});

test('A3 subtracts per-row synchronized inputs in distinct units and keeps originals in exports',()=>{
  const D=require('../comparison-data'),C=require('../study-context');
  const type='bridge-rectifier',p=L.defaults(type),doc=project(type,p);
  const calculated=L.simulate(p),samples=[calculated[0],calculated.find(row=>row.x>=.05),calculated.find(row=>row.x>=.15)];
  const raw='t_ms;A_mV;B_V;u_diff_V\r\n'+samples.map(row=>[row.x*1000,row.a*1000,row.b,0.02].join(';')).join('\r\n');
  const data=D.parse(raw,{xUnit:'ms',yUnit:'V',yColumn:2,subtractColumn:1,subtractUnit:'mV',sigmaColumn:3});
  assert.deepEqual(data.points.map(row=>[row.y,row.sigma]),samples.map(row=>[row.out,0.02]));
  assert.throws(()=>D.parse(raw,{yColumn:1,subtractColumn:1,subtractUnit:'mV'}),/diverse/);
  assert.throws(()=>D.parse(raw,{yColumn:2,subtractColumn:1,subtractUnit:'kHz'}),/Unità CH1/);
  doc.comparisonStudy={version:1,records:{[type+':time']:{name:'Ponte',modelStamp:C.stamp(doc),format:data.format,raw}}};
  const reopened=L.parse(L.serialize(doc)),result=Comparison.compare(reopened,reopened.comparisonStudy.records[type+':time']);
  assert.equal(result.paired,true);
  assert.ok(result.stats.maxAbsolute<1e-4);
  assert.match(Comparison.csv(result),/CH1_A_V","CH2_B_V/);
  assert.match(Comparison.report(result,data,doc,{title:'Riferimento',included:[],excluded:[],notice:''}),/CH1 · A/);
});

test('A1 actual outputs and A4 measured resistances remain distinct from the model in JSON and reports',()=>{
  const cmos=project('cmos-nor');
  const cmosEntry={vdd:5,voltages:[4.96,0,0.01,null]};
  cmos.extraStudy={version:1,records:{'cmos-nor':cmosEntry}};
  const loaded=L.parse(L.serialize(cmos));
  assert.deepEqual(loaded.extraStudy,cmos.extraStudy);
  assert.match(Files.report(cmos),/Y al banco/);
  assert.match(S.truthCsv(L.defaults('cmos-nor'),S.logicValues(L.defaults('cmos-nor')).truth,cmosEntry),/Y_misurata_V,VDD_delle_misure_V/);
  cmosEntry.voltages.pop();
  assert.throws(()=>L.parse(L.serialize(cmos)),/Misure CMOS/);

  const type='common-source',p=L.defaults(type),target={id:.00084,vds:6.8,gain:12.4,r1:220e3},d=S.extra.designSource(p,target);
  const q=S.amplifierValues({...p,...d.nominal});
  near(q.id,target.id,5e-10);
  near(q.vds,target.vds,1e-6);
  const gain=F.bode(L.network({...p,...d.nominal,bench:undefined}),{frequencies:[10000]}).data[0].magnitude;
  near(gain,target.gain,.01);
  assert.throws(()=>S.extra.designSource(p,{...target,gain:1000}),/supera il limite/);
  assert.throws(()=>S.extra.designSource(p,{...target,r1:150e3}),/150 kΩ/);
  const doc=project(type,{...p,...d.nominal,RD:8200});
  doc.extraStudy={version:1,records:{[type]:{target,nominal:d.nominal,measured:{RD:8200,RS:null,R1:null,R2:null},vdd:d.vdd,applied:'measured'}}};
  assert.deepEqual(L.parse(L.serialize(doc)).extraStudy,doc.extraStudy);
  assert.match(Files.report(doc),/Nel circuito attuale/);
});
