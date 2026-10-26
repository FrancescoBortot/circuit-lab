/* Local, data-only RC metrology. Time in s, voltage and standard u(V) in V.
   An exponential fit is a model of a selected interval, not proof of one pole. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.RCAnalysis=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const UNITS={s:1,ms:1e-3,us:1e-6,V:1,mV:1e-3},LIMIT=4000;
  const finite=Number.isFinite;
  function number(text,decimal='.'){
    let s=String(text).trim();if(decimal===',')s=s.replace(',','.');
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)||!finite(Number(s)))throw new Error('Numero non valido: “'+String(text).slice(0,35)+'”.');return Number(s);
  }
  function rows(text,delimiter='auto'){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>200000)throw new Error('Il CSV ammette fino a 200 kB e 4 000 punti.');
    text=text.replace(/^\uFEFF/,'');
    if(delimiter==='auto'){const first=text.split(/\r?\n/).find(l=>l.trim())||'';delimiter=first.includes('\t')?'\t':first.includes(';')?';':',';}
    if(![',',';','\t'].includes(delimiter))throw new Error('Separatore CSV non valido.');
    let row=[],cell='',quoted=false,afterQuote=false;const out=[];
    const pushRow=()=>{row.push(cell);if(row.some(s=>s.trim()))out.push(row);row=[];cell='';afterQuote=false;if(out.length>LIMIT+1)throw new Error('Il CSV supera 4 000 punti.');};
    for(let i=0;i<text.length;i++){
      const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=c;continue;}
      if(c==='"'&&!cell.trim()&&!afterQuote){quoted=true;cell='';}
      else if(c===delimiter){row.push(cell);cell='';afterQuote=false;}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();}
      else if(afterQuote&&c.trim())throw new Error('CSV non valido dopo la chiusura delle virgolette.');
      else if(!afterQuote)cell+=c;
    }
    if(quoted)throw new Error('CSV con virgolette non chiuse.');if(cell||row.length)pushRow();
    if(!out.length)throw new Error('Inserisci almeno una riga di dati.');
    const count=out[0].length;if(count<2||count>40||out.some(r=>r.length!==count))throw new Error('Ogni riga deve avere lo stesso numero di colonne, da 2 a 40.');
    return{rows:out,delimiter};
  }
  function parseTable(text,options={}){
    const table=rows(text,options.delimiter),decimal=options.decimal|| (table.delimiter===','?'.':','),tc=options.timeColumn??0,vc=options.voltageColumn??1,sc=options.sigmaColumn??null;
    if(table.delimiter===','&&decimal===',')throw new Error('Con virgola decimale scegli punto e virgola o tab come separatore.');
    if(![tc,vc,...(sc===null?[]:[sc])].every(c=>Number.isInteger(c)&&c>=0&&c<table.rows[0].length)||tc===vc||sc===tc||sc===vc)throw new Error('Scegli colonne diverse per tempo, tensione e incertezza.');
    const tf=UNITS[options.timeUnit||'s'],vf=UNITS[options.voltageUnit||'V'];if(!tf||!vf||!['s','ms','us'].includes(options.timeUnit||'s')||!['V','mV'].includes(options.voltageUnit||'V'))throw new Error('Unità dei dati non valida.');
    let header=options.header==='yes';if(options.header!=='no'&&options.header!=='yes')try{number(table.rows[0][tc],decimal);number(table.rows[0][vc],decimal);}catch{header=true;}
    const raw=table.rows.slice(header?1:0),points=raw.map((r,i)=>{try{return{x:number(r[tc],decimal)*tf,y:number(r[vc],decimal)*vf,...(sc===null?{}:{sigma:number(r[sc],decimal)*vf})};}catch(e){throw new Error('Riga '+(i+(header?2:1))+': '+e.message);}});
    validatePoints(points,LIMIT);return{points,delimiter:table.delimiter,decimal,header,labels:header?table.rows[0]:table.rows[0].map((_,i)=>'Colonna '+(i+1)),timeUnit:options.timeUnit||'s',voltageUnit:options.voltageUnit||'V',timeColumn:tc,voltageColumn:vc,sigmaColumn:sc};
  }
  function validatePoints(points,max=50000){
    if(!Array.isArray(points)||points.length<2||points.length>max)throw new Error('Servono da 2 a '+max.toLocaleString('it-IT')+' punti.');
    let sigma=0;
    for(let i=0;i<points.length;i++){const p=points[i];if(!p||!finite(p.x)||!finite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9)throw new Error('Tempo o tensione fuori intervallo alla riga '+(i+1)+'.');if(i&&p.x<=points[i-1].x)throw new Error('I tempi devono essere strettamente crescenti: controlla la riga '+(i+1)+'.');if(p.sigma!==undefined){if(!finite(p.sigma)||p.sigma<1e-15||p.sigma>1e9)throw new Error('u(V) deve essere positiva e finita alla riga '+(i+1)+'.');sigma++;}}
    if(sigma&&sigma!==points.length)throw new Error('Fornisci u(V) per tutti i punti oppure per nessuno.');return points;
  }
  function segments(data){
    const out=[];let part=[];
    for(const d of data){if(!finite(d.x)||!finite(d.y))continue;if(part.length&&d.x<=part.at(-1).x){if(part.length>=6)out.push(part);part=[];}part.push({x:d.x,y:d.y});}if(part.length>=6)out.push(part);return out;
  }
  function invert(A){
    const n=A.length,S=A.map((r,i)=>Math.sqrt(r[i]));if(S.some(s=>!finite(s)||s===0))return null;
    const B=A.map((r,i)=>[...r.map((v,j)=>v/(S[i]*S[j])),...Array.from({length:n},(_,j)=>i===j?1:0)]);
    for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(B[i][k])>Math.abs(B[p][k]))p=i;if(Math.abs(B[p][k])<1e-10)return null;[B[p],B[k]]=[B[k],B[p]];const q=B[k][k];for(let j=0;j<2*n;j++)B[k][j]/=q;for(let i=0;i<n;i++)if(i!==k){const q=B[i][k];for(let j=0;j<2*n;j++)B[i][j]-=q*B[k][j];}}
    return B.map((r,i)=>r.slice(n).map((v,j)=>v/(S[i]*S[j])));
  }
  function fit(points,options={}){
    validatePoints(points);const from=options.from??points[0].x,to=options.to??points.at(-1).x;
    if(!finite(from)||!finite(to)||to<=from)throw new Error('Scegli un intervallo con fine maggiore dell’inizio.');
    const selected=points.filter(p=>p.x>=from&&p.x<=to);if(selected.length<6)throw new Error('Il fit richiede almeno 6 punti nell’intervallo scelto.');
    const t0=selected[0].x,span=selected.at(-1).x-t0,range=Math.max(...selected.map(p=>p.y))-Math.min(...selected.map(p=>p.y));
    if(range<=1e-12*Math.max(1,...selected.map(p=>Math.abs(p.y))))throw new Error('La tensione è costante: τ non è identificabile.');
    const common=options.commonSigma;if(common!==undefined&&common!==null&&(!finite(common)||common<1e-15||common>1e9))throw new Error('L’incertezza comune u(V) deve essere positiva.');
    const supplied=selected[0].sigma!==undefined||common!=null,minSigma=supplied?Math.min(...selected.map(p=>p.sigma??common)):1;
    const sigmas=selected.map(p=>p.sigma??common),weights=selected.map((p,i)=>supplied?(minSigma/sigmas[i])**2:1),z=selected.map(p=>(p.x-t0)/span),y=selected.map(p=>p.y),sum=weights.reduce((a,b)=>a+b,0),mean=y.reduce((a,v,i)=>a+v*weights[i],0)/sum;
    const method=options.method||'voltage',free=options.finalMode==='fit',fixed=options.finalValue??0,warnings=[];
    if(!finite(fixed)||!['voltage','log'].includes(method))throw new Error('Impostazioni del fit non valide.');
    let tau,a,b,slope=null,intercept=null,uTau=null,uA=null,uFinal=null;
    if(method==='log'){
      if(free)throw new Error('Il fit logaritmico richiede un valore finale noto.');
      const sign=Math.sign(y[0]-fixed);if(!sign||y.some(v=>Math.sign(v-fixed)!==sign))throw new Error('Il logaritmo richiede V − V∞ diverso da zero e dello stesso segno in tutti i punti.');
      const l=y.map(v=>Math.log(Math.abs(v-fixed))),sl=supplied?y.map((v,i)=>sigmas[i]/Math.abs(v-fixed)):null,ref=sl?Math.min(...sl):1,w=sl?sl.map(s=>(ref/s)**2):weights,W=w.reduce((s,v)=>s+v,0),zm=z.reduce((s,v,i)=>s+v*w[i],0)/W,lm=l.reduce((s,v,i)=>s+v*w[i],0)/W;
      const zz=z.reduce((s,v,i)=>s+w[i]*(v-zm)**2,0);slope=z.reduce((s,v,i)=>s+w[i]*(v-zm)*(l[i]-lm),0)/zz;intercept=lm-slope*zm;
      if(!finite(slope)||slope>=0)throw new Error('I punti non descrivono un avvicinamento esponenziale al valore finale scelto.');
      tau=-span/slope;a=sign*Math.exp(intercept);b=fixed;
      if(supplied){uTau=span/(slope*slope)*ref/Math.sqrt(zz);uA=Math.abs(a)*ref*Math.sqrt(1/W+zm*zm/zz);if(y.some((v,i)=>Math.abs(v-fixed)<3*sigmas[i]))warnings.push('Alcuni punti distano da V∞ meno di 3 u(V): trasformazione logaritmica e pesi possono essere poco affidabili.');}
      warnings.push('Il fit logaritmico minimizza gli scarti dei logaritmi; u(V∞) e incertezze sui tempi non sono incluse.');
    }else{
      const profile=q=>{
        const r=Math.exp(q),e=z.map(v=>Math.exp(-v/r));let A,B;
        if(free){const em=e.reduce((s,v,i)=>s+weights[i]*v,0)/sum,den=e.reduce((s,v,i)=>s+weights[i]*(v-em)**2,0);if(den<1e-24)return{cost:Infinity};A=e.reduce((s,v,i)=>s+weights[i]*(v-em)*(y[i]-mean),0)/den;B=mean-A*em;}
        else{A=e.reduce((s,v,i)=>s+weights[i]*v*(y[i]-fixed),0)/e.reduce((s,v,i)=>s+weights[i]*v*v,0);B=fixed;}
        const cost=y.reduce((s,v,i)=>s+weights[i]*(v-B-A*e[i])**2,0);return{cost,a:A,b:B,tau:r*span};
      };
      const low=Math.log(1e-4),high=Math.log(1e4),steps=64,grid=Array.from({length:steps+1},(_,i)=>low+(high-low)*i/steps),values=grid.map(profile);let best=0;for(let i=1;i<values.length;i++)if(values[i].cost<values[best].cost)best=i;
      if(best===0||best===steps)throw new Error('τ non è identificabile in questo intervallo: modifica l’intervallo o specifica V∞.');
      let left=grid[best-1],right=grid[best+1],g=(Math.sqrt(5)-1)/2,c=right-g*(right-left),d=left+g*(right-left),fc=profile(c),fd=profile(d);
      for(let k=0;k<90&&right-left>1e-11;k++){if(fc.cost<fd.cost){right=d;d=c;fd=fc;c=right-g*(right-left);fc=profile(c);}else{left=c;c=d;fc=fd;d=left+g*(right-left);fd=profile(d);}}
      const result=profile((left+right)/2);({tau,a,b}=result);
      if(!finite(a)||!finite(b)||!finite(tau))throw new Error('Fit non determinato.');
      if(supplied&&options.source!=='simulation'){
        const n=free?3:2,N=Array.from({length:n},()=>Array(n).fill(0));
        for(let i=0;i<selected.length;i++){const e=Math.exp(-(selected[i].x-t0)/tau),jq=a*e*(selected[i].x-t0)/tau,J=free?[e,1,jq]:[e,jq];for(let j=0;j<n;j++)for(let k=0;k<n;k++)N[j][k]+=weights[i]*J[j]*J[k];}
        const cov=invert(N);if(cov){uTau=tau*minSigma*Math.sqrt(Math.max(0,cov[n-1][n-1]));uA=minSigma*Math.sqrt(Math.max(0,cov[0][0]));if(free)uFinal=minSigma*Math.sqrt(Math.max(0,cov[1][1]));}else warnings.push('Parametri fortemente correlati: incertezza di τ non determinabile in modo affidabile.');
      }
    }
    const yMean=y.reduce((s,v)=>s+v,0)/y.length;
    const predict=x=>b+a*Math.exp(-(x-t0)/tau),residuals=selected.map(p=>({...p,fit:predict(p.x),residual:p.y-predict(p.x)})),sse=residuals.reduce((s,p)=>s+p.residual*p.residual,0),sst=y.reduce((s,v)=>s+(v-yMean)**2,0),rms=Math.sqrt(sse/y.length),r2=sst>0?1-sse/sst:null,df=y.length-(free?3:2),chi2=supplied&&options.source!=='simulation'?residuals.reduce((s,p,i)=>s+(p.residual/sigmas[i])**2,0):null;
    if(options.source==='simulation'){uTau=null;uA=null;uFinal=null;warnings.push('Fit dei campioni della simulazione: nessuna incertezza sperimentale assegnata.');}
    if(free&&span/tau<.5)warnings.push('Intervallo breve rispetto a τ: V∞ e τ sono fortemente correlati.');
    if(rms/range>.03||(r2!==null&&r2<.98))warnings.push('Scarti rilevanti rispetto all’escursione: una sola esponenziale può non descrivere questi dati. Controlla i residui.');
    if(uTau!==null&&uTau/tau>.5)warnings.push('Incertezza di τ maggiore del 50%: estendi l’intervallo o vincola V∞.');
    return{tau,a,finalValue:b,uTau,uA,uFinal,t0,from:selected[0].x,to:selected.at(-1).x,count:y.length,method,finalMode:free?'fit':'fixed',rms,r2,chi2,reducedChi2:chi2!==null&&df>0?chi2/df:null,df,residuals,predict,warnings,slope:slope===null?null:slope/span,intercept};
  }
  function threshold(points,finalValue){
    const start=points[0],amplitude=start.y-finalValue;if(!finite(finalValue)||!amplitude)return null;
    const target=finalValue+amplitude/Math.E,crossings=[];
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],u=(a.y-target)*Math.sign(amplitude),v=(b.y-target)*Math.sign(amplitude);if(u>0&&v<=0){const t=a.x+(target-a.y)*(b.x-a.x)/(b.y-a.y);crossings.push(t);}}
    return crossings.length?{tau:crossings[0]-start.x,time:crossings[0],target,start:start.x,count:crossings.length}:null;
  }
  function cutoff(data,referenceMagnitude){
    if(!finite(referenceMagnitude)||referenceMagnitude<=0)return null;const target=20*Math.log10(referenceMagnitude)-10*Math.log10(2),crossings=[];
    for(let i=1;i<data.length;i++){const a=data[i-1],b=data[i];if(a.x>0&&b.x>a.x&&finite(a.db)&&finite(b.db)&&a.db>target&&b.db<=target)crossings.push(10**(Math.log10(a.x)+(target-a.db)/(b.db-a.db)*Math.log10(b.x/a.x)));}
    return crossings.length?{frequency:crossings[0],tau:1/(2*Math.PI*crossings[0]),targetDb:target,referenceMagnitude,count:crossings.length}:null;
  }
  function reference(R,C,uR=null,uC=null,rho=0){if(!finite(R)||R<=0||!finite(C)||C<=0)throw new Error('R e C di riferimento devono essere positive.');if([uR,uC].some(u=>u!==null&&(!finite(u)||u<0)))throw new Error('Le incertezze standard di R e C non possono essere negative.');if(!finite(rho)||Math.abs(rho)>1)throw Error('Correlazione R/C non valida.');return{tau:R*C,frequency:1/(2*Math.PI*R*C),uTau:uR!==null&&uC!==null?Math.sqrt(Math.max(0,(C*uR)**2+(R*uC)**2+2*rho*R*C*uR*uC)):null};}
  function interpolate(data,x){if(!data.length||x<data[0].x||x>data.at(-1).x)return NaN;let lo=0,hi=data.length;while(lo<hi){const m=(lo+hi)>>1;if(data[m].x<=x)lo=m+1;else hi=m;}const a=data[Math.max(0,lo-1)],b=data[lo];return !b||a.x===x?a.y:a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);}
  function simpleReference(doc,topology){
    const parts=doc.components.filter(c=>!['G','J'].includes(c.type));if(parts.length!==3)return null;
    const R=parts.find(c=>c.type==='R'),C=parts.find(c=>c.type==='C'),V=parts.find(c=>c.type==='V');if(!R||!C||!V||!doc.probes.output)return null;const n=topology.nodes,out=n[doc.probes.output],ca=n[C.id+':a'],cb=n[C.id+':b'],ra=n[R.id+':a'],rb=n[R.id+':b'],vp=n[V.id+':p'];
    if(out<0||n[V.id+':n']!==-1||!((ca===out&&cb===-1)||(cb===out&&ca===-1))||!((ra===out&&rb===vp)||(rb===out&&ra===vp))||vp===out||vp<0)return null;
    return{R:R.value,C:C.value,tau:R.value*C.value,onePole:true,dcGain:1};
  }
  function csvCell(v){if(v===null||v===undefined)return'';if(typeof v==='number')return finite(v)?v.toExponential(12):'';let s=String(v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return'"'+s.replaceAll('"','""')+'"';}
  const csv=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  function demo(){return Array.from({length:11},(_,i)=>({x:i*.0005,y:.2+5*Math.exp(-i*.5)+.008*Math.sin(i*2.1),sigma:.01}));}
  return{UNITS,LIMIT,number,rows,parseTable,validatePoints,segments,fit,threshold,cutoff,reference,interpolate,simpleReference,csv,demo};
});
