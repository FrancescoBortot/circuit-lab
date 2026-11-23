(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./measurements'),require('./comparison-data'));else root.StudentTools=factory(root.LabMeasurements,root.ComparisonData);})(typeof globalThis!=='undefined'?globalThis:this,function(Measures,D){
 'use strict';
 const lessons={rc:['Misura il tempo di carica e scarica.','R oppure C','Ampiezza, strumenti e condizione iniziale','Confronta τ misurata con R·C.'],inverting:['Verifica guadagno e inversione del segnale.','R1, Rf oppure ampiezza','Frequenza e carico','Confronta le ampiezze e cerca la saturazione.'],derivative:['Verifica come l’uscita risponde alle variazioni dell’ingresso.','Forma e frequenza','Ampiezza e componenti','Confronta triangolare e sinusoide.'],difference:['Separa risposta differenziale e modo comune.','Eccitazione o bilanciamento resistivo','Frequenza e strumenti','Confronta Ad e Ac allo stesso punto di lavoro.'],preamp:['Osserva la conversione carica → tensione.','Durata dell’impulso o Cfpre','Livello, Rin e carico','Misura il picco rispetto alla baseline.'],shaper:['Osserva la formazione dell’impulso CR–RC.','Rsh oppure Csh','Ingresso e strumenti','Confronta tempo del picco e larghezza.'],'shaper-buffer':['Verifica l’effetto del carico con e senza buffer.','Buffer di uscita','Impulso, R/C e strumenti','Confronta le due curve sotto lo stesso carico.'],'preamp-shaper':['Osserva la coda e l’undershoot della cascata.','Durata dell’impulso o tempi CR–RC','Ampiezza e carico','Misura picco e ritorno alla baseline.'],'pz-shaper':['Studia la compensazione polo-zero.','Valore di Rpz','Preamplificatore, shaping e carico','Confronta coda e undershoot.'],noninverting:['Studia il guadagno e il riferimento dello stadio finale.','Guadagno o bias','Ingresso, alimentazioni e carico','Confronta baseline ed escursione.'],'detector-chain':['Segui il segnale lungo la catena completa.','Un parametro alla volta','Carica iniettata e strumenti','Confronta PRE, SHAPER e OUT.']};
 const logic=['Confronta i livelli logici di ingresso e uscita.','Livelli o fase degli ingressi','Alimentazione e modello dei MOS','Controlla la tabella di verità e i livelli nei tratti stabili.'];
 Object.assign(lessons,{
  'diode-iv':['Ricava Iₛ e n dalla caratteristica diretta.','Resistenza di serie o parametri del diodo','Temperatura del modello','Leggi la pendenza semilogaritmica e il residuo.'],
  'half-wave':['Osserva il raddrizzamento di una sinusoide.','Carico R₁','Ampiezza e frequenza','Confronta picchi e valore medio di ingresso e uscita.'],
  'half-wave-rc':['Confronta il ripple con e senza carico aggiuntivo.','Carico, capacità o frequenza','Ampiezza e modello del diodo','Leggi media e ripple dell’ultimo periodo.'],
  'mos-iv':['Caratterizza il MOSFET vicino al punto di lavoro.','Vᴅₛ o Vɢₛ','L’altra polarizzazione e i parametri del MOS','Confronta le regioni della curva e le stime attorno a Q.'],
  'mos-amplifier':['Verifica l’inversione e la distorsione del segnale.','Ampiezza d’ingresso','Frequenza e polarizzazione','Confronta il rapporto Vpp e il guadagno a piccolo segnale.'],
  'nmos-inverter':logic,'nmos-nor':logic,'nmos-nand':logic,'cmos-inverter':logic
 });
 function lesson(type){const a=lessons[type]||['Esplora il circuito libero.','Un componente alla volta','Segnale e condizioni iniziali','Annota la previsione e confronta i risultati.'];return{goal:a[0],vary:a[1],hold:a[2],measure:a[3]};}
 function diff(a,b,path=''){const rows=[];for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const x=a?.[key],y=b?.[key],p=path?path+'.'+key:key;if(x&&y&&typeof x==='object'&&typeof y==='object')rows.push(...diff(x,y,p));else if(JSON.stringify(x)!==JSON.stringify(y))rows.push({path:p,before:x,after:y});}return rows;}
 const canonicalId=(type,id)=>type==='rc'?({R:'R1',C:'C1'}[id]||id):id;
 const schematicId=(type,id)=>type==='rc'?({R1:'R',C1:'C'}[id]||id):id;
 const prefixes={f:1e-15,p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,'μ':1e-6,m:1e-3,k:1e3,K:1e3,M:1e6,G:1e9};
 function unit(value){const s=String(value||'').trim().replace(/ohm/gi,'Ω');if(['V/µs','V/us','V/μs'].includes(s))return{base:'V/s',factor:1e6};if(['Ω','F','H','s','Hz','V','Vpp','A','App','%','°','V/s','V/V','A/V²'].includes(s))return{base:s,factor:1};if(prefixes[s[0]]&&['Ω','F','H','s','Hz','V','Vpp','A','App','A/V²'].includes(s.slice(1)))return{base:s.slice(1),factor:prefixes[s[0]]};return{base:s,factor:1};}
 function quantity(text,factor=1,displayUnit=''){const m=String(text).trim().match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)\s*([^\d\s]*)$/i);if(!m)return NaN;const n=Number(m[1].replace(',','.')),suffix=m[2],expected=unit(displayUnit);if(!suffix)return n*factor;if(Object.hasOwn(prefixes,suffix)&&['Ω','F','H','s','Hz','V','Vpp','A','App','A/V²'].includes(expected.base))return n*prefixes[suffix];const actual=unit(suffix);if(actual.base!==expected.base)return NaN;return n*(actual.base==='%'?factor:actual.factor);}
 function readQuantity(input,factorOverride){const select=input.parentElement.querySelector('select'),label=select?.selectedOptions?.[0]?.textContent||input.parentElement.querySelector('span')?.textContent||'',factor=factorOverride??(select?Number(select.value):Number(input.dataset.factor||1));return quantity(input.value,factor,label);}
 function crossX(a,b,level){const dv=b.value-a.value;if(Math.abs(dv)<1e-18)return a.x;const f=Math.max(0,Math.min(1,(level-a.value)/dv));return a.x+f*(b.x-a.x);}
 function regularPeriod(rising,falling,wave){
  if(!rising.length||!falling.length||Math.max(rising.length,falling.length)<2)return null;
  const intervals=[rising,falling].flatMap(edges=>edges.slice(1).map((edge,i)=>edge.t-edges[i].t));
  const period=intervals.reduce((sum,dt)=>sum+dt,0)/intervals.length;
  // Compare consecutive edges of both polarities, allowing 2% for threshold interpolation.
  if(!(period>0)||intervals.some(dt=>Math.abs(dt-period)>.02*period))return null;
  if(Math.max(rising.length,falling.length)>=3)return period;
  // When the window shows a single cycle, corroborate it with the configured source.
  const sourcePeriod=wave?.kind==='pulse'?wave.period:['sine','square','triangle'].includes(wave?.kind)?1/wave.frequency:null;
  return sourcePeriod>0&&Math.abs(period-sourcePeriod)<=.02*period?period:null;
 }
 function waveformMetrics(config){
  if(!config?.data?.length||config.xUnit!=='s')return[];
  const series=config.series?.filter(s=>s.visible!==false)||[],s=series.find(s=>s.key==='out')||series[0];
  if(!s)return[];
  const pts=config.data.map((p,index)=>({x:p.x,value:p[s.key],index})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.value));
  if(pts.length<4)return[];
  const maxPt=pts.reduce((a,b)=>b.value>a.value?b:a),minPt=pts.reduce((a,b)=>b.value<a.value?b:a),span=maxPt.value-minPt.value;
  if(!(span>1e-12))return[];
  const y10=minPt.value+.1*span,y50=minPt.value+.5*span,y90=minPt.value+.9*span;
  let t10Up=null,rise=null,t90Down=null,fall=null;const up50=[],down50=[];
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i];if(b.x<a.x)continue;
   if(a.value<=y10&&b.value>y10&&rise===null)t10Up=crossX(a,b,y10);
   if(a.value<y10&&b.value<y10&&rise===null)t10Up=null;
   if(t10Up!==null&&a.value<y90&&b.value>=y90&&rise===null){const t90=crossX(a,b,y90);if(t90>=t10Up)rise={value:t90-t10Up,index:b.index};}
   if(a.value>=y90&&b.value<y90&&fall===null)t90Down=crossX(a,b,y90);
   if(a.value>y90&&b.value>y90&&fall===null)t90Down=null;
   if(t90Down!==null&&a.value>y10&&b.value<=y10&&fall===null){const t10=crossX(a,b,y10);if(t10>=t90Down)fall={value:t10-t90Down,index:b.index};}
   if(a.value<y50&&b.value>=y50)up50.push({t:crossX(a,b,y50),index:b.index});
   if(a.value>y50&&b.value<=y50)down50.push({t:crossX(a,b,y50),index:b.index});
  }
  const out=[];
  if(rise)out.push({label:'Salita 10–90% · '+s.label,value:rise.value,unit:'s',index:rise.index});
  if(fall)out.push({label:'Discesa 90–10% · '+s.label,value:fall.value,unit:'s',index:fall.index});
  const settings=s.key==='out'&&config.yUnit==='V'?(config.baselineSettings||{}):{},pulseM=Measures.pulse(config.data,s.key,config.pulse,undefined,settings);
  const base=pulseM?pulseM.baseline:Number.isFinite(config.dcBaseline?.[s.key])?config.dcBaseline[s.key]:pts[0].value;
  const peakIdx=Math.abs(maxPt.value-base)>=Math.abs(minPt.value-base)?pts.indexOf(maxPt):pts.indexOf(minPt),peakPt=pts[peakIdx],amp=peakPt.value-base;
  if(up50.length<2&&Math.abs(amp)>.1*span){
   const half=base+.5*amp,sign=Math.sign(amp);let leftT=null,rightT=null;
   for(let i=peakIdx;i>0;i--){const a=pts[i-1],b=pts[i];if((a.value-half)*sign<=0&&(b.value-half)*sign>0&&b.x>=a.x){leftT=crossX(a,b,half);break;}}
   for(let i=peakIdx+1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if((a.value-half)*sign>=0&&(b.value-half)*sign<0&&b.x>=a.x){rightT=crossX(a,b,half);break;}}
   if(leftT!==null&&rightT!==null&&rightT>leftT)out.push({label:'Larghezza 50% (FWHM) · '+s.label,value:rightT-leftT,unit:'s',index:peakPt.index});
  }
  const period=regularPeriod(up50,down50,config.wave||config.pulse);
  if(period!==null){
   const {index}=up50[1]||down50[1];
   out.push({label:'Periodo · '+s.label,value:period,unit:'s',index},{label:'Frequenza · '+s.label,value:1/period,unit:'Hz',index});
   const firstDown=up50[1]&&down50.find(d=>d.t>up50[0].t&&d.t<up50[1].t);
   if(firstDown)out.push({label:'Duty cycle · '+s.label,value:100*(firstDown.t-up50[0].t)/(up50[1].t-up50[0].t),unit:'%',index:firstDown.index});
  }
  const inSeries=s.key==='out'?series.find(tr=>['vin','in','source'].includes(tr.key)&&config.data.some(d=>Number.isFinite(d[tr.key]))):null;
  if(inSeries){
   const inPts=config.data.map((p,index)=>({x:p.x,value:p[inSeries.key],index})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.value));
   if(inPts.length>=4){
    const inMax=inPts.reduce((a,b)=>b.value>a.value?b:a).value,inMin=inPts.reduce((a,b)=>b.value<a.value?b:a).value;
    if(inMax-inMin>1e-12){
     const inMid=(inMax+inMin)/2;let tIn=null;
     for(let i=1;i<inPts.length;i++){const a=inPts[i-1],b=inPts[i];if(b.x>=a.x&&((a.value<inMid&&b.value>=inMid)||(a.value>inMid&&b.value<=inMid))){tIn=crossX(a,b,inMid);break;}}
     const outCross=[...up50,...down50].sort((a,b)=>a.t-b.t).find(c=>tIn!==null&&c.t>=tIn-1e-12);
     if(tIn!==null&&outCross)out.push({label:'Ritardo '+inSeries.label+' → '+s.label,value:outCross.t-tIn,unit:'s',index:outCross.index});
    }
   }
  }
  return out;
 }
 function readings(config){if(!config?.data?.length)return[];const series=config.series?.filter(s=>s.visible!==false)||[],s=series.find(s=>s.key==='out')||series[0];if(!s)return[];const points=config.data.map((p,index)=>({value:p[s.key],x:p.x,index})).filter(p=>Number.isFinite(p.value));if(!points.length)return[];const extra=waveformMetrics(config),settings=s.key==='out'&&config.yUnit==='V'?(config.baselineSettings||{}):{},explicit=settings.baselineMode&&settings.baselineMode!=='auto',m=config.xUnit==='s'?Measures.pulse(config.data,s.key,config.pulse,undefined,settings):null;if(m)return[{label:'Picco − baseline · '+s.label,value:m.peak,unit:config.yUnit,index:m.maxIndex},{label:(explicit?m.baselineLabel:'Baseline')+' · '+s.label,value:m.baseline,unit:config.yUnit,index:m.baselineIndex},{label:'Massimo assoluto · '+s.label,value:m.maximum,unit:config.yUnit,index:m.maxIndex},{label:'Minimo − baseline · '+s.label,value:m.trough,unit:config.yUnit,index:m.minIndex},...extra];const max=points.reduce((a,b)=>b.value>a.value?b:a),min=points.reduce((a,b)=>b.value<a.value?b:a);if(config.xUnit==='s'&&explicit){const ref=Measures.baseline(config.data,s.key,settings);return[{label:'Massimo assoluto · '+s.label,value:max.value,unit:config.yUnit,index:max.index},...(ref?[{label:ref.label,value:ref.value,unit:config.yUnit,index:ref.index},{label:'Picco − baseline · '+s.label,value:max.value-ref.value,unit:config.yUnit,index:max.index},{label:'Minimo − baseline · '+s.label,value:min.value-ref.value,unit:config.yUnit,index:min.index}]:[]),...extra];}if(config.xUnit==='s'&&Number.isFinite(config.dcBaseline?.[s.key]))return[{label:'Massimo assoluto · '+s.label,value:max.value,unit:config.yUnit,index:max.index},{label:'Baseline DC · equilibrio',value:config.dcBaseline[s.key],unit:config.yUnit,index:points[0].index},{label:'Massimo − baseline DC · '+s.label,value:max.value-config.dcBaseline[s.key],unit:config.yUnit,index:max.index},{label:'Minimo − baseline DC · '+s.label,value:min.value-config.dcBaseline[s.key],unit:config.yUnit,index:min.index},...extra];return[{label:'Massimo · '+s.label,value:max.value,unit:config.yUnit,index:max.index},{label:'Minimo · '+s.label,value:min.value,unit:config.yUnit,index:min.index},{label:(config.xUnit==='s'?'Tempo':'Ascissa')+' del massimo',value:max.x,unit:config.xUnit,index:max.index},{label:'Valore iniziale · '+s.label,value:points[0].value,unit:config.yUnit,index:points[0].index},...extra];}
 const axisHeaders={
  time:/tempo|time|^t(?:_|$)/i,bode:/freq|^f(?:_|$)|hz/i,charge:/carica|charge|^q(?:in)?(?:_|$)/i,vtc:/ingresso|input|vin/i,
  diodeIV:/^(?:v_?d|vdiodo|tensione|voltage)(?:$|[\s_(\[])/i,
  mosOutput:/^(?:v_?ds|tensione|voltage)(?:$|[\s_(\[])/i,
  mosTransfer:/^(?:v_?gs|tensione|voltage)(?:$|[\s_(\[])/i
 };
 const unitAliases={'V/V':['V_V'],'µs':['us','μs'],'µA':['uA','μA'],'µV':['uV','μV']};
 function headerUnit(header,allowed){
  return allowed.find(unit=>[unit,...(unitAliases[unit]||[])].some(spelling=>
   new RegExp('(?:^|[_ (\\[])'+spelling+'(?:$|[ )\\]])').test(header)));
 }
 function columnHints(headers,kind='time'){
  const labels=headers.map(s=>String(s).trim());
  const sigmaColumn=labels.findIndex(s=>/^u(?:_|$)|sigma|incertezza/i.test(s));
  const phaseColumn=kind==='bode'?labels.findIndex(s=>/fase|phase/i.test(s)):-1;
  const signalColumn=(pattern,excluded)=>labels.findIndex((s,i)=>i!==sigmaColumn&&i!==phaseColumn&&i!==excluded&&pattern.test(s));
  const xMatch=signalColumn(axisHeaders[kind]||axisHeaders.time,-1);
  const xColumn=xMatch<0?0:xMatch;
  const output=D.currentKinds.includes(kind)?/^(?:i_?d|corrente|current)(?:$|[\s_(\[])/i:
   kind==='charge'?/picco_meno_baseline|vpremax|vout|uscita|output/i:/vout|uscita|output|gain|guadagno|tensione|voltage/i;
  const yMatch=signalColumn(output,xColumn);
  const yColumn=yMatch<0?(xColumn===0?1:0):yMatch;
  return{xColumn,yColumn,sigmaColumn:sigmaColumn<0?null:sigmaColumn,phaseColumn:phaseColumn<0?null:phaseColumn,
   xUnit:headerUnit(labels[xColumn]||'',D.xUnits(kind)),yUnit:headerUnit(labels[yColumn]||'',D.yUnits(kind))};
 }
 function resultState({busy,invalid,ready}){return invalid?'invalid':busy?'running':ready?'current':'pending';}
 function parameterView(doc){return{components:Object.fromEntries(doc.components.map(({x,y,rotation,...c})=>[c.id,c])),wires:doc.wires.map(w=>[w.a,w.b].sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),settings:doc.settings,probes:doc.probes};}
 function settingLabel(path){const wave=path.match(/^wave([12])\.(.+)$/),names={kind:'Forma del segnale',frequency:'Frequenza',vpp:'Ampiezza picco-picco',offset:'Offset',phase:'Fase',level:'Livello',rise:'Tempo di salita',fall:'Tempo di discesa',width:'Durata impulso',delay:'Ritardo',duty:'Duty cycle'};if(wave)return(names[wave[2]]||wave[2])+' · ingresso '+wave[1];return({baselineMode:'Modalità baseline',baselineValue:'Baseline manuale di OUT',baselineStart:'Inizio intervallo baseline',baselineEnd:'Fine intervallo baseline',analysis:'Analisi',autoTime:'Intervallo temporale automatico',duration:'Durata della simulazione',initial:'Tensione iniziale',switchTime:'Istante di commutazione',instrument:'Collegamento degli strumenti',opamp:'Modello operazionale',drive:'Eccitazione',bodeInput:'Riferimento di ingresso Bode',rail:'Alimentazione',headroom:'Margine alle alimentazioni',rg:'Resistenza del generatore',scopeR:'Resistenza di ingresso oscilloscopio',scopeC:'Capacità di ingresso oscilloscopio',outputBuffer:'Buffer di uscita',Rpz:'Resistenza di compensazione Rpz',externalLoad:'Carico esterno Rᴸ',gateMeter:'Voltmetro sul gate',drainBias:'Polarizzazione Vᴅₛ',gateBias:'Polarizzazione del gate',VDD:'Alimentazione Vᴅᴅ'}[path])||(/^[RC]/.test(path)?(path[0]==='R'?'Resistenza ':'Capacità ')+path:path.split('.').join(' · '));}
 function settingValue(path,value,format){if(value===undefined)return'—';if(typeof value==='boolean')return value?'Sì':'No';if(typeof value==='number'){const last=path.split('.').at(-1),unit=/^R/.test(path)||['rg','scopeR'].includes(path)?'Ω':/^C/.test(path)||path==='scopeC'?'F':last==='frequency'?'Hz':['baselineStart','baselineEnd','duration','switchTime','rise','fall','width','delay'].includes(last)?'s':last==='vpp'?'Vpp':['baselineValue','level','offset','rail','headroom','initial','drainBias','gateBias','VDD'].includes(last)?'V':last==='phase'?'°':'';return format(value,unit,5);}const groups={baselineMode:{auto:'Automatica',manual:'Valore manuale',interval:'Media su un intervallo'},analysis:{time:'Transitorio',bode:'Bode',vtc:'VTC',charge:'Linearità in carica',diodeIV:'Caratteristica del diodo',mosOutput:'Curva Iᴅ–Vᴅₛ',mosTransfer:'Curva Iᴅ–Vɢₛ'},instrument:{ideal:'Ideali',direct:'Cavi diretti',probe:'Sonde 10×'},opamp:{ideal:'Ideale',limited:'A polo dominante',pole:'A polo dominante',physical:'Fisico'},kind:{sine:'Sinusoide',square:'Onda quadra',triangle:'Triangolare',pulse:'Impulso',dc:'Livello continuo',charge:'Carica',discharge:'Scarica',cycle:'Carica e scarica',ground:'A massa'},drive:{common:'Modo comune',differential:'Differenziale',v1:'Solo ingresso 1',v2:'Solo ingresso 2'}};return groups[path.split('.').at(-1)]?.[value]??String(value);}
 function matchesQuery(text,query){const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const value=normalize(text);return normalize(query).trim().split(/\s+/).every(part=>value.includes(part));}
 return{settingLabel,settingValue,lesson,diff,canonicalId,schematicId,unit,quantity,readQuantity,readings,waveformMetrics,columnHints,resultState,parameterView,matchesQuery};
});
