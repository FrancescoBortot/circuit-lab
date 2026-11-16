(() => {
 'use strict';
 const lab=window.GuidedLab,board=window.BreadboardWorkbench,guide=window.MeasurementGuide;
 const $=s=>document.querySelector(s),button=$('#openMeasureGuide');
 const panel=document.createElement('section');
 panel.id='measurementGuide';panel.className='measurement-guide';panel.hidden=true;
 panel.setAttribute('aria-labelledby','measurementGuideTitle');
 panel.innerHTML=`
  <div class="measurement-guide-head">
   <h2 id="measurementGuideTitle">Dove mettere i puntali</h2>
   <button type="button" data-close aria-label="Chiudi guida ai puntali">×</button>
  </div>
  <div class="measurement-guide-controls">
   <label>Misura <select data-measure-choice></select></label>
   <button type="button" data-next>Passo successivo</button>
  </div>
  <p data-measure-mode></p>
  <ol data-measure-points></ol>
  <p data-measure-detail></p>
  <p data-measure-board></p>
  <button type="button" data-meter-compare hidden>Confronta l’effetto del voltmetro</button>
  <form class="measurement-guide-entry" hidden>
   <label>Lettura al banco <input id="meterReading" type="text" inputmode="decimal" aria-describedby="meterStatus"></label>
   <label>Unità <select id="meterUnit"></select></label>
   <button type="submit">Annota nel quaderno</button>
   <button type="button" data-use-value hidden>Usa nel modello</button>
  </form>
  <p id="meterStatus" role="status"></p>`;
 const field=s=>panel.querySelector(s);
 const choice=field('[data-measure-choice]'),reading=field('#meterReading'),unit=field('#meterUnit');
 const schematicStage=$('#schematicStage'),boardWrap=$('.bb-board-wrap');
 const status=field('#meterStatus');
 const boardWorkbench=$('.bb-workbench');
 let active=false,scope='',currentId='',steps=[],location=null,frame=null;
 const unitOptions={V:[[1,'V'],[1e-3,'mV']],A:[[1e-3,'mA'],[1e-6,'µA'],[1,'A']],
  Ω:[[1,'Ω'],[1e3,'kΩ'],[1e6,'MΩ']],F:[[1e-9,'nF'],[1e-12,'pF'],[1e-6,'µF'],[1e-3,'mF']]};
 const colors=['#af2755','#245a96','#526071','#087d65'];
 const ns='http://www.w3.org/2000/svg';
 function element(name,attributes){
  const el=document.createElementNS(ns,name);
  for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));
  return el;
 }
 function clearMarkers(){
  for(const el of document.querySelectorAll('.measurement-probe-markers'))el.remove();
 }
 function markers(root,points,wire=''){
  if(!root)return;
  const overlay=element('g',{'class':'measurement-probe-markers','aria-hidden':true,'pointer-events':'none'});
  if(wire)overlay.append(element('path',{d:wire,'class':'measurement-probe-wire'}));
  points.forEach((p,i)=>{
   if(!p.point)return;
   const {x,y}=p.point,color=colors[i];
   overlay.append(element('circle',{cx:x,cy:y,r:10,stroke:color,'class':'measurement-probe-ring'}));
   const tag=element('text',{x:x+13,y:y-11,fill:color,'class':'measurement-probe-tag'});
   tag.textContent=String(i+1);overlay.append(tag);
  });
  root.append(overlay);
 }
 function wirePath(drawing,from,to){
  if(!drawing.doc)return '';
  const wires=drawing.doc.wires,visited=new Map([[from,null]]),queue=[from];
  for(let i=0;i<queue.length&&!visited.has(to);i++){
   const pin=queue[i];
   for(const wire of wires){
    const next=wire.a===pin?wire.b:wire.b===pin?wire.a:null;
    if(next&&!visited.has(next)){visited.set(next,{pin,wire});queue.push(next);}
   }
  }
  const paths=[];
  if(visited.has(to))for(let pin=to;pin!==from;){
   const edge=visited.get(pin);paths.push(drawing.wire(edge.wire));pin=edge.pin;
  }
  return paths.join(' ');
 }
 function draw(step,onBoard){
  clearMarkers();
  location=null;
  if(onBoard){
   if(step.series&&boardWorkbench.dataset.step!=='3')return 'Per vedere il collegamento da interrompere, seleziona la vista completa del montaggio.';
   const model=board.measurementReference(),resolved=guide.boardPoints(model,step);
   if(!resolved)return 'Il collegamento non è disponibile nella vista di riferimento attuale.';
   location=resolved;
   const cable=resolved.cable?.route.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
   markers(boardWrap.querySelector('svg'),resolved.points,cable);
   if(resolved.detail)return resolved.detail;
   if(resolved.points.some(p=>!p.point))return 'Alcuni collegamenti non sono disponibili nel montaggio visualizzato.';
   if(step.parameter)return 'Per questa misura usa il componente isolato. I riferimenti evidenziano i suoi terminali.';
   return resolved.points.some(p=>p.sameStrip)?'Per i terminali occupati usa il contatto del componente sulla stessa fila.':'Fori indicati sulla breadboard di riferimento.';
  }
  const drawing=lab.measurementDrawing();
  if(!drawing?.root)return '';
  const resolve=ref=>ref==='@out'?drawing.doc?.probes.output:ref;
  const points=step.points.map(p=>({...p,point:resolve(p.ref)?drawing.pin(resolve(p.ref)):null}));
  const wire=step.series?wirePath(drawing,points[0].ref,points[1].ref):'';
  markers(drawing.root,points,wire);
  return '';
 }
 function close(restore=false){
  active=false;panel.hidden=true;clearMarkers();
  button.setAttribute('aria-expanded','false');
  if(restore)(button.getClientRects().length?button:$('.guided-view-tools [aria-pressed="true"]'))?.focus({preventScroll:true});
 }
 function update(){
  const onBoard=board.isActive(),free=window.circuitEditor.active;
  const doc=lab.document(),params=lab.parameters(),key=doc.session?.id+':'+doc.experiment;
  const next=free?[]:guide.forCircuit(params);
  button.hidden=!next.length||onBoard&&boardWorkbench.classList.contains('physical-mode');
  if(scope!==key){if(scope)close();scope=key;currentId='';}
  if(!active||button.hidden){
   panel.hidden=true;clearMarkers();return;
  }
  const host=onBoard?boardWrap:schematicStage;
  if(panel.nextSibling!==host)host.before(panel);
  panel.hidden=false;
  const changed=steps.map(s=>s.id).join()!==next.map(s=>s.id).join()||!next.some(s=>s.id===currentId);
  steps=next;
  if(changed){
   if(!steps.some(s=>s.id===currentId))currentId=steps[0].id;
   choice.replaceChildren(...steps.map(step=>{
    const option=document.createElement('option');option.value=step.id;option.textContent=step.title;return option;
   }));
   choice.value=currentId;
  }
  const step=steps.find(s=>s.id===currentId);
  if(unit.dataset.measure!==step.id||unit.dataset.base!==step.units){
   reading.value='';status.textContent='';
   unit.dataset.measure=step.id;unit.dataset.base=step.units||'';
   unit.replaceChildren(...(unitOptions[step.units]||[]).map(([factor,label])=>{
    const option=document.createElement('option');option.value=String(factor);option.textContent=label;return option;
   }));
  }
  const nextButton=field('[data-next]');
  nextButton.hidden=steps.indexOf(step)===steps.length-1;
  field('form').hidden=!step.units;
  field('[data-use-value]').hidden=!step.parameter;
  field('[data-meter-compare]').hidden=!['gate-before','gate-after'].includes(step.id);
  field('[data-measure-mode]').textContent=step.mode;
  field('[data-measure-detail]').textContent=step.detail||'Collega i puntali ai punti evidenziati.';
  field('[data-measure-board]').textContent=draw(step,onBoard);
  field('[data-measure-points]').replaceChildren(...step.points.map((p,i)=>{
   const li=document.createElement('li'),where=location?.points[i];
   const label=document.createElement('strong');label.textContent=p.role;
   li.style.setProperty('--probe-color',colors[i]);
   li.append(label,' '+p.label+(where?.hole?' · '+where.hole:where?.label&&where.label!==p.label?' · '+where.label:''));
   return li;
  }));
 }
 function schedule(){if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;update();});}
 button.addEventListener('click',()=>{
  if(active&&!panel.hidden){close(true);return;}
  if(lab.snapshot()===null){window.circuitEditor.note('Correggi i valori prima di aprire la guida.',true);return;}
  active=true;
  button.setAttribute('aria-expanded','true');
  update();
  if(!panel.hidden){panel.scrollIntoView({block:'nearest'});choice.focus({preventScroll:true});}
 });
 choice.addEventListener('change',()=>{currentId=choice.value;update();});
 field('[data-next]').addEventListener('click',()=>{
  currentId=steps[steps.findIndex(s=>s.id===currentId)+1].id;choice.value=currentId;update();choice.focus({preventScroll:true});
 });
 field('[data-close]').addEventListener('click',()=>close(true));
 field('[data-meter-compare]').addEventListener('click',()=>$('#compareLabTransients').click());
 function measuredValue(){
  const value=window.StudentTools.quantity(reading.value,Number(unit.value),unit.selectedOptions[0]?.textContent);
  if(!Number.isFinite(value)||(['Ω','F'].includes(unit.dataset.base)&&value<0))throw Error('Inserisci una lettura valida.');
  return value;
 }
 field('form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const value=measuredValue(),doc=lab.document(),step=steps.find(s=>s.id===currentId);
   const N=window.NotebookModel,key='guided:'+doc.experiment;
   const study=doc.notebookStudy||N.empty(crypto.randomUUID?.()||doc.session.id);
   const page=N.page(study,key),trial=window.GuidedTrials.current(doc,window.LabModel.CATALOG);
   const positions=step.points.map((p,i)=>p.role+' '+p.label+(location?.points[i]?.hole?' ('+location.points[i].hole+')':''));
   if(location?.detail)positions.push(location.detail);
   const stamp=new Date().toLocaleString('it-IT');
   const note=stamp+' · '+step.title+' · '+window.LabModel.format(value,step.units,8)+' · '+positions.join(' / ')+(trial.label?' · '+trial.label:'');
   lab.updateStudies({notebookStudy:N.notes(study,key,{note:[page.note,note].filter(Boolean).join('\n')})});
   document.dispatchEvent(new CustomEvent('guided-bench-note',{detail:{key,id:study.id}}));
   status.textContent='Lettura e posizione salvate nelle Note del quaderno.';
  }catch(error){status.textContent=error.message;}
 });
 field('[data-use-value]').addEventListener('click',()=>{
  try{
   const step=steps.find(s=>s.id===currentId),value=measuredValue();
   if(lab.editBreadboard({[step.parameter]:value}))status.textContent='Valore applicato al componente nella simulazione.';
  }catch(error){status.textContent=error.message;}
 });
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.target.matches('select,input')){event.preventDefault();event.stopPropagation();close(true);}
 });
 for(const event of ['guided-lab-state','circuit-lab-mode','circuit-lab-view','student-context-updated'])document.addEventListener(event,schedule);
 const observer=new MutationObserver(records=>{
  if(!active)return;
  if(records.some(record=>record.type==='attributes'||[...record.addedNodes,...record.removedNodes].some(node=>!node.classList?.contains('measurement-probe-markers'))))schedule();
 });
 for(const selector of ['#schematic','#realSchematic','.bb-board-wrap'])observer.observe($(selector),{childList:true});
 observer.observe(boardWorkbench,{attributes:true,attributeFilter:['hidden','class']});
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 update();
})();
