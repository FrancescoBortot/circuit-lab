const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../free-model.js'),O=require('../circuit-operations.js'),Lab=require('../lab-model.js'),Context=require('../study-context.js');
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);
test('guided RC transfer includes both instrument channels and the generator impedance',()=>{
  for(const instrument of ['ideal','generator','direct','probe','custom']){
    const p=Lab.defaults('rc');Object.assign(p,{instrument,initial:-1});p.wave1.kind='discharge';const d=M.example('rc',p);
    assert.equal(M.validate(d).length,0);assert.equal(d.components.some(c=>c.id==='Rg'),instrument!=='ideal');
    assert.equal(d.components.filter(c=>/^CH[12]/.test(c.id)).length,['ideal','generator'].includes(instrument)?0:4);
    const result=M.simulate(d),reference=Lab.simulate(p),value=t=>{let i=0;while(i+1<reference.length&&reference[i+1].x<=t)i++;const a=reference[i],b=reference[Math.min(i+1,reference.length-1)];return a.out+(b.x===a.x?0:(t-a.x)/(b.x-a.x))*(b.out-a.out);};
    close(result.data[0].out,-1,1e-12);for(const row of result.data.filter((_,i)=>i%131===0))close(row.out,value(row.x),2e-5);
    d.settings.fmin=1000;d.settings.fmax=10000;const actual=M.bode(d).data[0],expected=Lab.response(p,1000);close(actual.real,expected.real);close(actual.imag,expected.imag);
  }
});
test('OUT/IN uses the measured complex voltage and declares its reference',()=>{
  const d=M.example('rc-loaded');d.settings.acReference='input';d.probes.input='R1:a';const r=M.bode(d),f=r.data[0].x,R=1e5,C=10e-9+15e-12,Ro=1e7,re=1+R/Ro,im=2*Math.PI*f*R*C,den=re*re+im*im;
  close(r.data[0].real,re/den);close(r.data[0].imag,-im/den);assert.equal(r.reference,'input');assert.equal(r.unit,'V/V');assert.equal(Context.build(M.serialize(d)).acReference,'input');
});
test('node labels survive moves, copies through JSON, and numbering changes without wiring nets',()=>{
  const d=O.renameNode(M.example('rc'),'C1:a','Uscita'),before=M.bode(d).data[0].magnitude;
  const moved=O.moveGroup(d,['V1','R1','C1'],100,-30);assert.equal(moved.nodeLabels['C1:a'],'Uscita');close(M.bode(moved).data[0].magnitude,before);
  moved.components.unshift(M.component('J','J1'));assert.equal(M.topology(moved).groups.find(n=>n.pins.includes('C1:a')).label,'Uscita');assert.equal(M.parse(M.serialize(moved)).nodeLabels['C1:a'],'Uscita');
  assert.throws(()=>O.renameNode(d,'V1:p','Uscita'),/altro nodo/);assert.throws(()=>O.renameNode(d,'G1:g','Terra'),/0 V/);assert.throws(()=>O.renameNode(d,'V1:p','N99'),/riservati/);
});
test('group copy includes internal wires and drops external links, without mutating the original',()=>{
  const d=O.renameNode(M.example('rc'),'C1:a','OUT'),original=M.serialize(d),copy=O.duplicateGroup(d,['R1','C1']);
  assert.equal(M.serialize(d),original);assert.equal(copy.doc.components.length,d.components.length+2);assert.equal(copy.doc.wires.length,d.wires.length+1);
  const added=copy.doc.wires.at(-1);assert.ok(copy.ids.includes(added.a.split(':')[0])&&copy.ids.includes(added.b.split(':')[0]));assert.equal(copy.doc.nodeLabels[copy.ids.find(id=>copy.doc.components.find(c=>c.id===id).type==='C')+':a'],'OUT_2');
});
test('deleting a labeled component preserves a probe and label on surviving terminals',()=>{
  const d=O.renameNode(M.example('rc'),'C1:a','OUT'),next=O.removeGroup(d,['C1']);assert.equal(next.probes.output,'R1:b');assert.equal(next.nodeLabels['R1:b'],'OUT');assert.equal(M.validate(next).length,0);
});
test('inserting a junction preserves the circuit, inserting a resistor changes the actual network',()=>{
  const d=M.example('rc'),before=M.bode(d).data[100].magnitude,j=O.insert(d,'W1','J');close(M.bode(j.doc).data[100].magnitude,before);
  assert.equal(j.doc.wires.length,d.wires.length+1);const inserted=O.insert(d,'W1','R');assert.ok(M.bode(inserted.doc).data[100].magnitude<before);assert.equal(M.validate(inserted.doc).length,0);
});
test('operation limits fail atomically instead of modifying a partially copied group',()=>{
  const d=M.example('rc');while(d.components.length<40)d.components.push(M.component('J','J'+d.components.length));const before=M.serialize(d);assert.throws(()=>O.duplicateGroup(d,['R1']),/40/);assert.equal(M.serialize(d),before);
});

test('canonical guided transfer preserves loaded RC studies and validates the full portable document',()=>{
  const fixture=require('../esempi/rc-tempo-e-frequenza.json'),p=Lab.defaults('rc');p.instrument='probe';
  const guided={name:'Esperienza',experiment:'rc',analysis:'bode',circuits:{rc:p},rcStudy:fixture.rcStudy,acStudy:{...fixture.acStudy,reference:'after-generator'}};
  const d=Lab.circuit(guided);assert.equal(d.settings.analysis,'bode');assert.equal(d.acStudy.reference,'input');assert.deepEqual(d.rcStudy,fixture.rcStudy);assert.equal(guided.acStudy.reference,'after-generator');
  d.rcStudy.dataset.name='changed';assert.notEqual(guided.rcStudy.dataset.name,'changed');
  assert.throws(()=>Lab.circuit({...guided,rcStudy:{...fixture.rcStudy,dataset:{...fixture.rcStudy.dataset,raw:'x'.repeat(1100000)}}}),/analisi RC|1 MB/);
});
test('transferring the difference amplifier keeps all four AC excitations and signed gains',()=>{
  for(const mode of ['v1','v2','common','differential']){const p=Lab.defaults('difference');p.bodeInput=mode;p.R4=47123;
    const d=Lab.circuit({experiment:'difference',analysis:'bode',circuits:{difference:p}}),r=M.bode(d);for(const point of r.data.filter((_,i)=>i%101===0)){const h=Lab.response(p,point.x);close(point.real,h.real,1e-9);close(point.imag,h.imag,1e-9);}
    assert.equal(d.settings.acReference,undefined);assert.ok(d.settings.acWeights);const next=O.removeGroup(d,['V2']);assert.equal(M.validate(next).length,0);
  }
});
test('raw node aliases on ground and invalid AC excitations are rejected',()=>{
  const d=M.example('rc');d.nodeLabels={'G1:g':'Terra'};assert.match(M.validate(d).join(' '),/0 V/);delete d.nodeLabels;
  for(const weights of [{V1:0},{Missing:1},{V1:Infinity},{V1:1001}]){d.settings.acWeights=weights;assert.ok(M.validate(d).length);}
});
