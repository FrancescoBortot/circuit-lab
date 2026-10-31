/* Explicit model assumptions; a named seed never claims a full vendor macromodel. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModelInfo=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ST={name:'ST TL082 · valori tipici parziali',source:'https://www.st.com/resource/en/datasheet/tl082.pdf',values:{opamp:'physical',a0:200000,gbw:4e6,slew:16e6,positive:15,negative:-15,rail:15,headroom:1.5,rout:50,ilimit:.02},notice:'GBW e slew rate sono valori tipici di riferimento ST; Rout = 50 Ω e Imax = 20 mA sono ipotesi generiche modificabili. Non è un macromodello del costruttore.'};
 function describe(doc){
  const semiconductors=doc.components.some(c=>['D','Q','M'].includes(c.type)),amps=doc.components.filter(c=>c.type==='U'),modes=[...new Set(amps.map(c=>c.model))];
  const included=['R, C e L ideali'];if(semiconductors)included.push('semiconduttori secondo i parametri e le leggi dei modelli selezionati');if(modes.includes('ideal'))included.push('operazionale ideale');if(modes.some(m=>m!=='ideal'))included.push('guadagno finito, polo dominante, saturazione');if(modes.includes('physical'))included.push('slew rate, resistenza e limite di corrente d’uscita');
  if(doc.benchSetup?.config?.mode==='real')included.push('carico di generatore, cavi e sonde secondo i parametri scelti');
  const excluded=['parassiti della basetta non estratti dalla geometria'];if(amps.length)excluded.push('rumore, offset, correnti di bias, CMRR intrinseco e recupero reale dalla saturazione');
  return{title:!amps.length?(semiconductors?'Semiconduttori · modelli semplificati':'Rete passiva ideale'):modes.every(m=>m==='ideal')?'Operazionale ideale':modes.every(m=>m==='physical')?'Operazionale fisico semplificato · generico':'Operazionale a banda finita · generico',included,excluded,notice:amps.length?'La sigla TL082 sul disegno identifica il contenitore e il pinout. Il calcolo usa le ipotesi elencate qui.':(semiconductors?'I semiconduttori sono modelli semplificati e non identificano un dispositivo commerciale. ':'')+'I componenti passivi sono modelli ideali. Cavi e strumenti entrano nel calcolo solo quando esplicitamente configurati.'};
 }
 return{describe,profiles:{stTL082:ST}};
});
