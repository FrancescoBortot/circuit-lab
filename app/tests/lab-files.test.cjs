const{test}=require('node:test'),assert=require('node:assert/strict'),F=require('../lab-files.js'),M=require('../free-model.js'),I=require('../spice-import.js'),N=require('../spice-netlist.js');
test('stored ZIP reopens the exact circuit and detects corrupt payloads',()=>{const d=M.example('rlc'),a=F.archive(d,{date:'2026-10-24'}),text=F.projectFromArchive(a);assert.deepEqual(M.parse(text),d);assert.equal(F.crc32(new TextEncoder().encode('123456789')),0xcbf43926);const b=a.slice();b[70]^=1;assert.throws(()=>F.projectFromArchive(b),/Integrità/);assert.throws(()=>F.zip({'../project.json':'x'}),/Nome/);});
test('reports escape metadata and use their own SVG without external resources',()=>{const d=M.example('rc');d.name='<script>alert(1)</script>';const h=F.report(d,{date:'fixed'});assert.ok(h.includes('&lt;script&gt;'));assert.doesNotMatch(h,/<script|(?:src|href)="https?:\/\//);assert.match(h,/default-src &#39;none&#39;|default-src 'none'/);assert.match(h,/N1/);assert.throws(()=>F.report(d,{plot:'javascript:alert(1)'}),/non valido/);});
test('archive entries are independent revisions; quota failure does not modify storage',()=>{const storage={map:new Map(),getItem(k){return this.map.get(k)||null;},setItem(k,v){this.map.set(k,v);}},s=F.gallery(storage),d=M.example('rc'),id=s.add(M.serialize(d));s.rename(id,'Nuovo nome');assert.equal(s.read()[0].name,'Nuovo nome');assert.equal(JSON.parse(s.read()[0].text).name,'Nuovo nome');s.add(s.read()[0].text,'copia');assert.equal(s.read().length,2);});
test('SPICE import and export preserve RC topology, bias, AC phasor and finite pulse',()=>{const d=M.example('rc');Object.assign(d.components[0].wave,{kind:'pulse',low:-1,level:3,delay:.001,rise:.0001,width:.002,fall:.0002,period:.005,dc:2});Object.assign(d.settings,{analysis:'bode',acGrid:'linear',acPoints:21,acPhases:{V1:30}});const a=M.bode(d),r=I.parse(N.exportText(d).text),b=M.bode(r.doc);assert.equal(b.data.length,a.data.length);for(let k=0;k<a.data.length;k++)assert.ok(Math.abs(a.data[k].real-b.data[k].real)<1e-10);assert.equal(M.dcValue(r.doc.components[0]),2);assert.equal(r.doc.components[0].wave.rise,.0001);});
test('SPICE parser rejects unsupported control, files, devices, expressions and ambiguous scans by line',()=>{for(const body of ['.include /tmp/a','.control','B1 a 0 V=1','.model D D','R1 a 0 {R}','R1 a 0 1k\n.dc V1 0 1 .3'])assert.throws(()=>I.parse('Title\nV1 a 0 1\n'+body+'\n.end'),/Riga/);assert.equal(I.number('1M'),.001);assert.equal(I.number('1MEG'),1e6);assert.throws(()=>I.number('1kOhm'),/non supportato/);});

test('free pulse and sine CSV keep absolute voltages and append explicit baseline references',()=>{const L=require('../lab-model');for(const kind of ['pulse','sine']){const p=L.defaults('preamp');p.opamp='ideal';Object.assign(p.wave1,{kind,low:.02,level:-.78,offset:.02,vpp:.04});const doc=L.network(p),result=M.simulate(doc),csv=M.csv(doc,result),lines=csv.trim().split('\r\n');assert.match(lines[0],kind==='pulse'?/OUT_baseline_V,OUT_meno_baseline_V/:/OUT_baseline_DC_V,OUT_meno_baseline_DC_V/);const row=lines[2].split(',').map(Number);assert.ok(Math.abs(row[2]-result.data[1].out)<1e-10);assert.ok(Math.abs(row.at(-1)-(row[2]-row.at(-2)))<1e-10);}});

test('report and archive include notebook, comparison, assembly and semiconductor day 5-6 sections',()=>{
 const L=require('../lab-model'),NB=require('../notebook-model'),D=require('../comparison-data'),C=require('../study-context');
 const p=L.defaults('cmos-inverter'),doc=JSON.parse(L.serialize({name:'Sessione CMOS',experiment:'cmos-inverter',analysis:'time',circuits:{'cmos-inverter':p},layouts:{}}));
 doc.notebookStudy=NB.notes(NB.empty('notebook-cmos'),'guided:cmos-inverter',{prediction:'Uscita invertita <script>',note:'Misura puntali: 4,98 V'});
 const ds={...D.parse('t_ms,v_mV,u_mV\n0,5000,2\n1,100,2',{kind:'time',xUnit:'ms',yUnit:'mV',sigmaColumn:2}),name:'Misure banco CMOS',conditions:'Sonda 10x',modelStamp:C.stamp(doc)};
 doc.comparisonStudy={version:1,records:{'cmos-inverter:time':ds}};
 doc.assemblyStudy={version:1,records:{'guided:cmos-inverter':{signature:'mount-v1-1234abcd',active:false,index:1,checks:{continuity:true},note:'CD4007 verificato',items:{'part:M1':{stamp:'item-v1-1234abcd',status:'checked',note:'Pin 7 a GND'}}}}};
 const html=F.report(doc,{date:'2026-11-22'});
 assert.match(html,/Esperienza guidata · giornate 5–6/);
 assert.match(html,/Tabella di verità DC/);
 assert.match(html,/Quaderno dell’esperienza/);
 assert.match(html,/Misura puntali: 4,98 V/);
 assert.match(html,/Misure sperimentali · Misure banco CMOS/);
 assert.match(html,/<th>Ascissa \(ms\)<\/th><th>Misura \(mV\)<\/th><th>u standard \(mV\)<\/th>/);
 assert.match(html,/<tr><td>1<\/td><td>100<\/td><td>2<\/td><td>—<\/td><\/tr>/);
 assert.match(html,/Montaggio e controlli al banco/);
 assert.match(html,/CD4007 verificato/);
 assert.doesNotMatch(html,/<script>/);
 const archive=F.archive(doc,{date:'2026-11-22'}),entries=F.unzip(archive);
 assert.equal(new TextDecoder().decode(entries['relazione.html']),html);
 assert.ok(entries['confronto-time.csv']);
 assert.equal(new TextDecoder().decode(entries['confronto-time.csv']),ds.raw);
 assert.deepEqual(L.parse(F.projectFromArchive(archive)).comparisonStudy.records['cmos-inverter:time'],ds);
});

test('shareable URL hashes round-trip guided and free circuits and reject invalid payloads',()=>{
 const L=require('../lab-model');
 const p=L.defaults('rc');p.R=22000;p.C=47e-9;
 const guided=L.serialize(L.parse(L.serialize({name:'RC condiviso',experiment:'rc',analysis:'bode',circuits:{rc:p},layouts:{}})));
 const hashG=F.encodeShareHash(guided);
 assert.match(hashG,/^#clab=[A-Za-z0-9_-]+$/);
 const decodedG=L.parse(F.decodeShareHash('https://example.invalid/circuit-lab/'+hashG));
 assert.equal(decodedG.experiment,'rc');
 assert.equal(decodedG.analysis,'bode');
 assert.equal(decodedG.circuits.rc.R,22000);
 assert.equal(decodedG.circuits.rc.C,47e-9);
 const free=M.example('inverting');free.name='Invertente condiviso';
 const hashF=F.encodeShareHash(M.serialize(free));
 const decodedF=M.parse(F.decodeShareHash(hashF));
 assert.equal(decodedF.name,'Invertente condiviso');
 assert.equal(decodedF.components.length,free.components.length);
 assert.equal(F.decodeShareHash('#other=123'),null);
 assert.throws(()=>F.decodeShareHash('#clab=***'),/non valido/);
});
