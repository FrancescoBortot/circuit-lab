const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../lab-files.js'),R=require('../rc-analysis.js'),M=require('../free-model.js'),L=require('../lab-model.js'),C=require('../study-context.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){const d=clone(require('../esempi/rc-tempo-e-frequenza.json'));d.rcStudy.stamp=C.stamp(d);return d;}
test('RC report reconstructs the same fit as the measurement panel without changing observations',()=>{
 const d=fixture(),before=clone(d),s=d.rcStudy,fit=R.fit(s.dataset.points,{...s,source:s.source}),r=F.rcResults(d);
 assert.equal(r.fit.tau,fit.tau);assert.equal(r.fit.uTau,fit.uTau);assert.deepEqual(r.points.map(p=>[p.x,p.y]),fit.residuals.map(p=>[p.x,p.y]));assert.deepEqual(d,before);
 const html=F.report(d,{date:'test'});assert.match(html,/Fit RC · dati importati/);assert.match(html,/Residui · dati − fit/);assert.match(html,/tempi assunti esatti/);assert.match(html,/Curva RC e fit in volt/);assert.doesNotMatch(html,/NaN|Infinity|src="https?:/);
});
test('RC archive includes complete fit values, residuals and unchanged project',()=>{
 const d=fixture(),r=F.rcResults(d),z=F.unzip(F.archive(d,{date:'test'})),decode=x=>new TextDecoder().decode(x);
 assert.ok(z['rc-misure.csv']);assert.ok(z['rc-dati-residui.csv']);assert.deepEqual(JSON.parse(F.projectFromArchive(F.archive(d))),d);
 const rows=R.rows(decode(z['rc-dati-residui.csv']),',').rows;assert.equal(rows.length,r.fit.count+1);assert.deepEqual(rows[0],['tempo_s','V_dati_V','uV_V','V_fit_V','residuo_fit_V']);
 for(let i=1;i<rows.length;i++){const p=r.points[i-1];assert.ok(Math.abs(Number(rows[i][1])-p.y)<1e-11);assert.ok(Math.abs(Number(rows[i][4])-p.residual)<1e-11);}
 assert.match(decode(z['rc-misure.csv']),/tau_fit/);
});
test('report draws original observations separately from a smooth exponential model',()=>{
 const d=fixture(),h=F.report(d),plots=[...h.matchAll(/<svg[^>]*aria-label="(?:Curva RC e fit in volt|Residui RC in volt)"[\s\S]*?<\/svg>/g)].map(m=>m[0]);
 assert.equal(plots.length,2);for(const plot of plots)assert.equal((plot.match(/<circle /g)||[]).length,d.rcStudy.dataset.points.length);
 const curve=plots[0].match(/<polyline points="([^"]+)"[^>]*stroke="#4264ef"/);assert.ok(curve);assert.equal(curve[1].split(' ').length,221);assert.match(h,/name="viewport"/);
});
test('simulation report follows analytic RC charge and discharge across six time decades',()=>{
 for(const tau of [1e-6,1e-3,1])for(const charge of [true,false]){
  const d=M.example('rc');d.components.find(c=>c.type==='R').value=10000;const capacitor=d.components.find(c=>c.type==='C');capacitor.value=tau/10000;capacitor.initial=charge?0:5;d.components.find(c=>c.type==='V').wave.level=charge?5:0;d.settings.duration=5*tau;d.settings.samples=1600;
  const ctx=C.build(M.serialize(d)),s=clone(fixture().rcStudy);Object.assign(s,{source:'simulation',dataset:null,from:0,to:5*tau,stamp:ctx.stamp,segment:0,commonSigma:null});s.reference={R:10000,C:tau/10000,uR:null,uC:null,kind:'nominal',independent:false};d.rcStudy=s;
  const r=F.rcResults(d,ctx);assert.ok(!r.error,r.error);assert.ok(Math.abs(r.fit.tau/tau-1)<2e-5);assert.equal(r.fit.uTau,null);assert.equal(r.fit.uFinal,null);assert.match(F.report(d,{rcContext:ctx}),/nessuna incertezza sperimentale assegnata/);
 }
});
test('simulated fits require a current context and reject an electrically stale curve',()=>{
 const d=fixture(),ctx=C.build(M.serialize(d));Object.assign(d.rcStudy,{source:'simulation',from:ctx.parts[0][0].x,to:ctx.parts[0].at(-1).x,segment:0,stamp:ctx.stamp});
 assert.ok(F.rcResults(d).error);assert.ok(!F.rcResults(d,ctx).error);d.components.find(c=>c.type==='R').value*=2;
 assert.match(F.rcResults(d,ctx).error,/aggiornare/);assert.doesNotMatch(F.report(d,{rcContext:ctx}),/Curva RC e fit in volt/);
});
test('circuit edits do not replace experimental observations and are declared in the report',()=>{
 const d=fixture(),tau=F.rcResults(d).fit.tau,observations=clone(d.rcStudy.dataset);d.components.find(c=>c.type==='R').value*=1.1;
 const r=F.rcResults(d);assert.equal(r.fit.tau,tau);assert.equal(r.stale,true);assert.match(r.warnings.join(' '),/circuito è cambiato/);assert.deepEqual(d.rcStudy.dataset,observations);
});
test('uncertainties remain unavailable when absent and R/C correlation is explicit',()=>{
 const d=fixture();for(const p of d.rcStudy.dataset.points)delete p.sigma;d.rcStudy.commonSigma=null;Object.assign(d.rcStudy.reference,{uR:100,uC:1e-9,independent:false});
 let r=F.rcResults(d);assert.equal(r.fit.uTau,null);assert.equal(r.reference.uTau,null);
 d.rcStudy.reference.rho=.8;r=F.rcResults(d);assert.equal(r.reference.uTau,R.reference(d.rcStudy.reference.R,d.rcStudy.reference.C,100,1e-9,.8).uTau);
});
test('RC report escapes imported names and declares an invalid fit instead of inventing a result',()=>{
 const d=fixture();d.rcStudy.dataset.name='<img src=x onerror=alert(1)>';let h=F.report(d);assert.match(h,/&lt;img/);assert.doesNotMatch(h,/<img src=x|<script/);
 d.rcStudy.from=100;d.rcStudy.to=101;assert.match(F.rcResults(d).error,/Fit RC non allegato/);h=F.report(d);assert.doesNotMatch(h,/Curva RC e fit in volt/);assert.match(h,/Fit RC non allegato/);
});
test('lightweight context identity matches worker context for guided and free RC',()=>{
 const p=L.defaults('rc'),d={name:'RC',experiment:'rc',analysis:'time',circuits:{rc:p},layouts:{}};assert.equal(C.stamp(d),C.build(L.serialize(d)).stamp);
 const f=M.example('rc');assert.equal(C.stamp(f),C.build(M.serialize(f)).stamp);f.components[0].x+=100;assert.equal(C.stamp(f),C.build(M.serialize(f)).stamp);
});
