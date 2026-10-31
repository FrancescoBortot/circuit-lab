/* A value undo belongs to its original object and editing context. */
(() => {
 'use strict';
 const T=window.StudentTools,selector='input[data-field],input[data-free-field],input[data-bb-field]',before=new WeakMap();
 const feedback=document.createElement('div');feedback.className='student-quantity-feedback';feedback.setAttribute('role','status');feedback.hidden=true;
 document.querySelector('.workbench-flow').after(feedback);let last=null;
 const key=()=>{const e=window.circuitEditor,d=window.StudentUI.current();return d.mode==='free'?'free:'+e.projectEpoch:'guided:'+window.GuidedLab.projectEpoch()+':'+d.experiment;};
 const clear=()=>{feedback.hidden=true;last=null;};
 const get=(object,path)=>path.split('.').reduce((o,k)=>o?.[k],object);
 const same=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-24,Math.abs(b)*1e-11);
 document.addEventListener('focusin',e=>{
  const input=e.target;if(!input.matches(selector))return;
  before.set(input,{value:T.readQuantity(input),context:key(),panel:document.getElementById('inspectorContent').dataset.panel,
   bb:input.matches('[data-bb-field]')?{id:window.BreadboardWorkbench.editOwner(input),key:input.dataset.bbField,context:window.BreadboardWorkbench.contextId()}:null,
   free:input.matches('[data-free-field]')?{id:window.circuitEditor.selection?.id,scope:input.dataset.scope,path:input.dataset.freeField}:null});
 });
 function restore(edit){
  if(edit.context!==key())throw Error('Il progetto è cambiato: questa modifica non è più annullabile qui.');
  if(edit.bb){const q=edit.bb;if(!window.BreadboardWorkbench.restoreQuantity(q.id,q.key,edit.value,q.context))throw Error('Correggi il valore sul banco prima di annullare.');return;}
  if(edit.free){
   const e=window.circuitEditor,q=edit.free;if(!e.readFields(false))throw Error('Correggi il campo evidenziato prima di annullare.');
   const locate=doc=>q.scope==='settings'?doc.settings:q.scope==='wire'?doc.wires.find(w=>w.id===q.id):doc.components.find(c=>c.id===q.id);
   if(!same(get(locate(e.doc),q.path),edit.after))throw Error('Il valore originale è cambiato ancora: usa Annulla nell’editor.');
   const electrical=q.scope==='settings'||(q.scope==='wire'?!['offset','route'].includes(q.path):!['x','y','rotation'].includes(q.path));
   if(!e.change(doc=>{const object=locate(doc),parts=q.path.split('.'),tail=parts.pop();let parent=object;for(const k of parts)parent=parent[k];parent[tail]=edit.value;},true,electrical))throw Error(e.fieldError||'Modifica non accettata.');
   return;
  }
  let target=edit.id?document.getElementById(edit.id):edit.element;
  if(!target?.isConnected&&edit.panel){if(!window.GuidedLab.focusPanel(edit.panel))throw Error('Correggi il campo evidenziato prima di annullare.');target=edit.id?document.getElementById(edit.id):edit.element;}
  if(!target?.isConnected)throw Error('Riapri il pannello con il campo originale per annullare.');
  const unit=target.parentElement.querySelector('select'),scale=unit?Number(unit.value):Number(target.dataset.factor||1);
  target.value=String(edit.value/scale);target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));
 }
 document.addEventListener('change',e=>{
  const input=e.target;if(!input.matches(selector))return;const n=T.readQuantity(input);if(!Number.isFinite(n))return;
  const select=input.parentElement.querySelector('select'),factor=select?Number(select.value):Number(input.dataset.factor||1),label=select?.selectedOptions?.[0]?.textContent||input.parentElement.querySelector('span')?.textContent||'';
  input.value=String(Number((n/factor).toPrecision(12)));feedback.replaceChildren();
  const text=document.createElement('span');text.textContent='Interpretato: '+input.value+' '+label+(label.includes('pp')?' · ampiezza picco-picco':'');feedback.append(text);feedback.hidden=false;
  const prior=before.get(input);last={id:input.id,element:input,value:prior?.value,after:n,bb:prior?.bb,free:prior?.free,panel:prior?.panel,context:prior?.context||key()};
  if(Number.isFinite(last.value)){
   const button=document.createElement('button');button.textContent='Annulla questa modifica';
   button.addEventListener('click',()=>{const edit=last;try{if(!edit)return;restore(edit);clear();}catch(error){text.textContent=error.message;}});feedback.append(button);
  }
 },true);
 document.addEventListener('student-context-updated',()=>{if(last&&last.context!==key())clear();});
 document.addEventListener('circuit-lab-mode',clear);
 document.addEventListener('click',e=>{if(e.target.closest('#openProject,#newCircuit,#freeBlank,[data-experiment]'))clear();},true);
})();
