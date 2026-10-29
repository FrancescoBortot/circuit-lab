const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const L=require('../lab-model'),B=require('../breadboard-model'),R=require('../breadboard-render');
const source=fs.readFileSync(path.join(__dirname,'../breadboard-workbench.js'),'utf8');
function controller(){
 const model=B.create(L.network(L.defaults('shaper')));model.terminals=[...model.parts,...model.sources].flatMap(c=>B.terminals(model,c.id));model.connections=R.connections(model);
 const state={step:3,part:'Rsh2',ref:'Rsh2:a',target:'Ubuf:out',net:'net:0',cable:'wire:W1'},frames=[],scope={B,R,M:require('../free-model'),model,state,draftDirty:false,validDraft:true,finishDraft:()=>scope.validDraft,sourceDialog:{open:false,close(){this.open=false;}},drawGeometry:()=>frames.push(R.board(model,{step:state.step})),updateControls(){},updateSelection(){},renderProperties(){}};
 vm.createContext(scope);const section=(from,to)=>source.slice(source.indexOf(' function '+from+'('),source.indexOf(' function '+to+'('));
 vm.runInContext(section('setStep','selectNet')+section('choose','command'),scope);return{scope,model,state,frames};
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
