const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Lab=require('../lab-model.js'),Free=require('../free-model.js'),copy=x=>JSON.parse(JSON.stringify(x));
function surface(kind){
 const listeners={},captures=new Set(),selected=[],moves=[],document={activeElement:null};
 const svg={addEventListener:(type,handler)=>listeners[type]=handler,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);listeners.lostpointercapture?.({pointerId:id});},getScreenCTM:()=>({inverse:()=>({})}),querySelector:()=>null,focus(){document.activeElement=svg;}};
 const scope={window:{LabModel:Lab,FreeModel:Free},document,DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',kind==='guided'?'diagram.js':'free-canvas.js'),'utf8'),scope);
 const callbacks={select:(...args)=>selected.push(args),deselect:()=>selected.push([null]),move:(...args)=>moves.push(args),moveWire:(...args)=>moves.push(args),moveGroup:(...args)=>moves.push(args),pin:(...args)=>selected.push(args),region:(...args)=>selected.push(args)};
 const canvas=new scope.window[kind==='guided'?'LabDiagram':'FreeCanvas'](svg,callbacks);canvas.draw=()=>{};
 const doc=kind==='guided'?Lab.defaults('rc'):Free.example('rc');if(kind==='guided')canvas.render(doc,{},'R');else canvas.render(doc,{kind:'component',id:'R1'},'select',null);
 const target=(attribute,id)=>({dataset:{[attribute]:id},closest(selector){return selector==='[data-'+attribute+']'?this:null;}});
 const blank={closest:()=>null};
 const event=(x,y,extra={})=>({button:0,pointerId:1,clientX:x,clientY:y,target:blank,type:'pointerup',preventDefault(){this.prevented=true;},...extra});
 return{canvas,doc,svg,listeners,captures,selected,moves,event,target,blank,callbacks};
}
test('fitting a hidden schematic preserves a finite recoverable view in breadboard mode',()=>{
 const h=surface('free'),before=copy(h.canvas.view);h.svg.getBoundingClientRect=()=>({width:0,height:0});h.canvas.fit();assert.deepEqual(copy(h.canvas.view),before);assert.ok(Object.values(h.canvas.view).every(Number.isFinite));
});
test('guided background tap deselects while panning and cancelled taps preserve selection',()=>{
 const h=surface('guided');h.canvas.down(h.event(50,50));h.canvas.up(h.event(50,50));assert.deepEqual(h.selected,[[null]]);
 h.selected.length=0;h.canvas.down(h.event(50,50));h.canvas.move(h.event(100,100));h.canvas.up(h.event(100,100));assert.equal(h.selected.length,0);
 h.canvas.down(h.event(50,50));h.canvas.up(h.event(50,50,{type:'pointercancel'}));assert.equal(h.selected.length,0);
});
test('guided cancelled drag restores the drawing and never writes a saved layout',()=>{
 const h=surface('guided'),before=copy(h.canvas.components.R);h.canvas.down(h.event(405,88,{target:h.target('component','R')}));h.canvas.move(h.event(455,118));assert.notEqual(h.canvas.components.R.x,before.x);
 h.canvas.up(h.event(455,118,{type:'pointercancel'}));assert.deepEqual(copy(h.canvas.components.R),before);assert.deepEqual(copy(h.canvas.layout),{});assert.equal(h.moves.length,0);
});
for(const kind of ['guided','free'])test(kind+' starts pinch without retaining an unfinished component move',()=>{
 const h=surface(kind),id=kind==='guided'?'R':'R1',part=kind==='guided'?h.canvas.components[id]:h.doc.components.find(c=>c.id===id),before=copy(part),attribute=kind==='guided'?'component':'part';
 h.canvas.down(h.event(part.x,part.y,{target:h.target(attribute,id)}));h.canvas.move(h.event(before.x+50,before.y+30));
 h.canvas.down(h.event(before.x+100,before.y+80,{pointerId:2}));const restored=kind==='guided'?h.canvas.components[id]:h.doc.components.find(c=>c.id===id);assert.equal(restored.x,before.x);assert.equal(restored.y,before.y);
 h.canvas.down(h.event(500,400,{pointerId:3}));h.canvas.up(h.event(500,400,{pointerId:3}));h.canvas.up(h.event(400,300,{pointerId:2}));h.canvas.up(h.event(400,300));assert.equal(h.moves.length,0);assert.equal(h.selected.length,0);
});
for(const kind of ['guided','free'])test(kind+' explicit gesture cancellation ignores later pointer releases',()=>{
 const h=surface(kind),id=kind==='guided'?'R':'R1',part=kind==='guided'?h.canvas.components[id]:h.doc.components.find(c=>c.id===id),before=copy(part),attribute=kind==='guided'?'component':'part';
 h.canvas.down(h.event(part.x,part.y,{target:h.target(attribute,id)}));h.canvas.move(h.event(before.x+40,before.y+40));h.canvas.cancelGesture();h.canvas.up(h.event(before.x+40,before.y+40));
 const restored=kind==='guided'?h.canvas.components[id]:h.doc.components.find(c=>c.id===id);assert.equal(restored.x,before.x);assert.equal(restored.y,before.y);assert.equal(h.moves.length,0);assert.equal(h.captures.size,0);
});
test('free wire cancellation removes preview-only routing attributes exactly',()=>{
 const h=surface('free'),before=Free.serialize(h.doc),wire=h.doc.wires[0];assert.equal(wire.route,undefined);assert.equal(wire.offset,undefined);
 h.canvas.down(h.event(200,200,{target:h.target('wire',wire.id)}));h.canvas.move(h.event(240,270));assert.ok(h.doc.wires[0].route);
 h.canvas.up(h.event(240,270,{type:'pointercancel'}));assert.equal(Free.serialize(h.doc),before);assert.equal(h.moves.length,0);
});
test('free committed wire drag supplies an unchanged prior document for undo',()=>{
 const h=surface('free'),before=Free.serialize(h.doc),wire=h.doc.wires[0];let undo;
 h.callbacks.moveWire=(id,route,offset)=>{undo=Free.serialize(h.doc);Object.assign(h.doc.wires.find(w=>w.id===id),{route,offset});};
 h.canvas.down(h.event(200,200,{target:h.target('wire',wire.id)}));h.canvas.move(h.event(240,270));h.canvas.up(h.event(240,270));assert.equal(undo,before);assert.ok(h.doc.wires[0].route);assert.notEqual(Free.serialize(h.doc),before);
 h.canvas.doc=Free.parse(undo);assert.equal(Free.serialize(h.canvas.doc),before);
});
test('free group cancellation restores all positions, not just the clicked component',()=>{
 const h=surface('free'),before=Free.serialize(h.doc),parts=h.doc.components.slice(0,2),id=parts[0].id;h.canvas.selection={kind:'group',ids:parts.map(c=>c.id)};
 h.canvas.down(h.event(parts[0].x,parts[0].y,{target:h.target('part',id)}));h.canvas.move(h.event(parts[0].x+50,parts[0].y+30));assert.notEqual(Free.serialize(h.doc),before);
 h.listeners.lostpointercapture({pointerId:1});assert.equal(Free.serialize(h.doc),before);assert.equal(h.moves.length,0);
});
for(const kind of ['guided','free'])test(kind+' unrelated pointer releases cannot prematurely commit a drag',()=>{
 const h=surface(kind),id=kind==='guided'?'R':'R1',part=kind==='guided'?h.canvas.components[id]:h.doc.components.find(c=>c.id===id),x=part.x,y=part.y;
 h.canvas.down(h.event(x,y,{target:h.target(kind==='guided'?'component':'part',id)}));h.canvas.move(h.event(x+50,y+30));h.canvas.up(h.event(x+50,y+30,{pointerId:99}));assert.equal(h.moves.length,0);assert.ok(h.canvas.drag);
 h.canvas.up(h.event(x+50,y+30));assert.equal(h.moves.length,1);
});
for(const kind of ['guided','free'])test(kind+' browser modifier shortcuts do not move or zoom circuit components',()=>{
 const h=surface(kind),target=h.target(kind==='guided'?'component':'part',kind==='guided'?'R':'R1'),before=copy(h.canvas.view);
 for(const modifier of ['metaKey','ctrlKey','altKey'])for(const key of ['ArrowRight','+','0'])h.listeners.keydown(h.event(0,0,{target,key,[modifier]:true}));
 assert.deepEqual(copy(h.canvas.view),before);assert.equal(h.moves.length,0);
 h.listeners.keydown(h.event(0,0,{target,key:'ArrowRight'}));assert.equal(h.moves.length,1);
});
