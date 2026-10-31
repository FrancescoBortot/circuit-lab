/* Discoverable advanced settings, without hiding any analysis or component type. */
(() => {
 'use strict';const hosts=[document.getElementById('inspectorContent'),document.getElementById('freeInspectorContent')].filter(Boolean);
 function decorate(host){const sections=[...host.querySelectorAll('details')].filter(d=>/risoluzione|alimentazione|precisione|modelli|energia|nomi dei nodi|confronti e dati/i.test(d.querySelector('summary')?.textContent||''));for(const d of sections){d.dataset.studentAdvanced='';const s=d.querySelector('summary');if(!s.dataset.studentLabel){s.dataset.studentLabel=s.textContent;s.textContent='Avanzate · '+s.textContent;}}
 let bar=host.querySelector('.student-controls-bar');if(!bar){bar=document.createElement('div');bar.className='student-controls-bar';const b=document.createElement('button');b.type='button';b.textContent='Apri impostazioni avanzate';b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')!=='true';for(const d of host.querySelectorAll('[data-student-advanced]'))d.open=open;b.setAttribute('aria-expanded',String(open));b.textContent=open?'Richiudi impostazioni avanzate':'Apri impostazioni avanzate';});bar.append(b);host.prepend(bar);}bar.hidden=!sections.length;
 }
 for(const host of hosts){let queued=false;const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;decorate(host);});}};new MutationObserver(schedule).observe(host,{childList:true,subtree:true});decorate(host);}
})();
