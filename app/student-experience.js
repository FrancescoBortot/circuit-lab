(() => {
 'use strict';

 function choose(key){
  try{
   if(window.BreadboardWorkbench.isActive()&&!window.BreadboardWorkbench.prepare())return false;
   const lab=window.GuidedLab;
   if(lab.document().experiment==='preamp'&&key==='linearity'){
    window.PreampSheet.open();
    return false;
   }
   return lab.applyBreadboardPreset(key);
  }catch(error){
   window.circuitEditor.note(error.message,true);
   return false;
  }
 }

 window.StudentExperience={choose};
 const menu=document.getElementById('sheetPresetMenu');
 const summary=document.getElementById('sheetPreset');
 document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;summary.focus();}
 });
 document.querySelector('.sheet-preset').addEventListener('click',event=>{
  const button=event.target.closest('[data-sheet-preset]');
  if(!button)return;
  if(menu.contains(button)){menu.open=false;summary.focus({preventScroll:true});}
  choose(button.dataset.sheetPreset);
 });
 document.addEventListener('change',event=>{
  const select=event.target;
  if(!select.matches('[data-bb-preset]')||!select.value)return;
  event.stopImmediatePropagation();
  const lab=window.GuidedLab,L=window.LabModel;
  // Restore the active label during validation and while editing the dedicated linearity study.
  const key=select.value;
  select.value=window.GuidedTrials.current(lab.document(),L.CATALOG).preset;
  choose(key);
 },true);
})();
