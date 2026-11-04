/* Explicit ownership of diagram gestures. An inactive drawing lets the page scroll. */
(() => {
 'use strict';let sequence=0;
 function install(svg,{cancel=()=>{},onActivate=()=>{},activeHint='Schema attivo · trascina per spostare · pizzica con due dita per zoom · Esc per uscire',idleHint='Tocca o clicca nello schema per attivarlo · Invio da tastiera'}={}){
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
 // Mouse wheels, Chromium/Firefox trackpad pinch (ctrl+wheel), and Safari pinch.
 // Normalize units, bound a single jump and cap bursts without a delayed zoom tail.
 function installZoom(target,{active=()=>true,zoom,begin=()=>{},touching=()=>false,accept=()=>true}){
  let last=null,credit=.08,gesture=null;
  const eligible=e=>active()&&!e.metaKey&&!e.altKey&&accept(anchor(e));
  const anchor=e=>{const r=target.getBoundingClientRect();return{clientX:Number.isFinite(e.clientX)&&e.clientX>=r.left&&e.clientX<=r.left+r.width?e.clientX:r.left+r.width/2,clientY:Number.isFinite(e.clientY)&&e.clientY>=r.top&&e.clientY<=r.top+r.height?e.clientY:r.top+r.height/2};};
  function step(log,e,pinch){if(!Number.isFinite(log)||!log)return;const now=Number.isFinite(e.timeStamp)?e.timeStamp:Date.now(),gap=last===null?Infinity:Math.max(0,now-last);if(gap>180){credit=.08;if(!gesture)begin();}else credit=Math.min(.08,credit+gap*(pinch?.0015:.001));last=now;const amount=Math.max(-credit,Math.min(credit,log));credit=Math.max(0,credit-Math.abs(amount));if(amount)zoom(Math.exp(amount),anchor(e));}
  const wheel=e=>{if(!eligible(e))return;e.preventDefault();if(gesture)return;const units=e.deltaMode===1?16:e.deltaMode===2?Math.max(200,Math.min(1000,target.clientHeight||800)):1;step(-e.deltaY*units*(e.ctrlKey?.004:.001),e,Boolean(e.ctrlKey));};
  const start=e=>{if(!eligible(e))return;e.preventDefault();gesture={scale:Number.isFinite(e.scale)&&e.scale>0?e.scale:1,ignore:touching()};last=null;credit=.08;if(!gesture.ignore)begin();};
  const change=e=>{if(!eligible(e)){gesture=null;return;}if(!gesture)return;e.preventDefault();if(gesture.ignore||!Number.isFinite(e.scale)||e.scale<=0)return;const previous=gesture.scale;gesture.scale=e.scale;step(Math.log(e.scale/previous)*.7,e,true);};
  const end=e=>{if(!gesture)return;if(eligible(e))e.preventDefault();gesture=null;last=null;};
  const handlers={wheel,gesturestart:start,gesturechange:change,gestureend:end};for(const [type,handler]of Object.entries(handlers))target.addEventListener(type,handler,{passive:false});
  return{destroy(){for(const [type,handler]of Object.entries(handlers))target.removeEventListener(type,handler);gesture=null;}};
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
  installZoom(viewport,{active:()=>interaction.active,begin:cancel,touching:()=>pointers.size>0,zoom:(factor,event)=>{const mid={x:event.clientX,y:event.clientY};zoom(factor,mid,mid);}});
  viewport.addEventListener('keydown',event=>{
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();return;}
   if(!interaction.active)return;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){const d=event.shiftKey?60:20;pan(event.key==='ArrowLeft'?d:event.key==='ArrowRight'?-d:0,event.key==='ArrowUp'?d:event.key==='ArrowDown'?-d:0);event.preventDefault();event.stopPropagation();}
  });
  return{interaction,cancel};
 }
 window.CanvasInteraction={install,installViewport,installZoom};
})();
