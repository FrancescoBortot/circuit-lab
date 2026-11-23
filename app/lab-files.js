/* Portable reports and ZIP archives, stored without compression. No external resources. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./local-projects.js'),require('./free-model.js'),require('./lab-model.js'),require('./rc-analysis.js'),require('./study-context.js'),require('./latex-export.js'),require('./comparison-data.js'));else root.LabFiles=factory(root.LocalProjects,root.FreeModel,root.LabModel,root.RCAnalysis,root.StudyContext,root.LatexExport,root.ComparisonData);})(typeof globalThis!=='undefined'?globalThis:this,function(P,M,L,R,C,Latex,D){
 'use strict';const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 function archivePath(name,folders=false){return typeof name==='string'&&name.length<320&&(folders?name.split('/').length<=4:name.indexOf('/')<0)&&name.split('/').every(p=>/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,179}$/.test(p)&&!['__proto__','constructor','prototype'].includes(p));}
 const MAX_SESSION_ENTRIES=768;
 function zip(files,session=false){if(Object.keys(files).length>(session?MAX_SESSION_ENTRIES:20))throw Error('Archivio troppo complesso.');const parts=[],entries=[];let offset=0;for(const[name,value]of Object.entries(files)){if(!(session?archivePath(name,true):/^[A-Za-z0-9_.-]{1,80}$/.test(name)))throw Error('Nome archivio non valido.');const data=typeof value==='string'?enc.encode(value):value,filename=enc.encode(name);if(!(data instanceof Uint8Array)||data.length>6000000)throw Error('File archivio troppo grande.');const crc=crc32(data),h=new Uint8Array(30+filename.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);h.set(filename,30);parts.push(h,data);entries.push({filename,data,crc,offset});offset+=h.length+data.length;}
  const centralStart=offset;for(const e of entries){const h=new Uint8Array(46+e.filename.length),v=new DataView(h.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,e.crc,true);v.setUint32(20,e.data.length,true);v.setUint32(24,e.data.length,true);v.setUint16(28,e.filename.length,true);v.setUint32(42,e.offset,true);h.set(e.filename,46);parts.push(h);offset+=h.length;}
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,offset-centralStart,true);v.setUint32(16,centralStart,true);parts.push(end);offset+=22;if(offset>(session?40000000:8000000))throw Error(session?'Sessione oltre 40 MB: salva le singole prove.':'Archivio oltre 8 MB.');const out=new Uint8Array(offset);let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;
 }
 function unzip(data,session=false){if(!(data instanceof Uint8Array)||data.length<22||data.length>(session?40000000:8000000))throw Error('Archivio non valido o oltre 8 MB.');const v=new DataView(data.buffer,data.byteOffset,data.byteLength),files={};let i=0,count=0;
  while(i+4<=data.length&&v.getUint32(i,true)===0x04034b50){if(++count>(session?MAX_SESSION_ENTRIES:20)||i+30>data.length)throw Error('Archivio troppo complesso.');const flags=v.getUint16(i+6,true),method=v.getUint16(i+8,true),crc=v.getUint32(i+14,true),size=v.getUint32(i+18,true),plain=v.getUint32(i+22,true),nameLen=v.getUint16(i+26,true),extra=v.getUint16(i+28,true),start=i+30+nameLen+extra;if(flags!==0x800||method!==0||size!==plain||size>6000000||start+size>data.length)throw Error('Apri un archivio Circuit Lab non compresso, senza cifratura.');const name=dec.decode(data.slice(i+30,i+30+nameLen));if(!(session?archivePath(name,true):/^[A-Za-z0-9_.-]{1,80}$/.test(name))||Object.hasOwn(files,name)||['__proto__','constructor','prototype'].includes(name))throw Error('Nome o percorso archivio non consentito.');const bytes=data.slice(start,start+size);if(crc32(bytes)!==crc)throw Error('Integrità archivio non valida: '+name+'.');files[name]=bytes;i=start+size;}
  const end=data.length-22;if(!count||end<i||v.getUint32(end,true)!==0x06054b50||v.getUint16(end+10,true)!==count||v.getUint32(end+16,true)!==i||(!session&&!files['progetto.json']))throw Error('Archivio Circuit Lab incompleto.');return files;
 }
 function projectFromArchive(data){const files=unzip(data),text=dec.decode(files['progetto.json']),doc=P.readJSON(text);if(doc.mode==='free')M.parse(text);else L.parse(text);return text;}
 function studyTable(doc,kind){const s=kind==='rc'?doc.rcStudy:kind==='ac'?doc.acStudy:doc.opampStudy,points=kind==='opamp'?s?.points:s?.dataset?.points;if(!points)throw Error('Nessun dataset di questo tipo nel progetto.');const amplitude=kind==='ac'&&points[0].input!==undefined,columns=kind==='rc'?['x','y','sigma']:kind==='opamp'?['mode','frequency','input','output','phase','uInput','uOutput','uPhase']:amplitude?['x','input','output','uInput','uOutput','phase','uPhase']:['x','gain','uDb','phase','uPhase'];return{columns,points,edited:Boolean(kind==='opamp'?s.edited:s.dataset.edited)};}
 function editStudy(doc,kind,rows){const next=JSON.parse(JSON.stringify(doc)),key={rc:'rcStudy',ac:'acStudy',opamp:'opampStudy'}[kind],s=next[key];if(!s)throw Error('Importa prima un dataset oppure crea un esempio.');const target=kind==='opamp'?s:s.dataset;if(!target)throw Error('Importa prima un dataset.');target.originalPoints??=JSON.parse(JSON.stringify(target.points));target.edited=true;target.points=JSON.parse(JSON.stringify(rows));if(kind==='ac')for(const p of target.points){if(p.input!==undefined){p.gain=p.output/p.input;if(p.uInput!==undefined)p.uDb=20/Math.LN10*Math.hypot(p.uInput/p.input,p.uOutput/p.output);}p.db=20*Math.log10(p.gain);}P.checkStudyUpdate(JSON.stringify(doc),key,s);return next;}
 function validateProvenance(s,kind){const d=kind==='opamp'?s:s?.dataset;if(!d)return;if(d.edited!==undefined&&typeof d.edited!=='boolean')throw Error('Provenienza dei dati non valida.');if(d.originalPoints!==undefined){const p=d.originalPoints;if(!Array.isArray(p)||p.length>4000||!p.length)throw Error('Originali della tabella non validi.');}}
 function schematic(doc){
  const d=doc.mode==='free'?doc:L.circuit(doc),t=M.topology(d),local={R:{a:[-44,0],b:[44,0]},C:{a:[-34,0],b:[34,0]},L:{a:[-44,0],b:[44,0]},V:{p:[0,-43],n:[0,43]},I:{p:[0,-43],n:[0,43]},U:{plus:[-52,25],minus:[-52,-25],out:[60,0]},G:{g:[0,-22]},J:{j:[0,0]},D:{a:[-44,0],b:[44,0]},Q:{c:[20,-42],b:[-46,0],e:[20,42]},M:{d:[24,-42],g:[-46,0],s:[24,42]}};
  const position=ref=>{const[id,p]=ref.split(':'),c=d.components.find(c=>c.id===id),v=local[c.type][p],a=c.rotation*Math.PI/180;return{x:c.x+v[0]*Math.cos(a)-v[1]*Math.sin(a),y:c.y+v[0]*Math.sin(a)+v[1]*Math.cos(a)};},x=(d.components.length?Math.min(...d.components.map(c=>c.x)):0)-90,y=(d.components.length?Math.min(...d.components.map(c=>c.y)):0)-90,w=(d.components.length?Math.max(...d.components.map(c=>c.x)):400)-x+150,h=(d.components.length?Math.max(...d.components.map(c=>c.y)):200)-y+110;
  const path={R:'M-44 0H-25V-10H25V10H-25V0M25 0H44',C:'M-34 0H-6M-6-19V19M6-19V19M6 0H34',L:'M-44 0H-28C-28-20-14-20-14 0C-14-20 0-20 0 0C0-20 14-20 14 0C14-20 28-20 28 0H44',V:'M0-43V-25M0 25V43M-8-9H8M0-17V-1M-8 11H8',I:'M0-43V-25M0 25V43M0-14V14M-5 8L0 14L5 8',U:'M-42-42L48 0L-42 42ZM-52-25H-42M-52 25H-42M48 0H60M-36-25H-26M-36 25H-26M-31 20V30',G:'M0-22V0M-20 0H20M-13 7H13M-6 14H6',J:'',D:'M-44 0H-18M-18-20V20L18 0ZM18-20V20M18 0H44',Q:'M-46 0H-12M-12-25V25M-12-16L20-34V-42M-12 16L20 34V42',M:'M-46 0H-20M-20-24V24M-12-24V24M-12-18H24V-42M-12 18H24V42'};
  return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[x,y,w,h].join(' ')+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="white"/>'+d.wires.map(w=>{const a=position(w.a),b=position(w.b),route=w.route?Latex.route(d,w).map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(''):'M'+a.x+' '+a.y+'H'+b.x+'V'+b.y;return'<path d="'+route+'" fill="none" stroke="#71849e" stroke-width="1.5"/>';}).join('')+d.components.map(c=>'<g transform="translate('+c.x+' '+c.y+') rotate('+c.rotation+')"><path d="'+path[c.type]+'" fill="'+(c.type==='U'?'white':'none')+'" stroke="#31445f" stroke-width="2"/>'+(c.type==='Q'?'<path transform="translate('+c.x+' '+c.y+') rotate('+c.rotation+')" d="'+(c.polarity==='p'?'M10 23L0 23L5 32':'M7 23L16 32L4 32')+'" fill="none" stroke="#31445f" stroke-width="2"/>':'')+(['V','I'].includes(c.type)?'<circle r="25" fill="none" stroke="#31445f" stroke-width="2"/>':'')+(c.type==='J'?'<circle r="4" fill="#31445f"/>':'')+'</g><text x="'+(c.x+15)+'" y="'+(c.y-50)+'" font-family="Arial" font-size="13">'+esc(c.id)+'</text><text x="'+(c.x+15)+'" y="'+(c.y-34)+'" font-family="Arial" font-size="11">'+esc(['R','C','L'].includes(c.type)?L.format(c.value,{R:'Ω',C:'F',L:'H'}[c.type]):c.type==='U'?c.model:c.type==='Q'?(c.polarity==='p'?'PNP':'NPN')+' · β '+c.bf:c.type==='M'?(c.polarity==='p'?'PMOS':'NMOS')+' · Vt '+L.format(c.vto,'V'):M.NAMES[c.type])+'</text>'+M.PINS[c.type].map(p=>{const a=position(c.id+':'+p),index=t.nodes[c.id+':'+p],label=index<0?'0':t.groups.find(g=>g.index===index)?.label||'N'+(index+1);return'<circle cx="'+a.x+'" cy="'+a.y+'" r="2.5" fill="#4264ef"/><text x="'+(a.x+7)+'" y="'+(a.y-7)+'" font-family="Arial" font-size="9">'+esc(label)+'</text>';}).join('')).join('')+'</svg>';
 }
 const headings=(kind,columns)=>columns.map(k=>({x:kind==='rc'?'tempo_s':'frequenza_Hz',y:'tensione_V',sigma:'uTensione_V',mode:'modo',frequency:'frequenza_Hz',input:'Vin_Vpp',output:'Vout_Vpp',phase:'fase_gradi',uInput:'uVin_V',uOutput:'uVout_V',uPhase:'uFase_gradi',gain:'guadagno_V_V',uDb:'uGuadagno_dB'}[k]||k));
 // Rebuild the fit from saved settings and original observations. A simulated fit
 // additionally requires a matching worker context; no stale curves are reused.
 function rcResults(doc,context=null){
  const s=doc.rcStudy;if(!s)return null;
  try{
   P.checkRCStudy(s);const current=C.stamp(doc),stale=Boolean(s.stamp&&s.stamp!==current&&s.stamp!==context?.legacyStamp);
   if(s.source==='simulation'&&(stale||!context||context.stamp!==current))return{source:s.source,error:'Fit simulato da aggiornare: apri Misura τ e ricalcola sul circuito attuale.'};
   const points=s.source==='simulation'?context.parts?.[s.segment]:s.dataset?.points;
   if(!points?.length)return{source:s.source,error:'Nessun dato disponibile per il fit RC.'};
   const f=R.fit(points,{...s,source:s.source}),warnings=[...f.warnings];
   if(stale)warnings.push('Il circuito è cambiato dall’analisi RC: i dati importati e R/C di confronto restano quelli salvati. Ricontrolla il confronto con il circuito.');
   if(s.source==='simulation'&&!context.onePole)warnings.push('τ equivalente del tratto: la rete non è identificata come RC a un solo polo.');
   const reference=s.reference.R!==null&&s.reference.C!==null?R.reference(s.reference.R,s.reference.C,s.reference.uR,s.reference.uC,s.reference.rho??0):null;
   if(reference&&!s.reference.independent&&s.reference.rho===undefined)reference.uTau=null;
   const {predict,residuals,...fit}=f;
   return{source:s.source,origin:s.source==='simulation'?'Campioni della simulazione':s.dataset.name,stamp:current,stale,fit,reference,warnings,method:s.method,finalMode:s.finalMode,points:residuals.map(p=>({x:p.x,y:p.y,fit:p.fit,residual:p.residual,uV:s.source==='experiment'?(p.sigma??s.commonSigma):null}))};
  }catch(e){return{source:s.source,error:'Fit RC non allegato: '+e.message};}
 }
 function rcPlot(result,residual=false){
  const p=result.points,left=68,top=24,width=628,height=173,x0=p[0].x,dx=p.at(-1).x-x0;let min=Infinity,max=-Infinity;
  for(const row of p){const values=residual?[row.residual]:[row.y,row.fit];for(const v of values){min=Math.min(min,v-(row.uV||0));max=Math.max(max,v+(row.uV||0));}}
  if(residual){min=Math.min(min,0);max=Math.max(max,0);}const pad=(max-min||Math.max(Math.abs(max),1e-6))*.08;min-=pad;max+=pad;const x=v=>left+(v-x0)/dx*width,y=v=>top+(max-v)/(max-min)*height,coords=key=>p.map(v=>x(v.x).toFixed(2)+','+y(v[key]).toFixed(2)).join(' '),color=residual?'#aa7433':'#77869a';
  let marks='';for(let i=0;i<=4;i++){const t=x0+dx*i/4,v=min+(max-min)*i/4;marks+='<path d="M'+x(t)+' '+top+'V'+(top+height)+'M'+left+' '+y(v)+'H'+(left+width)+'" stroke="#e5eaf2"/><text x="'+x(t)+'" y="220" text-anchor="middle">'+esc(L.format(t,'s',3))+'</text><text x="60" y="'+(y(v)+4)+'" text-anchor="end">'+esc(L.format(v,'V',3))+'</text>';}
  const bars=p.filter(v=>v.uV>0).map(v=>{const value=residual?v.residual:v.y;return'<path d="M'+x(v.x).toFixed(2)+' '+y(value-v.uV).toFixed(2)+'V'+y(value+v.uV).toFixed(2)+'" stroke="#9aaac2"/>';}).join('');
  const observations=result.source==='experiment'?p.map(v=>'<circle cx="'+x(v.x).toFixed(2)+'" cy="'+y(residual?v.residual:v.y).toFixed(2)+'" r="2.5" fill="'+color+'"/>').join(''):'<polyline points="'+coords(residual?'residual':'y')+'" fill="none" stroke="'+color+'" stroke-width="1.4"/>',f=result.fit,curve=Array.from({length:221},(_,i)=>{const t=x0+dx*i/220,value=f.finalValue+f.a*Math.exp(-(t-f.t0)/f.tau);return x(t).toFixed(2)+','+y(value).toFixed(2);}).join(' ');
  return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 250" role="img" aria-label="'+(residual?'Residui RC in volt':'Curva RC e fit in volt')+'"><rect width="720" height="250" fill="white"/><g font-family="Arial" font-size="11" fill="#53657f">'+marks+'<text x="382" y="243" text-anchor="middle">Tempo</text></g>'+(residual?'<path d="M'+left+' '+y(0)+'H'+(left+width)+'" stroke="#9baac0" stroke-dasharray="4 3"/>':'')+bars+observations+(residual?'':'<polyline points="'+curve+'" fill="none" stroke="#4264ef" stroke-width="1.8"/>')+'</svg>';
 }
 function rcSection(result,tbl,format){
  if(!result)return'';if(result.error)return'<h2>Fit RC</h2><p>'+esc(result.error)+'</p>';
  const f=result.fit;
  return'<h2>Fit RC · '+(result.source==='simulation'?'simulazione':'dati importati')+'</h2><p>'+esc(result.origin)+' · '+f.count+' campioni originali nell’intervallo '+esc(format(f.from,'s'))+'–'+esc(format(f.to,'s'))+'. Risultati ricalcolati dai dati e dalle impostazioni salvate.</p><p>V(t) = V∞ + A exp[−(t − t₀)/τ]. Metodo: '+(result.method==='log'?'retta dei logaritmi':'minimi quadrati sulle tensioni')+'; V∞ '+(result.finalMode==='fixed'?'noto, assunto esatto':'stimato dal fit')+'.</p>'+tbl(['Grandezza','Valore','u standard'],[['τ dal fit',format(f.tau,'s'),format(f.uTau,'s')],['V∞',format(f.finalValue,'V'),format(f.uFinal,'V')],['A',format(f.a,'V'),format(f.uA,'V')],['τ da R·C di confronto',format(result.reference?.tau,'s'),format(result.reference?.uTau,'s')],['RMS residui',format(f.rms,'V'),'—'],['χ² / ν',format(f.reducedChi2),'ν = '+f.df]])+'<p>'+esc(result.source==='simulation'?'Fit numerico della simulazione: nessuna incertezza sperimentale assegnata.':'Fit con tempi assunti esatti e contributi di tensione indipendenti tra punti. Il bilancio metrologico, quando presente, è un calcolo separato con i contributi aggiuntivi dichiarati.')+'</p><p class="note">'+esc(result.warnings.join(' '))+'</p><h3>Dati e fit</h3><p class="note">Grigio: dati · blu: fit. Barre: u(V) standard quando fornite.</p>'+rcPlot(result)+'<h3>Residui · dati − fit</h3>'+rcPlot(result,true);
 }
 function rcCSV(result){const f=result.fit;return R.csv([['grandezza','valore_SI','u_standard_SI','unita'],['tau_fit',f.tau,f.uTau,'s'],['V_infinito',f.finalValue,f.uFinal,'V'],['A',f.a,f.uA,'V'],['tau_R_C',result.reference?.tau,result.reference?.uTau,'s'],['inizio_fit',f.from,null,'s'],['fine_fit',f.to,null,'s'],['RMS_residui',f.rms,null,'V'],['chi2_ridotto',f.reducedChi2,null,'1'],['origine',result.origin,null,''],['tipo_dati',result.source,null,''],['riferimento_circuito',result.stamp,null,''],...result.warnings.map(w=>['nota',w,null,''])]);}
 function semiconductorSection(doc,guided,tbl,format){
  if(!guided||!L.semiconductor?.is(guided))return'';
  const S=L.semiconductor,rows=L.summary(guided).map(r=>[r.label,r.value]);
  try{
   if(S.isCharacteristic(doc.analysis)){const res=S.analyze(guided,doc.analysis);for(const m of S.metrics(guided,doc.analysis,res.values,L.format))rows.push([m.label,m.value]);}
   else if(guided.type==='mos-amplifier'){for(const m of S.metrics(guided,'time',S.amplifierValues(guided),L.format))rows.push([m.label,m.value]);}
   else if(S.logic(guided)&&typeof S.logicValues==='function'){
    const vals=S.logicValues(guided);
    for(const m of S.metrics(guided,'time',vals,L.format))rows.push([m.label,m.value]);
    const two=S.twoInputs(guided),headers=two?['IN1','IN2','VIN1','VIN2','OUT','VOUT','ID (M1)']:['IN','VIN','OUT','VOUT','ID (M1)'];
    const truthRows=(vals.truth||[]).map(r=>two?[r.a,r.b,format(r.vin,'V'),format(r.vin2,'V'),r.level,format(r.out,'V'),format(r.current,'A')]:[r.a,format(r.vin,'V'),r.level,format(r.out,'V'),format(r.current,'A')]);
    return'<h2>Esperienza guidata · giornate 5–6</h2>'+tbl(['Grandezza del modello','Valore'],rows)+'<h3>Tabella di verità DC</h3>'+tbl(headers,truthRows);
   }
  }catch{}
  return'<h2>Esperienza guidata · giornate 5–6</h2>'+tbl(['Grandezza del modello','Valore'],rows);
 }
 function notebookSection(doc,tbl,format){
  const key=doc.mode==='free'?'free:free':'guided:'+doc.experiment,e=doc.notebookStudy?.entries?.[key];
  if(!e)return'';
  const labels={prediction:'Previsione',observation:'Osservazione',explanation:'Spiegazione dello scarto',note:'Note del banco'},notes=Object.entries(labels).filter(([k])=>e[k]?.trim());
  const readings=Array.isArray(e.readings)?e.readings:[];
  if(!notes.length&&!readings.length)return'';
  return'<h2>Quaderno dell’esperienza</h2>'+notes.map(([k,title])=>'<h3>'+esc(title)+'</h3><pre>'+esc(e[k])+'</pre>').join('')+(readings.length?'<h3>Letture annotate dal grafico</h3>'+tbl(['#','Analisi','Ascissa','Valori registrati','Data'],readings.map((r,i)=>[String(i+1),r.analysis,format(r.x,r.xUnit),(r.values||[]).map(v=>v.label+': '+format(v.value,v.unit)).join(' · '),r.date])):'');
 }
 function comparisonSection(doc,tbl,format){
  const prefix=(doc.mode==='free'?'free':doc.experiment)+':',entries=Object.entries(doc.comparisonStudy?.records||{}).filter(([k])=>k.startsWith(prefix));
  if(!entries.length)return'';
  const currentStamp=C.stamp(doc);
  return entries.map(([,ds])=>{
   const {points,format:{kind,xUnit,yUnit}}=D.parse(ds.raw,ds.format);
   const stale=Boolean(ds.modelStamp&&ds.modelStamp!==currentStamp);
   const headers=['Ascissa ('+xUnit+')','Misura ('+yUnit+')','u standard ('+yUnit+')','Fase (°)'];
   const rows=points.slice(0,200).map(p=>[
    format(p.x/D.X[xUnit]),format(p.y/D.Y[yUnit]),
    p.sigma===undefined?'—':format(p.sigma/D.Y[yUnit]),
    p.phase===undefined?'—':format(p.phase,'°')
   ]);
   return'<h2>Misure sperimentali · '+esc(ds.name||kind)+'</h2><p>Analisi: '+esc(kind)+' · '+points.length+' punti ('+esc(xUnit)+' / '+esc(yUnit)+')'+(ds.conditions?' · Condizioni: '+esc(ds.conditions):'')+(stale?' · <strong>Il circuito è cambiato dopo il salvataggio dei dati.</strong>':'')+'</p>'+
    (points.length>rows.length?'<p>La tabella mostra i primi '+rows.length+' punti. Il CSV contiene tutti i punti.</p>':'')+
    tbl(headers,rows)+'<details><summary>CSV originale importato</summary><pre>'+esc(ds.raw)+'</pre></details>';
  }).join('');
 }
 function assemblySection(doc,tbl,format){
  const key=doc.mode==='free'?'free:free':'guided:'+doc.experiment,rec=doc.assemblyStudy?.records?.[key];
  if(!rec)return'';
  const statusLabels={todo:'Da montare',mounted:'Montato',checked:'Controllato',review:'Da rivedere'};
  const items=Object.entries(rec.items||{}).filter(([,v])=>v&&(v.status!=='todo'||v.note?.trim()||v.measured));
  const checkedCount=Object.values(rec.checks||{}).filter(Boolean).length;
  if(!rec.note?.trim()&&!items.length&&!checkedCount)return'';
  return'<h2>Montaggio e controlli al banco</h2>'+(rec.note?.trim()?'<p><strong>Note di montaggio: </strong>'+esc(rec.note)+'</p>':'')+(items.length?tbl(['Elemento','Stato','Misura al banco','Riferimento','Nota'],items.map(([id,v])=>[id,statusLabels[v.status]||v.status,v.measured?format(v.measured.value,v.measured.unit):'—',v.measured&&Number.isFinite(v.measured.expected)?format(v.measured.expected,v.measured.unit):'—',v.note||'—'])):'');
 }
 function report(doc,{budget=null,simulation=null,plot=null,rcContext=null,date=new Date().toISOString()}={}){const d=doc.mode==='free'?doc:L.circuit(doc),tbl=(headers,rows)=>'<div class="table"><table><thead><tr>'+headers.map(v=>'<th>'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>',format=(v,u='')=>v===null||v===undefined?'non disponibile':L.format(v,u,6),studies=['rc','ac','opamp'].filter(k=>k==='opamp'?doc.opampStudy?.points:doc[k+'Study']?.dataset?.points),rc=rcResults(doc,rcContext);
  const guided=doc.mode==='free'?null:doc.circuits[L.CATALOG.find(c=>c.id===doc.experiment)?.type];
  const radiation=guided&&L.isRadiation(guided)?'<h2>Esperienza guidata · giornate 3–4</h2>'+tbl(['Riferimento nominale','Valore'],L.summary(guided).map(r=>[r.label,r.value]))+'<p>Le tensioni del transitorio sono assolute rispetto a GND. I picchi di linearità sono ΔV = Vmax − baseline campionata prima dell’impulso; massimo assoluto e baseline sono conservati separatamente. I valori iniziali dei componenti sono esempi modificabili; il modello operazionale è generico. Per riprodurre l’esperienza conserva il progetto JSON guidato.</p>'+(doc.analysis==='charge'?'<h3>Linearità rispetto alla carica iniettata</h3><p>Scansione di impulsi negativi isolati con ampiezza e offset del segnale corrente, fronti istantanei e ritardo 20 µs a offset nullo; con offset non nullo si attendono almeno 20 τpre. Qin = |Vin|·T/Rin è la carica aggiuntiva rispetto al riposo, con riferimento nominale a massa virtuale. Ogni picco è misurato rispetto al livello prima dell’impulso. Fit lineare non pesato dei punti simulati; residuo = picco − fit. Nessuna incertezza sperimentale assegnata.</p>'+tbl(['Parametro della scansione','Valore'],[['Durata minima',format(guided.chargeMin,'s')],['Durata massima',format(guided.chargeMax,'s')],['Numero impulsi',guided.chargePoints],['Escursione Vin',format(-L.radiation.pulseInput(guided).amplitude,'V')],['Offset di riposo',format(L.radiation.pulseInput(guided).low,'V')],['Rin',format(guided.Rin,'Ω')]])+'<p>Il CSV della prova conserva Qin_C, Vout_picco_V, T_s, baseline_V, fit_V e residuo_V. Le impostazioni del singolo transitorio riportate sotto descrivono il circuito di partenza; la scansione usa le condizioni dichiarate qui.</p>':''):'';
  const semiconductor=semiconductorSection(doc,guided,tbl,format),notebook=notebookSection(doc,tbl,format),comparison=comparisonSection(doc,tbl,format),assembly=assemblySection(doc,tbl,format);
  // Plot is a data URL produced by the UI from its own SVG; it cannot inject markup.
  if(plot!==null&&!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(plot))throw Error('Grafico del report non valido.');
  return'<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+esc(doc.name)+' · Relazione</title><style>body{max-width:1000px;margin:40px auto;padding:0 24px;color:#1d2b42;font:15px/1.55 system-ui}h1{font-size:32px}details{margin:14px 0}summary{cursor:pointer;color:#526985;font-weight:550}h2{margin-top:32px;font-size:21px}p,pre{overflow-wrap:anywhere}svg,img{max-width:100%;max-height:480px}.table{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:8px;border-bottom:1px solid #dbe1ed;text-align:left}pre{white-space:pre-wrap;background:#f4f6fb;padding:14px;font-size:12px}.note{color:#5c6e87}@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}</style><h1>'+esc(doc.name)+'</h1><p class="note">Circuit Lab · relazione locale · '+esc(date)+'<br>Il documento si stampa dal browser, anche come PDF. Nessuna risorsa esterna.</p><h2>Schema e connessioni</h2>'+schematic(doc)+'<p class="note">Rappresentazione per la relazione con terminali e reti espliciti; gli incroci non aggiungono connessioni.</p><details><summary>Componenti e impostazioni complete</summary>'+tbl(['Componente','Tipo','Parametri'],d.components.map(c=>[c.id,M.NAMES[c.type],JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k])=>!['x','y','rotation','id','type'].includes(k))))]))+'<h2>Analisi e metodo</h2><pre>'+esc(JSON.stringify(d.settings,null,2))+'</pre></details><details><summary>Ipotesi e limiti dei modelli</summary><p>Transitorio SDIRK2; AC linearizzata al punto DC. R/C/L ideali, U generico secondo il modello dichiarato. D/Q/M didattici a 27 °C, senza capacità intrinseche, rumore, breakdown o riscaldamento. I modelli didattici non certificano componenti reali. Le condizioni iniziali si riferiscono al transitorio; DC le esclude.</p></details>'+(simulation?'<details><summary>Dettagli del calcolo numerico</summary><pre>'+esc(JSON.stringify({kind:simulation.kind,method:simulation.method,count:simulation.count,numerics:simulation.numerics,energyBalance:simulation.energyBalance,warnings:simulation.warnings},null,2))+'</pre></details>':'<p>Nessun risultato di simulazione attuale allegato.</p>')+(plot?'<h2>Grafico della simulazione</h2><img alt="Grafico con assi e unità" src="'+plot+'">':'')+radiation+semiconductor+notebook+assembly+comparison+rcSection(rc,tbl,format)+(budget?'<h2>Bilancio metrologico</h2>'+tbl(['Grandezza','Valore','u punti','u comuni','u combinata'],budget.rows.map(r=>[r.name,format(r.value,r.unit),format(r.uStat,r.unit),format(r.uShared,r.unit),format(r.u,r.unit)]))+'<p>'+esc(budget.assumptions)+'</p><p>'+esc(budget.warnings.join(' '))+'</p>':'<h2>Misure</h2><p>Bilancio metrologico non calcolato.</p>')+(doc.metrologyStudy?.note?'<p><strong>Provenienza e ipotesi: </strong>'+esc(doc.metrologyStudy.note)+'</p>':'')+'<details><summary>Correzioni e ipotesi salvate</summary><pre>'+esc(JSON.stringify({bilancio:doc.metrologyStudy||null,variazioni:doc.parameterStudy||null},null,2))+'</pre></details>'+studies.map(k=>{const s=doc[k+'Study'],tab=studyTable(doc,k);return'<h2>Dati · '+esc(k)+'</h2><p>'+esc(s.name||s.dataset?.name||k)+' · '+tab.points.length+' punti · '+(tab.edited?'tabella modificata, originali nel JSON':'dati importati')+'</p><details><summary>Impostazioni dell’analisi salvate</summary><pre>'+esc(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([key])=>!['dataset','points','raw','originalPoints'].includes(key))),null,2))+'</pre></details>'+tbl(headings(k,tab.columns),tab.points.map(p=>tab.columns.map(key=>p[key])))+'<details><summary>Testo importato conservato</summary><pre>'+esc(s.raw||s.dataset?.raw||'')+'</pre></details>';}).join('')+'<h2>Riproducibilità e limiti</h2><p>Conserva il JSON insieme alla relazione e ai CSV: contiene circuito, impostazioni, unità, dati originali e modifiche. Le barre e i bilanci riportano incertezze standard (k=1), non un intervallo di confidenza automatico. Propagazioni locali: verificare linearità, identificabilità e completezza del modello. Tolleranza dei componenti, scarto del solutore e incertezza della misura sono quantità distinte.</p></html>';
 }
 function archive(doc,options={}){const files={'progetto.json':JSON.stringify(doc,null,2),'relazione.html':report(doc,options),'schema.svg':schematic(doc),'schema.tex':Latex.exportText(doc),'schema-circuitikz.tex':Latex.figure(doc),'LEGGIMI.txt':'Apri progetto.json in Circuit Lab. La relazione HTML si stampa anche offline. CSV in unità SI; u standard. Nessun comando è eseguito dall’archivio.\n'};for(const k of ['rc','ac','opamp'])try{const t=studyTable(doc,k);files['dati-'+k+'.csv']=R.csv([headings(k,t.columns),...t.points.map(p=>t.columns.map(key=>p[key]))]);}catch{}const prefix=(doc.mode==='free'?'free':doc.experiment)+':';for(const[key,ds]of Object.entries(doc.comparisonStudy?.records||{}))if(key.startsWith(prefix)&&typeof ds?.raw==='string'){const kind=(ds.format?.kind||key.split(':')[1]||'dati').replace(/[^A-Za-z0-9_-]/g,'');if(kind&&Object.keys(files).length<16)files['confronto-'+kind+'.csv']=ds.raw;}if(options.budget)files['bilancio.csv']=R.csv([['grandezza','valore','u_punti','u_comuni','u_combinata','unita'],...options.budget.rows.map(r=>[r.name,r.value,r.uStat,r.uShared,r.u,r.unit])]);const rc=rcResults(doc,options.rcContext);if(rc&&!rc.error){files['rc-misure.csv']=rcCSV(rc);files['rc-dati-residui.csv']=R.csv([['tempo_s','V_dati_V','uV_V','V_fit_V','residuo_fit_V'],...rc.points.map(p=>[p.x,p.y,p.uV,p.fit,p.residual])]);}if(options.netlist)files['circuito.cir']=options.netlist;return zip(files);}
 function gallery(storage,key='circuit-lab-gallery-v1'){const read=()=>{const raw=storage.getItem(key);if(!raw)return[];const a=JSON.parse(raw);if(!Array.isArray(a)||a.length>12)throw Error('Archivio locale non valido.');for(const e of a){if(!e||typeof e.id!=='string'||typeof e.name!=='string'||e.name.length>80||typeof e.date!=='string'||typeof e.text!=='string')throw Error('Voce archivio non valida.');const d=P.readJSON(e.text);d.mode==='free'?M.parse(e.text):L.parse(e.text);}return a;};const write=a=>{const text=JSON.stringify(a);if(enc.encode(text).length>3000000)throw Error('Archivio locale oltre 3 MB: esporta prima una copia ZIP.');storage.setItem(key,text);};return{read,add(text,name=null){const d=P.readJSON(text);d.mode==='free'?M.parse(text):L.parse(text);const a=read();if(a.length>=12)throw Error('Archivio pieno: al massimo 12 revisioni. Esporta una copia prima di eliminare voci.');const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);const label=(name||d.name||'Circuito').slice(0,80);d.name=label;text=JSON.stringify(d,null,2);a.unshift({id,name:label,date:new Date().toISOString(),text});write(a);return id;},rename(id,name){const a=read(),e=a.find(e=>e.id===id);if(!e)throw Error('Revisione non trovata.');e.name=name.trim().slice(0,80)||'Circuito';const doc=P.readJSON(e.text);doc.name=e.name;e.text=JSON.stringify(doc,null,2);write(a);},remove(id){const a=read();write(a.filter(e=>e.id!==id));}};}
 const b64chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 function toBase64Url(bytes){
  let out='';
  for(let i=0;i<bytes.length;i+=3){
   const a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0,n=(a<<16)|(b<<8)|c;
   out+=b64chars[(n>>18)&63]+b64chars[(n>>12)&63]+(i+1<bytes.length?b64chars[(n>>6)&63]:'')+(i+2<bytes.length?b64chars[n&63]:'');
  }
  return out;
 }
 function fromBase64Url(token){
  const out=[];
  for(let i=0;i<token.length;i+=4){
   const a=b64chars.indexOf(token[i]),b=b64chars.indexOf(token[i+1]),c=i+2<token.length?b64chars.indexOf(token[i+2]):-1,d=i+3<token.length?b64chars.indexOf(token[i+3]):-1;
   if(a<0||b<0||i+2<token.length&&c<0||i+3<token.length&&d<0)throw Error('Collegamento Circuit Lab danneggiato.');
   const n=(a<<18)|(b<<12)|((c<0?0:c)<<6)|(d<0?0:d);
   out.push((n>>16)&255);if(c>=0)out.push((n>>8)&255);if(d>=0)out.push(n&255);
  }
  return new Uint8Array(out);
 }
 function encodeShareHash(text){
  const raw=P.readJSON(text);let payload;
  if(raw.mode==='free'){
   const d=M.parse(text);
   payload={m:'f',n:d.name,c:d.components,w:d.wires,p:d.probes,s:d.settings,...(d.traces?.length?{t:d.traces}:{}),...(d.nodeLabels&&Object.keys(d.nodeLabels).length?{l:d.nodeLabels}:{}),...(d.benchSetup?{b:d.benchSetup}:{})};
  }else{
   const d=L.parse(text),entry=L.CATALOG.find(c=>c.id===d.experiment),type=entry.type,active=d.circuits[type],base=L.defaults(type),diff={};
   for(const[k,v]of Object.entries(active))if(JSON.stringify(v)!==JSON.stringify(base[k]))diff[k]=v;
   payload={m:'g',n:d.name,e:d.experiment,a:d.analysis,d:diff,...(d.guidedTrials?.[d.experiment]?{r:d.guidedTrials[d.experiment]}:{})};
  }
  const b64=toBase64Url(enc.encode(JSON.stringify(payload)));
  if(b64.length>16000)throw Error('Circuito troppo esteso per un link: usa Scarica copia JSON.');
  return'#clab='+b64;
 }
 function decodeShareHash(input){
  const str=String(input||''),idx=str.indexOf('clab=');if(idx<0)return null;
  const token=str.slice(idx+5).split(/[&#?]/)[0];
  if(!/^[A-Za-z0-9_-]{4,16000}$/.test(token)||token.length%4===1)throw Error('Collegamento Circuit Lab non valido.');
  let json;try{json=dec.decode(fromBase64Url(token));}catch{throw Error('Collegamento Circuit Lab danneggiato.');}
  const p=P.readJSON(json);
  if(p.m==='f'){
   const doc={application:'Circuit Lab',version:3,mode:'free',name:typeof p.n==='string'?p.n.slice(0,80):'Circuito condiviso',components:p.c,wires:p.w,probes:p.p,settings:p.s,...(p.t?{traces:p.t}:{}),...(p.l?{nodeLabels:p.l}:{}),...(p.b?{benchSetup:p.b}:{})};
   return M.serialize(M.parse(JSON.stringify(doc)));
  }
  if(p.m==='g'){
   const entry=L.CATALOG.find(c=>c.id===p.e);if(!entry)throw Error('Esperienza nel collegamento non riconosciuta.');
   if(p.d!==undefined&&(!p.d||typeof p.d!=='object'||Array.isArray(p.d)))throw Error('Parametri del collegamento non validi.');
   const circuit=L.normalizeTime({...L.defaults(entry.type),...(p.d||{}),type:entry.type});
   const doc={application:'Circuit Lab',version:2,name:typeof p.n==='string'?p.n.slice(0,80):'Il mio laboratorio',experiment:entry.id,analysis:p.a||L.analyses(circuit)[0][0],circuits:{[entry.type]:circuit},layouts:{},...(p.r?{guidedTrials:{[entry.id]:p.r}}:{})};
   return L.serialize(L.parse(JSON.stringify(doc)));
  }
  throw Error('Formato del collegamento non supportato.');
 }
 return{MAX_SESSION_ENTRIES,latex:Latex.exportText,latexFigure:Latex.figure,esc,crc32,archivePath,zip,unzip,zipSession:files=>zip(files,true),unzipSession:bytes=>unzip(bytes,true),projectFromArchive,studyTable,editStudy,validateProvenance,schematic,rcResults,report,archive,gallery,encodeShareHash,decodeShareHash};
});
