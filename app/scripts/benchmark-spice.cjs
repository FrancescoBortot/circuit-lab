/* Development-only comparison. Never called by the browser application. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const M=require('../free-model.js'),root=path.resolve(__dirname,'..');
const binary=process.env.CIRCUIT_NGSPICE_BIN||path.join(root,'.tools/ngspice-local/bin/ngspice');
function netlist(doc,ac=false){
  const topo=M.topology(doc),node=ref=>topo.nodes[ref]<0?'0':'N'+(topo.nodes[ref]+1),lines=['Circuit Lab independent ngspice reference'];
  for(const c of doc.components){
    const pin=p=>node(c.id+':'+p);
    if(['G','J'].includes(c.type))continue;
    if(['R','C','L'].includes(c.type)){lines.push(`${c.type}_${c.id} ${pin('a')} ${pin('b')} ${c.value}`+(['C','L'].includes(c.type)?` IC=${c.initial}`:''));continue;}
    if(['V','I'].includes(c.type)){
      const w=c.wave,level=w.level*(w.polarity??1),value=ac?'DC 0':w.kind==='sine'?`SIN(${w.offset} ${(w.polarity??1)*w.vpp/2} ${w.frequency} 0 0 ${w.phase})`:w.kind==='dc'||w.kind==='step'&&w.delay===0?`DC ${level}`:null;
      if(value===null)throw new Error('Reference source waveform not supported by this benchmark.');
      lines.push(`${c.type}_${c.id} ${pin('p')} ${pin('n')} ${value} AC ${c.id===doc.settings.acSource?1:0}`);continue;
    }
    if(c.type==='U'){
      if(c.model==='ideal')lines.push(`E${c.id} ${pin('out')} 0 ${pin('plus')} ${pin('minus')} 1e12`);
      else lines.push(`E${c.id}a ${c.id}drive 0 ${pin('plus')} ${pin('minus')} ${c.a0}`,`R${c.id}pole ${c.id}drive ${c.id}pole 1`,`C${c.id}pole ${c.id}pole 0 ${c.a0/(2*Math.PI*c.gbw)} IC=0`,`E${c.id}buffer ${pin('out')} 0 ${c.id}pole 0 1`);
    }else throw new Error('Unsupported reference component '+c.type);
  }
  return{lines,output:node(doc.probes.output),input:node(doc.probes.input)};
}
function table(file){return fs.readFileSync(file,'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.trim().split(/\s+/).map(Number)).filter(row=>row.every(Number.isFinite));}
function interpolate(rows,time,column){let low=0,high=rows.length-1;while(high-low>1){const mid=(low+high)>>1;if(rows[mid][0]<=time)low=mid;else high=mid;}const a=rows[low],b=rows[high];return a[column]+(time-a[0])/(b[0]-a[0])*(b[column]-a[column]);}
function run(){
  if(!fs.existsSync(binary))throw new Error('Test-only ngspice binary missing.');
  const version=cp.execFileSync(binary,['--version'],{encoding:'utf8'}).trim(),destination=path.join(root,'benchmark/ngspice');fs.mkdirSync(destination,{recursive:true});const results=[];
  const cases=[];
  const rc=M.example('rc');cases.push(['rc',rc,false]);
  const rl=M.clone(rc);Object.assign(rl.components.find(c=>c.id==='C1'),{type:'L',value:1});rl.components.find(c=>c.id==='R1').value=1000;cases.push(['rl',rl,false]);
  const rlc=M.clone(rc);rlc.components.find(c=>c.id==='R1').value=100;rlc.components.find(c=>c.id==='C1').value=1e-6;rlc.components.push(Object.assign(M.component('L','L1'),{value:.01}));rlc.wires.find(w=>w.a==='R1:b').a='L1:b';rlc.wires.push({id:'WL',a:'R1:b',b:'L1:a'});rlc.settings.duration=.002;cases.push(['rlc',rlc,false]);
  const loaded=M.example('rc-loaded');loaded.components.find(c=>c.id==='V1').wave={...rc.components[0].wave,kind:'dc',level:5};loaded.settings.duration=.006;cases.push(['loaded-rc',loaded,false]);
  const inv=M.example('inverting');inv.components[0].wave.vpp=.1;cases.push(['finite-band-inverting',inv,false]);
  for(const [name,doc] of [['rc-ac',rc],['loaded-rc-ac',loaded],['inverting-ac',inv],['difference-v1',M.example('difference')]])cases.push([name,M.clone(doc),true]);
  for(const [name,doc,ac]of cases){
    const folder=path.join(destination,name);fs.mkdirSync(folder,{recursive:true});Object.assign(doc.settings,{samples:1200,integration:'adaptive',rtol:1e-7,fmin:1,fmax:1e6,analysis:ac?'bode':'time'});
    const n=netlist(doc,ac),dt=Math.min(doc.settings.duration/20000,2e-7),commands=ac?`ac dec 50 1 1e6\nwrdata reference.dat real(v(${n.output})) imag(v(${n.output}))`:`tran ${dt} ${doc.settings.duration} 0 ${dt} uic\nwrdata reference.dat v(${n.output}) v(${n.input})`;
    fs.writeFileSync(path.join(folder,'circuit.json'),M.serialize(doc));
    fs.writeFileSync(path.join(folder,'reference.cir'),n.lines.concat(['.options reltol=1e-9 abstol=1e-13 vntol=1e-11','.control','set wr_singlescale','set wr_vecnames','set numdgt=15',commands,'quit','.endc','.end']).join('\n')+'\n');
    const execution=cp.spawnSync(binary,['-n','-b','reference.cir'],{cwd:folder,encoding:'utf8',timeout:30000});fs.writeFileSync(path.join(folder,'reference.log'),(execution.stdout||'')+(execution.stderr||''));
    if(execution.status!==0)throw new Error('ngspice failed: '+name+' · '+execution.status);
    const ref=table(path.join(folder,'reference.dat')),actual=ac?M.bode(doc):M.simulate(doc);let error=0;
    if(ac){if(ref.length!==actual.data.length)throw new Error('AC frequency grid mismatch');for(let i=0;i<ref.length;i++){if(Math.abs(Math.log(ref[i][0]/actual.data[i].x))>1e-10)throw new Error('AC frequency mismatch');error=Math.max(error,Math.hypot(ref[i][1]-actual.data[i].real,ref[i][2]-actual.data[i].imag));}}
    else{for(const p of actual.data){if(p.x<ref[0][0]||p.x>ref.at(-1)[0])continue;error=Math.max(error,Math.abs(p.out-interpolate(ref,p.x,1)));}}
    const tolerance=ac?1e-7:2e-4;results.push({name,analysis:ac?'AC':'transient',sameModel:ac||!actual.data.some(p=>p.clipped),referencePoints:ref.length,appPoints:actual.data.length,maxAbsoluteError:error,tolerance,unit:ac?'V/V':'V',pass:error<=tolerance});
    console.log(`${error<=tolerance?'PASS':'FAIL'} ${name}: ${error}`);
  }
  const report={engineSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'free-model.js'))).digest('hex'),reference:'ngspice, compiled locally from official verified source',version,externalConnectionDuringSimulation:false,initialization:'-n (no user configuration)',cases:results,pass:results.every(r=>r.pass)};fs.writeFileSync(path.join(destination,'results.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module){try{if(!run().pass)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={run,netlist,interpolate};
