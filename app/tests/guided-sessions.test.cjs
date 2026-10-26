const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../lab-model.js'),T=require('../guided-trials.js'),S=require('../session-files.js'),F=require('../lab-files.js');
const clone=x=>JSON.parse(JSON.stringify(x)),decode=b=>new TextDecoder().decode(b);
function fixture(preset='charge'){
 const p=L.defaults('rc');p.wave1.kind=preset==='discharge'?'discharge':'charge';p.initial=preset==='discharge'?5:0;
 const d={name:'Fisica · gruppo 7',experiment:'rc',analysis:'time',circuits:{rc:L.normalizeTime(p)},layouts:{},session:{id:'session-test-20261026',createdAt:'2026-10-26T09:00:00.000Z'}};
 if(preset)T.select(d,preset,L.CATALOG);return L.parse(L.serialize(d));
}
function result(d){const points=L.simulate(d.circuits.rc);return{analysis:'time',quantity:'voltage',csv:L.csv(d.circuits.rc,'time',points),svg:'<svg xmlns="http://www.w3.org/2000/svg"><text>Carica RC</text></svg>',count:points.length,points:points.map(p=>({x:p.x,y:p.out}))};}
test('guided trial identity survives reopen, layout and session renaming without changing physics',()=>{
 const d=fixture(),before=L.simulate(d.circuits.rc);assert.equal(T.current(d,L.CATALOG).label,'Solo carica');assert.equal(T.current(d,L.CATALOG).modified,false);
 d.name='Sessione rinominata';d.layouts.rc={R:{x:300,y:100}};
 const reopened=L.parse(L.serialize(d));assert.equal(T.current(reopened,L.CATALOG).modified,false);assert.deepEqual(L.simulate(reopened.circuits.rc),before);
 reopened.circuits.rc.R*=2;assert.equal(T.current(reopened,L.CATALOG).modified,true);
 T.select(reopened,'',L.CATALOG);assert.equal(T.current(reopened,L.CATALOG).label,'');assert.equal(T.current(reopened,L.CATALOG).modified,false);
});
test('project parser rejects invalid session and trial metadata while legacy projects remain valid',()=>{
 for(const change of [d=>d.session.id='../folder',d=>d.session.createdAt='invalid',d=>d.guidedTrials.rc.preset='invented',d=>d.guidedTrials.rc.baseline='<script>',d=>d.guidedTrials.unknown={preset:'charge',baseline:'123'}]){const d=fixture();change(d);assert.throws(()=>L.parse(L.serialize(d)));}
 const d=fixture();delete d.session;delete d.guidedTrials;assert.equal(L.parse(L.serialize(d)).session,undefined);
});
test('session snapshots retain multiple analyses and clear cached outputs after electrical edits',()=>{
 const d=fixture(),a=S.capture(null,L.serialize(d),result(d));assert.ok(a.analyses.time.points.length>400);
 d.analysis='bode';const b=S.capture(a,L.serialize(d),{analysis:'bode',quantity:'db',count:4,csv:'frequency,db\n1,0',svg:'<svg/>'});assert.ok(b.analyses.time);assert.ok(b.analyses.bode);
 const phase=S.capture(b,L.serialize(d),{analysis:'bode',quantity:'phase',count:4,csv:'frequency,phase\n1,0',svg:'<svg><text>phase</text></svg>'});assert.deepEqual(Object.keys(phase.analyses.bode.plots),['db','phase']);assert.equal(phase.analyses.bode.lastQuantity,'phase');
 d.name='Nuovo nome';assert.ok(S.capture(phase,L.serialize(d)).analyses.time);
 d.circuits.rc.R*=2;assert.deepEqual(S.capture(phase,L.serialize(d)).analyses,{});
 assert.throws(()=>S.capture(a,L.serialize(d),{...result(d),analysis:'vtc'}),/Risultati/);
});
test('one latest record per trial has a different identity from other trials and sessions',()=>{
 const a=fixture(),b=fixture('discharge');assert.notEqual(S.key(a),S.key(b));const k=S.key(a);a.circuits.rc.R*=2;assert.equal(S.key(a),k);
 a.session.id='other-session-123';assert.notEqual(S.key(a),k);
});
test('multi-trial ZIP organizes safe files by session and circuit and reopens each project',()=>{
 const a=fixture(),b=fixture('discharge'),records=[a,b].map(d=>S.capture(null,L.serialize(d),result(d)));
 const name='Fisica 7: à/../<script> & gruppo';const bundle=S.bundle(records,name,a.session),zip=F.zipSession(bundle.files),entries=F.unzipSession(zip);
 assert.equal(bundle.manifest.trials.length,2);for(const path of Object.keys(entries)){assert.ok(F.archivePath(path,true),path);assert.equal(path.split('/')[0],bundle.root);}
 for(const [i,entry]of bundle.manifest.trials.entries()){
  assert.match(entry.project,/Circuito-RC-Solo-(carica-charge|scarica-discharge)\.json$/);
  const reopened=L.parse(decode(entries[entry.project]));assert.equal(reopened.name,name);assert.equal(T.current(reopened,L.CATALOG).preset,i?'discharge':'charge');assert.equal(reopened.circuits.rc.initial,i?5:0);
  const base=entry.project.slice(0,-5);assert.ok(entries[base+'-time.csv']);assert.match(decode(entries[base+'-time-voltage.svg']),/Carica RC/);assert.ok(entries[base+'-schema.svg']);assert.ok(entries[base+'-relazione.html']);
 }
 assert.equal(JSON.parse(decode(entries[bundle.root+'/sessione.json'])).name,name);
 const damaged=zip.slice(),header=new DataView(damaged.buffer);damaged[30+header.getUint16(26,true)]^=1;assert.throws(()=>F.unzipSession(damaged));assert.throws(()=>F.unzip(zip));
});
test('folder names tolerate long names and reject unsafe ZIP paths before file creation',()=>{
 const d=fixture();d.name='à-'.repeat(40);T.select(d,'probe',L.CATALOG);const record=S.capture(null,L.serialize(d));const bundle=S.bundle([record],d.name,d.session);assert.ok(F.zipSession(bundle.files).length>100);
 for(const path of ['../x','a/../x','/absolute','a//x','a\\x','a/constructor/x','a/b/c/d/e']){assert.equal(F.archivePath(path,true),false,path);assert.throws(()=>F.zipSession({[path]:'bad'}));}
 assert.throws(()=>F.zip({'nested/path':'not allowed'}));
});
test('all guided experiences and presets have distinct reopenable paths across circuit subfolders',()=>{
 const records=[];for(const experience of L.CATALOG){const d=L.selectExperience(fixture(),experience.id);for(const[preset]of T.PRESETS[experience.type]){T.select(d,preset,L.CATALOG);records.push(S.capture(null,L.serialize(d)));}}
 const d=fixture(),bundle=S.bundle(records,d.name,d.session),entries=F.unzipSession(F.zipSession(bundle.files)),folders=new Set();
 assert.equal(bundle.manifest.trials.length,records.length);for(const trial of bundle.manifest.trials){const reopened=L.parse(decode(entries[trial.project]));assert.equal(reopened.experiment,trial.experiment);assert.equal(T.current(reopened,L.CATALOG).preset,trial.preset);folders.add(trial.project.split('/')[1]);}assert.equal(folders.size,L.CATALOG.length);
});
function directoryFixture(failWrite=false){
 const files=new Map(),directories=new Set(),calls=[],aborted=[];
 function handle(path=''){return{async getDirectoryHandle(name,options){assert.equal(options.create,true);const next=path?path+'/'+name:name;calls.push(next);directories.add(next);return handle(next);},async getFileHandle(name,options){assert.equal(options.create,true);const next=path?path+'/'+name:name;calls.push(next);return{async createWritable(){let content;return{async write(value){if(failWrite)throw Error('Disk full');content=value;},async close(){files.set(next,content);},async abort(){aborted.push(next);}};}};}};}
 return{parent:handle(),files,directories,calls,aborted};
}
test('native folder writer creates exactly the planned hierarchy and closes every file',async()=>{
 const d=fixture(),bundle=S.bundle([S.capture(null,L.serialize(d),result(d))],d.name,d.session),fake=directoryFixture(),progress=[];
 const count=await S.writeDirectory(fake.parent,bundle.files,(n,total)=>progress.push([n,total]));assert.equal(count,Object.keys(bundle.files).length);assert.deepEqual([...fake.files.keys()],Object.keys(bundle.files));assert.deepEqual(progress.at(-1),[count,count]);assert.ok(fake.directories.has(bundle.root));assert.equal(fake.aborted.length,0);
});
test('native folder writer preflights the entire bundle and aborts a failed stream',async()=>{
 const fake=directoryFixture();await assert.rejects(()=>S.writeDirectory(fake.parent,{'safe/file.txt':'ok','../unsafe':'bad'}));assert.equal(fake.calls.length,0);
 await assert.rejects(()=>S.writeDirectory(fake.parent,{'safe/file.txt':new Uint8Array(6000001)}));assert.equal(fake.calls.length,0);
 const failing=directoryFixture(true);await assert.rejects(()=>S.writeDirectory(failing.parent,{'safe/file.txt':'ok'}),/Disk full/);assert.equal(failing.files.size,0);assert.deepEqual(failing.aborted,['safe/file.txt']);
});
