const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const L=require('../lab-model'),B=require('../breadboard-model'),R=require('../breadboard-render');
const source=fs.readFileSync(path.join(__dirname,'../breadboard-workbench.js'),'utf8');
function controller(){
 const model=B.create(L.network(L.defaults('shaper')));model.terminals=[...model.parts,...model.sources].flatMap(c=>B.terminals(model,c.id));model.connections=R.connections(model);
 const state={step:3,part:'Rsh2',ref:'Rsh2:a',target:'Ubuf:out',net:'net:0',cable:'wire:W1'},frames=[],settings={framing:'bench',zoom:1},saved=[],scope={B,R,settings,save:()=>saved.push({...settings}),M:require('../free-model'),model,state,draftDirty:false,validDraft:true,finishDraft:()=>scope.validDraft,sourceDialog:{open:false,close(){this.open=false;}},drawGeometry:()=>frames.push(R.board(model,{step:state.step,framing:settings.framing})),updateControls(){},updateSelection(){},renderProperties(){}};
 vm.createContext(scope);const section=(from,to)=>source.slice(source.indexOf(' function '+from+'('),source.indexOf(' function '+to+'('));
 vm.runInContext(section('setStep','selectNet')+section('choose','command'),scope);return{scope,model,state,frames,settings,saved};
}
test('switching to components preserves the selected component, clears the old route and redraws without touching the circuit',()=>{
 const {scope,model,state,frames}=controller(),before=JSON.stringify(model);assert.equal(scope.setStep(0),true);assert.equal(state.step,0);assert.equal(state.part,'Rsh2');for(const key of ['ref','target','net','cable'])assert.equal(state[key],null);assert.match(frames[0],/Solo componenti/);assert.equal(JSON.stringify(model),before);
 assert.equal(scope.setStep(3),true);assert.equal(state.step,3);assert.equal(frames.length,2);assert.equal(JSON.stringify(model),before);
});
test('guide navigation preserves a rejected edit and does not hide the part being edited',()=>{
 const {scope,state,frames}=controller(),before=JSON.stringify(state);scope.validDraft=false;assert.equal(scope.setStep(0),false);assert.equal(JSON.stringify(state),before);assert.equal(frames.length,0);
 scope.validDraft=true;state.part='Ubuf.Cd+';scope.setStep(0);assert.equal(state.part,null);
});
test('selecting a terminal stays in components; following its destination reveals only the required guide phase',()=>{
 const {scope,state,model}=controller(),before=JSON.stringify(model);scope.setStep(0);scope.choose('terminal','Rsh2:a');assert.equal(state.step,0);assert.equal(state.ref,'Rsh2:a');assert.equal(state.target,null);
 scope.choose('destination','Rsh2:a|Ubuf:out');assert.equal(state.step,2);assert.equal(state.ref,'Rsh2:a');assert.equal(state.target,'Ubuf:out');assert.equal(JSON.stringify(model),before);
 scope.setStep(0);scope.choose('destination','Ubuf:8|PSU:Ubuf+');assert.equal(state.step,1);assert.equal(state.target,'PSU:Ubuf+');
});


test('guide phase changes preserve the selected framing and manual zoom in every section',()=>{
 const {scope,model,state,frames,settings}=controller(),before=JSON.stringify(model),view=()=>frames.at(-1).match(/viewBox="([^"]+)"/)[1];settings.zoom=1.55;
 const expected={};for(const mode of ['bench','board']){
  assert.equal(scope.setFraming(mode),true);expected[mode]=view();
  for(const step of [0,1,2,3,0]){assert.equal(scope.setStep(step),true);assert.equal(state.step,step);assert.equal(settings.framing,mode);assert.equal(settings.zoom,1.55);assert.equal(view(),expected[mode]);}
 }
 assert.notEqual(expected.bench,expected.board);assert.equal(JSON.stringify(model),before);
});
test('optional close-up preserves a pending invalid edit, selection and circuit',()=>{
 const {scope,model,state,settings,saved}=controller(),before=JSON.stringify(model),selected=JSON.stringify(state);scope.validDraft=false;scope.draftDirty=true;
 assert.equal(scope.setFraming('board'),true);assert.equal(settings.framing,'board');assert.equal(scope.draftDirty,true);assert.equal(JSON.stringify(state),selected);assert.equal(JSON.stringify(model),before);assert.equal(saved.at(-1).framing,'board');
 assert.equal(scope.setStep(0),false);assert.equal(state.step,3);assert.equal(scope.setFraming('bench'),true);
});
test('unknown framing is rejected without changing the view or saved preference',()=>{
 const {scope,settings,frames,saved}=controller();for(const mode of ['auto','',null,0])assert.equal(scope.setFraming(mode),false);assert.equal(settings.framing,'bench');assert.equal(frames.length,0);assert.equal(saved.length,0);
});

