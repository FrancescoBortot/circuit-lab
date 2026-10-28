/* Label placement is presentation only: it never changes terminals or wires. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SchematicLabels=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const move=(b,x,y)=>({...b,x:b.x+x,y:b.y+y});
  const overlap=(a,b,gap=6)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
  const union=boxes=>{if(!boxes.length)return{x:0,y:0,width:1,height:1};const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};};
  function segmentHits(b,s,gap=6){
    const x=b.x-gap,y=b.y-gap,w=b.width+2*gap,h=b.height+2*gap,dx=s.x2-s.x1,dy=s.y2-s.y1;let lo=0,hi=1;
    for(const[p,q]of[[-dx,s.x1-x],[dx,x+w-s.x1],[-dy,s.y1-y],[dy,y+h-s.y1]]){
      if(p===0){if(q<0)return false;}else{const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false;}
    }return true;
  }
  function pathSegments(d){
    const tokens=d.match(/[MmLlHhVv]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[],out=[];let x=0,y=0,cmd='',i=0;
    while(i<tokens.length){if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];const relative=cmd===cmd.toLowerCase(),old={x,y};
      if(/[ML]/i.test(cmd)){if(i+1>=tokens.length)break;x=Number(tokens[i++])+(relative?x:0);y=Number(tokens[i++])+(relative?y:0);if(cmd.toLowerCase()==='m'){cmd=relative?'l':'L';continue;}}
      else if(cmd.toLowerCase()==='h')x=Number(tokens[i++])+(relative?x:0);
      else if(cmd.toLowerCase()==='v')y=Number(tokens[i++])+(relative?y:0);else break;
      if(!Number.isFinite(x+y))break;out.push({x1:old.x,y1:old.y,x2:x,y2:y});
    }return out;
  }
  function arrange(blocks,obstacles=[],segments=[]){
    const placed=[],bounds=union([...obstacles,...blocks.map(b=>b.box)]),result=[];
    for(const block of blocks){const b=block.box,options=[[0,0]];
      // Nearest usable location wins; keep name and value together.
      for(let r=12;r<=240;r+=12)for(const[dx,dy]of[[0,-r],[0,r],[-r,0],[r,0],[-r,-r],[r,-r],[-r,r],[r,r]])options.push([dx,dy]);
      let chosen;
      const clear=q=>!obstacles.some(o=>overlap(q,o))&&!placed.some(o=>overlap(q,o))&&!segments.some(s=>segmentHits(q,s));
      for(const[dx,dy]of options){const q=move(b,dx,dy);if(clear(q)){chosen={dx,dy,box:q};break;}}
      // Dense drawings get an annotation column instead of overlapping text.
      if(!chosen){const x=bounds.x+bounds.width+36;let y=bounds.y;while(!clear({x,y,width:b.width,height:b.height}))y+=b.height+14;chosen={dx:x-b.x,dy:y-b.y,box:{x,y,width:b.width,height:b.height}};}
      placed.push(chosen.box);result.push({...chosen,id:block.id});
    }return{placements:result,bounds:union([...obstacles,...placed,...segments.map(s=>({x:Math.min(s.x1,s.x2),y:Math.min(s.y1,s.y2),width:Math.abs(s.x2-s.x1),height:Math.abs(s.y2-s.y1)}))])};
  }
  function place(svg,{root=svg}={}){
    if(!svg.getScreenCTM())return null;
    const matrix=root.getCTM();if(!matrix)return null;const inverse=matrix.inverse();
    const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
    const box=e=>{const b=e.getBBox(),m=inverse.multiply(e.getCTM()),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>point(m,x,y));return union(points.map(p=>({...p,width:0,height:0})));};
    root.querySelectorAll('.label-leader,.label-backplate').forEach(e=>e.remove());
    const elements=[...root.querySelectorAll('[data-label-block],.node-label,.free-net-label,.free-probe,.free-terminal text')];
    for(const e of elements){if(e.hasAttribute('data-label-base'))e.setAttribute('transform',e.getAttribute('data-label-base'));else e.setAttribute('data-label-base',e.getAttribute('transform')||'');}
    const obstacles=[...root.querySelectorAll('.component-ink,.part-ink,.terminal-dot')].map(box);
    const segments=[...root.querySelectorAll('.circuit-wires path,.wire-ink')].flatMap(e=>{const m=inverse.multiply(e.getCTM());return pathSegments(e.getAttribute('d')||'').map(s=>{const a=point(m,s.x1,s.y1),b=point(m,s.x2,s.y2);return{x1:a.x,y1:a.y,x2:b.x,y2:b.y};});});
    const blocks=elements.map((e,i)=>({id:i,box:box(e)})),result=arrange(blocks,obstacles,segments);
    for(const p of result.placements){const e=elements[p.id],base=e.getAttribute('data-label-base');e.setAttribute('transform',`translate(${p.dx} ${p.dy}) ${base}`.trim());
      if(Math.hypot(p.dx,p.dy)>30){
        const owner=e.closest('[data-component],[data-part]'),ink=owner?.querySelector('.component-ink,.part-ink'),before=ink?box(ink):blocks[p.id].box;
        const edge=(b,target)=>{const c={x:b.x+b.width/2,y:b.y+b.height/2},dx=target.x-c.x,dy=target.y-c.y,t=Math.min(dx?b.width/2/Math.abs(dx):Infinity,dy?b.height/2/Math.abs(dy):Infinity);return{x:c.x+dx*(Number.isFinite(t)?t:0),y:c.y+dy*(Number.isFinite(t)?t:0)};};
        const from=edge(before,{x:p.box.x+p.box.width/2,y:p.box.y+p.box.height/2}),to=edge(p.box,from),line=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
        line.setAttribute('class','label-leader');line.setAttribute('d',`M${from.x},${from.y}L${to.x},${to.y}`);root.insertBefore(line,root.firstChild);
      }
      if(e.hasAttribute('data-label-block')){const b=e.getBBox(),back=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','rect');back.setAttribute('class','label-backplate');for(const[k,v]of Object.entries({x:b.x-2,y:b.y-2,width:b.width+4,height:b.height+4,rx:2}))back.setAttribute(k,String(v));e.insertBefore(back,e.firstChild);}

    }
    return result;
  }
  return{arrange,place,overlap,segmentHits,pathSegments,union};
});
