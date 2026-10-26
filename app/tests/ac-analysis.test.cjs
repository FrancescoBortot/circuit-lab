const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../ac-analysis.js'),Files=require('../local-projects.js'),Free=require('../free-model.js'),Lab=require('../lab-model.js');
const near=(x,y,t=1e-6)=>assert.ok(Math.abs(x-y)<=t*Math.max(Math.abs(y),1e-12),`${x} != ${y}`);
const response=(f,fc,g0)=>g0/Math.sqrt(1+(f/fc)**2);
const points=(fc=160,g0=.96,sigma)=>Array.from({length:21},(_,i)=>{const x=fc*10**(-2+i/5),gain=response(x,fc,g0);return{x,gain,db:20*Math.log10(gain),phase:-Math.atan(x/fc)*180/Math.PI,...(sigma?{uDb:sigma}:{} )};});
const gainFormat={mode:'gain',frequencyUnit:'Hz',voltageUnit:'V',gainUnit:'linear',phaseUnit:'deg',amplitudeKind:'vpp',independentAmplitudes:false,delimiter:';',decimal:'.',header:true,columns:{frequency:0,gain:1,phase:null,uGain:null,uPhase:null}};
const study=()=>({version:1,reference:'source',referenceNote:'Canale 1',from:1,to:20000,g0:1,uG0:null,independentReference:false,fit:true,overlay:true,showPhase:true,residualReference:'fit',residualQuantity:'db',stamp:'test',dataset:{name:'Dati sintetici',raw:'f;G',format:gainFormat,points:points(),warnings:[]}});
test('amplitude CSV converts frequency, voltage and phase units with explicit independent uncertainties',()=>{
  const d=A.parseTable('f;Vi;Vo;phi;ui;uo;up\n0,1;2000;1000;-0,5;10;20;0,01\n1;2000;500;-1;10;10;0,02',{mode:'amplitudes',frequencyUnit:'kHz',voltageUnit:'mV',phaseUnit:'rad',independentAmplitudes:true,columns:{frequency:0,input:1,output:2,phase:3,uInput:4,uOutput:5,uPhase:6}});
  near(d.points[0].input,2);near(d.points[0].output,1);near(d.points[0].uInput,.01);near(d.points[0].x,100);near(d.points[0].gain,.5);near(d.points[0].phase,-.5*180/Math.PI);near(d.points[0].uDb,20/Math.LN10*Math.hypot(.005,.02));assert.equal(d.format.header,true);
});
test('gain input in V/V or dB preserves gain and the declared standard uncertainty',()=>{
  const lin=A.parseTable('10;.5;.01\n100;.25;.02',{header:'no',decimal:'.',columns:{frequency:0,gain:1,uGain:2}}).points;
  near(lin[0].db,20*Math.log10(.5));near(lin[0].uDb,20/Math.LN10*.01/.5);
  const db=A.parseTable('10,-6,.2\n100,-20,.3',{delimiter:',',decimal:'.',header:'no',gainUnit:'dB',columns:{frequency:0,gain:1,uGain:2}}).points;near(db[0].gain,10**(-6/20));near(db[0].uDb,.2);
});
test('CSV rejects duplicate frequencies, invalid gains, formulas and partial uncertainty columns',()=>{
  for(const raw of ['0;1\n1;.5','1;1\n1;.5','2;1\n1;.5','1;0\n2;.5','1;=1+2\n2;.5'])assert.throws(()=>A.parseTable(raw,{header:'no'}));
  assert.throws(()=>A.parseTable('1;1;.1\n2;.5;',{header:'no',columns:{frequency:0,gain:1,uGain:2}}),/Riga 2/);
  assert.throws(()=>A.parseTable('1;1\n2;.5',{columns:{frequency:0,gain:0}}),/diverse/);
});
test('uncertainty propagation from two channels requires a declared independence assumption',()=>{
  const options={mode:'amplitudes',columns:{frequency:0,input:1,output:2,uInput:3,uOutput:4}};
  assert.throws(()=>A.parseTable('1;2;1;.1;.1\n2;2;.5;.1;.1',options),/indipendenza/);
  assert.throws(()=>A.parseTable('1;2;1;.1\n2;2;.5;.1',{...options,independentAmplitudes:true,columns:{frequency:0,input:1,output:2,uInput:3}}),/entrambe/);
});
test('AC import has bounded size, explicit units and no ambiguous comma decimal separator',()=>{
  assert.throws(()=>A.parseTable('x'.repeat(200001)),/200 kB/);
  assert.throws(()=>A.parseTable('1,1\n2,.5',{delimiter:',',decimal:','}),/Formato/);
  assert.throws(()=>A.parseTable('1;1\n2;.5',{frequencyUnit:'rpm'}),/Formato/);
  assert.throws(()=>A.parseTable(Array.from({length:4001},(_,i)=>`${i+1};1`).join('\n'),{header:'no'}),/4 000/);
});
test('continuous phase handles wrapping without changing original observations',()=>{
  const p=[{phase:-170},{phase:175},{phase:160}],q=A.continuous(p);assert.deepEqual(q.map(p=>p.continuousPhase),[-170,-185,-200]);assert.deepEqual(p.map(p=>p.phase),[-170,175,160]);assert.equal(p[0].continuousPhase,undefined);near(A.wrap(-359),1);
});
test('RC magnitude fit recovers independently evaluated low-pass responses',()=>{
  for(const [fc,g0]of [[.025,.3],[160,.96],[1e6,2]]){const f=A.fit(points(fc,g0));near(f.frequency,fc,2e-7);near(f.g0,g0,2e-7);near(f.tau,1/(2*Math.PI*fc),2e-7);near(f.predictPhase(fc),-45);}
});
test('fit covariance agrees with an independent finite-difference Jacobian and absolute sigma',()=>{
  const p=points(160,.96,.1),fit=A.fit(p),q=Math.log(fit.frequency),h=1e-5;
  let n00=0,n01=0,n11=0;
  for(const d of p){const value=z=>20*Math.log10(response(d.x,Math.exp(z),fit.g0)),j=(value(q+h)-value(q-h))/(2*h),w=1/d.uDb**2;n00+=w;n01+=w*j;n11+=w*j*j;}
  const det=n00*n11-n01*n01;near(fit.uFrequency,fit.frequency*Math.sqrt(n00/det),1e-6);near(fit.uG0,fit.g0*Math.LN10/20*Math.sqrt(n11/det),1e-6);assert.ok(fit.uFrequency>0);assert.ok(fit.reducedChi2<1e-10);
});
test('uncertain outliers are downweighted rather than removed',()=>{
  const p=points(160,.96,.05);p[8].db+=5;p[8].gain=10**(p[8].db/20);p[8].uDb=10;const weighted=A.fit(p),plain=A.fit(p.map(({uDb,...p})=>p));assert.ok(Math.abs(weighted.frequency-160)<Math.abs(plain.frequency-160)/100);assert.equal(weighted.count,p.length);
});
test('phase is a separate model check and does not change the magnitude fit',()=>{
  const p=points();p.forEach(p=>p.phase=30);const fit=A.fit(p);near(fit.frequency,160);assert.ok(fit.warnings.some(w=>w.includes('fase')));assert.equal(fit.uFrequency,null);assert.equal(fit.chi2,null);
});
test('a flat response and a pure asymptote cannot silently identify two RC parameters',()=>{
  const flat=points().map(p=>({...p,gain:1,db:0}));assert.throws(()=>A.fit(flat),/identificabile|correlati/);
  const slope=points().map(p=>{const gain=100/p.x;return{...p,gain,db:20*Math.log10(gain)};});assert.throws(()=>A.fit(slope),/identificabile|correlati/);
  assert.throws(()=>A.fit(points().slice(0,3)),/4 punti/);
});
test('cutoff uses a declared G0 and log-frequency interpolation, not the maximum sampled gain',()=>{
  const p=[{x:10,gain:1,db:0},{x:100,gain:.5,db:20*Math.log10(.5)}],c=A.cutoff(p,1);near(c.frequency,Math.sqrt(1000));assert.deepEqual(c.bracket,[10,100]);
  const shifted=p.map(p=>({...p,gain:p.gain*.5,db:p.db+20*Math.log10(.5)}));near(A.cutoff(shifted,.5).frequency,c.frequency);assert.equal(A.cutoff(shifted,2),null);
});
test('cutoff uncertainty agrees with independent numerical propagation of both bracket points and reference',()=>{
  const p=[{x:10,gain:1,db:0,uDb:.1},{x:100,gain:.5,db:20*Math.log10(.5),uDb:.2}],g0=.9,ug=.01,c=A.cutoff(p,g0,ug,true),h=1e-5;
  const evalCut=(a,b,g)=>10*Math.exp((20*Math.log10(g)-10*Math.log10(2)-a)/(b-a)*Math.log(10));
  const da=(evalCut(h,p[1].db,g0)-evalCut(-h,p[1].db,g0))/(2*h),db=(evalCut(0,p[1].db+h,g0)-evalCut(0,p[1].db-h,g0))/(2*h),dg=(evalCut(0,p[1].db,g0+h)-evalCut(0,p[1].db,g0-h))/(2*h);
  near(c.uFrequency,Math.hypot(da*.1,db*.2,dg*ug),1e-6);assert.equal(A.cutoff(p,g0,ug,false).uFrequency,null);assert.equal(A.cutoff(p,g0,null,true).uFrequency,null);assert.ok(A.cutoff(p,g0,0,true).uFrequency>0);
});
test('multiple crossings report the first descending crossing and no extrapolation',()=>{
  const p=[0,-5,-1,-6].map((db,i)=>({x:10**i,gain:10**(db/20),db}));const c=A.cutoff(p,1);assert.equal(c.count,2);assert.ok(c.frequency<10);assert.equal(A.cutoff(points().slice(0,3),.96),null);
});
test('selection retains only original frequency points and can disable fitting',()=>{
  const p=points(),r=A.analyze(p,{from:p[4].x,to:p[12].x,g0:.96,fit:false});assert.equal(r.points.length,9);assert.equal(r.fit,null);assert.equal(r.points[0].x,p[4].x);assert.throws(()=>A.analyze(p,{from:0,to:10}),/positive/);
  const short=A.analyze(p,{from:p[4].x,to:p[5].x,g0:.96});assert.equal(short.fit,null);assert.ok(short.warnings.some(w=>w.includes('4 punti')));
});
test('simulation interpolation is logarithmic in frequency and never extrapolates',()=>{
  const p=[{x:10,db:0,phase:0},{x:100,db:-20,phase:-90}];near(A.interpolate(p,Math.sqrt(1000),'db'),-10);near(A.interpolate(p,Math.sqrt(1000),'phase'),-45);assert.ok(Number.isNaN(A.interpolate(p,1,'db')));assert.ok(Number.isNaN(A.interpolate(p,1000,'db')));
});
test('optional frequency studies survive guided and free project round trips',()=>{
  const s=study(),d=Free.example('rc');d.acStudy=s;assert.deepEqual(Free.parse(Free.serialize(d)).acStudy,s);const g={name:'RC',experiment:'rc',analysis:'time',circuits:{rc:Lab.defaults('rc')},layouts:{},acStudy:s};assert.deepEqual(Lab.parse(Lab.serialize(g)).acStudy,s);assert.equal(Free.parse(Free.serialize(Free.example('rc'))).acStudy,undefined);
});
test('malformed stored frequency datasets are rejected before project replacement',()=>{
  for(const change of [s=>s.dataset.points[1].x=s.dataset.points[0].x,s=>s.dataset.points[1].db=100,s=>s.reference='unknown',s=>s.g0=-1,s=>s.uG0=-1,s=>s.dataset.format.columns.gain=0,s=>s.dataset.raw='x'.repeat(200001),s=>s.overlay='true']){const s=structuredClone(study());change(s);assert.throws(()=>Files.checkACStudy(s),/frequenza/);}
});
test('synthetic amplitude demo recovers its imposed RC corner within one percent',()=>{
  const raw='f;Vin;Vout;phase;uVin;uVout;uPhase\n'+A.demo().map(p=>[p.frequency,p.input,p.output,p.phase,p.uInput,p.uOutput,p.uPhase].join(';')).join('\n'),parsed=A.parseTable(raw,{mode:'amplitudes',decimal:'.',independentAmplitudes:true,columns:{frequency:0,input:1,output:2,phase:3,uInput:4,uOutput:5,uPhase:6}}),r=A.analyze(parsed.points,{g0:.96});near(r.fit.frequency,160,.01);assert.ok(r.fit.uFrequency>0);assert.ok(r.cutoff.frequency>150&&r.cutoff.frequency<170);assert.equal(r.fit.df,9);
});
