(() => {
  'use strict';
  const M=window.LabModel,$=id=>document.getElementById(id),$$=q=>[...document.querySelectorAll(q)];
  const STORAGE='circuit-lab-v2',format=M.format,copy=M.clone;
  const store=window.LocalProjects.createStore({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},STORAGE,M.parse);
  let storageState={ok:false},calculating=false,calculationReady=false,calculationRevision=0;const tasks=new window.CircuitTasks();
  const unitSets={slew:[[1,'V/s'],[1e6,'V/µs']],current:[[1e-6,'µA'],[1e-3,'mA'],[1,'A']],res:[[1,'Ω'],[1e3,'kΩ'],[1e6,'MΩ']],cap:[[1e-12,'pF'],[1e-9,'nF'],[1e-6,'µF'],[1e-3,'mF'],[1,'F']],time:[[1e-9,'ns'],[1e-6,'µs'],[1e-3,'ms'],[1,'s']],freq:[[1,'Hz'],[1e3,'kHz'],[1e6,'MHz']],voltage:[[.001,'mVpp'],[1,'Vpp']]};
  let project={name:'Il mio laboratorio',experiment:'rc',analysis:'time',circuits:{rc:M.defaults('rc')},layouts:{}};
  let panel='components',selected=null,quantity='voltage',data=[],valid=true,debounce,timer,animation,frame;
  const units={},visible={vin:true,vin2:true,out:true,source:false,linear:true,current:true,db:true,phase:true};
  const current=()=>M.CATALOG.find(c=>c.id===project.experiment),params=()=>project.circuits[current().type];
  const get=(object,path)=>path.split('.').reduce((v,k)=>v[k],object);
  const set=(object,path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((v,k)=>v[k],object)[last]=value;};
  function toast(text,error=false){clearTimeout(timer);$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;timer=setTimeout(()=>$('toast').hidden=true,error?6500:3000);}
  function updateSaveStatus(){if(!window.circuitEditor?.active){$('saveStatus').textContent=storageState.ok?'Recupero automatico attivo':'Sessione locale · esporta una copia';$('saveStatus').dataset.state=storageState.ok?'saved':'unsaved';}}
  function persist(checkpoint=false){storageState=store.write(M.serialize(project),checkpoint);updateSaveStatus();}
  function activate(id){
    if(!applyFields())return;
    const next=M.selectExperience(project,id);if(!next)return;stopPlayback();project=next;quantity='voltage';selected=null;
    renderNavigation();renderInspector();diagram.fit();calculate();persist();
  }
  function renderNavigation(){
    $('circuitList').innerHTML='<button class="library-editor" data-open-editor><span>＋</span><strong>Editor libero<small>Costruisci da zero</small></strong></button>'+[1,2].map(day=>`<section class="library-group"><h2>${day===1?'Prima':'Seconda'} giornata</h2>${M.CATALOG.filter(c=>c.day===day).map(c=>`<button class="circuit-option" data-experiment="${c.id}" aria-pressed="${project.experiment===c.id}"><span class="circuit-thumbnail">${c.short}</span><span><strong>${c.name}</strong><small>Esperienza ${c.step} · pp. ${c.page}</small></span></button>`).join('')}</section>`).join('');
    const c=current();$('guidedRCAnalysis').hidden=c.type!=='rc';$('circuitKicker').textContent=`GIORNATA ${c.day} · ESPERIENZA ${c.step}`;$('circuitTitle').textContent=c.name;$('circuitDescription').textContent=c.description;
    $$('[data-analysis]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.analysis===project.analysis));b.disabled=c.type==='rc'&&b.dataset.analysis==='vtc';b.title=b.disabled?'VTC prevista per gli amplificatori':'';});
  }
  function field(path,label,unit='',hint='',disabled=false){
    const value=get(params(),path)??M.physical(params())[path]??(path==='sweepPoints'?41:0),options=unitSets[unit];let factor=1;
    if(options){if(units[path]&&options.some(o=>o[0]===units[path]))factor=units[path];else{factor=options[0][0];for(const[f]of options)if(Math.abs(value)>=f)factor=f;units[path]=factor;}}
    const id='param-'+path.replaceAll('.','-'),chosen=selected===path||(selected==='Rg'&&path==='rg');
    return `<div class="field ${chosen?'selected':''}" data-key="${path}"><label for="${id}">${label}</label><div class="input-unit"><input id="${id}" data-field="${path}" type="number" step="any" value="${Number((value/factor).toPrecision(12))}" inputmode="decimal" ${disabled?'disabled':''} aria-describedby="error-${id}">${options?`<select data-unit="${path}" data-previous="${factor}" aria-label="Unità: ${label}" ${disabled?'disabled':''}>${options.map(([f,l])=>`<option value="${f}" ${f===factor?'selected':''}>${l}</option>`).join('')}</select>`:`<span>${unit}</span>`}</div>${hint?`<p class="field-hint">${hint}</p>`:''}<p class="field-error" id="error-${id}"></p></div>`;
  }
  const select=(path,label,options,hint='')=>`<div class="field" data-key="${path}"><label for="select-${path}">${label}</label><select class="form-select" id="select-${path}" data-select="${path}">${options.map(([v,l])=>`<option value="${v}" ${get(params(),path)===v?'selected':''}>${l}</option>`).join('')}</select>${hint?`<p class="field-hint">${hint}</p>`:''}<p class="field-error"></p></div>`;
  function sourceFields(channel,label){
    const p=params(),w=p['wave'+channel],periodic=['sine','square','triangle'].includes(w.kind),k='wave'+channel;
    const waves=[['sine','Sinusoidale'],['square','Quadra'],['triangle','Triangolare'],['dc','Continua'],['ground','A massa']];
    if(p.type==='rc'&&channel===1)waves.unshift(['cycle','Carica e scarica'],['charge','Carica'],['discharge','Scarica']);
    return `<section class="signal-card"><h3><span class="channel-dot ${channel===2?'teal':''}"></span>${label}</h3>${select(k+'.kind','Forma del segnale',waves)}${periodic?field(k+'.vpp','Ampiezza picco-picco','voltage')+field(k+'.frequency','Frequenza','freq')+`<div class="form-grid">${field(k+'.offset','Offset','V')}${field(k+'.phase','Fase','°')}</div>`+(w.kind==='square'?field(k+'.duty','Duty cycle','%'):''):!['discharge','ground'].includes(w.kind)?field(k+'.level','Tensione della sorgente','V'):''}${p.type==='rc'?field('initial','Tensione iniziale su C','V','Condizione del condensatore a t = 0.'):''}</section>`;
  }
  const presets={rc:[['cycle','Carica → scarica'],['charge','Solo carica'],['discharge','Solo scarica'],['square','Onda quadra · 50 Hz'],['cutoff','Sinusoide al taglio'],['ideal','RC ideale · senza strumenti'],['direct','Oscilloscopio senza sonde'],['probe','Oscilloscopio con sonde 10×']],inverting:[['linear','Ingresso 1 Vpp · 1 kHz'],['saturation','Ingresso 10 Vpp · saturazione'],['vtc','Curva VTC · 0–10 Vpp'],['bode','Banda passante · 30 Hz–1 MHz']],derivative:[['triangle','Triangolare · verifica derivata'],['sine','Ingresso sinusoidale'],['bode','Bode · 30 Hz–1 MHz']],difference:[['independent','Sinusoide V₁ + quadra V₂'],['offset1','Offset +1 V su V₁'],['offsetBoth','Offset +1 V su entrambi'],['a1','Misura A₁ · V₂ a massa'],['a2','Misura A₂ · V₁ a massa'],['common','Modo comune · stesso ingresso'],['differential','Ingresso differenziale'],['mismatch','Modo comune · R₄ +1%']]};
  function renderInspector(focus){
    const helpOpen=Boolean($('inspectorContent').querySelector('[data-rc-help]')?.open),p=params();$$('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));
    $('inspectorTitle').textContent=panel==='components'?(selected&&['R','C','R1','Rf','C1','R3','R4'].includes(selected)?'Modifica '+selected:'Componenti'):panel==='signals'?'Segnali in ingresso':'Impostazioni analisi';
    $('sheetPreset').innerHTML='<option value="">Scegli una prova…</option>'+presets[p.type].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    let html='';
    if(panel==='components'){
      html='<p class="panel-description">I valori sottolineati nello schema sono modificabili. Cliccali oppure usa questi campi.</p>';
      html+=p.type==='rc'?field('R','Resistenza R','res')+field('C','Condensatore C','cap'):field('R1','Resistenza d’ingresso R₁','res')+field('Rf','Resistenza di feedback Rf','res');
      if(p.type==='derivative')html+=field('C1','Condensatore in serie C₁','cap');
      if(p.type==='difference')html+=field('R3','Resistenza d’ingresso R₃','res')+field('R4','Resistenza verso massa R₄','res')+'<button class="text-button" id="balanceResistors">Bilancia: R₃ = R₁ e R₄ = Rf <svg><use href="#i-arrow"/></svg></button>';
      if(p.type==='rc')html+=`<section class="form-section">${select('instrument','Generatore e oscilloscopio',[['ideal','Circuito ideale'],['generator','Solo generatore'],['direct','Oscilloscopio · senza sonde'],['probe','Oscilloscopio · sonde 10×'],['custom','Valori personalizzati']])}${p.instrument==='ideal'?'<p class="field-hint">Scegli una configurazione per aggiungere le impedenze degli strumenti allo schema.</p>':`<details class="details-settings" ${['Rg','CH1','CH2'].includes(selected)?'open':''}><summary>Modifica le impedenze degli strumenti</summary>${field('rg','R del generatore','res')}${p.instrument==='generator'?'':field('scopeR','R d’ingresso di ogni canale','res')+field('scopeC','C d’ingresso di ogni canale','cap','Cavi e sonde inclusi: i valori iniziali sono esempi modificabili.')}</details>`}</section>`;
      else html+=`<section class="form-section">${select('opamp','Operazionale',[['limited','Banda e saturazione'],['physical','Fisico semplificato'],['ideal','Ideale']])}<details class="details-settings" ${selected==='U1'?'open':''}><summary>Alimentazione, guadagno e banda</summary>${p.opamp==='physical'?field('positive','Alimentazione V+','V')+field('negative','Alimentazione V−','V')+field('slew','Slew rate interno','slew')+field('rout','Resistenza di uscita','res')+field('ilimit','Corrente massima erogata/assorbita','current'):field('rail','Alimentazione simmetrica ±','V')}${field('headroom','Margine rispetto alle alimentazioni','V')}${field('a0','Guadagno ad anello aperto A₀','V/V')}${field('gbw','Prodotto guadagno-banda','freq','Modello generico a polo dominante. I limiti aggiuntivi si attivano con Fisico semplificato; i valori sono esempi regolabili.')}</details></section>`;
    }else if(panel==='signals'){
      if(p.type==='difference')html+=select('drive','Come sono pilotati gli ingressi',[['independent','Due segnali indipendenti'],['v1','V₁ attivo · V₂ a massa'],['v2','V₂ attivo · V₁ a massa'],['common','Modo comune · V₁ = V₂'],['differential','Differenziale · V₂ = −V₁']]);
      const label=p.type==='difference'?(p.drive==='v2'?'Ingresso V₂':p.drive==='common'?'Segnale comune V₁ = V₂':p.drive==='differential'?'Differenza V₂ − V₁':'Ingresso V₁'):'Ingresso V₁';
      html+=sourceFields(1,label);if(p.type==='difference'&&p.drive==='independent')html+=sourceFields(2,'Ingresso V₂');
      if(p.type!=='rc')html+='<p class="field-hint">Ampiezze impostate nel punto V₁/V₂ della scheda, non a vuoto sul generatore.</p>';
    }else{
      html=`<p class="panel-description">Le impostazioni si applicano automaticamente al grafico selezionato.</p>`;
      if(project.analysis==='time')html+=`<label class="field-checkbox" for="autoTime">Intervallo automatico<input id="autoTime" data-check="autoTime" type="checkbox" ${p.autoTime?'checked':''}></label>${field('duration','Durata totale','time','',p.autoTime)}${p.type==='rc'&&p.wave1.kind==='cycle'?field('switchTime','Inizio della scarica','time','',p.autoTime):''}${field('samples','Punti minimi','punti','Fronti e vertici vengono aggiunti automaticamente.')}<p class="field-hint">La risoluzione aumenta quando serve a rappresentare entrambi i segnali.</p>`;
      if(project.analysis==='bode')html+=field('fmin','Frequenza minima','freq')+field('fmax','Frequenza massima','freq')+'<p class="field-hint">601 punti logaritmici. Risposta lineare a piccolo segnale: la saturazione non viene applicata.</p>';
      if(project.analysis==='vtc')html+=field('sweepPoints','Punti della VTC','punti')+field('sweepMax','Massima ampiezza in ingresso','voltage')+field('wave1.frequency','Frequenza della sinusoide','freq')+field('wave1.offset','Offset del segnale','V')+'<p class="field-hint">Vpp,OUT misurata sull’ultimo periodo della sinusoide. Il regime è verificato confrontando due periodi; la linea tratteggiata è la previsione lineare. Calcolo locale annullabile.</p>';
      if(p.type==='difference'&&project.analysis!=='time')html+=`<section class="form-section">${select('bodeInput','Ingresso dell’analisi',[['differential','Differenziale V₂ − V₁'],['v1','V₁ · V₂ a massa'],['v2','V₂ · V₁ a massa'],['common','Modo comune V₁ = V₂']])}</section>`;
    }
    if(p.type!=='rc')html='<button class="rc-launch rc-launch-panel" data-open-opamp>Misure operazionali · VTC, banda e CMRR</button>'+html;
    if(p.type==='rc')html='<button class="rc-launch rc-launch-panel" data-open-rc>Misura τ · tempo e frequenza</button>'+html;
    if(p.type==='rc'&&panel==='components')html+='<details class="details-settings component-help" data-rc-help'+(helpOpen?' open':'')+'><summary>Come R e C cambiano la risposta</summary><p>R limita la corrente; C accumula carica. Nel circuito RC ideale, τ = R·C = <strong>'+format(p.R*p.C,'s',4)+'</strong>. Raddoppiare R oppure C raddoppia il tempo caratteristico.</p><p>Dopo una τ resta il 36,8% della differenza dal valore finale. Generatore, sonde e oscilloscopio possono modificare la risposta: nel pannello Misura τ trovi i riferimenti distinti.</p></details>';
    $('inspectorContent').innerHTML=html;
    if(focus){const input=$('inspectorContent').querySelector(`[data-field="${focus}"], [data-select="${focus}"]`);if(input){input.focus({preventScroll:true});input.select?.();input.closest('.field').scrollIntoView({block:'nearest'});}}
  }
  function setInspector(open){$('appLayout').classList.toggle('inspector-closed',!open);$('editButton').setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>plot.draw());}
  function selectComponent(id){
    if(!applyFields())return;
    selected=id;panel=id==='V1'||id==='V2'?'signals':'components';setInspector(true);
    const source=id==='V1'||id==='V2',wave=source&&id==='V2'&&params().drive==='independent'?'wave2':'wave1';
    const kind=source?params()[wave].kind:null;
    const inactive=params().type==='difference'&&((id==='V1'&&params().drive==='v2')||(id==='V2'&&params().drive==='v1'));
    renderInspector(['R','C','R1','Rf','R3','R4','C1'].includes(id)?id:id==='U1'?'rail':id==='Rg'?'rg':id==='CH1'||id==='CH2'?'scopeR':inactive?'drive':source?(kind==='discharge'?'initial':kind==='ground'?wave+'.kind':wave+(['dc','charge','cycle'].includes(kind)?'.level':'.vpp')):undefined);
    diagram.render(params(),project.layouts[params().type]||{},selected);
    $('rotateComponent').disabled=!['R','C','R1','Rf','R3','R4','C1','Rg'].includes(id);
  }
  function showErrors(errors){
    valid=!Object.keys(errors).length;$('saveProject').disabled=!valid;$('exportCSV').disabled=!valid||calculating||!calculationReady;$('exportSVG').disabled=!valid||calculating||!calculationReady;$('guidedCancel').disabled=!valid;
    $$('#inspectorContent .field').forEach(el=>{const text=errors[el.dataset.key]||'';el.classList.toggle('invalid',Boolean(text));el.querySelector('.field-error').textContent=text;el.querySelector('input')?.setAttribute('aria-invalid',String(Boolean(text)));});
    if(!valid){tasks.cancel();calculationRevision++;calculating=false;calculationReady=false;$('guidedCancel').textContent='Ricalcola';stopPlayback();$('resultNotice').textContent=Object.values(errors)[0]+' Il grafico conserva l’ultimo circuito valido.';$('resultNotice').hidden=false;$('calculationStatus').textContent='Correggi i valori';}
  }
  function applyFields(rebuild=false,changed=null){
    clearTimeout(debounce);let candidate=copy(params());
    $$('#inspectorContent [data-field]').forEach(input=>{const unit=input.parentElement.querySelector('[data-unit]');set(candidate,input.dataset.field,input.value.trim()===''?NaN:Number(input.value)*(unit?Number(unit.value):1));});
    $$('#inspectorContent [data-select]').forEach(s=>set(candidate,s.dataset.select,s.value));
    $$('#inspectorContent [data-check]').forEach(c=>set(candidate,c.dataset.check,c.checked));
    if(changed==='instrument'){
      if(candidate.instrument==='direct'){candidate.rg=50;candidate.scopeR=1e6;candidate.scopeC=120e-12;}
      if(candidate.instrument==='probe'){candidate.rg=50;candidate.scopeR=10e6;candidate.scopeC=12e-12;}
    }
    if(changed==='wave1.kind'&&candidate.type==='rc'){
      if(candidate.wave1.kind==='discharge'&&candidate.initial===0)candidate.initial=candidate.wave1.level;
      if(['charge','cycle'].includes(candidate.wave1.kind)&&params().wave1.kind==='discharge')candidate.initial=0;
    }
    if(Number.isFinite(candidate.R)&&candidate.R>0&&Number.isFinite(candidate.C)&&candidate.C>0)candidate=M.normalizeTime(candidate);
    showErrors(M.validate(candidate));if(!valid)return false;
    const changedParameters=JSON.stringify(params())!==JSON.stringify(candidate);project.circuits[current().type]=candidate;
    if(changedParameters||!calculationReady&&!calculating)calculate();if(rebuild)renderInspector();else syncAutomaticFields();persist();return true;
  }
  function syncAutomaticFields(){for(const path of ['duration','switchTime']){const input=$('inspectorContent').querySelector(`[data-field="${path}"]`);if(input&&input.disabled){const factor=Number(input.parentElement.querySelector('[data-unit]').value);input.value=Number((get(params(),path)/factor).toPrecision(12));}}}
  function measurements(){const p=params();let rows=M.summary(p);if(project.analysis==='time'&&data.length){const pp=key=>{let min=Infinity,max=-Infinity;for(const d of data){min=Math.min(min,d[key]);max=Math.max(max,d[key]);}return max-min;};rows.push({label:'V₁ picco-picco',value:format(pp('vin'),'V')});if(p.type==='difference')rows.push({label:'V₂ picco-picco',value:format(pp('vin2'),'V')});rows.push({label:'OUT picco-picco',value:format(pp('out'),'V')});}
    $('summary').innerHTML=rows.map(r=>`<div class="summary-item"><span>${r.label}</span><strong>${r.value}</strong></div>`).join('');
  }
  const colors={vin:'#8b9bb2',vin2:'#159e89',out:'#4264ef',source:'#b88bce',linear:'#b0bbc9',current:'#4264ef',db:'#4264ef',phase:'#4264ef'};
  function series(){const p=params();let s;
    if(project.analysis==='bode')s=[{key:quantity==='phase'?'phase':'db',label:quantity==='phase'?'Fase':'Guadagno'}];
    else if(project.analysis==='vtc')s=[{key:'out',label:'Vpp uscita'},{key:'linear',label:'Senza saturazione',dash:'5 5'}];
    else if(quantity==='current'&&p.type==='rc')s=[{key:'current',label:'Corrente in R'}];
    else{s=[{key:'vin',label:'V₁',dash:'5 4'}];if(p.type==='difference')s.push({key:'vin2',label:'V₂',dash:'4 4'});s.push({key:'out',label:'Uscita'});if(p.type==='rc'&&p.instrument!=='ideal')s.push({key:'source',label:'Generatore Vɢ',dash:'2 4'});}
    return s.map(d=>({...d,color:colors[d.key],visible:visible[d.key]!==false}));
  }
  function renderLegend(){const s=series();$('plotLegend').innerHTML=s.map(d=>`<button class="legend-button" data-trace="${d.key}" aria-pressed="${d.visible}"><i class="legend-line" style="${d.dash?'border-top:2px dashed '+d.color+';height:0':'background:'+d.color}"></i>${d.label}</button>`).join('');}
  function quantityControls(){const p=params(),select=$('plotQuantity');if(project.analysis==='bode')select.innerHTML='<option value="db">Modulo (dB)</option><option value="phase">Fase (°)</option>';else select.innerHTML='<option value="voltage">Tensioni</option><option value="current">Corrente in R</option>';
    if(project.analysis==='bode'&&!['db','phase'].includes(quantity))quantity='db';if(project.analysis==='time'&&!['voltage','current'].includes(quantity))quantity='voltage';
    select.value=quantity;select.hidden=project.analysis==='vtc'||(project.analysis==='time'&&p.type!=='rc');
  }
  async function calculate(){
    const p=copy(params()),revision=++calculationRevision,analysis=project.analysis;stopPlayback();calculating=true;calculationReady=false;$('guidedCancel').hidden=false;$('guidedCancel').textContent='Annulla calcolo';showErrors({});$('calculationStatus').textContent='Calcolo locale in corso…';data=[];plot.data=[];plot.series=[];$('plot').replaceChildren();$('plotLegend').replaceChildren();$('readout').replaceChildren();$('resultNotice').hidden=true;$('timeline').hidden=true;quantityControls();diagram.render(p,project.layouts[p.type]||{},selected);measurements();try{
      const result=await tasks.run(analysis==='time'?'guidedTime':analysis==='bode'?'guidedBode':'guidedVtc',{params:p},fraction=>{if(revision===calculationRevision)$('calculationStatus').textContent='Calcolo locale · '+Math.round(fraction*100)+'%';});if(revision!==calculationRevision)return;data=result;calculating=false;calculationReady=true;
      quantityControls();renderLegend();
      plot.set({data,series:series(),logX:project.analysis==='bode',xUnit:project.analysis==='bode'?'Hz':project.analysis==='vtc'?'Vpp':'s',xLabel:project.analysis==='vtc'?'Ingresso':'Tempo',yUnit:project.analysis==='bode'?(quantity==='phase'?'°':'dB'):project.analysis==='vtc'?'Vpp':quantity==='current'?'A':'V',noZero:project.analysis==='bode',guides:project.analysis==='time'&&p.type==='rc'?[{x:M.rcSummary(p).tau,label:'τ'},...(p.wave1.kind==='cycle'?[{x:p.switchTime,label:'scarica'}]:[])]:[]});
      diagram.render(p,project.layouts[p.type]||{},selected);measurements();
      $('timeline').hidden=project.analysis!=='time';$('timelineDuration').textContent=format(p.duration,'s');
      $('calculationStatus').textContent=project.analysis==='bode'?'Piccolo segnale':project.analysis==='vtc'?'Vpp a regime · '+data.length+' ampiezze':(p.type==='rc'?'Rete RC':'Operazionale '+(p.opamp==='ideal'?'ideale':'a polo dominante'))+' · '+data.length.toLocaleString('it-IT')+' punti';
      const clipped=project.analysis!=='bode'&&data.some(d=>d.clipped);
      const zeroCommon=p.type==='difference'&&project.analysis!=='time'&&p.bodeInput==='common'&&!Number.isFinite(M.coefficients(p).cmrr);
      $('resultNotice').hidden=!clipped&&!zeroCommon;
      $('resultNotice').textContent=clipped?(p.opamp==='physical'?'Uno o più limiti fisici sono attivi (alimentazione, slew rate o corrente). I valori si modificano nell’operazionale.':'Saturazione nella retroazione: escursione ±'+format(p.rail-p.headroom,'V')+'.'):zeroCommon?'Rapporti resistivi bilanciati: il modo comune si annulla nel modello. Introduci una differenza tra R₄/R₃ e Rf/R₁ per misurare un CMRR finito.':'';
      $('rotateComponent').disabled=!['R','C','R1','Rf','R3','R4','C1','Rg'].includes(selected);
      showErrors({});
    }catch(error){if(revision!==calculationRevision)return;calculating=false;$('exportCSV').disabled=true;$('exportSVG').disabled=true;$('calculationStatus').textContent=error.name==='AbortError'?'Calcolo annullato':'Calcolo non disponibile';if(error.name!=='AbortError')toast('Calcolo non disponibile: '+error.message,true);}
    finally{if(revision===calculationRevision)$('guidedCancel').textContent='Ricalcola';}
  }
  function cursor(d,fraction,cursors){
    $('timeCursor').value=Math.round(fraction*10000);const p=params();let rows;
    if(project.analysis==='time'){rows=[['Tempo',format(d.x,'s',4)],['V₁',format(d.vin,'V',4)]];if(p.type==='difference')rows.push(['V₂',format(d.vin2,'V',4)]);rows.push(['OUT',format(d.out,'V',4),'primary-value']);if(quantity==='current'&&p.type==='rc')rows.push(['Corrente',format(d.current,'A',4),'primary-value']);}
    else if(project.analysis==='bode')rows=[['Frequenza',format(d.x,'Hz',4)],['Guadagno',d.magnitude===0?'0 V/V':format(d.magnitude,'',4)+' V/V','primary-value'],['Modulo',d.magnitude===0?'−∞ dB':format(d.db,'dB',4)],['Fase',format(d.phase,'°',4)]];
    else rows=[['Ingresso',format(d.x,'V',4)+'pp'],['Uscita',format(d.out,'V',4)+'pp','primary-value'],['Risposta lineare',format(d.linear,'V',4)+'pp']];
    if(cursors){const {a,b}=cursors,u=project.analysis==='time'?'s':project.analysis==='bode'?'Hz':'Vpp';rows=[['A',format(a.x,u,4)],['B',format(b.x,u,4)],['Δ'+(project.analysis==='time'?'t':project.analysis==='bode'?'f':'IN'),format(b.x-a.x,u,4)],...plot.series.flatMap(t=>{const unit=project.analysis==='bode'?(quantity==='phase'?'°':'dB'):quantity==='current'?'A':'V';return[[t.label+' A / B',format(a[t.key],unit,4)+' / '+format(b[t.key],unit,4)],['Δ '+t.label,format(b[t.key]-a[t.key],unit,4)]];})];}
    $('readout').innerHTML=rows.map(([label,value,cls=''])=>`<div class="${cls}"><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('timeCursor').setAttribute('aria-valuetext',project.analysis==='time'?format(d.x,'s',4):format(d.x,''));
  }
  function applyPreset(key){
    if(!key)return;let p=copy(params());const w=p.wave1;
    if(p.type==='rc'){
      if(['cycle','charge','discharge'].includes(key)){w.kind=key;p.initial=key==='discharge'?w.level:0;}
      if(['square','ideal','direct','probe'].includes(key)){Object.assign(w,{kind:'square',frequency:50,vpp:4,offset:2,phase:0});p.initial=0;}
      if(['ideal','direct','probe'].includes(key)){p.instrument=key;if(key==='direct'){p.scopeR=1e6;p.scopeC=120e-12;}if(key==='probe'){p.scopeR=10e6;p.scopeC=12e-12;}p.rg=50;}
      if(key==='cutoff')Object.assign(w,{kind:'sine',frequency:M.rcSummary(p).cutoff,vpp:2,offset:0});
      project.analysis='time';
    }else if(p.type==='inverting'){
      Object.assign(w,{kind:'sine',frequency:1000,offset:0,vpp:key==='saturation'?10:key==='vtc'?.2:1});
      project.analysis=key==='vtc'?'vtc':key==='bode'?'bode':'time';p.fmin=30;p.fmax=1e6;
    }else if(p.type==='derivative'){
      const fc=1/(2*Math.PI*p.R1*p.C1);Object.assign(w,{kind:key==='triangle'?'triangle':'sine',vpp:1,frequency:key==='triangle'?Math.min(500,fc/25):1000,offset:0});project.analysis=key==='bode'?'bode':'time';p.fmin=30;p.fmax=1e6;
    }else{
      Object.assign(w,{kind:'sine',vpp:1,frequency:1000,offset:0,phase:0});Object.assign(p.wave2,{kind:'square',vpp:2,frequency:100,offset:0,phase:0});p.drive='independent';
      if(key==='offset1')w.offset=1;if(key==='offsetBoth'){w.offset=1;p.wave2.offset=1;}
      if(key==='a1'){p.drive='v1';p.bodeInput='v1';}if(key==='a2'){p.drive='v2';p.bodeInput='v2';}
      if(key==='common'||key==='mismatch'){p.drive='common';p.bodeInput='common';if(key==='mismatch')p.R4=p.Rf*1.01;}
      if(key==='differential'){p.drive='differential';p.bodeInput='differential';}project.analysis='time';
    }
    p.autoTime=true;project.circuits[p.type]=M.normalizeTime(p);quantity='voltage';renderNavigation();renderInspector();calculate();persist();
  }
  function stopPlayback(){if(frame)cancelAnimationFrame(frame);frame=null;animation=null;$('playButton').setAttribute('aria-pressed','false');$('playButton').setAttribute('aria-label','Anima la lettura del transitorio');$('playButton').innerHTML='<svg><use href="#i-play"/></svg>';}
  function play(){if(animation){stopPlayback();return;}if(!valid||project.analysis!=='time')return;plot.fit();const start=plot.cursor?.x/params().duration||0;animation={time:performance.now(),fraction:start>.99?0:start};$('playButton').setAttribute('aria-pressed','true');$('playButton').setAttribute('aria-label','Metti in pausa la lettura');$('playButton').innerHTML='<svg><use href="#i-pause"/></svg>';
    const tick=now=>{if(!animation)return;const f=animation.fraction+(now-animation.time)/8000;plot.setFraction(Math.min(f,1));if(f>=1)stopPlayback();else frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  }
  const diagram=new window.LabDiagram($('schematic'),{select:selectComponent,move:(id,value)=>{const type=params().type;(project.layouts[type]??={})[id]=value;persist();},zoom:value=>$('diagramZoom').textContent=value+'%'});
  const plot=new window.LabPlot($('plot'),cursor);
  $('circuitList').addEventListener('click',e=>{if(e.target.closest('[data-open-editor]')){window.circuitEditor?.open();return;}const b=e.target.closest('[data-experiment]');if(b)activate(b.dataset.experiment);});
  $$('[data-panel]').forEach(b=>b.addEventListener('click',()=>{if(!applyFields())return;panel=b.dataset.panel;renderInspector();}));
  $$('[data-analysis]').forEach(b=>b.addEventListener('click',()=>{if(!applyFields())return;project.analysis=b.dataset.analysis;panel='analysis';quantity=project.analysis==='bode'?'db':'voltage';renderNavigation();renderInspector();calculate();persist();}));
  $('editButton').addEventListener('click',()=>{setInspector(true);panel='components';renderInspector();const input=$('inspectorContent').querySelector('input');if(input){input.focus({preventScroll:true});input.select();}});
  $('closeInspector').addEventListener('click',()=>setInspector(false));
  $('inspectorContent').addEventListener('input',e=>{if(e.target.matches('[data-field]')){clearTimeout(debounce);debounce=setTimeout(()=>applyFields(),140);}});
  $('inspectorContent').addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('[data-unit]')){const physical=Number(el.parentElement.querySelector('input').value)*Number(el.dataset.previous),factor=Number(el.value);units[el.dataset.unit]=factor;el.dataset.previous=String(factor);el.parentElement.querySelector('input').value=Number((physical/factor).toPrecision(12));applyFields();}
    else if(el.matches('[data-select]'))applyFields(true,el.dataset.select);
    else if(el.matches('[data-check]'))applyFields(true);
    else if(el.matches('[data-field]'))applyFields();
  });
  $('inspectorContent').addEventListener('click',e=>{if(e.target.closest('#balanceResistors')){const p=params();p.R3=p.R1;p.R4=p.Rf;renderInspector();calculate();persist();}});
  $('sheetPreset').addEventListener('change',()=>applyPreset($('sheetPreset').value));
  $('resetCircuit').addEventListener('click',()=>{project.circuits[current().type]=M.defaults(current().type);delete project.layouts[current().type];selected=null;for(const key of Object.keys(units))delete units[key];renderInspector();diagram.fit();calculate();persist(true);toast('Valori della scheda ripristinati.');});
  $('rotateComponent').addEventListener('click',()=>diagram.rotate());$('diagramIn').addEventListener('click',()=>diagram.zoom(1.2));$('diagramOut').addEventListener('click',()=>diagram.zoom(1/1.2));$('diagramFit').addEventListener('click',()=>diagram.fit());
  $('resetLayout').addEventListener('click',()=>{delete project.layouts[params().type];diagram.fit();diagram.render(params(),{},selected);persist();});
  $('toggleSchematic').addEventListener('click',()=>{const collapsed=$('appLayout').classList.toggle('schematic-collapsed');$('toggleSchematic').textContent=collapsed?'Espandi schema':'Riduci schema';});
  $('plotIn').addEventListener('click',()=>plot.zoom(1.6));$('plotOut').addEventListener('click',()=>plot.zoom(1/1.6));$('plotFit').addEventListener('click',()=>plot.fit());
  $('plotQuantity').addEventListener('change',()=>{quantity=$('plotQuantity').value;calculate();});
  $('plotLegend').addEventListener('click',e=>{const b=e.target.closest('[data-trace]');if(!b)return;const key=b.dataset.trace,s=series();if(visible[key]&&s.filter(d=>d.visible).length===1){toast('Mantieni visibile almeno una traccia.');return;}visible[key]=!visible[key];renderLegend();plot.updateSeries(series());});
  $('timeCursor').addEventListener('input',()=>{stopPlayback();plot.setFraction(Number($('timeCursor').value)/10000);});$('playButton').addEventListener('click',play);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
  let resizeStart;
  function resizeSchematic(height){
    const workbench=$('schematicStage').closest('.workbench'),available=workbench.getBoundingClientRect().height;
    const maximum=window.matchMedia('(max-width:760px)').matches?440:Math.max(120,available-430);
    document.documentElement.style.setProperty('--diagram-height',Math.max(120,Math.min(maximum,height))+'px');
  }
  $('paneDivider').addEventListener('pointerdown',e=>{resizeStart={y:e.clientY,height:$('schematicStage').getBoundingClientRect().height};$('paneDivider').setPointerCapture(e.pointerId);});
  $('paneDivider').addEventListener('pointermove',e=>{if(resizeStart)resizeSchematic(resizeStart.height+e.clientY-resizeStart.y);});
  for(const type of ['pointerup','pointercancel'])$('paneDivider').addEventListener(type,()=>resizeStart=null);
  $('paneDivider').addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resizeSchematic($('schematicStage').getBoundingClientRect().height+(e.key==='ArrowUp'?-20:20));}});
  function download(content,mime,name){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  $('saveProject').addEventListener('click',()=>window.ProjectPanel.show());
  $('openProject').addEventListener('click',()=>$('projectFile').click());
  $('projectFile').addEventListener('change',async()=>{const file=$('projectFile').files[0];if(!file)return;try{if(file.size>window.LocalProjects.MAX_BYTES)throw new Error('Il progetto supera il limite di 1 MB.');window.ProjectPanel.importText(await file.text());}catch(error){toast(error.message,true);}finally{$('projectFile').value='';}});
  $('guidedCancel').addEventListener('click',()=>calculating?tasks.cancel():calculate());
  $('exportCSV').addEventListener('click',()=>{if(!applyFields()||calculating)return;download(M.csv(params(),project.analysis,data),'text/csv;charset=utf-8',current().type+'-'+project.analysis+'.csv');toast('Download CSV richiesto al browser · unità SI.');});
  $('exportSVG').addEventListener('click',()=>{const svg=$('plot').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font-family:Arial,sans-serif;font-size:10px;fill:#7185a1}.axis-unit,.guide-text{font-size:9px}';svg.prepend(style);download(svg.outerHTML,'image/svg+xml',current().type+'-'+project.analysis+'.svg');toast('Download SVG richiesto al browser.');});
  $('projectName').addEventListener('change',()=>{if(window.circuitEditor?.active)return;project.name=$('projectName').value.trim()||'Il mio laboratorio';persist();});
  $('helpButton').addEventListener('click',()=>window.circuitEditor?.active?window.circuitEditor.showHelp():$('helpDialog').showModal());for(const id of ['closeHelp','helpDone'])$(id).addEventListener('click',()=>$('helpDialog').close());
  function loadProject(text){const next=M.parse(text);if(window.circuitEditor?.active)window.circuitEditor.back();project=next;selected=null;panel='components';$('projectName').value=project.name;renderNavigation();renderInspector();diagram.fit();calculate();persist(true);toast('Progetto guidato aperto sul dispositivo.');}
  window.GuidedLab={updateStudies:update=>{const checked=M.parse(M.serialize({...project,...update}));for(const k of Object.keys(update))project[k]=copy(checked[k]);persist();},setOpampStudy:s=>{project.opampStudy=copy(s);persist();},exportCircuit:()=>{if(!applyFields())return null;return M.circuit(project);},parameters:()=>copy(params()),getACStudy:()=>project.acStudy,setACStudy:s=>{project.acStudy=copy(s);persist();},getRCStudy:()=>project.rcStudy,setRCStudy:s=>{project.rcStudy=copy(s);persist();},storageState:()=>storageState,hasPrevious:()=>Boolean(store.previous()),snapshot:()=>{if(!applyFields())return null;project.name=$('projectName').value.trim()||'Il mio laboratorio';persist();return M.serialize(project);},load:loadProject,recoverPrevious:()=>{const old=store.previous();if(!old)return false;loadProject(M.serialize(old));return true;},suspend:()=>{stopPlayback();const ok=applyFields();if(ok){tasks.cancel();calculationRevision++;calculating=false;$('guidedCancel').hidden=true;}return ok;},resume:()=>{$('appLayout').hidden=false;$('projectName').value=project.name;$('saveProject').disabled=!valid;updateSaveStatus();if(!calculationReady)calculate();else requestAnimationFrame(()=>plot.draw());}};
  const loaded=store.read();if(loaded.doc){project=loaded.doc;storageState.ok=true;}else if(!loaded.error)try{const old=localStorage.getItem('rc-studio-project-v1');if(old)project=M.parse(old);}catch{}
  if(loaded.recovered||loaded.error)setTimeout(()=>toast(loaded.recovered?'Recuperata la copia precedente del laboratorio: la più recente non era leggibile.':loaded.error,true),200);
  $('projectName').value=project.name;renderNavigation();renderInspector();calculate();updateSaveStatus();
  if(window.matchMedia('(max-width:760px)').matches)setInspector(false);
})();
