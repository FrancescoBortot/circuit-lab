/* Session folders and files. Inputs are validated projects; no uploaded code runs. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./lab-model.js'),require('./guided-trials.js'),require('./lab-files.js'),require('./study-context.js'),require('./rc-analysis.js'));else root.SessionFiles=factory(root.LabModel,root.GuidedTrials,root.LabFiles,root.StudyContext,root.RCAnalysis);})(typeof globalThis!=='undefined'?globalThis:this,function(L,T,F,C,R){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),enc=new TextEncoder();
 const key=d=>d.session.id+'|'+d.experiment+'|'+(T.current(d,L.CATALOG).preset||'manual');
 function capture(previous,text,result=null,now=new Date().toISOString()){
  const doc=L.parse(text);if(!doc.session)throw Error('Assegna un nome alla sessione prima di salvarla.');const stamp=C.stamp(doc),trial=T.current(doc,L.CATALOG),same=previous?.stamp===stamp;
  const record={id:key(doc),sessionId:doc.session.id,sessionName:doc.name,updatedAt:now,experiment:doc.experiment,trial,stamp,text:L.serialize(doc),analyses:same?{...previous.analyses}:{}};
  if(result){if(result.analysis!==doc.analysis||!['time','bode','vtc'].includes(result.analysis)||typeof result.csv!=='string'||typeof result.svg!=='string'||enc.encode(result.csv).length>6000000||enc.encode(result.svg).length>6000000)throw Error('Risultati della prova non validi o troppo grandi.');
   const old=record.analyses[result.analysis];record.analyses[result.analysis]={csv:result.csv,count:result.count,lastQuantity:result.quantity,points:result.points?clone(result.points):null,plots:{...old?.plots,[result.quantity]:result.svg}};
  }
  return record;
 }
 function fileName(doc,extension='json',suffix=''){return T.stem(doc,L.CATALOG)+(suffix?'-'+T.slug(suffix,24):'')+'.'+extension;}
 function dataURL(svg){const bytes=enc.encode(svg);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return'data:image/svg+xml;base64,'+btoa(binary);}
 function context(doc,record){const points=record.analyses.time?.points;if(!points?.length)return null;const p=doc.circuits[L.CATALOG.find(c=>c.id===doc.experiment).type];if(p.type!=='rc')return null;return{stamp:C.stamp(doc),parts:R.segments(points),onePole:L.system(p).n===1};}
 function bundle(records,name,session){
  if(!records.length)throw Error('Nessuna prova da salvare.');if(records.length>64)throw Error('La sessione supera 64 prove.');
  const root=T.slug(name,40)+'-'+T.slug(session.id.slice(-8),8),files={},manifest={application:'Circuit Lab session',version:1,name,session,createdAt:new Date().toISOString(),trials:[]},used=new Set();
  for(const record of records){
   const doc=L.parse(record.text);if(doc.session?.id!==session.id||record.id!==key(doc)||record.stamp!==C.stamp(doc))throw Error('Una prova della sessione non è coerente con il progetto.');doc.name=name;
   const trial=T.current(doc,L.CATALOG),folder=root+'/'+T.slug(trial.circuit,48)+'-'+trial.experience,stem=T.stem(doc,L.CATALOG),prefix=folder+'/'+stem;
   if(used.has(prefix))throw Error('Due prove produrrebbero gli stessi nomi.');used.add(prefix);
   const current=record.analyses[doc.analysis],plot=current&&(current.plots?.[current.lastQuantity]||Object.values(current.plots||{})[0]),options={rcContext:context(doc,record),plot:plot?dataURL(plot):null,simulation:current?{method:'Analisi guidata '+doc.analysis,count:current.count}:null};
   const individual=F.unzip(F.archive(JSON.parse(L.serialize(doc)),options));
   for(const [entry,bytes]of Object.entries(individual)){if(entry==='LEGGIMI.txt')continue;const destination=entry==='progetto.json'?prefix+'.json':prefix+'-'+entry;if(!F.archivePath(destination,true))throw Error('Percorso della sessione non valido.');files[destination]=bytes;}
   for(const [analysis,cache]of Object.entries(record.analyses)){if(!['time','bode','vtc'].includes(analysis))throw Error('Analisi della sessione non valida.');files[prefix+'-'+analysis+'.csv']=cache.csv;for(const[quantity,svg]of Object.entries(cache.plots||{})){if(!['voltage','current','db','phase'].includes(quantity))throw Error('Grafico della sessione non valido.');files[prefix+'-'+analysis+'-'+quantity+'.svg']=svg;}}
   manifest.trials.push({experiment:trial.experience,preset:trial.preset,label:trial.label,modified:trial.modified,project:prefix+'.json',updatedAt:record.updatedAt,analyses:Object.keys(record.analyses)});
  }
  files[root+'/sessione.json']=JSON.stringify(manifest,null,2);files[root+'/LEGGIMI.txt']='Sessione: '+name+'\nOgni sottocartella contiene un circuito. I nomi includono sessione, circuito e prova. Per riaprire una prova in Circuit Lab usa Apri e scegli il suo JSON. CSV e grafici rappresentano le analisi eseguite con i parametri salvati. Una modifica elettrica elimina dai salvataggi i risultati precedenti non più attuali. La relazione può essere aperta e stampata offline.\n';
  return{root,files,manifest};
 }
 function readArchive(bytes,sessionId){const files=F.unzipSession(bytes),manifests=Object.keys(files).filter(p=>p.endsWith('/sessione.json'));if(manifests.length!==1)throw Error('Manifesto della sessione assente o ambiguo.');const manifest=JSON.parse(new TextDecoder().decode(files[manifests[0]]));if(manifest.application!=='Circuit Lab session'||manifest.version!==1||!Array.isArray(manifest.trials)||!manifest.trials.length||manifest.trials.length>64)throw Error('Sessione non valida.');const seen=new Set(),records=manifest.trials.map(t=>{if(typeof t.project!=='string'||!F.archivePath(t.project,true)||!t.project.startsWith(manifests[0].slice(0,manifests[0].lastIndexOf('/')+1))||!files[t.project])throw Error('Progetto mancante nel pacchetto.');const doc=L.parse(new TextDecoder().decode(files[t.project]));if(doc.session?.id!==manifest.session?.id)throw Error('Sessioni incoerenti.');doc.session.id=sessionId;const record=capture(null,L.serialize(doc));if(seen.has(record.id))throw Error('Prove duplicate.');seen.add(record.id);return record;});return records;}
 async function writeDirectory(parent,files,onFile=()=>{}){
  const paths=Object.keys(files);const sizes=Object.values(files).map(v=>typeof v==='string'?enc.encode(v).length:v instanceof Uint8Array?v.length:Infinity);if(sizes.some(n=>n>6000000)||sizes.reduce((a,b)=>a+b,0)>40000000)throw Error('File della sessione troppo grandi.');if(!paths.length||paths.length>512||paths.some(p=>!F.archivePath(p,true)))throw Error('Percorsi della sessione non validi.');let completed=0;
  for(const path of paths){const parts=path.split('/');let directory=parent;for(const name of parts.slice(0,-1))directory=await directory.getDirectoryHandle(name,{create:true});const file=await directory.getFileHandle(parts.at(-1),{create:true}),stream=await file.createWritable();try{await stream.write(files[path]);await stream.close();}catch(error){try{await stream.abort();}catch{}throw error;}onFile(++completed,paths.length);}
  return completed;
 }
 return{key,capture,fileName,bundle,readArchive,writeDirectory};
});
