(() => {
  'use strict';
  const M=window.LabModel,$=id=>document.getElementById(id),$$=q=>[...document.querySelectorAll(q)];
  const STORAGE='circuit-lab-v2',format=M.format,copy=M.clone,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=window.LocalProjects.createStore({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},STORAGE,M.parse);
  let storageState={ok:false},calculating=false,calculationReady=false,calculationRevision=0;const tasks=new window.CircuitTasks();
  const unitSets={slew:[[1,'V/s'],[1e6,'V/µs']],current:[[1e-6,'µA'],[1e-3,'mA'],[1,'A']],res:[[1,'Ω'],[1e3,'kΩ'],[1e6,'MΩ']],cap:[[1e-12,'pF'],[1e-9,'nF'],[1e-6,'µF'],[1e-3,'mF'],[1,'F']],time:[[1e-9,'ns'],[1e-6,'µs'],[1e-3,'ms'],[1,'s']],freq:[[1,'Hz'],[1e3,'kHz'],[1e6,'MHz']],voltage:[[.001,'mVpp'],[1,'Vpp']]};
  let project={name:'Il mio laboratorio',experiment:'rc',analysis:'time',circuits:{rc:M.defaults('rc')},layouts:{}};
  let derivedMetrics=[];let panel='components',selected=null,quantity='voltage',data=[],valid=true,debounce,timer;
  const units={},visible={vin:true,vin2:true,out:true,source:false,linear:true,current:true,db:true,phase:true};
  const networkDiagram=p=>M.real(p)||M.isRadiation(p), chargeAnalysis=p=>M.isRadiation(p)&&M.radiation.hasPre(p);
  const current=()=>M.CATALOG.find(c=>c.id===project.experiment),params=()=>project.circuits[current().type];
  const get=(object,path)=>path.split('.').reduce((v,k)=>v[k],object);
  const set=(object,path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((v,k)=>v[k],object)[last]=value;};
  function toast(text,error=false){clearTimeout(timer);$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;timer=setTimeout(()=>$('toast').hidden=true,error?6500:3000);}
  function updateSaveStatus(){if(!window.circuitEditor?.active){$('saveStatus').textContent=storageState.ok?'Recupero automatico attivo':'Sessione locale · esporta una copia';$('saveStatus').dataset.state=storageState.ok?'saved':'unsaved';}}
  function ensureSession(){if(!project.session)project.session={id:crypto.randomUUID?crypto.randomUUID():'session-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),createdAt:new Date().toISOString()};}
  function trialLabel(){const t=window.GuidedTrials.current(project,M.CATALOG);$('guidedTrialBadge').hidden=!t.label;$('guidedTrialName').textContent=t.label;$('guidedTrialChanged').hidden=!t.modified;$('sheetPreset').value=t.preset;}
  function sessionState(withResult=false){
    if(window.circuitEditor?.active)return;const detail={text:M.serialize(project)};
    if(withResult&&calculationReady){const svg=$('plot').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font:10px Arial;fill:#65768c}';svg.prepend(style);detail.result={analysis:project.analysis,quantity,csv:M.csv(params(),project.analysis,data),svg:svg.outerHTML,count:data.length,points:params().type==='rc'&&project.analysis==='time'?data.map(p=>({x:p.x,y:p.out})):null};}
    return detail;
  }
  function emitState(withResult=false){const detail=sessionState(withResult);if(detail)document.dispatchEvent(new CustomEvent('guided-lab-state',{detail}));}
  function persist(checkpoint=false){ensureSession();storageState=store.write(M.serialize(project),checkpoint);trialLabel();updateSaveStatus();emitState();}
  function activate(id){
    if(!applyFields())return;
    const next=M.selectExperience(project,id);if(!next)return;stopPlayback();project=next;quantity='voltage';selected=null;
    renderNavigation();renderInspector();fitDiagram();calculate();persist();
  }
  function renderNavigation(){
    $('circuitList').innerHTML='<button class="library-editor" data-open-editor><span>＋</span><strong>Editor libero<small>Costruisci da zero</small></strong></button>'+[1,2,3,4].map(day=>`<section class="library-group"><h2>${['','Prima','Seconda','Terza','Quarta'][day]} giornata</h2>${M.CATALOG.filter(c=>c.day===day).map(c=>`<button class="circuit-option" data-experiment="${c.id}" aria-pressed="${project.experiment===c.id}"><span class="circuit-thumbnail">${c.short}</span><span><strong>${c.name}</strong><small>Esperienza ${c.step}</small></span></button>`).join('')}</section>`).join('');
    const c=current();$('guidedRCAnalysis').hidden=c.type!=='rc';$('circuitKicker').textContent=`GIORNATA ${c.day} · ESPERIENZA ${c.step}`;$('circuitTitle').textContent=c.name;$('circuitDescription').textContent=c.description;
    $$('[data-analysis]').forEach(b=>{if(['vtc','charge'].includes(b.dataset.analysis)){b.dataset.analysis=chargeAnalysis(params())?'charge':'vtc';b.textContent=chargeAnalysis(params())?'Linearità · Q':'VTC';}b.setAttribute('aria-pressed',String(b.dataset.analysis===project.analysis));b.disabled=(c.type==='rc'||M.isRadiation(c.type)&&!M.radiation.hasFinal(params())&&!chargeAnalysis(params()))&&b.dataset.analysis==='vtc';b.title=b.disabled?'VTC prevista per gli amplificatori':({time:'Segnali nel tempo: carica, scarica e forma d’onda.',bode:'Risposta in frequenza: guadagno e fase.',vtc:'Ampiezza di uscita al variare dell’ampiezza in ingresso.',charge:'Picco d’uscita rispetto alla carica iniettata.'})[b.dataset.analysis];});
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
    const waves=[...(M.isRadiation(p)?[['pulse','Impulso rettangolare']]:[]),['sine','Sinusoidale'],['square','Quadra'],['triangle','Triangolare'],['dc','Continua'],['ground','A massa']];
    if(p.type==='rc'&&channel===1)waves.unshift(['cycle','Carica e scarica'],['charge','Carica'],['discharge','Scarica']);
    return `<section class="signal-card"><h3><span class="channel-dot ${channel===2?'teal':''}"></span>${label}</h3>${select(k+'.kind','Forma del segnale',waves)}${w.kind==='pulse'?field(k+'.level','Livello durante l’impulso','V')+field(k+'.low','Livello di riposo','V')+field(k+'.width','Durata dell’impulso T','time')+field(k+'.delay','Ritardo iniziale','time')+field(k+'.period','Periodo di ripetizione','time')+field(k+'.rise','Tempo del fronte iniziale','time')+field(k+'.fall','Tempo del fronte finale','time'):periodic?field(k+'.vpp','Ampiezza picco-picco','voltage')+field(k+'.frequency','Frequenza','freq')+`<div class="form-grid">${field(k+'.offset','Offset','V')}${field(k+'.phase','Fase','°')}</div>`+(w.kind==='square'?field(k+'.duty','Duty cycle','%'):''):!['discharge','ground'].includes(w.kind)?field(k+'.level','Tensione della sorgente','V'):''}${p.type==='rc'?field('initial','Tensione iniziale su C','V','Condizione del condensatore a t = 0.'):''}</section>`;
  }
  const presets=window.GuidedTrials.PRESETS;
  function renderInspector(focus){
    const content=$('inspectorContent'),panelChanged=content.dataset.panel!==panel,helpOpen=Boolean(content.querySelector('[data-rc-help]')?.open),precisionOpen=Boolean(content.querySelector('[data-analysis-precision]')?.open),readingOpen=Boolean(content.querySelector('[data-analysis-reading]')?.open),p=params();$$('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===panel)));
    $('inspectorTitle').textContent=panel==='components'?(selected&&['R','C','R1','Rf','C1','R3','R4'].includes(selected)?'Modifica '+selected:'Componenti'):panel==='signals'?'Segnali in ingresso':'Analisi del circuito';
    $('sheetPreset').innerHTML='<option value="">Nessuna prova guidata</option>'+presets[p.type].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    let html='';
    if(panel==='components'){
      html='<p class="panel-description">I valori sottolineati nello schema sono modificabili. Cliccali oppure usa questi campi.</p>';
      html+=M.isRadiation(p)?M.radiation.fields(p).map(([key,label,unit])=>field(key,label,unit)).join(''):p.type==='rc'?field('R','Resistenza R','res')+field('C','Condensatore C','cap'):field('R1','Resistenza d’ingresso R₁','res')+field('Rf','Resistenza di feedback Rf','res');
      if(M.isRadiation(p)){
        const checkbox=(key,label)=>`<label class="field-checkbox">${label}<input data-check="${key}" type="checkbox" ${p[key]?'checked':''}></label>`;
        if(['pz-shaper','detector-chain'].includes(p.type))html+=checkbox('pzEnabled','Inserisci la compensazione Rpz');
        if(p.type==='shaper-buffer')html+=checkbox('outputBuffer','Buffer aggiuntivo in uscita');
        if(M.radiation.hasFinal(p))html+=checkbox('biasEnabled','Bias DC nello stadio finale')+(p.biasEnabled?field('wave2.level','Riferimento DC del bias','V'): '');
        html+='<p class="field-hint">Valori iniziali di esempio: inserisci i componenti assegnati al tuo gruppo. Misura i picchi rispetto alla baseline, con oscilloscopio in DC.</p>';
      }
      if(p.type==='derivative')html+=field('C1','Condensatore in serie C₁','cap');
      if(p.type==='difference')html+=field('R3','Resistenza d’ingresso R₃','res')+field('R4','Resistenza verso massa R₄','res')+'<button class="text-button" id="balanceResistors">Bilancia: R₃ = R₁ e R₄ = Rf <svg><use href="#i-arrow"/></svg></button>';
      if(p.type==='rc'&&!M.real(p))html+=`<section class="form-section">${select('instrument','Generatore e oscilloscopio',[['ideal','Circuito ideale'],['generator','Solo generatore'],['direct','Oscilloscopio · senza sonde'],['probe','Oscilloscopio · sonde 10×'],['custom','Valori personalizzati']])}${p.instrument==='ideal'?'<p class="field-hint">Scegli una configurazione per aggiungere le impedenze degli strumenti allo schema.</p>':`<details class="details-settings" ${['Rg','CH1','CH2'].includes(selected)?'open':''}><summary>Modifica le impedenze degli strumenti</summary>${field('rg','R del generatore','res')}${p.instrument==='generator'?'':field('scopeR','R d’ingresso di ogni canale','res')+field('scopeC','C d’ingresso di ogni canale','cap','Cavi e sonde inclusi: i valori iniziali sono esempi modificabili.')}</details>`}</section>`;
      else if(p.type!=='rc')html+=`<section class="form-section">${select('opamp','Operazionale',[['limited','Banda e saturazione'],['physical','Fisico semplificato'],['ideal','Ideale']])}<details class="details-settings" ${selected==='U1'?'open':''}><summary>Alimentazione, guadagno e banda</summary>${p.opamp==='physical'?field('positive','Alimentazione V+','V')+field('negative','Alimentazione V−','V')+field('slew','Slew rate interno','slew')+field('rout','Resistenza di uscita','res')+field('ilimit','Corrente massima erogata/assorbita','current'):field('rail','Alimentazione simmetrica ±','V')}${field('headroom','Margine rispetto alle alimentazioni','V')}${field('a0','Guadagno ad anello aperto A₀','V/V')}${field('gbw','Prodotto guadagno-banda','freq','Modello generico a polo dominante. I limiti aggiuntivi si attivano con Fisico semplificato; i valori sono esempi regolabili.')}</details></section>`;
    }else if(panel==='signals'){
      if(p.type==='difference')html+=select('drive','Come sono pilotati gli ingressi',[['independent','Due segnali indipendenti'],['v1','V₁ attivo · V₂ a massa'],['v2','V₂ attivo · V₁ a massa'],['common','Modo comune · V₁ = V₂'],['differential','Differenziale · V₂ = −V₁']]);
      const label=p.type==='difference'?(p.drive==='v2'?'Ingresso V₂':p.drive==='common'?'Segnale comune V₁ = V₂':p.drive==='differential'?'Differenza V₂ − V₁':'Ingresso V₁'):'Ingresso V₁';
      html+=sourceFields(1,label);if(p.type==='difference'&&p.drive==='independent')html+=sourceFields(2,'Ingresso V₂');
      if(M.real(p))html+='<p class="field-hint">Ampiezze delle sorgenti ideali, prima di R_G. IN/OUT sono le letture dei canali collegati; V₂ è il nodo fisico d’ingresso.</p>';else if(p.type!=='rc')html+='<p class="field-hint">Ampiezze impostate nel punto V₁/V₂ della scheda, non a vuoto sul generatore.</p>';
    }else{
      const descriptions={time:p.type==='rc'?'Segui la carica e la scarica del condensatore e misura quanto tempo impiega l’uscita a cambiare.':p.type==='derivative'?'Confronta la forma dell’ingresso con l’uscita per verificare la derivazione del segnale.':'Confronta ingressi e uscita nel tempo: osserva guadagno, inversione e possibili limiti di uscita.',bode:'Scopri come cambiano guadagno e sfasamento al variare della frequenza. Utile per studiare filtri e banda passante.',charge:'Varia la durata di impulsi negativi, calcola Qin = |Vin|·T/Rin e confronta i massimi rispetto alla baseline con un fit lineare.',vtc:'Aumenta l’ampiezza di una sinusoide a frequenza fissa e osserva dove l’uscita smette di crescere linearmente.'};
      html=`<section class="guided-analysis-choice"><label for="guidedAnalysis">Che cosa vuoi studiare?</label><select class="form-select" id="guidedAnalysis" aria-describedby="guidedAnalysisPurpose">${[['time','Tempo · Transitorio'],['bode','Frequenza · Bode'],...(chargeAnalysis(p)?[['charge','Linearità · carica iniettata']]:p.type==='rc'||M.isRadiation(p)&&!M.radiation.hasFinal(p)?[]:[['vtc','Ampiezza · VTC']])].map(([value,label])=>`<option value="${value}" ${project.analysis===value?'selected':''}>${label}</option>`).join('')}</select><p id="guidedAnalysisPurpose">${descriptions[project.analysis]}</p></section>`;
      if(p.type==='difference'&&project.analysis!=='time')html+=select('bodeInput','Quale ingresso confrontare con OUT',[['differential','Differenza V₂ − V₁'],['v1','V₁ · V₂ a massa'],['v2','V₂ · V₁ a massa'],['common','Modo comune V₁ = V₂']],'Questa scelta vale per Bode e VTC. I segnali del Transitorio si impostano in Segnali.');
      let reading='';
      if(project.analysis==='time'){
        html+=`<div class="guided-analysis-settings"><h3>Intervallo del grafico</h3><label class="field-checkbox" for="autoTime">Durata automatica<input id="autoTime" data-check="autoTime" type="checkbox" ${p.autoTime?'checked':''}></label><p class="field-hint">Disattiva per scegliere il tempo da visualizzare.</p>${field('duration','Tempo visualizzato','time','Asse orizzontale del grafico.',p.autoTime)}${p.type==='rc'&&p.wave1.kind==='cycle'?field('switchTime','Inizio della scarica','time','',p.autoTime):''}</div><details class="details-settings" data-analysis-precision${precisionOpen?' open':''}><summary>Risoluzione del grafico</summary>${field('samples','Punti minimi','punti','Da 400 a 10 000. Il calcolo aggiunge fronti e vertici e aumenta la risoluzione quando serve. Maggiori valori possono richiedere più tempo.')}</details>`;
        reading='L’asse orizzontale mostra il tempo.'+(p.type==='rc'?' Dal menu sopra il grafico scegli Tensioni oppure Corrente in R; l’asse verticale mostra la grandezza scelta.':' L’asse verticale mostra le tensioni di ingresso e uscita.')+' Attiva Due cursori per leggere valori e differenze tra due istanti.';
      }
      if(project.analysis==='bode'){
        html+=`<div class="guided-analysis-settings"><h3>Intervallo delle frequenze</h3>${field('fmin','Frequenza minima','freq')}${field('fmax','Frequenza massima','freq')}</div><p class="field-hint">Risposta a piccolo segnale, attorno al punto di lavoro: la curva descrive il comportamento lineare del modello.</p>`;
        reading='L’asse orizzontale è la frequenza in Hz, su scala logaritmica. Nel menu sopra il grafico scegli Modulo (dB) o Fase (°). 0 dB corrisponde a un rapporto di ampiezza pari a 1; 20 dB a 10.'+(p.type==='rc'?' Il rapporto è Vout/V₁, dopo la resistenza del generatore.':p.type==='difference'?' Il rapporto è riferito all’ingresso scelto qui sopra.':' Il rapporto è Vout/V₁.')+' La curva usa 601 frequenze.'+(p.type==='rc'?' Per vedere carica e scarica scegli Tempo · Transitorio.':' La saturazione si osserva nel Transitorio o nella VTC.');
      }
      if(project.analysis==='charge'){
        html+=`<div class="guided-analysis-settings"><h3>Scansione della durata T</h3>${field('chargeMin','Durata minima','time')}${field('chargeMax','Durata massima','time')}${field('chargePoints','Impulsi da provare','punti','Da 3 a 25. Ogni punto usa un impulso negativo isolato, con riposo a 0 V e fronti istantanei. Il livello attivo è quello del segnale corrente in valore assoluto; il riferimento Qin assume massa virtuale.')}</div>`;
        reading='Asse orizzontale: carica iniettata nominale in coulomb. Asse verticale: picco di uscita rispetto alla baseline. La linea tratteggiata è il fit lineare dei punti simulati. I residui sono inclusi nel CSV; non sono assegnate incertezze sperimentali ai dati simulati.';
      }
      if(project.analysis==='vtc'){
        html+=`<div class="guided-analysis-settings"><h3>Sinusoide della prova</h3>${field('sweepMax','Ampiezza massima in ingresso','voltage','La scansione parte da 0 Vpp.')}${field('wave1.frequency','Frequenza fissa','freq')}${field('wave1.offset','Offset','V')}</div><details class="details-settings" data-analysis-precision${precisionOpen?' open':''}><summary>Risoluzione e calcolo</summary>${field('sweepPoints','Ampiezze da provare','punti','Da 11 a 101. Per ogni ampiezza si calcola la risposta a regime.')}<p class="field-hint">Il regime è verificato confrontando due periodi; Vpp,OUT è misurata sull’ultimo. Puoi annullare il calcolo dal pulsante sopra il grafico.</p></details>`;
        reading='L’asse orizzontale mostra l’ampiezza in ingresso (Vpp), quello verticale l’ampiezza di uscita (Vpp). La linea tratteggiata è la previsione lineare. Per osservare la saturazione scegli un operazionale con limiti in Componenti.';
      }
      html+=`<details class="details-settings guided-analysis-reading" data-analysis-reading${readingOpen?' open':''}><summary>Come leggere il grafico</summary><p>${reading}</p></details><p class="guided-analysis-auto">Le modifiche avviano il calcolo del grafico in basso.</p>`;
    }
    const measureButton=p.type==='rc'?'<button class="rc-launch rc-launch-panel" data-open-rc><span>Misura τ</span><small>Tempo e frequenza</small></button>':'<button class="rc-launch rc-launch-panel" data-open-opamp><span>Misure operazionali</span><small>VTC · banda · CMRR</small></button>';
    html=panel==='analysis'?html+'<section class="guided-analysis-measures"><h3>Hai misure di laboratorio?</h3><p>Importa i dati e confrontali con il modello.</p>'+measureButton+'</section>':measureButton+html;
    if(p.type==='rc'&&panel==='components')html+='<details class="details-settings component-help" data-rc-help'+(helpOpen?' open':'')+'><summary>Come R e C cambiano la risposta</summary><p>R limita la corrente; C accumula carica. Nel circuito RC ideale, τ = R·C = <strong>'+format(p.R*p.C,'s',4)+'</strong>. Raddoppiare R oppure C raddoppia il tempo caratteristico.</p><p>Dopo una τ resta il 36,8% della differenza dal valore finale. Generatore, sonde e oscilloscopio possono modificare la risposta: nel pannello Misura τ trovi i riferimenti distinti.</p></details>';
    content.innerHTML=html;content.dataset.panel=panel;trialLabel();$('guidedBenchMode').textContent=M.real(p)?'Reale · strumenti e cavi':p.type==='rc'&&p.instrument!=='ideal'?'Strumenti · modello precedente':'Ideale · impostazioni';$('guidedBenchMode').classList.toggle('is-real',M.real(p));
    if(panel==='analysis'||M.isRadiation(p))content.after($('summary'));else $('resetCircuit').before($('summary'));
    if(panelChanged)content.parentElement.scrollTop=0;
    if(focus){const input=$('inspectorContent').querySelector(`[data-field="${focus}"], [data-select="${focus}"]`);if(input){input.focus({preventScroll:true});input.select?.();input.closest('.field').scrollIntoView({block:'nearest'});}}
  }
  function setInspector(open){$('appLayout').classList.toggle('inspector-closed',!open);$('editButton').setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>plot.draw());}
  function clearSelection(){
    diagram.cancelGesture();realDiagram.cancelGesture();selected=null;$('rotateComponent').disabled=true;
    $$('#inspectorContent .field.selected').forEach(field=>field.classList.remove('selected'));
    if(panel==='components')$('inspectorTitle').textContent='Componenti';
    const svg=$(networkDiagram(params())?'realSchematic':'schematic');if(svg.contains(document.activeElement))svg.focus({preventScroll:true});
    drawDiagram();
  }
  function selectComponent(id){
    if(!applyFields())return;
    selected=id;panel=id==='V1'||id==='V2'?'signals':'components';setInspector(true);
    const source=id==='V1'||id==='V2',wave=source&&id==='V2'&&params().drive==='independent'?'wave2':'wave1';
    const kind=source?params()[wave].kind:null;
    const inactive=params().type==='difference'&&((id==='V1'&&params().drive==='v2')||(id==='V2'&&params().drive==='v1'));
    renderInspector((M.isRadiation(params())&&M.radiation.fields(params()).some(([k])=>k===id)||['R','C','R1','Rf','R3','R4','C1'].includes(id))?id:id==='Vbias'?'wave2.level':id.startsWith('U')?'rail':id==='Rg'?'rg':id==='CH1'||id==='CH2'?'scopeR':inactive?'drive':source?(kind==='discharge'?'initial':kind==='ground'?wave+'.kind':wave+(['dc','charge','cycle'].includes(kind)?'.level':'.vpp')):undefined);
    drawDiagram();
    $('rotateComponent').disabled=!(M.isRadiation(params())?M.radiation.fields(params()).some(([k])=>k===id):['R','C','R1','Rf','R3','R4','C1','Rg'].includes(id));
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
    if(M.isRadiation(candidate)||Number.isFinite(candidate.R)&&candidate.R>0&&Number.isFinite(candidate.C)&&candidate.C>0)candidate=M.normalizeTime(candidate);
    showErrors(M.validate(candidate));if(!valid)return false;
    const changedParameters=JSON.stringify(params())!==JSON.stringify(candidate);project.circuits[current().type]=candidate;
    if(changedParameters||!calculationReady&&!calculating)calculate();if(rebuild)renderInspector();else syncAutomaticFields();persist();return true;
  }
  function syncAutomaticFields(){for(const path of ['duration','switchTime']){const input=$('inspectorContent').querySelector(`[data-field="${path}"]`);if(input&&input.disabled){const factor=Number(input.parentElement.querySelector('[data-unit]').value);input.value=Number((get(params(),path)/factor).toPrecision(12));}}}
  const primaryMetric=r=>r.primary||/CMRR|taglio|Taglio|Banda|Costante di tempo|Guadagno/.test(r.label);
  function measurements(){const p=params();let rows=[...M.summary(p),...derivedMetrics];if(project.analysis==='charge'&&data.length)rows.push({label:'Pendenza fit simulato',value:format(data[0].slope*1e-12,'V/pC'),primary:true},{label:'Intercetta fit simulato',value:format(data[0].intercept,'V')});if(project.analysis==='time'&&data.length){const pp=key=>{let min=Infinity,max=-Infinity;for(const d of data){min=Math.min(min,d[key]);max=Math.max(max,d[key]);}return max-min;};rows.push({label:'V₁ picco-picco',value:format(pp('vin'),'V')});if(p.type==='difference')rows.push({label:'V₂ picco-picco',value:format(pp('vin2'),'V')});rows.push({label:'OUT picco-picco',value:format(pp('out'),'V')});}
    rows.sort((a,b)=>Number(Boolean(primaryMetric(b)))-Number(Boolean(primaryMetric(a))));$('summary').innerHTML=rows.map(r=>`<div class="summary-item ${primaryMetric(r)?'metric':''}" ${r.note?'title="'+esc(r.note)+'"':''}><span>${esc(r.label)}</span><strong>${esc(r.value)}</strong></div>`).join('')+(M.real(p)&&project.analysis==='bode'?'<p class="field-hint metric-note">I tagli a −3 dB sono riferiti al massimo della curva nell’intervallo visualizzato.</p>':'');
  }
  const colors={pre:'#bc7e2e',shaper:'#159e89',vin:'#627d99',vin2:'#159e89',out:'#4264ef',source:'#b88bce',linear:'#b0bbc9',current:'#4264ef',db:'#4264ef',phase:'#4264ef'};
  function series(){const p=params();let s;
    if(project.analysis==='bode')s=[{key:quantity==='phase'?'phase':'db',label:quantity==='phase'?'Fase':'Guadagno'}];
    else if(project.analysis==='charge')s=[{key:'out',label:'Picco rispetto alla baseline',points:true},{key:'linear',label:'Fit lineare',dash:'5 5'}];
    else if(project.analysis==='vtc')s=[{key:'out',label:'Vpp uscita'},{key:'linear',label:'Senza saturazione',dash:'5 5'}];
    else if(quantity==='current'&&p.type==='rc')s=[{key:'current',label:'Corrente in R'}];
    else{s=[{key:'vin',label:M.real(p)?(p.bench.channels?.[0]?.enabled===false?'Ingresso · IN virtuale':'Ingresso · CH1'):'Ingresso · V₁',dash:'5 4'}];if(p.type==='difference')s.push({key:'vin2',label:M.real(p)?'Ingresso 2 · V₂ fisico':'Ingresso 2 · V₂',dash:'4 4'});if(M.isRadiation(p)&&M.radiation.hasPre(p)&&p.type!=='preamp')s.push({key:'pre',label:'Uscita preamplificatore',dash:'4 3'});if(p.type==='detector-chain')s.push({key:'shaper',label:'Uscita shaper',dash:'2 3'});s.push({key:'out',label:M.real(p)?(p.bench.channels?.[1]?.enabled===false?'Uscita · OUT virtuale':'Uscita · CH2'):'Uscita · OUT'});if(p.type==='rc'&&(M.real(p)||p.instrument!=='ideal'))s.push({key:'source',label:'Generatore Vɢ',dash:'2 4'});}
    return s.map(d=>({...d,color:colors[d.key],visible:visible[d.key]!==false}));
  }
  function renderLegend(){const s=series();$('plotLegend').innerHTML=s.map(d=>`<button class="legend-button" data-trace="${d.key}" aria-pressed="${d.visible}" title="${d.visible?'Nascondi':'Mostra'} ${esc(d.label)}" aria-label="${d.visible?'Nascondi':'Mostra'} ${esc(d.label)}"><svg class="trace-swatch" viewBox="0 0 36 12" aria-hidden="true"><path d="M2 6H34" fill="none" stroke="${d.color}" stroke-width="3" ${d.dash?'stroke-dasharray="'+d.dash+'"':''}/></svg><span>${esc(d.label)}</span></button>`).join('');}

  function quantityControls(){const p=params(),select=$('plotQuantity');if(project.analysis==='bode')select.innerHTML='<option value="db">Modulo (dB)</option><option value="phase">Fase (°)</option>';else select.innerHTML='<option value="voltage">Tensioni</option><option value="current">Corrente in R</option>';
    if(project.analysis==='bode'&&!['db','phase'].includes(quantity))quantity='db';if(project.analysis==='time'&&!['voltage','current'].includes(quantity))quantity='voltage';
    select.value=quantity;select.hidden=['vtc','charge'].includes(project.analysis)||(project.analysis==='time'&&p.type!=='rc');
  }
  async function calculate(){
    const p=copy(params()),revision=++calculationRevision,analysis=project.analysis;stopPlayback();plot.lockHover=false;calculating=true;calculationReady=false;derivedMetrics=[];$('guidedCancel').hidden=false;$('guidedCancel').textContent='Annulla calcolo';showErrors({});$('calculationStatus').textContent='Calcolo locale in corso…';data=[];plot.data=[];plot.series=[];$('plot').replaceChildren();$('plotLegend').replaceChildren();$('readout').replaceChildren();$('resultNotice').hidden=true;$('timeline').hidden=true;quantityControls();drawDiagram(p);measurements();try{
      const result=await tasks.run(analysis==='time'?'guidedTime':analysis==='bode'?'guidedBode':analysis==='charge'?'guidedCharge':'guidedVtc',{params:p},fraction=>{if(revision===calculationRevision)$('calculationStatus').textContent='Calcolo locale · '+Math.round(fraction*100)+'%';});if(revision!==calculationRevision)return;data=result;calculating=false;calculationReady=true;derivedMetrics=M.metrics(p,analysis==='time'?null:p.bodeInput);if((M.real(p)||M.isRadiation(p))&&analysis==='bode')derivedMetrics.push(...M.curveMetrics(data));
      quantityControls();renderLegend();
      plot.set({data,series:series(),logX:project.analysis==='bode',xUnit:project.analysis==='bode'?'Hz':project.analysis==='charge'?'C':project.analysis==='vtc'?'Vpp':'s',xLabel:project.analysis==='bode'?'Frequenza':project.analysis==='charge'?'Carica iniettata Qin':project.analysis==='vtc'?'Ingresso':'Tempo',yUnit:project.analysis==='bode'?(quantity==='phase'?'°':'dB'):project.analysis==='vtc'?'Vpp':quantity==='current'?'A':'V',noZero:project.analysis==='bode',guides:project.analysis==='time'&&p.type==='rc'?[{x:M.rcSummary(p).tau,label:'τ'},...(p.wave1.kind==='cycle'?[{x:p.switchTime,label:'scarica'}]:[])]:[]});
      drawDiagram(p);measurements();
      $('timeline').hidden=project.analysis!=='time';$('timelineDuration').textContent=format(p.duration,'s');
      $('calculationStatus').textContent=project.analysis==='bode'?'Piccolo segnale':project.analysis==='charge'?'Linearità in carica · '+data.length+' impulsi':project.analysis==='vtc'?'Vpp a regime · '+data.length+' ampiezze':(p.type==='rc'?'Rete RC':'Operazionale '+(p.opamp==='ideal'?'ideale':'a polo dominante'))+' · '+data.length.toLocaleString('it-IT')+' punti';
      const clipped=project.analysis!=='bode'&&data.some(d=>d.clipped);
      const zeroCommon=!M.real(p)&&p.type==='difference'&&project.analysis!=='time'&&p.bodeInput==='common'&&!Number.isFinite(M.coefficients(p).cmrr);
      $('resultNotice').hidden=!clipped&&!zeroCommon;
      $('resultNotice').textContent=clipped?(p.opamp==='physical'?'Uno o più limiti fisici sono attivi (alimentazione, slew rate o corrente). I valori si modificano nell’operazionale.':'Saturazione nella retroazione: escursione ±'+format(p.rail-p.headroom,'V')+'.'):zeroCommon?'Rapporti resistivi bilanciati: il modo comune si annulla nel modello. Introduci una differenza tra R₄/R₃ e Rf/R₁ per misurare un CMRR finito.':'';
      $('rotateComponent').disabled=!(M.isRadiation(p)?M.radiation.fields(p).some(([k])=>k===selected):['R','C','R1','Rf','R3','R4','C1','Rg'].includes(selected));
      showErrors({});emitState(true);
    }catch(error){if(revision!==calculationRevision)return;calculating=false;$('exportCSV').disabled=true;$('exportSVG').disabled=true;$('calculationStatus').textContent=error.name==='AbortError'?'Calcolo annullato':'Calcolo non disponibile';if(error.name!=='AbortError')toast('Calcolo non disponibile: '+error.message,true);}
    finally{if(revision===calculationRevision)$('guidedCancel').textContent='Ricalcola';}
  }
  function cursor(d,fraction,cursors){
    $('timeCursor').value=Math.round(fraction*10000);if(playback.running&&playback.mode==='continuous'&&performance.now()-lastContinuousReadout<200)return;lastContinuousReadout=performance.now();const p=params();let rows;
    if(project.analysis==='time'){const names=series(),label=(key,fallback)=>names.find(t=>t.key===key)?.label||fallback;rows=[['Tempo',format(d.x,'s',4)],[label('vin','Ingresso · V₁'),format(d.vin,'V',4),'input-value']];if(p.type==='difference')rows.push([label('vin2','Ingresso 2 · V₂'),format(d.vin2,'V',4),'second-input-value']);rows.push([label('out','Uscita · OUT'),format(d.out,'V',4),'primary-value']);if(quantity==='current'&&p.type==='rc')rows.push(['Corrente',format(d.current,'A',4),'primary-value']);}
    else if(project.analysis==='bode')rows=[['Frequenza',format(d.x,'Hz',4)],['Guadagno',d.magnitude===0?'0 V/V':format(d.magnitude,'',4)+' V/V','primary-value'],['Modulo',d.magnitude===0?'−∞ dB':format(d.db,'dB',4)],['Fase',format(d.phase,'°',4)]];
    else if(project.analysis==='charge')rows=[['Qin nominale',format(d.x,'C',4)],['Durata impulso',format(d.width,'s',4)],['Picco / baseline',format(d.out,'V',4)],['Residuo dal fit',format(d.residual,'V',4)]];
    else rows=[['Ingresso',format(d.x,'V',4)+'pp'],['Uscita',format(d.out,'V',4)+'pp','primary-value'],['Risposta lineare',format(d.linear,'V',4)+'pp']];
    if(cursors){const {a,b}=cursors,u=project.analysis==='time'?'s':project.analysis==='bode'?'Hz':project.analysis==='charge'?'C':'Vpp';rows=[['A',format(a.x,u,4)],['B',format(b.x,u,4)],['Δ'+(project.analysis==='time'?'t':project.analysis==='bode'?'f':project.analysis==='charge'?'Q':'IN'),format(b.x-a.x,u,4)],...plot.series.flatMap(t=>{const unit=project.analysis==='bode'?(quantity==='phase'?'°':'dB'):quantity==='current'?'A':'V';return[[t.label+' A / B',format(a[t.key],unit,4)+' / '+format(b[t.key],unit,4)],['Δ '+t.label,format(b[t.key]-a[t.key],unit,4)]];})];}
    $('readout').innerHTML=rows.map(([label,value,cls=''])=>`<div class="${cls}"><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('timeCursor').setAttribute('aria-valuetext',project.analysis==='time'?format(d.x,'s',4):format(d.x,''));
  }
  function applyPreset(key){
    if(!applyFields())return;if(!key){window.GuidedTrials.select(project,'',M.CATALOG);renderInspector();persist();return;}let p=copy(params());const w=p.wave1;
    if(M.isRadiation(p)){const trial=M.radiation.applyPreset(p,key);p=trial.parameters;project.analysis=trial.analysis;}else if(p.type==='rc'){
      if(['cycle','charge','discharge'].includes(key)){w.kind=key;p.initial=key==='discharge'?w.level:0;}
      if(['square','ideal','direct','probe'].includes(key)){Object.assign(w,{kind:'square',frequency:50,vpp:4,offset:2,phase:0});p.initial=0;}
      if(['ideal','direct','probe'].includes(key)){if(p.bench){p.bench=window.BenchModel.config(p.bench);p.bench.mode=key==='ideal'?'ideal':'real';for(const ch of p.bench.channels){ch.enabled=true;ch.kind=key==='probe'?'probe10':'direct';ch.coupling='dc';}}p.instrument=key;if(key==='direct'){p.scopeR=1e6;p.scopeC=120e-12;}if(key==='probe'){p.scopeR=10e6;p.scopeC=12e-12;}p.rg=50;}
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
    p.autoTime=true;project.circuits[p.type]=M.normalizeTime(p);window.GuidedTrials.select(project,key,M.CATALOG);quantity='voltage';renderNavigation();renderInspector();calculate();persist();
  }
  function stopPlayback(){playback.pause();}
  function readingRange(){return [...plot.view];}
  function readingPosition(){return plot.toDomain(plot.cursor.x);}
  function canRead(){return valid&&calculationReady&&!calculating&&project.analysis==='time'&&plot.data.length>0;}
  function holdReading(){stopPlayback();plot.lockHover=true;plot.controls.querySelector('span').textContent='Lettura ferma · clicca il grafico per spostarla';}
  function manualReading(direction){
    if(!canRead())return;holdReading();const range=readingRange();plot.inspectDomain(direction===0?range[0]:window.ReadingPlayback.step(readingPosition(),range,direction));
  }
  function play(){
    if(playback.running){holdReading();return;}if(!canRead())return;
    plot.lockHover=true;playback.start(readingPosition(),readingRange());
  }

  function drawDiagram(p=params()){
    const real=networkDiagram(p),wasHidden=$('realSchematic').hasAttribute('hidden');$('realSchematic').toggleAttribute('hidden',!real);$('schematic').toggleAttribute('hidden',real);
    if(!networkDiagram(p)){diagram.render(p,project.layouts[p.type]||{},selected);return;}
    const d=M.network(p,project.analysis==='time'?null:p.bodeInput);d.settings.analysis=project.analysis==='bode'?'bode':'time';
    for(const c of d.components)if(project.layouts[p.type]?.[c.id])Object.assign(c,project.layouts[p.type][c.id]);
    const id=p.type==='rc'&&selected==='R'?'R1':p.type==='rc'&&selected==='C'?'C1':selected;
    realDiagram.render(d,id?{kind:'component',id}:null,'select',null,false);if(wasHidden)requestAnimationFrame(()=>realDiagram.fit());
  }
  const activeDiagram=()=>networkDiagram(params())?realDiagram:diagram;
  function fitDiagram(){drawDiagram();activeDiagram().fit();}
  function selectReal(kind,id){if(kind!=='component'){clearSelection();return;}const c=realDiagram.doc.components.find(c=>c.id===id);if(c?.benchRole){selected=id;drawDiagram();document.dispatchEvent(new CustomEvent('open-bench',{detail:{part:id}}));return;}selectComponent(params().type==='rc'&&id==='R1'?'R':params().type==='rc'&&id==='C1'?'C':id);}
  const realDiagram=new window.FreeCanvas($('realSchematic'),{select:selectReal,pin:ref=>selectReal('component',ref.split(':')[0]),move:(id,x,y)=>{const c=realDiagram.doc.components.find(c=>c.id===id);(project.layouts[params().type]??={})[id]={x,y,rotation:c.rotation};drawDiagram();persist();},moveWire:()=>drawDiagram(),moveGroup:()=>drawDiagram(),region:()=>clearSelection(),add:()=>toast('Aggiungi componenti dall’editor libero.'),zoom:value=>{if(networkDiagram(params()))$('diagramZoom').textContent=value+'%';}});
  const diagram=new window.LabDiagram($('schematic'),{select:selectComponent,deselect:clearSelection,move:(id,value)=>{const type=params().type;(project.layouts[type]??={})[id]=value;persist();},zoom:value=>$('diagramZoom').textContent=value+'%'});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||window.circuitEditor?.active||e.target.closest('select,dialog')||document.querySelector('dialog[open]'))return;clearSelection();});
  let lastContinuousReadout=0;
  const plot=new window.LabPlot($('plot'),cursor);
  const playback=new window.ReadingPlayback({write:value=>plot.inspectDomain(value),onState:running=>{
    plot.playbackActive=running;
    $('playButton').setAttribute('aria-pressed',String(running));$('playButton').setAttribute('aria-label',running?'Metti in pausa la lettura':playback.mode==='continuous'?'Riproduci la lettura continua':'Riproduci la lettura a passi');
    $('playButton').innerHTML=`<svg><use href="#i-${running?'pause':'play'}"/></svg><span>${running?'Pausa':'Riproduci'}</span>`;
    if(!running&&plot.data.length)plot.drawCursor();
    plot.controls.querySelector('span').textContent=running?(playback.mode==='continuous'?'Lettura continua · Pausa ferma i valori':'Lettura a passi · Pausa ferma i valori'):plot.lockHover?'Lettura ferma · clicca il grafico per spostarla':plot.dual?'Scegli A o B, poi clicca il grafico':'Passa sul grafico per leggere';
  }});
  for(const type of ['pointerdown','wheel','keydown'])$('plot').addEventListener(type,()=>{stopPlayback();plot.lockHover=false;plot.syncControls();},{capture:true});
  plot.controls.addEventListener('click',()=>{stopPlayback();plot.lockHover=false;plot.syncControls();},{capture:true});

  $('circuitList').addEventListener('click',e=>{if(e.target.closest('[data-open-editor]')){window.circuitEditor?.open();return;}const b=e.target.closest('[data-experiment]');if(b)activate(b.dataset.experiment);});
  $$('[data-panel]').forEach(b=>b.addEventListener('click',()=>{if(!applyFields())return;panel=b.dataset.panel;renderInspector();}));
  function changeAnalysis(value){if(!['time','bode','vtc','charge'].includes(value)||(value==='vtc'&&params().type==='rc')||(value==='charge'&&!chargeAnalysis(params())))return;if(!applyFields()){const select=$('guidedAnalysis');if(select)select.value=project.analysis;return;}project.analysis=value;panel='analysis';quantity=value==='bode'?'db':'voltage';renderNavigation();renderInspector();$('inspectorContent').parentElement.scrollTop=0;calculate();persist();}
  $$('[data-analysis]').forEach(b=>b.addEventListener('click',()=>changeAnalysis(b.dataset.analysis)));
  $('editButton').addEventListener('click',()=>{setInspector(true);panel='components';renderInspector();const input=$('inspectorContent').querySelector('input');if(input){input.focus({preventScroll:true});input.select();}});
  $('closeInspector').addEventListener('click',()=>setInspector(false));
  $('inspectorContent').addEventListener('input',e=>{if(e.target.matches('[data-field]')){clearTimeout(debounce);debounce=setTimeout(()=>applyFields(),140);}});
  $('inspectorContent').addEventListener('change',e=>{
    const el=e.target;
    if(el.id==='guidedAnalysis')changeAnalysis(el.value);
    else if(el.matches('[data-unit]')){const physical=Number(el.parentElement.querySelector('input').value)*Number(el.dataset.previous),factor=Number(el.value);units[el.dataset.unit]=factor;el.dataset.previous=String(factor);el.parentElement.querySelector('input').value=Number((physical/factor).toPrecision(12));applyFields();}
    else if(el.matches('[data-select]'))applyFields(true,el.dataset.select);
    else if(el.matches('[data-check]'))applyFields(true);
    else if(el.matches('[data-field]'))applyFields();
  });
  $('inspectorContent').addEventListener('click',e=>{if(e.target.closest('#balanceResistors')){const p=params();p.R3=p.R1;p.R4=p.Rf;renderInspector();calculate();persist();}});
  $('sheetPreset').addEventListener('change',()=>applyPreset($('sheetPreset').value));
  $('resetCircuit').addEventListener('click',()=>{project.circuits[current().type]=M.defaults(current().type);window.GuidedTrials.select(project,'',M.CATALOG);delete project.layouts[current().type];selected=null;for(const key of Object.keys(units))delete units[key];renderInspector();fitDiagram();calculate();persist(true);toast('Valori iniziali ripristinati.');});
  $('rotateComponent').addEventListener('click',()=>{if(!networkDiagram(params())){diagram.rotate();return;}const id=params().type==='rc'&&selected==='R'?'R1':params().type==='rc'&&selected==='C'?'C1':selected,c=realDiagram.doc.components.find(c=>c.id===id);if(c&&['R','C','L'].includes(c.type)){(project.layouts[params().type]??={})[id]={x:c.x,y:c.y,rotation:(c.rotation+90)%360};drawDiagram();persist();}});$('diagramIn').addEventListener('click',()=>activeDiagram().zoom(1.2));$('diagramOut').addEventListener('click',()=>activeDiagram().zoom(1/1.2));$('diagramFit').addEventListener('click',()=>activeDiagram().fit());
  $('resetLayout').addEventListener('click',()=>{delete project.layouts[params().type];fitDiagram();drawDiagram();persist();});
  function setWorkspaceView(view){
    const main=$('appLayout').querySelector('.workbench');main.dataset.workbenchView=view;
    for(const b of $$('[data-guided-view]'))b.setAttribute('aria-pressed',String(b.dataset.guidedView===view));
    document.dispatchEvent(new Event('circuit-lab-view'));if(view==='circuit')stopPlayback();requestAnimationFrame(()=>{if(view!=='plot')activeDiagram().fit();if(view!=='circuit')plot.draw();});
  }
  $$('[data-guided-view]').forEach(b=>b.addEventListener('click',()=>setWorkspaceView(b.dataset.guidedView)));
  $('toggleSchematic').addEventListener('click',()=>setWorkspaceView('plot'));$('hideGuidedPlot').addEventListener('click',()=>setWorkspaceView('circuit'));
  $('plotIn').addEventListener('click',()=>{stopPlayback();plot.zoom(1.6);});$('plotOut').addEventListener('click',()=>{stopPlayback();plot.zoom(1/1.6);});$('plotFit').addEventListener('click',()=>{stopPlayback();plot.fit();});
  $('plotQuantity').addEventListener('change',()=>{quantity=$('plotQuantity').value;calculate();});
  $('plotLegend').addEventListener('click',e=>{const b=e.target.closest('[data-trace]');if(!b)return;stopPlayback();const key=b.dataset.trace,s=series();if(visible[key]&&s.filter(d=>d.visible).length===1){toast('Mantieni visibile almeno una traccia.');return;}visible[key]=!visible[key];renderLegend();plot.updateSeries(series());});
  $('timeCursor').addEventListener('input',()=>{holdReading();plot.setFraction(Number($('timeCursor').value)/10000);});$('playButton').addEventListener('click',play);$('readingStart').addEventListener('click',()=>manualReading(0));$('readingBack').addEventListener('click',()=>manualReading(-1));$('readingNext').addEventListener('click',()=>manualReading(1));$('readingDelay').addEventListener('change',()=>playback.setDelay(Number($('readingDelay').value)));
  $('readingMode').addEventListener('change',()=>{playback.setMode($('readingMode').value);$('readingDelayLabel').textContent=playback.mode==='continuous'?'1% in':'Ogni passo';$('readingHint').textContent=playback.mode==='continuous'?'Il cursore scorre senza scatti; i numeri si aggiornano fino a 5 volte al secondo. Il tempo fisico non cambia.':'Un passo = 1% dell’intervallo visibile. I valori restano fermi tra i passi; il tempo del circuito non cambia.';});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
  let resizeStart;
  function resizeSchematic(height){
    const workbench=$('schematicStage').closest('.workbench'),available=workbench.getBoundingClientRect().height;
    const maximum=window.matchMedia('(max-width:760px)').matches?620:Math.max(620,available-100);
    document.documentElement.style.setProperty('--diagram-height',Math.max(280,Math.min(maximum,height))+'px');
  }
  $('paneDivider').addEventListener('pointerdown',e=>{resizeStart={y:e.clientY,height:$('schematicStage').getBoundingClientRect().height};$('paneDivider').setPointerCapture(e.pointerId);});
  $('paneDivider').addEventListener('pointermove',e=>{if(resizeStart)resizeSchematic(resizeStart.height+e.clientY-resizeStart.y);});
  for(const type of ['pointerup','pointercancel'])$('paneDivider').addEventListener(type,()=>resizeStart=null);
  $('paneDivider').addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();resizeSchematic($('schematicStage').getBoundingClientRect().height+(e.key==='ArrowUp'?-20:20));}});
  function download(content,mime,name){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  $('saveProject').addEventListener('click',()=>window.circuitEditor?.active||!window.GuidedSessions?window.ProjectPanel.show():window.GuidedSessions.save());
  $('openProject').addEventListener('click',()=>$('projectFile').click());
  $('projectFile').addEventListener('change',async()=>{const file=$('projectFile').files[0];if(!file)return;try{if(file.size>window.LocalProjects.MAX_BYTES)throw new Error('Il progetto supera il limite di 1 MB.');window.ProjectPanel.importText(await file.text());}catch(error){toast(error.message,true);}finally{$('projectFile').value='';}});
  $('guidedCancel').addEventListener('click',()=>calculating?tasks.cancel():calculate());
  $('exportCSV').addEventListener('click',()=>{if(!applyFields()||calculating)return;download(M.csv(params(),project.analysis,data),'text/csv;charset=utf-8',window.GuidedTrials.stem(project,M.CATALOG)+'-'+project.analysis+'.csv');toast('Download CSV richiesto al browser · unità SI.');});
  $('exportSVG').addEventListener('click',()=>{const svg=$('plot').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font-family:Arial,sans-serif;font-size:10px;fill:#7185a1}.axis-unit,.guide-text{font-size:9px}';svg.prepend(style);download(svg.outerHTML,'image/svg+xml',window.GuidedTrials.stem(project,M.CATALOG)+'-'+project.analysis+'.svg');toast('Download SVG richiesto al browser.');});
  $('projectName').addEventListener('change',()=>{if(window.circuitEditor?.active)return;project.name=$('projectName').value.trim()||'Il mio laboratorio';persist();});
  $('helpButton').addEventListener('click',()=>window.circuitEditor?.active?window.circuitEditor.showHelp():$('helpDialog').showModal());for(const id of ['closeHelp','helpDone'])$(id).addEventListener('click',()=>$('helpDialog').close());
  function loadProject(text){const next=M.parse(text);if(window.circuitEditor?.active)window.circuitEditor.back();project=next;selected=null;panel='components';$('projectName').value=project.name;renderNavigation();renderInspector();fitDiagram();calculate();persist(true);toast('Progetto guidato aperto sul dispositivo.');}
  function editBreadboard(updates){
    if(!applyFields())return false;
    try{const p=copy(params()),allowed=/^(R|C|R1|Rf|R3|R4|C1|positive|negative|rail|opamp|drive|Rin|Rfpre|Cfpre|Rsh1|Rsh2|Csh1|Csh2|Rpz|Ri|Rgain|Rbias|slew|rout|ilimit|a0|gbw|headroom|wave[12]\.(kind|vpp|frequency|offset|phase|duty|level|low|width|period|delay|rise|fall))$/;
      for(const[path,value]of Object.entries(updates)){if(!allowed.test(path))throw Error('Parametro non modificabile dalla breadboard.');set(p,path,value);}
      const next=M.normalizeTime(p),errors=M.validate(next);if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);if(M.real(next))M.network(next);
      project.circuits[current().type]=next;renderInspector();calculate();persist();return true;
    }catch(error){toast(error.message,true);throw error;}
  }
  function breadboardColors(enabled){Object.assign(colors,enabled?{vin:'#16804d',vin2:'#9552cc',out:'#e36c16',source:'#6b7a8c'}:{vin:'#627d99',vin2:'#159e89',out:'#4264ef',source:'#b88bce'});if(calculationReady&&!calculating){plot.updateSeries(series());renderLegend();}}
  window.GuidedLab={applyBreadboardPreset:applyPreset,editBreadboard,breadboardColors,setWorkspaceView,focusPanel:next=>{if(!applyFields())return false;setInspector(true);panel=next;renderInspector();return true;},plotSnapshot:()=>calculationReady&&!calculating?copy(plot.config):null,setBench:(config,reference)=>{if(!applyFields())return false;try{const p=copy(params());p.bench=window.BenchModel.config(config);p.benchReference=reference||p.benchReference||'input';p.instrument='ideal';const candidate=M.normalizeTime(p),errors=M.validate(candidate);if(Object.keys(errors).length)throw Error(Object.values(errors)[0]);if(M.real(candidate))M.network(candidate);project.circuits[p.type]=candidate;selected=null;renderInspector();calculate();persist();requestAnimationFrame(fitDiagram);return true;}catch(e){toast(e.message,true);return false;}},sessionState:()=>sessionState(true),document:()=>copy(project),startSession:name=>{if(!applyFields())return false;project.name=String(name).trim().slice(0,80)||'Nuova sessione';project.session=null;project.guidedTrials={};ensureSession();$('projectName').value=project.name;renderInspector();persist();return true;},updateStudies:update=>{const checked=M.parse(M.serialize({...project,...update}));for(const k of Object.keys(update))project[k]=copy(checked[k]);persist();},setOpampStudy:s=>{project.opampStudy=copy(s);persist();},exportCircuit:()=>{if(!applyFields())return null;return M.circuit(project);},parameters:()=>copy(params()),getACStudy:()=>project.acStudy,setACStudy:s=>{project.acStudy=copy(s);persist();},getRCStudy:()=>project.rcStudy,setRCStudy:s=>{project.rcStudy=copy(s);persist();},storageState:()=>storageState,hasPrevious:()=>Boolean(store.previous()),snapshot:()=>{if(!applyFields())return null;project.name=$('projectName').value.trim()||'Il mio laboratorio';persist();return M.serialize(project);},load:loadProject,recoverPrevious:()=>{const old=store.previous();if(!old)return false;loadProject(M.serialize(old));return true;},suspend:()=>{stopPlayback();const ok=applyFields();if(ok){tasks.cancel();calculationRevision++;calculating=false;$('guidedCancel').hidden=true;}return ok;},resume:()=>{$('appLayout').hidden=false;$('projectName').value=project.name;$('saveProject').disabled=!valid;updateSaveStatus();if(!calculationReady)calculate();else requestAnimationFrame(()=>plot.draw());document.dispatchEvent(new Event('circuit-lab-mode'));}};
  const loaded=store.read();if(loaded.doc){project=loaded.doc;storageState.ok=true;}else if(!loaded.error)try{const old=localStorage.getItem('rc-studio-project-v1');if(old)project=M.parse(old);}catch{}
  if(loaded.recovered||loaded.error)setTimeout(()=>toast(loaded.recovered?'Recuperata la copia precedente del laboratorio: la più recente non era leggibile.':loaded.error,true),200);
  ensureSession();$('projectName').value=project.name;renderNavigation();renderInspector();calculate();persist();
  if(window.matchMedia('(max-width:760px)').matches)setInspector(false);
})();
