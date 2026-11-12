/* Read-only teaching references. These ideal equations are separate from simulated data. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./student-tools'),require('./free-model'),require('./rc-analysis'));else root.StudyAssistantModel=factory(root.StudentTools,root.FreeModel,root.RCAnalysis);})(typeof globalThis!=='undefined'?globalThis:this,function(T,M,R){
 'use strict';
 const row=(label,value,unit)=>({label,value,unit});
 const specs={
  rc:{keys:['R','C'],focus:['R1','C1'],formula:'τ = R·C; fc = 1/(2π·R·C).',metrics:p=>[row('Tempo caratteristico τ',p.R*p.C,'s'),row('Frequenza di taglio',1/(2*Math.PI*p.R*p.C),'Hz')]},
  inverting:{keys:['Rf','R1'],formula:'G = −Rf/R1. Il segno − indica l’inversione.',metrics:p=>[row('Guadagno ideale',-p.Rf/p.R1,'V/V')]},
  noninverting:{keys:['Rgain','Ri', 'Rbias'],formula:'G = 1 + Rgain/Ri + Rgain/Rbias; baseline = −Vref·Rgain/Rbias. I termini di bias si usano solo quando il bias è attivo.',metrics:p=>{const b=p.biasEnabled?p.Rgain/p.Rbias:0;return[row('Guadagno ideale',1+p.Rgain/p.Ri+b,'V/V'),row('Baseline ideale',(1+p.Rgain/p.Ri+b)*(p.wave1.kind==='pulse'?p.wave1.low:['sine','square','triangle'].includes(p.wave1.kind)?p.wave1.offset:p.wave1.kind==='ground'?0:p.wave1.level)-b*p.wave2.level,'V')];}},
  derivative:{keys:['C1','R1','Rf'],formula:'fc = 1/(2π·R1·C1); |G| alle alte frequenze tende a Rf/R1. A frequenze molto inferiori a fc, Vout ≈ −Rf·C1·dVin/dt.',metrics:p=>[row('Frequenza di transizione',1/(2*Math.PI*p.R1*p.C1),'Hz'),row('Guadagno limite in modulo',p.Rf/p.R1,'V/V')]},
  difference:{keys:['R4','R3','Rf','R1'],formula:'Vout = A1·V1 + A2·V2; A1 = −Rf/R1; A2 = (1 + Rf/R1)·R4/(R3 + R4); Ad = (A2 − A1)/2; Ac = A1 + A2.',metrics:p=>{const a=-p.Rf/p.R1,b=(1+p.Rf/p.R1)*p.R4/(p.R3+p.R4);return[row('Guadagno differenziale Ad',(b-a)/2,'V/V'),row('Guadagno di modo comune Ac',a+b,'V/V')];}},
  preamp:{keys:['Cfpre','Rfpre'],formula:'τpre = Rfpre·Cfpre; sensibilità ideale in carica = 1/Cfpre. La stima del picco Q/C richiede un impulso breve rispetto a τpre.',metrics:p=>[row('Ritorno alla baseline τpre',p.Rfpre*p.Cfpre,'s'),row('Sensibilità in carica',1e-12/p.Cfpre,'V/pC')]},
  shaper:{keys:['Csh1','Rsh1','Csh2','Rsh2'],formula:'τCR = Rsh1·Csh1; τRC = Rsh2·Csh2. Il buffer intermedio separa il carico dei due stadi.',metrics:p=>[row('Tempo dello stadio CR',p.Rsh1*p.Csh1,'s'),row('Tempo dello stadio RC',p.Rsh2*p.Csh2,'s')]},
  'pz-shaper':{keys:['Rpz','Cfpre','Csh1'],formula:'Rpz di riferimento = Rfpre·Cfpre/Csh1. È il valore di compensazione nominale della rete adottata.',metrics:p=>[row('Rpz di riferimento',p.Rfpre*p.Cfpre/p.Csh1,'Ω'),row('Scostamento di Rpz',100*(p.Rpz/(p.Rfpre*p.Cfpre/p.Csh1)-1),'%')]},
  'detector-chain':{keys:['Rgain','Cfpre','Csh1','Ri'],formula:'La catena combina conversione Q/C, shaping CR–RC e amplificazione finale. Gfinal = 1 + Rgain/Ri, più Rgain/Rbias quando il bias è attivo.',metrics:p=>[row('Sensibilità del preamplificatore',1e-12/p.Cfpre,'V/pC'),row('Tempo dello shaping CR',p.Rsh1*p.Csh1,'s'),row('Guadagno finale ideale',1+p.Rgain/p.Ri+(p.biasEnabled?p.Rgain/p.Rbias:0),'V/V')]}
 };
 specs['shaper-buffer']=specs.shaper;specs['preamp-shaper']={...specs.shaper,keys:['Csh1','Cfpre','Rsh1','Csh2'],formula:'τpre = Rfpre·Cfpre; τCR = Rsh1·Csh1; τRC = Rsh2·Csh2. Il confronto tra questi tempi aiuta a interpretare coda e undershoot.',metrics:p=>[row('Tempo del preamplificatore',p.Rfpre*p.Cfpre,'s'),...specs.shaper.metrics(p)]};
 const diode={keys:['diodeIs','diodeN'],focus:['D1','D1'],formula:'Iᴅ = Iₛ·(exp(Vᴅ/(n·Vₜ)) − 1). A 27 °C Vₜ ≈ 25,86 mV.',metrics:p=>[row('Corrente a Vᴅ = 0,6 V',p.diodeIs*Math.expm1(.6/(p.diodeN*.0258649)),'A')]};
 specs['diode-iv']=specs['half-wave']=diode;
 specs['half-wave-rc']={keys:['C1','R1','RL'],formula:'τ ≈ R·C durante la scarica. Con Rᴸ inserita, R = R₁ ∥ Rᴸ.',metrics:p=>[row('Tempo nominale di scarica',p.C1/(1/p.R1+(p.externalLoad?1/p.RL:0)),'s')]};
 specs['mos-iv']={keys:['mosKp','mosVto','mosLambda','drainBias'],focus:['M1','M1','M1','VDD'],formula:'In saturazione Iᴅ = kₙ/2·(Vɢₛ − VTN)²·(1 + λₙ·Vᴅₛ).',metrics:p=>{const vg=p.wave1.level/(1+(p.gateMeter?p.gateR/10e6:0)),overdrive=vg-p.mosVto;return[row('Iᴅ in saturazione',overdrive>0&&p.drainBias>=overdrive?.5*p.mosKp*overdrive**2*(1+p.mosLambda*p.drainBias):NaN,'A')];}};
 specs['mos-amplifier']={keys:['RD','C1','C2'],formula:'Vᴅᴅ = Vᴅₛ + Rᴅ·Iᴅ. Per il riferimento nominale Iᴅ = 0,7 mA e Vᴅₛ = 7 V.',metrics:p=>[row('Vᴅᴅ per Q nominale',7+p.RD*.0007,'V')]};
 const pullup={keys:['RD','VDD','mosKp'],focus:['RD','VDD','M1'],formula:'VOUT alto tende a Vᴅᴅ quando il percorso verso massa è interdetto.',metrics:p=>[row('Livello alto ideale',p.VDD,'V')]};
 specs['nmos-inverter']=specs['nmos-nor']=specs['nmos-nand']=pullup;
 specs['cmos-inverter']={keys:['VDD'],formula:'Con ingressi ai due livelli di alimentazione, il pMOS porta OUT a Vᴅᴅ e il nMOS porta OUT a massa.',metrics:p=>[row('Livello alto ideale',p.VDD,'V'),row('Livello basso ideale',0,'V')]};
 function describe(context,selection={}){
  let {type,params:p,doc,free}=context,focusMap=null;
  if(free){let ref=null;try{ref=R.simpleReference(doc,M.topology(doc));}catch{}if(ref){const r=doc.components.find(c=>c.type==='R'),c=doc.components.find(c=>c.type==='C');type='rc';p={R:r.value,C:c.value};focusMap={R:r.id,C:c.id};}else return{lesson:T.lesson('free'),keys:[],current:[],changed:[],focus:doc.components.find(c=>['R','C','U'].includes(c.type))?.id,formula:'Il modello numerico segue i componenti e i nodi del tuo circuito. Usa Parametri e tolleranze per confrontare due valori della stessa rete.',assumptions:['Questa topologia non ha un riferimento analitico automatico. I risultati numerici si leggono nel grafico e si confrontano con i dati misurati.']};}
  const spec=specs[type];if(!spec)throw Error('Esperienza senza riferimento didattico.');const keys=spec.keys.filter(k=>Number.isFinite(p[k])&&(k!=='Rbias'||p.biasEnabled)&&(type!=='half-wave-rc'||k!=='RL'||p.externalLoad)),key=keys.includes(selection.key)?selection.key:keys[0],factor=[.5,.99,1.01,2].includes(selection.factor)?selection.factor:2,copy={...p,[key]:p[key]*factor};
  const assumptions=['Riferimento ideale: non include banda finita, saturazione, slew rate o carico degli strumenti. Non è una misura né il risultato della simulazione.'];
  if(type==='difference')assumptions.push('Ac nullo indica annullamento ideale con resistenze bilanciate; non implica CMRR infinito nel componente reale.');
  if(type==='shaper-buffer')assumptions.push(p.outputBuffer?'Buffer finale attivo: il suo effetto si valuta sotto lo stesso carico, non dalle sole costanti di tempo.':'Buffer finale assente: confronta le prove con e senza buffer mantenendo invariato il carico.');
  if(['pz-shaper','detector-chain'].includes(type))assumptions.push(p.pzEnabled?'Compensazione polo-zero attiva.':'Compensazione polo-zero disattivata: il valore di riferimento è indicato per confronto.');
  if(type==='noninverting'&&!p.biasEnabled)assumptions.push('Bias disattivato: la baseline dipende dal livello DC d’ingresso moltiplicato per il guadagno.');
  return{lesson:T.lesson(context.type==='free'?type:context.type),keys,key,factor,from:p[key],to:copy[key],focus:focusMap?.[key]||spec.focus?.[keys.indexOf(key)]||key,current:spec.metrics(p),changed:spec.metrics(copy),formula:spec.formula,assumptions};
 }
 const labels={massimo:'Picco di uscita',minimo:'Minimo di uscita',tempoDelMassimo:'Istante del picco',baseline:'Baseline prima dell’impulso',iniziale:'Valore iniziale',piccoBaseline:'Picco − baseline',minimoBaseline:'Minimo − baseline',finale:'Valore finale',guadagnoMassimo:'Guadagno massimo',frequenzaDelMassimo:'Frequenza del massimo',taglioDiscendente:'Taglio discendente'};
 function precisionRows(result){if(result.comparisons)return result.comparisons.map(c=>({...c,label:labels[c.name]||c.name,relative:Number.isFinite(c.coarse)&&Number.isFinite(c.fine)&&Math.max(Math.abs(c.coarse),Math.abs(c.fine))>1e-12?100*c.difference/Math.max(Math.abs(c.coarse),Math.abs(c.fine)):null}));return[{label:'Scarto massimo sui nodi · '+result.node,coarse:null,fine:null,difference:result.absolute,relative:100*result.relative,unit:'V'}];}
 function display(value,unit='',ordinary){
  if(!Number.isFinite(value))return'—';const n=Object.is(value,-0)?0:value,a=Math.abs(n);
  if(n!==0&&(a<1e-9||a>=1e12||unit==='%'&&a<1e-4)){const[m,e]=n.toExponential(4).split('e');return m.replace('.',',')+' × 10^'+Number(e)+(unit?' '+unit:'');}
  if(['%','V/V'].includes(unit))return new Intl.NumberFormat('it-IT',{maximumSignificantDigits:5}).format(n)+' '+unit;
  return ordinary(n,unit,5);
 }
 return{describe,precisionRows,display};
});
