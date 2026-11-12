const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../breadboard-layout'),B=require('../breadboard-model'),L=require('../lab-model');
const simple={rows:30,signature:'physical-ref-v1-123',netNames:{in:'IN',ground:'GND'},units:[{id:'R1',kind:'R',value:1000,label:'R1',pins:{a:{token:'part:R1',node:'in',label:'R1 · A'},b:{token:'part:R1',node:'ground',label:'R1 · B'}}}],ports:[{id:'AFG1:signal',node:'in',label:'Generatore · segnale',required:true},{id:'AFG1:ground',node:'ground',label:'Generatore · ritorno',required:true}]};
function handBoard(){const b=P.blank(simple);b.parts=[{id:'R1',kind:'R',value:1000,holes:{a:'M1:a1',b:'M1:a2'}}];b.leads=[{id:'L1',port:'AFG1:signal',hole:'M1:b1'},{id:'L2',port:'AFG1:ground',hole:'M1:b2'}];return b;}
// Independent pairwise reachability oracle. It does not call the production graph/group/check.
function oracle(board,ref){const nodes=P.holes(board.rows),edges=new Map(nodes.map(h=>[h,new Set()])),link=(a,b)=>{edges.get(a).add(b);edges.get(b).add(a);};
 for(let row=1;row<=board.rows;row++)for(const letters of ['abcde','fghij'])for(let i=1;i<5;i++)link('M1:'+letters[0]+row,'M1:'+letters[i]+row);
 for(const rail of ['L1','L2','R1','R2'])for(let i=2;i<=(board.rows===63?50:25);i++)if(!board.splitRails||i!==(board.rows===63?26:13))link('M1:'+rail+'.'+(i-1),'M1:'+rail+'.'+i);
 for(const w of board.wires)link(w.a,w.b);for(const p of ref.ports){const ls=board.leads.filter(l=>l.port===p.id);for(let i=1;i<ls.length;i++)link(ls[0].hole,ls[i].hole);}const grounds=board.leads.filter(l=>l.port.endsWith(':ground'));for(const l of grounds.slice(1))link(grounds[0].hole,l.hole);
 const reached=new Map();for(const h of nodes)if(!reached.has(h)){const queue=[h];reached.set(h,h);for(let i=0;i<queue.length;i++)for(const z of edges.get(queue[i]))if(!reached.has(z)){reached.set(z,h);queue.push(z);}}
 const passive=ref.units.filter(u=>u.kind!=='DIP8'),ports=ref.ports.filter(p=>board.leads.some(l=>l.port===p.id));if(ref.units.some(u=>!board.parts.some(p=>p.id===u.id))||ref.ports.some(p=>p.required&&!ports.includes(p)))return false;
 for(let mask=0;mask<2**passive.length;mask++){const terms=[];for(const u of ref.units){const part=board.parts.find(p=>p.id===u.id),swap=u.kind!=='DIP8'&&((mask>>passive.indexOf(u))&1);for(const [pin,t]of Object.entries(u.pins))terms.push({node:t.node,root:reached.get(part.holes[swap?(pin==='a'?'b':'a'):pin])});}for(const p of ports)terms.push({node:p.node,root:reached.get(board.leads.find(l=>l.port===p.id).hole)});let good=true;for(let i=0;i<terms.length&&good;i++)for(let j=i+1;j<terms.length;j++)if((terms[i].node===terms[j].node)!==(terms[i].root===terms[j].root)){good=false;break;}if(good)return true;}
 return false;
}
test('a hand-built resistor accepts terminal reversal and another value, but catches actual shorts and opens',()=>{
 const b=handBoard();assert.equal(P.check(b,simple).correct,true);assert.equal(P.check(P.rotate(b,'R1'),simple).correct,true);
 const short=P.edit(b,n=>n.wires.push({id:'W1',a:'M1:c1',b:'M1:c2',color:'#28734d'}));assert.equal(P.check(short,simple).correct,false);assert.ok(P.check(short,simple).errors.some(e=>e.code==='short'&&e.items.some(i=>i.id==='W1')));
 const missing=P.edit(b,n=>n.parts[0].holes.b='M1:a3');assert.ok(P.check(missing,simple).errors.some(e=>e.code==='open'));
 const different=P.edit(b,n=>n.parts[0].value=2000),result=P.check(different,simple);assert.equal(result.correct,true);assert.equal(result.equivalent,false);assert.ok(result.differences.some(e=>/Valori/.test(e.title)));assert.deepEqual(result.errors,[]);
});
test('continuous and interrupted rails have different electrical connectivity, and bridges restore it',()=>{
 const b=handBoard();b.leads[0].hole='M1:L1.25';b.leads[1].hole='M1:L2.25';b.wires=[{id:'W1',a:'M1:c1',b:'M1:L1.1',color:'#28734d'},{id:'W2',a:'M1:c2',b:'M1:L2.1',color:'#253b48'}];assert.equal(P.check(b,simple).correct,true);b.splitRails=true;assert.equal(P.check(b,simple).correct,false);b.wires.push({id:'W3',a:'M1:L1.12',b:'M1:L1.13',color:'#28734d'},{id:'W4',a:'M1:L2.12',b:'M1:L2.13',color:'#253b48'});assert.equal(P.check(b,simple).correct,true);
});
test('a correct but redundant jumper is a suggestion, and physical collisions are rejected atomically',()=>{
 const b=handBoard(),before=JSON.stringify(b),n=P.edit(b,n=>n.wires.push({id:'W1',a:'M1:c1',b:'M1:d1',color:'#28734d'}));assert.equal(P.check(n,simple).status,'improvable');assert.ok(P.check(n,simple).suggestions.some(e=>e.code==='redundant-wire'));assert.throws(()=>P.edit(b,n=>n.leads[0].hole='M1:a1'),/occupato/);assert.equal(JSON.stringify(b),before);
});
test('every catalogue mounting and shared TL082 package is accepted without editing the reference',()=>{
 for(const c of L.CATALOG.filter(c=>!L.semiconductor.is(c.type)))for(const sectionsPerChip of [1,2]){const model=B.create(L.network(L.defaults(c.type)),{sectionsPerChip}),before=JSON.stringify(model),ref=P.reference(model),board=P.proposed(ref);assert.equal(P.check(board,ref).correct,true,c.type+' '+sectionsPerChip);assert.equal(JSON.stringify(model),before);for(const p of board.parts.filter(p=>p.kind==='DIP8'))assert.equal(Object.keys(p.holes).length,8);}
});
test('a rotated IC has a real power fault; another valid supply voltage and absent probes are accepted',()=>{
 const ref=P.reference(B.create(L.network(L.defaults('inverting')))),board=P.proposed(ref),chip=board.parts.find(p=>p.kind==='DIP8');assert.ok(P.check(P.rotate(board,chip.id),ref).errors.some(e=>e.code==='missing-power'||e.code==='reversed-power'));const different=P.edit(board,n=>n.supply.positive=12);assert.equal(P.check(different,ref).correct,true);assert.ok(P.check(different,ref).differences.some(e=>/Tensioni/.test(e.title)));const withoutProbes=P.edit(board,n=>n.leads=n.leads.filter(l=>!l.port.startsWith('OSC')));assert.equal(P.check(withoutProbes,ref).correct,true);
});
test('partition checker agrees with an independent exhaustive orientation/reachability oracle',()=>{
 for(const type of ['rc','inverting']){const ref=P.reference(B.create(L.network(L.defaults(type)))),base=P.proposed(ref),variants=[base];for(const wire of base.wires)variants.push(P.edit(base,n=>n.wires=n.wires.filter(w=>w.id!==wire.id)));for(const part of base.parts.filter(p=>p.kind!=='DIP8'))variants.push(P.rotate(base,part.id));
 for(let i=0;i<20;i++){const b=P.clone(base),free=P.holes(b.rows).filter(h=>!P.occupied(b).has(h));b.wires.push({id:'WT',a:free[(i*7)%free.length],b:free[(i*11+1)%free.length],color:'#245cc5'});if(b.wires.at(-1).a!==b.wires.at(-1).b)variants.push(b);}for(const b of variants)assert.equal(P.check(b,ref).equivalent,oracle(b,ref),type+' '+JSON.stringify(b.wires));}
});
test('wire intersections do not create contacts',()=>{
 const ref={...simple,ports:[],units:[{id:'R1',kind:'R',value:1,pins:{a:{token:'part:R1',node:'x',label:'R1A'},b:{token:'part:R1',node:'y',label:'R1B'}}},{id:'R2',kind:'R',value:1,pins:{a:{token:'part:R2',node:'y',label:'R2A'},b:{token:'part:R2',node:'x',label:'R2B'}}}],netNames:{x:'X',y:'Y'}};
 const b=P.blank(ref);b.parts=[{id:'R1',kind:'R',value:1,holes:{a:'M1:b1',b:'M1:b2'}},{id:'R2',kind:'R',value:1,holes:{a:'M1:i1',b:'M1:i2'}}];b.wires=[{id:'W1',a:'M1:a1',b:'M1:j2',color:'#245cc5'},{id:'W2',a:'M1:a2',b:'M1:j1',color:'#28734d'}];assert.equal(P.check(b,ref).equivalent,true);assert.equal(oracle(b,ref),true);
});
test('physical data is portable, malformed boards are rejected, and ordinary guide saves preserve it',()=>{
 const A=require('../assembly-guide'),M=require('../free-model'),p=L.defaults('rc'),doc={experiment:'rc',analysis:'time',layouts:{},circuits:{rc:p}},ref=P.reference(B.create(L.network(p))),board=P.proposed(ref);const state={active:false,index:0,checks:{},note:'Lista di banco',items:{}};doc.assemblyStudy=A.update(null,'guided:rc','mount-v1-123',state);doc.assemblyStudy.records['guided:rc'].board=board;
 const reopened=L.parse(L.serialize(doc));assert.deepEqual(reopened.assemblyStudy.records['guided:rc'].board,board);const update=A.update(reopened.assemblyStudy,'guided:rc','mount-v1-123',{...state,note:'Nuova nota'});assert.deepEqual(update.records['guided:rc'].board,board);assert.deepEqual(M.parse(M.serialize(L.circuit(reopened))).assemblyStudy.records['guided:rc'].board,board);
 const broken=P.clone(reopened);broken.assemblyStudy.records['guided:rc'].board.leads[0].hole=board.parts[0].holes.a;assert.throws(()=>L.parse(L.serialize(broken)),/occupato/);assert.deepEqual(reopened.assemblyStudy.records['guided:rc'].board,board);
});
test('an isolated spare and a harmless dangling branch are advice, never a reference mismatch error',()=>{
 const b=P.edit(handBoard(),b=>b.parts.push({id:'ExtraR1',kind:'R',value:1000,holes:{a:'M1:a20',b:'M1:a25'}}));assert.equal(P.check(b,simple).correct,true);assert.ok(P.check(b,simple).suggestions.some(s=>s.code==='unused-part'));const connected=P.edit(b,b=>b.wires.push({id:'W1',a:'M1:c1',b:'M1:b20',color:'#28734d'}));assert.equal(P.check(connected,simple).correct,true);assert.ok(P.check(connected,simple).suggestions.some(e=>e.code==='dangling-part'));
});
test('dangling wires and missing optional probe grounds are advice rather than circuit errors',()=>{
 const b=P.edit(handBoard(),b=>b.wires.push({id:'W1',a:'M1:c1',b:'M1:a20',color:'#28734d'}));assert.equal(P.check(b,simple).correct,true);assert.ok(P.check(b,simple).suggestions.some(s=>s.code==='unused-wire'));
 const ref=P.reference(B.create(L.network(L.defaults('rc')))),probe=P.proposed(ref);probe.leads=probe.leads.filter(l=>l.port!=='OSC1:ground');assert.equal(P.check(probe,ref).correct,true);assert.ok(P.check(probe,ref).suggestions.some(s=>s.code==='probe-ground'));
});

