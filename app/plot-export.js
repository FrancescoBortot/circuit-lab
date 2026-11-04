/* Standalone graphics capture the displayed range, units, traces and legend. */
(() => {
 'use strict';
 const ns='http://www.w3.org/2000/svg';
 function build(plots,title){
  const root=document.createElementNS(ns,'svg');root.setAttribute('xmlns',ns);
  const items=plots.map(({svg,series=[],label=''})=>{const box=svg.viewBox?.baseVal,parts=(svg.getAttribute('viewBox')||'0 0 700 240').split(/\s+/).map(Number);return{svg,series,label,w:box?.width||parts[2],h:box?.height||parts[3]};});
  const width=Math.max(640,...items.map(p=>p.w));let y=36;
  function text(value,x,top,size=13){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',top);t.setAttribute('font-size',size);t.setAttribute('fill','#23324a');t.textContent=value;root.append(t);}
  const words=title.split(/\s+/);let heading='';y=24;for(const word of words){if((heading+' '+word).length>Math.floor((width-32)/9)&&heading){text(heading,16,y,17);y+=24;heading='';}heading+=(heading?' ':'')+word;}text(heading,16,y,17);y+=20;
  for(const item of items){
   if(item.label){text(item.label,16,y+16,14);y+=26;}
   for(const s of item.series.filter(s=>s.visible!==false)){const line=document.createElementNS(ns,'path');line.setAttribute('d',`M16 ${y+10}h28`);line.setAttribute('stroke',s.color||'#23324a');line.setAttribute('stroke-width','2');if(s.dash)line.setAttribute('stroke-dasharray',s.dash);root.append(line);text((s.points?'● ':'')+s.label,54,y+14);y+=22;}
   const copy=item.svg.cloneNode(true),original=[item.svg,...item.svg.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
   original.forEach((node,i)=>{const style=getComputedStyle(node);for(const key of ['fill','stroke','stroke-width','stroke-dasharray','font-family','font-size','font-weight','opacity'])clones[i].style.setProperty(key,style.getPropertyValue(key));});
   copy.setAttribute('x','0');copy.setAttribute('y',String(y));copy.setAttribute('width',String(width));copy.setAttribute('height',String(item.h*width/item.w));copy.removeAttribute('tabindex');root.append(copy);y+=item.h*width/item.w+20;
  }
  root.setAttribute('viewBox',`0 0 ${width} ${y}`);root.setAttribute('width',String(width));root.setAttribute('height',String(y));root.style.fontFamily='Arial, sans-serif';
  const bg=document.createElementNS(ns,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','white');root.prepend(bg);return root;
 }
 async function save(plots,title,name,format='png'){
  const svg=build(plots,title),source=svg.outerHTML;
  if(format==='svg'){window.circuitEditor.download(source,'image/svg+xml',name+'.svg');return;}
  const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Immagine del grafico non disponibile.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=Number(svg.getAttribute('width'))*2;canvas.height=Number(svg.getAttribute('height'))*2;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Esportazione PNG non disponibile.');ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('Esportazione PNG non riuscita.');window.circuitEditor.download(blob,'image/png',name+'.png');}finally{URL.revokeObjectURL(url);}
 }
 for(const [anchor,id,free]of [['exportSVG','exportPNG',false],['freeSVG','freePNG',true]]){
  const button=document.createElement('button');button.id=id;button.className='text-button';button.textContent='PNG';button.setAttribute('aria-label','Scarica grafico PNG'+(free?' del circuito libero':''));document.getElementById(anchor).after(button);
  button.addEventListener('click',async()=>{try{const editor=window.circuitEditor;if(free?!editor.readFields():window.GuidedLab.snapshot()===null)throw Error('Correggi i valori prima di esportare.');const config=free?(editor.result&&!editor.busy&&!editor.fieldError&&editor.lastPlotAnalysis===editor.doc.settings.analysis?editor.plot.config:null):window.GuidedLab.plotSnapshot();if(!config?.data?.length)throw Error('Calcola prima un risultato attuale.');await save([{svg:document.getElementById(free?'freePlot':'plot'),series:config.series}],document.getElementById('projectName').value+' · '+({time:'Transitorio',bode:'Bode',dc:'Scansione DC'}[free?editor.doc.settings.analysis:window.GuidedLab.document().analysis]||'Analisi'),'circuit-lab-grafico');}catch(error){window.circuitEditor.note(error.message,true);}});
 }
 window.PlotExport={build,save};
})();