test('construction covers each physical part and cable once in increasing phases without changing the model',()=>{
 for(const c of L.CATALOG){const model=B.create(L.network(L.defaults(c.type))),before=JSON.stringify(model),steps=R.assemblySteps(model),expected=[...model.parts.map(p=>'part:'+p.id),...R.connections(model).map(c=>c.key)].sort();
 assert.deepEqual(steps.map(s=>s.kind+':'+s.id).sort(),expected);assert.equal(new Set(expected).size,expected.length);assert.ok(steps.every((s,i)=>s.text.length>10&&(!i||s.phase>=steps[i-1].phase)));assert.equal(JSON.stringify(model),before);
 }
});
test('construction advances one operation, goes back, completes and preserves rejected edits',()=>{
 const model=B.create(L.network(L.defaults('shaper'))),before=JSON.stringify(model),scope={requestAnimationFrame(){},A:require('../assembly-guide'),message(){},saveConstruction(){},model,R,construction:{active:false,index:0},constructionPlan:[],state:{step:3},valid:true,finishDraft:()=>scope.valid,drawGeometry(){},updateControls(){},renderProperties(){}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf(' function constructionCommand('),source.indexOf(' function updateConstruction(')),scope);
 scope.constructionCommand('build-start');scope.construction.checks={continuity:true,power:true,baseline:true,probes:true};assert.equal(scope.construction.active,true);assert.equal(scope.construction.index,0);assert.equal(scope.state.step,0);
 scope.valid=false;scope.constructionCommand('build-next');assert.equal(scope.construction.index,0);scope.valid=true;scope.constructionCommand('build-next');assert.equal(scope.construction.index,1);scope.constructionCommand('build-back');assert.equal(scope.construction.index,0);
 for(let i=1;i<scope.constructionPlan.length;i++){scope.constructionCommand('build-next');assert.equal(scope.construction.index,i);assert.equal(scope.state.step,scope.constructionPlan[i].phase);}
 scope.constructionCommand('build-next');assert.equal(scope.construction.active,false);assert.equal(scope.state.step,3);assert.equal(JSON.stringify(model),before);
});
test('reference schematic zoom changes both dimensions, zooms out and fits inside its viewport',()=>{
 const svg={style:{},getAttribute:()=> '0 0 2000 600'},viewport={clientWidth:900,clientHeight:380,scrollLeft:300,scrollTop:50},output={textContent:''},settings={schemaZoom:1,zoom:1.55},scope={settings,root:{querySelector:s=>s==='.bb-schema'?svg:s==='.bb-schema-viewport'?viewport:output}};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf(' function applySchemaZoom('),source.indexOf(' function constructionCommand(')),scope);
 scope.applySchemaZoom();assert.equal(svg.style.width,'2000px');assert.equal(svg.style.height,'600px');
 scope.schemaZoomCommand('schema-in');assert.equal(svg.style.width,'2400px');assert.equal(svg.style.height,'720px');assert.equal(output.textContent,'120%');
 scope.schemaZoomCommand('schema-out');scope.schemaZoomCommand('schema-out');assert.equal(svg.style.width,'1600px');assert.equal(svg.style.height,'480px');
 scope.schemaZoomCommand('schema-fit');assert.ok(parseFloat(svg.style.width)<=viewport.clientWidth);assert.ok(parseFloat(svg.style.height)<=viewport.clientHeight);assert.equal(settings.zoom,1.55);
});

test('assembly instructions and markers use the actual holes and instrument endpoints for every circuit',()=>{
 for(const circuit of L.CATALOG){const model=B.create(L.network(L.defaults(circuit.type))),before=JSON.stringify(model),g=R.geometry(model),connections=R.connections(model);
 for(const step of R.assemblySteps(model)){
  assert.ok(step.purpose.length>15);assert.equal(step.endpoints.length,step.kind==='part'&&model.parts.find(p=>p.id===step.id).type==='U'?8:2);
  for(const e of step.endpoints){assert.ok(Number.isFinite(e.point.x)&&Number.isFinite(e.point.y));if(e.hole)assert.deepEqual(e.point,g.point(e.hole));}
  if(step.kind!=='part'){const cable=connections.find(c=>c.key===step.kind+':'+step.id);assert.deepEqual(step.endpoints.map(e=>e.point),[cable.a.point,cable.b.point]);}
  const markers=R.assemblyMarkers(model,step);assert.equal([...markers.matchAll(/data-bb-build-point=/g)].length,step.endpoints.length);for(const e of step.endpoints)if(e.hole)assert.ok(markers.includes('data-bb-hole="'+e.hole+'"'));
 }
 assert.equal(JSON.stringify(model),before);
 }
});
test('grounded resistor, generator, supply and measurement actions explain their electrical purpose',()=>{
 const model=B.create(L.network(L.defaults('shaper-buffer'))),steps=R.assemblySteps(model);
 assert.ok(steps.some(s=>s.kind==='wire'&&/Collego Rsh1 a massa/.test(s.purpose)));
 for(const pattern of [/ritorno del generatore a massa/,/segnale del generatore/,/V\+ all’operazionale/,/massa della sonda/,/Misuro la tensione/,/Chiudo la retroazione/])assert.ok(steps.some(s=>pattern.test(s.purpose)),String(pattern));
});
