const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../breadboard-layout'),B=require('../breadboard-model'),L=require('../lab-model');
const simple={rows:30,signature:'physical-ref-v1-123',netNames:{in:'IN',ground:'GND'},units:[{id:'R1',kind:'R',value:1000,label:'R1',pins:{a:{token:'part:R1',node:'in',label:'R1 · A'},b:{token:'part:R1',node:'ground',label:'R1 · B'}}}],ports:[{id:'AFG1:signal',node:'in',label:'Generatore · segnale',required:true},{id:'AFG1:ground',node:'ground',label:'Generatore · ritorno',required:true}]};
function handBoard(){const b=P.blank(simple);b.parts=[{id:'R1',kind:'R',value:1000,holes:{a:'M1:a1',b:'M1:a2'}}];b.leads=[{id:'L1',port:'AFG1:signal',hole:'M1:b1'},{id:'L2',port:'AFG1:ground',hole:'M1:b2'}];return b;}
// Independent pairwise reachability oracle. It does not call the production graph/group/check.
function oracle(board,ref){const nodes=P.holes(board.rows),edges=new Map(nodes.map(h=>[h,new Set()])),link=(a,b)=>{edges.get(a).add(b);edges.get(b).add(a);};
 for(let row=1;row<=board.rows;row++)for(const letters of ['abcde','fghij'])for(let i=1;i<5;i++)link('M1:'+letters[0]+row,'M1:'+letters[i]+row);
 for(const rail of ['L1','L2','R1','R2'])for(let i=2;i<=(board.rows===63?50:25);i++)if(!board.splitRails||i!==(board.rows===63?26:13))link('M1:'+rail+'.'+(i-1),'M1:'+rail+'.'+i);
 for(const w of board.wires)link(w.a,w.b);for(const p of ref.ports){const ls=board.leads.filter(l=>l.port===p.id);for(let i=1;i<ls.length;i++)link(ls[0].hole,ls[i].hole);}
 const reached=new Map();for(const h of nodes)if(!reached.has(h)){const queue=[h];reached.set(h,h);for(let i=0;i<queue.length;i++)for(const z of edges.get(queue[i]))if(!reached.has(z)){reached.set(z,h);queue.push(z);}}
 const passive=ref.units.filter(u=>u.kind!=='DIP8'),ports=ref.ports.filter(p=>board.leads.some(l=>l.port===p.id));if(ref.units.some(u=>!board.parts.some(p=>p.id===u.id))||ref.ports.some(p=>p.required&&!ports.includes(p)))return false;
 for(let mask=0;mask<2**passive.length;mask++){const terms=[];for(const u of ref.units){const part=board.parts.find(p=>p.id===u.id),swap=u.kind!=='DIP8'&&((mask>>passive.indexOf(u))&1);for(const [pin,t]of Object.entries(u.pins))terms.push({node:t.node,root:reached.get(part.holes[swap?(pin==='a'?'b':'a'):pin])});}for(const p of ports)terms.push({node:p.node,root:reached.get(board.leads.find(l=>l.port===p.id).hole)});let good=true;for(let i=0;i<terms.length&&good;i++)for(let j=i+1;j<terms.length;j++)if((terms[i].node===terms[j].node)!==(terms[i].root===terms[j].root)){good=false;break;}if(good)return true;}
 return false;
}
test('a hand-built resistor, terminal reversal, a short, an open and a wrong nominal value',()=>{
 const b=handBoard();assert.equal(P.check(b,simple).correct,true);assert.equal(P.check(P.rotate(b,'R1'),simple).correct,true);
 const short=P.edit(b,n=>n.wires.push({id:'W1',a:'M1:c1',b:'M1:c2',color:'#28734d'}));assert.equal(P.check(short,simple).correct,false);assert.ok(P.check(short,simple).errors.some(e=>e.code==='short'&&e.items.some(i=>i.id==='W1')));
 const missing=P.edit(b,n=>n.parts[0].holes.b='M1:a3');assert.ok(P.check(missing,simple).errors.some(e=>e.code==='open'));
 const wrong=P.edit(b,n=>n.parts[0].value=2000);assert.ok(P.check(wrong,simple).errors.some(e=>e.code==='wrong-value'));
});
test('continuous and interrupted rails have different electrical connectivity, and bridges restore it',()=>{
 const b=handBoard();b.leads[0].hole='M1:L1.25';b.leads[1].hole='M1:L2.25';b.wires=[{id:'W1',a:'M1:c1',b:'M1:L1.1',color:'#28734d'},{id:'W2',a:'M1:c2',b:'M1:L2.1',color:'#253b48'}];assert.equal(P.check(b,simple).correct,true);b.splitRails=true;assert.equal(P.check(b,simple).correct,false);b.wires.push({id:'W3',a:'M1:L1.12',b:'M1:L1.13',color:'#28734d'},{id:'W4',a:'M1:L2.12',b:'M1:L2.13',color:'#253b48'});assert.equal(P.check(b,simple).correct,true);
});
test('a correct but redundant jumper is a suggestion, and physical collisions are rejected atomically',()=>{
 const b=handBoard(),before=JSON.stringify(b),n=P.edit(b,n=>n.wires.push({id:'W1',a:'M1:c1',b:'M1:d1',color:'#28734d'}));assert.equal(P.check(n,simple).status,'improvable');assert.ok(P.check(n,simple).suggestions.some(e=>e.code==='redundant-wire'));assert.throws(()=>P.edit(b,n=>n.leads[0].hole='M1:a1'),/occupato/);assert.equal(JSON.stringify(b),before);
});
test('every catalogue mounting and shared TL082 package is accepted without editing the reference',()=>{
 for(const c of L.CATALOG)for(const sectionsPerChip of [1,2]){const model=B.create(L.network(L.defaults(c.type)),{sectionsPerChip}),before=JSON.stringify(model),ref=P.reference(model),board=P.proposed(ref);assert.equal(P.check(board,ref).correct,true,c.type+' '+sectionsPerChip);assert.equal(JSON.stringify(model),before);for(const p of board.parts.filter(p=>p.kind==='DIP8'))assert.equal(Object.keys(p.holes).length,8);}
});
test('wrong supply voltage and a rotated IC are errors; absent probes remain optional',()=>{
 const ref=P.reference(B.create(L.network(L.defaults('inverting')))),board=P.proposed(ref),chip=board.parts.find(p=>p.kind==='DIP8');assert.equal(P.check(P.rotate(board,chip.id),ref).correct,false);const bad=P.edit(board,n=>n.supply.positive=12);assert.ok(P.check(bad,ref).errors.some(e=>e.code==='wrong-supply'));const withoutProbes=P.edit(board,n=>n.leads=n.leads.filter(l=>!l.port.startsWith('OSC')));assert.equal(P.check(withoutProbes,ref).correct,true);
});
test('partition checker agrees with an independent exhaustive orientation/reachability oracle',()=>{
 for(const type of ['rc','inverting']){const ref=P.reference(B.create(L.network(L.defaults(type)))),base=P.proposed(ref),variants=[base];for(const wire of base.wires)variants.push(P.edit(base,n=>n.wires=n.wires.filter(w=>w.id!==wire.id)));for(const part of base.parts.filter(p=>p.kind!=='DIP8'))variants.push(P.rotate(base,part.id));
 for(let i=0;i<20;i++){const b=P.clone(base),free=P.holes(b.rows).filter(h=>!P.occupied(b).has(h));b.wires.push({id:'WT',a:free[(i*7)%free.length],b:free[(i*11+1)%free.length],color:'#245cc5'});if(b.wires.at(-1).a!==b.wires.at(-1).b)variants.push(b);}for(const b of variants)assert.equal(P.check(b,ref).correct,oracle(b,ref),type+' '+JSON.stringify(b.wires));}
});
test('wire intersections do not create contacts',()=>{
 const ref={...simple,ports:[],units:[{id:'R1',kind:'R',value:1,pins:{a:{token:'part:R1',node:'x',label:'R1A'},b:{token:'part:R1',node:'y',label:'R1B'}}},{id:'R2',kind:'R',value:1,pins:{a:{token:'part:R2',node:'y',label:'R2A'},b:{token:'part:R2',node:'x',label:'R2B'}}}],netNames:{x:'X',y:'Y'}};
 const b=P.blank(ref);b.parts=[{id:'R1',kind:'R',value:1,holes:{a:'M1:b1',b:'M1:b2'}},{id:'R2',kind:'R',value:1,holes:{a:'M1:i1',b:'M1:i2'}}];b.wires=[{id:'W1',a:'M1:a1',b:'M1:j2',color:'#245cc5'},{id:'W2',a:'M1:a2',b:'M1:j1',color:'#28734d'}];assert.equal(P.check(b,ref).correct,true);assert.equal(oracle(b,ref),true);
});
test('physical data is portable, malformed boards are rejected, and ordinary guide saves preserve it',()=>{
 const A=require('../assembly-guide'),M=require('../free-model'),p=L.defaults('rc'),doc={experiment:'rc',analysis:'time',layouts:{},circuits:{rc:p}},ref=P.reference(B.create(L.network(p))),board=P.proposed(ref);const state={active:false,index:0,checks:{},note:'Lista di banco',items:{}};doc.assemblyStudy=A.update(null,'guided:rc','mount-v1-123',state);doc.assemblyStudy.records['guided:rc'].board=board;
 const reopened=L.parse(L.serialize(doc));assert.deepEqual(reopened.assemblyStudy.records['guided:rc'].board,board);const update=A.update(reopened.assemblyStudy,'guided:rc','mount-v1-123',{...state,note:'Nuova nota'});assert.deepEqual(update.records['guided:rc'].board,board);assert.deepEqual(M.parse(M.serialize(L.circuit(reopened))).assemblyStudy.records['guided:rc'].board,board);
 const broken=P.clone(reopened);broken.assemblyStudy.records['guided:rc'].board.leads[0].hole=board.parts[0].holes.a;assert.throws(()=>L.parse(L.serialize(broken)),/occupato/);assert.deepEqual(reopened.assemblyStudy.records['guided:rc'].board,board);
});
test('an isolated spare is a cleanup suggestion; an extra component connected to the reference is an error',()=>{
 const b=P.edit(handBoard(),b=>b.parts.push({id:'ExtraR1',kind:'R',value:1000,holes:{a:'M1:a20',b:'M1:a25'}}));assert.equal(P.check(b,simple).correct,true);assert.ok(P.check(b,simple).suggestions.some(s=>s.code==='unused-part'));const connected=P.edit(b,b=>b.wires.push({id:'W1',a:'M1:c1',b:'M1:b20',color:'#28734d'}));assert.ok(P.check(connected,simple).errors.some(e=>e.code==='extra-part'));
});
test('dangling wires and missing optional probe grounds are advice rather than circuit errors',()=>{
 const b=P.edit(handBoard(),b=>b.wires.push({id:'W1',a:'M1:c1',b:'M1:a20',color:'#28734d'}));assert.equal(P.check(b,simple).correct,true);assert.ok(P.check(b,simple).suggestions.some(s=>s.code==='unused-wire'));
 const ref=P.reference(B.create(L.network(L.defaults('rc')))),probe=P.proposed(ref);probe.leads=probe.leads.filter(l=>l.port!=='OSC1:ground');assert.equal(P.check(probe,ref).correct,true);assert.ok(P.check(probe,ref).suggestions.some(s=>s.code==='probe-ground'));
});
