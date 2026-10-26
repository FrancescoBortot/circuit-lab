const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../rc-analysis.js'),Free=require('../free-model.js'),Lab=require('../lab-model.js'),Files=require('../local-projects.js');
const near=(x,y,tol=1e-7)=>assert.ok(Math.abs(x-y)<=tol*Math.max(Math.abs(y),1e-12),`${x} != ${y}`);
const exponential=(tau=.001,a=5,b=0)=>Array.from({length:31},(_,i)=>({x:i*.0002,y:b+a*Math.exp(-i*.0002/tau)}));
test('voltage fit recovers charge, discharge, negative voltage and a nonzero asymptote',()=>{
  for(const [tau,a,b]of [[.001,5,0],[.00047,-5,5],[.003,-2,-1],[.00002,3,.4]]){const p=Array.from({length:31},(_,i)=>({x:i*tau/5,y:b+a*Math.exp(-i/5)})),f=A.fit(p,{finalMode:'fit'});near(f.tau,tau,2e-7);near(f.a,a,2e-7);if(b===0)assert.ok(Math.abs(f.finalValue)<1e-7);else near(f.finalValue,b,2e-7);assert.equal(f.uTau,null);}
});
test('known final value preserves a general initial voltage and the time origin',()=>{
  const p=exponential(.001,3,-.5).map(p=>({...p,x:p.x+12})),f=A.fit(p,{finalMode:'fixed',finalValue:-.5});near(f.tau,.001,1e-6);near(f.a,3,1e-6);near(f.t0,12);near(f.predict(12),2.5);
});
test('weighted fit downweights a declared uncertain measurement rather than deleting it',()=>{
  const p=exponential().map(p=>({...p,sigma:.01}));p[8].y+=1;p[8].sigma=10;const f=A.fit(p,{finalMode:'fixed',finalValue:0,source:'experiment'});near(f.tau,.001,1e-4);assert.equal(f.count,31);assert.ok(f.uTau>0);assert.ok(f.chi2>0);
});
test('absolute voltage uncertainties give the analytical two-parameter covariance',()=>{
  const p=exponential().map(p=>({...p,sigma:.02})),f=A.fit(p,{finalMode:'fixed',finalValue:0,source:'experiment'});let aa=0,bb=0,ab=0;
  for(const d of p){const e=Math.exp(-d.x/.001),j=5*e*d.x/(.001**2);aa+=e*e;bb+=j*j;ab+=e*j;}
  const expected=.02*Math.sqrt(aa/(aa*bb-ab*ab));near(f.uTau,expected,2e-6);near(f.uA,.02*Math.sqrt(bb/(aa*bb-ab*ab)),2e-6);
});
test('a simulation never acquires an experimental uncertainty from its tiny residuals',()=>{
  const f=A.fit(exponential().map(p=>({...p,sigma:.01})),{source:'simulation',finalMode:'fit'});assert.equal(f.uTau,null);assert.equal(f.chi2,null);assert.ok(f.warnings.some(w=>w.includes('simulazione')));
});
test('the logarithmic fit agrees with an independent line regression',()=>{
  const p=exponential(.0015,4,.25).map((p,i)=>({...p,y:p.y+(i%3-1)*.002})),f=A.fit(p,{method:'log',finalMode:'fixed',finalValue:.25});
  const xm=p.reduce((s,p)=>s+p.x,0)/p.length,ym=p.reduce((s,p)=>s+Math.log(p.y-.25),0)/p.length,m=p.reduce((s,p)=>s+(p.x-xm)*(Math.log(p.y-.25)-ym),0)/p.reduce((s,p)=>s+(p.x-xm)**2,0);near(f.tau,-1/m);near(f.slope,m);assert.equal(f.finalValue,.25);
});
test('log fit rejects a fitted asymptote, zeros and sign changes',()=>{
  assert.throws(()=>A.fit(exponential(),{method:'log',finalMode:'fit'}),/finale noto/);
  const p=exponential();p.at(-1).y=0;assert.throws(()=>A.fit(p,{method:'log',finalMode:'fixed',finalValue:0}),/diverso da zero/);p.at(-1).y=-.1;assert.throws(()=>A.fit(p,{method:'log',finalMode:'fixed',finalValue:0}),/stesso segno/);
});
test('near-asymptote log points with large relative uncertainty get a warning',()=>{
  const p=exponential().map(p=>({...p,sigma:.1})),f=A.fit(p,{method:'log',finalMode:'fixed',finalValue:0});assert.ok(f.warnings.some(w=>w.includes('3 u(V)')));assert.ok(f.uTau>0);
});
test('fit includes only real observations inside the selected interval',()=>{
  const p=exponential(),f=A.fit(p,{from:.0011,to:.0031,finalMode:'fixed',finalValue:0});assert.equal(f.count,10);near(f.from,.0012);near(f.to,.003);near(f.tau,.001);assert.ok(f.residuals.every(d=>p.some(p=>p.x===d.x)));
});
test('constant data, insufficient points and reversed ranges have actionable errors',()=>{
  assert.throws(()=>A.fit(exponential().slice(0,5)),/almeno 6/);assert.throws(()=>A.fit(exponential().map(p=>({...p,y:5}))),/costante/);assert.throws(()=>A.fit(exponential(),{from:1,to:0}),/fine maggiore/);
});
test('short windows and a non-exponential signal are not silently certified as one pole',()=>{
  const p=exponential(.1,5,.2).slice(0,10),f=A.fit(p,{finalMode:'fit'});assert.ok(f.warnings.some(w=>w.includes('breve')));
  const q=exponential().map((p,i)=>({...p,y:p.y+.5*Math.sin(i)})),g=A.fit(q,{finalMode:'fixed'});assert.ok(g.warnings.some(w=>w.includes('Scarti rilevanti')));
});
test('1/e crossing uses the declared asymptote and interpolates both charge and discharge',()=>{
  for(const a of [-5,5]){const p=Array.from({length:101},(_,i)=>({x:i*.0001,y:2+a*Math.exp(-i*.1)})),r=A.threshold(p,2);near(r.tau,.001,1e-7);near(r.target,2+a/Math.E);assert.equal(r.count,1);}
  assert.equal(A.threshold(exponential().slice(0,3),0),null);
});
test('commutation pairs delimit segments and keep both one-sided samples',()=>{
  const p=Lab.defaults('rc'),data=Lab.simulate(p).map(p=>({x:p.x,y:p.out})),parts=A.segments(data);assert.equal(parts.length,2);near(parts[0].at(-1).x,p.switchTime);near(parts[1][0].x,p.switchTime);for(const part of parts)A.validatePoints(part);
});
test('RC cutoff is relative to DC gain, and absent crossings remain unavailable',()=>{
  const tau=.001,data=Array.from({length:1001},(_,i)=>{const x=10**(i/250);return{x,db:20*Math.log10(.4/Math.hypot(1,2*Math.PI*x*tau))};}),r=A.cutoff(data,.4);near(r.frequency,1/(2*Math.PI*tau),2e-5);near(r.tau,tau,2e-5);assert.equal(A.cutoff(data.filter(d=>d.x>1000),.4),null);assert.equal(A.cutoff(data,0),null);
});
test('R C propagation uses only supplied standard uncertainties',()=>{
  near(A.reference(10000,1e-7).tau,.001);assert.equal(A.reference(10000,1e-7).uTau,null);near(A.reference(10000,1e-7,100,2e-9).uTau,.001*Math.hypot(.01,.02));assert.throws(()=>A.reference(0,1e-7));assert.throws(()=>A.reference(1,1,-1,0));
});
test('CSV accepts semicolon decimal comma, explicit columns, units and header',()=>{
  const p=A.parseTable('"tempo";"V";"uV"\r\n0;5,0;0,01\r\n0,5;3,0;0,02',{timeUnit:'ms',sigmaColumn:2});assert.deepEqual(p.points,[{x:0,y:5,sigma:.01},{x:.0005,y:3,sigma:.02}]);assert.equal(p.header,true);
  const q=A.parseTable('5,0\n3,2',{header:'no',timeColumn:1,voltageColumn:0,timeUnit:'us',voltageUnit:'mV',decimal:'.'});near(q.points[1].x,2e-6);near(q.points[0].y,.005);
});
test('CSV rejects malformed rows, quoted junk, missing uncertainty and ambiguous decimals',()=>{
  for(const text of ['t;V\n0;5\n1','t;V\n0;five\n1;2','"t"x;V\n0;5','"t;V\n0;5'])assert.throws(()=>A.parseTable(text));
  assert.throws(()=>A.parseTable('0,5\n1,3',{decimal:','}),/separatore/);assert.throws(()=>A.parseTable('0;5;0,1\n1;3;', {sigmaColumn:2}));
});
test('import never reorders, averages or quietly drops repeated timestamps',()=>{
  assert.throws(()=>A.parseTable('t;V\n0;5\n0;3'),/crescenti/);assert.throws(()=>A.parseTable('t;V\n1;5\n0;3'),/crescenti/);assert.throws(()=>A.parseTable('0;5\n1;3',{timeColumn:0,voltageColumn:0}),/diverse/);
});
test('CSV import is bounded and nonnumeric formulas never execute',()=>{
  assert.throws(()=>A.parseTable('t;V\n'+Array.from({length:4001},(_,i)=>`${i};5`).join('\n')),/4 000/);assert.throws(()=>A.parseTable('x'.repeat(200001)),/200 kB/);assert.throws(()=>A.parseTable('t;V\n0;=1+2\n1;3'),/non valido/);
});
test('interpolation preserves the right-hand side of an event and has no silent extrapolation',()=>{
  const p=[{x:0,y:0},{x:1,y:0},{x:1,y:5},{x:2,y:6}];assert.equal(A.interpolate(p,1),5);near(A.interpolate(p,1.5),5.5);assert.ok(Number.isNaN(A.interpolate(p,-1)));assert.ok(Number.isNaN(A.interpolate(p,3)));
});
test('theory reference is assigned only to a verified simple free RC topology',()=>{
  const d=Free.example('rc'),r=A.simpleReference(d,Free.topology(d));assert.ok(r);near(r.tau,r.R*r.C);d.wires.pop();assert.equal(A.simpleReference(d,Free.topology(d)),null);const loaded=Free.example('rc-loaded');assert.equal(A.simpleReference(loaded,Free.topology(loaded)),null);
});
const study=()=>({version:1,source:'experiment',method:'voltage',finalMode:'fit',finalValue:0,from:0,to:.005,segment:0,timeUnit:'ms',commonSigma:null,reference:{R:10000,C:1e-7,uR:100,uC:1e-9,kind:'measured',independent:true},dataset:{name:'Dati sintetici',points:A.demo(),raw:'t;V',timeUnit:'ms',voltageUnit:'V',format:{delimiter:';',decimal:'.',header:true,timeColumn:0,voltageColumn:1,sigmaColumn:2}},deltaTime:0,deltaVoltage:0,overlay:true,logPlot:false,stamp:'test'});
test('experimental observations and settings survive guided and free JSON round trips',()=>{
  const s=study(),d=Free.example('rc');d.rcStudy=s;assert.deepEqual(Free.parse(Free.serialize(d)).rcStudy,s);const g={name:'RC',experiment:'rc',analysis:'time',circuits:{rc:Lab.defaults('rc')},layouts:{},rcStudy:s};assert.deepEqual(Lab.parse(Lab.serialize(g)).rcStudy,s);
});
test('invalid saved RC data are rejected before replacing a project',()=>{
  for(const mutate of [s=>s.dataset.points[1].x=0,s=>s.dataset.points[2].sigma=-1,s=>s.from=1,s=>s.reference.C=-1,s=>s.deltaTime='script',s=>s.dataset.raw='x'.repeat(200001),s=>s.dataset.format.voltageColumn=0,s=>s.dataset.format.delimiter='script']){const s=study();mutate(s);assert.throws(()=>Files.checkRCStudy(s),/analisi RC/);}
});
test('CSV exports quote metadata, neutralize spreadsheet formulas and leave missing values blank',()=>{
  const text=A.csv([['name','=HYPERLINK("bad")',-2,null,NaN],['note','two\nlines']]);assert.match(text,/'=HYPERLINK/);assert.match(text,/-2\.000000000000e\+0/);assert.match(text,/,,\r\n/);assert.match(text,/"two\nlines"/);
});
