const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../breadboard-model.js'),R=require('../breadboard-render.js'),M=require('../free-model.js'),L=require('../lab-model.js'),Bench=require('../bench-model.js');
const guided=(type='inverting',extra={},analysis='time')=>L.circuit({experiment:type,circuits:{[type]:{...L.defaults(type),...extra}},analysis,layouts:{}});
function connectivity(b){const edges=new Map();function link(a,z){if(!edges.has(a))edges.set(a,new Set());if(!edges.has(z))edges.set(z,new Set());edges.get(a).add(z);edges.get(z).add(a);}for(const g of b.groups)for(let i=1;i<g.length;i++)link(g[i-1],g[i]);for(const w of b.wires)link(w.a,w.b);return(a,z)=>{const stack=[b.pinHoles[a]],seen=new Set(stack);while(stack.length){const v=stack.pop();if(v===b.pinHoles[z])return true;for(const next of edges.get(v)||[])if(!seen.has(next)){seen.add(next);stack.push(next);}}return false;};}
test('all guided circuits have equivalent physical contacts and leave the source untouched',()=>{
 for(const c of L.CATALOG)for(const instrument of ['ideal','generator','direct','probe']){const doc=guided(c.type,{instrument}),before=M.serialize(doc),b=B.create(doc),connected=connectivity(b),refs=Object.keys(M.topology(b.doc).nodes);assert.equal(M.serialize(doc),before);assert.equal(B.verify(b).length,0);assert.equal(new Set(b.occupied).size,b.occupied.length);for(const a of refs)for(const z of refs)assert.equal(connected(a,z),b.topology.nodes[a]===b.topology.nodes[z],c.id+' '+a+' '+z);}
});
test('inverter has the expected feedback, input isolation and reference without relying on node numbering',()=>{
 const b=B.create(guided()),connected=connectivity(b);for(const[a,z]of [['Rf:a','U1:minus'],['Rf:b','U1:out'],['R1:b','U1:minus'],['U1:plus','V1:n']])assert.equal(connected(a,z),true);for(const[a,z]of [['R1:a','U1:minus'],['U1:out','U1:minus'],['V1:p','V1:n']])assert.equal(connected(a,z),false);
});
test('derivative places C in series and does not short it through a reused breadboard row',()=>{const b=B.create(guided('derivative')),c=connectivity(b);assert.equal(c('R1:b','C1:a'),true);assert.equal(c('C1:b','U1:minus'),true);assert.equal(c('C1:a','C1:b'),false);assert.equal(c('R1:b','U1:minus'),false);});
test('difference amplifier has two generator outputs and preserves every drive mode',()=>{for(const drive of ['independent','v1','v2','common','differential']){const b=B.create(guided('difference',{drive}));assert.equal(b.sources.length,2);assert.equal(B.verify(b).length,0);assert.notEqual(b.topology.nodes['V1:p'],b.topology.nodes['V2:p']);if(drive==='common')assert.deepEqual(b.sources[0].wave,b.sources[1].wave);}});
test('TL082 top view uses pins 1/2/3 for A, 4/8 for supplies and a separate follower for unused B',()=>{const b=B.create(guided()),p=Object.fromEntries(b.devicePins.map(p=>[p.number,p]));assert.equal(p[1].hole,b.pinHoles['U1:out']);assert.equal(p[2].hole,b.pinHoles['U1:minus']);assert.equal(p[3].hole,b.pinHoles['U1:plus']);assert.equal(p[4].name,'V−');assert.equal(p[8].name,'V+');assert.equal(p[5].node,-1);assert.equal(p[6].node,p[7].node);assert.notEqual(p[6].node,b.topology.nodes['U1:out']);});
test('all actual placements and jumper tips occupy distinct holes',()=>{for(const type of ['rc','inverting','derivative','difference']){const b=B.create(guided(type)),known=new Set(b.groups.flat()),used=[];for(const c of b.parts)used.push(...Object.values(c.holes));for(const w of b.wires)used.push(w.a,w.b);for(const c of b.contacts)used.push(c.hole);for(const c of b.channels)used.push(c.hole,...c.ground?[c.ground]:[]);assert.equal(new Set(used).size,used.length,type);assert.ok(used.every(h=>known.has(h)));}});
test('continuity verification detects removed or incorrect jumper connections',()=>{const b=B.create(guided('rc'));assert.ok(b.wires.length);const removed=M.clone(b);removed.wires=[];assert.ok(B.verify(removed).length);const shorted=M.clone(b);shorted.wires.push({a:b.pinHoles['V1:p'],b:b.pinHoles['V1:n']});assert.ok(B.verify(shorted).length);});
test('real instrument models remain unchanged and are not added twice',()=>{for(const type of ['rc','inverting','derivative','difference'])for(const kind of ['direct','probe10'])for(const coupling of ['ac','dc']){const config={...Bench.defaults(),mode:'real'};config.channels.forEach(ch=>Object.assign(ch,{kind,coupling}));const doc=guided(type,{bench:config}),before=M.serialize(doc),b=B.create(doc,{channels:config.channels});assert.equal(M.serialize(doc),before);assert.equal(B.verify(b).length,0);assert.ok(!b.parts.some(c=>c.component?.benchRole));assert.deepEqual(b.instrumentConfig,config);}});
test('disabled channels are absent and custom CH1/CH2 measurement locations are respected',()=>{const doc=guided('difference'),b=B.create(doc,{channels:[{enabled:false,target:'input'},{enabled:true,target:'R3:a',kind:'probe10',coupling:'ac'}]});assert.equal(b.channels.length,1);assert.equal(b.channels[0].id,'CH2');assert.equal(b.channels[0].target,'R3:a');assert.equal(b.channels[0].node,b.topology.nodes['R3:a']);});
test('free circuit labels and geometric rotation do not change the proposed physical wiring',()=>{const doc=guided(),a=B.create(doc);doc.components.forEach(c=>{c.rotation=(c.rotation+180)%360;c.x+=60;});doc.nodeLabels={'V1:p':'Segnale'};const b=B.create(doc);assert.deepEqual(b.pinHoles,a.pinHoles);assert.deepEqual(b.wires,a.wires);});
test('dense passive networks stay on one full-size board with independent strips and rails',()=>{const d=M.blank();for(let i=0;i<34;i++)d.components.push(M.component('R','R'+i));const b=B.create(d);assert.equal(b.modules.length,1);assert.equal(b.modules[0].rows,63);assert.equal(B.verify(b).length,0);assert.ok(b.occupied.every(h=>h.startsWith('M1:')));assert.notEqual(B.group('M1:L2.1'),B.group('M1:a2'));assert.notEqual(B.group('M1:L2.1'),B.group('M1:L1.1'));});
test('a circuit that exceeds the single physical board reports its limit instead of adding boards',()=>{const amps=M.blank();for(let i=0;i<6;i++)amps.components.push(M.component('U','U'+i));assert.throws(()=>B.create(amps),/singola breadboard.*Schema/);});
test('all day 3 and 4 situations, including the optional output buffer, fit one board without overlapping contacts',()=>{
 const Rad=require('../radiation-model');
 for(const type of Rad.TYPES)for(const key of ['',...Rad.PRESETS[type].map(([key])=>key)])for(const outputBuffer of [false,true]){
  let params=L.defaults(type);if(key)params=Rad.applyPreset(params,key).parameters;params.outputBuffer=outputBuffer;
  const doc=Rad.network(params),before=M.serialize(doc),b=B.create(doc),known=new Set(b.groups.flat()),used=[];
  assert.equal(b.modules.length,1,type+' '+key);assert.equal(M.serialize(doc),before);assert.equal(B.verify(b).length,0);
  for(const c of b.parts)used.push(...Object.values(c.holes));for(const w of b.wires)used.push(w.a,w.b);for(const c of b.contacts)used.push(c.hole);for(const c of b.channels)used.push(c.hole,...c.ground?[c.ground]:[]);
  assert.equal(new Set(used).size,used.length,type+' '+key);assert.ok(used.every(h=>known.has(h)&&h.startsWith('M1:')));
  const svg=R.board(b),g=R.geometry(b),detail=R.frame(b,0,'board');assert.equal([...svg.matchAll(/data-bb-board=/g)].length,1);assert.doesNotMatch(svg,/NaN|undefined|M2:/);
  for(const hole of used){const p=g.point(hole);assert.ok(p.x>=detail.x&&p.x<=detail.x+detail.width&&p.y>=detail.y&&p.y<detail.y+detail.height);}
 }
});
test('view, highlighted net and building steps change only SVG and retain color identity',()=>{const b=B.create(guided('difference')),before=JSON.stringify(b),full=R.board(b,{step:3,pins:true}),parts=R.board(b,{step:0,pins:false}),focus=R.board(b,{step:3,tracks:true,net:b.nets[0].id}),schema=R.schematic(b);assert.equal(JSON.stringify(b),before);assert.notEqual(parts,full);assert.notEqual(full,focus);assert.match(full,/AFG1022/);assert.match(full,/CH1/);assert.match(full,/CH2/);for(const n of b.nets.filter(n=>n.refs.length)){assert.ok(full.includes(n.color));assert.ok(schema.includes(n.color));}for(const svg of [full,parts,focus,schema])assert.doesNotMatch(svg,/NaN|undefined/);});
test('rendered channels and signals carry explicit endpoints instead of decorative active buttons',()=>{const b=B.create(guided('rc')),svg=R.board(b);assert.match(svg,/Generatore CH2 libero/);assert.doesNotMatch(svg,/data-bb-source="V2"/);assert.match(svg,/CH1 · puntale/);assert.match(svg,/CH2 · clip di massa/);assert.match(svg,/data-bb-part="C1"/);});
test('unverified packages and more than two generators produce actionable errors',()=>{assert.throws(()=>B.create(M.example('bjt')),/profilo fisico/);const d=M.example('rc');d.components.push(M.component('V','V2'),M.component('V','V3'));assert.throws(()=>B.create(d),/due uscite/);assert.equal(B.create(M.blank()).empty,true);});
test('opening the physical view leaves numerical RC and inverter results unchanged',()=>{for(const type of ['rc','inverting']){const doc=guided(type),a=M.operatingPoint(doc);B.create(doc);const z=M.operatingPoint(doc);assert.deepEqual(z,a);}});
test('the real generator panel never presents a floating return as an isolated output',()=>{const d=guided('rc');d.wires=d.wires.filter(w=>w.a!=='V1:n'&&w.b!=='V1:n');assert.throws(()=>B.create(d),/ritorni comuni/);});
test('differential generator display applies polarity to offset and shows the actual phase',()=>{const p=L.defaults('difference');p.drive='differential';p.wave1.offset=2;p.wave1.phase=20;const b=B.create(guided('difference',p)),svg=R.board(b);assert.match(svg,/Offset -1 V · φ -160 °/);assert.match(svg,/Offset 1 V · φ 20 °/);});
test('every displayed cable has a unique identity, valid endpoints and the actual board contact',()=>{
 const b=B.create(guided('difference')),cables=R.connections(b),holes=new Set(b.groups.flat());assert.equal(new Set(cables.map(c=>c.key)).size,cables.length);
 for(const c of cables){assert.ok(c.a.label&&c.b.label,c.key);assert.ok(c.a.point&&c.b.point,c.key);for(const p of c.route)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y),c.key);if(c.a.hole)assert.ok(holes.has(c.a.hole));assert.ok(holes.has(c.b.hole));assert.ok(b.nets.some(n=>n.index===c.node));}
 for(const ch of b.channels){const tip=cables.find(c=>c.id===ch.id+'tip'),ground=cables.find(c=>c.id===ch.id+'ground');assert.equal(tip.b.hole,ch.hole);assert.equal(ground.b.hole,ch.ground);assert.ok(Math.hypot(ground.a.point.x-tip.probe.point.x,ground.a.point.y-tip.probe.point.y)<12,'Ground clip branches from the probe, not a second cable from the scope.');}
});
test('assembly scope reports connections and does not duplicate the numerical plot',()=>{
 const b=B.create(guided('difference')),plain=R.board(b),withData=R.board(b,{trace:{xUnit:'s',yUnit:'V',data:[{x:0,vin:0,out:1},{x:1,vin:1,out:0}]}});assert.equal(plain,withData);assert.doesNotMatch(plain,/data-bb-action="plot"|SIMULAZIONE CORRENTE/);assert.match(plain,/Collegamenti oscilloscopio/);
});
test('each active generator exposes its own editable values and inactive channels are not buttons',()=>{
 const b=B.create(guided('difference')),svg=R.board(b);for(const id of ['V1','V2'])for(const field of ['vpp','frequency'])assert.ok(svg.includes('data-bb-source-field="'+id+'|'+field+'"'));assert.doesNotMatch(R.board(B.create(guided('rc'))),/data-bb-source-field="V2/);
});
test('power supply ground occupies its own free hole and has an explicit cable',()=>{
 const b=B.create(guided()),contact=b.contacts.find(c=>c.id==='PSU:GND');assert.ok(contact);assert.ok(b.occupied.includes(contact.hole));assert.equal(contact.node,-1);const wire=R.connections(b).find(c=>c.id==='PSU:GND');assert.equal(wire.b.hole,contact.hole);assert.equal(wire.node,-1);assert.equal(B.verify(b).length,0);
});
test('inverter R1 inspection distinguishes the input and the summing junction, including the hidden strips',()=>{
 const b=B.create(guided()),[a,z]=B.terminals(b,'R1');
 assert.equal(a.hole,'M1:a4');assert.equal(z.hole,'M1:a9');
 assert.deepEqual(a.targets.map(t=>t.ref),['V1:p']);assert.deepEqual(new Set(z.targets.map(t=>t.ref)),new Set(['U1:minus','Rf:a']));
 const route=B.trace(b,'R1:b','U1:minus');assert.equal(route.from.hole,'M1:a9');assert.equal(route.to.hole,'M1:e13');
 assert.deepEqual(route.segments.map(s=>[s.kind,s.a,s.b]),[['strip','M1:a9','M1:b9'],['wire','M1:b9','M1:a13'],['strip','M1:a13','M1:e13']]);
 assert.equal(B.trace(b,'R1:a','R1:b'),null);assert.equal(B.trace(b,'U1:minus','U1:out'),null);
});
test('every inspectable destination has a continuous physical route made only of actual strips and jumpers',()=>{
 for(const type of ['rc','inverting','derivative','difference']){
  const b=B.create(guided(type)),before=JSON.stringify(b),known=new Set(b.groups.flat());
  for(const part of [...b.parts,...b.sources])for(const t of B.terminals(b,part.id))for(const target of t.targets){
   const route=B.trace(b,t.ref,target.ref);assert.ok(route,type+' '+t.ref+' → '+target.ref);let at=t.hole;
   for(const segment of route.segments){assert.equal(segment.a,at);assert.ok(known.has(segment.a)&&known.has(segment.b));if(segment.kind==='strip')assert.equal(B.group(segment.a),B.group(segment.b));else assert.ok(b.wires.some(w=>w.id===segment.id&&[w.a,w.b].includes(segment.a)&&[w.a,w.b].includes(segment.b)));at=segment.b;}
   assert.equal(at,target.hole);
  }
  assert.equal(JSON.stringify(b),before);
 }
});
test('inspection cannot invent a connection when its physical jumper is missing',()=>{
 const b=B.create(guided()),route=B.trace(b,'R1:b','U1:minus'),wire=route.segments.find(s=>s.kind==='wire');b.wires=b.wires.filter(w=>w.id!==wire.id);assert.equal(B.trace(b,'R1:b','U1:minus'),null);
});
test('auxiliary capacitors and all eight op-amp pins remain individually inspectable',()=>{
 const b=B.create(guided()),pins=B.terminals(b,'U1');assert.deepEqual(pins.map(p=>p.number),[1,2,3,4,5,6,7,8]);
 const positive=pins.find(p=>p.number===8);assert.ok(positive.targets.some(t=>t.ref==='PSU:U1+'));assert.ok(B.trace(b,positive.ref,'PSU:U1+'));
 for(const part of b.parts.filter(p=>p.auxiliary)){const terminals=B.terminals(b,part.id);assert.equal(terminals.length,2);assert.notEqual(terminals[0].node,terminals[1].node);assert.ok(terminals.every(t=>t.targets.length));}
 const geometry=R.geometry(b);for(const c of R.connections(b).filter(c=>c.kind==='wire'&&c.a.hole.split(':')[0]===c.b.hole.split(':')[0]))assert.ok(c.route.every(p=>p.y<geometry.positions.M1.y+465),'No unnecessary loop below the breadboard.');
});
test('every guide step retains every cable and both endpoints in the rendered assembly',()=>{
 for(const type of ['rc','inverting','derivative','difference']){
  const b=B.create(guided(type)),keys=R.connections(b).map(c=>c.key).sort(),before=JSON.stringify(b);
  for(let step=0;step<=3;step++){
   const svg=R.board(b,{step}),rendered=[...svg.matchAll(/data-bb-cable="([^"]+)"/g)].map(m=>m[1]).sort(),ends=[...svg.matchAll(/data-bb-cable-ref="([^"]+)"/g)].map(m=>m[1]);
   assert.deepEqual(rendered,keys,type+' step '+step);for(const key of keys)assert.equal(ends.filter(v=>v===key).length,2,key+' step '+step);
   assert.equal(JSON.stringify(b),before);
  }
 }
});
test('Rf retains its output jumper and the shared input junction even at the components step',()=>{
 const b=B.create(guided()),svg=R.board(b,{step:0}),output=B.trace(b,'Rf:b','U1:out'),junction=B.trace(b,'Rf:a','U1:minus'),input=B.trace(b,'Rf:a','R1:b');
 assert.deepEqual(junction.segments.map(s=>s.kind),['strip']);assert.deepEqual(output.segments.map(s=>s.kind),['strip','wire','strip']);
 for(const route of [output,input])for(const segment of route.segments.filter(s=>s.kind==='wire'))assert.ok(svg.includes('data-bb-cable="wire:'+segment.id+'"'));
 assert.equal(output.to.hole,'M1:e12');assert.equal(junction.to.hole,'M1:e13');
});

function visibleGroups(svg){
 const visible=[],stack=[false];for(const tag of svg.matchAll(/<g\b([^>]*)>|<\/g>/g)){
  if(tag[0]==='</g>'){assert.ok(stack.length>1,'balanced SVG groups');stack.pop();continue;}
  const attrs=Object.fromEntries([...tag[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])),hidden=stack.at(-1)||/display\s*:\s*none/.test(attrs.style||'');stack.push(hidden);if(!hidden)visible.push(attrs);
 }assert.equal(stack.length,1);return visible;
}
test('components guide shows only the circuit parts, at full opacity even when one is selected',()=>{
 for(const type of ['rc','shaper','shaper-buffer','detector-chain']){
  const b=B.create(guided(type)),part=b.parts.find(p=>!p.auxiliary),terminal=B.terminals(b,part.id)[0],before=JSON.stringify(b),svg=R.board(b,{step:0,part:part.id,net:terminal.net,pins:true}),groups=visibleGroups(svg);
  assert.deepEqual(groups.filter(a=>a['data-bb-part']).map(a=>a['data-bb-part']).sort(),b.parts.filter(p=>!p.auxiliary).map(p=>p.id).sort());
  assert.equal(groups.filter(a=>a['data-bb-cable']||a['data-bb-instrument']).length,0);assert.doesNotMatch(svg,/<g opacity="(?:\.18|\.13)"/);
  const frame=R.frame(b,0,'board'),g=R.geometry(b);assert.ok(frame.y>0);for(const c of b.parts.filter(c=>!c.auxiliary))for(const hole of Object.values(c.holes)){const at=g.point(hole);assert.ok(at.x>=frame.x&&at.x<=frame.x+frame.width);assert.ok(at.y>=frame.y&&at.y<=frame.y+frame.height);}
  assert.equal(JSON.stringify(b),before);
 }
});
test('guide phases reveal power, generator and probes progressively and reversibly',()=>{
 const b=B.create(guided('shaper')),before=JSON.stringify(b),cables=R.connections(b);
 for(const step of [0,1,2,3,0,3]){
  const groups=visibleGroups(R.board(b,{step})),actual=groups.filter(a=>a['data-bb-cable']).map(a=>a['data-bb-cable']).sort(),expected=cables.filter(c=>c.stage<=step).map(c=>c.key).sort();assert.deepEqual(actual,expected);
  assert.deepEqual(groups.filter(a=>a['data-bb-instrument']).map(a=>a['data-bb-instrument']),['power','generator','scope'].slice(0,step));
  assert.equal(groups.filter(a=>a['data-bb-part']).length,b.parts.filter(p=>!p.auxiliary||step>=1).length);assert.equal(JSON.stringify(b),before);
 }
});
test('following a terminal needs only the guide phase containing its actual connections',()=>{
 const b=B.create(guided('shaper'));
 const signal=B.trace(b,'Rsh2:a','Ubuf:out'),ground=B.trace(b,'Rsh1:b','Csh2:b'),power=B.trace(b,'Ubuf:8','PSU:Ubuf+');
 assert.ok(signal&&ground&&power);assert.equal(R.traceStage(b,signal),2);assert.equal(R.traceStage(b,ground),1);assert.equal(R.traceStage(b,power),1);
});


test('all guide phases keep the full bench framing until board close-up is selected explicitly',()=>{
 const b=B.create(guided('shaper')),before=JSON.stringify(b),g=R.geometry(b),view=svg=>svg.match(/viewBox="([^"]+)"/)[1];
 for(const step of [0,1,2,3]){
  const whole=R.board(b,{step}),detail=R.board(b,{step,framing:'board'});assert.equal(view(whole),`0 0 ${g.width} ${g.height}`);
  assert.equal(view(R.board(b,{step,framing:'bench'})),view(whole));assert.notEqual(view(detail),view(whole));
  assert.equal(R.frame(b,step,'board').width,R.frame(b,0,'board').width);
  assert.deepEqual(visibleGroups(whole).filter(a=>a['data-bb-part']).map(a=>a['data-bb-part']),visibleGroups(detail).filter(a=>a['data-bb-part']).map(a=>a['data-bb-part']));
 }
 assert.equal(JSON.stringify(b),before);
});

test('reference schematic includes feedback bends within its viewBox, including the last buffer',()=>{
 const X=require('../latex-export');for(const type of ['shaper-buffer','detector-chain']){const b=B.create(guided(type,{outputBuffer:true})),svg=R.schematic(b),[x,y,w,h]=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);for(const wire of b.doc.wires.filter(w=>w.route))for(const p of X.route(b.doc,wire)){assert.ok(p.x>=x+20&&p.x<=x+w-20);assert.ok(p.y>=y+20&&p.y<=y+h-20);}}
});
