/* Editable layout of the electrically defined lab circuits. Moving a component
   changes its placement; ports and wires continue to follow the same circuit. */
(() => {
  'use strict';
  const M=window.LabModel;
  const bounded=(n,min,max,fallback)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  class LabDiagram {
    constructor(svg,callbacks){
      this.svg=svg;this.callbacks=callbacks;this.view={x:0,y:0,k:1};this.pointers=new Map();
      svg.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.008),this.point(e));},{passive:false});
      svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
      for(const type of ['pointerup','pointercancel'])svg.addEventListener(type,e=>this.up(e));
      svg.addEventListener('lostpointercapture',e=>this.up({pointerId:e.pointerId,type:'pointercancel'}));
      svg.addEventListener('keydown',e=>{
        if(e.ctrlKey||e.metaKey||e.altKey)return;
        const id=e.target.closest('[data-component]')?.dataset.component;
        if(id&&['Enter',' '].includes(e.key)){e.preventDefault();this.callbacks.select(id);}
        if(id&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const c=this.components[id],d=e.shiftKey?20:5;this.commit(id,{x:c.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),y:c.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0),rotation:c.rotation});}
        if(e.key==='+'||e.key==='='){e.preventDefault();this.zoom(1.2);}
        if(e.key==='-'){e.preventDefault();this.zoom(1/1.2);}
        if(e.key==='0'){e.preventDefault();this.fit();}
      });
    }
    definitions(p){
      const fmt=(v,u)=>M.format(v,u),source=(id,x,y,w)=>({id,x,y,kind:'source',name:id==='V1'?'V₁':'V₂',value:['charge','cycle','dc'].includes(w.kind)?fmt(w.level,'V'):w.kind==='discharge'||w.kind==='ground'?'0 V':fmt(w.vpp,'V')+'pp'});
      if(p.type==='rc'){
        const c={V1:source('V1',100,166,p.wave1),R:{x:405,y:88,kind:'resistor',name:'R',value:fmt(p.R,'Ω')},C:{x:680,y:185,rotation:90,kind:'capacitor',name:'C',value:fmt(p.C,'F')}};
        const ins=M.instrument(p);
        if(ins.rg>0)c.Rg={x:230,y:88,kind:'resistor',name:'Rɢ',value:fmt(ins.rg,'Ω')};
        if(Number.isFinite(ins.scopeR))for(const [id,x]of[['CH1',320],['CH2',820]])c[id]={x,y:210,kind:'probe',name:id,value:fmt(ins.scopeR,'Ω')+' ∥ '+fmt(ins.scopeC,'F')};
        return c;
      }
      const c={V1:source('V1',105,p.type==='difference'?110:173,p.wave1),R1:{x:p.type==='derivative'?315:350,y:p.type==='difference'?58:85,kind:'resistor',name:'R₁',value:fmt(p.R1,'Ω')},Rf:{x:640,y:p.type==='difference'?58:85,kind:'resistor',name:'Rf',value:fmt(p.Rf,'Ω')},U1:{x:640,y:170,kind:'opamp',name:'U₁',value:p.opamp==='ideal'?'Ideale':p.opamp==='physical'?fmt(window.LabModel.physical(p).positive,'V')+' / '+fmt(window.LabModel.physical(p).negative,'V'):'Banda · ±'+fmt(p.rail,'V')}};
      if(p.type==='derivative')c.C1={x:440,y:85,kind:'capacitor',name:'C₁',value:fmt(p.C1,'F')};
      if(p.type==='difference'){
        c.V2=source('V2',105,265,p.wave2);c.R3={x:350,y:222,kind:'resistor',name:'R₃',value:fmt(p.R3,'Ω')};c.R4={x:530,y:280,rotation:90,kind:'resistor',name:'R₄',value:fmt(p.R4,'Ω')};
        if(p.drive==='v1')c.V2.value='0 V';
        if(p.drive==='v2'){c.V1.value='0 V';c.V2.value=source('V2',0,0,p.wave1).value;}
        if(p.drive==='common')c.V2.value=c.V1.value;
        if(p.drive==='differential'){c.V1.value=fmt(p.wave1.vpp/2,'V')+'pp · −';c.V2.value=fmt(p.wave1.vpp/2,'V')+'pp · +';}
      }
      return c;
    }
    render(p,layout={},selected=null){
      this.p=p;this.layout=layout;this.selected=selected;
      const definitions=this.definitions(p);this.components={};
      for(const[id,c]of Object.entries(definitions)){const o=layout[id]||{};this.components[id]={...c,id,x:bounded(o.x,60,860,c.x),y:bounded(o.y,38,p.type==='difference'?300:245,c.y),rotation:['resistor','capacitor'].includes(c.kind)?([0,90,180,270].includes(o.rotation)?o.rotation:c.rotation||0):0};}
      this.draw();
    }
    port(id,x,y){const c=this.components[id],a=c.rotation*Math.PI/180;return{x:c.x+x*Math.cos(a)-y*Math.sin(a),y:c.y+x*Math.sin(a)+y*Math.cos(a)};}
    terminal(id,side){const c=this.components[id];return c.kind==='source'?this.port(id,0,side==='a'?-24:24):c.kind==='probe'?this.port(id,0,side==='a'?-20:20):this.port(id,side==='a'?-(c.kind==='capacitor'?25:45):(c.kind==='capacitor'?25:45),0);}
    draw(){
      const focus=this.svg.contains(document.activeElement)?document.activeElement.dataset.component:null;
      const p=this.p,c=this.components,paths=[],dots=[],labels=[];
      const wire=(a,b,vertical=false)=>{const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;paths.push(`<path d="M${a.x},${a.y}${vertical?`V${my}H${b.x}V${b.y}`:`H${mx}V${b.y}H${b.x}`}"/>`);};
      const ground=(at,y)=>{wire(at,{x:at.x,y},true);paths.push(`<path d="M${at.x-11},${y}h22m-18,5h14m-10,5h6"/>`);};
      const dot=(q)=>dots.push(`<circle cx="${q.x}" cy="${q.y}" r="3"/>`);
      const tag=(q,text,color=false)=>labels.push(`<text x="${q.x}" y="${q.y}" class="node-label ${color?'output-label':''}">${text}</text>`);
      if(p.type==='rc'){
        const source=this.terminal('V1','a'),ra=this.terminal('R','a'),rb=this.terminal('R','b'),ca=this.terminal('C','a'),cb=this.terminal('C','b');
        const vin={x:c.Rg?this.terminal('Rg','b').x+44:ra.x-65,y:88},out={x:ca.x,y:88};
        if(c.Rg){wire(source,this.terminal('Rg','a'));wire(this.terminal('Rg','b'),vin);}else wire(source,vin);
        wire(vin,ra);wire(rb,out);wire(out,ca,true);dot(vin);dot(out);tag({x:vin.x-9,y:vin.y-15},'V₁');
        wire(out,{x:out.x+100,y:out.y});tag({x:out.x+110,y:out.y+4},'OUT',true);
        const bottom={x:ca.x,y:270};wire(cb,bottom,true);wire(this.terminal('V1','b'),{x:c.V1.x,y:270},true);wire({x:c.V1.x,y:270},bottom);ground(bottom,270);
        for(const[id,node]of[['CH1',vin],['CH2',out]])if(c[id]){wire(node,this.terminal(id,'a'));ground(this.terminal(id,'b'),270);}
      }else{
        const minus=this.port('U1',-50,-22),plus=this.port('U1',-50,22),ampout=this.port('U1',50,0),out={x:ampout.x+80,y:ampout.y};
        const sum={x:minus.x-55,y:c.Rf.y};
        wire(this.terminal('V1','a'),{x:210,y:c.R1.y});tag({x:200,y:c.R1.y-15},'V₁');wire({x:210,y:c.R1.y},this.terminal('R1','a'));
        if(c.C1){wire(this.terminal('R1','b'),this.terminal('C1','a'));wire(this.terminal('C1','b'),sum);}else wire(this.terminal('R1','b'),sum);
        wire(sum,minus,true);wire(sum,this.terminal('Rf','a'));wire(this.terminal('Rf','b'),{x:out.x,y:c.Rf.y});wire({x:out.x,y:c.Rf.y},out,true);wire(ampout,out);wire(out,{x:out.x+50,y:out.y});dot(sum);dot(out);tag({x:out.x+60,y:out.y+4},'OUT',true);
        ground(this.terminal('V1','b'),p.type==='difference'?175:270);
        if(c.V2){const junction={x:c.R4.x,y:c.R3.y};wire(this.terminal('V2','a'),{x:210,y:c.R3.y});wire({x:210,y:c.R3.y},this.terminal('R3','a'));tag({x:200,y:c.R3.y-15},'V₂');wire(this.terminal('R3','b'),junction);wire(junction,plus);wire(junction,this.terminal('R4','a'),true);ground(this.terminal('R4','b'),330);ground(this.terminal('V2','b'),320);dot(junction);}
        else ground(plus,270);
      }
      const symbols=Object.values(c).map(item=>this.symbol(item)).join('');
      const h=p.type==='difference'?350:300;this.height=h;this.svg.setAttribute('viewBox',`0 0 940 ${h}`);
      this.svg.innerHTML=`<g id="diagramScene"><g class="circuit-wires">${paths.join('')}</g><g class="circuit-dots">${dots.join('')}</g>${labels.join('')}${symbols}</g>`;
      this.transform();
      if(focus)this.svg.querySelector(`[data-component="${focus}"]`)?.focus({preventScroll:true});
    }
    symbol(c){
      const selected=c.id===this.selected,rot=c.rotation;
      const box=c.kind==='opamp'?[-66,-66,132,150]:c.kind==='probe'?[-67,-30,134,95]:[-64,-44,128,99];
      let symbol='';
      if(c.kind==='resistor')symbol='<path d="M-45,0H-30M30,0H45"/><rect x="-30" y="-10" width="60" height="20" rx="2"/>';
      if(c.kind==='capacitor')symbol='<path d="M-25,0H-7M7,0H25M-7,-20V20M7,-20V20"/>';
      if(c.kind==='source')symbol='<circle r="24"/><path d="M-6,-7H6M0,-13V-1M-6,10H6"/>';
      if(c.kind==='opamp')symbol='<path d="M-50,-43V43L50,0ZM-50,-22H-60M-50,22H-60M50,0H60"/><text class="pin-label" x="-40" y="-17">−</text><text class="pin-label" x="-40" y="28">+</text>';
      if(c.kind==='probe')symbol='<rect x="-32" y="-20" width="64" height="40" rx="7" stroke-dasharray="3 3"/><path d="M-19,0h8l5,-8 10,16 5,-8h10"/>';
      const vertical=['resistor','capacitor'].includes(c.kind)&&rot%180===90;
      const labelX=c.kind==='source'?-38:vertical?36:0,anchor=c.kind==='source'?'end':vertical?'start':'middle';
      const nameY=c.kind==='opamp'?-55:c.kind==='source'?-3:vertical?-5:-26,valueY=c.kind==='opamp'?68:c.kind==='source'?18:vertical?17:39;
      return `<g class="schematic-component ${selected?'selected':''}" data-component="${c.id}" transform="translate(${c.x} ${c.y})" tabindex="0" role="button" aria-pressed="${selected}" aria-label="Modifica ${c.name}"><rect class="component-selection" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" rx="9"/><g class="component-ink" transform="rotate(${rot})">${symbol}</g><text class="component-name" x="${labelX}" y="${nameY}" text-anchor="${anchor}">${c.name}</text>${c.kind==='probe'?'':`<text class="component-editable-value" x="${labelX}" y="${valueY}" text-anchor="${anchor}">${c.value}</text>`}</g>`;
    }
    point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());}
    transform(){const g=this.svg.querySelector('#diagramScene');if(g)g.setAttribute('transform',`translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`);this.callbacks.zoom?.(Math.round(this.view.k*100));}
    zoom(factor,point={x:470,y:this.height/2}){const next=bounded(this.view.k*factor,.5,3.5,1),ratio=next/this.view.k;this.view.x=point.x-(point.x-this.view.x)*ratio;this.view.y=point.y-(point.y-this.view.y)*ratio;this.view.k=next;this.transform();}
    fit(){this.view={x:0,y:0,k:1};this.transform();}
    rotate(){const id=this.selected,c=this.components[id];if(!c||!['resistor','capacitor'].includes(c.kind))return;this.commit(id,{x:c.x,y:c.y,rotation:(c.rotation+90)%360});}
    commit(id,value){this.layout[id]=value;this.callbacks.move(id,value);this.render(this.p,this.layout,this.selected);}
    cancelDrag(){const drag=this.drag;this.drag=null;if(drag?.id&&drag.moved){this.components[drag.id]={...drag.start};this.draw();}}
    cancelGesture(){this.cancelDrag();const pointers=[...this.pointers.keys()];this.pointers.clear();this.pinch=null;for(const id of pointers)if(this.svg.hasPointerCapture(id))this.svg.releasePointerCapture(id);}
    down(e){if(e.button!==0)return;const point=this.point(e);this.pointers.set(e.pointerId,point);this.svg.setPointerCapture(e.pointerId);
      if(this.pointers.size>=2){this.cancelDrag();const[a,b]=[...this.pointers.values()];this.pinch=this.pointers.size===2?{distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}:null;return;}
      const id=e.target.closest('[data-component]')?.dataset.component;this.drag={id,point,start:id?{...this.components[id]}:{...this.view},moved:false};
    }
    move(e){if(!this.pointers.has(e.pointerId))return;const point=this.point(e);this.pointers.set(e.pointerId,point);
      if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(this.pinch.distance>0)this.zoom(distance/this.pinch.distance,this.pinch.mid);this.view.x+=mid.x-this.pinch.mid.x;this.view.y+=mid.y-this.pinch.mid.y;this.pinch={distance,mid};this.transform();return;}
      if(!this.drag)return;const dx=point.x-this.drag.point.x,dy=point.y-this.drag.point.y;if(Math.hypot(dx,dy)>4)this.drag.moved=true;
      if(this.drag.moved){if(this.drag.id){const c=this.drag.start;this.components[this.drag.id]={...c,x:bounded(Math.round((c.x+dx/this.view.k)/5)*5,60,860,c.x),y:bounded(Math.round((c.y+dy/this.view.k)/5)*5,38,this.p.type==='difference'?300:245,c.y)};this.draw();}else{this.view.x=this.drag.start.x+dx;this.view.y=this.drag.start.y+dy;this.transform();}}
    }
    up(e){if(!this.pointers.has(e.pointerId))return;const drag=this.drag;this.drag=null;this.pointers.delete(e.pointerId);this.pinch=null;
      if(e.type==='pointerup'&&drag){if(drag.id){const id=drag.id,c=this.components[id];if(drag.moved)this.commit(id,{x:c.x,y:c.y,rotation:c.rotation});this.callbacks.select(id);}else if(!drag.moved)this.callbacks.deselect?.();}
      else if(drag?.id&&drag.moved){this.components[drag.id]={...drag.start};this.draw();}
    }
  }
  window.LabDiagram=LabDiagram;
})();
