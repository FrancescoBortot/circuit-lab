(() => {
  'use strict';
  const Files=window.LocalProjects,$=id=>document.getElementById(id);
  const active=()=>window.circuitEditor.active?window.circuitEditor:window.GuidedLab;
  const snapshot=()=>active().snapshot();
  const notice=(message,error=false)=>{
    clearTimeout(notice.timer);$('toast').textContent=message;$('toast').hidden=false;$('toast').classList.toggle('error',error);notice.timer=setTimeout(()=>$('toast').hidden=true,error?6500:4000);
  };
  const dialog=document.createElement('dialog');dialog.id='projectDialog';dialog.setAttribute('aria-labelledby','projectDialogTitle');
  dialog.innerHTML=`<div class="dialog-heading"><div><span class="inspector-eyebrow">PROGETTO E COPIE</span><h2 id="projectDialogTitle">Il tuo lavoro, sul tuo dispositivo.</h2></div><button class="icon-button" id="projectDialogClose" aria-label="Chiudi progetto e copie">×</button></div>
    <p class="local-project-badge">● Locale · calcoli e dati sul dispositivo</p>
    <label class="project-label" for="projectCopyName">Nome del progetto</label><input class="project-copy-name" id="projectCopyName" maxlength="80">
    <p id="projectContents" class="project-contents"></p>
    <div class="local-copy-card"><strong id="projectStorageTitle"></strong><p id="projectStorageDetail"></p></div>
    <div class="project-file-card"><strong>Una copia da conservare</strong><p>Il file JSON contiene il circuito, le impostazioni e gli eventuali dati RC nel tempo e in frequenza e delle misure degli operazionali. Puoi riaprirlo qui, anche offline, oppure trasferirlo su un altro computer.</p><button class="button primary" id="projectDownload">↓ Scarica copia JSON</button><p id="projectDownloadStatus" class="project-feedback" role="status"></p></div>
    <button class="button project-lab-open" data-open-parameters>Scansioni e tolleranze · Monte Carlo</button><button class="button project-lab-open" data-open-lab>Dati, incertezze, relazione e archivio</button><details class="project-recovery"><summary>Apri un progetto o recupera una copia</summary><button class="button" id="projectChooseFile">Apri file JSON</button><div class="previous-copy"><p id="projectPreviousDescription"></p><button class="button" id="projectRecover">Recupera copia precedente</button></div></details>
    <details><summary>Contenuto JSON e apertura da testo</summary><p>Il JSON è un documento di dati. L’apertura controlla il formato prima di modificare il progetto corrente.</p><label class="project-label" for="projectJSON">Contenuto della copia attuale</label><textarea id="projectJSON" readonly spellcheck="false" aria-label="JSON del progetto corrente"></textarea><label class="project-label" for="projectPaste">Incolla un progetto JSON da aprire</label><textarea id="projectPaste" spellcheck="false" maxlength="1000000" placeholder="Incolla qui il contenuto del tuo file JSON"></textarea><button class="button" id="projectOpenText">Controlla e apri</button><p id="projectImportError" class="project-import-error" role="alert" hidden></p></details>
    <details><summary>Come funziona in locale</summary><p>Il simulatore usa soltanto i file inclusi nella cartella. Non richiede account e non invia circuiti o misure a servizi esterni. Le connessioni di rete effettuate dagli script sono bloccate dalla pagina.</p><p>Il recupero automatico appartiene a questo browser e a questa posizione dell’app. Può essere rimosso dalle impostazioni del browser: il file JSON è la copia portabile da conservare. I collegamenti alla documentazione esterna si aprono soltanto se li scegli.</p></details>`;
  document.body.append(dialog);
  function refresh(text){
    const doc=Files.readJSON(text),editor=window.circuitEditor.active,state=editor?active().storageState:active().storageState();
    document.querySelector('label[for=projectCopyName]').textContent=editor?'Nome del circuito':'Nome della sessione';$('projectCopyName').value=doc.name||'Il mio laboratorio';$('projectJSON').value=text;
    $('projectContents').textContent=editor?doc.components.length+' componenti · '+doc.wires.length+' fili · '+(doc.traces||[]).length+' sonde aggiuntive · vista e cursori inclusi':Object.keys(doc.circuits).length+' circuiti guidati · valori, segnali e disposizioni inclusi';
    if(doc.rcStudy)$('projectContents').textContent+=' · analisi RC'+(doc.rcStudy.dataset?' e '+doc.rcStudy.dataset.points.length+' punti originali':'')+' incluse';
    if(doc.opampStudy)$('projectContents').textContent+=' · '+doc.opampStudy.points.length+' misure operazionali incluse';
    if(doc.acStudy)$('projectContents').textContent+=' · analisi AC'+(doc.acStudy.dataset?' e '+doc.acStudy.dataset.points.length+' punti originali':'')+' incluse';
    $('projectStorageTitle').textContent=state.ok?'Recupero automatico aggiornato':'Copia automatica non disponibile';
    $('projectStorageDetail').textContent=state.ok?'Una copia viene conservata nella memoria di questo browser. Scarica il JSON per avere anche un file indipendente.':'Il progetto resta aperto in questa sessione. Scarica il JSON per conservarlo prima di chiudere.';
    const previous=editor?active().store.previous():null,hasPrevious=editor?Boolean(previous):active().hasPrevious();
    $('projectRecover').disabled=!hasPrevious;$('projectPreviousDescription').textContent=hasPrevious?'È disponibile una copia precedente'+(previous?.name?' di “'+previous.name+'”':'')+'. Il progetto attuale viene conservato prima del recupero.':'La copia precedente sarà disponibile dopo una modifica o una sostituzione di un progetto già memorizzato.';
  }
  function show(){
    try{const text=snapshot();if(!text){notice('Correggi il valore indicato prima di preparare una copia.',true);return;}
    refresh(text);$('projectDownloadStatus').textContent='';$('projectImportError').hidden=true;$('projectPaste').value='';if(!dialog.open)dialog.showModal();document.dispatchEvent(new Event('project-panel-opened'));}catch(error){notice(error.message+' Il progetto resta aperto.',true);}
  }
  function importText(text){
    const data=Files.readJSON(text),free=window.circuitEditor.isProject(data);
    // Parse the whole incoming circuit before touching either workspace.
    if(free)window.FreeModel.parse(text);else window.LabModel.parse(text);
    if(!snapshot())throw new Error('Correggi il valore indicato nel progetto attuale prima di aprirne un altro.');
    if(free)window.circuitEditor.load(text);else window.GuidedLab.load(text);
    if(dialog.open)dialog.close();return true;
  }
  $('projectDialogClose').addEventListener('click',()=>dialog.close());
  $('saveStatus').addEventListener('click',show);
  $('projectCopyName').addEventListener('change',()=>{$('projectName').value=$('projectCopyName').value.trim()||'Circuito senza titolo';$('projectName').dispatchEvent(new Event('change'));const text=snapshot();if(text)refresh(text);});
  $('projectDownload').addEventListener('click',()=>{
    $('projectName').value=$('projectCopyName').value.trim()||'Circuito senza titolo';$('projectName').dispatchEvent(new Event('change'));
    const text=snapshot();if(!text)return;refresh(text);const doc=Files.readJSON(text),name=window.circuitEditor.active?Files.fileName(doc.name):window.SessionFiles.fileName(doc),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('projectDownloadStatus').textContent='Download richiesto: '+name+'. La destinazione dipende dalle impostazioni dei download del browser.';
  });
  $('projectChooseFile').addEventListener('click',()=>$('projectFile').click());
  $('projectRecover').addEventListener('click',()=>{if(!snapshot())return;active().recoverPrevious();dialog.close();});
  $('projectOpenText').addEventListener('click',()=>{try{importText($('projectPaste').value);}catch(error){$('projectImportError').textContent=error.message+' Il progetto corrente è conservato.';$('projectImportError').hidden=false;}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!window.circuitEditor.active&&window.GuidedSessions)window.GuidedSessions.save();else show();}});
  window.ProjectPanel={show,importText,updateStudies:update=>{const text=snapshot();if(!text)throw Error('Correggi prima il circuito.');if(window.circuitEditor.active){const e=window.circuitEditor,checked=window.FreeModel.parse(JSON.stringify({...Files.readJSON(text),...update}));for(const k of Object.keys(update))e.doc[k]=checked[k];e.persist();}else window.GuidedLab.updateStudies(update);}};
})();
