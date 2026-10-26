const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../free-model.js');
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function network(types,connections){const d=M.blank();d.components=types.map(([type,id,value])=>Object.assign(M.component(type,id),value||{}));d.wires=connections.map(([a,b],i)=>({id:'w'+i,a,b}));d.probes={input:'V1:p',output:'R1:b'};d.settings.acSource='V1';return d;}
const divider=()=>network([['V','V1'],['R','R1',{value:10000}],['R','R2',{value:10000}],['G','G1']],[['V1:p','R1:a'],['R1:b','R2:a'],['R2:b','G1:g'],['V1:n','G1:g']]);
const rc=()=>{const d=divider();d.components[2]=M.component('C','R2');d.components[2].value=100e-9;return d;};
function invert(model='ideal'){const d=network([['V','V1'],['R','R1'],['R','Rf',{value:47000}],['U','U1',{model}],['G','G1']],[['V1:p','R1:a'],['R1:b','U1:minus'],['R1:b','Rf:a'],['Rf:b','U1:out'],['U1:plus','G1:g'],['V1:n','G1:g']]);d.probes.output='U1:out';d.components[0].wave.kind='sine';d.components[0].wave.vpp=1;d.settings.duration=.002;return d;}
test('free circuits start with no components, wires or hidden connections',()=>{const d=M.blank();assert.equal(d.components.length,0);assert.equal(d.wires.length,0);assert.equal(M.validate(d).length,0);assert.ok(M.issues(d).length);});
test('a wired voltage divider satisfies nodal KCL and changes with topology',()=>{const d=divider();const result=M.simulate(d);for(const s of result.data){near(s.vin,5);near(s.out,2.5);}d.components[2].value=30000;near(M.simulate(d).data.at(-1).out,3.75);});
test('free RC charge and Bode agree with independent analytical equations',()=>{const d=rc();d.settings.duration=.006;const result=M.simulate(d);for(const s of result.data.filter((_,i)=>i%113===0))near(s.out,5*(1-Math.exp(-s.x/.001)),.0012);d.settings.fmin=1/(2*Math.PI*.001);d.settings.fmax=d.settings.fmin*10;const h=M.bode(d).data[0];near(h.magnitude,1/Math.sqrt(2));near(h.phase,-45);});
test('capacitor initial voltage and parallel capacitor constraints are preserved',()=>{const d=rc();d.components[0].wave.level=0;d.components[2].initial=3;d.components.push(Object.assign(M.component('C','C2'),{initial:3}));d.wires.push({id:'wa',a:'C2:a',b:'R2:a'},{id:'wb',a:'C2:b',b:'R2:b'});const result=M.simulate(d);near(result.data[0].out,3);near(result.data.at(-1).out,3*Math.exp(-.006/.002),.001);d.components.at(-1).initial=2;assert.throws(()=>M.simulate(d),/iniziale incompatibile/);});
test('moving or rotating a component leaves its electrical connectivity unchanged',()=>{const d=divider(),a=M.simulate(d).data.at(-1).out;d.components[1].x=800;d.components[1].y=50;d.components[1].rotation=90;near(M.simulate(d).data.at(-1).out,a);});
test('deleting a wire reports the disconnected terminal rather than simulating another circuit',()=>{const d=divider();d.wires.pop();assert.ok(M.issues(d).some(e=>e.includes('non collegato')));assert.throws(()=>M.simulate(d));});
test('shorting an ideal nonzero voltage source gives an explicit singular-circuit error',()=>{const d=divider();d.wires.push({id:'short',a:'V1:p',b:'G1:g'});assert.throws(()=>M.simulate(d),/non determinato/);});
test('missing ground and missing output probe have actionable diagnostics',()=>{const d=divider();d.probes.output=null;assert.ok(M.issues(d).some(e=>e.includes('sonda OUT')));d.components=d.components.filter(c=>c.type!=='G');d.wires=d.wires.filter(w=>!w.b.startsWith('G1'));assert.ok(M.issues(d).some(e=>e.includes('massa')));});
test('arbitrarily wired ideal opamp matches an inverting amplifier in time and AC',()=>{const d=invert();for(const s of M.simulate(d).data)near(s.out,-4.7*s.vin);const h=M.bode(d);near(h.data[0].magnitude,4.7);});
test('limited opamp gain and bandwidth follow its open-loop model',()=>{const d=invert('limited'),gain=-4.7*200000/(200000+5.7);d.settings.fmin=4e6/5.7;d.settings.fmax=d.settings.fmin*10;const h=M.bode(d).data[0];near(h.magnitude,Math.abs(gain)/Math.sqrt(1+(200000/(200000+5.7))**2));});
test('limited opamp clips and releases saturation in the actual feedback network',()=>{const d=invert('limited');d.components[0].wave.vpp=10;const result=M.simulate(d);assert.ok(result.data.some(s=>s.clipped));assert.ok(result.data.every(s=>Math.abs(s.out)<=13.50000001));const last=result.data.at(-1);assert.ok(Math.abs(last.out)<.2);});
test('an RL step has the correct inductor-current state and output decay',()=>{const d=divider();d.components[2]=Object.assign(M.component('L','R2'),{value:1});d.components[1].value=1000;d.settings.duration=.006;const a=M.simulate(d);for(const s of a.data.filter((_,i)=>i%137===0))near(s.out,5*Math.exp(-s.x/.001),.0012);});
test('a current source obeys its drawn terminal direction',()=>{const d=divider();d.components[0]=M.component('I','V1');d.components[0].wave.level=.001;d.settings.acSource='V1';const out=M.simulate(d).data.at(-1);near(out.vin,-20);near(out.out,-10);assert.equal(M.bode(d).unit,'Ω');});
test('source edges preserve capacitor continuity and change the subsequent trajectory',()=>{const d=rc();d.components[0].wave.delay=.002;const data=M.simulate(d).data,edge=data.filter(s=>s.x===.002);assert.equal(edge.length,2);near(edge[0].out,0);near(edge[1].out,0);near(edge[0].vin,0);near(edge[1].vin,5);near(data.at(-1).out,5*(1-Math.exp(-4)),.001);});
test('a free document round trip keeps wires, probes, source waveforms and layout',()=>{const d=invert();const a=M.parse(M.serialize(d));assert.deepEqual(a,d);d.wires[0].a='missing:a';assert.throws(()=>M.serialize(d));assert.throws(()=>M.parse('null'));});
test('editable course circuits have the same small-signal transfer as independent guided models',()=>{
 const guided=require('../lab-model.js');
 for(const type of ['rc','inverting','derivative','difference']){
  const p=guided.defaults(type),d=M.example(type,p);d.settings.fmin=1000;d.settings.fmax=10000;
  const actual=M.bode(d).data[0],expected=guided.response(p,1000,type==='difference'?'v1':'default');
  near(actual.real,expected.real,1e-7);near(actual.imag,expected.imag,1e-7);
 }
});
