/* Local RC frequency measurements. Frequencies in Hz, gain V/V, phase in degrees.
   Original CSV remains separate from derived gain and continuous phase. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./rc-analysis.js'));
  else root.ACAnalysis=factory(root.RCAnalysis);
})(typeof globalThis!=='undefined'?globalThis:this,function(A){
  'use strict';
  const K=20/Math.LN10,UNITS={Hz:1,kHz:1e3,MHz:1e6,V:1,mV:1e-3,deg:1,rad:180/Math.PI};
  const finite=Number.isFinite,record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const wrap=x=>((x+180)%360+360)%360-180;
  const attenuation=z=>-10/Math.LN10*(z>350?2*z:Math.log1p(Math.exp(2*z)));
  const phase=(f,fc)=>-Math.atan(f/fc)*180/Math.PI;
  function validatePoints(points){
    if(!Array.isArray(points)||points.length<2||points.length>A.LIMIT)throw new Error('Servono da 2 a 4 000 punti in frequenza.');
    for(const key of ['uDb','phase','uPhase','input','output','uInput','uOutput']){const n=points.filter(p=>p&&p[key]!==undefined).length;if(n&&n!==points.length)throw new Error('La colonna '+key+' deve essere completa oppure assente.');}
    for(let i=0;i<points.length;i++){
      const p=points[i];
      if(!record(p)||!finite(p.x)||p.x<=0||p.x>1e12||!finite(p.gain)||p.gain<1e-15||p.gain>1e15||!finite(p.db)||Math.abs(p.db-20*Math.log10(p.gain))>1e-7)throw new Error('Frequenza o guadagno non valido alla riga '+(i+1)+'.');
      if(i&&p.x<=points[i-1].x)throw new Error('Le frequenze devono essere strettamente crescenti: riga '+(i+1)+'.');
      if(p.phase!==undefined&&(!finite(p.phase)||Math.abs(p.phase)>1e6))throw new Error('Fase non valida alla riga '+(i+1)+'.');
      for(const key of ['uDb','uPhase'])if(p[key]!==undefined&&(!finite(p[key])||p[key]<1e-15||p[key]>1e9))throw new Error('Incertezza standard non valida alla riga '+(i+1)+'.');
      if(p.uPhase!==undefined&&p.phase===undefined)throw new Error('u(fase) richiede la colonna fase.');
      if((p.input===undefined)!==(p.output===undefined)||(p.uInput===undefined)!==(p.uOutput===undefined))throw new Error('Ampiezze o incertezze dei due canali incomplete.');
      for(const key of ['input','output','uInput','uOutput'])if(p[key]!==undefined&&(!finite(p[key])||p[key]<=0||p[key]>1e9))throw new Error('Ampiezza o incertezza fuori intervallo.');
      if(p.input!==undefined&&Math.abs(p.output/p.input-p.gain)>1e-8*p.gain)throw new Error('Il rapporto delle ampiezze non coincide con il guadagno.');
      if(p.uInput!==undefined&&(p.input===undefined||p.uDb===undefined||Math.abs(p.uDb-K*Math.hypot(p.uInput/p.input,p.uOutput/p.output))>1e-8*p.uDb))throw new Error('Propagazione delle ampiezze non coerente.');
    }
    return points;
  }
  function checkFormat(f){
    if(!record(f)||!['amplitudes','gain'].includes(f.mode)||!['Hz','kHz','MHz'].includes(f.frequencyUnit)||!['V','mV'].includes(f.voltageUnit)||!['linear','dB'].includes(f.gainUnit)||!['deg','rad'].includes(f.phaseUnit)||!['vpp','rms','peak'].includes(f.amplitudeKind)||typeof f.independentAmplitudes!=='boolean'||![',',';','\t'].includes(f.delimiter)||!['.',','].includes(f.decimal)||typeof f.header!=='boolean'||(f.delimiter===','&&f.decimal===','))throw new Error('Formato dei dati AC non valido.');
    const c=f.columns;if(!record(c))throw new Error('Scegli le colonne dei dati AC.');
    const used=['frequency',...(f.mode==='amplitudes'?['input','output','uInput','uOutput']:['gain','uGain']),'phase','uPhase'].map(k=>c[k]).filter(v=>v!==null&&v!==undefined);
    if(used.some(v=>!Number.isInteger(v)||v<0||v>=40)||new Set(used).size!==used.length||!Number.isInteger(c.frequency)||(f.mode==='amplitudes'?!Number.isInteger(c.input)||!Number.isInteger(c.output):!Number.isInteger(c.gain)))throw new Error('Scegli colonne diverse per frequenza, segnale e incertezze.');
    if((c.uPhase!=null&&c.phase==null)||(f.mode==='amplitudes'&&((c.uInput!=null)!==(c.uOutput!=null))))throw new Error('Completa entrambe le incertezze di Vin e Vout; u(fase) richiede la fase.');
    if(f.mode==='amplitudes'&&c.uInput!=null&&!f.independentAmplitudes)throw new Error('Per propagare u(Vin) e u(Vout), dichiara l’ipotesi di indipendenza.');
    return f;
  }
  function parseTable(text,options={}){
    const table=A.rows(text,options.delimiter),c=options.columns||{frequency:0,gain:1,phase:null};
    const f={mode:'gain',frequencyUnit:'Hz',voltageUnit:'V',gainUnit:'linear',phaseUnit:'deg',amplitudeKind:'vpp',independentAmplitudes:false,decimal:table.delimiter===','?'.':',',...options,delimiter:table.delimiter,columns:{...c},header:options.header==='yes'};
    if(!['yes','no'].includes(options.header))try{A.number(table.rows[0][c.frequency],f.decimal);A.number(table.rows[0][f.mode==='amplitudes'?c.input:c.gain],f.decimal);}catch{f.header=true;}
    checkFormat(f);
    const keys=['frequency',...(f.mode==='amplitudes'?['input','output','uInput','uOutput']:['gain','uGain']),'phase','uPhase'];
    if(keys.some(k=>c[k]!=null&&c[k]>=table.rows[0].length))throw new Error('Una colonna scelta non è presente nella tabella.');
    const warnings=[],points=table.rows.slice(f.header?1:0).map((row,i)=>{
      try{
        const val=k=>c[k]==null?undefined:A.number(row[c[k]],f.decimal),positive=(v,label)=>{if(!finite(v)||v<=0)throw new Error(label+' deve essere positiva.');return v;};
        const x=val('frequency')*UNITS[f.frequencyUnit];let gain,uDb,amplitudes={};
        if(f.mode==='amplitudes'){
          const vin=positive(val('input'),'Vin')*UNITS[f.voltageUnit],vout=positive(val('output'),'Vout')*UNITS[f.voltageUnit];gain=vout/vin;amplitudes={input:vin,output:vout};
          if(c.uInput!=null){const ui=positive(val('uInput'),'u(Vin)')*UNITS[f.voltageUnit],uo=positive(val('uOutput'),'u(Vout)')*UNITS[f.voltageUnit];uDb=K*Math.hypot(ui/vin,uo/vout);amplitudes.uInput=ui;amplitudes.uOutput=uo;if(Math.max(ui/vin,uo/vout)>.2)warnings.push('Incertezze di ampiezza oltre il 20%: la propagazione al rapporto e ai dB è un’approssimazione locale.');}
        }else{
          const v=val('gain');gain=f.gainUnit==='dB'?10**(v/20):positive(v,'Il guadagno');
          if(c.uGain!=null){const u=positive(val('uGain'),'u(G)');uDb=f.gainUnit==='dB'?u:K*u/gain;if(f.gainUnit==='linear'&&u/gain>.2)warnings.push('u(G)/G oltre il 20%: la trasformazione in dB è un’approssimazione locale.');}
        }
        const p={x,gain,db:20*Math.log10(gain),...amplitudes};
        if(uDb!==undefined)p.uDb=uDb;
        if(c.phase!=null)p.phase=val('phase')*UNITS[f.phaseUnit];
        if(c.uPhase!=null)p.uPhase=positive(val('uPhase'),'u(fase)')*UNITS[f.phaseUnit];
        return p;
      }catch(e){throw new Error('Riga '+(i+(f.header?2:1))+': '+e.message);}
    });
    validatePoints(points);return{points,format:f,warnings:[...new Set(warnings)]};
  }
  function continuous(points){
    let previous=null;return points.map(p=>{const row={...p};if(p.phase!==undefined){const v=wrap(p.phase);row.continuousPhase=previous===null?v:previous+wrap(v-previous);previous=row.continuousPhase;}return row;});
  }
  function interpolate(data,x,key){
    if(!data.length||x<data[0].x||x>data.at(-1).x)return NaN;
    let lo=0,hi=data.length;while(lo<hi){const m=(lo+hi)>>1;if(data[m].x<=x)lo=m+1;else hi=m;}
    const a=data[Math.max(0,lo-1)],b=data[lo];if(a.x===x||!b)return a[key];
    if(!finite(a[key])||!finite(b[key]))return NaN;const q=Math.log(x/a.x)/Math.log(b.x/a.x);return a[key]+q*(b[key]-a[key]);
  }
  function cutoff(points,g0,uG0=null,independent=false){
    validatePoints(points);if(!finite(g0)||g0<1e-15||g0>1e15||uG0!==null&&(!finite(uG0)||uG0<0||uG0>1e15))throw new Error('G₀ deve essere positivo e u(G₀) non negativa.');
    const targetDb=20*Math.log10(g0)-10*Math.log10(2),crossings=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];if(a.db>targetDb&&b.db<=targetDb){
        const den=b.db-a.db,span=Math.log(b.x/a.x),q=(targetDb-a.db)/den,frequency=a.x*Math.exp(q*span);let uFrequency=null;
        if(independent&&uG0!==null&&a.uDb!==undefined){const da=span*(targetDb-b.db)/(den*den),db=-span*(targetDb-a.db)/(den*den),dt=span/den;uFrequency=frequency*Math.hypot(da*a.uDb,db*b.uDb,dt*K*uG0/g0);}
        crossings.push({frequency,uFrequency,bracket:[a.x,b.x],fraction:q});
      }
    }
    return crossings.length?{...crossings[0],targetDb,count:crossings.length,tau:1/(2*Math.PI*crossings[0].frequency)}:null;
  }
  function fit(points){
    validatePoints(points);if(points.length<4)throw new Error('Il fit RC in frequenza richiede almeno 4 punti.');
    const supplied=points[0].uDb!==undefined,scale=supplied?Math.min(...points.map(p=>p.uDb)):1,w=points.map(p=>supplied?(scale/p.uDb)**2:1),sum=w.reduce((s,v)=>s+v,0),lf=points.map(p=>Math.log(p.x));
    const profile=q=>{const d=lf.map(v=>attenuation(v-q)),g=points.reduce((s,p,i)=>s+w[i]*(p.db-d[i]),0)/sum,cost=points.reduce((s,p,i)=>s+w[i]*(p.db-g-d[i])**2,0);return{cost,g};};
    const low=lf[0]-Math.log(1000),high=lf.at(-1)+Math.log(1000),steps=96,grid=Array.from({length:steps+1},(_,i)=>low+(high-low)*i/steps),values=grid.map(profile);let best=0;
    for(let i=1;i<values.length;i++)if(values[i].cost<values[best].cost)best=i;
    if(best===0||best===steps)throw new Error('Taglio non identificabile: servono frequenze che esplorino la curvatura della risposta.');
    let left=grid[best-1],right=grid[best+1],g=(Math.sqrt(5)-1)/2,c=right-g*(right-left),d=left+g*(right-left),fc=profile(c),fd=profile(d);
    for(let i=0;i<100&&right-left>1e-11;i++){if(fc.cost<fd.cost){right=d;d=c;fd=fc;c=right-g*(right-left);fc=profile(c);}else{left=c;c=d;fc=fd;d=left+g*(right-left);fd=profile(d);}}
    const q=(left+right)/2,frequency=Math.exp(q),g0Db=profile(q).g,g0=10**(g0Db/20),J=lf.map(l=>{const z=l-q;return K/(1+Math.exp(-2*z));}),jm=J.reduce((s,j,i)=>s+w[i]*j,0)/sum,S=J.reduce((s,j,i)=>s+w[i]*(j-jm)**2,0),warnings=[];
    if(!finite(frequency)||!finite(g0)||g0<1e-15||g0>1e15||S/sum<1e-10)throw new Error('G₀ e taglio sono troppo correlati per un fit identificabile. Estendi l’intervallo.');
    const uLogF=supplied?scale/Math.sqrt(S):null,uG0Db=supplied?scale*Math.sqrt(1/sum+jm*jm/S):null,uFrequency=supplied?frequency*uLogF:null,uG0=supplied?g0*uG0Db/K:null;
    const predictDb=f=>g0Db+attenuation(Math.log(f)-q),predictPhase=f=>phase(f,frequency),residuals=points.map(p=>({...p,fitDb:predictDb(p.x),fitPhase:predictPhase(p.x),residualDb:p.db-predictDb(p.x),...(p.phase===undefined?{}:{residualPhase:wrap(p.phase-predictPhase(p.x))})}));
    const rms=Math.sqrt(residuals.reduce((s,p)=>s+p.residualDb**2,0)/points.length),df=points.length-2,chi2=supplied?residuals.reduce((s,p)=>s+(p.residualDb/p.uDb)**2,0):null,tau=1/(2*Math.PI*frequency);
    if(frequency<points[0].x||frequency>points.at(-1).x)warnings.push('Il taglio del fit è fuori dall’intervallo misurato: è un’estrapolazione del modello, non una lettura dei punti.');
    if(rms>.5)warnings.push('Scarti del modulo oltre 0,5 dB: verifica se un solo polo descrive il circuito.');
    if(uLogF!==null&&uLogF>.5)warnings.push('u(fc)/fc oltre il 50%: il taglio è poco vincolato.');
    if(points.some(p=>p.phase!==undefined&&Math.abs(wrap(p.phase-predictPhase(p.x)))>15))warnings.push('La fase si discosta di oltre 15° dal modello RC. Il fit usa soltanto il modulo.');
    if(!supplied)warnings.push('u(G) assente: nessuna incertezza sperimentale assegnata ai parametri del fit.');
    return{frequency,g0,g0Db,uFrequency,uG0,uG0Db,tau,uTau:supplied?tau*uLogF:null,rms,df,chi2,reducedChi2:supplied?chi2/df:null,count:points.length,residuals,predictDb,predictPhase,warnings};
  }
  function analyze(points,options={}){
    validatePoints(points);const from=options.from??points[0].x,to=options.to??points.at(-1).x;
    if(!finite(from)||!finite(to)||from<=0||to<=from)throw new Error('Scegli frequenze positive, con fine maggiore dell’inizio.');
    const selected=points.filter(p=>p.x>=from&&p.x<=to);validatePoints(selected);
    const cut=cutoff(selected,options.g0??1,options.uG0??null,Boolean(options.independentReference)),warnings=[];let model=null;
    if(options.fit!==false)try{model=fit(selected);warnings.push(...model.warnings);}catch(e){warnings.push(e.message);}
    if(!cut)warnings.push('Nessun attraversamento del livello di taglio nell’intervallo: i punti non vengono estrapolati.');
    else{if(cut.uFrequency!==null&&cut.uFrequency/cut.frequency>.5)warnings.push('u(fc)/fc dalla lettura oltre il 50%: propagazione locale poco affidabile.');if(cut.count>1)warnings.push('Più attraversamenti: viene riportato il primo discendente.');if(cut.uFrequency===null)warnings.push('u(fc) dalla lettura non disponibile: servono u(G) dei due punti, u(G₀) e l’indipendenza del riferimento.');}
    return{points:continuous(selected),cutoff:cut,fit:model,warnings,from:selected[0].x,to:selected.at(-1).x};
  }
  function validateStudy(s){
    if(s===undefined)return;
    try{
      if(!record(s)||s.version!==1||!['source','input','after-generator','custom'].includes(s.reference)||typeof s.referenceNote!=='string'||s.referenceNote.length>160||!['fit','simulation'].includes(s.residualReference)||!['db','phase'].includes(s.residualQuantity)||typeof s.stamp!=='string'||s.stamp.length>80)throw Error();
      for(const key of ['fit','overlay','showPhase','independentReference'])if(typeof s[key]!=='boolean')throw Error();
      if([s.from,s.to].some(v=>v!==null&&(!finite(v)||v<=0||v>1e12))||s.from!==null&&s.to!==null&&s.to<=s.from||!finite(s.g0)||s.g0<1e-15||s.g0>1e15||s.uG0!==null&&(!finite(s.uG0)||s.uG0<0||s.uG0>1e15))throw Error();
      if(s.dataset!==null){const d=s.dataset;if(!record(d)||typeof d.name!=='string'||d.name.length>120||typeof d.raw!=='string'||new TextEncoder().encode(d.raw).length>200000||!Array.isArray(d.warnings)||d.warnings.length>10||d.warnings.some(v=>typeof v!=='string'||v.length>300))throw Error();checkFormat(d.format);validatePoints(d.points);}
    }catch{throw new Error('I dati o le impostazioni dell’analisi in frequenza non sono validi.');}
  }
  function demo(){
    return [10,20,50,100,150,200,300,500,1000,3000,10000].map((f,i)=>{const gain=.96/Math.hypot(1,f/160)*10**(.018*Math.sin(i*1.7)/20);return{frequency:f,input:2,output:2*gain,phase:phase(f,160)+.25*Math.sin(i),uInput:.005,uOutput:Math.max(.00002,2*gain*.004),uPhase:.5};});
  }
  return{UNITS,K,wrap,validatePoints,checkFormat,parseTable,continuous,interpolate,cutoff,fit,analyze,validateStudy,demo};
});
