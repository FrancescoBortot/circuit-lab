(() => {
  'use strict';
  const M=window.LabModel,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ticks=(min,max,n=5)=>{const raw=(max-min)/n,p=10**Math.floor(Math.log10(raw)),f=raw/p,step=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p,out=[];for(let i=Math.ceil(min/step);i*step<=max+step*1e-8&&out.length<30;i++)out.push(Math.abs(i*step)<step*1e-8?0:i*step);return out;};
  class LabPlot{
    constructor(svg,onCursor,onStateChange){this.svg=svg;this.onCursor=onCursor;this.onStateChange=onStateChange;this.series=[];this.data=[];this.pointers=new Map();this.dual=false;this.activeCursor='a';
      this.controls=document.createElement('div');this.controls.className='cursor-toolbar';this.controls.setAttribute('role','group');this.controls.setAttribute('aria-label','Cursori del grafico');
      this.controls.innerHTML='<button data-cursor="toggle" aria-pressed="false">Due cursori</button><button data-cursor="a" aria-pressed="true" hidden>A</button><button data-cursor="b" aria-pressed="false" hidden>B</button><span>Clicca il grafico per posizionare</span>';
      svg.parentElement.before(this.controls);
      this.controls.addEventListener('click',e=>{const key=e.target.closest('[data-cursor]')?.dataset.cursor;if(!key)return;if(key==='toggle')this.dual=!this.dual;else this.activeCursor=key;this.syncControls();this.drawCursor();this.onStateChange?.();});
      this.resizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.draw());});this.resizeObserver.observe(svg.parentElement);
      svg.addEventListener('wheel',e=>{const q=this.point(e);if(!q.inside)return;e.preventDefault();this.zoom(Math.exp(-clamp(e.deltaY,-100,100)*.008),q.domain);},{passive:false});
      svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const q=this.point(e);if(!q.inside)return;svg.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,q.x);if(this.pointers.size===2){this.pinch=Math.abs([...this.pointers.values()][0]-[...this.pointers.values()][1]);this.drag=null;}else{this.drag={x:q.x,start:this.view[0],end:this.view[1],moved:false};this.inspectDomain(q.domain);}});
      svg.addEventListener('pointermove',e=>{if(!this.geometry)return;const q=this.point(e);if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,q.x);
        if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()],distance=Math.abs(a-b);if(distance>5)this.zoom(distance/this.pinch,(this.view[0]+this.view[1])/2);this.pinch=distance;}
        else if(this.drag){const dx=q.x-this.drag.x;if(Math.abs(dx)>4)this.drag.moved=true;if(this.drag.moved){const span=this.drag.end-this.drag.start,start=clamp(this.drag.start-dx/this.geometry.pw*span,this.domain[0],this.domain[1]-span);this.view=[start,start+span];this.draw();}}
        else if(!this.dual&&!this.playbackActive&&!this.lockHover&&e.pointerType==='mouse'&&q.inside)this.inspectDomain(q.domain);
      });
      for(const type of['pointerup','pointercancel'])svg.addEventListener(type,e=>{const moved=this.drag?.moved;this.pointers.delete(e.pointerId);this.drag=null;this.pinch=null;if(moved)this.onStateChange?.();});
      svg.addEventListener('keydown',e=>{if(!this.data.length)return;const step=(this.view[1]-this.view[0])/(e.shiftKey?10:100),d=this.toDomain(this.cursor.x);
        if(['ArrowLeft','ArrowRight','Home','End','+','=','-','0'].includes(e.key))e.preventDefault();
        if(e.key==='ArrowLeft')this.inspectDomain(d-step,true);if(e.key==='ArrowRight')this.inspectDomain(d+step,true);
        if(e.key==='Home')this.inspectDomain(this.domain[0],true);if(e.key==='End')this.inspectDomain(this.domain[1],true);
        if(e.key==='+'||e.key==='=')this.zoom(1.5,d);if(e.key==='-')this.zoom(1/1.5,d);if(e.key==='0')this.fit();
      });
    }
    destroy(){this.resizeObserver.disconnect();cancelAnimationFrame(this.frame);this.controls.remove();}
    syncControls(){for(const b of this.controls.querySelectorAll('[data-cursor]')){const key=b.dataset.cursor;b.hidden=key!=='toggle'&&!this.dual;b.setAttribute('aria-pressed',String(key==='toggle'?this.dual:key===this.activeCursor));}this.controls.querySelector('span').textContent=this.dual?'Scegli A o B, poi clicca il grafico':'Passa sul grafico per leggere';}
    set(config){
      const old=this.config,same=old&&old.logX===config.logX&&old.xUnit===config.xUnit&&this.data[0]?.x===config.data[0]?.x&&this.data.at(-1)?.x===config.data.at(-1)?.x,ax=this.cursorA?.x,bx=this.cursorB?.x;
      this.config=config;this.data=config.data;this.series=config.series.filter(s=>s.visible!==false);this.toDomain=config.logX?x=>Math.log10(x):x=>x;this.fromDomain=config.logX?x=>10**x:x=>x;
      this.domain=[this.toDomain(this.data[0].x),this.toDomain(this.data.at(-1).x)];if(this.domain[0]===this.domain[1]){const gap=config.logX?.1:Math.max(Math.abs(this.domain[0])*.05,1e-9);this.domain=[this.domain[0]-gap,this.domain[1]+gap];}if(!same)this.view=[...this.domain];
      this.cursorA=same?window.LabMeasurements.nearest(this.data,ax):this.data[Math.floor((this.data.length-1)*.15)];
      this.cursorB=same?window.LabMeasurements.nearest(this.data,bx):this.data[Math.floor((this.data.length-1)*.65)];
      this.cursor=this.activeCursor==='b'&&this.dual?this.cursorB:this.cursorA;this.syncControls();this.draw();
    }
    updateSeries(series){this.config.series=series;this.series=series.filter(s=>s.visible!==false);this.draw();}
    exportState(){
      if(!this.data.length||!this.view)return null;
      const point=d=>({x:d.x,index:this.data.indexOf(d)});
      return{logX:this.config.logX,xUnit:this.config.xUnit,view:this.view.map(this.fromDomain),a:point(this.cursorA),b:point(this.cursorB),dual:this.dual,activeCursor:this.activeCursor};
    }
    restoreState(state){
      if(!state||!this.data.length||state.logX!==this.config.logX||state.xUnit!==this.config.xUnit)return;
      const lo=Math.max(this.domain[0],this.toDomain(state.view[0])),hi=Math.min(this.domain[1],this.toDomain(state.view[1]));
      if(Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo)this.view=[lo,hi];
      const point=s=>this.data[s.index]?.x===s.x?this.data[s.index]:window.LabMeasurements.nearest(this.data,s.x);
      this.cursorA=point(state.a);this.cursorB=point(state.b);this.dual=state.dual;this.activeCursor=state.activeCursor;this.syncControls();this.draw();
    }
    fit(){if(!this.domain)return;this.view=[...this.domain];this.draw();this.onStateChange?.();}
    zoom(factor,anchor=(this.view[0]+this.view[1])/2){const old=this.view[1]-this.view[0],span=clamp(old/factor,(this.domain[1]-this.domain[0])/1000,this.domain[1]-this.domain[0]),fraction=(anchor-this.view[0])/old,start=clamp(anchor-span*fraction,this.domain[0],this.domain[1]-span);this.view=[start,start+span];this.draw();this.onStateChange?.();}
    point(e){const b=this.svg.getBoundingClientRect(),g=this.geometry;if(!g)return{inside:false};const x=(e.clientX-b.left)*g.w/b.width,y=(e.clientY-b.top)*g.h/b.height;return{x,y,domain:this.view[0]+(x-g.left)/g.pw*(this.view[1]-this.view[0]),inside:x>=g.left&&x<=g.w-g.right&&y>=g.top&&y<=g.h-g.bottom};}
    inspectDomain(d,reveal=false){d=clamp(d,...this.domain);const value=this.fromDomain(d);let lo=0,hi=this.data.length;while(lo<hi){const m=(lo+hi)>>1;if(this.data[m].x<=value)lo=m+1;else hi=m;}
      let i=Math.max(0,lo-1);if(lo<this.data.length&&Math.abs(this.data[lo].x-value)<Math.abs(this.data[i].x-value))i=lo;this.cursor=this.data[i];if(this.dual&&this.activeCursor==='b')this.cursorB=this.cursor;else this.cursorA=this.cursor;
      if(reveal&&(d<this.view[0]||d>this.view[1])){const span=this.view[1]-this.view[0],start=clamp(d-span/2,this.domain[0],this.domain[1]-span);this.view=[start,start+span];this.draw();}else this.drawCursor();
      this.onStateChange?.();
    }
    setFraction(f){this.inspectDomain(this.domain[0]+clamp(f,0,1)*(this.domain[1]-this.domain[0]),true);}
    draw(){
      if(!this.data.length)return;const rect=this.svg.parentElement.getBoundingClientRect(),w=Math.max(250,rect.width),h=Math.max(140,rect.height),left=60,right=24,top=21,bottom=35,pw=w-left-right,ph=h-top-bottom;
      const x=value=>left+(this.toDomain(value)-this.view[0])/(this.view[1]-this.view[0])*pw;
      let min=Infinity,max=-Infinity;const visible=this.data.filter(d=>this.toDomain(d.x)>=this.view[0]&&this.toDomain(d.x)<=this.view[1]);
      for(const d of visible)for(const s of this.series)if(Number.isFinite(d[s.key])){const sigma=s.sigmaKey&&Number.isFinite(d[s.sigmaKey])?d[s.sigmaKey]:0;min=Math.min(min,d[s.key]-sigma);max=Math.max(max,d[s.key]+sigma);}
      if(!Number.isFinite(min)){min=-1;max=1;}if(!this.config.noZero){min=Math.min(min,0);max=Math.max(max,0);}
      if(max-min<1e-15){min-=1;max+=1;}const gap=(max-min)*.1;min-=gap;max+=gap;
      const y=v=>top+(max-v)/(max-min)*ph,yScale=this.config.plainY||['dB','°'].includes(this.config.yUnit)?{factor:1,unit:this.config.yUnit}:RCModel.scale(Math.max(Math.abs(min),Math.abs(max)),this.config.yUnit);
      this.geometry={w,h,left,right,top,bottom,pw,ph,x,y};
      const num=v=>new Intl.NumberFormat('it-IT',{maximumSignificantDigits:4}).format(v);
      let html=`<defs><clipPath id="${this.svg.id}-clip"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs>`;
      for(const v of ticks(min,max,4))html+=`<path d="M${left},${y(v)}H${w-right}" stroke="${v===0?'#dce3ed':'#edf1f6'}"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end">${num(v/yScale.factor)}</text>`;
      let xticks=this.config.logX?Array.from({length:Math.ceil(this.view[1])-Math.floor(this.view[0])+1},(_,i)=>10**(Math.floor(this.view[0])+i)).filter(v=>this.toDomain(v)>=this.view[0]&&this.toDomain(v)<=this.view[1]):ticks(...this.view,Math.max(3,Math.floor(pw/100)));
      if(this.config.logX&&xticks.length<2)xticks=ticks(this.fromDomain(this.view[0]),this.fromDomain(this.view[1]),5);
      const timeScale=RCModel.scale(this.view[1]-this.view[0],this.config.xUnit);
      for(const v of xticks){html+=`<path d="M${x(v)},${top}V${h-bottom}" stroke="#f0f3f7"/><text x="${x(v)}" y="${h-bottom+22}" text-anchor="middle">${this.config.logX?M.format(v,this.config.xUnit):num(v/timeScale.factor)}</text>`;}
      html+=`<text x="${left-11}" y="12" text-anchor="end" class="axis-unit">${yScale.unit}</text><text x="${w-right}" y="${h-2}" text-anchor="end" class="axis-unit">${this.config.logX?'Frequenza':this.config.xLabel} ${!this.config.logX?'('+timeScale.unit+')':''}</text><g clip-path="url(#${this.svg.id}-clip)">`;
      for(const guide of this.config.guides||[]){if(this.toDomain(guide.x)>this.view[0]&&this.toDomain(guide.x)<this.view[1])html+=`<path d="M${x(guide.x)},${top+13}V${h-bottom}" stroke="#bcc9e5" stroke-dasharray="3 5"/><text x="${x(guide.x)+5}" y="${top+10}" class="guide-text">${guide.label}</text>`;}
      for(const s of this.series){let path='',started=false;for(let i=0;i<this.data.length;i++){const d=this.data[i];if(!Number.isFinite(d[s.key])){started=false;continue;}const domain=this.toDomain(d.x);if(domain<this.view[0]&&i+1<this.data.length&&this.toDomain(this.data[i+1].x)<this.view[0])continue;if(domain>this.view[1]&&i>0&&this.toDomain(this.data[i-1].x)>this.view[1])continue;path+=(started?'L':'M')+x(d.x).toFixed(2)+','+y(d[s.key]).toFixed(2);started=true;}
        if(s.line!==false)html+=`<path d="${path}" stroke="${s.color}" stroke-width="${s.key==='out'?2.4:1.7}" fill="none" stroke-linejoin="round" stroke-linecap="round"${s.dash?' stroke-dasharray="'+s.dash+'"':''}/>`;
        if(s.points||s.sigmaKey)for(const d of visible){if(!Number.isFinite(d[s.key]))continue;const px=x(d.x),py=y(d[s.key]),sigma=d[s.sigmaKey];if(s.sigmaKey&&Number.isFinite(sigma)&&sigma>0){const a=y(d[s.key]-sigma),b=y(d[s.key]+sigma);html+=`<path d="M${px},${a}V${b}M${px-3},${a}h6M${px-3},${b}h6" stroke="${s.color}" stroke-width="1" fill="none"/>`;}if(s.points)html+=`<circle cx="${px}" cy="${py}" r="2.6" fill="${s.color}" stroke="white" stroke-width=".7"/>`;}
      }
      html+=`<g id="${this.svg.id}-cursor"></g></g>`;
      this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.innerHTML=html;this.drawCursor();
    }
    drawCursor(){
      if(!this.geometry||!this.cursorA||!this.data.length)return;
      this.cursor=this.dual&&this.activeCursor==='b'?this.cursorB:this.cursorA;
      const g=this.geometry,root=this.svg.querySelector('#'+this.svg.id+'-cursor');if(!root)return;
      const markers=this.dual?[['A',this.cursorA,'#4264ef'],['B',this.cursorB,'#d48b22']]:[['',this.cursorA,'#8394b7']];
      root.innerHTML=markers.map(([label,d,color])=>{
        if(this.toDomain(d.x)<this.view[0]||this.toDomain(d.x)>this.view[1])return'';
        const x=g.x(d.x);return`<path d="M${x},${g.top}V${g.h-g.bottom}" stroke="${color}" stroke-dasharray="3 4"/><text x="${x+5}" y="${g.top+12}" style="fill:${color};font-weight:600">${label}</text>`+this.series.filter(s=>Number.isFinite(d[s.key])).map(s=>`<circle cx="${x}" cy="${g.y(d[s.key])}" r="3.4" fill="${s.color}" stroke="white" stroke-width="1.5"/>`).join('');
      }).join('');
      this.onCursor(this.cursor,(this.toDomain(this.cursor.x)-this.domain[0])/(this.domain[1]-this.domain[0]),this.dual?{a:this.cursorA,b:this.cursorB,active:this.activeCursor}:null);
    }

  }
  window.LabPlot=LabPlot;
})();
