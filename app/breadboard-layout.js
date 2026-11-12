/* Physical mounting, independent from the simulated reference document and SVG geometry. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BreadboardLayout=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),columns=['L1','L2',...'abcdefghij','R1','R2'];
 const colors=['#28734d','#245cc5','#c33440','#a16c20','#8054bb','#253b48'];
 const short=h=>h.split(':')[1];
 function parse(hole){const m=/^M1:([a-j])(\d+)$/.exec(hole)||/^M1:([LR][12])\.(\d+)$/.exec(hole);return m?{col:m[1],row:Number(m[2])}:null;}
 const hole=(col,row)=>'M1:'+col+(/[a-j]/.test(col)?'':'.')+row;
 const railCount=rows=>rows===63?50:25;
 function holes(rows){return columns.flatMap(col=>Array.from({length:col.length===1?rows:railCount(rows)},(_,i)=>hole(col,i+1)));}
 function group(h,board={rows:30,splitRails:false}){const q=parse(h);if(!q)return null;return q.col.length===1?'strip:'+('abcde'.includes(q.col)?'L':'R')+q.row:'rail:'+q.col+(board.splitRails?':'+(q.row<=Math.floor(railCount(board.rows)/2)?'A':'B'):'');}
 function point(h){const q=parse(h),x={L1:30,L2:54,a:102,b:126,c:150,d:174,e:198,f:294,g:318,h:342,i:366,j:390,R1:438,R2:462};return{x:x[q.col],y:66+(q.row-1)*20};}
 function groups(board){const result=new Map();for(const h of holes(board.rows)){const key=group(h,board);if(!result.has(key))result.set(key,[]);result.get(key).push(h);}return[...result.values()];}
 const dipSize=kind=>({DIP8:8,DIP14:14}[kind]||0);
 const hasValue=kind=>['R','C','CP','L'].includes(kind);
 const endLabel=(kind,pin)=>kind==='D'?(pin==='a'?'Anodo':'Catodo'):kind==='CP'?(pin==='a'?'Positivo (+)':'Negativo (−)'):'Capo '+pin.toUpperCase();
 function dipHoles(row,rotation=0,size=8){
  const half=size/2,turned=rotation===180;
  return Object.fromEntries(Array.from({length:size},(_,i)=>{
   const left=i<half,offset=left?i:size-1-i;
   return [i+1,hole(left!==turned?'e':'f',row+(turned?half-1-offset:offset))];
  }));
 }
 function digest(v){const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);}
 function reference(model){
  const units=[],ports=[],netNames={},canonical=n=>{const net=model.nets.find(v=>v.index===n);const key=n===-1?'ground':typeof n==='string'&&n.startsWith('supply:')?'supply:'+(n.endsWith('+')?'positive':'negative')+':'+net.voltage:'node:'+n;netNames[key]=key==='ground'?'GND':key.startsWith('supply:')?(n.endsWith('+')?'V+':'V−')+' ('+net.voltage+' V)':net?.name||key;return key;};
  const oldGroup=h=>{const q=parse(h);return'M1:'+(q.col.length===1?'strip'+('abcde'.includes(q.col)?'L':'R')+q.row:q.col);};
  const netAt=h=>canonical(model.nets.find(n=>n.groups.includes(oldGroup(h)))?.index);
  for(const part of model.parts){
   if(part.type==='U'||part.type==='DIP14'){
    const id=part.packageId||part.id;if(units.some(u=>u.id===id))continue;
    const pins={};for(const pin of model.devicePins.filter(p=>p.packageId===id))pins[pin.number]={token:'pin:'+id+':'+pin.number,label:pin.component+' · pin '+pin.number+' ('+pin.name+')',node:canonical(pin.node)};
    const chipPins=model.devicePins.filter(p=>p.packageId===id);
    const owners=[...new Set(chipPins.map(p=>p.component))],isMos=part.type==='DIP14';
    const checkedPins=isMos?chipPins.filter(p=>p.schematicRef||[7,14].includes(p.number)).map(p=>p.number):undefined;
    units.push({id,kind:isMos?'DIP14':'DIP8',label:id+(isMos?' · CD4007UB':' · TL082')+(owners.length>1?' · '+owners.join(' + '):''),auxiliary:false,pins,holes:clone(part.physical),checkedPins});
   }else{
    const kind=part.polarized?'CP':part.type,polarized=['D','CP'].includes(kind);
    units.push({id:part.id,kind,label:part.auxiliary?part.id+' · bypass':part.id+(kind==='D'?' · 1N4148':kind==='CP'?' · Elettrolitico':''),value:hasValue(kind)?part.component.value:undefined,auxiliary:Boolean(part.auxiliary),ownerPackage:part.auxiliary?model.devicePins.find(p=>p.component===part.id.slice(0,part.id.lastIndexOf('.Cd')))?.packageId:undefined,pins:Object.fromEntries(Object.entries(part.holes).map(([pin,h])=>[pin,{token:'part:'+part.id+(polarized?':'+pin:''),label:part.id+' · '+(polarized?endLabel(kind,pin):pin.toUpperCase()),node:netAt(h)}])),holes:clone(part.holes)});
   }
  }
  function port(id,label,node,required,contactHoles){ports.push({id,label,node,required,holes:contactHoles});}
  for(const [i,source]of model.sources.entries())for(const pin of ['p','n']){const c=model.contacts.find(c=>c.ref===source.id+':'+pin);if(c)port('AFG'+(i+1)+':'+(pin==='p'?'signal':'ground'),'Generatore CH'+(i+1)+' · '+(pin==='p'?'segnale':'ritorno GND'),canonical(c.node),true,[c.hole]);}
  for(const [i,source] of (model.dcSources||[]).entries())for(const pin of ['p','n']){
   const contact=model.contacts.find(c=>c.ref===source.id+':'+pin);
   port('DC'+(i+1)+':'+(pin==='p'?'positive':'ground'),'Alimentatore · '+source.label+(pin==='n'?' · ritorno GND':''),canonical(contact.node),true,[contact.hole]);
   if(pin==='p')ports.at(-1).voltage=source.wave.level;
  }
  for(const [key,predicate,label]of [['positive',c=>c.kind==='supply'&&c.node.endsWith('+'),'V+'],['negative',c=>c.kind==='supply'&&c.node.endsWith('−'),'V−'],['ground',c=>c.kind==='supply-ground','GND']]){const contacts=model.contacts.filter(predicate);if(contacts.length){port('PSU:'+key,'Alimentatore · '+label,canonical(contacts[0].node),true,contacts.map(c=>c.hole));ports.at(-1).voltage=key==='ground'?0:model.nets.find(n=>n.index===contacts[0].node).voltage;}}
  if(model.topology?.ground&&!ports.some(p=>p.required&&p.node==='ground')){const contact=model.contacts.find(c=>c.node===-1);if(contact)port('PSU:ground','Riferimento GND','ground',true,[contact.hole]);}
  for(const ch of model.channels){port('OSC'+ch.id.slice(2)+':tip','Oscilloscopio '+ch.id+' · puntale',canonical(ch.node),false,[ch.hole]);if(ch.ground)port('OSC'+ch.id.slice(2)+':ground','Oscilloscopio '+ch.id+' · massa',canonical(-1),false,[ch.ground]);}
  const constant=w=>!w?undefined:w.kind==='dc'?w.level:['sine','square','triangle'].includes(w.kind)&&w.vpp===0?w.offset:['step','pulse'].includes(w.kind)&&w.level===(w.low??0)?w.level:w.kind==='pwl'&&w.points.every(p=>p[1]===w.points[0][1])?w.points[0][1]:undefined;
  const sourceVoltages=Object.fromEntries(model.sources.flatMap((s,i)=>{const value=constant(s.wave);return Number.isFinite(value)?[['AFG'+(i+1)+':signal',value*(s.wave.polarity??1)]]:[];}));
  const sourceWaves=Object.fromEntries(model.sources.map((source,i)=>['AFG'+(i+1)+':signal',source.wave]));
  const ref={units,ports,netNames,sourceVoltages,sourceWaves,experiment:model.experiment,rows:model.modules[0]?.rows||30,proposedWires:clone(model.wires||[])};
  ref.signature='physical-ref-v1-'+digest({units:units.map(({id,kind,value,pins})=>({id,kind,value,pins})),ports:ports.map(({id,node,required,voltage})=>({id,node,required,voltage})),sources:model.sources.map(s=>s.wave)});return ref;
 }
 function blank(ref,rows=ref.rows){return{version:1,rows,splitRails:false,referenceStamp:ref.signature,supply:{positive:ref.ports.find(p=>p.id==='PSU:positive')?.voltage??15,negative:ref.ports.find(p=>p.id==='PSU:negative')?.voltage??-15},parts:[],wires:[],leads:[]};}
 function proposed(ref){const board=blank(ref);board.parts=ref.units.map(u=>({id:u.id,kind:u.kind,holes:clone(u.holes),...(u.value===undefined?{}:{value:u.value})}));board.wires=ref.proposedWires.map(w=>({id:w.id,a:w.a,b:w.b,color:w.color}));let i=0;board.leads=ref.ports.flatMap(p=>p.holes.map(h=>({id:'L'+(++i),port:p.id,hole:h})));validate(board);return board;}
 function occupied(board,except=null){const used=new Map(),add=(h,kind,id)=>{if(!except||except.kind!==kind||except.id!==id)used.set(h,{kind,id});};for(const p of board.parts)for(const h of Object.values(p.holes))add(h,'part',p.id);for(const w of board.wires){add(w.a,'wire',w.id);add(w.b,'wire',w.id);}for(const l of board.leads)add(l.hole,'lead',l.id);return used;}
 function validate(board){
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_.+−-]{0,39}$/.test(v);
  if(!record(board)||board.version!==1||![30,63].includes(board.rows)||typeof board.splitRails!=='boolean'||!/^physical-ref-v1-[0-9a-f]{1,8}$/.test(board.referenceStamp)||!Array.isArray(board.parts)||board.parts.length>80||!Array.isArray(board.wires)||board.wires.length>240||!Array.isArray(board.leads)||board.leads.length>40)throw Error('Montaggio sulla breadboard non valido.');
  if(!record(board.supply)||!['positive','negative'].every(k=>Number.isFinite(board.supply[k])&&Math.abs(board.supply[k])<=1000))throw Error('Tensioni dell’alimentatore non valide.');
  const known=new Set(holes(board.rows)),used=new Map();function occupy(h,owner){if(!known.has(h))throw Error('Foro non presente su questa basetta: '+h);if(used.has(h))throw Error('Foro '+short(h)+' già occupato da '+used.get(h)+'. Usa un foro libero dello stesso contatto.');used.set(h,owner);}
  for(const list of [board.parts,board.wires,board.leads]){const ids=new Set();for(const v of list)if(!record(v)||!id(v.id)||ids.has(v.id))throw Error('Identificativo del montaggio non valido.');else ids.add(v.id);}
  for(const p of board.parts){
   const size=dipSize(p.kind);
   if(!size&&!hasValue(p.kind)&&p.kind!=='D'||!record(p.holes))throw Error('Componente fisico non supportato.');
   const expected=size?Object.keys(dipHoles(1,0,size)):['a','b'];
   if(Object.keys(p.holes).length!==expected.length||!expected.every(pin=>Object.hasOwn(p.holes,pin))||hasValue(p.kind)&&(!Number.isFinite(p.value)||p.value<=0||p.value>1e12))throw Error('Terminali o valore non validi per '+p.id+'.');
   for(const h of Object.values(p.holes))occupy(h,p.id);
   if(size){
    const row=Math.min(...Object.values(p.holes).map(h=>parse(h).row));
    if(![0,180].some(rotation=>Object.entries(dipHoles(row,rotation,size)).every(([pin,h])=>p.holes[pin]===h)))throw Error('L’integrato deve attraversare il canale centrale fra e e f.');
   }
  }
  for(const w of board.wires){if(w.a===w.b||!/^#[0-9a-fA-F]{6}$/.test(w.color))throw Error('Ponticello non valido.');occupy(w.a,w.id);occupy(w.b,w.id);}
  for(const l of board.leads){if(!/^(PSU:(positive|negative|ground)|DC[1-3]:(positive|ground)|AFG[12]:(signal|ground)|OSC[12]:(tip|ground))$/.test(l.port))throw Error('Collegamento dello strumento non valido.');occupy(l.hole,l.id);}
 }
 function edit(board,fn){const next=clone(board);fn(next);validate(next);return next;}
 function translate(board,item,toHole,anchorHole){const a=parse(anchorHole),z=parse(toHole),dc=columns.indexOf(z.col)-columns.indexOf(a.col),dr=z.row-a.row,shift=h=>{const q=parse(h);return hole(columns[columns.indexOf(q.col)+dc]||'?',q.row+dr);};return edit(board,next=>{if(item.kind==='lead'){next.leads.find(l=>l.id===item.id).hole=toHole;return;}if(item.kind==='wire'){const wire=next.wires.find(w=>w.id===item.id);wire.a=shift(wire.a);wire.b=shift(wire.b);return;}const part=next.parts.find(p=>p.id===item.id);if(!part)throw Error('Componente non disponibile.');if(dipSize(part.kind)){const row=Math.min(...Object.values(part.holes).map(h=>parse(h).row))+dr,rotation=parse(part.holes[1]).col==='e'?0:180;part.holes=dipHoles(row,rotation,dipSize(part.kind));}else part.holes=Object.fromEntries(Object.entries(part.holes).map(([pin,h])=>[pin,shift(h)]));});}
 function rotate(board,id){return edit(board,next=>{const p=next.parts.find(p=>p.id===id);if(dipSize(p.kind))p.holes=dipHoles(Math.min(...Object.values(p.holes).map(h=>parse(h).row)),parse(p.holes[1]).col==='e'?180:0,dipSize(p.kind));else[p.holes.a,p.holes.b]=[p.holes.b,p.holes.a];});}
 function remove(board,selection){return edit(board,next=>{const key={part:'parts',wire:'wires',lead:'leads'}[selection.kind];next[key]=next[key].filter(v=>v.id!==selection.id);});}
 function graph(board,withoutWire=null){const parent=new Map(),find=h=>{if(!parent.has(h))parent.set(h,h);if(parent.get(h)!==h)parent.set(h,find(parent.get(h)));return parent.get(h);},join=(a,b)=>{parent.set(find(a),find(b));};for(const g of groups(board))for(const h of g)join(g[0],h);for(const w of board.wires)if(w.id!==withoutWire)join(w.a,w.b);const ports=new Map();let ground=null;for(const l of board.leads){if(ports.has(l.port))join(ports.get(l.port),l.hole);else ports.set(l.port,l.hole);/* Bank instruments share their return, even without an explicit jumper. */if(l.port.endsWith(':ground')){if(ground)join(ground,l.hole);else ground=l.hole;}}return{find,ports};}
 const signature=tokens=>JSON.stringify([...tokens].sort()),contains=(all,subset)=>{const counts=new Map();for(const t of all)counts.set(t,(counts.get(t)||0)+1);for(const t of subset){const n=counts.get(t)||0;if(!n)return false;counts.set(t,n-1);}return true;};
 function compareReference(board,ref,{requiredOnly=false}={}){
  validate(board);const errors=[],suggestions=[],extras=[],net=graph(board),actual=new Map(),wanted=new Map(),present=new Set(board.parts.map(p=>p.id));
  const add=(map,key,t)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(t);};
  const diag=(code,title,text,items=[],points=[])=>({code,title,text,items,holes:[...new Set(points)]});
  if(!ref.units.length){errors.push(diag('no-reference','Manca il circuito di riferimento','Scegli o costruisci prima lo schema da riprodurre.'));}
  for(const unit of ref.units)if(!present.has(unit.id))errors.push(diag('missing-part','Manca '+unit.id,'Inserisci '+unit.label+' dalla lista dei componenti.',[{kind:'palette',id:unit.id}]));
  for(const part of board.parts){const u=ref.units.find(u=>u.id===part.id);if(!u){extras.push(part);continue;}if(u.kind!==part.kind){errors.push(diag('wrong-kind','Tipo errato per '+part.id,'È richiesto '+u.kind+'.',[{kind:'part',id:part.id}],Object.values(part.holes)));continue;}
   if(u.value!==undefined&&Math.abs(part.value-u.value)>Math.max(Math.abs(u.value),Math.abs(part.value))*1e-9)errors.push(diag('wrong-value','Valore di '+part.id+' diverso','Confronta il valore nominale inserito con quello richiesto: '+u.value+' '+({R:'Ω',C:'F',CP:'F',L:'H'}[u.kind]||'')+'.',[{kind:'part',id:part.id}],Object.values(part.holes)));
   for(const[pin,p]of Object.entries(u.pins)){const t={...p,hole:part.holes[pin],kind:'part',id:part.id};add(actual,net.find(t.hole),t);add(wanted,p.node,t);}
  }
  for(const port of ref.ports.filter(p=>!requiredOnly||p.required)){const leads=board.leads.filter(l=>l.port===port.id);if(!leads.length){if(port.required)errors.push(diag('missing-port','Manca '+port.label,'Seleziona il collegamento dello strumento e tocca il foro dove arriva il cavo.',[{kind:'port',id:port.id}]));continue;}if(port.id.startsWith('PSU:')&&port.voltage!==undefined&&port.id!=='PSU:ground'&&Math.abs(board.supply[port.id.split(':')[1]]-port.voltage)>1e-9)errors.push(diag('wrong-supply','Tensione errata · '+port.label,'Impostata '+board.supply[port.id.split(':')[1]]+' V; il riferimento richiede '+port.voltage+' V.',leads.map(l=>({kind:'lead',id:l.id})),leads.map(l=>l.hole)));const t={token:'port:'+port.id,label:port.label,node:port.node,hole:leads[0].hole,kind:'lead',id:leads[0].id};add(actual,net.find(t.hole),t);add(wanted,port.node,t);}
  for(const lead of board.leads)if(!ref.ports.some(p=>p.id===lead.port))errors.push(diag('extra-port','Alimentazione o strumento non previsto','Il collegamento '+lead.port+' non è presente nello schema selezionato.',[{kind:'lead',id:lead.id}],[lead.hole]));
  const unused=[];for(const part of extras){if(Object.values(part.holes).some(h=>actual.has(net.find(h))))errors.push(diag('extra-part','Componente non previsto: '+part.id,'Questo elemento è collegato al circuito ma non è presente nello schema di riferimento.',[{kind:'part',id:part.id}],Object.values(part.holes)));else unused.push(part);}
  const expected=[...wanted].map(([id,terms])=>({id,terms,tokens:terms.map(t=>t.token)})),remaining=expected.slice(),unmatched=[];
  for(const unit of ref.units.filter(u=>['D','CP'].includes(u.kind))){
   const part=board.parts.find(p=>p.id===unit.id&&p.kind===unit.kind);
   if(!part||unit.pins.a.node===unit.pins.b.node)continue;
   const atOppositeNode=(from,to)=>{
    const observed=actual.get(net.find(part.holes[from]))||[],other=unit.pins[to].node;
    const samePart=t=>t.kind==='part'&&t.id===part.id;
    const neighbours=observed.filter(t=>!samePart(t));
    return neighbours.length>0&&neighbours.every(t=>t.node===other);
   };
   if(atOppositeNode('a','b')&&atOppositeNode('b','a'))errors.push(diag('reversed-reference','Polarità scambiata · '+part.id,
    'Ancoraggi invertiti rispetto alla scheda. Verifica '+endLabel(part.kind,'a').toLowerCase()+' e '+endLabel(part.kind,'b').toLowerCase()+'.',[{kind:'part',id:part.id}],Object.values(part.holes)));
  }
  for(const [root,terms]of actual){const tokens=terms.map(t=>t.token),match=remaining.findIndex(n=>signature(n.tokens)===signature(tokens));if(match>=0)remaining.splice(match,1);else unmatched.push({root,terms,tokens});}
  for(const node of unmatched){if(expected.some(n=>contains(n.tokens,node.tokens)))continue;const wires=board.wires.filter(w=>net.find(w.a)===node.root),culprits=[];
   for(const w of wires){const separated=graph(board,w.id),left=node.terms.filter(t=>separated.find(t.hole)===separated.find(w.a)),right=node.terms.filter(t=>separated.find(t.hole)===separated.find(w.b));if(separated.find(w.a)!==separated.find(w.b)&&left.length&&right.length&&expected.some(n=>contains(n.tokens,left.map(t=>t.token)))&&expected.some(n=>contains(n.tokens,right.map(t=>t.token))))culprits.push(w);}
   const terms=node.terms.map(t=>t.label+' ('+short(t.hole)+')');errors.push(diag('short','Collegamento inatteso / corto',terms.join('; ')+'. Questi terminali non devono appartenere tutti alla stessa rete.'+(culprits.length?' Ricontrolla '+culprits.map(w=>w.id).join(', ')+'.':''),[...node.terms.map(t=>({kind:t.kind,id:t.id})),...(culprits.length?culprits:wires).map(w=>({kind:'wire',id:w.id}))],node.terms.map(t=>t.hole)));
  }
  for(const n of remaining){const candidates=unmatched.filter(a=>a.tokens.some(t=>n.tokens.includes(t))&&contains(n.tokens,a.tokens));if(candidates.length<2)continue;errors.push(diag('open','Collegamento mancante · '+ref.netNames[n.id],n.terms.map(t=>t.label).join('; ')+': devono condividere la stessa rete. Controlla i contatti interni e i ponticelli fra i punti evidenziati.',candidates.flatMap(a=>a.terms.map(t=>({kind:t.kind,id:t.id}))),candidates.flatMap(a=>a.terms.map(t=>t.hole))));}
  // Exact partition equivalence describes the reference only, including ambiguous passive ends.
  if(remaining.length&&!errors.some(e=>['open','short'].includes(e.code)))errors.push(diag('connections','Reti diverse dallo schema','Alcuni terminali appartengono a reti diverse. Ricontrolla i gruppi di fori evidenziati.',unmatched.flatMap(a=>a.terms.map(t=>({kind:t.kind,id:t.id}))),unmatched.flatMap(a=>a.terms.map(t=>t.hole))));
  if(!errors.length){
   for(const part of unused)suggestions.push(diag('unused-part','Elemento non utilizzato · '+part.id,'È separato dal circuito di riferimento. Puoi rimuoverlo per liberare spazio e rendere il montaggio più chiaro.',[{kind:'part',id:part.id}],Object.values(part.holes)));
   for(const w of board.wires){const g=graph(board,w.id),terms=[...actual.values()].flat(),left=terms.some(t=>g.find(t.hole)===g.find(w.a)),right=terms.some(t=>g.find(t.hole)===g.find(w.b));if(!left||!right)suggestions.push(diag('unused-wire','Ponticello '+w.id+' senza funzione','Almeno un’estremità non raggiunge componenti o strumenti del circuito. Puoi rimuoverlo per liberare spazio.',[{kind:'wire',id:w.id}],[w.a,w.b]));else if(g.find(w.a)===g.find(w.b))suggestions.push(diag('redundant-wire','Ponticello '+w.id+' ridondante','I due estremi restano collegati anche senza questo ponticello. Puoi rimuoverlo per rendere il montaggio più leggibile.',[{kind:'wire',id:w.id}],[w.a,w.b]));else if(Math.abs(parse(w.a).row-parse(w.b).row)>12)suggestions.push(diag('long-wire','Percorso lungo · '+w.id,'Il cavo attraversa più di 12 file. Se il montaggio reale lo permette, avvicina i componenti di questa rete e accorcia il collegamento.',[{kind:'wire',id:w.id}],[w.a,w.b]));}
   for(const lead of board.leads.filter(l=>/^OSC[12]:tip$/.test(l.port)))if(!board.leads.some(l=>l.port===lead.port.replace(':tip',':ground')))suggestions.push(diag('probe-ground','Completa la sonda '+lead.port.slice(0,4).replace('OSC','CH'),'Il puntale è inserito; aggiungi anche la clip di massa per rappresentare la misura completa.',[{kind:'port',id:lead.port.replace(':tip',':ground')},{kind:'lead',id:lead.id}],[lead.hole]));
   for(const unit of ref.units.filter(u=>u.auxiliary)){const c=board.parts.find(p=>p.id===unit.id),supply=Object.values(unit.pins).find(p=>p.node.startsWith('supply:')),chip=ref.units.find(u=>u.id===unit.ownerPackage),mounted=chip&&board.parts.find(p=>p.id===chip.id);if(c&&mounted&&Math.min(...Object.values(c.holes).flatMap(h=>Object.values(mounted.holes).map(z=>Math.abs(parse(h).row-parse(z).row))))>5)suggestions.push(diag('bypass-distance','Avvicina '+c.id+' all’integrato','Il condensatore di bypass è lontano dall’integrato: una disposizione più vicina ai pin di alimentazione riduce la lunghezza dei collegamenti.',[{kind:'part',id:c.id},{kind:'part',id:chip.id}],Object.values(c.holes)));}
  }
  const correct=errors.length===0;return{correct,status:correct?(suggestions.length?'improvable':'correct'):'incorrect',errors,suggestions,referenceChanged:board.referenceStamp!==ref.signature,counts:{parts:board.parts.length,wires:board.wires.length,leads:board.leads.length}};
 }
 function sourceBounds(wave){
  if(!wave)return null;
  let values;
  if(wave.kind==='dc')values=[wave.level];
  else if(['sine','square','triangle'].includes(wave.kind))values=[wave.offset-wave.vpp/2,wave.offset+wave.vpp/2];
  else if(['step','pulse'].includes(wave.kind))values=[wave.low??0,wave.level];
  else if(wave.kind==='pwl')values=wave.points.map(point=>point[1]);
  else return null;
  const scale=wave.polarity??1;
  return [Math.min(...values.map(v=>v*scale)),Math.max(...values.map(v=>v*scale))];
 }
 function criticalConnections(board,ref){
  const hasMos=ref.units.some(u=>u.kind==='DIP14');
  const units=ref.units.map(unit=>unit.checkedPins?{
   ...unit,pins:Object.fromEntries(unit.checkedPins.map(pin=>[pin,unit.pins[pin]]))
  }:unit);
  // Optional probe pins need not match, but their ground clips still join real nets.
  const faults=compareReference(board,{...ref,units},{requiredOnly:true}).errors;
  const codes=['missing-port','missing-part','wrong-kind',...(hasMos?['open','short','connections']:[])];
  return faults.filter(fault=>codes.includes(fault.code));
 }
 // Reference equivalence is useful information, never the gate for electrical faults.
 function check(board,ref){
  validate(board);const comparison=compareReference(board,ref),net=graph(board),errors=[],suggestions=[],terminals=new Map(),sources=[];
  const diag=(code,title,text,items=[],points=[])=>({code,title,text,items,holes:[...new Set(points)]});
  const item=t=>({kind:t.kind,id:t.id}),root=h=>net.find(h),add=t=>{const key=root(t.hole);if(!terminals.has(key))terminals.set(key,[]);terminals.get(key).push(t);};
  for(const p of board.parts)for(const [pin,h]of Object.entries(p.holes))add({kind:'part',id:p.id,pin,hole:h});
  for(const l of board.leads){add({kind:'lead',id:l.id,hole:l.hole});const ground=l.port.endsWith(':ground'),supply=l.port.startsWith('PSU:')&&!ground,dc=ref.sourceVoltages?.[l.port]??ref.ports.find(p=>p.id===l.port)?.voltage;if(ground||supply||l.port.startsWith('AFG')||/^DC[1-3]:positive$/.test(l.port))sources.push({...l,potential:ground?'dc:0':supply?'dc:'+board.supply[l.port.split(':')[1]]:Number.isFinite(dc)?'dc:'+dc:l.port});}
  const at=h=>terminals.get(root(h))||[],others=(h,id)=>at(h).some(t=>t.kind!=='part'||t.id!==id);
  const passives=board.parts.filter(p=>!dipSize(p.kind)),chips=board.parts.filter(p=>p.kind==='DIP8'),mosChips=board.parts.filter(p=>p.kind==='DIP14');
  const sections=chips.flatMap(chip=>[['1','2','3','A'],['7','6','5','B']].flatMap(([out,minus,plus,name])=>
   [out,minus,plus].some(pin=>at(chip.holes[pin]).some(t=>t.id!==chip.id||t.kind!=='part'||t.pin!==pin))?[{chip,out,minus,plus,name}]:[]));
  const driverPins=sections.map(({chip,out})=>({kind:'part',id:chip.id,hole:chip.holes[out],port:chip.id+' pin '+out,opampOutput:true}));
  const powerPins=chips.flatMap(chip=>['4','8'].map(pin=>({kind:'part',id:chip.id,hole:chip.holes[pin],port:chip.id+' pin '+pin,powerPin:true})));
  const conflicts=(a,b)=>a.potential!==b.potential;
  const conflictOnNet=(a,b)=>a.opampOutput||b.opampOutput||(!a.powerPin&&!b.powerPin&&conflicts(a,b));
  // A real short joins incompatible source outputs, not merely differently named nets.
  const driven=[...sources,...driverPins,...powerPins];
  for(const [r,terms]of terminals){
   const endpoints=driven.filter(s=>root(s.hole)===r),pairs=endpoints.flatMap((a,i)=>endpoints.slice(i+1).filter(b=>conflictOnNet(a,b)).map(b=>[a,b]));
   if(!pairs.length)continue;
   const outputs=[...new Set(pairs.flat())],wires=board.wires.filter(w=>root(w.a)===r);
   const culprits=wires.filter(w=>{const split=graph(board,w.id);return pairs.some(([a,b])=>split.find(a.hole)!==split.find(b.hole));});
   const message=outputs.some(s=>s.opampOutput)?'Un’uscita del TL082 è collegata direttamente a un’altra uscita, a massa o a un’alimentazione.':'Queste uscite sono collegate direttamente ma impongono tensioni diverse.';
   errors.push(diag('short','Corto fra uscite o alimentazioni',outputs.map(s=>s.port+' ('+short(s.hole)+')').join(', ')+'. '+message+(culprits.length?' Controlla '+culprits.map(w=>w.id).join(', ')+'.':''),[...terms.map(item),...(culprits.length?culprits:wires).map(w=>({kind:'wire',id:w.id}))],[...outputs.map(t=>t.hole),...culprits.flatMap(w=>[w.a,w.b])]));
  }
  // Reachability through the *actual* passive network. No expected node or part ID is used.
  const adjacency=new Map(),dcPaths=new Map();
  const edge=(links,a,b)=>{if(!links.has(a))links.set(a,new Set());if(!links.has(b))links.set(b,new Set());links.get(a).add(b);links.get(b).add(a);};
  for(const p of passives){
   const a=root(p.holes.a),b=root(p.holes.b);
   edge(adjacency,a,b);
   if(['R','L'].includes(p.kind))edge(dcPaths,a,b);
  }
  const reach=(start,blocked=new Set(),links=adjacency)=>{const seen=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++)for(const n of links.get(queue[i])||[])if(!seen.has(n)&&!blocked.has(n)){seen.add(n);queue.push(n);}return seen;};
  const signals=sources.filter(s=>/^AFG[12]:signal$/.test(s.port)),powered=new Set();
  for(const source of sources)for(const r of reach(root(source.hole)))powered.add(r);
  for(const signal of signals){const channel=signal.port.split(':')[0],returns=sources.filter(s=>s.port.endsWith(':ground')),seen=reach(root(signal.hole)),input=chips.some(p=>['2','3','5','6'].some(pin=>seen.has(root(p.holes[pin]))))||mosChips.some(p=>['3','6','10'].some(pin=>seen.has(root(p.holes[pin]))));
   if(!returns.length)errors.push(diag('missing-return','Manca il ritorno del '+channel,'Collega il ritorno GND del generatore: il solo cavo del segnale non completa il collegamento.',[{kind:'port',id:channel+':ground'}],[signal.hole]));
   else if(!returns.some(s=>seen.has(root(s.hole)))&&!input)errors.push(diag('open','Percorso del segnale interrotto · '+channel,'Il segnale non raggiunge né un percorso di ritorno attraverso i componenti né un ingresso dell’integrato. Controlla i capi liberi e i ponticelli.',passives.filter(p=>seen.has(root(p.holes.a))||seen.has(root(p.holes.b))).map(p=>({kind:'part',id:p.id})),[signal.hole,...passives.flatMap(p=>[p.holes.a,p.holes.b]).filter(h=>seen.has(root(h)))]));
  }
  const supplied=h=>{const all=sources.filter(s=>root(s.hole)===root(h));return all.some(s=>s.potential.startsWith('dc:'))?Number(all.find(s=>s.potential.startsWith('dc:')).potential.slice(3)):null;};
  if(!signals.length&&chips.length===0&&mosChips.length===0){const dc=sources.filter(s=>s.potential.startsWith('dc:')),closed=dc.some(s=>dc.some(t=>conflicts(s,t)&&reach(root(s.hole)).has(root(t.hole))));if(dc.some(s=>s.potential!=='dc:0')&&!closed)errors.push(diag('open','Percorso dell’alimentazione interrotto','Nessun ramo dei componenti chiude il percorso fra due potenziali diversi dell’alimentatore. Controlla il ritorno e i capi liberi.',passives.map(p=>({kind:'part',id:p.id})),passives.flatMap(p=>Object.values(p.holes))));}
  for(const p of chips){const used=Object.values(p.holes).some(h=>others(h,p.id));if(!used){suggestions.push(diag('unused-part','Integrato non collegato · '+p.id,'È separato dal circuito. Puoi rimuoverlo o completarne i collegamenti.',[{kind:'part',id:p.id}],Object.values(p.holes)));continue;}
   const high=supplied(p.holes[8]),low=supplied(p.holes[4]);
   if(high===null||low===null)errors.push(diag('missing-power','Alimentazione incompleta · '+p.id,'Il TL082 richiede una tensione continua ai pin 8 (V+) e 4 (V−). Controlla anche eventuali interruzioni delle barre.',[{kind:'part',id:p.id}],[p.holes[8],p.holes[4]]));
   else if(high<=low)errors.push(diag('reversed-power','Alimentazione invertita o nulla · '+p.id,'Il potenziale al pin 8 deve essere maggiore di quello al pin 4. Attualmente: '+high+' V e '+low+' V.',[{kind:'part',id:p.id}],[p.holes[8],p.holes[4]]));
  }
  for(const p of mosChips){
   const high=supplied(p.holes[14]),low=supplied(p.holes[7]);
   const pins=[p.holes[14],p.holes[7]],item=[{kind:'part',id:p.id}];
   if(high===null||low===null)errors.push(diag('missing-power','Riferimenti del CD4007UB incompleti','Controlla VDD al pin 14 e VSS al pin 7, comuni ai body dei MOSFET.',item,pins));
   else if(high<=low)errors.push(diag('reversed-power','Alimentazione del CD4007UB invertita o nulla','VDD al pin 14 deve essere maggiore di VSS al pin 7.',item,pins));
   else if(high-low>20)errors.push(diag('supply-limit','Limite di alimentazione del CD4007UB superato','VDD − VSS supera il massimo assoluto di 20 V.',item,pins));
   else if(high-low<3||high-low>18)suggestions.push(diag('supply-range','Alimentazione fuori dall’intervallo raccomandato','Per il CD4007UB il produttore raccomanda 3–18 V fra i pin 14 e 7.',item,pins));
   for(const pin of [3,6,10]){
    const gate=p.holes[pin],node=root(gate),reachable=reach(node,new Set(),dcPaths);
    const direct=sources.filter(s=>root(s.hole)===node);
    const upstream=sources.filter(s=>reachable.has(root(s.hole)));
    if(!upstream.length){
     errors.push(diag('floating-input','Gate del CD4007UB senza riferimento DC','Il pin '+pin+' richiede una sorgente o un percorso di polarizzazione in continua. Un condensatore in serie lascia il gate flottante.',item,[gate]));
     continue;
    }
    if(high===null||low===null||high<=low)continue;
    const drive=direct.length?direct:upstream;
    const ranges=drive.map(s=>s.potential.startsWith('dc:')?[Number(s.potential.slice(3)),Number(s.potential.slice(3))]:sourceBounds(ref.sourceWaves?.[s.port]));
    // With several distinct resistive sources the exact gate voltage depends on the divider.
    if(!ranges[0]||ranges.some(range=>!range||range[0]!==ranges[0][0]||range[1]!==ranges[0][1]))continue;
    const [min,max]=ranges[0];
    if(min<low-.5-1e-9||max>high+.5+1e-9)errors.push(diag('gate-voltage-limit','Limite di tensione al gate superato',
     'Pin '+pin+': segnale '+min+'…'+max+' V; limiti assoluti '+(low-.5)+'…'+(high+.5)+' V rispetto allo stesso riferimento.',[...item,...drive.map(s=>({kind:'lead',id:s.id}))],[gate,...drive.map(s=>s.hole)]));
   }
  }
  for(const p of passives.filter(p=>p.kind==='CP')){
   const positive=supplied(p.holes.a),negative=supplied(p.holes.b);
   if(positive!==null&&negative!==null&&positive<negative)errors.push(diag('reversed-capacitor','Polarità invertita · '+p.id,'Il terminale positivo è a potenziale inferiore al negativo.',[{kind:'part',id:p.id}],Object.values(p.holes)));
  }
  for(const fault of comparison.errors.filter(d=>d.code==='reversed-reference')){
   const part=board.parts.find(p=>p.id===fault.items[0].id);
   if(part.kind==='CP'&&!errors.some(d=>d.code==='reversed-capacitor'&&d.items.some(i=>i.id===part.id)))errors.push(fault);
   if(part.kind==='D')suggestions.push(fault);
  }
  const fixedNodes=new Set([...sources,...powerPins].map(s=>root(s.hole)));
  const referenceChips=new Map(ref.units.filter(u=>u.kind==='DIP8').map(u=>[u.id,u]));
  for(const {chip,out,minus,plus,name}of sections){
   const {id,holes}=chip,output=root(holes[out]),negative=root(holes[minus]);
   for(const pin of [minus,plus])if(at(holes[pin]).length===1)errors.push(diag('floating-input','Ingresso non collegato · '+id+' '+name,'Il pin '+pin+' dell’operazionale in uso è lasciato flottante. Collegalo alla rete prevista dal tuo circuito.',[{kind:'part',id}],[holes[pin]]));
   if(output===root(holes[plus])&&output!==negative)suggestions.push(diag('positive-feedback','Controlla la retroazione · '+id+' '+name,'L’uscita è collegata direttamente all’ingresso +. Può essere intenzionale per un comparatore. Per un amplificatore lineare verifica la retroazione negativa.',[{kind:'part',id}],[holes[out],holes[plus]]));
   const pins=referenceChips.get(id)?.pins;
   if(!pins)continue;
   const expectedOutput=pins[out].node,expectedNegative=pins[minus].node;
   const expectsFeedback=expectedOutput===expectedNegative||ref.units.some(u=>u.pins.a&&u.pins.b&&[u.pins.a.node,u.pins.b.node].includes(expectedOutput)&&[u.pins.a.node,u.pins.b.node].includes(expectedNegative));
   if(expectsFeedback&&!reach(output,fixedNodes).has(negative))suggestions.push(diag('missing-feedback','Controlla il ramo di retroazione · '+id+' '+name,'Lo schema della prova collega l’uscita all’ingresso − tramite un ramo di retroazione. Controlla il percorso tra i due pin.',[{kind:'part',id}],[holes[out],holes[minus]]));
  }
  if(board.parts.length&&!signals.length&&!sources.some(s=>/^(PSU|DC[1-3]):/.test(s.port)&&!s.port.endsWith(':ground')))errors.push(diag('missing-source','Montaggio senza alimentazione o segnale','Collega il generatore o l’alimentatore per completare il circuito.',ref.ports.filter(p=>p.required&&!p.id.endsWith(':ground')).map(p=>({kind:'port',id:p.id}))));
  if(!board.parts.length)errors.push(diag('missing-circuit','Montaggio da costruire','Inserisci i componenti del tuo circuito prima di verificarlo.'));
  for(const p of passives){const connected=Object.values(p.holes).some(h=>powered.has(root(h))),bypassed=root(p.holes.a)===root(p.holes.b),floating=Object.values(p.holes).filter(h=>at(h).length===1);
   if(!connected)suggestions.push(diag('unused-part','Elemento separato dal circuito · '+p.id,'Non raggiunge i collegamenti degli strumenti. Puoi rimuoverlo oppure collegarlo se deve essere utilizzato.',[{kind:'part',id:p.id}],Object.values(p.holes)));
   else if(bypassed)suggestions.push(diag('bypassed-part','Componente bypassato · '+p.id,'I due capi appartengono alla stessa rete: questo componente non ha effetto. Verifica che il ponte sia intenzionale.',[{kind:'part',id:p.id}],Object.values(p.holes)));
   else if(floating.length)suggestions.push(diag('dangling-part','Capo libero · '+p.id,'Il ramo termina in un capo non collegato e non contribuisce al percorso del segnale. Controlla se è intenzionale.',[{kind:'part',id:p.id}],floating));
  }
  for(const w of board.wires){const g=graph(board,w.id),terms=[...terminals.values()].flat(),left=terms.some(t=>g.find(t.hole)===g.find(w.a)),right=terms.some(t=>g.find(t.hole)===g.find(w.b));if(!left||!right)suggestions.push(diag('unused-wire','Ponticello '+w.id+' senza funzione','Almeno un’estremità non raggiunge componenti o strumenti. Puoi rimuoverlo per liberare spazio.',[{kind:'wire',id:w.id}],[w.a,w.b]));else if(g.find(w.a)===g.find(w.b))suggestions.push(diag('redundant-wire','Ponticello '+w.id+' ridondante','I due estremi restano collegati anche senza questo ponticello. Puoi rimuoverlo per rendere il montaggio più leggibile.',[{kind:'wire',id:w.id}],[w.a,w.b]));else if(Math.abs(parse(w.a).row-parse(w.b).row)>12)suggestions.push(diag('long-wire','Percorso lungo · '+w.id,'Se il montaggio reale lo permette, avvicina i componenti e accorcia il collegamento.',[{kind:'wire',id:w.id}],[w.a,w.b]));}
  for(const d of comparison.suggestions.filter(d=>['probe-ground','bypass-distance'].includes(d.code)))suggestions.push(d);
  const requiredFaults=ref.experiment&&comparison.errors.length?criticalConnections(board,ref):[];
  errors.push(...requiredFaults.filter(fault=>fault.code!=='short'||!errors.some(e=>e.code==='short'&&e.holes.some(h=>fault.holes.includes(h)))));
  const differences=[],changes=comparison.errors.filter(fault=>!requiredFaults.some(required=>required.code===fault.code&&required.title===fault.title));
  for(const [codes,title,text]of [
   [['missing-part','wrong-kind','extra-part'],'Componenti diversi dallo schema','La scelta dei componenti differisce dal riferimento. Sono verificati gli elementi presenti sul tuo montaggio.'],
   [['wrong-value'],'Valori diversi dallo schema','I valori nominali dichiarati sono diversi. Questo può cambiare la risposta del circuito e non costituisce da solo un guasto.'],
   [['wrong-supply'],'Tensioni diverse dallo schema','La tensione impostata differisce dal riferimento. Il controllo dell’alimentazione usa i collegamenti e le tensioni attuali.'],
   [['short','open','connections','missing-port','extra-port'],'Collegamenti diversi dallo schema','Il cablaggio differisce dal riferimento. Una rete diversa non è automaticamente un corto o un collegamento errato.']
  ]){const group=changes.filter(d=>codes.includes(d.code));if(group.length)differences.push(diag('reference-difference',title,text,group.flatMap(d=>d.items),group.flatMap(d=>d.holes)));}
  const correct=errors.length===0;return{correct,equivalent:comparison.correct,status:correct?(suggestions.length?'improvable':'correct'):'incorrect',errors,suggestions,differences,referenceChanged:comparison.referenceChanged,counts:comparison.counts};
 }
 return{clone,columns,colors,short,parse,hole,railCount,holes,group,groups,point,dipHoles,dipSize,hasValue,endLabel,reference,blank,proposed,occupied,validate,edit,translate,rotate,remove,graph,compareReference,check};
});
