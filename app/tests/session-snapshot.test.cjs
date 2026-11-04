const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../session-files');
function directory(){const entries=new Map();return{entries,async getDirectoryHandle(name){if(!entries.has(name))entries.set(name,directory());return entries.get(name);},async getFileHandle(name){return{async createWritable(){return{async write(value){entries.set(name,value);},async close(){},async abort(){}};}};},async removeEntry(name){entries.delete(name);}};}
test('successive saves are isolated and retain no incomplete marker',async()=>{
 const parent=directory(),a=await S.writeSnapshot(parent,{'session/old.csv':'old','session/project.json':'old'}),b=await S.writeSnapshot(parent,{'session/project.json':'new'});
 assert.notEqual(a.name,b.name);assert.equal(parent.entries.size,2);
 const latest=parent.entries.get(b.name);assert.equal(latest.entries.has('SALVATAGGIO-INCOMPLETO.txt'),false);assert.equal(latest.entries.get('session').entries.has('old.csv'),false);assert.equal(latest.entries.get('session').entries.get('project.json'),'new');
});
test('an interrupted save remains explicitly incomplete',async()=>{
 const parent=directory();await assert.rejects(S.writeSnapshot(parent,{'session/file.txt':'data'},()=>{throw Error('interrupted');}),/interrupted/);
 const target=[...parent.entries.values()][0];assert.equal(target.entries.has('SALVATAGGIO-INCOMPLETO.txt'),true);
});

test('snapshot validates all destinations before creating a directory',async()=>{const parent=directory();await assert.rejects(S.writeSnapshot(parent,{'../escape.txt':'bad'}),/Percorsi/);assert.equal(parent.entries.size,0);});