test('series and parallel alternatives with different identities are accepted on their actual wiring',()=>{
 // Independently: 500 Ω + 500 Ω = 1 kΩ; two 2 kΩ in parallel = 1 kΩ.
 const series=P.edit(handBoard(),b=>{b.parts=[{id:'ExtraR1',kind:'R',value:500,holes:{a:'M1:a1',b:'M1:a3'}},{id:'ExtraR2',kind:'R',value:500,holes:{a:'M1:b3',b:'M1:a2'}}];});
 const parallel=P.edit(handBoard(),b=>{b.parts=[{id:'ExtraR1',kind:'R',value:2000,holes:{a:'M1:a1',b:'M1:a2'}},{id:'ExtraR2',kind:'R',value:2000,holes:{a:'M1:c1',b:'M1:c2'}}];});
 for(const b of [series,parallel]){const result=P.check(b,simple);assert.equal(result.correct,true);assert.equal(result.equivalent,false);assert.deepEqual(result.errors,[]);assert.ok(result.differences.length);}
 const broken=P.edit(series,b=>b.parts[1].holes.b='M1:a4');assert.ok(P.check(broken,simple).errors.some(e=>e.code==='open'));
});
test('actual fault decisions are independent of reference labels, values, identities and auxiliary parts',()=>{
 const b=handBoard(),other={...simple,units:[{...simple.units[0],id:'DifferentR',value:47000}],ports:simple.ports.map(p=>({...p,node:p.node+'different'}))};
 for(const ref of [simple,other]){assert.equal(P.check(b,ref).correct,true);const short=P.edit(b,n=>n.wires.push({id:'W1',a:'M1:c1',b:'M1:c2',color:'#28734d'}));assert.equal(P.check(short,ref).correct,false);assert.ok(P.check(short,ref).errors.some(e=>e.code==='short'));}
});
test('shared instrument returns expose an actual short introduced by a scope ground',()=>{
 const b=P.edit(handBoard(),b=>b.leads.push({id:'L3',port:'OSC1:ground',hole:'M1:d1'})),r=P.check(b,simple);assert.equal(r.correct,false);assert.ok(r.errors.some(e=>e.code==='short'&&e.items.some(i=>i.id==='L3')));
});
test('multiple generator outputs shorted together are errors; equal DC power rails are not a source conflict',()=>{
 const b=P.edit(handBoard(),b=>b.leads.push({id:'L3',port:'AFG2:signal',hole:'M1:d1'},{id:'L4',port:'AFG2:ground',hole:'M1:d2'}));assert.ok(P.check(b,simple).errors.some(e=>e.code==='short'));
 const dc=P.edit(handBoard(),b=>{b.leads=[{id:'L1',port:'PSU:positive',hole:'M1:b1'},{id:'L2',port:'PSU:negative',hole:'M1:c1'},{id:'L3',port:'PSU:ground',hole:'M1:b2'}];b.supply={positive:5,negative:5};});assert.equal(P.check(dc,simple).correct,true);
 dc.supply.negative=-5;assert.ok(P.check(dc,simple).errors.some(e=>e.code==='short'));
});
test('unpowered or reversed TL082 and a missing generator return remain actual faults',()=>{
 const ref=P.reference(B.create(L.network(L.defaults('inverting')))),b=P.proposed(ref);
 const reversed=P.edit(b,b=>{b.supply.positive=-15;b.supply.negative=15;});assert.ok(P.check(reversed,ref).errors.some(e=>e.code==='reversed-power'));
 const chip=b.parts.find(p=>p.kind==='DIP8'),unpowered=P.edit(b,b=>b.wires=b.wires.filter(w=>P.graph(b,w.id).find(chip.holes[8])===P.graph(b,w.id).find(b.leads.find(l=>l.port==='PSU:positive').hole)));assert.ok(P.check(unpowered,ref).errors.some(e=>e.code==='missing-power'));
 const noReturn=P.edit(handBoard(),b=>b.leads=b.leads.filter(l=>l.port!=='AFG1:ground'));assert.ok(P.check(noReturn,simple).errors.some(e=>e.code==='missing-return'));
});
test('a bypassed passive is identified without assuming that a different network is a source short',()=>{
 const b=P.edit(handBoard(),b=>{b.parts.push({id:'ExtraR1',kind:'R',value:500,holes:{a:'M1:a4',b:'M1:b4'}});b.wires.push({id:'W1',a:'M1:c1',b:'M1:c4',color:'#28734d'});});const result=P.check(b,simple);assert.equal(result.correct,true);assert.ok(result.suggestions.some(s=>s.code==='bypassed-part'));assert.ok(!result.errors.some(s=>s.code==='short'));
});

