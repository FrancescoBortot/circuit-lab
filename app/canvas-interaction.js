/* Explicit ownership of diagram gestures. An inactive drawing lets the page scroll. */
(() => {
 'use strict';let sequence=0;
 function install(svg,{cancel=()=>{},onActivate=()=>{},activeHint='Schema attivo · trascina per spostare, due dita per zoom · Esc o clic fuori per uscire',idleHint='Tocca o clicca nello schema per attivarlo · Invio da tastiera'}={}){
  let active=false;const hint=document.createElement('span');hint.className='canvas-interaction-hint';hint.id='canvasInteractionHint'+(++sequence);hint.setAttribute('role','status');hint.style.pointerEvents='none';svg.after(hint);
  const described=svg.getAttribute('aria-describedby');svg.setAttribute('aria-describedby',[described,hint.id].filter(Boolean).join(' '));
  function render(){svg.classList.toggle('canvas-interaction-active',active);svg.classList.toggle('canvas-interaction-idle',!active);svg.style.touchAction=active?'none':'pan-y';hint.textContent=active?activeHint:idleHint;hint.hidden=Boolean(svg.closest('[hidden]'));}
  function set(value){if(active===value)return;active=value;if(!active)cancel();render();}
  document.addEventListener('pointerdown',event=>{if((event.button!==undefined&&event.button!==0)||event.ctrlKey||event.metaKey||event.altKey)return;if(svg.hidden||svg.closest('[hidden]')){set(false);return;}if(!svg.contains(event.target)){set(false);return;}if(!active){set(true);svg.focus({preventScroll:true});onActivate(event);event.preventDefault();event.stopImmediatePropagation();}},true);
  svg.addEventListener('wheel',event=>{if(!active||event.metaKey||event.altKey)event.stopImmediatePropagation();},{capture:true,passive:true});
  svg.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;if(event.key==='Escape'){set(false);return;}if(!active){if(['Enter',' '].includes(event.key)){set(true);event.preventDefault();}event.stopImmediatePropagation();return;}},{capture:true});
  // Dropping a palette component is already an explicit editing gesture.
  svg.addEventListener('drop',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('application/circuit-component'))set(true);},true);
  svg.addEventListener('focusout',event=>{if(event.relatedTarget&&!svg.contains(event.relatedTarget))set(false);});
  for(const type of ['circuit-lab-mode','guided-lab-view','circuit-lab-view','circuit-lab-document'])document.addEventListener(type,()=>{if(svg.hidden||svg.closest('[hidden]'))set(false);render();});
  window.addEventListener('blur',()=>set(false));
  new MutationObserver(()=>{if(svg.hidden||svg.closest('[hidden]'))set(false);render();}).observe(svg,{attributes:true,attributeFilter:['hidden']});
  render();return{get active(){return active;},activate:()=>set(true),deactivate:()=>set(false),refresh:render};
 }
 // Navigation for a scrollable drawing; the same activation policy as the editors.
 function installViewport(viewport,{pan,zoom}){
  const pointers=new Map();let drag=null,pinch=null,moved=false,multiple=false,blockClick=false,tapTarget=null;
  const pair=()=>{if(pointers.size!==2)return null;const[a,b]=[...pointers.values()];return{distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};};
  function cancel(){const ids=[...pointers.keys()];pointers.clear();drag=pinch=tapTarget=null;blockClick=blockClick||moved||multiple;moved=multiple=false;for(const id of ids)if(viewport.hasPointerCapture?.(id))viewport.releasePointerCapture(id);}
  viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Schema a colori: attiva per trascinare e ingrandire con due dita');
  const interaction=install(viewport,{cancel,onActivate:()=>{blockClick=true;}});
  viewport.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey)return;
   event.preventDefault();
   pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});viewport.setPointerCapture(event.pointerId);
   if(pointers.size===1){drag={x:event.clientX,y:event.clientY};tapTarget=event.target;moved=multiple=false;blockClick=false;}else{multiple=true;moved=true;drag=tapTarget=null;pinch=pair();}
  });
  viewport.addEventListener('pointermove',event=>{
   if(!pointers.has(event.pointerId))return;
   const point={x:event.clientX,y:event.clientY};pointers.set(event.pointerId,point);
   if(pointers.size===2&&pinch){const next=pair(),factor=pinch.distance>0&&next.distance>0?next.distance/pinch.distance:1;zoom(factor,pinch.mid,next.mid);pinch=next;}
   else if(pointers.size===1&&drag){const dx=point.x-drag.x,dy=point.y-drag.y;if(moved||Math.hypot(dx,dy)>4){moved=true;pan(dx,dy);drag=point;}}
   event.preventDefault();
  });
  function up(event){
   if(!pointers.has(event.pointerId))return;if(event.type!=='pointerup'){cancel();return;}
   const tapped=!moved&&!multiple&&drag&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<=4?tapTarget:null;tapTarget=null;
   pointers.delete(event.pointerId);blockClick=!tapped||moved||multiple;pinch=pair();drag=pointers.size===1?{...[...pointers.values()][0]}:null;
   if(multiple)moved=true;
   if(!pointers.size){moved=multiple=false;}
   if(viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);
   // Pointer capture retargets the native click to the viewport. Preserve a stationary tap on its original object.
   if(tapped?.isConnected){tapped.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));blockClick=true;}
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,up);
  viewport.addEventListener('click',event=>{if(blockClick&&event.detail!==0){blockClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  viewport.addEventListener('wheel',event=>{event.preventDefault();const mid={x:event.clientX,y:event.clientY};zoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.008),mid,mid);},{passive:false});
  viewport.addEventListener('keydown',event=>{
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return;}
   if(!interaction.active)return;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){const d=event.shiftKey?60:20;pan(event.key==='ArrowLeft'?d:event.key==='ArrowRight'?-d:0,event.key==='ArrowUp'?d:event.key==='ArrowDown'?-d:0);event.preventDefault();event.stopPropagation();}
  });
  return{interaction,cancel};
 }
 window.CanvasInteraction={install,installViewport};
})();
