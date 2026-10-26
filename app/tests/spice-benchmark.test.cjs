const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {netlist}=require('../scripts/benchmark-spice.cjs'),M=require('../free-model.js');
test('SPICE reference uses the physical component type even when its identifier has another prefix',()=>{
  const d=M.example('rc');Object.assign(d.components.find(c=>c.id==='C1'),{type:'L',value:1});const text=netlist(d).lines.join('\n');assert.match(text,/^L_C1 /m);assert.doesNotMatch(text,/^C_C1 /m);
});
test('recorded external benchmark passes and refers to this exact numerical engine',()=>{
  const root=path.join(__dirname,'..'),report=JSON.parse(fs.readFileSync(path.join(root,'benchmark/ngspice/results.json')));
  assert.equal(report.pass,true);assert.ok(report.cases.length>=9);assert.ok(report.cases.every(c=>c.pass&&c.sameModel));
  assert.equal(report.engineSha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'free-model.js'))).digest('hex'));
});
