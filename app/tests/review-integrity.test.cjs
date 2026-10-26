const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Free=require('../free-model.js'),Lab=require('../lab-model.js'),RC=require('../rc-analysis.js'),AC=require('../ac-analysis.js'),Files=require('../local-projects.js'),Context=require('../study-context.js');
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../esempi/rc-tempo-e-frequenza.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const nearLimit=doc=>{const d=clone(doc);d.notes='';const room=Files.MAX_BYTES-Buffer.byteLength(JSON.stringify(d,null,2))-10;d.notes='x'.repeat(room);return JSON.stringify(d,null,2);};
function harness(file){
  const elements=new Map();
  const element=()=>({value:'',hidden:false,disabled:false,checked:false,innerHTML:'',textContent:'',setAttribute(){},addEventListener(){},querySelector(){return element();},classList:{toggle(){}},viewBox:{baseVal:{width:350,height:220}}});
  const document={createElement:element,body:{append(){}},addEventListener(){},querySelectorAll(){return[];},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  class Plot{constructor(){this.controls={};}}
  const globals={window:{LabModel:Lab,RCAnalysis:RC,ACAnalysis:AC,LocalProjects:Files,LabPlot:Plot},document,clearTimeout,setTimeout,matchMedia:()=>({matches:false})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),globals);
  return{bench:file==='rc-workbench.js'?globals.window.rcWorkbench:globals.window.acWorkbench,get:id=>document.getElementById(id)};
}
test('a transient IC failure does not discard a valid AC response',()=>{
  const d=Free.example('rc');d.components=d.components.filter(c=>c.type!=='R');d.wires=d.wires.filter(w=>!w.a.startsWith('R1:')&&!w.b.startsWith('R1:'));d.wires.push({id:'Wdirect',a:'V1:p',b:'C1:a'});
  assert.equal(Free.issues(d).length,0);assert.throws(()=>Free.simulate(d),/iniziale incompatibile/);
  const c=Context.build(Free.serialize(d));assert.equal(c.points.length,0);assert.ok(c.timeError);assert.ok(c.bode.length>0);assert.equal(c.acError,null);assert.equal(c.voltageGain,true);assert.equal(c.bode[0].magnitude,1);
});
test('an ideal LC resonance failure in AC does not discard a valid transient',()=>{
  const d=Free.example('rc');Object.assign(d.components.find(c=>c.id==='R1'),{type:'L',value:1,initial:0});Object.assign(d.components.find(c=>c.id==='C1'),{value:1e-6,initial:1});d.components[0].wave.level=0;d.settings.duration=.02;d.settings.samples=4000;d.settings.fmin=1000/(2*Math.PI);d.settings.fmax=d.settings.fmin*10;
  const c=Context.build(Free.serialize(d));assert.ok(c.points.length>0);assert.equal(c.timeError,null);assert.equal(c.bode.length,0);assert.match(c.acError,/risonanza ideale/);assert.ok(c.notice.includes('restano utilizzabili'));
});
test('measurement context reports the actual fallback AC source and its physical unit',()=>{
  const d=Free.example('rc');d.settings.acSource=null;let c=Context.build(Free.serialize(d));assert.equal(c.acSource,'V1');assert.equal(c.voltageGain,true);
  d.components[0]=Free.component('I','V1');c=Context.build(Free.serialize(d));assert.equal(c.acSource,'V1');assert.equal(c.voltageGain,false);assert.ok(c.bode.length>0);
});
test('pure layout, wire routing and plot switches do not invalidate the electrical context',()=>{
  const d=Free.example('rc'),before=JSON.stringify(d),signature=Context.signature(d);assert.equal(JSON.stringify(d),before);
  d.components[1].x+=200;d.components[1].rotation=90;d.components.reverse();d.wires[0].offset=100;d.wires[0].route='vertical';d.wires.reverse();d.settings.analysis='bode';
  assert.equal(Context.signature(d),signature);d.components.find(c=>c.type==='R').value*=2;assert.notEqual(Context.signature(d),signature);
});
test('previous saved measurement signatures remain recognizable without dropping datasets',()=>{
  const d=fixture(),c=Context.build(Free.serialize(d));assert.equal(c.legacyStamp,d.rcStudy.stamp);assert.equal(c.legacyStamp,d.acStudy.stamp);assert.equal(d.rcStudy.dataset.points.length,11);assert.equal(d.acStudy.dataset.points.length,11);
});
test('guided RC measurement context uses its actual circuit and input reference',()=>{
  const p=Lab.defaults('rc'),d={name:'RC',experiment:'rc',analysis:'bode',circuits:{rc:p},layouts:{}},c=Context.build(Lab.serialize(d));assert.equal(c.acSource,'V₁');assert.equal(c.voltageGain,true);assert.ok(c.parts.length);assert.ok(c.bode.length);assert.equal(c.reference.R,p.R);assert.equal(c.reference.C,p.C);assert.ok(Math.abs(c.reference.tau-p.R*p.C)<1e-12*p.R*p.C);
});
test('switching guided experiences preserves existing common-mode AC settings and all component values',()=>{
  const p=Lab.defaults('difference');p.bodeInput='common';p.R4=47123;
  const d={name:'Laboratorio',experiment:'rc',analysis:'time',circuits:{rc:Lab.defaults('rc'),difference:p},layouts:{}},before=clone(d),next=Lab.selectExperience(d,'difference');
  assert.equal(next.circuits.difference.bodeInput,'common');assert.deepEqual(next.circuits,d.circuits);assert.deepEqual(d,before);assert.equal(next.experiment,'difference');assert.equal(next.analysis,'time');
});
test('a new guided opamp circuit inherits resistor choices once, with a declared default AC input',()=>{
  const p=Lab.defaults('inverting');p.R1=17000;p.Rf=39000;const d={name:'Laboratorio',experiment:'inverting',analysis:'time',circuits:{inverting:p},layouts:{}},next=Lab.selectExperience(d,'difference');
  assert.equal(next.circuits.difference.R1,17000);assert.equal(next.circuits.difference.R3,17000);assert.equal(next.circuits.difference.R4,39000);assert.equal(next.circuits.difference.bodeInput,'differential');assert.equal(d.circuits.difference,undefined);assert.equal(Lab.selectExperience(d,'unknown'),null);
});
test('an incomplete schematic preserves access to experimental analysis without pretending to have simulation data',()=>{
  const d=Free.example('rc');d.wires.pop();const c=Context.build(Free.serialize(d));assert.equal(c.points.length,0);assert.equal(c.bode.length,0);assert.ok(c.notice.includes('dati sperimentali'));
});
for(const [file,key,save]of [['rc-workbench.js','rcStudy','save'],['ac-workbench.js','acStudy','saveAC']])test(key+' validates the whole document before changing live data',()=>{
  const d=fixture();d[key].dataset.name='Old';const text=nearLimit(d);assert.doesNotThrow(()=>Free.parse(text));
  const {bench}=harness(file);bench.state=clone(d[key]);let writes=0;bench.owner={snapshot:()=>text,[save](){writes++;}};
  const candidate=clone(bench.state);candidate.dataset.name='New dataset '.repeat(10).slice(0,120);
  assert.throws(()=>bench.commit(candidate),/1 MB/);assert.equal(writes,0);assert.equal(bench.state.dataset.name,'Old');assert.equal(Free.parse(text)[key].dataset.name,'Old');
});
test('failed RC import rolls back the panel dataset as well as preserving the saved document',()=>{
  const d=fixture();d.rcStudy.dataset.name='Old';const text=nearLimit(d),{bench,get}=harness('rc-workbench.js');bench.state=clone(d.rcStudy);bench.ctx={points:[],parts:[],stamp:'test'};let writes=0;bench.owner={snapshot:()=>text,save(){writes++;}};
  for(const [id,value]of Object.entries({rcRaw:d.rcStudy.dataset.raw,rcDatasetName:'New dataset '.repeat(10),rcDelimiter:';',rcDecimal:'.',rcHeader:'yes',rcInputTime:'ms',rcInputVoltage:'V',rcTimeColumn:'0',rcVoltageColumn:'1',rcSigmaColumn:'2',rcTimeUnit:'ms'}))get(id).value=value;
  bench.readState=()=>clone(bench.state);bench.useData();assert.equal(writes,0);assert.equal(bench.state.dataset.name,'Old');assert.match(get('rcSourceInfo').textContent,/Old/);assert.match(get('rcError').textContent,/1 MB/);
});
test('shared dataset preflight refuses invalid metadata without modifying the incoming text',()=>{
  const d=fixture(),text=JSON.stringify(d),s=clone(d.rcStudy);s.dataset.points[1].x=s.dataset.points[0].x;
  assert.throws(()=>Files.checkStudyUpdate(text,'rcStudy',s),/analisi RC/);assert.deepEqual(JSON.parse(text),d);assert.throws(()=>Files.checkStudyUpdate(text,'other',d.rcStudy),/Tipo/);
});
test('compact imports must also fit the actual formatted portable document',()=>{
  const free=fixture();free.notes='';free.notes='x'.repeat(Files.MAX_BYTES-Buffer.byteLength(JSON.stringify(free))-10);const raw=JSON.stringify(free);
  assert.doesNotThrow(()=>Files.readJSON(raw));assert.ok(Buffer.byteLength(JSON.stringify(free,null,2))>Files.MAX_BYTES);assert.throws(()=>Free.parse(raw),/1 MB/);
  const guided={application:'Circuit Lab',version:2,name:'RC',experiment:'rc',analysis:'time',circuits:{rc:Lab.defaults('rc')},layouts:{},acStudy:fixture().acStudy};guided.circuits.rc.notes='';guided.circuits.rc.notes='x'.repeat(Files.MAX_BYTES-Buffer.byteLength(JSON.stringify(guided))-10);
  const text=JSON.stringify(guided);assert.doesNotThrow(()=>Files.readJSON(text));assert.throws(()=>Lab.parse(text),/1 MB/);
});
test('AC point export has consistent columns, original amplitudes, SI units and measured-minus-fit residuals',()=>{
  const d=fixture(),{bench}=harness('ac-workbench.js');bench.state=d.acStudy;bench.result=AC.analyze(d.acStudy.dataset.points,d.acStudy);bench.simulationReference='source';bench.simulation=Free.bode(d).data;
  const rows=RC.rows(bench.pointsCSV(),',').rows;assert.equal(rows.length,12);assert.equal(rows[0].length,19);assert.ok(rows.every(r=>r.length===19));assert.equal(rows[0][1],'Vin_V');assert.equal(Number(rows[1][1]),2);assert.equal(Number(rows[1][0]),10);assert.ok(Math.abs(Number(rows[1][12])-(Number(rows[1][6])-Number(rows[1][11])))<1e-11);
});
test('AC exports leave missing phase and unavailable model predictions blank',()=>{
  const d=fixture(),{bench}=harness('ac-workbench.js');d.acStudy.fit=false;d.acStudy.dataset.points=d.acStudy.dataset.points.map(({phase,uPhase,...p})=>p);bench.state=d.acStudy;bench.result=AC.analyze(d.acStudy.dataset.points,d.acStudy);bench.simulationReference='source';bench.simulation=[];
  const row=RC.rows(bench.pointsCSV(),',').rows[1];for(const index of [8,9,10,11,12,13,14,15,16,17,18])assert.equal(row[index],'');
});
test('AC summary neutralizes spreadsheet formulas and retains reference and uncertainty assumptions',()=>{
  const d=fixture(),{bench}=harness('ac-workbench.js');bench.state=d.acStudy;bench.state.dataset.name='=HYPERLINK("unsafe")';bench.result=AC.analyze(d.acStudy.dataset.points,d.acStudy);bench.ctx={notice:'Modello dichiarato'};bench.rows=[['fc',bench.result.fit.frequency,bench.result.fit.uFrequency,'Hz','Fit RC']];
  const rows=RC.rows(bench.summaryCSV(),',').rows;assert.ok(rows.every(r=>r.length===5));assert.ok(rows.some(r=>r[0]==='origine_dati'&&r[4].startsWith("'=")));assert.ok(rows.some(r=>r[0]==='ipotesi_incertezze'));assert.ok(rows.some(r=>r[0]==='riferimento_ingresso'));assert.ok(rows.some(r=>r[0]==='gradi_liberta_fit'&&Number(r[1])===9));
});
test('SVG export escapes dataset text and carries vector plots with unique clip references',()=>{
  const d=fixture(),{bench,get}=harness('ac-workbench.js');bench.state=d.acStudy;bench.state.dataset.name='A & B <misure>';bench.result=AC.analyze(d.acStudy.dataset.points,d.acStudy);
  for(const id of ['acMagnitudePlot','acPhasePlot'])get(id).innerHTML=`<defs><clipPath id="${id}-clip"><rect width="100" height="50"/></clipPath></defs><path clip-path="url(#${id}-clip)" d="M0 0L100 50"/>`;
  let artifact;bench.download=(text,mime,name)=>artifact={text,mime,name};bench.exportSVG();assert.equal(artifact.mime,'image/svg+xml');assert.match(artifact.text,/A &amp; B &lt;misure&gt;/);assert.match(artifact.text,/<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.equal((artifact.text.match(/id="acMagnitudePlot-clip"/g)||[]).length,1);assert.equal((artifact.text.match(/id="acPhasePlot-clip"/g)||[]).length,1);
});
