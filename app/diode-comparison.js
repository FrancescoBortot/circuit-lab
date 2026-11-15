(() => {
 'use strict';
 const L=window.LabModel,lab=window.GuidedLab;
 const button=document.getElementById('compareDiodeResistors');
 const dialog=document.createElement('dialog');
 dialog.className='workbench-dialog diode-comparison';
 dialog.setAttribute('aria-labelledby','diodeCompareTitle');
 dialog.innerHTML=`
  <div class="dialog-heading">
   <h2 id="diodeCompareTitle">Confronta due resistenze del diodo</h2>
   <button type="button" class="icon-button" data-close aria-label="Chiudi il confronto">×</button>
  </div>
  <div class="diode-comparison-controls">
   <label>R₁ · curva A<select id="diodeCompareA"></select></label>
   <label>R₁ · curva B<select id="diodeCompareB"></select></label>
   <label>Asse orizzontale<select id="diodeCompareAxis"><option value="x">Tensione sul diodo Vᴅ</option><option value="source">Tensione del generatore Vɢ</option></select></label>
  </div>
  <p id="diodeCompareModel"></p>
  <p id="diodeCompareStatus" role="status"></p>
  <section id="diodeCompareResult" aria-label="Curve simulate a confronto" hidden>
   <div id="diodeCompareLegend" class="ps-legend"></div>
   <div class="diode-comparison-plot"><svg id="diodeComparePlot" role="img" aria-label="Corrente del diodo per le due resistenze"></svg></div>
   <p id="diodeCompareNote"></p>
   <p id="diodeCompareReading" class="diode-comparison-reading"></p>
  </section>`;
 document.body.append(dialog);
 const $=id=>document.getElementById(id),a=$('diodeCompareA'),b=$('diodeCompareB'),axis=$('diodeCompareAxis');
 const model=$('diodeCompareModel'),status=$('diodeCompareStatus'),legend=$('diodeCompareLegend'),result=$('diodeCompareResult');
 const tasks=new window.CircuitTasks(),format=(value,unit)=>L.format(value,unit,4);
 let params,curves,revision=0,plot;

 function draw(){
  if(!curves)return;
  const key=axis.value,diodeVoltage=key==='x',xLabel=axis.selectedOptions[0].textContent;
  const series=curves.map(({resistance},index)=>({
   key:index?'B':'A',label:(index?'B':'A')+' · R₁ = '+format(resistance,'Ω'),
   color:index?'#af501b':'#3156c9',dash:index?'6 4':undefined,sparse:true
  }));
  const data=curves.flatMap(({data},index)=>data.map(row=>({x:row[key],[series[index].key]:row.out}))).sort((p,q)=>p.x-q.x);
  legend.replaceChildren(...series.map(trace=>{
   const item=document.createElement('span'),swatch=document.createElement('i');
   swatch.className=trace.key==='B'?'comparison-swatch-b':'comparison-swatch-a';item.append(swatch,trace.label);return item;
  }));
  result.hidden=false;
  $('diodeCompareNote').textContent=diodeVoltage
   ? 'Le curve Iᴅ(Vᴅ) si sovrappongono dove entrambe arrivano. R₁ cambia la corrente massima raggiungibile con la sorgente.'
   : 'Alla stessa tensione del generatore, una R₁ maggiore riduce la corrente. La caduta su R₁ è Vɢ − Vᴅ.';
  plot.set({data,series,scope:true,scopeKey:revision+':'+key,sharedAutoY:true,xLabel,xUnit:'V',yLabel:'Iᴅ',yUnit:'A',logY:true,noZero:true});
 }

 async function compare(){
  const ticket=++revision;
  tasks.cancel();curves=null;result.hidden=true;
  const resistances=[Number(a.value),Number(b.value)];
  if(resistances[0]===resistances[1]){
   status.textContent='Scegli due resistenze diverse.';
   return;
  }
  status.textContent='Calcolo delle due curve…';
  try{
   const next=[];
   for(const resistance of resistances){
    const {data}=await tasks.run('guidedResult',{params:{...params,R1:resistance},analysis:'diodeIV'});
    if(ticket!==revision)return;
    next.push({resistance,data});
   }
   curves=next;
   status.textContent=next.map(({resistance,data},i)=>
    (i?'B':'A')+' · '+format(resistance,'Ω')+' → Iᴅ max '+format(data.at(-1).out,'A')
   ).join('  |  ');
   draw();
  }catch(error){
   if(ticket===revision)status.textContent=error.message;
  }
 }

 button.addEventListener('click',()=>{
  if(lab.snapshot()===null){window.circuitEditor.note('Correggi i valori prima di confrontare le curve.',true);return;}
  params=lab.parameters();
  const resistances=L.semiconductor.DIODE_RANGES.map(range=>range.resistance);
  if(!resistances.includes(params.R1))resistances.unshift(params.R1);
  for(const select of [a,b]){
   select.replaceChildren(...resistances.map(value=>{
    const option=document.createElement('option');
    option.value=String(value);option.textContent=format(value,'Ω');return option;
   }));
  }
  a.value=String(params.R1);
  b.value=String(resistances.find(value=>value!==params.R1));
  model.textContent='Stesso modello per A e B · Iₛ = '+format(params.diodeIs,'A')+' · n = '+format(params.diodeN,'')+
   ' · scansione da 1 µA, fino a 20 V di generatore o 10 mA.';
  axis.value='x';
  if(!plot){
   plot=new window.LabPlot($('diodeComparePlot'),row=>{
    $('diodeCompareReading').textContent=format(row.x,'V')+' · '+plot.series.filter(trace=>Number.isFinite(row[trace.key]))
     .map(trace=>trace.key+' '+format(row[trace.key],'A')).join(' · ');
   });
   plot.controls.hidden=true;
  }
  dialog.showModal();
  a.focus();
  compare();
 });
 for(const select of [a,b])select.addEventListener('change',compare);
 axis.addEventListener('change',draw);
 dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  revision++;tasks.cancel();curves=null;result.hidden=true;
  button.focus({preventScroll:true});
 });
})();
