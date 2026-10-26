const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../free-model.js'),N=require('../spice-netlist.js');
test('ten independent ngspice analysis references pass for the exact engine and exporter',()=>{
 const root=path.join(__dirname,'..'),r=JSON.parse(fs.readFileSync(path.join(root,'benchmark/analyses/results.json')));
 assert.equal(r.pass,true);assert.equal(r.externalConnectionDuringSimulation,false);assert.equal(r.cases.length,10);
 for(const c of r.cases){assert.equal(c.pass,true);assert.ok(c.compared>0);assert.ok(c.maxAbsoluteError<c.tolerance);assert.ok(c.skipped.every(s=>s.reason.includes('fmax')));}
 for(const[file,key]of [['free-model.js','engineSha256'],['spice-netlist.js','exporterSha256']])assert.equal(r[key],crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'));
});
test('netlist export keeps the physical type, separate DC, current units and data-only metadata',()=>{
 const d=M.example('rc');d.name='Title\n.control\nquit';d.components[0].type='I';d.components[0].wave.dc=.002;Object.assign(d.settings,{analysis:'dc',dcSource:'V1'});
 const r=N.exportText(d);assert.match(r.text,/^I_V1 .* DC 2\.000/m);assert.match(r.text,/^.dc I_V1 -1\.000000000000000e-3 1\.000000000000000e-3/m);assert.doesNotMatch(r.text,/^\.control/m);
 d.settings.dcStart=1;d.settings.dcStop=1;assert.throws(()=>N.exportText(d),/estremi/);
});
