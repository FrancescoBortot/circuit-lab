(() => {
  'use strict';
  const M=window.LabModel,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const timeDivisions=10,verticalDivisions=8;
  const channels={A:'CH1',B:'CH2'};
  const prefixes=[[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p'],[1e-15,'f'],[1e3,'k'],[1e6,'M'],[1e9,'G'],[1e12,'T']];
  const divisionNumber=value=>String(Number(value.toPrecision(10))).replace('.',',');
  function verticalRange(min,max,manual){
    const span=max-min,center=min+span/2,ideal=(span||(center===0?1:Math.abs(center)*.2))/6.8;
    const decade=10**Math.floor(Math.log10(ideal));
    const step=manual??(([1,1.25,1.5,2,2.5,3,4,5,6,8,10].find(n=>n*decade>=ideal)??10)*decade);
    const origin=Math.round(center/step)*step;
    return {origin,step};
  }
  const ticks=(min,max,n=5)=>{const raw=(max-min)/n,p=10**Math.floor(Math.log10(raw)),f=raw/p,step=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p,out=[];for(let i=Math.ceil(min/step);i*step<=max+step*1e-8&&out.length<30;i++)out.push(Math.abs(i*step)<step*1e-8?0:i*step);return out;};
  class LabPlot{
    constructor(svg,onCursor,onStateChange){this.svg=svg;this.onCursor=onCursor;this.onStateChange=onStateChange;this.series=[];this.data=[];this.pointers=new Map();this.dual=false;this.activeCursor='a';
      this.splitY=true;this.traceAxes=new Map();this.verticalSteps={};
      this.controls=document.createElement('div');this.controls.className='cursor-toolbar';this.controls.setAttribute('role','group');this.controls.setAttribute('aria-label','Cursori del grafico');
      this.controls.innerHTML='<button data-cursor="toggle" aria-pressed="false">Due cursori</button><button data-cursor="a" aria-pressed="true" hidden>A</button><button data-cursor="b" aria-pressed="false" hidden>B</button><span>Clicca il grafico per posizionare</span>';
      svg.parentElement.before(this.controls);
      this.interactionActive=false;svg.setAttribute('tabindex','0');
      this.activationHint=document.createElement('span');this.activationHint.className='plot-activation-hint';this.controls.append(this.activationHint);this.activationHint.id=svg.id+'InteractionHint';svg.setAttribute('aria-describedby',this.activationHint.id);
      this.scopeControls=document.createElement('div');this.scopeControls.className='plot-scope-controls';this.scopeControls.hidden=true;
      this.scopeControls.innerHTML=`
        <div class="plot-division-controls" role="group" aria-label="Scale per divisione">
          <div data-division-fields></div>
          <button type="button" data-scale-auto aria-label="Ripristina le scale automatiche">Auto</button>
          <details class="plot-trace-settings"><summary>Assi delle tracce</summary>
            <button type="button" data-split-y aria-pressed="true">Scale Y separate</button>
            <div data-trace-axes role="group" aria-label="Assi verticali delle tracce" hidden></div>
          </details>
        </div>
        <span data-scale-error role="status" hidden></span>
        <div class="plot-time-controls" role="group" aria-label="Finestra temporale">
          <label>Scorri nel tempo
            <input type="range" min="0" max="1000" value="500"
              title="Dalla vista completa, il primo spostamento mostra metà dell’intervallo">
          </label>
          <button type="button" data-time-zoom="out" aria-label="Allarga finestra temporale">−</button>
          <button type="button" data-time-zoom="in" aria-label="Restringi finestra temporale">+</button>
          <button type="button" data-time-zoom="fit">Tutto</button>
        </div>`;
      svg.parentElement.before(this.scopeControls);
      this.splitButton=this.scopeControls.querySelector('[data-split-y]');
      this.axisControls=this.scopeControls.querySelector('[data-trace-axes]');
      this.timePan=this.scopeControls.querySelector('input[type="range"]');
      this.divisionFields=this.scopeControls.querySelector('[data-division-fields]');
      this.scaleError=this.scopeControls.querySelector('[data-scale-error]');
      for(const [axis,label] of [['time','Tempo'],...Object.entries(channels)]){
        const field=document.createElement('div');
        field.className='plot-division';field.dataset.division=axis;
        field.innerHTML=`<span>${label}</span><input type="text" inputmode="decimal" aria-label="${label} per divisione"><select aria-label="Unità ${label} per divisione"></select>`;
        const input=field.querySelector('input'),unit=field.querySelector('select');
        input.addEventListener('input',()=>{input.dataset.draft='true';this.showScaleError(input,'');});
        input.addEventListener('change',()=>this.applyDivision(axis));
        input.addEventListener('keydown',event=>{
          if(event.key==='Enter'){event.preventDefault();this.applyDivision(axis);}
          if(event.key==='Escape'){event.preventDefault();delete input.dataset.draft;this.showScaleError(input,'');this.syncDivisions();}
        });
        unit.addEventListener('change',()=>{field.dataset.unitSelected=unit.value;this.syncDivisions();});
        this.divisionFields.append(field);
      }
      this.scopeControls.querySelector('[data-scale-auto]').addEventListener('click',()=>{
        this.splitY=true;this.traceAxes.clear();this.verticalSteps={};
        this.resetDivisionInputs();this.syncScope();this.fit();
      });
      this.splitButton.addEventListener('click',()=>{this.splitY=!this.splitY;this.resetDivisionInputs();this.syncScope();this.draw();this.onStateChange?.();});
      this.axisControls.addEventListener('change',event=>{
        const select=event.target.closest('select');
        if(!select)return;
        this.traceAxes.set(this.config.yUnit+':'+select.dataset.traceKey,select.value);this.draw();this.onStateChange?.();
      });
      this.scopeControls.querySelector('.plot-time-controls').addEventListener('click',event=>{
        const action=event.target.closest('[data-time-zoom]')?.dataset.timeZoom;
        if(!action||!this.data.length)return;
        if(action==='fit')this.fit();else this.zoom(action==='in'?1.6:1/1.6);
      });
      this.timePan.addEventListener('input',()=>{
        if(!this.data.length)return;
        const total=this.domain[1]-this.domain[0],span=this.view[1]-this.view[0];
        const width=span>=total*(1-1e-9)?total/2:span;
        this.panTo(this.domain[0]+Number(this.timePan.value)/1000*(total-width),width);
      });
      const activate=value=>{this.interactionActive=value;svg.classList.toggle('canvas-interaction-active',value);svg.style.touchAction=value?'none':'pan-y';this.activationHint.textContent=value?'Grafico attivo · pizzica con due dita per zoom · Esc per uscire':'Clicca il grafico o premi Invio per attivarlo';if(!value){const ids=[...this.pointers.keys()];this.pointers.clear();this.drag=null;this.pinch=null;for(const id of ids)if(svg.hasPointerCapture?.(id))svg.releasePointerCapture(id);}};
      this.activateInteraction=activate;activate(false);
      this.activationPointer=e=>{if(!svg.contains(e.target)){activate(false);return;}if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||this.interactionActive)return;activate(true);svg.focus({preventScroll:true});e.preventDefault();e.stopImmediatePropagation();};
      this.activationBlur=()=>activate(false);
      this.activationFocus=e=>{if(e.relatedTarget&&!svg.contains(e.relatedTarget))activate(false);};
      document.addEventListener('pointerdown',this.activationPointer,true);window.addEventListener('blur',this.activationBlur);svg.addEventListener('focusout',this.activationFocus);
      svg.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Escape'){activate(false);e.stopImmediatePropagation();return;}if(!this.interactionActive){if(e.key==='Enter'||e.key===' '){activate(true);e.preventDefault();}e.stopImmediatePropagation();}},{capture:true});

      this.controls.addEventListener('click',e=>{const key=e.target.closest('[data-cursor]')?.dataset.cursor;if(!key)return;if(key==='toggle')this.dual=!this.dual;else this.activeCursor=key;this.syncControls();this.drawCursor();this.onStateChange?.();});
      this.resizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.draw());});this.resizeObserver.observe(svg.parentElement);
      svg.addEventListener('wheel',event=>{
        if(!this.data.length||!this.config.scope||event.ctrlKey||event.metaKey||event.altKey)return;
        const delta=event.shiftKey?(event.deltaX||event.deltaY):event.deltaX;
        if(!delta||(!event.shiftKey&&Math.abs(delta)<=Math.abs(event.deltaY))||!this.point(event).inside)return;
        const span=this.view[1]-this.view[0],units=event.deltaMode===1?16:event.deltaMode===2?this.geometry.pw:1;
        if(this.panTo(this.view[0]+delta*units/this.geometry.pw*span,span))event.preventDefault();
        event.stopImmediatePropagation();
      },{passive:false});
      this.zoomInteraction=window.CanvasInteraction.installZoom(svg,{active:()=>this.interactionActive,accept:e=>this.point(e).inside,begin:()=>{activate(false);activate(true);},touching:()=>this.pointers.size>0,zoom:(factor,e)=>{const q=this.point(e);if(q.inside)this.zoom(factor,q.domain);}});
      svg.addEventListener('pointerdown',e=>{if(!this.interactionActive||e.ctrlKey||e.metaKey||e.altKey)return;if(e.button!==0)return;const q=this.point(e);if(!q.inside)return;svg.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,q.x);if(this.pointers.size===2){this.pinch=Math.abs([...this.pointers.values()][0]-[...this.pointers.values()][1]);this.drag=null;}else{this.drag={x:q.x,start:this.view[0],end:this.view[1],moved:false};this.inspectDomain(q.domain);}});
      svg.addEventListener('pointermove',e=>{if(!this.interactionActive||!this.geometry)return;const q=this.point(e);if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,q.x);
        if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()],distance=Math.abs(a-b);if(distance>5)this.zoom(distance/this.pinch,(this.view[0]+this.view[1])/2);this.pinch=distance;}
        else if(this.drag){const dx=q.x-this.drag.x;if(Math.abs(dx)>4)this.drag.moved=true;if(this.drag.moved){const span=this.drag.end-this.drag.start;this.panTo(this.drag.start-dx/this.geometry.pw*span,span,false);}}
        else if(!this.dual&&!this.playbackActive&&!this.lockHover&&e.pointerType==='mouse'&&q.inside)this.inspectDomain(q.domain);
      });
      for(const type of['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(type,e=>{const moved=this.drag?.moved;this.pointers.delete(e.pointerId);this.drag=null;this.pinch=null;if(moved)this.onStateChange?.();});
      svg.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||!this.interactionActive)return;if(!this.data.length)return;const step=(this.view[1]-this.view[0])/(e.shiftKey?10:100),d=this.toDomain(this.cursor.x);
        if(['ArrowLeft','ArrowRight','Home','End','+','=','-','0'].includes(e.key))e.preventDefault();
        if(e.key==='ArrowLeft')this.inspectDomain(d-step,true);if(e.key==='ArrowRight')this.inspectDomain(d+step,true);
        if(e.key==='Home')this.inspectDomain(this.domain[0],true);if(e.key==='End')this.inspectDomain(this.domain[1],true);
        if(e.key==='+'||e.key==='=')this.zoom(1.5,d);if(e.key==='-')this.zoom(1/1.5,d);if(e.key==='0')this.fit();
      });
    }
    destroy(){this.zoomInteraction.destroy();this.activateInteraction(false);document.removeEventListener('pointerdown',this.activationPointer,true);window.removeEventListener('blur',this.activationBlur);this.svg.removeEventListener('focusout',this.activationFocus);this.resizeObserver.disconnect();cancelAnimationFrame(this.frame);this.controls.remove();this.scopeControls.remove();}
    syncControls(){for(const b of this.controls.querySelectorAll('[data-cursor]')){const key=b.dataset.cursor;b.hidden=key!=='toggle'&&!this.dual;b.setAttribute('aria-pressed',String(key==='toggle'?this.dual:key===this.activeCursor));}this.controls.querySelector('span').textContent=this.dual?'Scegli A o B, poi clicca il grafico':'Passa sul grafico per leggere';}
    axisFor(series){
      const traces=this.config.series,right=traces.find(trace=>trace.key==='out')||traces[1];
      return this.traceAxes.get(this.config.yUnit+':'+series.key)??(series.key===right?.key?'B':'A');
    }
    syncScope(){
      this.scopeControls.hidden=!this.config?.scope||!this.data.length;
      if(this.scopeControls.hidden)return;
      this.splitButton.hidden=this.config.series.length<2;
      this.splitButton.setAttribute('aria-pressed',String(this.splitY));
      this.axisControls.hidden=this.splitButton.hidden||!this.splitY;
      this.splitButton.parentElement.hidden=this.splitButton.hidden;
      this.axisControls.replaceChildren();
      if(this.axisControls.hidden)return;
      for(const series of this.series){
        const label=document.createElement('label'),select=document.createElement('select');
        label.textContent=series.label;
        select.dataset.traceKey=series.key;
        select.setAttribute('aria-label','Asse verticale · '+series.label);
        select.innerHTML='<option value="A">CH1 · sinistra</option><option value="B">CH2 · destra</option>';
        select.value=this.axisFor(series);
        label.append(select);this.axisControls.append(label);
      }
    }
    resetDivisionInputs(){
      for(const field of this.divisionFields.children){
        const input=field.querySelector('input');
        delete field.dataset.unitSelected;delete input.dataset.draft;input.removeAttribute('aria-invalid');
      }
      this.scaleError.textContent='';this.scaleError.hidden=true;
    }
    showScaleError(input,message){
      if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
      this.scaleError.textContent=message;this.scaleError.hidden=!message;
    }
    syncDivisions(){
      if(!this.config?.scope||!this.geometry)return;
      for(const field of this.divisionFields.children){
        const axis=field.dataset.division,step=axis==='time'?(this.view[1]-this.view[0])/timeDivisions:this.geometry.verticalSteps.get(axis);
        field.hidden=step===undefined;
        if(field.hidden)continue;
        const unit=axis==='time'?this.config.xUnit:this.config.yUnit,input=field.querySelector('input'),select=field.querySelector('select');
        const best=RCModel.scale(step,unit).factor;
        if(select.dataset.unit!==unit){
          select.dataset.unit=unit;
          select.innerHTML=prefixes.map(([factor,prefix])=>`<option value="${factor}">${prefix}${unit}/div</option>`).join('');
        }
        const factor=Number(field.dataset.unitSelected)||best;
        select.value=String(factor);
        if(!input.dataset.draft)input.value=input.dataset.rendered=divisionNumber(step/factor);
      }
    }
    applyDivision(axis){
      if(!this.data.length||this.scopeControls.hidden)return;
      const field=this.divisionFields.querySelector('[data-division="'+axis+'"]'),input=field.querySelector('input');
      if(!input.dataset.draft&&input.value===input.dataset.rendered)return;
      const raw=input.value.trim().replace(',','.'),step=Number(raw)*Number(field.querySelector('select').value);
      const duration=this.domain[1]-this.domain[0],span=step*timeDivisions;
      if(!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)||!Number.isFinite(step)||step<1e-24||step>1e15){
        this.showScaleError(input,'Inserisci un numero positivo per la scala.');return;
      }
      if(axis==='time'&&(span<duration/1000*(1-1e-9)||span>duration*1000*(1+1e-9))){
        this.showScaleError(input,'Tempo/div ammesso da '+M.format(duration/1000/timeDivisions,'s',4)+' a '+M.format(duration*1000/timeDivisions,'s',4)+'.');return;
      }
      delete input.dataset.draft;this.showScaleError(input,'');
      if(axis==='time')this.panTo((this.view[0]+this.view[1]-span)/2,span);
      else {this.verticalSteps[axis]=step;this.draw();this.onStateChange?.();}
      this.syncDivisions();
    }
    clear(){
      this.data=[];this.series=[];this.geometry=null;this.scopeControls.hidden=true;this.svg.replaceChildren();
    }
    set(config){
      const old=this.config,sameScope=old?.scope&&config.scope&&old.scopeKey===config.scopeKey&&old.yUnit===config.yUnit;
      const oldData=config.scope?old?.data:this.data;
      const same=old&&(!config.scope||sameScope)&&old.logX===config.logX&&old.xUnit===config.xUnit&&oldData?.[0]?.x===config.data[0]?.x&&oldData?.at(-1)?.x===config.data.at(-1)?.x,ax=this.cursorA?.x,bx=this.cursorB?.x;
      if(!sameScope&&config.scope){this.splitY=true;this.verticalSteps={};this.traceAxes.clear();this.resetDivisionInputs();}
      this.config=config;this.data=config.data;this.series=config.series.filter(s=>s.visible!==false);this.toDomain=config.logX?x=>Math.log10(x):x=>x;this.fromDomain=config.logX?x=>10**x:x=>x;
      this.domain=[this.toDomain(this.data[0].x),this.toDomain(this.data.at(-1).x)];if(this.domain[0]===this.domain[1]){const gap=config.logX?.1:Math.max(Math.abs(this.domain[0])*.05,1e-9);this.domain=[this.domain[0]-gap,this.domain[1]+gap];}if(!same)this.view=[...this.domain];
      this.cursorA=same?window.LabMeasurements.nearest(this.data,ax):this.data[Math.floor((this.data.length-1)*.15)];
      this.cursorB=same?window.LabMeasurements.nearest(this.data,bx):this.data[Math.floor((this.data.length-1)*.65)];
      this.cursor=this.activeCursor==='b'&&this.dual?this.cursorB:this.cursorA;this.syncControls();this.syncScope();this.draw();
    }
    updateSeries(series){this.config.series=series;this.series=series.filter(s=>s.visible!==false);this.syncScope();this.draw();}
    exportState(){
      if(!this.data.length||!this.view)return null;
      const point=d=>({x:d.x,index:this.data.indexOf(d)});
      return{logX:this.config.logX,xUnit:this.config.xUnit,view:this.view.map(this.fromDomain),a:point(this.cursorA),b:point(this.cursorB),dual:this.dual,activeCursor:this.activeCursor,
        ...(this.config.scope?{divisions:{unit:this.config.yUnit,steps:{...this.verticalSteps},split:this.splitY,axes:Object.fromEntries(this.traceAxes)}}:{})};
    }
    restoreState(state){
      if(!state||!this.data.length||state.logX!==this.config.logX||state.xUnit!==this.config.xUnit)return;
      const lo=this.toDomain(state.view[0]),hi=this.toDomain(state.view[1]),span=hi-lo,total=this.domain[1]-this.domain[0];
      if(Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo){
        if(this.config.scope&&lo===this.domain[0]&&span>total&&span<=total*1000)this.view=[lo,hi];
        else if(Math.min(this.domain[1],hi)>Math.max(this.domain[0],lo))this.view=[Math.max(this.domain[0],lo),Math.min(this.domain[1],hi)];
      }
      if(this.config.scope&&state.divisions?.unit===this.config.yUnit){
        const {steps,split,axes}=state.divisions;
        this.verticalSteps=Object.fromEntries(Object.entries(steps??{}).filter(([key,v])=>Object.hasOwn(channels,key)&&Number.isFinite(v)&&v>=1e-24&&v<=1e15));
        this.traceAxes=new Map(Object.entries(axes??{}).filter(([,v])=>Object.hasOwn(channels,v)));
        this.splitY=split!==false;this.syncScope();
      }
      const point=s=>this.data[s.index]?.x===s.x?this.data[s.index]:window.LabMeasurements.nearest(this.data,s.x);
      this.cursorA=point(state.a);this.cursorB=point(state.b);this.dual=state.dual;this.activeCursor=state.activeCursor;this.syncControls();this.draw();
    }
    fit(){if(!this.domain)return;this.view=[...this.domain];this.draw();this.onStateChange?.();}
    panTo(start,span,notify=true){
      start=clamp(start,this.domain[0],Math.max(this.domain[0],this.domain[1]-span));
      const end=span<=this.domain[1]-this.domain[0]?Math.min(this.domain[1],start+span):start+span;
      if(start===this.view[0]&&end===this.view[1])return false;
      this.view=[start,end];this.draw();if(notify)this.onStateChange?.();return true;
    }
    zoom(factor,anchor=(this.view[0]+this.view[1])/2){const old=this.view[1]-this.view[0],total=this.domain[1]-this.domain[0],span=clamp(old/factor,total/1000,Math.max(total,old)),fraction=(anchor-this.view[0])/old;this.panTo(anchor-span*fraction,span);}
    point(e){const b=this.svg.getBoundingClientRect(),g=this.geometry;if(!g)return{inside:false};const x=(e.clientX-b.left)*g.w/b.width,y=(e.clientY-b.top)*g.h/b.height;return{x,y,domain:this.view[0]+(x-g.left)/g.pw*(this.view[1]-this.view[0]),inside:x>=g.left&&x<=g.w-g.right&&y>=g.top&&y<=g.h-g.bottom};}
    inspectDomain(d,reveal=false){d=clamp(d,...this.domain);const value=this.fromDomain(d);let lo=0,hi=this.data.length;while(lo<hi){const m=(lo+hi)>>1;if(this.data[m].x<=value)lo=m+1;else hi=m;}
      let i=Math.max(0,lo-1);if(lo<this.data.length&&Math.abs(this.data[lo].x-value)<Math.abs(this.data[i].x-value))i=lo;this.cursor=this.data[i];if(this.dual&&this.activeCursor==='b')this.cursorB=this.cursor;else this.cursorA=this.cursor;
      if(reveal&&(d<this.view[0]||d>this.view[1])){const span=this.view[1]-this.view[0],start=clamp(d-span/2,this.domain[0],this.domain[1]-span);this.view=[start,start+span];this.draw();}else this.drawCursor();
      this.onStateChange?.();
    }
    inspectSample(index){if(!Number.isInteger(index)||!this.data[index])return false;this.activeCursor='a';this.cursorA=this.cursor=this.data[index];const x=this.toDomain(this.cursor.x),span=this.view[1]-this.view[0];if(x<this.view[0]||x>this.view[1]){const start=clamp(x-span/2,this.domain[0],this.domain[1]-span);this.view=[start,start+span];this.draw();}else this.drawCursor();this.syncControls();this.onStateChange?.();return true;}
    setFraction(f){this.inspectDomain(this.domain[0]+clamp(f,0,1)*(this.domain[1]-this.domain[0]),true);}
    draw(){
      if(!this.data.length)return;
      const split=this.config.scope&&this.splitY&&this.config.series.length>1;
      const groups=split?['A','B'].map(axis=>({axis,traces:this.series.filter(s=>this.axisFor(s)===axis)})).filter(g=>g.traces.length):[{axis:'A',traces:this.series}];
      const rect=this.svg.parentElement.getBoundingClientRect(),w=Math.max(250,rect.width),h=Math.max(140,rect.height),left=split?68:60,right=groups.some(g=>g.axis==='B')?68:24,top=21,bottom=35,pw=w-left-right,ph=h-top-bottom;
      const x=value=>left+(this.toDomain(value)-this.view[0])/(this.view[1]-this.view[0])*pw;
      const logY=this.config.logY,domainY=logY?Math.log10:v=>v;
      const validY=v=>Number.isFinite(v)&&(!logY||v>0);
      const visible=this.data.filter(d=>this.toDomain(d.x)>=this.view[0]&&this.toDomain(d.x)<=this.view[1]);
      const viewSamples=visible.length?visible:this.view.map(v=>window.LabMeasurements.nearest(this.data,this.fromDomain(v)));
      const extentSamples=split?this.data:viewSamples;
      const traceY=new Map();
      const verticalSteps=new Map(),scope=this.config.scope;
      this.geometry={w,h,left,right,top,bottom,pw,ph,x,traceY,validY,verticalSteps};
      const num=v=>new Intl.NumberFormat('it-IT',{maximumSignificantDigits:4}).format(v);
      let html=`<defs><clipPath id="${this.svg.id}-clip"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs>`;
      for(const [index,{axis,traces}] of groups.entries()){
        let min=Infinity,max=-Infinity;
        for(const sample of extentSamples)for(const series of traces){
          const value=sample[series.key];
          if(!validY(value))continue;
          const sigma=series.sigmaKey&&Number.isFinite(sample[series.sigmaKey])?sample[series.sigmaKey]:0;
          const low=value-sigma;
          min=Math.min(min,domainY(validY(low)?low:value));
          max=Math.max(max,domainY(value+sigma));
        }
        if(!Number.isFinite(min)){min=-1;max=1;}
        let step,origin;
        if(scope){
          ({origin,step}=verticalRange(min,max,this.verticalSteps[axis]));
          min=origin-step*verticalDivisions/2;max=origin+step*verticalDivisions/2;
          verticalSteps.set(axis,step);
        }else{
          if(!logY&&!this.config.noZero){min=Math.min(min,0);max=Math.max(max,0);}
          if(max-min<1e-15){const padding=logY?.25:1;min-=padding;max+=padding;}
          const gap=(max-min)*.1;min-=gap;max+=gap;
        }
        const y=scope?v=>top+(.5-(v-origin)/step/verticalDivisions)*ph:v=>top+(max-domainY(v))/(max-min)*ph;
        const yScale=logY||this.config.plainY||['dB','°'].includes(this.config.yUnit)?{factor:1,unit:this.config.yUnit}:RCModel.scale(Math.max(Math.abs(min),Math.abs(max)),this.config.yUnit);
        for(const s of traces)traceY.set(s.key,y);
        const atRight=axis==='B',edge=atRight?w-right:left,labelX=edge+(atRight?9:-9),anchor=atRight?'start':'end';
        const decades=logY?Array.from({length:Math.max(0,Math.floor(max)-Math.ceil(min)+1)},(_,i)=>10**(Math.ceil(min)+i)):[];
        const yticks=scope?Array.from({length:verticalDivisions+1},(_,i)=>origin+(i-verticalDivisions/2)*step):logY?(decades.length>=2?decades:ticks(min,max,4).map(v=>10**v)):ticks(min,max,4);
        for(const [i,v] of yticks.entries()){
          const py=scope?top+(verticalDivisions-i)/verticalDivisions*ph:y(v);
          const zero=scope?Math.abs(v)<step*1e-10:v===0;
          if(index===0)html+=`<path d="M${left},${py}H${w-right}" stroke="${zero?'#dce3ed':'#edf1f6'}"/>`;
          if(split)html+=`<path d="M${edge},${py}h${atRight?5:-5}" stroke="#8496b1"/>`;
          if(!scope||i%2===0||zero)html+=`<text x="${labelX}" y="${py+4}" text-anchor="${anchor}">${logY?Number(v.toPrecision(2)).toExponential().replace('e-','e−'):num((zero?0:v)/yScale.factor)}</text>`;
        }
        const unit=this.config.yLabel?this.config.yLabel+' ('+yScale.unit+')':yScale.unit;
        const channel=scope?(this.splitY?channels[axis]:'Y')+' · ':'';
        html+=`<text x="${labelX}" y="12" text-anchor="${anchor}" class="axis-unit" data-y-axis="${axis}">${channel}${unit}</text>`;
        if(split){
          const spacing=Math.min(21,(pw/2-10)/traces.length);
          for(const [i,s] of traces.entries()){
            const direction=atRight?-1:1,start=edge+direction*(5+i*spacing),length=direction*spacing*.72;
            html+=`<path d="M${start},9h${length}" stroke="${s.color}" stroke-width="2.5"${s.dash?' stroke-dasharray="'+s.dash+'"':''}/>`;
          }
        }
      }
      let xticks=this.config.logX?Array.from({length:Math.ceil(this.view[1])-Math.floor(this.view[0])+1},(_,i)=>10**(Math.floor(this.view[0])+i)).filter(v=>this.toDomain(v)>=this.view[0]&&this.toDomain(v)<=this.view[1]):ticks(...this.view,Math.max(3,Math.floor(pw/100)));
      if(this.config.logX&&xticks.length<2)xticks=ticks(this.fromDomain(this.view[0]),this.fromDomain(this.view[1]),5);
      if(scope)xticks=Array.from({length:timeDivisions+1},(_,i)=>this.view[0]+i*(this.view[1]-this.view[0])/timeDivisions);
      const timeScale=RCModel.scale(this.view[1]-this.view[0],this.config.xUnit);
      const tickEvery=scope?pw<420?5:pw<700?2:1:1;
      for(const [i,v] of xticks.entries()){
        html+=`<path d="M${x(v)},${top}V${h-bottom}" stroke="#f0f3f7"/>`;
        if(i%tickEvery===0)html+=`<text x="${x(v)}" y="${h-bottom+22}" text-anchor="middle">${this.config.logX?M.format(v,this.config.xUnit):num(v/timeScale.factor)}</text>`;
      }
      const xLabel=this.config.xLabel+(this.config.logX||!timeScale.unit?'':' ('+timeScale.unit+')');
      html+=`<text x="${w-right}" y="${h-2}" text-anchor="end" class="axis-unit">${xLabel}</text><g clip-path="url(#${this.svg.id}-clip)">`;
      for(const guide of this.config.guides||[]){if(this.toDomain(guide.x)>this.view[0]&&this.toDomain(guide.x)<this.view[1])html+=`<path d="M${x(guide.x)},${top+13}V${h-bottom}" stroke="#bcc9e5" stroke-dasharray="3 5"/><text x="${x(guide.x)+5}" y="${top+10}" class="guide-text">${guide.label}</text>`;}
      for(const s of this.series){const y=traceY.get(s.key);const samples=s.sparse?this.data.filter(row=>Object.hasOwn(row,s.key)):this.data;let path='',started=false;for(let i=0;i<samples.length;i++){const d=samples[i];if(!validY(d[s.key])){started=false;continue;}const domain=this.toDomain(d.x);if(domain<this.view[0]&&i+1<samples.length&&this.toDomain(samples[i+1].x)<this.view[0])continue;if(domain>this.view[1]&&i>0&&this.toDomain(samples[i-1].x)>this.view[1])continue;path+=(started?'L':'M')+x(d.x).toFixed(2)+','+y(d[s.key]).toFixed(2);started=true;}
        if(s.line!==false)html+=`<path d="${path}" stroke="${s.color}" stroke-width="${s.key==='out'?2.4:1.7}" fill="none" stroke-linejoin="round" stroke-linecap="round"${s.dash?' stroke-dasharray="'+s.dash+'"':''}/>`;
        if(s.points||s.sigmaKey)for(const d of visible){if(!validY(d[s.key]))continue;const px=x(d.x),py=y(d[s.key]),sigma=d[s.sigmaKey];if(s.sigmaKey&&Number.isFinite(sigma)&&sigma>0&&validY(d[s.key]-sigma)){const a=y(d[s.key]-sigma),b=y(d[s.key]+sigma);html+=`<path d="M${px},${a}V${b}M${px-3},${a}h6M${px-3},${b}h6" stroke="${s.color}" stroke-width="1" fill="none"/>`;}if(s.points)html+=`<circle cx="${px}" cy="${py}" r="2.6" fill="${s.color}" stroke="white" stroke-width=".7"/>`;}
      }
      html+=`<g id="${this.svg.id}-cursor"></g></g>`;
      this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.innerHTML=html;this.drawCursor();
      if(this.config.scope){
        this.syncDivisions();
        const travel=this.domain[1]-this.domain[0]-(this.view[1]-this.view[0]);
        this.timePan.value=travel>0?String(Math.round(1000*clamp((this.view[0]-this.domain[0])/travel,0,1))):'500';
        this.timePan.setAttribute('aria-valuetext',this.view.map(t=>M.format(t,'s',4)).join(' – '));
      }
    }
    drawCursor(){
      if(!this.geometry||!this.cursorA||!this.data.length)return;
      this.cursor=this.dual&&this.activeCursor==='b'?this.cursorB:this.cursorA;
      const g=this.geometry,root=this.svg.querySelector('#'+this.svg.id+'-cursor');if(!root)return;
      const markers=this.dual?[['A',this.cursorA,'#4264ef'],['B',this.cursorB,'#d48b22']]:[['',this.cursorA,'#8394b7']];
      root.innerHTML=markers.map(([label,d,color])=>{
        if(this.toDomain(d.x)<this.view[0]||this.toDomain(d.x)>this.view[1])return'';
        const x=g.x(d.x);return`<path d="M${x},${g.top}V${g.h-g.bottom}" stroke="${color}" stroke-dasharray="3 4"/><text x="${x+5}" y="${g.top+12}" style="fill:${color};font-weight:600">${label}</text>`+this.series.filter(s=>g.validY(d[s.key])).map(s=>`<circle cx="${x}" cy="${g.traceY.get(s.key)(d[s.key])}" r="3.4" fill="${s.color}" stroke="white" stroke-width="1.5"/>`).join('');
      }).join('');
      this.onCursor(this.cursor,(this.toDomain(this.cursor.x)-this.domain[0])/(this.domain[1]-this.domain[0]),this.dual?{a:this.cursorA,b:this.cursorB,active:this.activeCursor}:null);
    }

  }
  window.LabPlot=LabPlot;
})();
