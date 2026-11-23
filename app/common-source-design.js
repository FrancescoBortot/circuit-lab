(() => {
 'use strict';
 const lab=window.GuidedLab,L=window.LabModel,Extra=L.semiconductor.extra;
 const openButton=document.getElementById('commonSourceDesign');
 const labels={RD:'Rᴅ',RS:'Rₛ',R1:'R₁',R2:'R₂'};
 const numeric=value=>Number(value.toPrecision(8)).toString().replace('.',',');
 const format=(value,unit)=>L.format(value,unit,4);
 function open(){
  if(!lab.snapshot())return;
  const initial=lab.document(),epoch=lab.projectEpoch(),p=lab.parameters();
  if(p.type!=='common-source')return;
  const saved=initial.extraStudy?.records[p.type];
  const q=L.semiconductor.amplifierValues(p);
  const defaults={id:q.id,vds:q.vds,gain:q.gm/(1/p.RD+p.mosLambda*q.id/(1+p.mosLambda*q.vds)),r1:p.R1};
  const target=saved?.target||defaults;
  const dialog=document.createElement('dialog');
  dialog.className='workbench-dialog common-source-design';
  dialog.setAttribute('aria-labelledby','sourceDesignTitle');
  const input=(name,label,unit,value)=>'<label>'+label+' ('+unit+')<input data-design="'+name+'" inputmode="decimal" type="text" maxlength="28" value="'+(Number.isFinite(value)?numeric(value):'')+'"></label>';
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="sourceDesignTitle">Dimensionamento Common Source</h2><button type="button" class="icon-button" data-design-close aria-label="Chiudi dimensionamento">×</button></div>
   <p>Inserisci il punto assegnato. Il guadagno è il modulo a metà banda con C₃ e senza carico esterno. Vɢₛ è ricavata dai parametri del MOSFET.</p>
   <h3>Obiettivi</h3><div class="comparison-fields">
    ${input('id','Corrente di drain Iᴅ','mA',target.id*1e3)}
    ${input('vds','Tensione Vᴅₛ','V',target.vds)}
    ${input('gain','Modulo del guadagno','V/V',target.gain)}
    ${input('r1','Resistenza inferiore R₁','kΩ',target.r1/1e3)}
   </div>
   <p data-design-preview class="field-hint"></p>
   <div class="student-table"><table><caption>Resistenze del circuito</caption>
    <thead><tr><th scope="col">Componente</th><th scope="col">Calcolata</th><th scope="col">Misurata (kΩ)</th></tr></thead>
    <tbody>${Extra.sourceResistors.map(key=>`<tr><th scope="row">${labels[key]}</th><td data-design-nominal="${key}">—</td><td><input type="text" inputmode="decimal" maxlength="28" data-design-measured="${key}" aria-label="${labels[key]} misurata in kiloohm" value="${saved?.measured[key]==null?'':numeric(saved.measured[key]/1e3)}"></td></tr>`).join('')}</tbody>
   </table></div>
   <p class="field-hint">Con «Applica valori misurati» i campi vuoti mantengono il valore calcolato.</p>
   <div class="flow-actions">
    <button type="button" data-design-save>Salva scheda</button>
    <button type="button" data-design-apply="nominal">Applica valori calcolati</button>
    <button type="button" data-design-apply="measured">Applica valori misurati</button>
   </div><p data-design-status role="status"></p>`;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector);
  const status=$('[data-design-status]');
  const read=(el,factor,unit)=>window.StudentTools.quantity(el.value,factor,unit);
  const same=()=>lab.projectEpoch()===epoch&&lab.document().session?.id===initial.session?.id&&lab.document().experiment===p.type;
  function calculate(){
   if(!same())throw Error('La scheda appartiene a un altro progetto.');
   const field=(key,factor,unit)=>read($('[data-design="'+key+'"]'),factor,unit);
   const target={id:field('id',1e-3,'mA'),vds:field('vds',1,'V'),gain:field('gain',1,'V/V'),r1:field('r1',1e3,'kΩ')};
   const answer=Extra.designSource(lab.parameters(),target);
   const measured=Object.fromEntries(Extra.sourceResistors.map(key=>{
    const el=$('[data-design-measured="'+key+'"]');
    const value=el.value.trim()?read(el,1e3,'kΩ'):null;
    el.setAttribute('aria-invalid',String(value!==null&&!(value>=1&&value<=1e9)));
    return [key,value];
   }));
   return {target,...answer,measured};
  }
  function preview(){
   try{
    const answer=calculate();
    $('[data-design-preview]').textContent='Vᴅᴅ '+format(answer.vdd,'V')+' · Vɢ '+format(answer.vg,'V')+' · Vᴅ '+format(answer.vd,'V')+' · Vₛ '+format(answer.vs,'V')+' · Vɢₛ '+format(answer.vgs,'V');
    for(const key of Extra.sourceResistors)$('[data-design-nominal="'+key+'"]').textContent=format(answer.nominal[key],'Ω');
    return answer;
   }catch(error){
    $('[data-design-preview]').textContent=error.message;
    for(const key of Extra.sourceResistors)$('[data-design-nominal="'+key+'"]').textContent='—';
    return null;
   }
  }
  dialog.addEventListener('input',()=>{status.textContent='Modifiche da salvare.';preview();});
  dialog.addEventListener('click',event=>{
   if(event.target.closest('[data-design-close]')){dialog.close();return;}
   const button=event.target.closest('[data-design-save],[data-design-apply]');
   if(!button)return;
   try{
    const answer=preview();
    if(!answer)throw Error('Controlla gli obiettivi prima di salvare.');
    const applied=button.dataset.designApply||null;
    const invalid=Extra.sourceResistors.find(key=>answer.measured[key]!==null&&!(answer.measured[key]>=1&&answer.measured[key]<=1e9));
    if(invalid){$('[data-design-measured="'+invalid+'"]').focus();throw Error('Inserisci una resistenza misurata valida oppure lascia vuoto il campo.');}
    if(applied==='measured'&&Object.values(answer.measured).every(v=>v===null))throw Error('Inserisci almeno una resistenza misurata.');
    const {target,nominal,measured,vdd}=answer;
    if(!lab.saveCommonSourceDesign({target,nominal,measured,vdd,applied},applied))throw Error('Controlla i parametri del circuito.');
    const q=applied?L.semiconductor.amplifierValues(lab.parameters()):null;
    status.textContent=q?'Valori applicati. Punto simulato: Iᴅ '+format(q.id,'A')+', Vᴅₛ '+format(q.vds,'V')+', Vɢₛ '+format(q.vgs,'V')+'.':'Scheda salvata nel progetto.';
   }catch(error){status.textContent=error.message;}
  });
  dialog.addEventListener('close',()=>dialog.remove());
  preview();
  dialog.showModal();
 }
 openButton.addEventListener('click',open);
})();
