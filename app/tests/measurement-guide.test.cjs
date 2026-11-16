const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../breadboard-model');
const F=require('../free-model');
const L=require('../lab-model');
const Guide=require('../measurement-guide');

test('every guided step resolves to the correct electrical strip on the reference breadboard',()=>{
 for(const experiment of L.CATALOG){
  const p=L.defaults(experiment.type);
  if(L.radiation.hasFinal(p))p.biasEnabled=true;
  const d=L.circuit({experiment:experiment.id,circuits:{[p.type]:p},analysis:L.analyses(p)[0][0]});
  const model=B.create(d,{semiconductorType:L.semiconductor.is(p)?p.type:undefined});
  const steps=Guide.forCircuit(p);
  assert.ok(steps.length,experiment.id);
  assert.equal(new Set(steps.map(s=>s.id)).size,steps.length,experiment.id);
  for(const step of steps){
   const resolved=Guide.boardPoints(model,step);
   assert.ok(resolved,experiment.id+' '+step.id);
   assert.ok(resolved.points.every(p=>Number.isFinite(p.point?.x)&&Number.isFinite(p.point?.y)),experiment.id+' '+step.id);
   if(step.series){
    assert.equal(resolved.cable.kind,'wire');
    const [red,com]=resolved.points.map(p=>p.hole);
    const remaining=model.wires.filter(w=>w.id!==resolved.cable.id);
    const groupReachable=(from,to)=>{
     const seen=new Set([B.group(from)]),queue=[B.group(from)];
     for(let i=0;i<queue.length;i++)for(const wire of remaining){
      const a=B.group(wire.a),b=B.group(wire.b),next=a===queue[i]?b:b===queue[i]?a:null;
      if(next&&!seen.has(next)){seen.add(next);queue.push(next);}
     }
     return seen.has(B.group(to));
    };
    assert.ok(groupReachable(model.pinHoles[step.points[0].ref],red));
    assert.ok(groupReachable(model.pinHoles[step.points[1].ref],com));
    assert.ok(!groupReachable(red,com));
    continue;
   }
   for(const point of resolved.points){
    const ref=point.ref==='@out'?model.doc.probes.output:point.ref;
    const node=model.topology.nodes[ref];
    assert.ok(model.nets.find(n=>n.index===node)?.groups.includes(B.group(point.hole)),point.ref);
    if(!step.parameter&&!point.sameStrip)assert.ok(!model.occupied.includes(point.hole));
   }
  }
  assert.deepEqual(F.validate(model.doc),[]);
 }
});
