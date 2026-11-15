(() => {
 'use strict';
 const L=window.LabModel,lab=window.GuidedLab,C=window.LabTransientComparison;
 const button=document.getElementById('compareLabTransients');
 const dialog=document.createElement('dialog');
 dialog.className='workbench-dialog diode-comparison transient-comparison';
 dialog.setAttribute('aria-labelledby','transientCompareTitle');
 dialog.innerHTML=`
  <div class="dialog-heading">
   <h2 id="transientCompareTitle"></h2>
   <button type="button" class="icon-button" data-close aria-label="Chiudi il confronto">×</button>
  </div>
  <fieldset data-modes hidden><legend>Che cosa vuoi confrontare?</legend><div data-options></div></fieldset>
  <label data-amplifier><input type="checkbox" data-normalize> Normalizza le uscite rispetto al Vpp d’ingresso</label>
  <p data-context></p>
  <div class="ps-legend" data-legend aria-label="Condizioni A e B"></div>
  <p data-status role="status"></p>
  <section data-result aria-label="Uscite simulate a confronto" hidden>
   <div data-chart>
    <label data-zero-center hidden><input type="checkbox"> Centra le scale manuali su 0 V</label>
    <div class="diode-comparison-plot"><svg id="transientComparePlot" role="img" aria-label="Curve simulate A e B"></svg></div>
    <p data-reading hidden></p>
   </div>
   <table class="transient-comparison-table"><caption>Misure sulle curve simulate</caption><thead></thead><tbody></tbody></table>
   <p data-note></p>
  </section>`;
 document.body.append(dialog);
 const $=selector=>dialog.querySelector(selector),normalize=$('[data-normalize]');
 const status=$('[data-status]'),result=$('[data-result]'),zero=$('[data-zero-center] input');
 const tasks=new window.CircuitTasks(),format=(value,unit)=>L.format(value,unit,4);
 let doc,params,curves,mode,analysis,revision=0,plot,traces;
 const modes={
  'half-wave-rc':[['load','Con e senza carico a 50 Hz'],['frequency','50 Hz e 1 kHz con lo stesso carico']],
  'shaper-buffer':[['time','Risposta al gradino'],['bode','Risposta in frequenza']]
 };
 const contexts={
  rc:'Stessi R e C, condensatore inizialmente a 4 V e generatore da 50 Ω. Cambia il carico dell’oscilloscopio.',
  inverting:'Stessi R₁ e Rf. Si confrontano i modelli dell’operazionale da 30 Hz a 1 MHz.',
  'shaper-buffer':'Stesso shaper e stessa sonda ×10. Cambia il buffer di uscita.',
  'mos-iv':'Stessa tensione del generatore e Vᴅₛ = 7 V. A valle, il voltmetro da 10 MΩ carica il nodo del gate.',
  'mos-amplifier':'Stessa polarizzazione e frequenza di 3 kHz. Cambia il Vpp del generatore.'
 };
 const referenceTime=()=>10*params.Rsh2*params.Csh2;
 function context(){
  const p=params;
  if(contexts[p.type])return contexts[p.type];
  if(p.type==='half-wave-rc')return 'Generatore a 10 Vpp e sonda ×10. C₁ = '+format(p.C1,'F')+' · Carico esterno Rᴸ = '+format(p.RL,'Ω')+'.';
  if(C.isCompensation(p.type))return 'Stesso impulso da 5 µs e stessi componenti. Rₚ𝓏 calcolata = '+format(p.Rfpre*p.Cfpre/p.Csh1,'Ω')+'.';
  if(C.isGate(p.type))return 'Stesso modello nMOS, resistenza di pull-up e alimentazione a 5 V. IN1 a 50 Hz, IN2 a 100 Hz.';
  return 'Stesso modello nMOS e alimentazione a 5 V. Per Rᴅ e pMOS si usano i valori della sessione, se presenti.';
 }
 function headings(){
  const type=params.type;
  if(type==='rc')return ['τ dalla scarica','R·C nominale'];
  if(type==='inverting')return ['Modulo a 30 Hz','Frequenza a −3 dB'];
  if(type==='shaper-buffer')return analysis==='bode'?['Guadagno di picco','Frequenza del picco']:['Picco OUT','Tempo al picco'];
  if(C.isCompensation(type))return ['Minimo rispetto alla baseline','OUT − baseline a 10 tₛₕ'];
  if(type==='mos-iv')return ['Vɢₛ','Iᴅ'];
  if(type==='half-wave-rc')return ['Ripple','Media OUT','A regime'];
  if(type==='mos-amplifier')return ['Vpp OUT / IN'];
  return ['OUT con IN alto','OUT con IN basso'];
 }

 function refreshButton(){
  const title=C.titles[lab.parameters().type];
  button.hidden=!title;
  if(title&&button.textContent!==title)button.textContent=title;
 }
 document.addEventListener('guided-lab-state',refreshButton);
 refreshButton();

 function metrics(curve){
  const {label,values}=curve,type=params.type;
  if(type==='half-wave-rc')return [label,format(values.ripple,'Vpp'),format(values.outputMean,'V'),values.settled?'Sì':'No'];
  if(type==='mos-amplifier')return [label,format(values.ppGain,'V/V')];
  if(type==='mos-iv')return [label,format(values.vgs,'V'),format(values.id,'A')];
  if(C.isInverter(type))return [label,format(values.truth.find(row=>row.a==='1')?.out,'V'),format(values.truth.find(row=>row.a==='0')?.out,'V')];
  const units=type==='rc'?['s','s']:analysis==='bode'?['dB','Hz']:C.isCompensation(type)?['V','V']:['V','s'];
  return [label,...C.measurements(curve,analysis).map((value,i)=>
   type==='inverting'&&i===1&&!Number.isFinite(value)?'Fuori intervallo':format(value,units[i]))];
 }

 function renderTable(){
  const truth=C.isGate(params.type);
  const columns=truth?['IN1','IN2','NOR','NAND']:['Condizione',...headings()];
  const rows=truth?curves[0].values.truth.map((row,i)=>[row.a,row.b,row.level,curves[1].values.truth[i].level]):curves.map((curve,i)=>{
   const [label,...values]=metrics(curve);return [(i?'B · ':'A · ')+label,...values];
  });
  const row=(values,tag)=>{
   const tr=document.createElement('tr');
   for(const value of values){
    const cell=document.createElement(tag);
    if(tag==='th')cell.setAttribute('scope','col');
    cell.textContent=value;tr.append(cell);
   }
   return tr;
  };
  $('caption').textContent=truth?'Tabella di verità simulata':'Misure sulle simulazioni';
  $('thead').replaceChildren(row(columns,'th'));
  $('tbody').replaceChildren(...rows.map(values=>row(values,'td')));
 }
 function renderLegend(cases){
  $('[data-legend]').replaceChildren(...cases.map(({label},i)=>{
   const item=document.createElement('span'),swatch=document.createElement('i');
   swatch.className=i?'comparison-swatch-b':'comparison-swatch-a';
   item.append(swatch,(i?'B · ':'A · ')+label);return item;
  }));
 }
 function note(phase,normalized){
  const type=params.type;
  if(phase)return 'Le curve mostrano l’ultimo periodo sulla stessa scala di fase. Un periodo dura 20 ms a 50 Hz e 1 ms a 1 kHz.';
  if(normalized)return 'Da ciascuna uscita si sottrae la media dell’ultimo periodo e si divide per il Vpp del relativo ingresso.';
  if(C.isCompensation(type))return 'Zero indica la baseline prima dell’impulso. Il marcatore mostra 10 tₛₕ = '+format(referenceTime(),'s')+' dall’inizio dell’impulso, con tₛₕ = Rsh₂·Csh₂.';
  if(type==='rc')return 'τ è il tempo necessario per scendere a 4 V/e. R·C è il riferimento nominale.';
  if(type==='inverting')return 'Il taglio è riferito al modulo a 30 Hz.';
  if(type==='shaper-buffer')return analysis==='bode'?'Il picco è cercato nella banda simulata da 50 Hz a 2 MHz.':'Il picco è misurato sul primo gradino di salita.';
  if(C.isInverter(type))return 'Ingresso quadrato 0–5 V a 50 Hz. Montaggio ideale. I livelli in tabella sono calcolati in continua.';
  if(C.isGate(type))return 'Montaggio ideale. Attiva il grafico e sposta il cursore per leggere i due ingressi e le due uscite allo stesso istante.';
  return type==='mos-iv'?'Le letture si riferiscono allo stesso punto di polarizzazione del generatore.':'Le curve e le misure si riferiscono all’ultimo periodo simulato.';
 }
 function readCursor(row){
  if(!traces)return;
  const read=$('[data-reading]');
  read.hidden=false;
  const output=traces.map(trace=>C.interpolate(trace,row.x,'out'));
  const readings=C.isGate(params.type)?[
   ['IN1',C.interpolate(traces[0],row.x,'vin')],['IN2',C.interpolate(traces[0],row.x,'vin2')],
   ['NOR',output[0]],['NAND',output[1]]
  ]:[['A',output[0]],['B',output[1]]];
  const {xUnit,yUnit}=plot.config;
  read.textContent=format(row.x,xUnit)+' · '+readings.map(([label,value])=>label+' '+format(value,yUnit)).join(' · ');
 }
 function draw(){
  if(!curves)return;
  try{
   const type=params.type,phase=type==='half-wave-rc'&&mode==='frequency';
   const normalized=type==='mos-amplifier'&&normalize.checked,graph=type!=='mos-iv';
   $('[data-chart]').hidden=!graph;
   $('[data-reading]').hidden=true;
   $('[data-note]').textContent=note(phase,normalized);
   renderTable();
   result.hidden=false;
   if(graph){
    traces=curves.map(curve=>C.trace(curve,{analysis,phase,normalized}));
    const series=curves.map(({label},i)=>({key:i?'B':'A',label,color:i?'#af501b':'#3156c9',dash:i?'6 4':undefined,sparse:true}));
    const data=traces.flatMap((rows,i)=>rows.map(({x,out})=>({x,[series[i].key]:out}))).sort((a,b)=>a.x-b.x);
    const bode=analysis==='bode',compensation=C.isCompensation(type);
    $('[data-zero-center]').hidden=bode||normalized;
    const cutoff=type==='inverting'?C.measurements(curves[1],analysis)[1]:undefined;
    const xLabel=bode?'Frequenza':phase?'Frazione del periodo':compensation?'Tempo dall’inizio dell’impulso':
     ['rc','shaper-buffer'].includes(type)?'Tempo':'Tempo nell’ultimo periodo';
    plot.set({data,series,scope:true,scopeKey:revision,sharedAutoY:true,centerManualYAtZero:!bode&&!normalized&&zero.checked,xLabel,xUnit:bode?'Hz':phase?'':'s',logX:bode,
     yLabel:bode?'Modulo':normalized?'(OUT − media) / Vpp IN':compensation?'OUT − baseline':'OUT',
     yUnit:bode?'dB':normalized?'V/V':'V',plainY:bode,noZero:bode||type==='half-wave-rc',
     guides:compensation?[{x:referenceTime(),label:'10 tₛₕ'}]:Number.isFinite(cutoff)?[{x:cutoff,label:'−3 dB · B'}]:[]});
   }
   status.textContent=curves.some(curve=>curve.values?.settled===false)
    ? 'Il ripple e la media possono ancora variare. Almeno una curva è in assestamento.' : '';
  }catch(error){result.hidden=true;status.textContent=error.message;}
 }

 async function calculate(){
  const ticket=++revision;
  tasks.cancel();curves=null;result.hidden=true;
  status.textContent='Calcolo delle due curve…';
  try{
   const next=[];
   const cases=C.setup(doc,params,mode);
   analysis=C.analysisFor(params.type,mode);
   renderLegend(cases);
   for(const trial of cases){
    const errors=L.validate(trial.params);
    if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);
    const output=await tasks.run('guidedResult',{params:trial.params,analysis});
    if(ticket!==revision)return;
    next.push({...trial,...output});
   }
   curves=next;
   draw();
  }catch(error){if(ticket===revision)status.textContent=error.message;}
 }

 button.addEventListener('click',()=>{
  if(lab.snapshot()===null){window.circuitEditor.note('Correggi i valori prima di confrontare le curve.',true);return;}
  doc=lab.document();params=lab.parameters();
  $('[data-amplifier]').hidden=params.type!=='mos-amplifier';
  $('#transientCompareTitle').textContent=C.titles[params.type];
  $('[data-context]').textContent=context();
  const choices=modes[params.type]||[];
  mode=choices[0]?.[0]||'';
  $('[data-modes]').hidden=!choices.length;
  $('[data-options]').replaceChildren(...choices.map(([value,text])=>{
   const label=document.createElement('label'),input=document.createElement('input');
   input.type='radio';input.name='lab-comparison-mode';input.value=value;input.checked=value===mode;
   label.append(input,text);return label;
  }));
  normalize.checked=false;zero.checked=false;
  if(!plot){
   plot=new window.LabPlot($('#transientComparePlot'),readCursor);
   plot.controls.hidden=true;
  }
  dialog.showModal();
  calculate();
 });
 $('[data-options]').addEventListener('change',event=>{mode=event.target.value;calculate();});
 normalize.addEventListener('change',draw);
 zero.addEventListener('change',()=>{
  plot.config.centerManualYAtZero=zero.checked;
  plot.draw();
 });
 $('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  revision++;tasks.cancel();curves=null;result.hidden=true;
  button.focus({preventScroll:true});
 });
})();