test('DC supply continuity and known zero-volt generator are evaluated from actual potentials',()=>{
 const dc=P.edit(handBoard(),b=>{b.leads=[{id:'L1',port:'PSU:positive',hole:'M1:b1'},{id:'L2',port:'PSU:ground',hole:'M1:b2'}];b.supply.positive=5;});assert.equal(P.check(dc,simple).correct,true);dc.parts[0].holes.b='M1:a4';assert.ok(P.check(dc,simple).errors.some(e=>e.code==='open'));
 const zeroRef={...simple,sourceVoltages:{'AFG1:signal':0}},zero=P.edit(handBoard(),b=>b.wires.push({id:'W1',a:'M1:c1',b:'M1:c2',color:'#28734d'}));assert.ok(!P.check(zero,zeroRef).errors.some(e=>e.code==='short'));assert.ok(P.check(zero,simple).errors.some(e=>e.code==='short'));
});

test('a shared return through another grounded instrument is valid without the exact reference ground cable',()=>{
 for(const port of ['OSC1:ground','PSU:ground','AFG2:ground']){const b=P.edit(handBoard(),b=>b.leads[1].port=port),r=P.check(b,simple);assert.equal(r.correct,true,port);assert.ok(r.differences.length);assert.equal(r.errors.length,0);}
});
test('a zero-amplitude waveform is a known DC potential for source conflict checks',()=>{
 const doc=L.network(L.defaults('rc')),s=doc.components.find(c=>c.type==='V');s.wave={...s.wave,kind:'sine',vpp:0,offset:0};const ref=P.reference(B.create(doc));assert.equal(ref.sourceVoltages['AFG1:signal'],0);
 const b=P.proposed(ref),free=P.holes(b.rows).filter(h=>!P.occupied(b).has(h)),g=P.graph(b),hot=b.leads.find(l=>l.port==='AFG1:signal').hole,cold=b.leads.find(l=>l.port==='AFG1:ground').hole;b.wires.push({id:'WTEST',a:free.find(h=>g.find(h)===g.find(hot)),b:free.find(h=>g.find(h)===g.find(cold)),color:'#28734d'});assert.ok(!P.check(b,ref).errors.some(e=>e.code==='short'));
});
