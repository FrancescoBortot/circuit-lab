/* Experimental amplifier metrology. SI units, Vpp amplitudes, standard uncertainties. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./rc-analysis.js'),require('./ac-analysis.js'));else root.OpampAnalysis=factory(root.RCAnalysis,root.ACAnalysis);})(typeof globalThis!=='undefined'?globalThis:this,function(RC,AC){
  'use strict';
  const modes=['vtc','bandwidth','v1','v2','common','differential'],headers=['mode','frequency_Hz','Vin_Vpp','Vout_Vpp','phase_deg','uVin_V','uVout_V','uPhase_deg'],finite=Number.isFinite;
  function validatePoints(points){
    if(!Array.isArray(points)||!points.length||points.length>4000)throw new Error('Servono da 1 a 4 000 misure dell’operazionale.');
    for(const p of points){if(!p||!modes.includes(p.mode)||!finite(p.frequency)||p.frequency<=0||p.frequency>1e12||!finite(p.input)||p.input<0||p.input>1e6||!finite(p.output)||p.output<0||p.output>1e6||p.mode!=='vtc'&&p.input===0)throw new Error('Modo, frequenza o ampiezze non valide.');
      for(const key of ['phase','uInput','uOutput','uPhase'])if(p[key]!==undefined&&(!finite(p[key])||Math.abs(p[key])>1e6||key!=='phase'&&p[key]<0))throw new Error('Fase o incertezza standard non valida.');
      if((p.uInput===undefined)!==(p.uOutput===undefined)||p.uPhase!==undefined&&p.phase===undefined)throw new Error('Completa u(Vin) e u(Vout); u(fase) richiede la fase.');}
    return points;
  }
  function parse(raw,{delimiter=';',decimal='.'}={}){
    if(![';',',','\t'].includes(delimiter)||!['.',','].includes(decimal)||delimiter===','&&decimal===',')throw new Error('Formato CSV ambiguo.');const rows=RC.rows(raw,delimiter).rows;
    if(rows[0].length!==8||rows[0].some((v,i)=>v.trim()!==headers[i]))throw new Error('Usa le otto intestazioni indicate nel modello CSV.');
    return validatePoints(rows.slice(1).map((r,i)=>{try{const p={mode:r[0].trim(),frequency:RC.number(r[1],decimal),input:RC.number(r[2],decimal),output:RC.number(r[3],decimal)};for(const [j,k]of [[4,'phase'],[5,'uInput'],[6,'uOutput'],[7,'uPhase']])if(r[j].trim())p[k]=RC.number(r[j],decimal);return p;}catch(e){throw new Error('Riga '+(i+2)+': '+e.message);}}));
  }
  function validateStudy(s){if(s===undefined)return;try{if(!s||s.version!==1||typeof s.name!=='string'||s.name.length>120||typeof s.raw!=='string'||new TextEncoder().encode(s.raw).length>200000||![';',',','\t'].includes(s.delimiter)||!['.',','].includes(s.decimal)||s.delimiter===','&&s.decimal===','||!finite(s.g0)||s.g0<=0||s.g0>1e12||!['vtc','bandwidth'].includes(s.plot)||s.reference!==undefined&&!['v1','v2','common','differential'].includes(s.reference)||s.quantity!==undefined&&!['db','phase'].includes(s.quantity)||s.plotFrequency!==undefined&&s.plotFrequency!==null&&(!finite(s.plotFrequency)||s.plotFrequency<=0)||typeof s.stamp!=='string'||s.stamp.length>80)throw Error();validatePoints(s.points);}catch{throw new Error('I dati o le impostazioni degli operazionali non sono validi.');}}
  const complex=(g,phase)=>({r:g*Math.cos(phase*Math.PI/180),i:g*Math.sin(phase*Math.PI/180)}),norm=z=>Math.hypot(z.r,z.i);
  function analyze(points,{g0=1,rhoChannels=0}={}){
    validatePoints(points);if(!finite(rhoChannels)||Math.abs(rhoChannels)>1)throw Error('Correlazione dei canali non valida.');if(!finite(g0)||g0<=0)throw new Error('Indica il guadagno G₀ di riferimento, positivo.');const warnings=[],rows=points.map(p=>{const gain=p.input?p.output/p.input:null,uGain=p.input&&p.uInput!==undefined?Math.sqrt(Math.max(0,(p.uOutput/p.input)**2+(p.output*p.uInput/(p.input*p.input))**2-2*rhoChannels*p.uOutput*p.output*p.uInput/(p.input**3))):null;return{...p,gain,uGain,db:gain>0?20*Math.log10(gain):null};}),cmrr=[];
    for(const frequency of [...new Set(rows.map(p=>p.frequency))]){
      const at=mode=>rows.filter(p=>p.mode===mode&&p.frequency===frequency),D=at('differential'),C=at('common'),A1=at('v1'),A2=at('v2');let ad,ac,value,uValue=null,method;
      if(D.length===1&&C.length===1){ad=D[0].gain;ac=C[0].gain;method='Misure dirette AD e AC';if(ad>0&&ac>0){value=20*Math.log10(ad/ac);if(D[0].uGain!==null&&C[0].uGain!==null)uValue=AC.K*Math.hypot(D[0].uGain/ad,C[0].uGain/ac);}}
      else if(A1.length===1&&A2.length===1){const a=A1[0],b=A2[0];if(a.phase===undefined||b.phase===undefined){warnings.push('A1/A2 a '+frequency+' Hz: servono entrambe le fasi per ricostruire AD e AC.');continue;}
        const calculate=(g1,ph1,g2,ph2)=>{const z1=complex(g1,ph1),z2=complex(g2,ph2),ad=norm({r:(z2.r-z1.r)/2,i:(z2.i-z1.i)/2}),ac=norm({r:z1.r+z2.r,i:z1.i+z2.i});return{ad,ac,value:ad>0&&ac>1e-12*Math.max(ad,1e-30)?20*Math.log10(ad/ac):null};};
        const result=calculate(a.gain,a.phase,b.gain,b.phase);({ad,ac,value}=result);method='Ricostruzione complessa da A1/A2';
        const vars=[a.gain,a.phase,b.gain,b.phase],uncert=[a.uGain,a.uPhase??null,b.uGain,b.uPhase??null];if(value!==null&&uncert.every(u=>u!==null)){const terms=vars.map((v,i)=>{const step=Math.max(Math.abs(v)*1e-6,i%2?1e-5:1e-9),up=vars.slice(),down=vars.slice();up[i]+=step;down[i]-=step;const f=calculate(...up).value,g=calculate(...down).value;return f===null||g===null?NaN:(f-g)/(2*step)*uncert[i];});if(terms.every(finite))uValue=Math.hypot(...terms);}
      }else{if(D.length+C.length+A1.length+A2.length)warnings.push('CMRR a '+frequency+' Hz: occorre una sola misura AD/AC oppure A1/A2 alla stessa frequenza.');continue;}
      if(!(ad>0)||!(ac>0)||!finite(value)){value=null;warnings.push('CMRR a '+frequency+' Hz non determinabile: uno dei guadagni si annulla. Nessun infinito sperimentale assegnato.');}
      if(uValue!==null&&uValue>3)warnings.push('CMRR a '+frequency+' Hz: propagazione al primo ordine poco affidabile vicino alla cancellazione; il bilancio va approfondito.');
      cmrr.push({frequency,ad,ac,value,uValue,method});
    }
    let cutoff=null;const bandwidth=rows.filter(p=>p.mode==='bandwidth'&&p.gain>0).sort((a,b)=>a.frequency-b.frequency);
    if(bandwidth.length>=2){try{const allU=bandwidth.every(p=>p.uGain>0),ps=bandwidth.map(p=>({x:p.frequency,gain:p.gain,db:p.db,...(allU?{uDb:AC.K*p.uGain/p.gain}:{})}));cutoff=AC.cutoff(ps,g0);if(!cutoff)warnings.push('Taglio non compreso nei dati rispetto al G₀ dichiarato.');else if(cutoff.count>1)warnings.push('Più attraversamenti del taglio: riportato il primo discendente.');}catch(e){warnings.push('Banda: '+e.message);}}
    if(rows.some(p=>p.input>0&&p.uGain===null))warnings.push('Le incertezze derivate sono disponibili soltanto dove entrambe le ampiezze hanno u standard.');
    return{rows,cmrr,cutoff,warnings:[...new Set(warnings)],assumptions:'Ampiezze Vpp e incertezze standard, propagate al primo ordine; osservazioni indipendenti, correlazione Vin/Vout per osservazione = '+rhoChannels+'. AD riferito a V2−V1, AC al medesimo segnale sui due ingressi. Nessun fit RC imposto alla banda del derivatore.'};
  }
  function compare(result,doc,Free,{reference='v1'}={}){
    const cache=new Map(),weights={v1:{V1:1},v2:{V2:1},common:{V1:1,V2:1},differential:{V1:-.5,V2:.5}};
    let unavailable=false;
    for(const row of result.rows){const mode=['vtc','bandwidth'].includes(row.mode)?reference:row.mode,key=mode+'|'+row.frequency;if(!cache.has(key)){try{const d=Free.clone(doc);d.settings.acReference='source';d.settings.acWeights=weights[mode];d.settings.acPhases={};d.settings.acSource=Object.keys(weights[mode])[0];if(Object.keys(weights[mode]).some(id=>!d.components.some(c=>c.id===id&&c.type==='V')))throw Error();cache.set(key,Free.bode(d,{frequencies:[row.frequency],ignoreBias:true}).data[0]);}catch{cache.set(key,null);}}
      const h=cache.get(key);if(h){row.modelGain=h.magnitude;row.modelPhase=h.phase;row.modelOutput=h.magnitude*row.input;row.residualGain=row.gain===null?null:row.gain-h.magnitude;}else unavailable=true;
    }
    result.comparisonNotice='Previsione lineare del circuito aperto, con eccitazioni su V1/V2 e OUT rispetto a massa. Saturazione, slew rate e corrente possono far differire le misure in ampiezza.'+(unavailable?' Alcuni confronti richiedono i generatori di tensione V1/V2 e una rete AC risolvibile.':'');return result;
  }
  function csv(result){return RC.csv([['modo','frequenza_Hz','Vin_Vpp','Vout_Vpp','fase_gradi','uVin_V','uVout_V','uFase_gradi','guadagno_V_V','uGuadagno_V_V','guadagno_dB','modello_lineare_V_V','modello_fase_gradi','scarto_guadagno_V_V'],...result.rows.map(p=>[p.mode,p.frequency,p.input,p.output,p.phase,p.uInput,p.uOutput,p.uPhase,p.gain,p.uGain,p.db,p.modelGain,p.modelPhase,p.residualGain])]);}
  const demo=()=>headers.join(';')+'\n'+[['v1',1000,1,4.7,-180,.002,.005,.05],['v2',1000,1,4.71,0,.002,.005,.05],['differential',1000,1,4.705,0,.002,.005,.05],['common',1000,1,.01,0,.002,.0002,.1],...[10,1000,10000,30000,100000,300000,500000,700000,1e6,3e6].map(f=>['bandwidth',f,1,4.7/Math.hypot(1,f/700000),-180-Math.atan(f/700000)*180/Math.PI,.002,.005,.05]),...[0,.5,1,2,4,8,10].map(v=>['vtc',1000,v,Math.min(v*4.7,27),'',.002,.01,''])].map(r=>r.join(';')).join('\n');
  return{headers,modes,validatePoints,validateStudy,parse,analyze,compare,csv,demo};
});
