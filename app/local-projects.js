/* Data-only local files and recoverable browser storage. No network or code execution. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./ac-analysis.js'),require('./opamp-analysis.js'),require('./metrology.js'),require('./assembly-guide.js'),require('./comparison-data.js'));
  else root.LocalProjects=factory(root.ACAnalysis,root.OpampAnalysis,root.Metrology,root.AssemblyGuide,root.ComparisonData);
})(typeof globalThis!=='undefined'?globalThis:this,function(AC,OP,Meta,Assembly,Comparison){
  'use strict';
  const MAX_BYTES=1000000,record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function readJSON(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Il progetto supera il limite di 1 MB.');
    let value;try{value=JSON.parse(text);}catch{throw new Error('Il file non contiene JSON valido.');}
    if(!record(value))throw new Error('Il file non contiene un progetto.');
    const queue=[[value,0]];let count=0;
    while(queue.length){
      const [item,depth]=queue.pop();
      if(depth>24||++count>30000)throw new Error('La struttura del progetto è troppo complessa.');
      if(item&&typeof item==='object')for(const [key,child]of Object.entries(item)){
        if(['__proto__','constructor','prototype'].includes(key))throw new Error('Il progetto contiene un campo non consentito: '+key+'.');
        if(typeof child==='number'&&!Number.isFinite(child))throw new Error('Il progetto contiene un numero fuori intervallo.');
        if(child&&typeof child==='object')queue.push([child,depth+1]);
      }
    }
    return value;
  }
  function checkComparison(s){Comparison.validateStudy(s);}
  function checkAssembly(s){Assembly.validate(s);}
  function checkWorkspace(w){
    if(w===undefined)return;
    const fail=()=>{throw new Error('Le impostazioni della vista del progetto non sono valide.');};
    if(!record(w))fail();
    for(const k of ['labels','auto','expanded','inspectorOpen','measureWindow'])if(w[k]!==undefined&&typeof w[k]!=='boolean')fail();
    if(w.sweepXAxis!==undefined&&!['source','output'].includes(w.sweepXAxis))fail();
    if(w.panel!==undefined&&!['component','analysis','probes'].includes(w.panel))fail();
    if(w.canvas!==undefined){const v=w.canvas;if(!record(v)||!['x','y','w','h'].every(k=>Number.isFinite(v[k]))||Math.abs(v.x)>100000||Math.abs(v.y)>100000||v.w<1||v.h<1||v.w>100000||v.h>100000)fail();}
    if(w.quantity!==undefined){if(!record(w.quantity))fail();if(w.quantity.time!==undefined&&!['voltage','current','power','energy','work'].includes(w.quantity.time))fail();if(w.quantity.dc!==undefined&&!['voltage','current','power','energy'].includes(w.quantity.dc))fail();if(w.quantity.bode!==undefined&&!['db','phase'].includes(w.quantity.bode))fail();}
    if(w.physicalPart!==undefined&&w.physicalPart!==null&&(typeof w.physicalPart!=='string'||!(/^[A-Z][A-Za-z0-9_]{0,15}$/).test(w.physicalPart)))fail();
    if(w.visible!==undefined&&(!record(w.visible)||Object.keys(w.visible).length>20||Object.values(w.visible).some(v=>typeof v!=='boolean')))fail();
    if(w.plots!==undefined){
      if(!record(w.plots))fail();
      for(const [kind,p]of Object.entries(w.plots)){
        if(!['time','bode','dc'].includes(kind)||!record(p)||typeof p.logX!=='boolean'||p.logX!==(kind==='bode')||(kind==='dc'?!['V','A'].includes(p.xUnit):p.xUnit!==(kind==='bode'?'Hz':'s'))||typeof p.dual!=='boolean'||!['a','b'].includes(p.activeCursor))fail();
        if(!Array.isArray(p.view)||p.view.length!==2||!p.view.every(Number.isFinite)||p.view[1]<=p.view[0]||(p.logX&&p.view[0]<=0))fail();
        for(const c of [p.a,p.b])if(!record(c)||!Number.isFinite(c.x)||!Number.isInteger(c.index)||c.index<0||c.index>200000)fail();
      }
    }
  }
  function createStore(storage,key,parse){
    const previousKey=key+'-previous';
    const read=()=>{
      let text;try{text=storage.getItem(key);if(text!==null)return{doc:parse(text),recovered:false};}catch(error){
        try{const old=storage.getItem(previousKey);if(old!==null)return{doc:parse(old),recovered:true,error:error.message};}catch{}
        return{doc:null,recovered:false,error:'Il recupero automatico non è disponibile. Apri una copia JSON del progetto.'};
      }
      return{doc:null,recovered:false};
    };
    return{
      read,
      previous(){try{const text=storage.getItem(previousKey);return text===null?null:parse(text);}catch{return null;}},
      write(text,checkpoint=false){
        try{
          parse(text);
          const current=storage.getItem(key);
          // Keep the old circuit before New/Open/example replacement; view-only
          // autosaves must not replace that recovery point.
          if(current!==null&&current!==text&&(checkpoint||storage.getItem(previousKey)===null)){
            let usable=false;try{parse(current);usable=true;}catch{}
            if(usable)storage.setItem(previousKey,current);
          }
          storage.setItem(key,text);return{ok:true};
        }catch(error){return{ok:false,error:error.message};}
      }
    };
  }
  function checkOriginal(d,validator){if(!d)return;if(d.edited!==undefined&&typeof d.edited!=='boolean')throw Error('Provenienza dei dati non valida.');if(d.edited===true&&!d.originalPoints)throw Error('Mancano i punti originali della tabella.');if(d.originalPoints!==undefined)validator(d.originalPoints);}
  function checkRCStudy(s){
    if(s===undefined)return;const fail=()=>{throw new Error('I dati o le impostazioni dell’analisi RC non sono validi.');};
    if(!record(s)||s.version!==1||!['simulation','experiment'].includes(s.source)||!['voltage','log'].includes(s.method)||!['fixed','fit'].includes(s.finalMode)||!['s','ms','us'].includes(s.timeUnit))fail();
    for(const k of ['finalValue','deltaTime','deltaVoltage'])if(!Number.isFinite(s[k])||Math.abs(s[k])>1e9)fail();
    if(!Number.isInteger(s.segment)||s.segment<0||s.segment>1000||typeof s.overlay!=='boolean'||typeof s.logPlot!=='boolean'||typeof s.stamp!=='string'||s.stamp.length>80)fail();
    if([s.from,s.to].some(v=>v!==null&&!Number.isFinite(v))||(s.from!==null&&s.to!==null&&s.to<=s.from))fail();
    if(s.commonSigma!==null&&(!Number.isFinite(s.commonSigma)||s.commonSigma<1e-15||s.commonSigma>1e9))fail();
    const r=s.reference;if(r?.rho!==undefined&&(!Number.isFinite(r.rho)||Math.abs(r.rho)>1))fail();if(!record(r)||!['nominal','measured'].includes(r.kind)||typeof r.independent!=='boolean'||[r.R,r.C].some(v=>v!==null&&(!Number.isFinite(v)||v<=0||v>1e15))||[r.uR,r.uC].some(v=>v!==null&&(!Number.isFinite(v)||v<0||v>1e15)))fail();
    if(s.dataset!==null){
      const d=s.dataset;checkOriginal(d,points=>{if(!Array.isArray(points)||points.length<2||points.length>4000)fail();let previous=-Infinity;for(const p of points){if(!record(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<=previous)fail();previous=p.x;}});if(!record(d)||typeof d.name!=='string'||d.name.length>120||typeof d.raw!=='string'||d.raw.length>200000||!['s','ms','us'].includes(d.timeUnit)||!['V','mV'].includes(d.voltageUnit)||!Array.isArray(d.points)||d.points.length<2||d.points.length>4000)fail();
      if(d.format!==undefined){const f=d.format;if(!record(f)||![',',';','\t'].includes(f.delimiter)||!['.',','].includes(f.decimal)||typeof f.header!=='boolean'||![f.timeColumn,f.voltageColumn].every(v=>Number.isInteger(v)&&v>=0&&v<40)||(f.sigmaColumn!==null&&(!Number.isInteger(f.sigmaColumn)||f.sigmaColumn<0||f.sigmaColumn>=40))||f.timeColumn===f.voltageColumn||f.sigmaColumn===f.timeColumn||f.sigmaColumn===f.voltageColumn)fail();}
      let sigmas=0;for(let i=0;i<d.points.length;i++){const p=d.points[i];if(!record(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9||(i&&p.x<=d.points[i-1].x))fail();if(p.sigma!==undefined){if(!Number.isFinite(p.sigma)||p.sigma<1e-15||p.sigma>1e9)fail();sigmas++;}}if(sigmas&&sigmas!==d.points.length)fail();
    }
  }
  const checkACStudy=s=>{AC.validateStudy(s);checkOriginal(s?.dataset,AC.validatePoints);},checkOpampStudy=s=>{OP.validateStudy(s);checkOriginal(s,OP.validatePoints);},checkMetrologyStudy=s=>Meta.validate(s);
  function checkParameterStudy(s){if(s===undefined)return;const fail=()=>{throw Error('Scansione o Monte Carlo non validi.');};if(!s||s.version!==1||!['sweep','montecarlo'].includes(s.mode)||!['op','time','peak','tau','bode','cutoff','cmrr'].includes(s.metric)||!Number.isFinite(s.at)||s.at<0||s.at>1e9||!Number.isFinite(s.g0)||s.g0<=0||s.g0>1e12||!Number.isInteger(s.count)||s.count<2||s.count>(s.mode==='sweep'?51:200)||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!['uniform','normal'].includes(s.distribution)||!Number.isFinite(s.rho)||Math.abs(s.rho)>1||typeof s.log!=='boolean'||![s.start,s.stop].every(Number.isFinite)||s.start===s.stop||Math.abs(s.start)>1e15||Math.abs(s.stop)>1e15||!Array.isArray(s.parameters)||s.parameters.length<1||s.parameters.length>6)fail();const names=new Set();for(const p of s.parameters){if(!p||typeof p.component!=='string'||!(/^[A-Z][A-Za-z0-9_]{0,15}$/).test(p.component)||typeof p.field!=='string'||!(/^(value|initial|wave\.(level|dc|vpp|frequency|offset)|a0|gbw|rail|slew|rout|ilimit|is|n|bf|br|kp|vto|lambda)$/).test(p.field)||!Number.isFinite(p.relative)||p.relative<0||p.relative>1||names.has(p.component+'.'+p.field))fail();names.add(p.component+'.'+p.field);}}
  function checkStudyUpdate(text,key,study){
    if(!['rcStudy','acStudy','opampStudy','metrologyStudy'].includes(key))throw new Error('Tipo di analisi non valido.');
    if(key==='rcStudy')checkRCStudy(study);else if(key==='acStudy')checkACStudy(study);else if(key==='opampStudy')checkOpampStudy(study);else checkMetrologyStudy(study);
    const doc=readJSON(text);doc[key]=study;
    // Check the complete portable document before changing the live project.
    // Neither an oversize dataset nor invalid metadata may overwrite old data.
    readJSON(JSON.stringify(doc,null,2));
  }
  function fileName(name){const clean=String(name||'circuito').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'-').slice(0,70);return(clean||'circuito')+'.json';}
  return{checkComparison,checkAssembly,MAX_BYTES,readJSON,checkWorkspace,checkRCStudy,checkACStudy,checkOpampStudy,checkMetrologyStudy,checkParameterStudy,checkStudyUpdate,createStore,fileName};
});
