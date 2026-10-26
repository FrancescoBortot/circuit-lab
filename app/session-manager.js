(() => {
 'use strict';
 const L=window.LabModel,T=window.GuidedTrials,S=window.SessionFiles,F=window.LabFiles,$=id=>document.getElementById(id),esc=F.esc;
 class Repository{
  constructor(){this.ready=new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('Archivio browser non disponibile.'));return;}const request=indexedDB.open('circuit-lab-sessions-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('trials',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Chiudi le altre schede per aggiornare l’archivio.'));request.onsuccess=()=>{this.db=request.result;this.db.onversionchange=()=>this.db.close();resolve(this.db);};});}
  async all(){const db=await this.ready;return new Promise((resolve,reject)=>{const q=db.transaction('trials','readonly').objectStore('trials').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async put(record){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction('trials','readwrite');tx.objectStore('trials').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Salvataggio browser interrotto.'));});}
 }
 class Sessions{
  constructor(){
   this.records=new Map();this.serial=Promise.resolve();this.repository=new Repository();this.folder=null;this.busy=false;this.storageWarning='';
   this.ready=this.repository.all().then(records=>{for(const r of records){try{const d=L.parse(r.text);if(d.session&&r.id===S.key(d))this.records.set(r.id,r);}catch{this.storageWarning='Una prova non leggibile è stata esclusa dall’archivio.';}}}).catch(()=>{this.storageWarning='Archivio browser non disponibile: conserva la sessione con ZIP o nella cartella scelta.';});
   const panel=document.createElement('section');panel.id='guidedSessionPanel';panel.className='session-panel';panel.innerHTML=`<h3>Prove della sessione</h3><p id="sessionStatus" role="status"></p><div class="session-actions"><button class="button primary" id="sessionSaveNow">Salva sessione</button><button class="button" id="sessionSaveZIP">Scarica ZIP</button><button class="button" id="sessionChooseFolder">Scegli cartella…</button></div><p id="sessionDestination" class="session-hint"></p><details><summary id="sessionTrialSummary">Prove salvate</summary><div id="sessionTrials"></div></details><details><summary>Altre sessioni e nuova sessione</summary><label class="project-label" for="sessionNewName">Nome della nuova sessione</label><div class="session-actions"><input id="sessionNewName" maxlength="80" placeholder="Esempio: Laboratorio 26 ottobre"><button class="button" id="sessionNew">Inizia</button></div><p class="session-hint">La nuova sessione parte dal circuito corrente. Le precedenti restano nell’elenco.</p><div id="sessionList"></div></details>`;
   $('projectDialog').querySelector('.project-file-card').before(panel);
   $('sessionOptions').addEventListener('click',()=>window.ProjectPanel.show());
   $('sessionSaveNow').addEventListener('click',()=>this.save());$('sessionSaveZIP').addEventListener('click',()=>this.save(true));
   $('sessionChooseFolder').addEventListener('click',()=>this.chooseFolder());
   $('sessionNew').addEventListener('click',()=>{if(this.busy)return;const name=$('sessionNewName').value.trim();if(!name){$('sessionStatus').textContent='Scrivi prima il nome della sessione.';return;}if(window.GuidedLab.startSession(name)){this.folder=null;window.ProjectPanel.show();this.serial.then(()=>this.render());}});
   panel.addEventListener('click',e=>{const button=e.target.closest('[data-session-record]');if(!button||this.busy)return;const r=this.records.get(button.dataset.sessionRecord);if(!r)return;try{const d=L.parse(r.text),current=window.GuidedLab.document();if(d.session.id===current.session?.id)d.name=current.name;window.ProjectPanel.importText(L.serialize(d));this.note('Prova riaperta: '+(r.trial.label||r.trial.circuit));}catch(error){this.note(error.message,true);}});
   document.addEventListener('guided-lab-state',e=>this.capture(e.detail));
   document.addEventListener('project-panel-opened',()=>{this.ready.then(()=>this.render());});
   document.addEventListener('circuit-lab-mode',()=>this.mode());
   this.ready.then(()=>{this.mode();if(!window.circuitEditor.active)this.capture(window.GuidedLab.sessionState());});
  }
  note(message,error=false){this.lastMessage=message;window.circuitEditor.note(message,error);if($('projectDialog').open)$('sessionStatus').textContent=message;}
  mode(){const free=window.circuitEditor.active;$('projectNameLabel').textContent=free?'CIRCUITO':'SESSIONE';$('projectName').setAttribute('aria-label',free?'Nome del circuito':'Nome della sessione');$('saveProject').querySelector('span').textContent=free?'Progetto e copie':'Salva sessione';$('saveProject').setAttribute('aria-label',free?'Progetto e copie':'Salva sessione');if(free)$('saveProject').setAttribute('aria-haspopup','dialog');else $('saveProject').removeAttribute('aria-haspopup');$('guidedSessionPanel').hidden=free;}
  capture(detail){
   if(!detail)return this.serial;
   this.serial=this.serial.then(async()=>{await this.ready;const doc=L.parse(detail.text);if(!doc.session)return;const key=S.key(doc),record=S.capture(this.records.get(key),detail.text,detail.result);this.records.set(key,record);this.lastMessage='';try{await this.repository.put(record);}catch{this.storageWarning='Le prove restano aperte, ma l’archivio browser non è disponibile: salva ZIP o cartella.';}if($('projectDialog').open)this.render();}).catch(error=>{this.storageWarning=error.message;this.note('Salvataggio della prova non riuscito: '+error.message,true);});return this.serial;
  }
  render(){
   this.mode();if(window.circuitEditor.active)return;const doc=window.GuidedLab.document(),records=[...this.records.values()].filter(r=>r.sessionId===doc.session?.id).sort((a,b)=>a.experiment.localeCompare(b.experiment)||a.trial.label.localeCompare(b.trial.label));
   $('sessionStatus').textContent=this.lastMessage||this.storageWarning||records.length+(records.length===1?' prova conservata':' prove conservate')+' nel browser. Salva la sessione per avere anche i file sul computer.';
   $('sessionTrialSummary').textContent='Prove salvate ('+records.length+')';
   const entry=r=>'<button class="session-record" data-session-record="'+esc(r.id)+'"><strong>'+esc(r.trial.circuit)+'</strong><span>'+esc(r.trial.label||'Senza prova guidata')+(r.trial.modified?' · personalizzata':'')+'</span></button>';
   $('sessionTrials').innerHTML=records.map(entry).join('')||'<p class="session-hint">Scegli una prova o modifica il circuito per iniziare.</p>';
   const sessions=new Map();for(const r of this.records.values()){const last=sessions.get(r.sessionId);if(!last||last.updatedAt<r.updatedAt)sessions.set(r.sessionId,r);}
   $('sessionList').innerHTML=[...sessions.values()].filter(r=>r.sessionId!==doc.session?.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(r=>'<button class="session-record" data-session-record="'+esc(r.id)+'"><strong>'+esc(r.sessionName)+'</strong><span>Riapri la sessione</span></button>').join('')||'<p class="session-hint">Nessun’altra sessione conservata.</p>';
   const supported=typeof window.showDirectoryPicker==='function'&&window.isSecureContext;$('sessionChooseFolder').disabled=!supported||this.busy;
   $('sessionDestination').textContent=this.folder?'Cartella collegata: '+this.folder.name+'. Salva sessione crea la cartella della sessione e le sottocartelle dei circuiti.':supported?'Scegli una cartella per salvare direttamente i file; altrimenti Salva sessione scarica uno ZIP con le stesse cartelle.':'Questo browser usa lo ZIP: estraendolo ottieni la cartella della sessione con le sottocartelle dei circuiti.';
   for(const id of ['sessionSaveNow','sessionSaveZIP','sessionNew'])$(id).disabled=this.busy;
  }
  async chooseFolder(){
   if(typeof window.showDirectoryPicker!=='function')return;
   try{const handle=await window.showDirectoryPicker({id:'circuit-lab-sessions',mode:'readwrite'});this.folder=handle;this.render();this.note('Cartella collegata. Premi Salva sessione per creare i file.');}
   catch(error){if(error.name!=='AbortError')this.note('Cartella non collegata. Puoi usare Scarica ZIP.',true);}
  }
  async save(forceZIP=false){
   if(this.busy)return;const text=window.GuidedLab.snapshot();if(!text){this.note('Correggi il valore indicato prima di salvare.',true);return;}
   const doc=L.parse(text);this.busy=true;this.render();$('saveProject').disabled=true;
   try{
    await this.capture(window.GuidedLab.sessionState()||{text});await this.serial;
    try{for(const r of await this.repository.all()){const old=this.records.get(r.id);if(!old||r.updatedAt>old.updatedAt)this.records.set(r.id,r);}}catch{}
    const records=[...this.records.values()].filter(r=>r.sessionId===doc.session.id),bundle=S.bundle(records,doc.name,doc.session);this.note('Preparazione dei file della sessione…');
    if(this.folder&&!forceZIP){const count=await S.writeDirectory(this.folder,bundle.files,(n,total)=>{$('sessionStatus').textContent='Salvataggio nella cartella: '+n+' / '+total;});this.note(count+' file salvati nella cartella '+bundle.root+'.');}
    else{const bytes=F.zipSession(bundle.files);window.circuitEditor.download(bytes,'application/zip',T.slug(doc.name,60)+'-sessione.zip');this.note('ZIP della sessione preparato; download richiesto al browser.');}
   }catch(error){this.note('Sessione non esportata: '+error.message+' Le copie nel browser restano disponibili.',true);}
   finally{this.busy=false;this.mode();$('saveProject').disabled=false;this.render();}
  }
 }
 window.GuidedSessions=new Sessions();
})();
