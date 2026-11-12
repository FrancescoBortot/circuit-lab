const {test}=require('node:test');
const assert=require('node:assert/strict');
const Lab=require('../lab-model');
const Quality=require('../lab-quality');
const Trials=require('../guided-trials');
const Data=require('../comparison-data');
const Compare=require('../experiment-comparison');
const Sessions=require('../session-files');
const Files=require('../lab-files');
const Free=require('../free-model');

const S=Lab.semiconductor;
const trial=(type,key)=>S.applyPreset(Lab.defaults(type),key);
function close(actual,expected,tolerance){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} vs ${expected} (±${tolerance})`);
}
function project(type,analysis){
  return {name:'Semiconduttori',experiment:type,analysis,circuits:{[type]:Lab.defaults(type)},layouts:{},
    session:{id:'semiconductor-session',createdAt:'2026-11-12T12:00:00.000Z'}};
}

test('guided diode I–V uses terminal voltage, recovers its parameters and compares current in SI',()=>{
  const doc=project('diode-iv','diodeIV'),p=doc.circuits['diode-iv'];
  const {data,values}=Quality.analyze(p,'diodeIV');
  close(data[0].out,1e-6,1e-11);
  close(data.at(-1).out,.01,1e-10);
  close(values.n,p.diodeN,5e-5);
  close(values.is,p.diodeIs,5e-15);
  // Independent ngspice 47 DC points, IS=35 pA, N=1.5, series resistor 1 kΩ, 27 °C.
  const model=Lab.circuit(doc);
  close(Free.operatingPoint(model,{V1:1}).data[0].out,.627733,1e-6);
  close(Free.operatingPoint(model,{V1:10}).data[0].out,.752370,1e-6);
  const sampled=[data[5],data[30]],raw='VD_mV,ID_mA\n'+sampled.map(row=>[row.x*1000,row.out*1000].join(',')).join('\n');
  const dataset=Data.parse(raw,{kind:'diodeIV',xUnit:'mV',yUnit:'mA'});
  const comparison=Compare.compare(doc,dataset);
  assert.equal(comparison.unit,'A');
  assert.equal(comparison.stats.compared,2);
  assert.ok(comparison.stats.maxAbsolute<1e-13);
  assert.match(Lab.csv(p,'diodeIV',data),/^\uFEFFVD_V,ID_A,V_generatore_V,ID_fit_A,residuo_A/);
  const highR={...p,R1:1e6};
  const limited=Quality.analyze(highR,'diodeIV').data.at(-1);
  assert.ok(limited.out>1e-5&&limited.out<2e-5);
  close(limited.source,20,1e-7);
});

test('half-wave filter compares the same probe load at 50 Hz and 1 kHz after settling',()=>{
  const p=Lab.defaults('half-wave-rc');
  const values=key=>{
    const q=S.applyPreset(p,key).parameters;
    const result=Quality.analyze(q,'time').values;
    assert.equal(result.settled,true);
    return result;
  };
  const probe=values('probe'),load=values('load'),fast=values('fast');
  assert.ok(load.ripple>5*probe.ripple);
  assert.ok(fast.ripple<load.ripple/5);
  // ngspice 47, 50 Ω source, two 10 MΩ/12 pF probes, 4.7 kΩ load, 22 µF, 63–64 ms.
  close(fast.outputMean,3.80237,1e-4);
  close(fast.ripple,.0334430,5e-5);
});

test('MOS bias, two characteristic axes and meter loading carry over to the amplifier',()=>{
  const {parameters:p,analysis}=trial('mos-iv','qpoint'),result=Quality.analyze(p,analysis);
  close(result.values.id,.0007,1e-11);
  close(result.values.lambda,p.mosLambda,1e-10);
  close(result.values.kp,p.mosKp,1e-10);
  close(result.values.vto,p.mosVto,1e-9);
  const transfer=Quality.analyze(p,'mosTransfer').data;
  assert.ok(transfer[0].x<transfer.at(-1).x);
  close(transfer.at(-1).out,.004,1e-11);
  const meter=Quality.analyze(trial('mos-iv','meter').parameters,'mosOutput').values;
  close(meter.vgs,meter.gateSource*10e6/(10e6+p.gateR),1e-10);
  assert.ok(meter.id<result.values.id);
  const source=project('mos-iv','mosOutput');
  source.circuits['mos-iv']={...p,mosKp:.0018};
  const sourcePoint=Quality.analyze(source.circuits['mos-iv'],'mosOutput').values;
  const next=Lab.selectExperience(source,'mos-amplifier'),amp=next.circuits['mos-amplifier'];
  close(amp.gateBias,sourcePoint.vgs,1e-10);
  close(amp.VDD,sourcePoint.vds+sourcePoint.id*amp.RD,1e-10);
  assert.equal(amp.mosKp,.0018);
  const nominal=Lab.defaults('mos-amplifier'),small=Quality.analyze(nominal,'time').values;
  close(small.acGain,13.76798,1e-5); // Independent ngspice LEVEL=1 AC, 3 kHz.
  close(small.ppGain,small.acGain,.02);
  const large=Quality.analyze(trial('mos-amplifier','large').parameters,'time').values;
  assert.ok(large.ppGain<.9*small.ppGain);
});

test('logic tables agree with transients and export in the reopenable session',()=>{
  const expected={'nmos-inverter':'10','nmos-nor':'1000','nmos-nand':'1110','cmos-inverter':'10'};
  const level=v=>v<1?'0':v>4?'1':'—';
  const records=[];
  for(const [type,states] of Object.entries(expected)){
    const doc=project(type,'time'),p=doc.circuits[type],two=S.twoInputs(p);
    Trials.select(doc,'logic',Lab.CATALOG);
    const {data,values}=Quality.analyze(p,'time');
    assert.equal(values.truth.map(row=>row.level).join(''),states);
    assert.ok(data.every(row=>level(row.out)===states[two?2*Number(level(row.vin))+Number(level(row.vin2)):Number(level(row.vin))]));
    const result={analysis:'time',quantity:'voltage',count:data.length,csv:Lab.csv(p,'time',data),svg:'<svg/>',truthCsv:S.truthCsv(p,values.truth)};
    records.push(Sessions.capture(null,Lab.serialize(doc),result));
  }
  const doc=project('nmos-nand','time'),bundle=Sessions.bundle(records,doc.name,doc.session);
  const zip=Files.zipSession(bundle.files);
  assert.equal(Sessions.readArchive(zip,'reopened-session').length,4);
  assert.equal(Object.keys(bundle.files).filter(path=>path.endsWith('-tabella-verita.csv')).length,4);
});
