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
