const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Files=require('../local-projects.js'),Free=require('../free-model.js'),Lab=require('../lab-model.js');
const memory=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};};
const guided=()=>({name:'Prova',experiment:'rc',analysis:'time',circuits:{rc:Lab.defaults('rc')},layouts:{}});
const state=()=>({canvas:{x:-30,y:20,w:800,h:400},plots:{time:{logX:false,xUnit:'s',view:[.001,.004],a:{x:.001,index:1},b:{x:.003,index:3},dual:true,activeCursor:'b'}},quantity:{time:'current',bode:'phase'},labels:true,auto:false,expanded:false,inspectorOpen:true,panel:'probes',visible:{vin:false,out:true,P1:true},measureWindow:true});
test('JSON import accepts data and rejects executable text, nonfinite numbers and prototype keys',()=>{
  assert.deepEqual(Files.readJSON('{"name":"<script>not executed</script>"}'),{name:'<script>not executed</script>'});
  for(const text of ['null','[]','(()=>alert(1))()','{"x":1e309}','{"__proto__":{"polluted":true}}','{"a":{"constructor":{}}}'])assert.throws(()=>Files.readJSON(text));
  assert.equal({}.polluted,undefined);
});
test('import bounds apply to UTF-8 bytes and nesting before the model is used',()=>{
  assert.throws(()=>Files.readJSON(JSON.stringify({s:'è'.repeat(500000)})),/1 MB/);
  assert.throws(()=>Files.readJSON('{"x":'.repeat(30)+'{}'+'}'.repeat(30)),/complessa/);
  assert.throws(()=>Free.parse(JSON.stringify({...Free.blank(),components:[null]})),/componente/);
  assert.throws(()=>Free.parse(JSON.stringify({...Free.blank(),components:[{id:'R1',type:'constructor'}]})),/componente/);
});
test('guided imports reject malformed layout and null circuit records',()=>{
  const doc=guided();doc.layouts.rc={R:{x:'<svg onload=alert(1)>',y:50}};
  assert.throws(()=>Lab.parse(Lab.serialize(doc)),/Posizione/);
  doc.layouts={};doc.circuits.rc=null;assert.throws(()=>Lab.parse(Lab.serialize(doc)),/Circuito non valido/);
});
test('previous free documents remain valid without workspace state',()=>{
  const doc=Free.example('rc');assert.deepEqual(Free.parse(Free.serialize(doc)),doc);
  const unnamed=Free.blank();delete unnamed.name;assert.equal(Free.parse(JSON.stringify(unnamed)).name,'Circuito senza titolo');
  const text=fs.readFileSync(path.join(__dirname,'../esempi/invertente-libero.json'),'utf8');assert.equal(Free.parse(text).version,3);
});
test('a portable project retains the complete measurement workspace without changing its circuit solution',()=>{
  const doc=Free.example('rc'),expected=Free.simulate(doc).data.at(-1).out;doc.workspace=state();
  const restored=Free.parse(Free.serialize(doc));assert.deepEqual(restored.workspace,doc.workspace);assert.equal(Free.simulate(restored).data.at(-1).out,expected);
});
test('invalid cursor, logarithmic axis, visibility and canvas states are refused on import',()=>{
  for(const mutate of [w=>w.canvas.w=0,w=>w.plots.time.view=[1,1],w=>w.plots.time.a.index=-1,w=>w.plots.time.dual='yes',w=>w.plots.bode={...w.plots.time,logX:true,xUnit:'Hz',view:[0,10]},w=>w.visible.out='false',w=>w.quantity.time='db']){
    const doc=Free.blank();doc.workspace=state();mutate(doc.workspace);assert.throws(()=>Free.parse(JSON.stringify(doc)),/vista/);
  }
});
test('opening/replacing a circuit leaves a previous copy that view autosaves do not overwrite',()=>{
  const storage=memory(),store=Files.createStore(storage,'circuit',Free.parse),a=Free.example('rc'),b=Free.example('inverting');
  assert.equal(store.write(Free.serialize(a)).ok,true);assert.equal(store.write(Free.serialize(b),true).ok,true);
  b.workspace=state();store.write(Free.serialize(b));assert.deepEqual(store.previous(),a);assert.deepEqual(store.read().doc,b);
});
test('a corrupt current copy falls back to the previous circuit and keeps the recovery point',()=>{
  const storage=memory(),store=Files.createStore(storage,'circuit',Free.parse),doc=Free.example('rc');store.write(Free.serialize(doc));store.write(Free.serialize(Free.example('inverting')),true);
  storage.setItem('circuit','{broken');const recovered=store.read();assert.equal(recovered.recovered,true);assert.deepEqual(recovered.doc,doc);
  assert.equal(store.write(Free.serialize(doc)).ok,true);assert.deepEqual(store.previous(),doc);
});
test('unavailable or full browser storage is reported without claiming an autosave',()=>{
  const unavailable=Files.createStore({getItem(){throw new Error('denied');}},'circuit',Free.parse);assert.ok(unavailable.read().error);assert.equal(unavailable.write(Free.serialize(Free.blank())).ok,false);
  const storage=memory(),store=Files.createStore(storage,'circuit',Free.parse),a=Free.example('rc');store.write(Free.serialize(a));storage.setItem=()=>{throw new Error('quota');};
  assert.equal(store.write(Free.serialize(Free.example('inverting')),true).ok,false);assert.deepEqual(store.read().doc,a);
});
test('invalid incoming data never replaces a valid stored project',()=>{
  const storage=memory(),store=Files.createStore(storage,'circuit',Lab.parse),text=Lab.serialize(guided());store.write(text);assert.equal(store.write('{"application":"other"}',true).ok,false);assert.equal(storage.getItem('circuit'),text);
});
test('diagnostics identify the terminal that needs a wire without adding hidden connections',()=>{
  const doc=Free.example('rc'),before=JSON.stringify(doc);doc.wires.pop();const diagnostics=Free.diagnostics(doc);
  assert.ok(diagnostics.some(d=>d.pin&&Free.validPin(doc,d.pin)&&d.component));assert.deepEqual(Free.issues(doc),diagnostics.map(d=>d.message));assert.equal(doc.wires.length,JSON.parse(before).wires.length-1);
});
test('portable filenames cannot introduce directories or executable extensions',()=>{
  assert.equal(Files.fileName('../../RC <script>.html'),'RC-scripthtml.json');assert.equal(Files.fileName(''),'circuito.json');assert.ok(Files.fileName('Misura τ').endsWith('.json'));
});
const context={window:{LabModel:Lab,LabMeasurements:require('../measurements.js')}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../plot.js'),'utf8'),context);
const Plot=context.window.LabPlot;
function fakePlot(data,logX=false){return{data,config:{logX,xUnit:logX?'Hz':'s'},domain:logX?[0,3]:[0,3],view:logX?[0,3]:[0,3],toDomain:logX?Math.log10:x=>x,fromDomain:logX?x=>10**x:x=>x,cursorA:data[1],cursorB:data.at(-1),dual:true,activeCursor:'b',syncControls(){},draw(){}};}
test('cursor restoration distinguishes the two sides of an ideal event',()=>{
  const data=[{x:0,out:0},{x:1,out:0},{x:1,out:5},{x:3,out:5}],plot=fakePlot(data);const saved=Plot.prototype.exportState.call(plot);plot.cursorA=data[2];Plot.prototype.restoreState.call(plot,saved);assert.equal(plot.cursorA.out,0);assert.equal(plot.dual,true);assert.equal(plot.activeCursor,'b');
});
test('logarithmic plot windows are stored in Hz and restored inside a changed domain',()=>{
  const data=[{x:1},{x:10},{x:100},{x:1000}],plot=fakePlot(data,true);plot.view=[1,2];const saved=Plot.prototype.exportState.call(plot);assert.deepEqual(Array.from(saved.view),[10,100]);plot.domain=[1.5,3];Plot.prototype.restoreState.call(plot,saved);assert.deepEqual(Array.from(plot.view),[1.5,2]);
});
test('local resources and a restrictive policy prevent remote runtime dependencies',()=>{
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/connect-src 'none'/);assert.match(html,/object-src 'none'/);assert.match(html,/base-uri 'none'/);
  for(const [,src]of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!src.startsWith('data:')&&!src.startsWith('https:'))assert.ok(fs.existsSync(path.join(root,src.split('?')[0])),src);
  for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js'))){const source=fs.readFileSync(path.join(root,name),'utf8');assert.doesNotMatch(source,/\b(?:fetch|eval|WebSocket|XMLHttpRequest|EventSource)\s*\(|navigator\.sendBeacon|new\s+Function\s*\(/,name);}
});
