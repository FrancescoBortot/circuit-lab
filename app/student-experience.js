(() => {
 'use strict';
 const T=window.StudentTools,L=window.LabModel,F=window.LabFiles;

 function preview(key,restore){
  try{
   if(window.BreadboardWorkbench.isActive()&&!window.BreadboardWorkbench.prepare()){restore();return;}
   if(window.GuidedLab.snapshot()===null){restore();return;}
   const before=window.GuidedLab.document();
   if(before.experiment==='preamp'&&key==='linearity'){restore();window.PreampSheet.open();return;}
   const next=window.GuidedLab.previewPreset(key);
   const type=L.CATALOG.find(c=>c.id===before.experiment).type;
   const rows=T.diff({analysis:before.analysis,...before.circuits[type]},{analysis:next.analysis,...next.circuits[type]});
   const hint=L.semiconductor.presetHint(type,key);
   const label=window.GuidedTrials.PRESETS[type].find(([k])=>k===key)[1];
   const dialog=document.createElement('dialog');
   dialog.className='workbench-dialog';
   dialog.setAttribute('aria-labelledby','sheetPreviewTitle');
   dialog.innerHTML='<div class="dialog-heading"><h2 id="sheetPreviewTitle">Anteprima della prova</h2></div><p>'+F.esc(label)+'</p>'+
    (hint?'<p class="sheet-preset-advice">'+F.esc(hint)+'</p>':'')+
    (rows.length?'<div class="student-table"><table><thead><tr><th>Parametro</th><th>Prima</th><th>Dopo</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+F.esc(T.settingLabel(r.path))+'</td><td>'+F.esc(T.settingValue(r.path,r.before,L.format))+'</td><td>'+F.esc(T.settingValue(r.path,r.after,L.format))+'</td></tr>').join('')+
      '</tbody></table></div>':'<p>I parametri attuali corrispondono già alla prova.</p>')+
    '<div class="flow-actions"><button data-apply>Applica prova</button><button data-cancel autofocus>Annulla</button></div>';
   dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-cancel]'))dialog.close();
    if(!event.target.closest('[data-apply]'))return;
    const current=window.GuidedLab.document();
    if(current.experiment!==before.experiment||window.StudyContext.stamp(current)!==window.StudyContext.stamp(before)){
     dialog.querySelector('p').textContent='Il circuito è cambiato. Chiudi e riapri la prova.';
     return;
    }
    window.GuidedLab.applyBreadboardPreset(key);dialog.close();
   });
   dialog.addEventListener('close',()=>{dialog.remove();restore();});
   document.body.append(dialog);dialog.showModal();
  }catch(error){restore();window.circuitEditor.note(error.message,true);}
 }

 window.StudentExperience={preview};
 const menu=document.getElementById('sheetPresetMenu');
 document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;document.getElementById('sheetPreset').focus();}
 });
 document.querySelector('.sheet-preset').addEventListener('click',event=>{
  const button=event.target.closest('[data-sheet-preset]');
  if(!button)return;
  const menu=button.closest('details');
  if(menu)menu.open=false;
  preview(button.dataset.sheetPreset,()=>(menu?.querySelector('summary')||button).focus({preventScroll:true}));
 });
 document.addEventListener('change',event=>{
  const select=event.target;
  if(!select.matches('[data-bb-preset]')||!select.value)return;
  event.stopImmediatePropagation();
  preview(select.value,()=>{select.value=window.GuidedTrials.current(window.GuidedLab.document(),L.CATALOG).preset;});
 },true);
})();
