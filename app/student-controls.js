/* Discoverable advanced settings, without hiding any analysis or component type. */
(() => {
 'use strict';const hosts=[document.getElementById('inspectorContent'),document.getElementById('freeInspectorContent')].filter(Boolean);
 function decorate(host){const sections=[...host.querySelectorAll('details')].filter(d=>/risoluzione|alimentazione|precisione|modelli|energia|nomi dei nodi|confronti e dati/i.test(d.querySelector('summary')?.textContent||''));for(const d of sections){d.dataset.studentAdvanced='';const s=d.querySelector('summary');if(!s.dataset.studentLabel){s.dataset.studentLabel=s.textContent;s.textContent='Avanzate · '+s.textContent;}}

 }
 for(const host of hosts){let queued=false;const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;decorate(host);});}};new MutationObserver(schedule).observe(host,{childList:true,subtree:true});decorate(host);}
})();
