/* Days 3–4: ordinary electrical networks, shared by guided and free modes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./bench-model.js'));else root.RadiationModel=factory(root.FreeModel,root.BenchModel);})(typeof globalThis!=='undefined'?globalThis:this,function(F,B){
 'use strict';
 const TYPES=['preamp','shaper','shaper-buffer','preamp-shaper','pz-shaper','noninverting','detector-chain'];
 const is=p=>TYPES.includes(typeof p==='string'?p:p?.type),hasPre=p=>['preamp','preamp-shaper','pz-shaper','detector-chain'].includes(p.type),hasSh=p=>['shaper','shaper-buffer','preamp-shaper','pz-shaper','detector-chain'].includes(p.type),hasFinal=p=>['noninverting','detector-chain'].includes(p.type);
 const CATALOG=[
  {id:'preamp',type:'preamp',day:3,step:'1.1–1.4',name:'Preamplificatore di carica',short:'Q/C',page:'1–3',description:'Impulsi di corrente, integrazione, scarica, linearità e risposta in frequenza.'},
  {id:'shaper',type:'shaper',day:3,step:'2.1–2.2',name:'Shaper CR–RC',short:'CR',page:'3–4',description:'Formatore CR–RC con buffer intermedio: impulso e risposta in frequenza.'},
  {id:'shaper-buffer',type:'shaper-buffer',day:3,step:'2.opt',name:'Shaper · buffer di uscita',short:'B',page:'4',description:'Prova facoltativa: confronta il carico degli strumenti con e senza buffer finale.'},
  {id:'preamp-shaper',type:'preamp-shaper',day:4,step:'2.3a',name:'Preamp + shaper · undershoot',short:'∪',page:'5',description:'Collega il preamplificatore al formatore e osserva il ritorno sotto la baseline.'},
  {id:'pz-shaper',type:'pz-shaper',day:4,step:'2.3–2.4',name:'Shaper compensato · polo-zero',short:'PZ',page:'5–6',description:'Preamp e formatore con Rpz in parallelo a Csh1. Confronta compensazione e shaping time.'},
  {id:'noninverting',type:'noninverting',day:4,step:'3.1',name:'Amplificatore non invertente',short:'+A',page:'6',description:'Stadio finale con o senza bias DC per adattare il segnale al range della DAQ.'},
  {id:'detector-chain',type:'detector-chain',day:4,step:'3.1–3.3',name:'Catena elettronica completa',short:'→',page:'6–7',description:'Generatore, preamplificatore, shaper compensato e amplificatore finale.'}
 ];
 const PRESETS={
  preamp:[['pulse','Impulso −1 V · 5 µs · 200 Hz'],['short','Carica ridotta · 2 µs'],['long','Carica maggiore · 10 µs'],['linearity','Linearità · Vmax rispetto a Qin'],['bode','Bode · 10 Hz–1 MHz']],
  shaper:[['step','Gradino 0–1 V · 100 Hz'],['bode','Bode · 50 Hz–2 MHz'],['direct','Carico oscilloscopio · cavi diretti'],['probe','Carico oscilloscopio · sonde ×10']],
  'shaper-buffer':[['step','Gradino · buffer finale attivo'],['unbuffered','Confronto · senza buffer finale'],['bode','Bode · buffer finale'],['direct','Buffer finale · cavi diretti']],
  'preamp-shaper':[['pulse','Impulso 5 µs · osserva undershoot'],['long','Impulso 10 µs'],['bode','Bode · preamp e shaper']],
  'pz-shaper':[['compensated','Rpz calcolata · compensazione'],['uncompensated','Confronto · senza Rpz'],['under','Rpz dimezzata'],['over','Rpz raddoppiata'],['fast','Shaping rapido · Rsh = 1,5 kΩ'],['bode','Bode · shaper compensato']],
  noninverting:[['simple','Senza bias · obiettivo 0–3 V'],['bias','Con bias · obiettivo −0,9…+0,9 V'],['saturation','Ingresso elevato · saturazione'],['vtc','VTC · ampiezza di ingresso'],['bode','Bode · amplificatore finale']],
  'detector-chain':[['pulse','Catena completa · impulso 5 µs'],['simple','Senza bias · calibra a 3 V con T = 10 µs'],['bias','Con bias · calibra a 1,8 V con T = 10 µs'],['short','Impulso breve · 0,5 µs'],['linearity','Linearità · Qin da T = 0,5–12 µs'],['fast','Shaping rapido · Rsh = 1,5 kΩ'],['bode','Bode e banda · 10 Hz–1 MHz']]
 };
 function defaults(type,base){
  const p={...F.clone(base),type,Rin:1e5,Rfpre:1e6,Cfpre:200e-12,Rsh1:1e4,Rsh2:1e4,Csh1:2.2e-9,Csh2:2.2e-9,Rpz:1e6*200e-12/2.2e-9,Ri:1e4,Rgain:190e3,Rbias:1e6,pzEnabled:['pz-shaper','detector-chain'].includes(type),outputBuffer:type==='shaper-buffer',biasEnabled:false,initial:0,chargeMin:2e-6,chargeMax:10e-6,chargePoints:9,
   wave1:{kind:'pulse',level:-1,low:0,width:5e-6,delay:20e-6,rise:0,fall:0,period:.005,vpp:1,frequency:200,offset:0,phase:0,duty:50},
   wave2:{kind:'dc',level:5,low:0,width:5e-6,delay:0,vpp:0,frequency:200,offset:0,phase:0,duty:50}};
  if(['shaper','shaper-buffer'].includes(type))Object.assign(p.wave1,{kind:'square',vpp:1,offset:.5,frequency:100,phase:0});
  if(type==='noninverting')Object.assign(p.wave1,{level:.15,width:100e-6});
  if(type==='detector-chain')Object.assign(p,{chargeMin:.5e-6,chargeMax:12e-6,chargePoints:13});
  return normalizeTime(p);
 }
 function normalizeTime(p){p=F.clone(p);if(p.autoTime){const w=p.wave1;p.duration=['shaper','shaper-buffer'].includes(p.type)&&w.kind==='square'?Math.min(2/w.frequency,16*Math.max(p.Rsh1*p.Csh1,p.Rsh2*p.Csh2)):w.kind==='pulse'?Math.max(w.delay+w.width+(p.type==='preamp'?8*p.Rfpre*p.Cfpre:hasSh(p)?14*Math.max(p.Rsh1*p.Csh1,p.Rsh2*p.Csh2):4*w.width),w.delay+2*w.width):2/w.frequency;}return p;}
 function fields(p){return[
  ...(hasPre(p)?[['Rin','Resistenza d’ingresso Rin','res'],['Rfpre','Feedback Rf_pre','res'],['Cfpre','Feedback Cf_pre','cap']]:[]),
  ...(hasSh(p)?[['Csh1','Capacità CR · Csh1','cap'],['Rsh1','Resistenza CR · Rsh1','res'],['Rsh2','Resistenza RC · Rsh2','res'],['Csh2','Capacità RC · Csh2','cap']]:[]),
  ...(['pz-shaper','detector-chain'].includes(p.type)&&p.pzEnabled?[['Rpz','Compensazione Rpz','res']]:[]),
  ...(hasFinal(p)?[['Ri','Resistenza verso massa Ri','res'],['Rgain','Feedback amplificatore Rgain','res'],...(p.biasEnabled?[['Rbias','Resistenza di bias Rbias','res']]:[])]:[])
 ];}
 function validate(p){const errors={};
  for(const[key,,unit]of fields(p))if(!Number.isFinite(p[key])||p[key]<(unit==='cap'?1e-14:.01)||p[key]>(unit==='cap'?1:1e10))errors[key]='Valore fuori dall’intervallo del componente.';
  for(const key of ['pzEnabled','outputBuffer','biasEnabled'])if(typeof p[key]!=='boolean')errors[key]='Configurazione del circuito non valida.';
  for(const key of ['chargeMin','chargeMax'])if(!Number.isFinite(p[key])||p[key]<=0||p[key]>1)errors[key]='Durata dell’impulso non valida.';
  if(p.chargeMax<=p.chargeMin)errors.chargeMax='La durata massima deve superare la minima.';
  if(!Number.isInteger(p.chargePoints)||p.chargePoints<3||p.chargePoints>25)errors.chargePoints='Scegli da 3 a 25 impulsi.';
  if(p.wave1?.kind==='pulse'&&p.chargeMax>=p.wave1.period)errors.chargeMax='La durata massima deve essere inferiore al periodo.';
  for(const [i,w]of [[1,p.wave1],[2,p.wave2]]){
   if(!w||!['pulse','sine','square','triangle','dc','ground'].includes(w.kind)){errors['wave'+i]='Segnale non valido.';continue;}
   if(w.kind==='pulse'){for(const key of ['width','delay','low','level','rise','fall','period'])if(!Number.isFinite(w[key]))errors['wave'+i+'.'+key]='Inserisci un numero valido.';
    if(w.width<=0||w.width>100)errors['wave'+i+'.width']='Durata maggiore di zero e al massimo 100 s.';
    if(w.delay<0||w.delay>100)errors['wave'+i+'.delay']='Ritardo tra 0 e 100 s.';
    if(w.rise<0||w.fall<0||w.period<=0||w.period>100||w.width+w.rise+w.fall>w.period)errors['wave'+i+'.period']='Il periodo deve contenere impulso e fronti.';
    if(Math.abs(w.low)>1000)errors['wave'+i+'.low']='Tensione ammessa: ±1000 V.';
   }
  }return errors;
 }
 function network(p){
  const d=F.blank();d.name=CATALOG.find(c=>c.type===p.type).name;
  const add=(type,id,x,y,value,rotation=0)=>{const c=F.component(type,id,x,y);if(value!==undefined)c.value=value;c.rotation=rotation;d.components.push(c);return c;},link=(a,b)=>{
   const wire={id:'W'+(d.wires.length+1),a,b};
   // A follower's feedback must pass above the triangle, where it stays visible.
   if(a.endsWith(':minus')&&b===a.replace(':minus',':out'))Object.assign(wire,{route:'vertical',offset:-90});
   d.wires.push(wire);
  };
  const ground=(pin,x,y)=>{const id='G'+(d.components.filter(c=>c.type==='G').length+1);add('G',id,x,y);link(pin,id+':g');};
  const amp=(id,x,y)=>{const u=add('U',id,x,y);Object.assign(u,{model:p.opamp,a0:p.a0,gbw:p.gbw,rail:p.rail,headroom:p.headroom,...(p.opamp==='physical'?F.physical(p):{})});return u;};
  const source=add('V','V1',110,300);source.wave={...source.wave,...F.clone(p.wave1)};if(source.wave.kind==='square'&&source.wave.phase===0){const w=source.wave;Object.assign(w,{kind:'pulse',level:w.offset+w.vpp/2,low:w.offset-w.vpp/2,delay:0,width:w.duty/100/w.frequency,period:1/w.frequency,rise:0,fall:0,dc:w.offset});}if(source.wave.kind==='ground')Object.assign(source.wave,{kind:'dc',level:0});ground('V1:n',110,440);
  let input='V1:p',x=110;
  if(hasPre(p)){
   add('R','Rin',330,200,p.Rin);amp('Upre',650,300);add('R','Rfpre',650,100,p.Rfpre);add('C','Cfpre',650,-15,p.Cfpre);ground('Upre:plus',540,440);
   for(const[a,b]of [[input,'Rin:a'],['Rin:b','Upre:minus'],['Upre:minus','Rfpre:a'],['Rfpre:b','Upre:out'],['Rfpre:a','Cfpre:a'],['Cfpre:b','Rfpre:b']])link(a,b);
   input='Upre:out';x=780;
  }
  if(hasSh(p)){
   add('C','Csh1',x+180,300,p.Csh1);add('R','Rsh1',x+350,420,p.Rsh1,90);amp('Ubuf',x+550,275);add('R','Rsh2',x+780,275,p.Rsh2);add('C','Csh2',x+950,420,p.Csh2,90);
   for(const[a,b]of [[input,'Csh1:a'],['Csh1:b','Rsh1:a'],['Rsh1:a','Ubuf:plus'],['Ubuf:minus','Ubuf:out'],['Ubuf:out','Rsh2:a'],['Rsh2:b','Csh2:a']])link(a,b);
   ground('Rsh1:b',x+350,540);ground('Csh2:b',x+950,540);
   if(p.pzEnabled){add('R','Rpz',x+180,160,p.Rpz);link('Csh1:a','Rpz:a');link('Rpz:b','Csh1:b');}
   input='Csh2:a';x+=1100;
   if(p.outputBuffer){amp('Uout',x+80,250);link(input,'Uout:plus');link('Uout:minus','Uout:out');input='Uout:out';x+=250;}
  }
  if(hasFinal(p)){
   const ax=x+400; amp('Ufinal',ax,275);add('R','Rgain',ax,110,p.Rgain);add('R','Ri',ax-190,420,p.Ri,90);
   link(input,'Ufinal:plus');link('Ufinal:minus','Rgain:a');link('Rgain:b','Ufinal:out');link('Ufinal:minus','Ri:a');ground('Ri:b',ax-190,540);
   if(p.biasEnabled){const v=add('V','Vbias',ax-410,650);v.wave={...v.wave,...F.clone(p.wave2),kind:'dc'};add('R','Rbias',ax-190,650,p.Rbias);link('Vbias:p','Rbias:a');link('Rbias:b','Ufinal:minus');ground('Vbias:n',ax-410,770);}
   input='Ufinal:out';
  }
  d.probes={input:'V1:p',output:input};
  d.nodeLabels={'V1:p':'IN',[input]:'OUT',...(hasPre(p)&&input!=='Upre:out'?{'Upre:out':'PRE'}:{}),...(hasSh(p)&&input!=='Csh2:a'?{'Csh2:a':'SHAPER'}:{})};
  Object.assign(d.settings,{duration:p.duration,samples:p.samples,fmin:p.fmin,fmax:p.fmax,acSource:'V1',acReference:'source',integration:'adaptive',rtol:1e-5});
  const b=B.config(p.bench);b.sourceIds=['V1'];return B.apply(d,b);
 }
 function simulate(p,options={}){const d=network(p),result=F.simulate(d,options);options.capture?.(result);const t=F.topology(d),read=(row,pin)=>{const n=t.nodes[pin];return n<0?0:row.values[t.groups.find(g=>g.index===n)?.name];};return result.data.map((row,i)=>({...row,vin2:0,source:F.source(d.components.find(c=>c.id==='V1').wave,row.x,i+1<result.data.length&&result.data[i+1].x===row.x?'left':'right'),pre:hasPre(p)?read(row,'Upre:out'):undefined,shaper:hasSh(p)?read(row,'Csh2:a'):undefined,linear:NaN,current:row.currents.Rin??NaN}));}
 function charge(p,options={}){
  const rows=[];if(!hasPre(p))throw Error('La prova in carica richiede il preamplificatore.');
  for(let i=0;i<p.chargePoints;i++){
   const q=F.clone(p),width=p.chargeMin+(p.chargeMax-p.chargeMin)*i/(p.chargePoints-1);Object.assign(q.wave1,{kind:'pulse',low:0,level:-Math.abs(q.wave1.level||1),width,rise:0,fall:0,delay:20e-6});q.autoTime=true;const d=simulate(normalizeTime(q),{...options,onProgress:undefined}),before=d.filter(r=>r.x<q.wave1.delay).at(-1)?.out??0,peak=Math.max(...d.map(r=>r.out))-before;
   rows.push({x:Math.abs(q.wave1.level)*width/q.Rin,out:peak,width,baseline:before,clipped:d.some(r=>r.clipped)});options.onProgress?.((i+1)/p.chargePoints);
  }
  const n=rows.length,mx=rows.reduce((s,r)=>s+r.x,0)/n,my=rows.reduce((s,r)=>s+r.out,0)/n,slope=rows.reduce((s,r)=>s+(r.x-mx)*(r.out-my),0)/rows.reduce((s,r)=>s+(r.x-mx)**2,0),intercept=my-slope*mx;
  return rows.map(r=>({...r,linear:intercept+slope*r.x,residual:r.out-intercept-slope*r.x,slope,intercept}));
 }
 function summary(p,fmt){const rows=[];
  if(hasPre(p)){const tau=p.Rfpre*p.Cfpre;rows.push({label:'τ preamp nominale',value:fmt(tau,'s'),primary:true},{label:'Taglio preamp nominale',value:fmt(1/(2*Math.PI*tau),'Hz')});if(p.wave1.kind==='pulse')rows.push({label:'Carica nominale |Vin|·T/Rin',value:fmt(Math.abs(p.wave1.level-p.wave1.low)*p.wave1.width/p.Rin,'C'),primary:true,note:'Riferimento con nodo d’ingresso a massa virtuale. Il carico e i limiti dell’operazionale possono cambiarlo.'});}
  if(hasSh(p))rows.push({label:'τ CR nominale',value:fmt(p.Rsh1*p.Csh1,'s'),primary:true},{label:'τ RC nominale',value:fmt(p.Rsh2*p.Csh2,'s'),primary:true});
  if(['pz-shaper','detector-chain'].includes(p.type))rows.push({label:'Rpz attesa · τpre/Csh1',value:fmt(p.Rfpre*p.Cfpre/p.Csh1,'Ω'),primary:true},{label:'Compensazione PZ',value:p.pzEnabled?'Attiva':'Disinserita'});
  if(hasFinal(p)){const k=p.Rgain/p.Ri,b=p.biasEnabled?p.Rgain/p.Rbias:0;rows.push({label:'Guadagno finale ideale',value:fmt(1+k+b,'V/V'),primary:true},{label:'Baseline finale ideale',value:fmt(-b*p.wave2.level,'V'),primary:true});}
  rows.push({label:'Componenti iniziali',value:'Esempio modificabile',note:'Il PDF assegna i valori ai singoli gruppi. Inserisci i componenti misurati.'});return rows;
 }
 function applyPreset(original,key){
  const p=F.clone(original),w=p.wave1;let analysis='time';
  if(!PRESETS[p.type].some(([k])=>k===key))throw Error('Prova guidata non riconosciuta.');
  if(hasPre(p))Object.assign(w,{kind:'pulse',level:-1,low:0,width:key==='short'?(p.type==='detector-chain'?.5e-6:2e-6):key==='long'?10e-6:5e-6,delay:20e-6,rise:0,fall:0,period:.005,frequency:200});
  if(['shaper','shaper-buffer'].includes(p.type))Object.assign(w,{kind:'square',vpp:1,offset:.5,frequency:100,phase:0,duty:50});
  if(p.type==='shaper-buffer')p.outputBuffer=key!=='unbuffered';
  if(['pz-shaper','detector-chain'].includes(p.type)){p.pzEnabled=key!=='uncompensated';if(['compensated','under','over','bode','simple','bias'].includes(key))p.Rpz=p.Rfpre*p.Cfpre/p.Csh1*(key==='under'?.5:key==='over'?2:1);}
  if(key==='fast')p.Rsh1=p.Rsh2=1500;
  if(['simple','bias'].includes(key)){
   let peak=.15;if(p.type==='detector-chain'){const q=normalizeTime({...F.clone(p),type:'pz-shaper',autoTime:true});q.wave1.width=10e-6;const d=simulate(normalizeTime(q));peak=Math.max(...d.map(r=>r.out));w.width=10e-6;}else Object.assign(w,{kind:'pulse',low:0,level:.15,width:100e-6,delay:20e-6,period:.005,rise:0,fall:0});
   if(!(peak>0))throw Error('Il segnale dello shaper non consente il dimensionamento.');
   p.biasEnabled=key==='bias';p.wave2.level=5;p.Ri=10000;const ratio=p.biasEnabled?.9/p.wave2.level:0,gain=(p.biasEnabled?1.8:3)/peak;
   if(gain<=1+ratio)throw Error('Per questo segnale serve un guadagno inferiore al minimo non invertente.');p.Rgain=p.Ri*(gain-1-ratio);if(p.biasEnabled)p.Rbias=p.Rgain/ratio;
  }
  if(p.type==='noninverting'&&['bode','vtc','saturation'].includes(key))Object.assign(w,{kind:'sine',vpp:key==='saturation'?2:.1,frequency:1000,offset:0,phase:0});
  if(key==='direct'||key==='probe'){const b=B.config(p.bench);b.mode='real';b.wireR=0;for(const ch of b.channels){ch.enabled=true;ch.kind=key==='probe'?'probe10':'direct';ch.coupling='dc';}p.bench=b;}
  if(key==='bode'){analysis='bode';p.fmin=['shaper','shaper-buffer'].includes(p.type)?50:10;p.fmax=['shaper','shaper-buffer'].includes(p.type)?2e6:1e6;w.kind='sine';w.vpp=.02;w.offset=0;}
  if(key==='linearity')analysis='charge';if(key==='vtc')analysis='vtc';p.autoTime=true;
  return{parameters:normalizeTime(p),analysis};
 }
 function explanation(label){
  if(/Carica/.test(label))return 'Qin nominale = |Vin|·T/Rin. Il riferimento assume riposo a 0 V, fronti istantanei e massa virtuale all’ingresso. Per il preamplificatore ideale Vmax = |Vin|·Rf_pre/Rin·[1−exp(−T/τpre)]: Vmax ≈ Qin/Cf_pre soltanto per T molto minore di τpre. Impedenza del generatore, carichi e limiti dell’operazionale possono modificare la carica effettiva.';
  if(/Rpz/.test(label))return 'Compensazione ideale: Rpz·Csh1 = Rf_pre·Cf_pre = τpre. La resistenza è in parallelo a Csh1. La costante del ramo CR compensato è (Rsh1 ∥ Rpz)·Csh1; quella del successivo RC è Rsh2·Csh2. La cancellazione esatta assume buffer e preamplificatore ideali.';
  if(/τ preamp|Taglio preamp/.test(label))return 'τpre = Rf_pre·Cf_pre; fc,pre = 1/(2π·τpre). Sono riferimenti nominali del preamplificatore. Il Bode completo comprende anche la banda dell’operazionale e gli strumenti selezionati.';
  if(/τ CR|τ RC/.test(label))return 'Riferimenti nominali: τCR = Rsh1·Csh1 e τRC = Rsh2·Csh2. Con buffer ideale e tempi uguali, la risposta a un gradino V è V·(t/τ)·exp(−t/τ): massimo V/e a t = τ. Con Rpz inserita il primo tempo diventa (Rsh1 ∥ Rpz)·Csh1. Il carico dell’oscilloscopio può cambiare il secondo tempo.';
  if(/Guadagno finale|Baseline/.test(label))return 'Senza bias: G = 1 + Rgain/Ri. Con il riferimento Vref collegato al nodo invertente attraverso Rbias: G = 1 + Rgain/Ri + Rgain/Rbias e Vbaseline = −Vref·Rgain/Rbias. La resistenza Ri resta verso massa. Sono formule ideali; la simulazione comprende il modello operazionale scelto.';
  if(/Pendenza|Intercetta/.test(label))return 'Fit lineare non pesato dei picchi simulati rispetto alla baseline in funzione di Qin nominale. La pendenza è espressa in V/pC. Il CSV conserva durata, carica, picco, baseline, previsione del fit e residuo. Nessuna incertezza sperimentale è attribuita al fit numerico.';
  return 'Riferimento ricavato dal circuito e dall’analisi correnti. I tagli in frequenza sono riferiti al massimo della curva nell’intervallo visualizzato. Valori nominali, simulazioni e misure sperimentali hanno significati distinti.';
 }
 return{is,TYPES,CATALOG,PRESETS,hasPre,hasSh,hasFinal,defaults,normalizeTime,fields,validate,network,simulate,charge,summary,applyPreset,explanation};
});
