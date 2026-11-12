const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../lab-model'),M=require('../free-model'),X=require('../latex-export'),BR=require('../breadboard-render'),B=require('../breadboard-model');
function overlaps(a,b){const eps=1e-6;return Math.abs(a[0].x-a[1].x)<eps&&Math.abs(b[0].x-b[1].x)<eps&&Math.abs(a[0].x-b[0].x)<eps&&Math.min(...[a,b].map(s=>Math.max(...s.map(p=>p.y))))-Math.max(...[a,b].map(s=>Math.min(...s.map(p=>p.y))))>eps||Math.abs(a[0].y-a[1].y)<eps&&Math.abs(b[0].y-b[1].y)<eps&&Math.abs(a[0].y-b[0].y)<eps&&Math.min(...[a,b].map(s=>Math.max(...s.map(p=>p.x))))-Math.max(...[a,b].map(s=>Math.min(...s.map(p=>p.x))))>eps;}
test('guided circuit drawings never merge different nets onto the same segment',()=>{for(const c of L.CATALOG){const project={experiment:c.id,circuits:{[c.type]:L.defaults(c.type)},layouts:{},analysis:'time'},variants=[project];if(L.radiation.hasFinal({type:c.type})){const bias=M.clone(project);bias.circuits[c.type].biasEnabled=true;variants.push(bias);}for(const project of variants){const d=L.circuit(project),topology=M.topology(d),paths=d.wires.map(w=>({w,p:X.route(d,w)}));for(let i=0;i<paths.length;i++)for(let j=0;j<i;j++){const a=paths[i],b=paths[j];if(topology.nodes[a.w.a]===topology.nodes[b.w.a])continue;for(let k=1;k<a.p.length;k++)for(let q=1;q<b.p.length;q++)assert.ok(!overlaps([a.p[k-1],a.p[k]],[b.p[q-1],b.p[q]]),c.id+' '+a.w.a+' → '+a.w.b+' / '+b.w.a+' → '+b.w.b);}}}});
test('routing is presentation only and the breadboard schematic uses the same paths',()=>{for(const type of ['noninverting','detector-chain']){const p=L.defaults(type),project={experiment:type,circuits:{[type]:p},layouts:{},analysis:'time'},d=L.circuit(project),plain=M.clone(d);for(const w of plain.wires){delete w.route;delete w.offset;}assert.deepEqual(M.topology(d),M.topology(plain));assert.deepEqual(M.simulate(d).data.map(r=>r.out),M.simulate(plain).data.map(r=>r.out));const svg=BR.schematic(B.create(d));for(const w of d.wires){const path=X.route(d,w).map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');assert.ok(svg.includes('d="'+path+'"'));}}});

test('guided sheet diagrams preserve the connections between visible components',()=>{
 const G=require('../guided-schematic'),Bench=require('../bench-model'),Free=require('../free-model');
 for(const entry of L.CATALOG.filter(c=>c.day>=5)){
  const base=L.defaults(entry.type);
  for(const changes of [{},{externalLoad:true,gateMeter:true,RL:4700},{bench:{...Bench.defaults(),mode:'real'}}]){
   const p={...base,...changes},full=L.network(p);
   const original=JSON.stringify(full),nominal=Bench.remove(full),sheet=G.layout(full,entry.type,p);
   assert.equal(JSON.stringify(full),original);
   assert.deepEqual(Free.validate(sheet),[],entry.type);
   const before=Free.topology(nominal).nodes,after=Free.topology(sheet).nodes;
   const pins=sheet.components.filter(c=>!c.schematicDecoration).flatMap(c=>Free.PINS[c.type].map(pin=>c.id+':'+pin));
   for(const a of pins){
    assert.equal(after[a]<0,before[a]<0,entry.type+' ground '+a);
    for(const b of pins)assert.equal(after[a]===after[b],before[a]===before[b],entry.type+' '+a+' '+b);
   }
   for(const role of ['input','output']){
    assert.ok(pins.some(pin=>after[pin]===after[sheet.probes[role]]&&before[pin]===before[nominal.probes[role]]),entry.type+' '+role);
   }
  }
 }
});
