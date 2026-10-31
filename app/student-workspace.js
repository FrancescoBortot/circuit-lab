/* Student workspace: presentation state is independent from the electrical document. */
(() => {
 'use strict';const M=window.FreeModel,L=window.LabModel,panels=new Map();let queued=false;
 const current=()=>window.circuitEditor?.active?M.clone(window.circuitEditor.doc):window.GuidedLab.document();
 function heading(host){const header=document.createElement('header');header.className='student-context';const label=document.createElement('strong'),detail=document.createElement('span');header.append(label,detail);host.prepend(header);return{header,label,detail};}
 for(const selector of ['#appLayout .workbench','#freeWorkspace .free-center']){const host=document.querySelector(selector);if(host)panels.set(selector,heading(host));}
 function update(){queued=false;const doc=current(),free=doc.mode==='free',catalog=free?null:L.CATALOG.find(c=>c.id===doc.experiment),phase=['Costruisci','Simula','Misura','Esporta'][Number(document.body.dataset.workflowStep)||0];document.body.classList.add('student-workbench');for(const[selector,p]of panels){if(selector.includes('freeWorkspace')!==free)continue;p.label.textContent=free?doc.name:catalog.name;p.detail.textContent=(free?'Editor libero':'Giornata '+catalog.day+' · esperienza '+catalog.step)+' · '+phase;}document.dispatchEvent(new CustomEvent('student-context-updated',{detail:{free,phase}}));}
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};for(const event of ['guided-lab-state','circuit-lab-document','circuit-lab-mode','student-workflow'])document.addEventListener(event,schedule);
 window.StudentUI={current,update,schedule};update();
})();
