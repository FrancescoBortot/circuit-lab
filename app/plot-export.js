/* Standalone graphics capture the displayed range, units, traces and legend. */
(() => {
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 function build(plots,title){
  const root=document.createElementNS(ns,'svg');
  const items=plots.map(({svg,series=[],label='',note=''})=>{
   const [,,w,h]=(svg.getAttribute('viewBox')||'0 0 700 240').split(/\s+/).map(Number);
   return{svg,series,label,note,w,h};
  });
  const width=Math.max(640,...items.map(p=>p.w));
  let y=24;
  function text(value,x,top,size=13){
   const node=document.createElementNS(ns,'text');
   node.setAttribute('x',x);node.setAttribute('y',top);
   node.setAttribute('font-size',size);node.setAttribute('fill','#23324a');
   node.textContent=value;root.append(node);
  }
  function wrap(value,size){
   let line='';
   const capacity=Math.floor((width-32)/(size*.58));
   for(const word of value.split(/\s+/)){
    if(line&&(line+' '+word).length>capacity){text(line,16,y,size);y+=size+6;line='';}
    line+=(line?' ':'')+word;
   }
   if(line){text(line,16,y,size);y+=size+6;}
  }
  wrap(title,17);y+=12;
  for(const [index,item] of items.entries()){
   wrap(item.label,14);
   wrap(item.note,12);
   for(const s of item.series.filter(s=>s.visible!==false)){
    const color=s.color||'#23324a';
    if(s.line!==false){
     const line=document.createElementNS(ns,'path');
     line.setAttribute('d',`M16 ${y-4}h28`);
     line.setAttribute('stroke',color);line.setAttribute('stroke-width','2');
     if(s.dash)line.setAttribute('stroke-dasharray',s.dash);
     root.append(line);
    }
    if(s.points){
     const dot=document.createElementNS(ns,'circle');
     dot.setAttribute('cx','30');dot.setAttribute('cy',String(y-4));
     dot.setAttribute('r','3');dot.setAttribute('fill',color);root.append(dot);
    }
    text(s.label,54,y);y+=20;
   }
   const copy=item.svg.cloneNode(true),original=[item.svg,...item.svg.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
   const ids=new Map(clones.filter(node=>node.id).map(node=>[node.id,'plot-'+index+'-'+node.id]));
   for(const clone of clones){
    if(clone.id)clone.id=ids.get(clone.id);
    const clip=clone.getAttribute('clip-path');
    if(clip)clone.setAttribute('clip-path',clip.replace(/url\(#([^)]*)\)/g,(value,id)=>ids.has(id)?'url(#'+ids.get(id)+')':value));
   }
   original.forEach((node,i)=>{const style=getComputedStyle(node);for(const key of ['fill','stroke','stroke-width','stroke-dasharray','font-family','font-size','font-weight','opacity'])clones[i].style.setProperty(key,style.getPropertyValue(key));});
   copy.setAttribute('x','0');copy.setAttribute('y',String(y));copy.setAttribute('width',String(width));copy.setAttribute('height',String(item.h*width/item.w));copy.removeAttribute('tabindex');root.append(copy);y+=item.h*width/item.w+20;
  }
  root.setAttribute('viewBox',`0 0 ${width} ${y}`);root.setAttribute('width',String(width));root.setAttribute('height',String(y));root.style.fontFamily='Arial, sans-serif';
  const bg=document.createElementNS(ns,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','white');root.prepend(bg);return root;
 }
 function source(plots,title){return new XMLSerializer().serializeToString(build(plots,title));}
 async function save(plots,title,name,format='png'){
  const svg=build(plots,title),markup=new XMLSerializer().serializeToString(svg);
  if(format==='svg'){window.circuitEditor.download(markup,'image/svg+xml',name+'.svg');return;}
  const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Immagine del grafico non disponibile.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=Number(svg.getAttribute('width'))*2;canvas.height=Number(svg.getAttribute('height'))*2;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Esportazione PNG non disponibile.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('Esportazione PNG non riuscita.');window.circuitEditor.download(blob,'image/png',name+'.png');}finally{URL.revokeObjectURL(url);}
 }
 for(const [anchor,id,free]of [['exportSVG','exportPNG',false],['freeSVG','freePNG',true]]){
  const svgButton=document.getElementById(anchor),pngButton=document.createElement('button');
  pngButton.id=id;pngButton.className='text-button';pngButton.textContent='PNG';
  pngButton.setAttribute('aria-label','Scarica grafico PNG'+(free?' del circuito libero':''));
  svgButton.after(pngButton);
  async function exportPlot(format){
   const editor=window.circuitEditor;
   try{
    if(free?!editor.readFields():window.GuidedLab.snapshot()===null)throw Error('Correggi i valori prima di esportare.');
    const doc=free?editor.doc:window.GuidedLab.document();
    const analysis=free?doc.settings.analysis:doc.analysis;
    const config=free?(editor.result&&!editor.busy&&!editor.fieldError&&editor.lastPlotAnalysis===analysis?editor.plot.config:null):window.GuidedLab.plotSnapshot();
    if(analysis==='op'||!config?.data?.length)throw Error('Calcola prima un risultato attuale.');
    const title=doc.name+' · '+({time:'Transitorio',bode:'Bode',dc:'Scansione DC',vtc:'VTC',charge:'Caratteristica in carica',diodeIV:'Caratteristica del diodo'}[analysis]||'Analisi');
    const name=format==='png'?'circuit-lab-grafico':free?'circuito-libero':window.GuidedTrials.stem(doc,window.LabModel.CATALOG)+'-'+analysis;
    await save([{svg:document.getElementById(free?'freePlot':'plot'),series:config.series}],title,name,format);
   }catch(error){editor.note(error.message,true);}
  }
  svgButton.addEventListener('click',()=>exportPlot('svg'));
  pngButton.addEventListener('click',()=>exportPlot('png'));
 }
 window.PlotExport={build,source,save};
})();
