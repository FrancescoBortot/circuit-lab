/* Independent time/AC context for the measurement panels.
   A failed transient must not hide a valid small-signal frequency response. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./lab-model.js'),require('./rc-analysis.js'),require('./local-projects.js'));
  else root.StudyContext=factory(root.FreeModel,root.LabModel,root.RCAnalysis,root.LocalProjects);
})(typeof globalThis!=='undefined'?globalThis:this,function(Free,Lab,RC,Files){
  'use strict';
  const digest=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);};
  function signature(doc){
    // Position, wire routing and the active plot do not change the circuit.
    const components=doc.components.map(({x,y,rotation,...c})=>c).sort((a,b)=>a.id.localeCompare(b.id));
    const wires=doc.wires.map(w=>[w.a,w.b].sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const {analysis,...settings}=doc.settings;
    return'free-'+digest(JSON.stringify({components,wires,probes:doc.probes,settings}));
  }
  function stamp(doc){
    if(doc.mode==='free')return signature(doc);
    const type=Lab.CATALOG.find(c=>c.id===doc.experiment)?.type;
    if(!type||!doc.circuits?.[type])throw new Error('Esperienza non riconosciuta.');
    return'guided-'+digest(JSON.stringify(doc.circuits[type]));
  }
  function build(text){
    const raw=Files.readJSON(text),free=raw.mode==='free',doc=free?Free.parse(text):Lab.parse(text);
    const out={points:[],parts:[],bode:[],reference:null,dcGain:null,onePole:false,voltageGain:false,acSource:null,name:doc.name,stamp:'',notice:'',timeError:null,acError:null};
    if(free){
      out.stamp=stamp(doc);out.legacyStamp='free-'+digest(JSON.stringify({components:doc.components,wires:doc.wires,probes:doc.probes,settings:doc.settings}));
      const issues=Free.issues(doc);
      if(issues.length){out.notice=issues[0]+' Puoi comunque analizzare dati sperimentali.';return out;}
      out.reference=RC.simpleReference(doc,Free.topology(doc));out.onePole=Boolean(out.reference);out.dcGain=out.reference?.dcGain??null;
      try{out.points=Free.simulate(doc).data.map(p=>({x:p.x,y:p.out}));}catch(e){out.timeError=e.message;}
      try{const result=Free.bode(doc);out.bode=result.data;out.acSource=result.source;out.acReference=result.reference;out.voltageGain=result.unit==='V/V'&&(result.reference==='input'||(!doc.settings.acWeights||Object.entries(doc.settings.acWeights).filter(([,v])=>v!==0).length===1&&doc.settings.acWeights[result.source]===1)&&!(doc.settings.acPhases?.[result.source]%360));if(result.unit==='V/V'&&!out.voltageGain)out.referenceNotice='I fasori AC hanno un riferimento unitario globale. Per confrontare Vout/Vin misurati scegli OUT / IN, oppure una sola sorgente con peso 1 e fase 0.';}catch(e){out.acError=e.message;}
      const notes=[];if(out.referenceNotice)notes.push(out.referenceNotice);
      if(out.timeError)notes.push('Transitorio non disponibile: '+out.timeError);
      if(out.acError)notes.push('Bode non disponibile: '+out.acError);
      if(!out.onePole)notes.push('Rete libera: una sola τ può essere un’approssimazione. R e C del confronto vanno indicati esplicitamente.');
      if(out.timeError||out.acError)notes.push('Le analisi disponibili e i dati sperimentali restano utilizzabili.');
      out.notice=notes.join(' ');
    }else{
      const catalog=Lab.CATALOG.find(c=>c.id===doc.experiment),p=doc.circuits[catalog.type];
      if(p.type!=='rc')throw new Error('Apri l’esperienza RC per usare questo pannello.');
      out.stamp=stamp(doc);out.reference={R:p.R,C:p.C,tau:Lab.rcSummary(p).tau};out.onePole=Lab.system(p).n===1;out.voltageGain=true;out.acSource='V₁';
      try{out.points=Lab.simulate(p).map(p=>({x:p.x,y:p.out}));}catch(e){out.timeError=e.message;}
      try{out.bode=Lab.bode(p);out.dcGain=Lab.response(p,0).magnitude;}catch(e){out.acError=e.message;}
      out.notice=out.onePole?'Vout è misurata rispetto a massa. Il transitorio è eccitato da Vg; il taglio AC è riferito a Vout/V₁, dopo Rg: le τ possono differire. R·C usa i soli valori R e C del confronto.':'Gli strumenti introducono più stati dinamici: τ del fit è equivalente sull’intervallo scelto. Il taglio è riferito a Vout/V₁, dopo la resistenza del generatore.';
      if(out.timeError)out.notice+=' Transitorio non disponibile: '+out.timeError;
      if(out.acError)out.notice+=' Bode non disponibile: '+out.acError;
    }
    out.parts=RC.segments(out.points);return out;
  }
  return{build,signature,stamp};
});
