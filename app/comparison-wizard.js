/* Preview and validate the actual import settings without saving observations. */
(() => {
 'use strict';
 function install(dialog,{saved=false,dirty=()=>{},validate=()=>{}}={}){
  const $=s=>dialog.querySelector(s),fields=[...dialog.querySelectorAll('.comparison-fields')],steps=[0,1,2].map(()=>document.createElement('section'));
  const nav=document.createElement('nav'),preview=document.createElement('div'),status=$('[data-cmp-status]');let active=saved?2:0;
  nav.className='student-import-steps';nav.setAttribute('aria-label','Passaggi del confronto dati');
  steps.forEach((s,i)=>{s.className='student-import-step';s.dataset.importStep=String(i);});
  const note=document.createElement('p');note.textContent='Una tabella salvata per circuito e tipo di analisi. Riaprendo questo pannello ritrovi i dati: puoi ricalcolare il confronto senza reimportarli. Per sostituirli, carica un altro file o modifica il testo e salva.';steps[0].append(note);steps[0].append(fields[0],$('[data-cmp-raw]'));const instrumentNote=$('[data-cmp-instrument]');if(instrumentNote)steps[0].append(instrumentNote);steps[1].append(fields[1]);const baselineFields=$('[data-cmp-baseline-fields]');if(baselineFields)steps[1].append(baselineFields);
  const independent=$('[data-cmp-independent]')?.closest('label');if(independent)steps[1].append(independent);steps[1].append(preview);
  for(const selector of ['.comparison-kind-note','.flow-actions','[data-cmp-summary]','.comparison-table']){const el=$(selector);if(el)steps[2].append(el);}
  for(const el of [...dialog.querySelectorAll('.comparison-plot')]){
   const table=steps[2].querySelector('.comparison-table'),scope=el.previousElementSibling;
   const cursor=scope?.classList.contains('plot-scope-controls')?scope.previousElementSibling:scope;
   if(cursor?.classList.contains('cursor-toolbar'))steps[2].insertBefore(cursor,table);
   if(scope?.classList.contains('plot-scope-controls'))steps[2].insertBefore(scope,table);
   steps[2].insertBefore(el,table);
  }
  const controls=document.createElement('div'),back=document.createElement('button'),next=document.createElement('button');
  controls.className='flow-actions';back.textContent='← Indietro';next.textContent='Continua →';controls.append(back,next);
  $('.dialog-heading').after(nav);dialog.append(...steps,controls,status);status.setAttribute('role','status');
  function renderPreview(){
   const raw=$('[data-cmp-raw]').value;if(new TextEncoder().encode(raw).length>200000)throw Error('Dati ammessi fino a 200 kB.');
   const delimiter=$('[data-cmp-delimiter]').value,table=window.RCAnalysis.rows(raw,delimiter==='tab'?'\t':delimiter),header=$('[data-cmp-header]').checked;
   if(table.rows.length<(header?3:2))throw Error('Inserisci almeno due righe di dati oltre all’eventuale intestazione.');
   const instrument=window.RCAnalysis.instrumentTable(window.RCAnalysis.rows(raw));
   const hints=header?window.StudentTools.columnHints(table.rows[0],$('[data-cmp-kind]').value):null;
   preview.replaceChildren();const p=document.createElement('p'),wrap=document.createElement('div'),tableNode=document.createElement('table');
   p.textContent=instrument?window.RCAnalysis.instrumentSummary(instrument)+' Anteprima dei primi 8 campioni (s, V), inclusa la prima riga del file.':'Anteprima delle prime 8 righe. Separatore rilevato: '+(table.delimiter==='\t'?'tab':table.delimiter)+'. Controlla colonne e unità.';
   wrap.className='student-table';for(const row of (instrument?[['Tempo (s)','Tensione (V)'],...instrument.points.slice(0,8).map(p=>[p.x,p.y])]:table.rows.slice(0,8))){
    const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}tableNode.append(tr);
   }
   wrap.append(tableNode);const use=document.createElement('button');use.textContent='Usa colonne e unità suggerite';use.disabled=!header||Boolean(instrument);
   if(!header)use.title='Senza intestazioni scegli manualmente colonne e unità.';
   use.addEventListener('click',()=>{
    if(!hints||instrument)return;
    for(const[key,name]of [['xColumn','x'],['yColumn','y'],['sigmaColumn','sigma'],['phaseColumn','phase']])$('[data-cmp-'+name+']').value=hints[key]===null?'':hints[key]+1;
    for(const[key,name]of [['xUnit','xunit'],['yUnit','yunit']])if(hints[key]&&[...$('[data-cmp-'+name+']').options].some(o=>o.value===hints[key]))$('[data-cmp-'+name+']').value=hints[key];
    if(table.delimiter!==','&&table.rows.slice(header?1:0).some(row=>row.some(v=>/^[-+]?\d+,\d+(?:e[-+]?\d+)?$/i.test(v))))$('[data-cmp-decimal]').value=',';
    dirty();status.textContent='Suggerimenti applicati ai campi: controllali. I dati non sono ancora salvati.';
   });
   preview.append(p,wrap,use);
  }
  function show(index){
   try{
    if(index===1)renderPreview();if(index===2)validate();active=index;
    steps.forEach((s,i)=>s.hidden=i!==active);for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',Number(b.dataset.step)===active?'step':'false');
    back.disabled=active===0;next.hidden=active===2;status.textContent='';
   }catch(error){status.textContent=error.message;}
  }
  for(const[label,i]of [['1 · Scegli i dati',0],['2 · Colonne e unità',1],['3 · Salva e confronta',2]]){
   const b=document.createElement('button');b.textContent=label;b.dataset.step=String(i);b.addEventListener('click',()=>show(i));nav.append(b);
  }
  dialog.addEventListener('change',e=>{
   if(active===1&&e.target.matches('[data-cmp-delimiter],[data-cmp-header],[data-cmp-kind]'))try{renderPreview();}catch(error){preview.replaceChildren();status.textContent=error.message;}
  });
  back.addEventListener('click',()=>show(Math.max(0,active-1)));next.addEventListener('click',()=>show(Math.min(2,active+1)));show(active);return{show};
 }
 window.ComparisonWizard={install};
})();
