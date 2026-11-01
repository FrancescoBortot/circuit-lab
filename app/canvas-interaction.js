/* Explicit ownership of diagram gestures. An inactive drawing lets the page scroll. */
(() => {
 'use strict';let sequence=0;
 function install(svg,{cancel=()=>{}}={}){
  let active=false;const hint=document.createElement('span');hint.className='canvas-interaction-hint';hint.id='canvasInteractionHint'+(++sequence);hint.setAttribute('role','status');hint.style.pointerEvents='none';svg.after(hint);
  const described=svg.getAttribute('aria-describedby');svg.setAttribute('aria-describedby',[described,hint.id].filter(Boolean).join(' '));
  function render(){svg.classList.toggle('canvas-interaction-active',active);svg.classList.toggle('canvas-interaction-idle',!active);svg.style.touchAction=active?'none':'pan-y';hint.textContent=active?'Schema attivo · Esc o clic fuori per uscire':'Clicca nello schema o premi Invio per attivarlo';hint.hidden=Boolean(svg.closest('[hidden]'));}
  function set(value){if(active===value)return;active=value;if(!active)cancel();render();}
  document.addEventListener('pointerdown',event=>{if(svg.hidden||svg.closest('[hidden]')){set(false);return;}if(!svg.contains(event.target)){set(false);return;}if(!active){set(true);svg.focus({preventScroll:true});event.preventDefault();event.stopImmediatePropagation();}},true);
  svg.addEventListener('wheel',event=>{if(!active||event.ctrlKey||event.metaKey)event.stopImmediatePropagation();},{capture:true,passive:true});
  svg.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;if(event.key==='Escape'){set(false);return;}if(!active){if(['Enter',' '].includes(event.key)){set(true);event.preventDefault();}event.stopImmediatePropagation();return;}},{capture:true});
  // Dropping a palette component is already an explicit editing gesture.
  svg.addEventListener('drop',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('application/circuit-component'))set(true);},true);
  svg.addEventListener('focusout',event=>{if(event.relatedTarget&&!svg.contains(event.relatedTarget))set(false);});
  for(const type of ['circuit-lab-mode','guided-lab-view','circuit-lab-document'])document.addEventListener(type,()=>{if(svg.hidden||svg.closest('[hidden]'))set(false);render();});
  window.addEventListener('blur',()=>set(false));
  new MutationObserver(()=>{if(svg.hidden||svg.closest('[hidden]'))set(false);render();}).observe(svg,{attributes:true,attributeFilter:['hidden']});
  render();return{get active(){return active;},deactivate:()=>set(false)};
 }
 window.CanvasInteraction={install};
})();
