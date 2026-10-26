const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('portable build and student download contain the runtime without course documents',()=>{
  cp.execFileSync('python3',[path.join(root,'scripts/build-offline.py')]);
  const file=fs.readFileSync(path.join(root,'dist/Circuit Lab.html'),'utf8');
  assert.match(file,/connect-src 'none'/);
  assert.doesNotMatch(file,/data:application\/pdf|assets\/[^"']*\.pdf|JVBERi0/i);
  assert.doesNotMatch(file,/<script[^>]+src=|<link rel="stylesheet"/);
  const scripts=[...file.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length>=16);
  for(const source of scripts){
    new vm.Script(source);
    const hash=crypto.createHash('sha256').update(source).digest('base64');
    assert.ok(file.includes("'sha256-"+hash+"'"));
  }
  assert.ok(file.indexOf('<script>')>file.indexOf('<noscript>'));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/integrita.json')));
  assert.equal(manifest.sha256,crypto.createHash('sha256').update(file).digest('hex'));
  assert.equal(manifest.bytes,Buffer.byteLength(file));
  assert.equal(manifest.course_materials,false);
  const checkArchive=`import sys,zipfile,pathlib
folder=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(folder/'Circuit-Lab-offline.zip') as archive:
 assert sorted(archive.namelist())==['Circuit Lab.html','LEGGIMI.txt','integrita.json']
 assert archive.testzip() is None
 for name in archive.namelist():
  data=archive.read(name)
  assert data==(folder/name).read_bytes()
  assert b'%PDF-' not in data and b'JVBERi0' not in data
`;
  cp.execFileSync('python3',['-c',checkArchive,path.join(root,'dist')]);
});

test('public site exposes only the self-contained app and the verified offline download',()=>{
  cp.execFileSync('python3',[path.join(root,'scripts/build-site.py')]);
  const site=path.resolve(root,'../_site');
  assert.deepEqual(fs.readdirSync(site).sort(),['Circuit-Lab-offline.zip','index.html']);
  const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
  assert.match(html,/href="\.\/Circuit-Lab-offline\.zip" download=/);
  assert.match(html,/Guida all’uso/);
  assert.doesNotMatch(html,/data:application\/pdf|assets\/[^"']*\.pdf|JVBERi0|<script[^>]+src=|<link rel="stylesheet"/i);
  for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
    const hash=crypto.createHash('sha256').update(match[1]).digest('base64');
    assert.ok(html.includes("'sha256-"+hash+"'"));
  }
  assert.deepEqual(fs.readFileSync(path.join(site,'Circuit-Lab-offline.zip')),fs.readFileSync(path.join(root,'dist/Circuit-Lab-offline.zip')));
});
