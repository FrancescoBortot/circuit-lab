/* Explicit lumped models of generator, leads, cable, probe and scope.
   Applying/removing a setup is atomic; every added R/C is an ordinary part. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'));else root.BenchModel=factory(root.FreeModel);})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';const copy=M.clone;
 const defaults=()=>({mode:'ideal',rg:50,wireR:.05,scopeR:1e6,scopeC:20e-12,acC:20e-9,probeR:10e6,probeC:12e-12,cableC:90e-12,sourceIds:null,channels:[{enabled:true,target:'input',kind:'direct',coupling:'dc',length:1},{enabled:true,target:'output',kind:'direct',coupling:'dc',length:1}]});
 function config(value={}){const c={...defaults(),...copy(value)};if(!['ideal','real'].includes(c.mode))throw Error('Modalità del montaggio non valida.');
  for(const [key,min,max]of [['rg',0,1e7],['wireR',0,100],['scopeR',1,1e12],['scopeC',0,1e-3],['acC',1e-14,1],['probeR',1,1e12],['probeC',1e-14,1e-3],['cableC',1e-12,1e-6]])if(!Number.isFinite(c[key])||c[key]<min||c[key]>max||['rg','wireR'].includes(key)&&c[key]>0&&c[key]<.01)throw Error('Parametro del montaggio fuori intervallo: '+key+'. R positive: almeno 0,01 Ω.');
  if(c.sourceIds!==null&&(!Array.isArray(c.sourceIds)||c.sourceIds.length>40||new Set(c.sourceIds).size!==c.sourceIds.length||c.sourceIds.some(id=>typeof id!=='string'||!/^[A-Z][A-Za-z0-9_]{0,15}$/.test(id))))throw Error('Generatori del montaggio non validi.');
  if(!Array.isArray(c.channels)||c.channels.length!==2)throw Error('Sono previsti due canali di misura.');
  for(const ch of c.channels){if(!ch||typeof ch.enabled!=='boolean'||typeof ch.target!=='string'||ch.target.length>40||!['direct','probe10'].includes(ch.kind)||!['dc','ac'].includes(ch.coupling)||!Number.isFinite(ch.length)||ch.length<0||ch.length>100)throw Error('Configurazione del canale non valida.');
   if(ch.enabled&&ch.kind==='probe10'&&ch.coupling==='ac'&&(c.probeR<=c.scopeR||c.probeC*c.probeR/c.scopeR<c.scopeC))throw Error('Sonda AC: R_E deve superare R_O e C_E·R_E/R_O deve essere almeno C_O.');
  }return c;
 }
 const real=p=>p?.bench?.mode==='real';
 function remove(input){const doc=copy(input),b=doc.benchSetup;if(!b)return doc;
  if(b.version!==1||!Array.isArray(b.parts)||!Array.isArray(b.wires)||!Array.isArray(b.baseWires)||!Array.isArray(b.expected)||b.parts.length>40||b.wires.length>120||b.baseWires.length>120)throw Error('Origine del montaggio reale non valida. Conserva il JSON attuale.');
  const added=new Set(b.parts),generatedWires=new Set(b.wires),expected=new Map(b.expected.map(w=>[w.id,w]));
  if(b.parts.some(id=>!doc.components.some(c=>c.id===id&&typeof c.benchRole==='string'))||b.expected.some(w=>!doc.wires.some(v=>v.id===w.id&&v.a===w.a&&v.b===w.b))||doc.wires.some(w=>!expected.has(w.id)&&[w.a,w.b].some(p=>added.has(p.split(':')[0]))))throw Error('I collegamenti del montaggio reale sono stati modificati. Usa Annulla o sposta i collegamenti aggiunti prima di riconfigurarlo.');
  for(const t of doc.traces||[])if([t.component,t.positive?.split(':')[0],t.negative?.split(':')[0]].some(id=>added.has(id)))throw Error('Rimuovi prima le sonde aggiuntive sui componenti degli strumenti.');
  for(const kind of ['input','output']){if(doc.probes[kind]===b.appliedProbes[kind])doc.probes[kind]=b.probes[kind];else if(added.has(doc.probes[kind]?.split(':')[0]))throw Error('Sposta prima IN/OUT fuori dai componenti degli strumenti.');}
  const base=new Map(b.baseWires.map(w=>[w.id,w]));doc.wires=doc.wires.filter(w=>!generatedWires.has(w.id)).map(w=>base.has(w.id)?{...w,a:base.get(w.id).a,b:base.get(w.id).b}:w);doc.components=doc.components.filter(c=>!added.has(c.id));
  for(const [kind,key]of [['input','probeScaleInput'],['output','probeScaleOutput']]){if(b.scales[kind]===null)delete doc.settings[key];else doc.settings[key]=b.scales[kind];}
  // Labels automatically moved with source outputs are restored; later user labels survive.
  if(b.labels){const inverse=Object.fromEntries(Object.entries(b.sourceMap).map(([a,z])=>[z,a]));const later=Object.fromEntries(Object.entries(doc.nodeLabels||{}).filter(([pin,label])=>b.appliedLabels?.[pin]!==label).map(([pin,label])=>[inverse[pin]||pin,label]));doc.nodeLabels={...b.labels,...later};}else if(doc.nodeLabels){for(const pin of Object.keys(doc.nodeLabels))if(added.has(pin.split(':')[0]))delete doc.nodeLabels[pin];}
  delete doc.benchSetup;return M.parse(M.serialize(doc));
 }
 function apply(input,value){const c=config(value),doc=remove(input);if(c.mode==='ideal')return doc;
  const b={version:1,config:c,parts:[],wires:[],baseWires:copy(doc.wires),expected:[],probes:copy(doc.probes),appliedProbes:null,labels:doc.nodeLabels?copy(doc.nodeLabels):null,scales:{input:doc.settings.probeScaleInput??null,output:doc.settings.probeScaleOutput??null},sourceMap:{}};
  let initialValues={};try{initialValues=M.initialVoltages(doc);}catch(error){b.initializationNotice='Inizializzazione nominale non disponibile: '+error.message;}
  const used=new Set(doc.components.map(p=>p.id)),wireIDs=new Set(doc.wires.map(w=>w.id));
  const id=prefix=>{let i=1;while(used.has(prefix+i))i++;const out=prefix+i;used.add(out);return out;};
  const add=(type,prefix,x,y,value,role,rotation=0)=>{const part=M.component(type,id(prefix),x,y);if(value!==undefined)part.value=value;part.rotation=rotation;part.benchRole=role;doc.components.push(part);b.parts.push(part.id);return part;};
  const wire=(a,z)=>{let i=1;while(wireIDs.has('WB'+i))i++;const w={id:'WB'+i,a,b:z};wireIDs.add(w.id);doc.wires.push(w);b.wires.push(w.id);return w;};
  const place=(x,y,vertical=false)=>{const choices=[0,-100,100,-200,200,-300,300].map(offset=>({x:x+(vertical?offset:0),y:y+(vertical?0:offset)})),score=p=>doc.components.reduce((sum,c)=>sum+(Math.abs(c.x-p.x)<95&&Math.abs(c.y-p.y)<80?1:0),0);return choices.reduce((best,p)=>score(p)<score(best)?p:best,choices[0]);};
  const pins={R:{a:[-44,0],b:[44,0]},C:{a:[-34,0],b:[34,0]},L:{a:[-44,0],b:[44,0]},V:{p:[0,-43],n:[0,43]},I:{p:[0,-43],n:[0,43]},U:{plus:[-52,25],minus:[-52,-25],out:[60,0]},G:{g:[0,-22]},J:{j:[0,0]},D:{a:[-44,0],b:[44,0]},Q:{c:[20,-42],b:[-46,0],e:[20,42]},M:{d:[24,-42],g:[-46,0],s:[24,42]}};
  const position=ref=>{const[k,p]=ref.split(':'),part=doc.components.find(q=>q.id===k);if(!part||!pins[part.type]?.[p])throw Error('Punto dello strumento non valido: '+ref);const[a,z]=pins[part.type][p],r=part.rotation*Math.PI/180;return{x:part.x+a*Math.cos(r)-z*Math.sin(r),y:part.y+a*Math.sin(r)+z*Math.cos(r)};};
  const sourceIDs=c.sourceIds||doc.components.filter(p=>p.type==='V').map(p=>p.id);for(const key of sourceIDs)if(!doc.components.some(p=>p.id===key&&p.type==='V'))throw Error('Generatore non disponibile: '+key);
  const targets=c.channels.map(ch=>ch.target==='input'?b.probes.input:ch.target==='output'?b.probes.output:ch.target==='input2'?(doc.components.some(p=>p.id==='R3')?'R3:a':'V2:p'):ch.target);for(let i=0;i<2;i++)if(c.channels[i].enabled&&!M.validPin(doc,targets[i]))throw Error('Scegli il punto da misurare sul canale '+(i+1)+'.');
  if(c.rg>0)for(const key of sourceIDs){const source=doc.components.find(p=>p.id===key),r=add('R','RG',source.x+110,source.y-95,c.rg,'R_G · '+key);const old=key+':p',external=r.id+':b';for(const w of doc.wires)for(const end of ['a','b'])if(w[end]===old)w[end]=external;b.sourceMap[old]=external;wire(old,r.id+':a');}
  const mapped=pin=>b.sourceMap[pin]||pin;for(const key of ['input','output'])doc.probes[key]=mapped(doc.probes[key]);if(doc.nodeLabels)doc.nodeLabels=Object.fromEntries(Object.entries(doc.nodeLabels).map(([pin,label])=>[mapped(pin),label]));
  if(c.wireR>0)for(const original of b.baseWires){const w=doc.wires.find(w=>w.id===original.id),a=position(w.a),z=position(w.b),end=w.b,vertical=Math.abs(a.y-z.y)>Math.abs(a.x-z.x),at=place((a.x+z.x)/2,(a.y+z.y)/2,vertical),r=add('R','RW',at.x,at.y,c.wireR,'Collegamento '+w.id,Math.abs(a.y-z.y)>Math.abs(a.x-z.x)?90:0);w.b=r.id+':a';wire(r.id+':b',end);}
  let ground=doc.components.find(p=>p.type==='G');if(!ground)ground=add('G','GB',150,650,undefined,'Massa strumenti');const g=ground.id+':g',bottom=Math.max(450,...doc.components.map(p=>p.y))+(c.channels.some(ch=>ch.enabled&&ch.kind==='probe10'&&ch.coupling==='ac')?330:180);
  const shunt=(type,prefix,node,value,x,y,role,initial=0)=>{if(!value)return null;const part=add(type,prefix,x,y,value,role,90);if(type==='C')part.initial=initial;wire(node,part.id+':a');wire(part.id+':b',g);return part;};
  for(let i=0;i<2;i++){const ch=c.channels[i];if(!ch.enabled)continue;const tip=mapped(targets[i]),x=250+i*470,y=bottom,tag='CH'+(i+1),initial=initialValues[targets[i]]||0;let measured=tip,scale=1;
   if(ch.kind==='probe10'&&ch.coupling==='dc'){shunt('R','RE',tip,c.probeR,x,y,tag+' · R equivalente sonda 10×');shunt('C','CE',tip,c.probeC,x+100,y,tag+' · C equivalente sonda+cavo+oscilloscopio',initial);}
   else{
    let connector=tip;
    if(ch.kind==='probe10'){
     const upperR=c.probeR-c.scopeR,upperC=c.probeC*c.probeR/upperR,r=add('R','RP',x,y-160,upperR,tag+' · R sonda compensata'),cap=add('C','CP',x,y-230,upperC,tag+' · C compensazione');wire(tip,r.id+':a');wire(tip,cap.id+':a');wire(r.id+':b',cap.id+':b');connector=r.id+':b';cap.initial=initial*(1-c.scopeR/c.probeR);
     shunt('C','CC',connector,Math.max(0,c.probeC*c.probeR/c.scopeR-c.scopeC),x+220,y,tag+' · C interna equivalente, inclusa in C_E',initial*c.scopeR/c.probeR);scale=c.probeR/c.scopeR;
    }else shunt('C','CC',tip,c.cableC*ch.length,x+220,y,tag+' · C cavo ('+ch.length+' m)',initial);
    measured=connector;if(ch.coupling==='ac'){const ac=add('C','CA',x,y-75,c.acC,tag+' · accoppiamento AC');wire(connector,ac.id+':a');measured=ac.id+':b';}
    shunt('R','RO',measured,c.scopeR,x,y,tag+' · R oscilloscopio');shunt('C','CO',measured,c.scopeC,x+100,y,tag+' · C oscilloscopio',initial/(ch.kind==='probe10'?c.probeR/c.scopeR:1));
   }
   const role=i===0?'input':'output';doc.probes[role]=measured;doc.settings[i===0?'probeScaleInput':'probeScaleOutput']=scale;
  }
  // Split nets created by lead resistances need distinct names.
  if(doc.nodeLabels){const t=M.topology(doc),seen=new Set();for(const group of t.groups){const entries=Object.entries(doc.nodeLabels).filter(([pin])=>t.nodes[pin]===group.index);if(!entries.length)continue;let label=entries[0][1],n=2;while(seen.has(label))label=entries[0][1].slice(0,20)+'_'+n++;seen.add(label);for(const[pin]of entries)doc.nodeLabels[pin]=label;}}
  b.appliedLabels=copy(doc.nodeLabels||{});b.appliedProbes=copy(doc.probes);b.expected=doc.wires.map(({id,a,b})=>({id,a,b}));doc.benchSetup=b;
  return M.parse(M.serialize(doc));
 }
 function describe(doc){return doc.benchSetup?'Montaggio reale esplicito. IN/OUT sono le letture dei canali collegati, riferite a massa. La scala della sonda AC è compensata con R_E/R_O. Le tensioni nodali e le sonde aggiuntive restano tensioni fisiche. Le capacità degli strumenti partono dalla tensione nominale del nodo, divisa nel modello compensato della sonda; C_AC parte da 0 V.':'';}
 return{defaults,config,real,apply,remove,describe};
});
