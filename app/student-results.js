(() => {
 'use strict';
 const panels=new Map(),F=window.LabModel.format;
 for(const [free,selector] of [[false,'#appLayout .plot-bottom'],[true,'#freeWorkspace .free-results-bottom']]){
  const readout=document.querySelector(selector),details=document.createElement('details');
  const summary=document.createElement('summary'),box=document.createElement('div');
  const scope=readout.parentElement.querySelector('.plot-scope-controls');
  const timeline=free?null:document.getElementById('timeline');
  details.className='graph-details';summary.textContent='Misure e controlli del grafico';
  box.className='student-result-metrics';box.setAttribute('aria-label','Letture principali della curva');
  details.append(summary,box,scope);
  if(timeline){
   details.append(timeline);
   details.addEventListener('toggle',()=>{if(!details.open)document.dispatchEvent(new Event('student-plot-details-closed'));});
  }
  readout.after(details);panels.set(free,{details,box,scope});
 }
 let queued=false;
 function update(){
  queued=false;
  const e=window.circuitEditor,free=e.active;
  const config=free?(e.result&&!e.busy&&!e.fieldError&&e.plot.data.length&&e.lastPlotAnalysis===e.doc.settings.analysis?e.plot.config:null):window.GuidedLab.plotSnapshot();
  const rows=window.StudentTools.readings(config?{...config,pulse:config.pulse||(free&&e.doc.settings.analysis==='time'?window.LabMeasurements.excitation(e.doc):null)}:null);
  const {details,box,scope}=panels.get(free),key=JSON.stringify(rows);
  details.hidden=!rows.length&&scope.hidden;
  box.hidden=!rows.length;
  if(box.dataset.readingsKey===key)return;
  box.dataset.readingsKey=key;box.replaceChildren();
  for(const row of rows){
   const button=document.createElement('button'),title=document.createElement('span'),value=document.createElement('strong');
   title.textContent=row.label;value.textContent=F(row.value,row.unit,5);
   button.append(title,value);button.title='Mostra questo campione sulla curva';
   button.addEventListener('click',()=>{
    if(free){if(!e.result||e.busy||e.fieldError)return;e.plot.inspectSample(row.index);}
    else window.GuidedLab.inspectSample(row.index);
   });
   box.append(button);
  }
 }
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};for(const event of ['student-context-updated','circuit-lab-result'])document.addEventListener(event,schedule);const observer=new MutationObserver(schedule);for(const id of ['calculationStatus','freeResultStatus','freeFieldError'])observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});document.addEventListener('click',e=>{if(e.target.closest('[data-trace],[data-free-trace]')){schedule();document.dispatchEvent(new Event('student-plot-view'));}});document.addEventListener('change',e=>{if(e.target.matches('#freeQuantity,#freeDCX,#freePhysicalPart')){schedule();document.dispatchEvent(new Event('student-plot-view'));}});update();window.StudentResults={update};
})();
