const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../rc-analysis'),D=require('../comparison-data'),M=require('../free-model'),L=require('../lab-model'),Files=require('../local-projects'),C=require('../study-context'),waveform=require('./fixtures/tektronix.cjs');
test('Tektronix metadata rows also contain samples; retain every sample and trigger time',()=>{
 const raw=waveform(),p=A.parseTable(raw),d=D.parse(raw);assert.equal(p.points.length,24);assert.deepEqual(p.points[0],{x:-.000012,y:.2});assert.equal(p.points.at(-1).x,.000011);assert.deepEqual(d.points,p.points);assert.equal(d.raw,raw);assert.equal(d.instrument.model,'TBS1102B-EDU');assert.equal(d.instrument.channel,'CH1');assert.equal(d.format.header,false);assert.equal(d.format.xColumn,3);assert.equal(d.format.yColumn,4);assert.equal(d.format.xUnit,'s');assert.equal(d.format.yUnit,'V');assert.equal(d.format.sigmaColumn,null);assert.ok(!d.points.some(p=>'sigma'in p));assert.deepEqual(p.warnings,[]);
});
test('probe, scale, offset and trigger metadata never rescale or shift calibrated samples',()=>{
 const raw=waveform(),baseline=D.parse(raw);for(const changed of [waveform({probe:1}),raw.replace('Vertical Scale,2.000000e-01','Vertical Scale,5e2'),raw.replace('Vertical Offset,0','Vertical Offset,12'),raw.replace('Yzero,0','Yzero,-8'),raw.replace('Trigger Point,12','Trigger Point,15')])assert.deepEqual(D.parse(changed).points,baseline.points);
 assert.equal(D.parse(waveform({channel:'CH2',probe:1})).instrument.channel,'CH2');
 const forced=D.parse(raw,{xColumn:0,yColumn:1,header:true,xUnit:'ms',yUnit:'mV',sigmaColumn:2,phaseColumn:5,decimal:',',delimiter:';'});assert.deepEqual(forced.points,baseline.points);assert.equal(forced.format.phaseColumn,null);
 assert.throws(()=>D.parse(raw,{kind:'bode'}),/Transitorio/);assert.throws(()=>D.parse(raw,{kind:'vtc'}),/Transitorio/);
});
test('reject damaged or unsupported instrument exports without silently dropping rows',()=>{
 const raw=waveform();for(const bad of [raw.replace('Record Length,24','Record Length,23'),raw.replace('Sample Interval,1.000000e-06','Sample Interval,0'),raw.replace('Vertical Units,V','Vertical Units,mV'),raw.replace('Horizontal Units,s','Horizontal Units,ms'),raw.replace('Source,CH1','Source,MATH'),raw.replace('Pt Fmt,Y','Pt Fmt,XY'),raw.replace('Probe Atten,10','Probe Atten,-1'),raw.replace('Serial Number,SYNTHETIC','Source,CH2'),raw.replace('0.200000','NaN'),raw.replace('-00.000011000000','-00.000012000000'),raw.replace(',\r\n',',extra\r\n'),raw.replace('Record Length,24,,','Record Length,24,'),raw.trim().split('\r\n').slice(0,-1).join('\r\n')]){assert.throws(()=>A.parseTable(bad));assert.throws(()=>D.parse(bad));}
});
test('inconsistent sample interval is reported but original time coordinates are authoritative',()=>{
 const raw=waveform().replace('Sample Interval,1.000000e-06','Sample Interval,2e-6'),p=A.parseTable(raw);assert.equal(p.warnings.length,1);assert.equal(p.points[0].x,-.000012);assert.match(A.instrumentSummary(p),/sonda ×10/);assert.match(A.instrumentSummary(p),/nessun allineamento/);
});
test('generic CSV import and explicit units keep their previous behavior',()=>{
 const raw='time_ms;voltage_mV\n0;100\n1;200';assert.equal(A.instrumentTable(A.rows(raw)),null);assert.deepEqual(A.parseTable(raw,{timeUnit:'ms',voltageUnit:'mV'}).points,[{x:0,y:.1},{x:.001,y:.2}]);assert.deepEqual(D.parse(raw,{xUnit:'ms',yUnit:'mV'}).points,[{x:0,y:.1},{x:.001,y:.2}]);
});
test('portable projects reopen the original CRLF file, samples and verified instrument metadata',()=>{
 const raw=waveform(),doc=M.example('rc'),dataset={...D.parse(raw),name:'Synthetic CH1',conditions:'OUT / GND',modelStamp:C.stamp(doc)};doc.comparisonStudy={version:1,records:{'free:time':dataset}};
 const parsed=A.parseTable(raw);doc.rcStudy={version:1,source:'experiment',method:'voltage',finalMode:'fit',finalValue:0,from:null,to:null,segment:0,timeUnit:'ms',commonSigma:null,reference:{R:10000,C:1e-7,uR:null,uC:null,kind:'nominal',independent:false},dataset:{name:'Synthetic',raw,points:parsed.points,instrument:parsed.instrument,timeUnit:'s',voltageUnit:'V',format:{delimiter:',',decimal:'.',header:false,timeColumn:3,voltageColumn:4,sigmaColumn:null}},deltaTime:0,deltaVoltage:0,overlay:false,logPlot:false,stamp:''};
 const reopened=M.parse(M.serialize(doc));assert.deepEqual(reopened.comparisonStudy,doc.comparisonStudy);assert.equal(reopened.rcStudy.dataset.raw,raw);assert.deepEqual(reopened.rcStudy.dataset.instrument,parsed.instrument);
 const guided={name:'RC',experiment:'rc',analysis:'time',circuits:{rc:L.defaults('rc')},layouts:{},comparisonStudy:doc.comparisonStudy,rcStudy:doc.rcStudy};assert.equal(L.parse(L.serialize(guided)).comparisonStudy.records['free:time'].raw,raw);
 const corrupt=structuredClone(doc.comparisonStudy);corrupt.records['free:time'].instrument.probeAttenuation=100;assert.throws(()=>D.validateStudy(corrupt),/Metadati/);doc.rcStudy.dataset.instrument.channel='CH2';assert.throws(()=>Files.checkRCStudy(doc.rcStudy));
});
