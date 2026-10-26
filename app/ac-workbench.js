(() => {
  'use strict';
  const A=window.ACAnalysis,R=window.RCAnalysis,M=window.LabModel,Files=window.LocalProjects;
  const $=id=>document.getElementById(id),F=(v,u='',n=3)=>u==='V/V'?M.format(v,'',n)+' V/V':M.format(v,u,n),copy=M.clone;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const field=(id,label,hint='')=>`<label class="rc-field" for="${id}"><span>${label}</span><input id="${id}" inputmode="decimal" autocomplete="off">${hint?'<small>'+hint+'</small>':''}</label>`;
  const select=(id,label,options)=>`<label class="rc-field" for="${id}"><span>${label}</span><select id="${id}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`;
  const refs={input:'OUT / IN · sonde del circuito',source:'Vout / Vg · prima di Rg','after-generator':'Vout / V₁ · dopo Rg',custom:'Altro riferimento'};
  const columnNames={frequency:'Frequenza',input:'Ampiezza Vin',output:'Ampiezza Vout',gain:'Guadagno',phase:'Fase Vout − Vin',uInput:'u(Vin)',uOutput:'u(Vout)',uGain:'u(G)',uPhase:'u(fase)'};
  class ACWorkbench{
    constructor(){
      this.dialog=document.createElement('dialog');this.dialog.id='acDialog';this.dialog.className='rc-workbench ac-workbench';this.dialog.setAttribute('aria-labelledby','acTitle');
      this.dialog.innerHTML=`<header class="rc-header rc-analysis-header"><div><span>LABORATORIO · MISURE IN FREQUENZA</span><h2 id="acTitle">Dal Bode misurato al taglio della RC.</h2><p>Modulo, fase e residui, con riferimenti e incertezze dichiarati.</p><nav class="rc-analysis-nav" aria-label="Analisi RC"><button data-open-rc>Tempo · τ e fit</button><button aria-current="page">Frequenza · Bode</button></nav></div><button class="icon-button" id="acClose" aria-label="Chiudi analisi in frequenza">×</button></header>
      <div class="rc-body"><aside class="rc-controls" aria-label="Impostazioni delle misure in frequenza">
      <p class="ac-local-label">● Analisi locale · dati sul dispositivo</p><p id="acSourceInfo" class="rc-hint"></p>
      <details id="acImportDetails" class="rc-import"><summary>Inserisci o apri dati CSV</summary><div class="rc-import-actions"><button class="button" id="acChooseCSV">Apri CSV</button><button class="button" id="acDemo">Prova un esempio</button></div><label class="rc-field" for="acDatasetName"><span>Nome dei dati</span><input id="acDatasetName" maxlength="120" value="Misure in frequenza"></label>
      ${select('acMode','Contenuto della tabella',[['amplitudes','Frequenza, Vin e Vout'],['gain','Frequenza e guadagno']])}
      <label class="rc-field" for="acRaw"><span>Tabella da analizzare</span><textarea id="acRaw" maxlength="200000" spellcheck="false" placeholder="f_Hz;Vin_Vpp;Vout_Vpp;fase_deg&#10;10;2;1,99;-3,6&#10;100;2;1,69;-32"></textarea><small>Da 2 a 4 000 punti. Il fit RC richiede almeno 4 punti.</small></label>
      <div class="rc-two">${select('acDelimiter','Separatore',[['auto','Automatico'],[';','Punto e virgola'],[',','Virgola'],['tab','Tab']])}${select('acDecimal','Decimale',[[',','Virgola o punto'],['.','Punto']])}${select('acHeader','Intestazione',[['auto','Automatica'],['yes','Prima riga'],['no','Assente']])}${select('acFrequencyUnit','Frequenza',[['Hz','Hz'],['kHz','kHz'],['MHz','MHz']])}</div>
      <div id="acAmplitudeOptions"><div class="rc-two">${select('acVoltageUnit','Tensioni',[['V','V'],['mV','mV']])}${select('acAmplitudeKind','Ampiezze',[['vpp','Picco-picco'],['rms','RMS'],['peak','Picco']])}</div><p class="rc-hint">Vin e Vout devono usare la stessa convenzione di ampiezza.</p></div>
      <div id="acGainOptions">${select('acGainUnit','Guadagno e sua u',[['linear','V/V'],['dB','dB']])}</div>
      ${select('acPhaseUnit','Fase e sua u',[['deg','Gradi'],['rad','Radianti']])}<div id="acColumnControls"></div>
      <details id="acUncertaintyDetails"><summary>Colonne delle incertezze standard</summary><div id="acUncertaintyColumns"></div><label class="rc-check" id="acIndependentAmplitudesLabel"><input id="acIndependentAmplitudes" type="checkbox">Assumi indipendenti Vin e Vout per propagare le loro u.</label><p class="rc-hint">Facoltative. Colonne complete, con valori positivi. Le frequenze sono assunte esatte; il fit usa errori indipendenti tra punti.</p></details>
      <p id="acPreview" class="rc-hint"></p><button class="button" id="acUseData">Controlla e usa questi dati</button></details>
      <section class="rc-form-section"><h3>Riferimento del guadagno</h3>${select('acReference','Vin è misurata…',Object.entries(refs))}<label class="rc-field" for="acReferenceNote"><span>Nota sul riferimento</span><input id="acReferenceNote" maxlength="160" placeholder="Per esempio: canale 1 dopo Rg"></label><p id="acReferenceHint" class="rc-hint"></p></section>
      <section class="rc-form-section"><h3>Intervallo delle misure · Hz</h3><div class="rc-two">${field('acFrom','Da')}${field('acTo','A')}</div><p class="rc-hint">Solo punti originali nell’intervallo. Nessun riordino o estrapolazione dei punti.</p></section>
      <section class="rc-form-section"><h3>Livello del taglio</h3>${field('acG0','Guadagno di riferimento G₀ · V/V','Valore dichiarato a bassa frequenza. Non si usa il massimo dei campioni.')}<details><summary>Incertezza del riferimento</summary>${field('acUG0','u(G₀) · V/V','Vuoto: non disponibile. Zero: riferimento assunto esatto.')}<label class="rc-check"><input id="acIndependentReference" type="checkbox">G₀ indipendente dai punti usati per leggere il taglio.</label></details></section>
      <section class="rc-form-section"><h3>Modello e confronto</h3><p class="rc-formula">G(f) = G₀ / √[1 + (f/fc)²]</p><label class="rc-check"><input id="acFit" type="checkbox" checked>Adatta il modulo con un modello RC a un polo.</label><label class="rc-check"><input id="acOverlay" type="checkbox" checked>Sovrapponi la simulazione attuale.</label><label class="rc-check"><input id="acShowPhase" type="checkbox" checked>Mostra anche la fase.</label><p class="rc-hint">Il fit stima liberamente G₀ e fc; il riferimento dichiarato sopra serve alla lettura dei punti.</p></section>
      </aside><section class="rc-output" aria-label="Risultati delle misure in frequenza"><button class="rc-return-settings" id="acReturnSettings">↑ Modifica impostazioni</button><p id="acContextNote" class="rc-context-note"></p><p id="acError" class="rc-error" role="alert" hidden></p><div id="acEmpty" class="rc-empty-result"><strong>Porta qui le tue misure in frequenza.</strong><p>Importa una tabella oppure prova l’esempio sintetico. Poi premi Analizza i dati.</p></div>
      <div id="acResult" hidden><div id="acMetrics" class="rc-metrics"></div><div id="acWarnings" class="rc-fit-warnings" role="status"></div><p id="acFitDetail" class="rc-hint"></p>
      <div class="ac-curves" id="acCurves"><section class="rc-chart"><div class="rc-chart-heading"><h3>Modulo del guadagno</h3><button class="ac-fit-view" data-ac-reset="magnitude">Vista completa</button></div><div id="acLegend" class="rc-legend"></div><div class="rc-chart-area"><svg id="acMagnitudePlot" tabindex="0" role="img" aria-label="Modulo misurato, fit RC e simulazione"></svg></div><p id="acMagnitudeReadout" class="rc-chart-readout"></p></section>
      <section class="rc-chart" id="acPhaseSection"><div class="rc-chart-heading"><h3>Fase Vout − Vin</h3><button class="ac-fit-view" data-ac-reset="phase">Vista completa</button></div><p id="acPhaseNote" class="ac-phase-note"></p><div class="rc-chart-area"><svg id="acPhasePlot" tabindex="0" role="img" aria-label="Fase misurata e confronto con il modello"></svg></div><p id="acPhaseReadout" class="rc-chart-readout"></p></section></div>
      <details class="ac-residual-details" id="acResidualDetails"><summary>Residui del confronto</summary><div class="rc-chart rc-residual-chart"><div class="rc-chart-heading"><h3>Residui</h3><div class="ac-residual-selects"><select id="acResidualReference" aria-label="Riferimento dei residui"><option value="fit">Dati − fit RC</option><option value="simulation">Dati − simulazione</option></select><select id="acResidualQuantity" aria-label="Grandezza dei residui"><option value="db">Modulo · dB</option><option value="phase">Fase · °</option></select></div></div><div class="rc-chart-area"><svg id="acResidualPlot" tabindex="0" role="img" aria-label="Residui delle misure in frequenza"></svg></div><p id="acResidualReadout" class="rc-chart-readout"></p></div></details>
      <div class="rc-comparison"><h3>Confronto tra lettura e modelli</h3><div class="rc-table-scroll"><table><thead><tr><th>Grandezza</th><th>Valore</th><th>u standard</th><th>Metodo e riferimento</th></tr></thead><tbody id="acComparisonRows"></tbody></table></div></div>
      <details class="rc-method-notes"><summary>Ipotesi e limiti delle incertezze</summary><p>Le barre indicano le incertezze standard fornite. La propagazione di Vin/Vout in dB è del primo ordine e richiede indipendenza; sistematici condivisi dai canali non sono inclusi. Il fit tratta frequenze esatte ed errori del modulo indipendenti fra punti. La covarianza locale non è riscalata dai residui; senza u(G) non viene assegnata un’incertezza sperimentale.</p><p>Il taglio dai punti interpola i dB in log(f) al livello G₀/√2. La sua u richiede u(G₀), u dei due punti e indipendenza del riferimento; non comprende l’errore dell’interpolazione o u(f). Il fit usa soltanto il modulo: la fase prevista è un confronto indipendente del modello, non un dato adattato.</p><p>La fase misurata viene riportata su un ramo continuo, con il primo punto in [−180°, 180°). Punti troppo radi possono nascondere avvolgimenti; gli originali restano nel progetto. Residui di fase nel ramo [−180°, 180°). Una sola τ è significativa soltanto se il modello a un polo descrive il circuito.</p></details></div></section></div>
      <footer class="rc-footer"><div class="rc-action-status"><button class="button primary rc-compute" id="acCompute">Analizza i dati</button><span id="acSaveNote" role="status">Calcoli sul dispositivo · nessun invio di dati</span></div><div class="rc-exports"><button class="button" id="acExportSummary" disabled>CSV misure</button><button class="button" id="acExportPoints" disabled>CSV dati e residui</button><button class="button" id="acExportSVG" disabled>SVG Bode</button></div></footer><input id="acCSVFile" type="file" accept=".csv,.txt,text/csv,text/plain" hidden>`;
      document.body.append(this.dialog);
      this.magnitudePlot=new window.LabPlot($('acMagnitudePlot'),p=>$('acMagnitudeReadout').textContent=this.readout(p,false));
      this.phasePlot=new window.LabPlot($('acPhasePlot'),p=>$('acPhaseReadout').textContent=this.readout(p,true));
      this.residualPlot=new window.LabPlot($('acResidualPlot'),p=>$('acResidualReadout').textContent='f = '+F(p.x,'Hz',4)+' · residuo = '+F(p.residual,$('acResidualQuantity').value==='db'?'dB':'°',4));
      for(const plot of [this.magnitudePlot,this.phasePlot,this.residualPlot])plot.controls.hidden=true;
      this.bind();
    }
    readout(cursor,isPhase){
      const p=this.result.points.reduce((best,p)=>Math.abs(Math.log(p.x/cursor.x))<Math.abs(Math.log(best.x/cursor.x))?p:best),f=this.result.fit;
      const unit=isPhase?'°':'dB',value=isPhase?p.continuousPhase:p.db,prediction=f?(isPhase?f.predictPhase(p.x):f.predictDb(p.x)):NaN;
      return 'Misura più vicina · f = '+F(p.x,'Hz',4)+' · dato = '+F(value,unit,4)+' · '+(isPhase?'previsione RC':'fit')+' = '+F(prediction,unit,4);
    }
    async open(){
      try{this.owner=window.RCStudyContext.adapter();this.ctx=await window.RCStudyContext.prepare(this.owner);this.simulationReference=this.owner.free?(this.ctx.acReference==='input'?'input':'source'):'after-generator';this.simulation=this.ctx.voltageGain?this.ctx.bode:[];
        this.state=copy(this.owner.getAC()||{version:1,reference:this.simulationReference,referenceNote:'',from:null,to:null,g0:1,uG0:null,independentReference:false,fit:true,overlay:true,showPhase:true,residualReference:'fit',residualQuantity:'db',dataset:null,stamp:''});
        this.result=null;this.populate();this.dirty=true;$('acResult').hidden=true;$('acEmpty').hidden=false;$('acError').hidden=true;this.disableExports();this.dialog.showModal();
      }catch(e){if(e.name!=='AbortError')window.circuitEditor.note(e.message,true);}
    }
    populate(){
      const s=this.state;
      for(const [id,value]of [['acReference',s.reference],['acReferenceNote',s.referenceNote],['acFrom',s.from??''],['acTo',s.to??''],['acG0',s.g0],['acUG0',s.uG0??''],['acResidualReference',s.residualReference],['acResidualQuantity',s.residualQuantity]])$(id).value=value;
      for(const [id,key]of [['acFit','fit'],['acOverlay','overlay'],['acShowPhase','showPhase'],['acIndependentReference','independentReference']])$(id).checked=s[key];
      const d=s.dataset,f=d?.format;
      $('acDatasetName').value=d?.name||'Misure in frequenza';$('acRaw').value=d?.raw||'';
      for(const [id,key,fallback]of [['acMode','mode','amplitudes'],['acDecimal','decimal',','],['acFrequencyUnit','frequencyUnit','Hz'],['acVoltageUnit','voltageUnit','V'],['acGainUnit','gainUnit','linear'],['acPhaseUnit','phaseUnit','deg'],['acAmplitudeKind','amplitudeKind','vpp']])$(id).value=f?.[key]??fallback;
      $('acDelimiter').value=f?(f.delimiter==='\t'?'tab':f.delimiter):'auto';$('acHeader').value=f?(f.header?'yes':'no'):'auto';$('acIndependentAmplitudes').checked=f?.independentAmplitudes||false;
      this.preview(f?.columns);this.modeControls();$('acImportDetails').open=!d;this.sourceInfo();this.referenceControls();
      $('acContextNote').textContent=(s.stamp&&s.stamp!==this.ctx.stamp&&s.stamp!==this.ctx.legacyStamp?'Il circuito è cambiato: ricontrolla riferimento e intervallo. ':'')+(this.ctx.notice||'Confronto fra dati originali e modelli dichiarati.');$('acSaveNote').textContent='Calcoli sul dispositivo · premi Analizza per conservare le impostazioni.';
    }
    sourceInfo(){$('acSourceInfo').textContent=this.state.dataset?this.state.dataset.name+' · '+this.state.dataset.points.length+' punti originali':'Importa le misure oppure prova la dimostrazione sintetica.';}
    modeControls(){const amplitude=$('acMode').value==='amplitudes';$('acAmplitudeOptions').hidden=!amplitude;$('acGainOptions').hidden=amplitude;$('acIndependentAmplitudesLabel').hidden=!amplitude;}
    columns(){return Object.fromEntries(Object.keys(columnNames).map(k=>[k,$('ac-col-'+k)?($('ac-col-'+k).value===''?null:Number($('ac-col-'+k).value)):null]));}
    preview(saved){
      const previous=saved||this.columns();$('acUseData').disabled=true;
      try{
        if(!$('acRaw').value.trim()){$('acColumnControls').innerHTML='';$('acUncertaintyColumns').innerHTML='';$('acPreview').textContent='Incolla una tabella oppure scegli un file locale.';return;}
        const table=R.rows($('acRaw').value,$('acDelimiter').value==='tab'?'\t':$('acDelimiter').value),labels=table.rows[0],amplitude=$('acMode').value==='amplitudes';
        const keys=['frequency',...(amplitude?['input','output']:['gain']),'phase',...(amplitude?['uInput','uOutput']:['uGain']),'uPhase'];
        const defaults={frequency:0,input:1,output:2,gain:1,phase:null,uInput:null,uOutput:null,uGain:null,uPhase:null};
        const html=k=>`<label class="rc-field" for="ac-col-${k}"><span>${columnNames[k]}</span><select id="ac-col-${k}">${['phase','uInput','uOutput','uGain','uPhase'].includes(k)?'<option value="">Assente</option>':''}${labels.map((l,i)=>`<option value="${i}">${i+1} · ${esc(l.slice(0,30))}</option>`).join('')}</select></label>`;
        $('acColumnControls').innerHTML=keys.filter(k=>!k.startsWith('u')).map(html).join('');$('acUncertaintyColumns').innerHTML=keys.filter(k=>k.startsWith('u')).map(html).join('');
        for(const k of keys){const v=previous[k]??defaults[k];$('ac-col-'+k).value=v!==null&&v<labels.length?String(v):'';}
        $('acPreview').textContent=table.rows.length+' righe · '+labels.length+' colonne. Prima riga: '+labels.slice(0,4).join(' | ');$('acUseData').disabled=false;
      }catch(e){$('acPreview').textContent=e.message;}
    }
    useData(demo=false){
      try{
        if(demo){$('acRaw').value='f_Hz;Vin_Vpp;Vout_Vpp;fase_deg;uVin_V;uVout_V;uFase_deg\n'+A.demo().map(p=>[p.frequency,p.input,p.output,p.phase,p.uInput,p.uOutput,p.uPhase].join(';')).join('\n');$('acDatasetName').value='Dimostrazione AC · dati sintetici';$('acMode').value='amplitudes';$('acDelimiter').value=';';$('acDecimal').value='.';$('acHeader').value='yes';$('acFrequencyUnit').value='Hz';$('acVoltageUnit').value='V';$('acAmplitudeKind').value='vpp';$('acPhaseUnit').value='deg';$('acIndependentAmplitudes').checked=true;this.modeControls();this.preview({frequency:0,input:1,output:2,phase:3,uInput:4,uOutput:5,uPhase:6});$('acG0').value='.96';$('acUG0').value='';$('acOverlay').checked=false;}
        const parsed=A.parseTable($('acRaw').value,{mode:$('acMode').value,delimiter:$('acDelimiter').value==='tab'?'\t':$('acDelimiter').value,decimal:$('acDecimal').value,header:$('acHeader').value,frequencyUnit:$('acFrequencyUnit').value,voltageUnit:$('acVoltageUnit').value,gainUnit:$('acGainUnit').value,phaseUnit:$('acPhaseUnit').value,amplitudeKind:$('acAmplitudeKind').value,independentAmplitudes:$('acIndependentAmplitudes').checked,columns:this.columns()});
        const candidate={...this.state,dataset:{name:$('acDatasetName').value.trim().slice(0,120)||'Misure in frequenza',raw:$('acRaw').value,...parsed},from:parsed.points[0].x,to:parsed.points.at(-1).x};
        $('acFrom').value=candidate.from;$('acTo').value=candidate.to;const next=this.readState(candidate);this.commit(next);this.markDirty();this.sourceInfo();$('acImportDetails').open=false;$('acSaveNote').textContent='Dati associati al progetto · ora premi Analizza i dati.';
      }catch(e){this.error(e.message);}
    }
    value(id,nullable=false){const text=$(id).value.trim();return nullable&&!text?null:R.number(text,',');}
    readState(base=this.state){
      const s={...copy(base),reference:$('acReference').value,referenceNote:$('acReferenceNote').value.trim(),from:this.value('acFrom'),to:this.value('acTo'),g0:this.value('acG0'),uG0:this.value('acUG0',true),independentReference:$('acIndependentReference').checked,fit:$('acFit').checked,overlay:$('acOverlay').checked,showPhase:$('acShowPhase').checked,residualReference:$('acResidualReference').value,residualQuantity:$('acResidualQuantity').value,stamp:this.ctx.stamp};A.validateStudy(s);return s;
    }
    commit(s){
      // A second dataset must still fit the portable 1 MB document before mutation.
      const text=this.owner.snapshot();if(!text)throw new Error('Correggi il valore indicato nel circuito.');Files.checkStudyUpdate(text,'acStudy',s);this.owner.saveAC(s);this.state=copy(s);
    }
    referenceControls(){
      const matches=$('acReference').value===this.simulationReference&&this.simulation.length>0;$('acOverlay').disabled=!matches;
      $('acReferenceHint').textContent=matches?'Simulazione confrontabile: '+refs[this.simulationReference]+(this.owner.free?' · sorgente '+this.ctx.acSource:'')+'.':'Sovrapposizione non disponibile: '+(this.ctx.acError?this.ctx.acError:!this.ctx.bode.length?'il circuito non dispone di un Bode valido.':!this.ctx.voltageGain?'la sorgente AC scelta non definisce un guadagno V/V.':'scegli lo stesso riferimento della simulazione ('+refs[this.simulationReference]+').');
      return matches;
    }
    disableExports(){for(const id of ['acExportSummary','acExportPoints','acExportSVG'])$(id).disabled=true;}
    markDirty(){this.dirty=true;$('acResult').hidden=true;$('acEmpty').hidden=false;$('acError').hidden=true;this.disableExports();$('acSaveNote').textContent='Impostazioni modificate · analizza per aggiornare i risultati.';}
    error(message){$('acError').textContent=message;$('acError').hidden=false;this.disableExports();if(matchMedia('(max-width:650px)').matches)document.querySelector('#acDialog .rc-output').scrollIntoView({block:'start'});}
    calculate(){
      try{
        if(!this.state.dataset)throw new Error('Inserisci prima una tabella di misure in frequenza.');
        const s=this.readState(),result=A.analyze(s.dataset.points,s);this.commit(s);this.result=result;this.dirty=false;this.render();$('acSaveNote').textContent='Analisi associata al progetto · conserva anche una copia JSON.';
        if(matchMedia('(max-width:650px)').matches)document.querySelector('#acDialog .rc-output').scrollIntoView({block:'start'});
      }catch(e){this.error(e.message);}
    }
    comparable(){return this.state.reference===this.simulationReference&&this.simulation.length>0;}
    timeFit(){
      const s=this.owner.get();if(!s||s.stamp!==this.ctx.stamp&&s.stamp!==this.ctx.legacyStamp)return null;
      try{return R.fit(s.source==='experiment'?s.dataset.points:this.ctx.parts[s.segment],{...s,source:s.source});}catch{return null;}
    }
    render(){
      const r=this.result,s=this.state,f=r.fit,c=r.cutoff,simCut=this.comparable()?R.cutoff(this.simulation,this.ctx.dcGain):null,time=this.timeFit();
      $('acError').hidden=true;$('acResult').hidden=false;$('acEmpty').hidden=true;
      $('acContextNote').textContent=s.dataset.name+' · '+refs[s.reference]+(s.referenceNote?' · '+s.referenceNote:'')+' · f = '+F(r.from,'Hz',4)+' → '+F(r.to,'Hz',4);
      const metrics=[['fc dai punti',c?.frequency,c?.uFrequency,'Hz'],['fc dal fit RC',f?.frequency,f?.uFrequency,'Hz'],['τ dal fit RC',f?.tau,f?.uTau,'s'],['Punti originali',r.points.length,null,'']];
      $('acMetrics').innerHTML=metrics.map(([label,v,u,unit])=>`<div><span>${label}</span><strong>${v==null?'—':esc(F(v,unit,5))}</strong><small>${unit===''?'Frequenze nell’intervallo':u==null?'u: non disponibile':'u = '+esc(F(u,unit,3))}</small></div>`).join('');
      const warnings=[...s.dataset.warnings,...r.warnings];if(!this.ctx.onePole&&s.fit)warnings.push('Il circuito attuale non è identificato come RC a un polo: verifica il modello del fit usando i residui.');if(this.comparable()&&(s.overlay||s.residualReference==='simulation')){const missing=r.points.filter(p=>!Number.isFinite(A.interpolate(this.simulation,p.x,'db'))).length;if(missing)warnings.push(missing+' punti fuori dall’intervallo della simulazione: nessuna estrapolazione.');}if(!this.comparable())warnings.push('Simulazione esclusa dal confronto: riferimento differente o guadagno V/V non disponibile.');
      if(s.dataset.format.mode==='amplitudes'&&s.dataset.format.columns.uInput!=null)warnings.push('u(G) da Vin/Vout: assunta indipendenza delle ampiezze, propagazione del primo ordine.');
      if(r.points.some((p,i)=>i&&p.phase!==undefined&&Math.abs(A.wrap(p.phase-r.points[i-1].phase))>120))warnings.push('Salti di fase oltre 120° fra punti: il ramo continuo può essere ambiguo.');
      $('acWarnings').innerHTML=[...new Set(warnings)].map(w=>'<p>'+esc(w)+'</p>').join('');
      $('acFitDetail').textContent=f?'Fit del solo modulo: G₀ = '+F(f.g0,'V/V',5)+' · RMS residui = '+F(f.rms,'dB',4)+(f.reducedChi2===null?'':' · χ²/ν = '+F(f.reducedChi2,'',4)+' (ν = '+f.df+')'):'Nessun fit RC disponibile. La lettura del taglio e i punti restano consultabili.';
      this.rows=[['Guadagno G₀ dichiarato',s.g0,s.uG0,'V/V','Riferimento della lettura a −3,0103 dB'],['fc dai punti',c?.frequency??null,c?.uFrequency??null,'Hz',c?'Interpolazione log(f), fra '+F(c.bracket[0],'Hz')+' e '+F(c.bracket[1],'Hz'):'Nessun attraversamento; nessuna estrapolazione'],['τ equivalente dai punti',c?.tau??null,c?.uFrequency!=null?c.tau*c.uFrequency/c.frequency:null,'s','1/(2πfc) dalla lettura; interpretazione valida per un modello a un polo'],['G₀ dal fit RC',f?.g0??null,f?.uG0??null,'V/V','Parametro stimato dal solo modulo'],['fc dal fit RC',f?.frequency??null,f?.uFrequency??null,'Hz','Modello a un polo; può estrapolare'],['τ equivalente dal fit AC',f?.tau??null,f?.uTau??null,'s','1/(2πfc) del modello RC'],['fc della simulazione',simCut?.frequency??null,null,'Hz',refs[this.simulationReference]],['τ del modello del circuito',this.ctx.reference?.tau??null,null,'s',this.ctx.onePole?'Polo del transitorio':'Costante dominante quando disponibile'],['τ dal fit nel tempo',time?.tau??null,time?.uTau??null,'s',time?'Analisi temporale del progetto; verifica stessa esperienza e possibili correlazioni':'Analizza prima un tratto nel pannello Tempo']];
      $('acComparisonRows').innerHTML=this.rows.map(([l,v,u,unit,note])=>`<tr><th>${esc(l)}</th><td>${v===null?'—':esc(F(v,unit,5))}</td><td>${u===null?'—':esc(F(u,unit,3))}</td><td>${esc(note)}</td></tr>`).join('');
      $('acResidualReference').querySelector('[value=fit]').disabled=!f;$('acResidualReference').querySelector('[value=simulation]').disabled=!this.comparable();
      if(($('acResidualReference').value==='fit'&&!f)||($('acResidualReference').value==='simulation'&&!this.comparable()))$('acResidualReference').value=f?'fit':'simulation';
      $('acResidualQuantity').querySelector('[value=phase]').disabled=r.points[0].phase===undefined;if(r.points[0].phase===undefined)$('acResidualQuantity').value='db';
      this.draw();for(const id of ['acExportSummary','acExportPoints','acExportSVG'])$(id).disabled=false;
    }
    draw(){
      if(!this.result)return;
      const r=this.result,s=this.state,f=r.fit,sim=s.overlay&&this.comparable(),map=new Map(),target=20*Math.log10(s.g0)-10*Math.log10(2),first=Math.log(r.from),span=Math.log(r.to/r.from);
      for(let i=0;i<=240;i++){const x=Math.exp(first+span*i/240);map.set(x,{x});}for(const p of r.points)map.set(p.x,{...p});
      const data=[...map.values()].sort((a,b)=>a.x-b.x).map(p=>({...p,fitDb:f?.predictDb(p.x),fitPhase:f?.predictPhase(p.x),simDb:sim?A.interpolate(this.simulation,p.x,'db'):NaN,simPhase:sim?A.interpolate(this.simulation,p.x,'phase'):NaN,target}));
      const series=[{key:'db',label:'Dati originali',color:'#64748b',points:true,line:false,sigmaKey:'uDb'},...(f?[{key:'fitDb',label:'Fit RC · modulo',color:'#4264ef'}]:[]),...(sim?[{key:'simDb',label:'Simulazione',color:'#149783',dash:'5 4'}]:[]),{key:'target',label:'G₀ / √2 dichiarato',color:'#c59a62',dash:'3 5'}];
      $('acLegend').innerHTML=series.map(t=>`<span><i style="background:${t.color}"></i>${t.label}</span>`).join('');
      const config={data,logX:true,xUnit:'Hz',xLabel:'Frequenza',noZero:true,guides:r.cutoff?[{x:r.cutoff.frequency,label:'fc dai punti'}]:[]};
      this.magnitudePlot.set({...config,yUnit:'dB',series});
      const hasPhase=r.points[0].phase!==undefined;$('acPhaseSection').hidden=!s.showPhase||(!hasPhase&&!f&&!sim);$('acCurves').classList.toggle('single',$('acPhaseSection').hidden);
      $('acPhaseNote').textContent=hasPhase?'Fase su ramo continuo; primo punto in [−180°, 180°). Blu: previsione del fit del modulo.':'Fase non fornita: le curve visibili sono soltanto previsioni dei modelli.';
      if(s.showPhase)this.phasePlot.set({...config,yUnit:'°',series:[{key:'continuousPhase',label:'Fase misurata',color:'#64748b',points:true,line:false,sigmaKey:'uPhase'},...(f?[{key:'fitPhase',label:'Previsione RC',color:'#4264ef'}]:[]),...(sim?[{key:'simPhase',label:'Simulazione',color:'#149783',dash:'5 4'}]:[])]});
      const ref=$('acResidualReference').value,quantity=$('acResidualQuantity').value,usable=ref==='fit'?Boolean(f):this.comparable();$('acResidualDetails').hidden=!usable;
      if(usable){const residuals=r.points.map(p=>{const expected=ref==='fit'?(quantity==='db'?f.predictDb(p.x):f.predictPhase(p.x)):A.interpolate(this.simulation,p.x,quantity);return{...p,residual:quantity==='db'?p.db-expected:p.phase===undefined?NaN:A.wrap(p.phase-expected),u:quantity==='db'?p.uDb:p.uPhase};});this.residualPlot.set({...config,data:residuals,yUnit:quantity==='db'?'dB':'°',noZero:false,series:[{key:'residual',label:'Residuo',color:'#b07831',points:true,line:false,sigmaKey:'u'}]});if(residuals.every(p=>!Number.isFinite(p.residual)))$('acResidualReadout').textContent='Nessun confronto disponibile nell’intervallo: controlla frequenze, fase e riferimento.';}
    }
    download(text,mime,name){const link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:mime}));link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('acSaveNote').textContent='Download richiesto: '+name+'. La destinazione dipende dal browser.';}
    summaryCSV(){
      const s=this.state,r=this.result,f=r.fit;
      return R.csv([['grandezza','valore_SI','u_standard_SI','unita','metodo_o_ipotesi'],...this.rows,['origine_dati',null,null,'',s.dataset.name],['riferimento_ingresso',null,null,'',refs[s.reference]+' · '+s.referenceNote],['inizio_intervallo',r.from,null,'Hz','Primo punto originale incluso'],['fine_intervallo',r.to,null,'Hz','Ultimo punto originale incluso'],['numero_punti',r.points.length,null,'1','Osservazioni originali'],['soglia_dB',20*Math.log10(s.g0)-10*Math.log10(2),null,'dB','Rispetto a G0 dichiarato'],['indipendenza_G0_punti',null,null,'',s.independentReference?'Assunta':'Non assunta'],['RMS_residui_modulo',f?.rms??null,null,'dB','Descrittivo; fit solo modulo'],['chi2_ridotto_modulo',f?.reducedChi2??null,null,'1','u(G) assolute; frequenze esatte; errori indipendenti'],['ipotesi_incertezze',null,null,'','Propagazione del primo ordine; frequenze esatte; sistematici e correlazioni non inclusi; covarianza del fit non riscalata'],['convenzione_ampiezze',null,null,'',s.dataset.format.mode==='amplitudes'?s.dataset.format.amplitudeKind:'Guadagno fornito'],['formato_ingresso',null,null,'',s.dataset.format.mode+'; f in '+s.dataset.format.frequencyUnit+(s.dataset.format.mode==='amplitudes'?'; tensioni in '+s.dataset.format.voltageUnit:'; G in '+s.dataset.format.gainUnit)],['indipendenza_Vin_Vout',null,null,'',s.dataset.format.independentAmplitudes?'Assunta':'Non assunta o non usata'],['gradi_liberta_fit',f?.df??null,null,'1','Fit di due parametri sul modulo'],['riferimento_circuito',null,null,'',s.stamp],['nota_circuito',null,null,'',this.ctx.notice],...s.dataset.warnings.concat(r.warnings).map(w=>['nota',null,null,'',w])]);
    }
    pointsCSV(){
      const s=this.state,r=this.result,f=r.fit,sim=this.comparable();
      return R.csv([['f_Hz','Vin_V','Vout_V','uVin_V','uVout_V','G_V_V','G_dB','uG_dB','fase_originale_deg','uFase_deg','fase_continua_deg','fit_modulo_dB','residuo_modulo_fit_dB','fase_prevista_RC_deg','residuo_fase_RC_deg','sim_modulo_dB','sim_fase_deg','residuo_modulo_sim_dB','residuo_fase_sim_deg'],...r.points.map(p=>{const db=f?.predictDb(p.x),ph=f?.predictPhase(p.x),sd=sim?A.interpolate(this.simulation,p.x,'db'):NaN,sp=sim?A.interpolate(this.simulation,p.x,'phase'):NaN;return[p.x,p.input,p.output,p.uInput,p.uOutput,p.gain,p.db,p.uDb,p.phase,p.uPhase,p.continuousPhase,db,p.db-db,ph,p.phase===undefined?null:A.wrap(p.phase-ph),sd,sp,p.db-sd,p.phase===undefined?null:A.wrap(p.phase-sp)];})]);
    }
    exportSVG(){
      const plots=[$('acMagnitudePlot'),...(this.state.showPhase?[$('acPhasePlot')]:[])],width=Math.max(900,...plots.map(p=>p.viewBox.baseVal.width)),height=plots.reduce((s,p)=>s+p.viewBox.baseVal.height+34,90);let y=90;
      const header=`<rect width="100%" height="100%" fill="white"/><style>text{font-family:Arial,sans-serif;font-size:10px;fill:#64748b}</style><text x="18" y="23" style="font-size:14px">Misure in frequenza RC · ${esc(this.state.dataset.name)}</text><text x="18" y="43">${esc(refs[this.state.reference])} · ${esc(F(this.result.from,'Hz'))} → ${esc(F(this.result.to,'Hz'))}</text><text x="18" y="63">Grigio: dati · Blu: fit modulo / fase prevista · Verde: simulazione (se attiva) · Ambra: G0/√2 dichiarato</text>`;
      const body=plots.map((p,i)=>{const v=p.viewBox.baseVal,part=`<text x="18" y="${y-8}">${i?'Fase Vout − Vin':'Modulo del guadagno'}</text><g transform="translate(0 ${y})">${p.innerHTML}</g>`;y+=v.height+34;return part;}).join('');this.download(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${header}${body}</svg>`,'image/svg+xml','rc-bode-misure.svg');
    }
    bind(){
      document.addEventListener('click',e=>{if(e.target.closest('[data-open-ac]')){if(window.rcWorkbench.dialog.open)window.rcWorkbench.dialog.close();this.open();}});
      $('acClose').addEventListener('click',()=>this.dialog.close());$('acReturnSettings').addEventListener('click',()=>document.querySelector('#acDialog .rc-controls').scrollIntoView({block:'start'}));$('acCompute').addEventListener('click',()=>this.calculate());
      this.dialog.addEventListener('click',e=>{const reset=e.target.closest('[data-ac-reset]');if(reset)(reset.dataset.acReset==='phase'?this.phasePlot:this.magnitudePlot).fit();});
      this.dialog.addEventListener('input',e=>{if(['acResidualReference','acResidualQuantity'].includes(e.target.id))return;if(e.target.closest('.rc-import')){if(e.target.id==='acRaw'){clearTimeout(this.previewTimer);this.previewTimer=setTimeout(()=>this.preview(),200);}return;}this.markDirty();});
      this.dialog.addEventListener('change',e=>{const id=e.target.id;if(e.target.closest('.rc-import')){if(id==='acMode'){this.modeControls();this.preview();}if(['acDelimiter','acDecimal','acHeader'].includes(id))this.preview();return;}
        if(['acResidualReference','acResidualQuantity'].includes(id)){if(!this.dirty){try{this.commit({...this.state,residualReference:$('acResidualReference').value,residualQuantity:$('acResidualQuantity').value});this.draw();}catch(error){this.error(error.message);}}return;}
        if(id==='acReference')this.referenceControls();this.markDirty();});
      $('acUseData').addEventListener('click',()=>this.useData());$('acDemo').addEventListener('click',()=>this.useData(true));$('acChooseCSV').addEventListener('click',()=>$('acCSVFile').click());
      $('acCSVFile').addEventListener('change',async()=>{const file=$('acCSVFile').files[0];if(!file)return;try{if(file.size>200000)throw new Error('Scegli un CSV di massimo 200 kB.');$('acRaw').value=await file.text();$('acDatasetName').value=file.name.slice(0,120);this.preview();}catch(e){this.error(e.message);}finally{$('acCSVFile').value='';}});
      $('acExportSummary').addEventListener('click',()=>{if(!this.dirty&&this.result)this.download(this.summaryCSV(),'text/csv;charset=utf-8','rc-ac-misure.csv');});$('acExportPoints').addEventListener('click',()=>{if(!this.dirty&&this.result)this.download(this.pointsCSV(),'text/csv;charset=utf-8','rc-ac-dati-residui.csv');});$('acExportSVG').addEventListener('click',()=>{if(!this.dirty&&this.result)this.exportSVG();});
    }
  }
  window.acWorkbench=new ACWorkbench();
})();
