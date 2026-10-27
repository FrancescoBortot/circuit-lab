(() => {
  'use strict';
  const M=window.FreeModel,fmt=window.LabModel.format,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const local={R:{a:[-44,0],b:[44,0]},C:{a:[-34,0],b:[34,0]},L:{a:[-44,0],b:[44,0]},V:{p:[0,-43],n:[0,43]},I:{p:[0,-43],n:[0,43]},U:{plus:[-52,25],minus:[-52,-25],out:[60,0]},G:{g:[0,-22]},J:{j:[0,0]},D:{a:[-44,0],b:[44,0]},Q:{c:[20,-42],b:[-46,0],e:[20,42]},M:{d:[24,-42],g:[-46,0],s:[24,42]}};
  class FreeCanvas {
    constructor(svg,callbacks){
      this.svg=svg;this.callbacks=callbacks;this.view={x:0,y:0,w:1000,h:600};this.mode='select';this.pointers=new Map();
      svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));for(const t of ['pointerup','pointercancel'])svg.addEventListener(t,e=>this.up(e));
      svg.addEventListener('lostpointercapture',e=>this.up({pointerId:e.pointerId,type:'pointercancel'}));
      svg.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.007),this.point(e));},{passive:false});
      svg.addEventListener('keydown',e=>{
        if(e.ctrlKey||e.metaKey||e.altKey)return;
        const pin=e.target.closest('[data-pin]')?.dataset.pin,id=e.target.closest('[data-part]')?.dataset.part,wire=e.target.closest('[data-wire]')?.dataset.wire;
        if(['Enter',' '].includes(e.key)&&(pin||id||wire)){e.preventDefault();if(pin)this.callbacks.pin(pin);else this.callbacks.select(id?'component':'wire',id||wire,e.shiftKey||this.mode==='multi');}
        if(id&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const c=this.doc.components.find(c=>c.id===id),d=e.shiftKey?40:10;this.callbacks.move(id,c.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),c.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0));}
        if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')this.fit();else this.zoom(e.key==='-'?1/1.25:1.25);}
      });
      svg.addEventListener('dragover',e=>e.preventDefault());svg.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('application/circuit-component');if(Object.hasOwn(M.PINS,type))this.callbacks.add(type,this.point(e));});
    }
    port(ref){const[id,pin]=ref.split(':'),c=this.doc.components.find(c=>c.id===id),p=local[c.type][pin],a=c.rotation*Math.PI/180;const x=c.x+p[0]*Math.cos(a)-p[1]*Math.sin(a),y=c.y+p[0]*Math.sin(a)+p[1]*Math.cos(a);let dx=0,dy=0;
      if(c.type==='Q'||c.type==='M'){if(['b','g'].includes(pin))dx=-1;else dy=['c','d'].includes(pin)?-1:1;}
      else if(c.type==='V'||c.type==='I'||c.type==='G'){dy=pin==='n'?1:-1;}
      else if(c.type!=='J')dx=['a','plus','minus','b','g'].includes(pin)?-1:1;
      return{x,y,dx:Math.round(dx*Math.cos(a)-dy*Math.sin(a)),dy:Math.round(dx*Math.sin(a)+dy*Math.cos(a))};
    }
    render(doc,selection,mode,pending,labels=false){this.doc=doc;this.selection=selection;this.mode=mode;this.pending=pending;this.labels=labels;this.draw();}
    route(w){
      const a=this.port(w.a),b=this.port(w.b),s={x:a.x+a.dx*20,y:a.y+a.dy*20},t={x:b.x+b.dx*20,y:b.y+b.dy*20},points=[a,s],offset=Number.isFinite(w.offset)?w.offset:0;
      if((!w.route||w.route==='auto')&&!offset&&((a.dx&&b.dx&&a.y===b.y)||(a.dy&&b.dy&&a.x===b.x)))return`M${a.x},${a.y}L${b.x},${b.y}`;
      if(w.route==='horizontal')points.push({x:(s.x+t.x)/2+offset,y:s.y},{x:(s.x+t.x)/2+offset,y:t.y});
      else if(w.route==='vertical')points.push({x:s.x,y:(s.y+t.y)/2+offset},{x:t.x,y:(s.y+t.y)/2+offset});
      else if(a.dx&&b.dx){const x=(a.dx===b.dx?(a.dx>0?Math.max(s.x,t.x)+50:Math.min(s.x,t.x)-50):(s.x+t.x)/2)+offset;points.push({x,y:s.y},{x,y:t.y});}
      else if(a.dy&&b.dy){const y=(s.y+t.y)/2+offset;points.push({x:s.x,y},{x:t.x,y});}
      else if(a.dx)points.push({x:s.x+offset,y:t.y},{x:t.x,y:t.y});else points.push({x:t.x,y:s.y+offset},{x:t.x,y:t.y});
      points.push(t,b);return points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join('');
    }
    draw(){
      if(!this.doc)return;const focused=this.svg.contains(document.activeElement)?document.activeElement.getAttribute('data-pin')||document.activeElement.getAttribute('data-part')||document.activeElement.getAttribute('data-wire'):null;
      const t=M.topology(this.doc),used=new Set(this.doc.wires.flatMap(w=>[w.a,w.b])),unconnected=new Set(M.diagnostics(this.doc).map(d=>d.pin).filter(Boolean));
      let html='<defs><pattern id="free-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".8" fill="#ced9eb"/></pattern></defs>'+`<rect x="${this.view.x}" y="${this.view.y}" width="${this.view.w}" height="${this.view.h}" fill="url(#free-grid)"/>`;
      html+=this.doc.wires.map(w=>`<g data-wire="${w.id}" tabindex="0" role="button" aria-label="Seleziona filo ${esc(w.id)} da ${esc(w.a)} a ${esc(w.b)}" class="free-wire ${this.selection?.kind==='wire'&&this.selection.id===w.id?'selected':''}"><title>${esc(w.id)} · ${esc(w.a)} → ${esc(w.b)} · ${t.nodes[w.a]<0?'massa':'N'+(t.nodes[w.a]+1)}</title><path class="wire-hit" d="${this.route(w)}"/><path class="wire-ink" d="${this.route(w)}"/></g>`).join('');
      html+=this.doc.components.map(c=>this.symbol(c)).join('');
      if(this.labels||this.dcValues)for(const n of t.groups){const at=this.port(n.pins[0]);html+=`<text class="free-net-label" x="${at.x+12}" y="${at.y-15}">${esc(n.label||n.name)+(this.dcValues?' · '+esc(fmt(this.dcValues[n.name],'V')):'')}</text>`;}
      for(const [kind,pin]of Object.entries(this.doc.probes)){if(!pin)continue;const at=this.port(pin);html+=`<g class="free-probe ${kind}" transform="translate(${at.x+9} ${at.y-36})"><rect width="${kind==='output'?43:32}" height="21" rx="5"/><text x="8" y="14">${kind==='output'?'OUT':'IN'}</text></g>`;}
      const probeOffsets=new Map();for(const [i,probe]of (this.doc.traces||[]).entries()){
        if(probe.kind!=='voltage')continue;const at=this.port(probe.positive),offset=probeOffsets.get(probe.positive)||0;probeOffsets.set(probe.positive,offset+1);
        const colors=['#159e89','#d78b29','#9c6bce','#dc6c87','#278fa8','#7470d9','#8b9b36','#ae7648'];
        html+=`<g class="free-probe" transform="translate(${at.x+9+offset*35} ${at.y+12})"><rect width="31" height="20" rx="5" style="fill:${colors[i%8]}"/><text x="6" y="14">${probe.id}</text></g>`;
      }
      for(const c of this.doc.components)for(const pin of M.PINS[c.type]){
        const ref=c.id+':'+pin,p=this.port(ref),pending=ref===this.pending,label=M.pinLabel(c.type,pin);
        html+=`<g data-pin="${ref}" class="free-terminal ${used.has(ref)?'connected':''} ${pending?'pending':''} ${unconnected.has(ref)?'unconnected':''}" role="button" tabindex="0" aria-label="Terminale ${esc(c.id)} ${esc(label)}${unconnected.has(ref)?', da collegare':''}"><title>${esc(c.id)} · ${esc(label)} · ${unconnected.has(ref)?'Da collegare':t.nodes[ref]<0?'massa':'N'+(t.nodes[ref]+1)}</title><circle cx="${p.x}" cy="${p.y}" r="16" class="terminal-hit"/><circle cx="${p.x}" cy="${p.y}" r="5" class="terminal-dot"/>${(this.mode==='wire'||unconnected.has(ref))&&c.type!=='J'?`<text x="${p.x+(p.dx||1)*13}" y="${p.y+(p.dy||-1)*13}" text-anchor="${p.dx<0?'end':'start'}">${esc(label)}</text>`:''}</g>`;
      }
      if(this.pending){const at=this.port(this.pending);html+=`<path id="freePendingWire" d="M${at.x},${at.y}" class="pending-wire"/>`;}
      if(this.drag?.region){const r=this.drag.region;html+=`<rect class="free-selection-box" x="${r.x0}" y="${r.y0}" width="${r.x1-r.x0}" height="${r.y1-r.y0}"/>`;}
      this.svg.innerHTML=html;this.svg.setAttribute('viewBox',`${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`);this.svg.classList.toggle('wire-mode',this.mode==='wire');
      if(focused)for(const e of this.svg.querySelectorAll('[data-pin],[data-part],[data-wire]'))if([e.dataset.pin,e.dataset.part,e.dataset.wire].includes(focused)){e.focus({preventScroll:true});break;}
      this.callbacks.zoom?.(Math.round(1000/this.view.w*100));
    }
    symbol(c){
      let shape='',value='';
      if(c.type==='R'){shape='<path d="M-44 0H-25M25 0H44"/><rect x="-25" y="-9" width="50" height="18" rx="1.5"/>';value=fmt(c.value,'Ω');}
      if(c.type==='C'){shape='<path d="M-34 0H-7M7 0H34M-7-20V20M7-20V20"/>';value=fmt(c.value,'F');}
      if(c.type==='L'){shape='<path d="M-44 0H-28a7 9 0 0 1 14 0 7 9 0 0 1 14 0 7 9 0 0 1 14 0 7 9 0 0 1 14 0H44"/>';value=fmt(c.value,'H');}
      if(c.type==='V'||c.type==='I'){
        shape='<path d="M0-43V-22M0 22V43"/><circle r="22"/>'+(c.type==='V'?'<path d="M-5-7H5M0-12V-2M-5 9H5"/>':'<path d="M0-12V12m-5-6 5 6 5-6"/>');
        const weight=this.doc.settings.acWeights?.[c.id]??(c.id===(this.doc.settings.acSource||this.doc.components.find(c=>['V','I'].includes(c.type))?.id)?1:0),phase=((this.doc.settings.acPhases?.[c.id]||0)+(weight<0?180:0)+540)%360-180;
        value=this.doc.settings.analysis==='bode'?'AC '+fmt(Math.abs(weight),c.type==='V'?'V':'A')+' ∠'+fmt(phase,'°'):this.doc.settings.analysis==='op'?'DC '+fmt(this.dcBias?.[c.id]??M.dcValue(c),c.type==='V'?'V':'A'):this.doc.settings.analysis==='dc'?(c.id===(this.doc.settings.dcSource||this.doc.settings.acSource)?'DC '+fmt(this.doc.settings.dcStart??-5,c.type==='V'?'V':'A')+' … '+fmt(this.doc.settings.dcStop??5,c.type==='V'?'V':'A'):'DC '+fmt(M.dcValue(c),c.type==='V'?'V':'A')):c.wave.kind==='pwl'?'PWL · '+c.wave.points.length+' punti':['dc','step','pulse'].includes(c.wave.kind)?fmt(c.wave.level,c.type==='V'?'V':'A'):fmt(c.wave.vpp,c.type==='V'?'V':'A')+'pp';
      }
      if(c.type==='U'){shape='<path d="M-44-43V43L50 0ZM-52-25H-44M-52 25H-44M50 0H60"/><text x="-35" y="-19">−</text><text x="-35" y="31">+</text>';value=c.model==='ideal'?'Ideale':c.model==='physical'?fmt(M.physical(c).positive,'V')+' / '+fmt(M.physical(c).negative,'V'):'Banda · ±'+fmt(c.rail,'V');}
      if(c.type==='D'){shape='<path d="M-44 0H-18M-18-20V20L18 0ZM18-20V20M18 0H44"/>';value='Is '+fmt(c.is,'A')+' · n '+c.n;}
      if(c.type==='Q'){shape='<path d="M-46 0H-12M-12-25V25M-12-16L20-34V-42M-12 16L20 34V42"/>'+ (c.polarity==='p'?'<path d="M10 23L0 23L5 32"/>':'<path d="M7 23L16 32L4 32"/>');value=(c.polarity==='p'?'PNP':'NPN')+' · β '+c.bf;}
      if(c.type==='M'){shape='<path d="M-46 0H-20M-20-24V24M-12-24V24M-12-18H24V-42M-12 18H24V42M-12 0H10"/>'+ (c.polarity==='p'?'<path d="M-3-5L-9 0L-3 5"/>':'<path d="M4-5L10 0L4 5"/>');value=(c.polarity==='p'?'PMOS':'NMOS')+' · Vt '+fmt(c.vto,'V');}
      if(c.type==='G')shape='<path d="M0-22V0m-16 0h32m-27 6h22m-17 6h12m-9 6h6"/>';
      if(c.type==='J')shape='<circle r="5" class="junction-dot"/>';
      const vertical=['R','C','L'].includes(c.type)&&c.rotation%180===90,source=['V','I'].includes(c.type),x=source?-35:vertical?30:0,anchor=source?'end':vertical?'start':'middle',nameY=c.type==='U'?-57:source?-4:vertical?-6:c.type==='G'?42:c.type==='J'?-18:-27,valueY=c.type==='U'?64:source?17:vertical?17:39;
      const hit=c.type==='U'?[-49,-47,105,95]:['Q','M'].includes(c.type)?[-40,-45,80,90]:source?[-28,-28,56,56]:c.type==='G'?[-21,-20,42,43]:c.type==='J'?[-12,-12,24,24]:vertical?[-25,-31,50,62]:[-31,-25,62,50];
      return`<g data-part="${c.id}" class="free-part ${c.benchRole?'bench-part':''} ${(this.selection?.kind==='component'&&this.selection.id===c.id)||(this.selection?.kind==='group'&&this.selection.ids.includes(c.id))?'selected':''}" role="button" tabindex="0" aria-label="Seleziona ${esc(c.id)}, ${M.NAMES[c.type]}" transform="translate(${c.x} ${c.y})"><title>${esc(c.id)} · ${M.NAMES[c.type]}${c.benchRole?' · '+esc(c.benchRole):''}${value?' · '+esc(value):''}</title><rect class="part-hit" x="${hit[0]}" y="${hit[1]}" width="${hit[2]}" height="${hit[3]}" rx="8"/><g class="part-ink" transform="rotate(${c.rotation})">${shape}</g><text class="part-name" x="${x}" y="${nameY}" text-anchor="${anchor}">${esc(c.id)}</text>${value?`<text class="part-value" x="${x}" y="${valueY}" text-anchor="${anchor}">${esc(value)}</text>`:''}</g>`;
    }
    point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());}
    reveal(ref){const p=this.port(ref);if(p.x<this.view.x+35||p.x>this.view.x+this.view.w-35||p.y<this.view.y+35||p.y>this.view.y+this.view.h-35){this.view.x=p.x-this.view.w/2;this.view.y=p.y-this.view.h/2;}this.draw();this.callbacks.view?.();}
    restoreDrag(drag){
      if(drag.groupStart)for(const start of drag.groupStart){const c=this.doc.components.find(c=>c.id===start.id);if(c)Object.assign(c,{x:start.x,y:start.y});}
      else if(drag.id){const c=this.doc.components.find(c=>c.id===drag.id);if(c)Object.assign(c,{x:drag.start.x,y:drag.start.y});}
      if(drag.wire){const index=this.doc.wires.findIndex(w=>w.id===drag.wire);if(index>=0)this.doc.wires[index]={...drag.wireStart};}
    }
    cancelDrag(){const drag=this.drag;this.drag=null;if(drag&&(drag.moved||drag.region)){this.restoreDrag(drag);this.draw();}}
    cancelGesture(){this.cancelDrag();const pointers=[...this.pointers.keys()];this.pointers.clear();this.pinch=null;for(const id of pointers)if(this.svg.hasPointerCapture(id))this.svg.releasePointerCapture(id);}
    down(e){if(e.button!==0)return;const point=this.point(e);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.svg.setPointerCapture(e.pointerId);
      if(this.pointers.size>=2){this.cancelDrag();const[a,b]=[...this.pointers.values()];this.pinch=this.pointers.size===2?Math.hypot(a.x-b.x,a.y-b.y):null;return;}
      const pin=e.target.closest('[data-pin]')?.dataset.pin,id=e.target.closest('[data-part]')?.dataset.part,wire=e.target.closest('[data-wire]')?.dataset.wire;
      this.drag={pin,id,wire,point,matrix:this.svg.getScreenCTM().inverse(),view:{...this.view},start:id?{...this.doc.components.find(c=>c.id===id)}:null,moved:false,multi:e.shiftKey||this.mode==='multi',wireStart:wire?{...this.doc.wires.find(w=>w.id===wire)}:null,groupStart:id&&this.selection?.kind==='group'&&this.selection.ids.includes(id)?this.doc.components.filter(c=>this.selection.ids.includes(c.id)).map(c=>({id:c.id,x:c.x,y:c.y})):null};
    }
    move(e){
      const point=this.point(e),pending=this.svg.querySelector('#freePendingWire');if(pending&&this.pending){const a=this.port(this.pending);pending.setAttribute('d',`M${a.x},${a.y}H${point.x}V${point.y}`);}
      if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size===2&&this.pinch!==null&&this.pinch!==undefined){const[a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(this.pinch>0&&distance>0)this.zoom(distance/this.pinch);this.pinch=distance;return;}
      if(!this.drag||this.drag.pin)return;const fixed=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.drag.matrix),dx=fixed.x-this.drag.point.x,dy=fixed.y-this.drag.point.y;if(Math.hypot(dx,dy)>5)this.drag.moved=true;
      if(this.drag.wire){if(this.drag.moved){const w=this.doc.wires.find(w=>w.id===this.drag.wire),a=this.port(w.a),b=this.port(w.b),original=this.drag.wireStart;w.route=original.route&&original.route!=='auto'?original.route:a.dx&&b.dx?'horizontal':'vertical';w.offset=Math.round(((original.offset||0)+(w.route==='horizontal'?dx:dy))/10)*10;this.draw();}return;}
      if(!this.drag.id&&this.drag.multi){this.drag.region={x0:Math.min(this.drag.point.x,fixed.x),y0:Math.min(this.drag.point.y,fixed.y),x1:Math.max(this.drag.point.x,fixed.x),y1:Math.max(this.drag.point.y,fixed.y)};this.draw();return;}
      if(this.drag.moved){if(this.drag.groupStart){for(const start of this.drag.groupStart){const c=this.doc.components.find(c=>c.id===start.id);c.x=start.x+Math.round(dx/10)*10;c.y=start.y+Math.round(dy/10)*10;}this.draw();}else if(this.drag.id){const c=this.doc.components.find(c=>c.id===this.drag.id);c.x=Math.round((this.drag.start.x+dx)/10)*10;c.y=Math.round((this.drag.start.y+dy)/10)*10;this.draw();}else{this.view.x=this.drag.view.x-dx;this.view.y=this.drag.view.y-dy;this.draw();}}
    }
    up(e){
      if(!this.pointers.has(e.pointerId))return;const drag=this.drag;this.drag=null;this.pointers.delete(e.pointerId);this.pinch=null;
      if(drag&&e.type==='pointerup'){
        if(drag.pin)this.callbacks.pin(drag.pin);
        else if(drag.id){if(drag.moved){if(drag.groupStart){const c=this.doc.components.find(c=>c.id===drag.id),start=drag.groupStart.find(c=>c.id===drag.id),dx=c.x-start.x,dy=c.y-start.y;this.restoreDrag(drag);this.callbacks.moveGroup(drag.groupStart.map(c=>c.id),dx,dy);}else{const c=this.doc.components.find(c=>c.id===drag.id),x=c.x,y=c.y;this.restoreDrag(drag);this.callbacks.move(drag.id,x,y);}}else this.callbacks.select('component',drag.id,drag.multi);}
        else if(drag.wire){if(drag.moved){const w=this.doc.wires.find(w=>w.id===drag.wire),route=w.route,offset=w.offset;this.restoreDrag(drag);this.callbacks.moveWire(drag.wire,route,offset);}else this.callbacks.select('wire',drag.wire);}else if(drag.moved&&drag.region)this.callbacks.region(drag.region);else if(!drag.moved){this.svg.focus({preventScroll:true});this.callbacks.select(null,null);}
      }else if(drag?.moved)this.restoreDrag(drag);
      if(drag&&(drag.moved||drag.region))this.draw();
      if(drag?.moved&&!drag.id&&!drag.wire&&!drag.multi)this.callbacks.view?.();
    }
    zoom(factor,anchor={x:this.view.x+this.view.w/2,y:this.view.y+this.view.h/2}){const w=Math.max(220,Math.min(4000,this.view.w/factor)),ratio=w/this.view.w;this.view={x:anchor.x-(anchor.x-this.view.x)*ratio,y:anchor.y-(anchor.y-this.view.y)*ratio,w,h:this.view.h*ratio};this.draw();this.callbacks.view?.();}
    fit(){if(!this.doc?.components.length){const rect=this.svg.getBoundingClientRect();this.view={x:0,y:0,w:1000,h:1000*Math.max(1,rect.height)/Math.max(1,rect.width)};this.draw();this.callbacks.view?.();return;}const c=this.doc.components,boxes=[...this.svg.querySelectorAll('.wire-ink')].map(p=>p.getBBox()),minX=Math.min(...c.map(c=>c.x-95),...boxes.map(b=>b.x-20)),maxX=Math.max(...c.map(c=>c.x+110),...boxes.map(b=>b.x+b.width+20)),minY=Math.min(...c.map(c=>c.y-65),...boxes.map(b=>b.y-20)),maxY=Math.max(...c.map(c=>c.y+75),...boxes.map(b=>b.y+b.height+20)),rect=this.svg.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),w=Math.max(400,maxX-minX,(maxY-minY)*aspect),h=w/aspect;this.view={x:(minX+maxX-w)/2,y:(minY+maxY-h)/2,w,h};this.draw();this.callbacks.view?.();}
  }
  window.FreeCanvas=FreeCanvas;
})();
