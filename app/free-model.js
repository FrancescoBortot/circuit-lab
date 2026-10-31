/* Modified nodal analysis for the free circuit editor. All topology comes from
   explicit terminal-to-terminal wires. No hidden ground or leakage is added. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./local-projects.js'),require('./semiconductors.js'));
  else root.FreeModel=factory(root.LocalProjects,root.Semiconductors);
})(typeof globalThis!=='undefined'?globalThis:this,function(Files,Semi){
  'use strict';
  const clone=o=>JSON.parse(JSON.stringify(o));
  const PINS={R:['a','b'],C:['a','b'],L:['a','b'],V:['p','n'],I:['p','n'],U:['plus','minus','out'],G:['g'],J:['j'],D:['a','b'],Q:['c','b','e'],M:['d','g','s']};
  const NAMES={R:'Resistenza',C:'Condensatore',L:'Induttore',V:'Generatore di tensione',I:'Generatore di corrente',U:'Operazionale',G:'Massa',J:'Giunzione',D:'Diodo',Q:'Transistor BJT',M:'MOSFET'};
  const wave=()=>({kind:'step',level:5,vpp:2,frequency:1000,offset:0,phase:0,duty:50,delay:0,width:.002});
  function blank(){return{application:'Circuit Lab',version:3,mode:'free',name:'Circuito senza titolo',components:[],wires:[],probes:{input:null,output:null},settings:{duration:.006,samples:2400,fmin:10,fmax:1e6,acSource:null,analysis:'time'}};}
  function component(type,id,x=200,y=160){
    const c={id,type,x,y,rotation:0};
    if(type==='R')c.value=10000;
    if(type==='C'){c.value=100e-9;c.initial=0;}
    if(type==='L'){c.value=.01;c.initial=0;}
    if(type==='V'||type==='I'){c.wave=wave();if(type==='I'){c.wave.level=.001;c.wave.vpp=.002;}}
    if(type==='D')Object.assign(c,{is:35e-12,n:1.5});if(type==='Q')Object.assign(c,{polarity:'n',is:1e-14,bf:100,br:1});if(type==='M')Object.assign(c,{polarity:'n',kp:.001,vto:1.5,lambda:.02,bodyIs:1e-14});
    if(type==='U')Object.assign(c,{model:'limited',a0:200000,gbw:4e6,rail:15,headroom:1.5});
    return c;
  }
  function validPin(doc,p){if(typeof p!=='string')return false;const [id,pin,...rest]=p.split(':');return !rest.length&&doc.components.some(c=>c&&c.id===id&&Object.hasOwn(PINS,c.type)&&PINS[c.type].includes(pin));}
  function validate(doc){
    const errors=[];
    if(!doc||doc.application!=='Circuit Lab'||doc.version!==3||doc.mode!=='free')return['Il file non è un circuito libero di Circuit Lab.'];
    if(doc.name!==undefined&&(typeof doc.name!=='string'||doc.name.length>80))return['Il nome del progetto ammette fino a 80 caratteri.'];
    try{Files.checkNotebook(doc.notebookStudy);Files.checkComparison(doc.comparisonStudy);Files.checkAssembly(doc.assemblyStudy);Files.checkWorkspace(doc.workspace);Files.checkRCStudy(doc.rcStudy);Files.checkACStudy(doc.acStudy);Files.checkOpampStudy(doc.opampStudy);Files.checkMetrologyStudy(doc.metrologyStudy);Files.checkParameterStudy(doc.parameterStudy);}catch(e){return[e.message];}
    if(!Array.isArray(doc.components)||!Array.isArray(doc.wires)||doc.components.length>(doc.benchSetup?120:40)||doc.wires.length>(doc.benchSetup?240:120))return['Il progetto ammette fino a 40 componenti e 120 fili.'];
    const ids=new Set();
    for(const c of doc.components){
      if(!c||!Object.hasOwn(PINS,c.type)||typeof c.id!=='string'||!(/^[A-Z][A-Za-z0-9_]{0,15}$/).test(c.id)||ids.has(c.id)){errors.push('Tipo o identificativo del componente non valido o duplicato.');continue;}ids.add(c.id);
      if(![c.x,c.y,c.rotation].every(Number.isFinite)||Math.abs(c.x)>10000||Math.abs(c.y)>10000||![0,90,180,270].includes(c.rotation))errors.push(c.id+': posizione non valida.');
      if(['R','C','L'].includes(c.type)&&(!Number.isFinite(c.value)||c.value<=0||c.value>(c.type==='R'?1e10:c.type==='C'?1:1e4)||c.value<(c.type==='R'?.01:c.type==='C'?1e-14:1e-9)))errors.push(c.id+': valore fuori intervallo.');
      if(['C','L'].includes(c.type)&&(!Number.isFinite(c.initial)||Math.abs(c.initial)>1000))errors.push(c.id+': condizione iniziale non valida.');
      if(['V','I'].includes(c.type)){
        const w=c.wave;
        if(!w||!['step','pulse','pwl','sine','square','triangle','dc'].includes(w.kind)||!['level','vpp','frequency','offset','phase','duty','delay'].every(k=>Number.isFinite(w[k]))){errors.push(c.id+': segnale non valido.');continue;}
        if(w.kind==='pwl'&&(!Array.isArray(w.points)||w.points.length<2||w.points.length>256||w.points.some((p,i)=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>100||Math.abs(p[1])>1000||i===0&&p[0]!==0||i>0&&p[0]<=w.points[i-1][0])))errors.push(c.id+': PWL richiede 2–256 punti t/valore, primo t = 0 e tempi crescenti in secondi.');
        if([w.low,w.rise,w.fall,w.period].some(v=>v!==undefined&&!Number.isFinite(v))||w.low!==undefined&&Math.abs(w.low)>1000||[w.rise,w.fall,w.period].some(v=>v!==undefined&&(v<0||v>100))||w.kind==='pulse'&&w.period>0&&w.period<(w.rise||0)+w.width+(w.fall||0))errors.push(c.id+': fronti o periodo dell’impulso non validi.');
        if(w.kind==='pulse'&&(!Number.isFinite(w.width)||w.width<=0||w.width>100))errors.push(c.id+': durata dell’impulso non valida.');
        if(w.dc!==undefined&&(!Number.isFinite(w.dc)||Math.abs(w.dc)>1000))errors.push(c.id+': polarizzazione DC non valida.');
        if(w.polarity!==undefined&&![1,-1].includes(w.polarity))errors.push(c.id+': polarità non valida.');
        if(w.vpp<0||w.vpp>1000||Math.abs(w.level)>1000||Math.abs(w.offset)>1000||w.frequency<.01||w.frequency>1e8||Math.abs(w.phase)>360||w.duty<=0||w.duty>=100||w.delay<0||w.delay>100)errors.push(c.id+': parametri del segnale fuori intervallo.');
      }
      if(['D','Q','M'].includes(c.type)){const limits=c.type==='D'?[['is',1e-20,.001],['n',.5,4]]:c.type==='Q'?[['is',1e-20,.001],['bf',1,10000],['br',.1,1000]]:[['kp',1e-9,1],['vto',.01,20],['lambda',0,10],['bodyIs',1e-20,.001]];if(limits.some(([key,min,max])=>!Number.isFinite(c[key])||c[key]<min||c[key]>max)||c.type!=='D'&&!['n','p'].includes(c.polarity))errors.push(c.id+': parametri del modello didattico non validi.');}
      if(c.type==='U'&&(!['ideal','limited','physical'].includes(c.model)||!Number.isFinite(c.a0)||c.a0<10||c.a0>1e8||!Number.isFinite(c.gbw)||c.gbw<10||c.gbw>1e9||!Number.isFinite(c.rail)||c.rail<1||c.rail>30||!Number.isFinite(c.headroom)||c.headroom<0||c.headroom>=c.rail))errors.push(c.id+': parametri dell’operazionale non validi.');
      if(c.type==='U'&&c.model==='physical'){const q=physical(c);if(![q.positive,q.negative,q.slew,q.rout,q.ilimit].every(Number.isFinite)||q.positive>1000||q.negative< -1000||q.positive-q.negative<=2*c.headroom||q.slew<1||q.slew>1e10||q.rout<.01||q.rout>1e6||q.ilimit<1e-9||q.ilimit>100)errors.push(c.id+': alimentazioni o limiti fisici non validi.');}
    }
    if(errors.length)return [...new Set(errors)];
    const wireIDs=new Set();
    for(const w of doc.wires){if(!w||typeof w.id!=='string'||!(/^[A-Za-z][A-Za-z0-9_]{0,20}$/).test(w.id)||wireIDs.has(w.id)||!validPin(doc,w.a)||!validPin(doc,w.b)||w.a===w.b||(w.route!==undefined&&!['auto','horizontal','vertical'].includes(w.route))||(w.offset!==undefined&&(!Number.isFinite(w.offset)||Math.abs(w.offset)>2000)))errors.push('Un filo ha terminali, percorso o identificativo non validi.');wireIDs.add(w?.id);}
    if(doc.traces!==undefined){
      const traceIDs=new Set();
      if(!Array.isArray(doc.traces)||doc.traces.length>8)errors.push('Sono ammesse fino a 8 sonde aggiuntive.');
      else for(const t of doc.traces){
        if(!t||!/^P[1-9][0-9]*$/.test(t.id)||traceIDs.has(t.id)||!['voltage','current'].includes(t.kind))errors.push('Sonda aggiuntiva non valida.');
        else if(t.kind==='voltage'&&(!validPin(doc,t.positive)||(t.negative!==null&&!validPin(doc,t.negative))))errors.push(t.id+': nodo della sonda non valido.');
        else if(t.kind==='current'&&!doc.components.some(c=>c.id===t.component&&['R','C','L','V','I','U','D','Q','M'].includes(c.type)))errors.push(t.id+': componente della sonda non valido.');
        if(t?.kind==='current'&&t.terminal!==undefined){const part=doc.components.find(c=>c.id===t.component);if(!part||!['D','Q','M'].includes(part.type)||!PINS[part.type].includes(t.terminal))errors.push(t.id+': terminale di corrente non valido.');}
        traceIDs.add(t?.id);
      }
    }
    const s=doc.settings;
    for(const key of ['probeScaleInput','probeScaleOutput'])if(s?.[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<=0||s[key]>1000))errors.push('Scala della sonda non valida.');
    if(s?.dcSource!==undefined&&s.dcSource!==null&&!doc.components.some(c=>c.id===s.dcSource&&['V','I'].includes(c.type)))errors.push('Sorgente DC non valida.');
    if([s?.dcStart,s?.dcStop].some(v=>v!==undefined&&(!Number.isFinite(v)||Math.abs(v)>1000))||s?.dcPoints!==undefined&&(!Number.isInteger(s.dcPoints)||s.dcPoints<2||s.dcPoints>1001))errors.push('Intervallo o punti DC non validi.');
    if(s?.integration!==undefined&&!['fixed','adaptive'].includes(s.integration))errors.push('Metodo di integrazione non valido.');
    for(const [key,min,max] of [['rtol',1e-8,.01],['atolV',1e-12,.01],['atolI',1e-15,.001]])if(s?.[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<min||s[key]>max))errors.push('Tolleranza numerica fuori intervallo: '+key+'.');
    if(!s||!Number.isFinite(s.duration)||s.duration<1e-10||s.duration>100||!Number.isInteger(s.samples)||s.samples<400||s.samples>12000||!Number.isFinite(s.fmin)||!Number.isFinite(s.fmax)||s.fmin<=0||s.fmax<=s.fmin||s.fmax>1e9||!['time','bode','op','dc'].includes(s.analysis))errors.push('Impostazioni dell’analisi non valide.');
    if(doc.nodeLabels!==undefined){if(!doc.nodeLabels||typeof doc.nodeLabels!=='object'||Array.isArray(doc.nodeLabels)||Object.keys(doc.nodeLabels).length>80)errors.push('Nomi dei nodi non validi.');else for(const [pin,label]of Object.entries(doc.nodeLabels))if(!validPin(doc,pin)||typeof label!=='string'||label!==label.trim()||!label.trim()||!(/^[\p{L}\p{N}_ .+−-]{1,24}$/u).test(label))errors.push('Nome di nodo non valido: massimo 24 caratteri.');}
    if(s?.acWeights!==undefined){const w=s.acWeights;if(!w||typeof w!=='object'||Array.isArray(w)||!Object.keys(w).length||Object.keys(w).length>40||Object.entries(w).some(([id,v])=>!doc.components.some(c=>c.id===id&&['V','I'].includes(c.type))||!Number.isFinite(v)||Math.abs(v)>1000)||!Object.values(w).some(v=>v!==0))errors.push('Eccitazioni AC non valide.');else if(new Set(doc.components.filter(c=>w[c.id]).map(c=>c.type)).size>1)errors.push('Usa eccitazioni AC tutte di tensione oppure tutte di corrente.');}
    if(s?.acGrid!==undefined&&!['legacy','decade','octave','linear'].includes(s.acGrid))errors.push('Griglia AC non valida.');
    if(s?.acPoints!==undefined&&(!Number.isInteger(s.acPoints)||s.acPoints<2||s.acPoints>2000))errors.push('Densità AC ammessa: 2–2000 punti.');
    if(s?.acPhases!==undefined&&(!s.acPhases||typeof s.acPhases!=='object'||Array.isArray(s.acPhases)||Object.keys(s.acPhases).length>40||Object.entries(s.acPhases).some(([id,v])=>!doc.components.some(c=>c.id===id&&['V','I'].includes(c.type))||!Number.isFinite(v)||Math.abs(v)>360)))errors.push('Fasi delle eccitazioni AC non valide.');
    if(s?.acReference!==undefined&&!['source','input'].includes(s.acReference))errors.push('Riferimento AC non valido.');
    if(s?.acReference==='input'&&!doc.probes?.input)errors.push('Scegli la sonda IN per il riferimento AC.');
    if(!doc.probes||['input','output'].some(k=>doc.probes[k]!==null&&!validPin(doc,doc.probes[k])))errors.push('Punto di misura non valido.');
    if(s?.acSource!==null&&!doc.components.some(c=>['V','I'].includes(c.type)&&c.id===s.acSource))errors.push('Sorgente Bode non valida.');
    if(!errors.length&&doc.nodeLabels){const t=topology(doc),seen=new Map();if(Object.keys(doc.nodeLabels).some(pin=>t.nodes[pin]<0))errors.push('La massa mantiene il riferimento 0 V.');for(const n of t.groups){const labels=[...new Set(Object.entries(doc.nodeLabels).filter(([pin])=>t.nodes[pin]===n.index).map(([,label])=>label))];if(labels.length>1)errors.push('La rete unisce nomi diversi: rimuovi un nome prima di collegarla.');for(const label of labels){if(/^N[0-9]+$/.test(label))errors.push('I nomi N1, N2… sono riservati alla numerazione automatica.');if(seen.has(label)&&seen.get(label)!==n.index)errors.push('Lo stesso nome non può indicare due nodi separati.');seen.set(label,n.index);}}}
    return [...new Set(errors)];
  }
  function topology(doc){
    const pins=doc.components.flatMap(c=>PINS[c.type].map(p=>c.id+':'+p)),parent=new Map(pins.map(p=>[p,p]));
    const find=p=>{let q=p;while(parent.get(q)!==q)q=parent.get(q);while(parent.get(p)!==p){const n=parent.get(p);parent.set(p,q);p=n;}return q;};
    const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
    for(const w of doc.wires)join(w.a,w.b);
    const grounds=doc.components.filter(c=>c.type==='G').map(c=>c.id+':g');for(const p of grounds.slice(1))join(grounds[0],p);
    const ground=grounds.length?find(grounds[0]):null,roots=[...new Set(pins.map(find))],map=new Map();let index=0;
    if(ground)map.set(ground,-1);for(const p of roots)if(p!==ground)map.set(p,index++);
    const nodes=Object.fromEntries(pins.map(p=>[p,map.get(find(p))]));
    const groups=Array.from({length:index},(_,i)=>{const members=pins.filter(p=>nodes[p]===i),labels=Object.entries(doc.nodeLabels||{}).filter(([pin])=>members.includes(pin)).map(([,name])=>name);return{index:i,name:'N'+(i+1),label:labels[0]||'N'+(i+1),pins:members};});
    return{nodes,groups,count:index,ground:grounds.length>0};
  }
  function diagnostics(doc){
    const errors=validate(doc).map(message=>({message}));if(errors.length)return errors;
    if(!doc.components.length)return[{message:'Aggiungi i componenti per iniziare.',add:'V'}];
    const t=topology(doc);
    if(!t.ground)errors.push({message:'Aggiungi una massa e collegala al circuito.',add:'G'});
    for(const c of doc.components){if(['G','J'].includes(c.type))continue;for(const pin of PINS[c.type]){
      const ref=c.id+':'+pin,n=t.nodes[ref];
      if(c.type==='U'&&pin==='out')continue;
      const count=Object.values(t.nodes).filter(i=>i===n).length;
      if(count<2)errors.push({message:c.id+': terminale '+pinLabel(c.type,pin)+' non collegato.',pin:ref,component:c.id});
    }}
    if(!doc.components.some(c=>['V','I'].includes(c.type)))errors.push({message:'Aggiungi almeno un generatore.',add:'V'});
    if(!doc.probes.output&&doc.settings.analysis!=='op')errors.push({message:'Scegli il nodo di uscita con la sonda OUT.',tool:'output'});
    return errors;
  }
  const issues=doc=>diagnostics(doc).map(d=>d.message);
  function pinLabel(type,pin){if(type==='D')return pin==='a'?'A · anodo':'K · catodo';if(type==='Q')return{c:'C',b:'B',e:'E'}[pin];if(type==='M')return{d:'D',g:'G',s:'S / corpo'}[pin];return{a:'A',b:'B',p:'+',n:'−',plus:'+',minus:'−',out:'OUT',g:'massa',j:'nodo'}[pin]||pin;}
  const zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
  const physical=c=>({positive:c.positive??c.rail,negative:c.negative??-c.rail,slew:c.slew??1e6,rout:c.rout??50,ilimit:c.ilimit??.02});
  function assemble(doc){
    const errors=issues(doc);if(errors.length)throw new Error(errors[0]);
    const topo=topology(doc),branches=doc.components.filter(c=>['V','L','U'].includes(c.type)),physicalAmps=doc.components.filter(c=>c.type==='U'&&c.model==='physical'),stateIndex=new Map(physicalAmps.map((c,i)=>[c.id,topo.count+branches.length+i])),N=topo.count+branches.length+physicalAmps.length;
    const G=zeros(N),E=zeros(N),index=new Map(branches.map((c,i)=>[c.id,topo.count+i]));
    const node=(c,p)=>topo.nodes[c.id+':'+p];
    const stamp=(A,a,b,v)=>{if(a>=0)A[a][a]+=v;if(b>=0)A[b][b]+=v;if(a>=0&&b>=0){A[a][b]-=v;A[b][a]-=v;}};
    for(const c of doc.components){const a=node(c,['V','I'].includes(c.type)?'p':'a'),b=node(c,['V','I'].includes(c.type)?'n':'b'),k=index.get(c.id);
      if(c.type==='R')stamp(G,a,b,1/c.value);
      if(c.type==='C')stamp(E,a,b,c.value);
      if(c.type==='V'||c.type==='L'){if(a>=0){G[a][k]+=1;G[k][a]+=1;}if(b>=0){G[b][k]-=1;G[k][b]-=1;}if(c.type==='L')E[k][k]=-c.value;}
      if(c.type==='U'){
        const out=node(c,'out'),plus=node(c,'plus'),minus=node(c,'minus');if(out>=0)G[out][k]+=1;
        if(c.model==='ideal'){if(plus>=0)G[k][plus]=-1;if(minus>=0)G[k][minus]+=1;}
        else if(c.model==='physical'){const z=stateIndex.get(c.id),q=physical(c);if(out>=0)G[k][out]=1;G[k][z]=-1;G[k][k]=-q.rout;G[z][z]=1;E[z][z]=c.a0/(2*Math.PI*c.gbw);if(plus>=0)G[z][plus]-=c.a0;if(minus>=0)G[z][minus]+=c.a0;}
        else{if(out>=0){G[k][out]=1;E[k][out]=c.a0/(2*Math.PI*c.gbw);}if(plus>=0)G[k][plus]-=c.a0;if(minus>=0)G[k][minus]+=c.a0;}
      }
    }
    return{doc,topo,G,E,N,index,node,stateIndex,nonlinear:doc.components.filter(c=>['D','Q','M'].includes(c.type))};
  }
  function factor(matrix){
    const A=matrix.map(r=>r.slice()),n=A.length,pivots=[],scale=A.map(r=>Math.max(...r.map(Math.abs)));
    for(let k=0;k<n;k++){
      let p=k,best=0;for(let i=k;i<n;i++){const ratio=scale[i]?Math.abs(A[i][k])/scale[i]:0;if(ratio>best){best=ratio;p=i;}}
      if(best<1e-12||!Number.isFinite(best))throw new Error('Circuito non determinato: controlla nodi flottanti, cortocircuiti e generatori ideali in parallelo.');
      pivots.push(p);[A[k],A[p]]=[A[p],A[k]];[scale[k],scale[p]]=[scale[p],scale[k]];
      for(let i=k+1;i<n;i++){A[i][k]/=A[k][k];for(let j=k+1;j<n;j++)A[i][j]-=A[i][k]*A[k][j];}
    }
    return rhs=>{const x=rhs.slice();for(let k=0;k<n;k++){const p=pivots[k];[x[k],x[p]]=[x[p],x[k]];}for(let k=0;k<n;k++)for(let i=k+1;i<n;i++)x[i]-=A[i][k]*x[k];for(let i=n-1;i>=0;i--){for(let j=i+1;j<n;j++)x[i]-=A[i][j]*x[j];x[i]/=A[i][i];if(!Number.isFinite(x[i])||Math.abs(x[i])>1e15)throw new Error('Soluzione fuori scala: controlla retroazione, valori e collegamenti.');}return x;};
  }
  function sourceValue(w,t,side='right',slope=false){
    if(w.kind==='dc')return slope?0:w.level;
    if(w.kind==='pwl'){const points=w.points;if(t<points[0][0]||t===points[0][0]&&side==='left')return slope?0:points[0][1];if(t>points.at(-1)[0]||t===points.at(-1)[0]&&side!=='left')return slope?0:points.at(-1)[1];let lo=0,hi=points.length-1;while(hi-lo>1){const k=(lo+hi)>>1;if(points[k][0]<t||points[k][0]===t&&side!=='left')lo=k;else hi=k;}const a=points[lo],b=points[hi],rate=(b[1]-a[1])/(b[0]-a[0]);return slope?rate:a[1]+rate*(t-a[0]);}
    if(['step','pulse'].includes(w.kind)){
      const low=w.low??0,rise=w.rise??0,fall=w.fall??0;if(t<w.delay||t===w.delay&&side==='left')return slope?0:low;
      let x=t-w.delay;if(w.kind==='pulse'&&w.period>0){const q=x/w.period,nearest=Math.round(q),epsilon=16*Number.EPSILON*Math.max(1,Math.abs(q));x=Math.abs(q-nearest)<epsilon?(side==='left'&&nearest>0?w.period:0):x%w.period;}
      const epsilon=16*Number.EPSILON*Math.max(Math.abs(t),Math.abs(w.delay),w.period||0,rise+(w.width||0)+fall,1e-300);for(const edge of [0,rise,rise+(w.width||0),rise+(w.width||0)+fall])if(Math.abs(x-edge)<=epsilon){x=edge;break;}
      if(rise>0&&(x<rise||x===rise&&side==='left'))return slope?(w.level-low)/rise:low+(w.level-low)*x/rise;
      if(w.kind==='step')return slope?0:w.level;
      if(x<rise+w.width||x===rise+w.width&&side==='left')return slope?0:w.level;
      if(fall>0&&(x<rise+w.width+fall||x===rise+w.width+fall&&side==='left'))return slope?(low-w.level)/fall:w.level+(low-w.level)*(x-rise-w.width)/fall;
      return slope?0:low;
    }
    let q=t*w.frequency+w.phase/360;if(side==='left')q-=1e-12;q=((q%1)+1)%1;
    if(slope)return w.vpp/2*(w.kind==='sine'?2*Math.PI*w.frequency*Math.cos(2*Math.PI*q):w.kind==='square'?0:(q<.25||q>.75?4:-4)*w.frequency);
    return w.offset+w.vpp/2*(w.kind==='sine'?Math.sin(2*Math.PI*q):w.kind==='square'?(q<w.duty/100?1:-1):q<.25?4*q:q<.75?2-4*q:4*q-4);
  }
  const source=(w,t,side='right')=>(w.polarity??1)*sourceValue(w,t,side),sourceSlope=(w,t,side='right')=>(w.polarity??1)*sourceValue(w,t,side,true);
  function rhs(s,t,side='right',ac=null){
    const r=Array(s.N).fill(0);
    for(const c of s.doc.components){if(!['V','I'].includes(c.type))continue;const value=ac===null?source(c.wave,t,side):typeof ac==='object'?(ac[c.id]||0):c.id===ac?1:0;
      if(c.type==='V')r[s.index.get(c.id)]=value;
      else{const a=s.node(c,'p'),b=s.node(c,'n');if(a>=0)r[a]-=value;if(b>=0)r[b]+=value;}
    }return r;
  }
  const voltage=(s,x,ref)=>ref&&s.topo.nodes[ref]>=0?x[s.topo.nodes[ref]]:0;
  const difference=(s,x,c,a,b)=>voltage(s,x,c.id+':'+a)-voltage(s,x,c.id+':'+b);
  // Independent capacitor constraints avoid redundant initial voltage sources
  // for parallel capacitors, while rejecting inconsistent initial conditions.
  // An ideal amplifier can fix an output capacitor voltage through resistive
  // feedback. Redundant IC current multipliers must not invalidate unique
  // node voltages. Accept rank deficiency only in source/IC currents.
  function initialFactor(s,matrix){
    try{return factor(matrix);}catch(original){if(s.nonlinear.length||matrix.length===s.N)throw original;
      return rhs=>{const n=matrix.length,A=matrix.map((row,i)=>{const scale=Math.max(...row.map(Math.abs),1e-300);return row.map(v=>v/scale).concat(rhs[i]/scale);}),columns=Array.from({length:n},(_,j)=>Math.max(...A.map(row=>Math.abs(row[j])),1e-300));
        for(const row of A)for(let j=0;j<n;j++)row[j]/=columns[j];
        const pivots=[];let rank=0;for(let j=0;j<n;j++){let p=rank;for(let i=rank;i<n;i++)if(Math.abs(A[i][j])>Math.abs(A[p]?.[j]||0))p=i;if(p>=n||Math.abs(A[p][j])<1e-11)continue;[A[p],A[rank]]=[A[rank],A[p]];const pivot=A[rank][j];for(let k=j;k<=n;k++)A[rank][k]/=pivot;for(let i=0;i<n;i++)if(i!==rank){const q=A[i][j];for(let k=j;k<=n;k++)A[i][k]-=q*A[rank][k];}pivots.push(j);rank++;}
        for(let i=rank;i<n;i++)if(Math.abs(A[i][n])>1e-7*Math.max(1,...rhs.map(Math.abs)))throw new Error('Tensioni iniziali incompatibili con i vincoli del circuito ideale.');
        const fixed=new Set(pivots),free=Array.from({length:n},(_,i)=>i).filter(i=>!fixed.has(i)),required=new Set([...Array.from({length:s.topo.count},(_,i)=>i),...s.stateIndex.values(),...s.doc.components.filter(c=>c.type==='L').map(c=>s.index.get(c.id))]),unknown=new Set();
        for(const col of free){const direction=Array(n).fill(0);direction[col]=1;for(let i=0;i<rank;i++)direction[pivots[i]]=-A[i][col];if([...required].some(k=>Math.abs(direction[k])>1e-9))throw original;for(const c of s.doc.components.filter(c=>c.type==='V'||c.type==='U'))if(Math.abs(direction[s.index.get(c.id)])>1e-9)unknown.add(c.id);}
        s.initialUnknownCurrents=[...new Set([...(s.initialUnknownCurrents||[]),...unknown])];const x=Array(n).fill(0);for(let i=0;i<rank;i++)x[pivots[i]]=A[i][n]/columns[pivots[i]];
        if(x.some(v=>!Number.isFinite(v)||Math.abs(v)>1e15))throw original;
        for(let i=0;i<n;i++){const value=matrix[i].reduce((sum,a,j)=>sum+a*x[j],0),scale=Math.max(1,Math.abs(rhs[i]),matrix[i].reduce((sum,a,j)=>sum+Math.abs(a*x[j]),0));if(Math.abs(value-rhs[i])>1e-7*scale)throw original;}return x;
      };
    }
  }
  function initial(s,t=0,previous=null){
    const G=s.G.map(r=>r.slice()),r=rhs(s,t),constraints=[],edges=new Map(),slopeEdges=new Map();
    const edge=(a,b,v)=>{if(!edges.has(a))edges.set(a,[]);if(!edges.has(b))edges.set(b,[]);edges.get(a).push([b,-v]);edges.get(b).push([a,v]);};
    const slopeEdge=(a,b,value)=>{if(!slopeEdges.has(a))slopeEdges.set(a,[]);if(!slopeEdges.has(b))slopeEdges.set(b,[]);slopeEdges.get(a).push([b,-value]);slopeEdges.get(b).push([a,value]);};
    const imposedSlope=(a,b)=>{const queue=[[a,0]],seen=new Set();for(let i=0;i<queue.length;i++){const[node,value]=queue[i];if(node===b)return-value;if(seen.has(node))continue;seen.add(node);for(const[to,delta]of slopeEdges.get(node)||[])if(!seen.has(to))queue.push([to,value+delta]);}return null;};
    const existing=(a,b)=>{const queue=[[a,0]],seen=new Set();for(let i=0;i<queue.length;i++){const[n,v]=queue[i];if(n===b)return-v;if(seen.has(n))continue;seen.add(n);for(const[k,d]of edges.get(n)||[])if(!seen.has(k))queue.push([k,v+d]);}return null;};
    for(const c of s.doc.components){const k=s.index.get(c.id);
      if(c.type==='V'){edge(s.node(c,'p'),s.node(c,'n'),r[k]);slopeEdge(s.node(c,'p'),s.node(c,'n'),sourceSlope(c.wave,t));}
      if(c.type==='L'){G[k].fill(0);G[k][k]=1;r[k]=previous?previous[k]:c.initial;}
      if(c.type==='U'){
        if(c.model==='ideal'){edge(s.node(c,'plus'),s.node(c,'minus'),0);slopeEdge(s.node(c,'plus'),s.node(c,'minus'),0);}
        else if(c.model==='physical'){const z=s.stateIndex.get(c.id);G[z].fill(0);G[z][z]=1;r[z]=previous?previous[z]:Math.max(physical(c).negative+c.headroom,Math.min(physical(c).positive-c.headroom,0));}
        else{const out=s.node(c,'out'),value=previous?voltage(s,previous,c.id+':out'):0;G[k].fill(0);if(out>=0)G[k][out]=1;r[k]=value;edge(out,-1,value);}
      }
    }
    for(const c of s.doc.components.filter(c=>c.type==='C')){
      const a=s.node(c,'a'),b=s.node(c,'b'),v=previous?difference(s,previous,c,'a','b'):c.initial,old=existing(a,b);
      if(old!==null){if(Math.abs(old-v)>1e-7*Math.max(1,Math.abs(v),Math.abs(old)))throw new Error(c.id+': tensione iniziale incompatibile con il generatore o con altri condensatori.');}
      else{constraints.push([a,b,v]);edge(a,b,v);}
    }
    s.initialCurrents={};for(const c of s.doc.components.filter(c=>c.type==='C')){const a=s.node(c,'a'),b=s.node(c,'b'),rate=imposedSlope(a,b);if(rate===null)continue;const current=c.value*rate;s.initialCurrents[c.id]=current;if(a>=0)r[a]-=current;if(b>=0)r[b]+=current;}
    // A chain of capacitors may fix initial voltages without determining
    // the split of displacement currents. Do not report a fictitious
    // generator current where the IC system cannot determine it.
    const relations=[];for(const c of s.doc.components){if(c.type==='V')relations.push({a:s.node(c,'p'),b:s.node(c,'n'),id:c.id,unknown:false});if(c.type==='C')relations.push({a:s.node(c,'a'),b:s.node(c,'b'),id:c.id,unknown:!Object.hasOwn(s.initialCurrents,c.id)});if(c.type==='U'&&c.model==='ideal')relations.push({a:s.node(c,'plus'),b:s.node(c,'minus'),id:c.id,unknown:false});if(c.type==='U'&&c.model==='limited')relations.push({a:s.node(c,'out'),b:-1,id:c.id,unknown:true});}
    s.initialUnknownCurrents=[];for(const c of s.doc.components.filter(c=>c.type==='V'||c.type==='U'&&c.model!=='physical')){const a=s.node(c,c.type==='V'?'p':'out'),b=c.type==='V'?s.node(c,'n'):-1,queue=[[a,false]],seen=new Set();let uncertain=false;for(let i=0;i<queue.length;i++){const[node,unknown]=queue[i],key=node+'|'+unknown;if(seen.has(key))continue;seen.add(key);if(node===b&&unknown){uncertain=true;break;}for(const edge of relations){if(edge.id===c.id)continue;const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next!==null)queue.push([next,unknown||edge.unknown]);}}if(uncertain)s.initialUnknownCurrents.push(c.id);}
    const n=s.N+constraints.length;for(const row of G)while(row.length<n)row.push(0);while(G.length<n)G.push(Array(n).fill(0));while(r.length<n)r.push(0);
    constraints.forEach(([a,b,v],i)=>{const k=s.N+i;if(a>=0){G[a][k]=1;G[k][a]=1;}if(b>=0){G[b][k]=-1;G[k][b]=-1;}r[k]=v;});
    const amps=s.doc.components.filter(c=>c.type==='U'&&c.model==='physical');let active=new Map(),solution;
    for(let iteration=0;iteration<32;iteration++){const A=G.map(row=>row.slice()),right=r.slice();for(const[k,current]of active){A[k].fill(0);A[k][k]=1;right[k]=current;}solution=Semi.solve(s,A,right,matrix=>initialFactor(s,matrix),solution||previous);const changed=new Map();for(const c of amps){const k=s.index.get(c.id),q=physical(c),current=(voltage(s,solution,c.id+':out')-solution[s.stateIndex.get(c.id)])/q.rout;if(Math.abs(current)>q.ilimit+1e-10)changed.set(k,Math.sign(current)*q.ilimit);}if(changed.size===active.size&&[...changed].every(([k,v])=>active.get(k)===v))return solution.slice(0,s.N);active=changed;}
    throw new Error('Condizioni iniziali incompatibili con il limite di corrente dell’operazionale.');
  }
  function events(doc){const out=new Map(),duration=doc.settings.duration;
    for(const c of doc.components.filter(c=>['V','I'].includes(c.type))){const w=c.wave;
      if(['step','pulse'].includes(w.kind)&&w.delay<duration&&[w.rise,w.fall].some(v=>v>0&&v<64*Number.EPSILON*duration))throw new Error(c.id+': fronte troppo breve per questa durata. Riduci la durata o aumenta il tempo di fronte.');
      if(w.kind==='pwl'&&w.points.some((p,i)=>i>0&&w.points[i-1][0]<duration&&p[0]-w.points[i-1][0]<64*Number.EPSILON*duration))throw new Error(c.id+': punti PWL troppo vicini rispetto alla durata.');
      const add=(t,jump)=>{if(t>0&&t<duration)out.set(t,jump||out.get(t)===true);};
      if(w.kind==='pwl'){for(const [t]of w.points)add(t,false);continue;}
      if(w.kind==='step'){add(w.delay,!(w.rise>0));if(w.rise>0)add(w.delay+w.rise,false);continue;}
      if(w.kind==='pulse'){const period=w.period||0,n=period>0?Math.max(0,Math.floor((duration-w.delay)/period)):0;if(n>400)throw new Error('Riduci durata o aumenta il periodo: massimo 400 impulsi.');for(let i=0;i<=n;i++){const start=w.delay+i*period,rise=w.rise||0,fall=w.fall||0;add(start,!rise);if(rise)add(start+rise,false);add(start+rise+w.width,!fall);if(fall)add(start+rise+w.width+fall,false);}continue;}
      if(!['square','triangle'].includes(w.kind))continue;
      if(w.frequency*duration>400)throw new Error('Riduci durata o frequenza: massimo 400 periodi visibili.');
      for(let n=-2;n<=Math.ceil(duration*w.frequency)+2;n++)for(const phase of w.kind==='square'?[0,w.duty/100]:[.25,.75]){const t=(n+phase-w.phase/360)/w.frequency;if(t>0&&t<duration)out.set(t,w.kind==='square'||out.get(t)===true);}
    }return out;
  }
  function branchCurrents(s,x,t,side,derivative){
    const currents={};
    for(const c of s.doc.components){
      if(c.type==='R')currents[c.id]=difference(s,x,c,'a','b')/c.value;
      if(c.type==='C')currents[c.id]=derivative?c.value*difference(s,derivative,c,'a','b'):(s.initialCurrents?.[c.id]??NaN);
      if(['V','L','U'].includes(c.type))currents[c.id]=!derivative&&s.initialUnknownCurrents?.includes(c.id)?NaN:(c.type==='U'?-1:1)*x[s.index.get(c.id)];
      if(c.type==='I')currents[c.id]=source(c.wave,t,side);
      if(['D','Q','M'].includes(c.type)){const ports=Semi.pins[c.type],d=Semi.device(c,ports.map(p=>voltage(s,x,c.id+':'+p)));currents[c.id]=d.currents[0];for(let i=1;i<ports.length;i++)currents[c.id+':'+ports[i]]=d.currents[i];}
    }return currents;
  }
  function initialVoltages(doc){const s=assemble(doc),x=initial(s,0);return Object.fromEntries(Object.entries(s.topo.nodes).map(([pin,node])=>[pin,node<0?0:x[node]]));}
  function simulate(doc,options={}){
    const s=assemble(doc),duration=doc.settings.duration,ev=events(doc),frequencies=doc.components.filter(c=>['V','I'].includes(c.type)&&(['sine','square','triangle'].includes(c.wave.kind)||c.wave.kind==='pulse'&&c.wave.period>0)).map(c=>c.wave.kind==='pulse'?1/c.wave.period:c.wave.frequency),periods=duration*Math.max(0,...frequencies);
    if(periods>400)throw new Error('Riduci durata o frequenza: massimo 400 periodi visibili.');
    const refinement=options.refinement===2?2:1,count=options.steps===undefined?Math.min(24000,Math.max(doc.settings.samples*2,Math.ceil(periods*200)))*refinement:options.steps+1,times=[0,duration,...ev.keys(),...(options.sampleTimes||[])];if(!Number.isInteger(count)||count<2||count>96000)throw new Error('Risoluzione del calcolo non valida.');if(times.some(t=>!Number.isFinite(t)||t<0||t>duration)||times.length>10000)throw new Error('Griglia di campionamento non valida.');
    for(let i=1;i<count-1;i++)times.push(duration*i/(count-1));times.sort((a,b)=>a-b);
    const grid=times.filter((t,i)=>i===0||t-times[i-1]>64*Number.EPSILON*duration),cache=new Map(),amps=doc.components.filter(c=>c.type==='U'&&c.model!=='ideal'),data=[];
    // Two diagonally implicit stages share a factorization; the final stage
    // also supplies capacitor derivatives consistent with nodal KCL.
    if(options.initialState&&(!Array.isArray(options.initialState)||options.initialState.length!==s.N||options.initialState.some(v=>!Number.isFinite(v)||Math.abs(v)>1e15)))throw new Error('Stato iniziale del calcolo non valido.');
    const gamma=1-1/Math.sqrt(2);let x=initial(s,0,options.initialState||null),clipped=false,limits=[],maxResidual=0;
    const record=(t,side='right',derivative=null)=>{if(data.length*(s.topo.count+3*doc.components.length+doc.components.filter(c=>['C','L'].includes(c.type)).length+s.stateIndex.size+14)>4000000)throw new Error('Troppi dati per questa rete: riduci punti, durata o precisione richiesta.');const values=Object.fromEntries(s.topo.groups.map(n=>[n.name,x[n.index]]));data.push({x:t,vin:voltage(s,x,doc.probes.input)*(doc.settings.probeScaleInput??1),out:voltage(s,x,doc.probes.output)*(doc.settings.probeScaleOutput??1),clipped,limits:[...limits],states:Object.fromEntries([...s.stateIndex].map(([id,k])=>[id,x[k]])),regions:s.nonlinear.length?Semi.evaluate(s,x).regions:{},values,currents:branchCurrents(s,x,t,side,derivative)});};
    function stage(time,h,predictor,side){
      const v=rhs(s,time,side),base=s.G.map((r,j)=>r.map((g,k)=>g+s.E[j][k]/h));
      for(let j=0;j<s.N;j++)for(let k=0;k<s.N;k++)v[j]+=s.E[j][k]*predictor[k]/h;
      let active=new Map(),next,settled=false;
      const same=(a,b)=>a.size===b.size&&[...a].every(([k,c])=>b.has(k)&&b.get(k).value===c.value);
      for(let iteration=0;iteration<32;iteration++){
        const key=String(h)+'|'+[...active].map(([row,c])=>row+':'+c.column+':'+c.value).join(','),right=v.slice();let solve=s.nonlinear.length?null:cache.get(key);
        if(!solve){const A=base.map(r=>r.slice());for(const[row,c]of active){A[row].fill(0);A[row][c.column]=1;}solve=s.nonlinear.length?right=>Semi.solve(s,A,right,factor,predictor):factor(A);if(!s.nonlinear.length&&cache.size<300)cache.set(key,solve);}
        for(const[row,c]of active)right[row]=c.value;
        next=solve(right);const changed=new Map();
        for(const c of amps){
          const k=s.index.get(c.id),out=s.node(c,'out');
          if(c.model==='physical'){
            const z=s.stateIndex.get(c.id),q=physical(c),free=(v[z]-base[z].reduce((sum,a,j)=>sum+(j===z?0:a*next[j]),0))/base[z][z],lo=Math.min(q.positive-c.headroom,Math.max(q.negative+c.headroom,predictor[z]-q.slew*h)),hi=Math.max(q.negative+c.headroom,Math.min(q.positive-c.headroom,predictor[z]+q.slew*h));
            if(free>hi+1e-10)changed.set(z,{column:z,value:hi,kind:hi<q.positive-c.headroom-1e-10?'slew':'rail',id:c.id});else if(free<lo-1e-10)changed.set(z,{column:z,value:lo,kind:lo>q.negative+c.headroom+1e-10?'slew':'rail',id:c.id});
            const current=((out<0?0:next[out])-next[z])/q.rout;if(Math.abs(current)>q.ilimit+1e-10)changed.set(k,{column:k,value:Math.sign(current)*q.ilimit,kind:'current',id:c.id});
          }else{const limit=c.rail-c.headroom,free=(v[k]-base[k].reduce((sum,a,j)=>sum+(j===out?0:a*next[j]),0))/base[k][out];if(free>limit+1e-9)changed.set(k,{column:out,value:limit,kind:'rail',id:c.id});else if(free< -limit-1e-9)changed.set(k,{column:out,value:-limit,kind:'rail',id:c.id});}
        }
        if(same(changed,active)){settled=true;break;}active=changed;
      }
      if(!settled)throw new Error('L’operazionale non converge: verifica la retroazione e aumenta la risoluzione.');
      const derivative=next.map((value,i)=>(value-predictor[i])/h),r=rhs(s,time,side),nonlinear=s.nonlinear.length?Semi.evaluate(s,next).current:null;let stageResidual=0;
      for(let j=0;j<s.N;j++){
        if(active.has(j))continue;
        let residual=-r[j]+(nonlinear?.[j]||0),scale=Math.abs(r[j])+Math.abs(nonlinear?.[j]||0);for(let k=0;k<s.N;k++){const g=s.G[j][k]*next[k],e=s.E[j][k]*derivative[k];residual+=g+e;scale+=Math.abs(g)+Math.abs(e);}
        const residualFloor=100*(j<s.topo.count?(doc.settings.atolI??1e-10):(doc.settings.atolV??1e-7));stageResidual=Math.max(stageResidual,Math.abs(residual)/Math.max(residualFloor,scale));
      }
      return{x:next,derivative,clipped:active.size>0,limits:[...new Set([...active.values()].map(c=>c.id+':'+c.kind))],residual:stageResidual};
    }
    const advance=(t,dt,state,side)=>{const first=stage(t+gamma*dt,gamma*dt,state,'right'),predictor=state.map((v,k)=>v+(1-gamma)/gamma*(first.x[k]-v));const next=stage(t+dt,gamma*dt,predictor,side);next.residual=Math.max(first.residual,next.residual);next.limits=[...new Set([...first.limits,...next.limits])];next.clipped=next.limits.length>0;return next;};
    const adaptive=options.adaptive??doc.settings.integration==='adaptive';
    let rejected=0,maxErrorRatio=0,minStep=Infinity,maxStep=0,steps=0;
    const check=progress=>{if(options.cancelled?.())throw new Error('Calcolo annullato.');options.onProgress?.(progress);};
    record(0);check(0);
    if(adaptive){
      const rtol=doc.settings.rtol??1e-4,atolV=doc.settings.atolV??1e-7,atolI=doc.settings.atolI??1e-10;
      const targets=[...new Set([duration,...ev.keys(),...(options.sampleTimes||[])])].sort((a,b)=>a-b),ceiling=duration/(count-1),floor=duration*1e-13;let time=0,h=ceiling;
      for(const target of targets){
        while(time<target){
          if(++steps>200000||data.length>100000)throw new Error('Limite del calcolo adattivo raggiunto: riduci la durata o rivedi le tolleranze.');
          let dt=Math.min(h,target-time),end=time+dt;if(target-end<=Math.max(64*Number.EPSILON*duration,ceiling*1e-8)){end=target;dt=end-time;}
          if(!(dt>0)||time+dt===time)throw new Error('Passo numerico troppo piccolo rispetto alla durata.');
          const side=end===target&&ev.has(target)?'left':'right';let full,half,fine,ratio;
          try{
            full=advance(time,dt,x,side);half=advance(time,dt/2,x,'right');fine=advance(time+dt/2,dt/2,half.x,side);
            ratio=Math.max(...fine.x.map((v,k)=>Math.abs(v-full.x[k])/3/((k<s.topo.count||[...s.stateIndex.values()].includes(k)?atolV:atolI)+rtol*Math.max(Math.abs(x[k]),Math.abs(v)))));
          }catch(error){if(dt<=floor*2)throw error;rejected++;h=dt/4;continue;}
          if(!Number.isFinite(ratio))throw new Error('Stima dell’errore numerico non finita.');
          if(ratio>1){if(dt<=floor)throw new Error('Le tolleranze richieste non sono raggiungibili: riduci durata o modifica il circuito.');rejected++;h=Math.max(floor,dt*Math.max(.1,.8*ratio**(-1/3)));continue;}
          maxResidual=Math.max(maxResidual,half.residual,fine.residual);x=fine.x;clipped=half.clipped||fine.clipped;limits=[...new Set([...half.limits,...fine.limits])];time=end;minStep=Math.min(minStep,dt);maxStep=Math.max(maxStep,dt);maxErrorRatio=Math.max(maxErrorRatio,ratio);record(time,side,fine.derivative);
          h=Math.min(ceiling,dt*Math.min(3,Math.max(.2,.9*(ratio||1e-12)**(-1/3))));
          if(steps%32===0)check(time/duration);
        }
        if(ev.has(target)){x=initial(s,target,x);record(target);}
      }
    }else for(let i=1;i<grid.length;i++){
      const t=grid[i],dt=t-grid[i-1],next=advance(grid[i-1],dt,x,ev.has(t)?'left':'right');
      maxResidual=Math.max(maxResidual,next.residual);x=next.x;clipped=next.clipped;limits=next.limits;record(t,ev.has(t)?'left':'right',next.derivative);minStep=Math.min(minStep,dt);maxStep=Math.max(maxStep,dt);steps++;
      if(ev.has(t)){x=initial(s,t,x);record(t);}
      if(i%64===0)check(t/duration);
    }
    check(1);
    if(!Number.isFinite(maxResidual)||maxResidual>1e-5){const error=new Error('Precisione numerica insufficiente: controlla valori e collegamenti oppure aumenta la risoluzione.');error.details={maxResidual,minStep,maxStep,steps,rejected,finalTime:data.at(-1)?.x};throw error;}
    return quantities(doc,{data,warnings:data.some(row=>Object.values(row.currents).some(v=>!Number.isFinite(v)))?['Alcune correnti nei punti di inizializzazione non sono calcolate; i relativi campi restano vuoti.']:[],finalState:x.slice(),nodes:s.topo.groups,method:adaptive?'SDIRK2 adattivo · ordine 2':'SDIRK2 · ordine 2',count:data.length,maxResidual,numerics:{adaptive,rejected,maxErrorRatio,minStep,maxStep,attempts:steps,newton:s.newton||null,residualFloorI:100*(doc.settings.atolI??1e-10),residualFloorV:100*(doc.settings.atolV??1e-7)}},true);
  }
  function quantities(doc,result,time=false){
    const topo=topology(doc),parts=doc.components.filter(c=>['R','C','L','V','I','U','D','Q','M'].includes(c.type)),reactive=parts.filter(c=>['C','L'].includes(c.type)),voltageAt=(row,pin)=>topo.nodes[pin]>=0?row.values['N'+(topo.nodes[pin]+1)]:0,portVoltage=(row,c)=>c.type==='Q'?voltageAt(row,c.id+':c')-voltageAt(row,c.id+':e'):c.type==='M'?voltageAt(row,c.id+':d')-voltageAt(row,c.id+':s'):c.type==='U'?voltageAt(row,c.id+':out'):voltageAt(row,c.id+':'+(['V','I'].includes(c.type)?'p':'a'))-voltageAt(row,c.id+':'+(['V','I'].includes(c.type)?'n':'b'));
    const accumulated={},ranges={};let previous;
    for(const row of result.data){
      row.powers={};row.energy={};if(time)row.work={};
      for(const c of parts){const v=portVoltage(row,c),current=row.currents[c.id],power=Number.isFinite(current)?(c.type==='U'?-1:1)*v*current+(c.type==='Q'?(voltageAt(row,c.id+':b')-voltageAt(row,c.id+':e'))*row.currents[c.id+':b']:0):NaN;row.powers[c.id]=power;if(c.type==='C')row.energy[c.id]=.5*c.value*v*v;if(c.type==='L')row.energy[c.id]=.5*c.value*current*current;
        if(!time)continue;
        if(['C','L'].includes(c.type)){const first=result.data[0],initialEnergy=Object.hasOwn(first.energy,c.id)?first.energy[c.id]:row.energy[c.id];row.work[c.id]=row.energy[c.id]-initialEnergy;continue;}
        if(!ranges[c.id])ranges[c.id]={start:null,end:null,gap:false};const range=ranges[c.id];
        if(!Number.isFinite(power)){if(range.start!==null)range.gap=true;row.work[c.id]=null;continue;}
        if(range.start===null){range.start=row.x;accumulated[c.id]=0;}else if(!range.gap&&previous){const old=previous.powers[c.id];if(Number.isFinite(old))accumulated[c.id]+=(row.x-previous.x)*(old+power)/2;else if(row.x!==range.start)range.gap=true;}
        range.end=row.x;row.work[c.id]=range.gap?null:accumulated[c.id];
      }
      row.totalStoredEnergy=reactive.reduce((sum,c)=>sum+row.energy[c.id],0);row.powerBalance=parts.every(c=>Number.isFinite(row.powers[c.id]))?parts.reduce((sum,c)=>sum+row.powers[c.id],0):null;previous=row;
    }
    if(time){result.workRanges=ranges;const nonReactive=parts.filter(c=>!['C','L'].includes(c.type)),first=result.data.find(row=>nonReactive.every(c=>Number.isFinite(row.work[c.id]))),last=result.data.at(-1);result.energyBalance=null;
      if(first&&nonReactive.every(c=>Number.isFinite(last.work[c.id]))){const dissipation=parts.filter(c=>['R','D','Q','M'].includes(c.type)).reduce((sum,c)=>sum+last.work[c.id]-first.work[c.id],0),sourceWork=parts.filter(c=>['V','I','U'].includes(c.type)).reduce((sum,c)=>sum+last.work[c.id]-first.work[c.id],0),storedChange=last.totalStoredEnergy-first.totalStoredEnergy,residual=sourceWork+dissipation+storedChange,scale=Math.max(Math.abs(sourceWork),Math.abs(dissipation),Math.abs(storedChange),first.totalStoredEnergy,last.totalStoredEnergy,1e-30);result.energyBalance={start:first.x,end:last.x,dissipation,sourceWork,storedChange,residual,relative:Math.abs(residual)/scale};}
    }
    return result;
  }
  function reactiveSummary(doc){
    const parts=doc.components.filter(c=>!['G','J'].includes(c.type)),R=parts.find(c=>c.type==='R'),L=parts.find(c=>c.type==='L'),C=parts.find(c=>c.type==='C'),V=parts.find(c=>c.type==='V');if(!R||!L||!V||parts.length!==(C?4:3))return null;
    const t=topology(doc),n=ref=>t.nodes[ref];if(n(V.id+':n')!==-1)return null;let target=-1;
    if(C){const a=n(C.id+':a'),b=n(C.id+':b');if(a!==-1&&b!==-1||a===b)return null;target=a===-1?b:a;}
    let node=n(V.id+':p');if(node===target)return null;for(let i=0;i<2;i++){const c=[R,L].find(c=>n(c.id+':a')===node||n(c.id+':b')===node);if(!c)return null;node=n(c.id+':a')===node?n(c.id+':b'):n(c.id+':a');if(i===0){if(node===-1)return null;const other=c===R?L:R;if(n(other.id+':a')!==node&&n(other.id+':b')!==node)return null;node=n(other.id+':a')===node?n(other.id+':b'):n(other.id+':a');break;}}
    if(node!==target)return null;if(!C)return{kind:'rl',tau:L.value/R.value,cutoff:R.value/(2*Math.PI*L.value)};const omega0=1/Math.sqrt(L.value*C.value),zeta=R.value/2*Math.sqrt(C.value/L.value);return{kind:'rlc',omega0,frequency0:omega0/(2*Math.PI),zeta,dampedFrequency:zeta<1?omega0*Math.sqrt(1-zeta*zeta)/(2*Math.PI):null,resonantFrequency:zeta<Math.SQRT1_2?omega0*Math.sqrt(1-2*zeta*zeta)/(2*Math.PI):null};
  }
  function dcValue(c){return(c.wave.polarity??1)*(c.wave.dc??(c.wave.kind==='dc'?c.wave.level:['sine','square','triangle'].includes(c.wave.kind)?c.wave.offset:c.wave.kind==='pwl'?c.wave.points[0][1]:c.wave.low??0));}
  function solveOperating(s,overrides={}){
    if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.entries(overrides).some(([id,v])=>!s.doc.components.some(c=>c.id===id&&['V','I'].includes(c.type))||!Number.isFinite(v)||Math.abs(v)>1000))throw new Error('Polarizzazione DC non valida.');
    const r=Array(s.N).fill(0),bias={},amps=s.doc.components.filter(c=>c.type==='U'&&c.model!=='ideal');
    for(const c of s.doc.components.filter(c=>['V','I'].includes(c.type))){const value=overrides[c.id]??dcValue(c);bias[c.id]=value;if(c.type==='V')r[s.index.get(c.id)]=value;else{const a=s.node(c,'p'),b=s.node(c,'n');if(a>=0)r[a]-=value;if(b>=0)r[b]+=value;}}
    let active=new Map(),x,settled=false;
    for(let iteration=0;iteration<48;iteration++){
      const A=s.G.map(row=>row.slice()),right=r.slice();for(const[row,c]of active){A[row].fill(0);A[row][c.column]=1;right[row]=c.value;}x=Semi.solve(s,A,right,factor,x);const changed=new Map();
      for(const c of amps){const k=s.index.get(c.id),out=s.node(c,'out');if(c.model==='physical'){
          const z=s.stateIndex.get(c.id),q=physical(c),target=c.a0*difference(s,x,c,'plus','minus'),lo=q.negative+c.headroom,hi=q.positive-c.headroom;
          if(target>hi+1e-9)changed.set(z,{column:z,value:hi,kind:'rail',id:c.id});else if(target<lo-1e-9)changed.set(z,{column:z,value:lo,kind:'rail',id:c.id});
          const current=((out<0?0:x[out])-x[z])/q.rout;if(Math.abs(current)>q.ilimit+1e-10)changed.set(k,{column:k,value:Math.sign(current)*q.ilimit,kind:'current',id:c.id});
        }else{const limit=c.rail-c.headroom,target=c.a0*difference(s,x,c,'plus','minus');if(target>limit+1e-9)changed.set(k,{column:out,value:limit,kind:'rail',id:c.id});else if(target< -limit-1e-9)changed.set(k,{column:out,value:-limit,kind:'rail',id:c.id});}}
      if(changed.size===active.size&&[...changed].every(([k,c])=>active.get(k)?.value===c.value&&active.get(k)?.column===c.column)){settled=true;break;}active=changed;
    }
    if(!settled)throw new Error('Punto di lavoro non convergente: verifica retroazione e vincoli.');
    const nonlinear=s.nonlinear.length?Semi.evaluate(s,x).current:null;let residual=0;for(let row=0;row<s.N;row++){if(active.has(row))continue;let value=-r[row]+(nonlinear?.[row]||0),scale=Math.abs(r[row])+Math.abs(nonlinear?.[row]||0);for(let j=0;j<s.N;j++){const term=s.G[row][j]*x[j];value+=term;scale+=Math.abs(term);}residual=Math.max(residual,Math.abs(value)/Math.max(1e-9,scale));}
    if(!Number.isFinite(residual)||residual>1e-5)throw new Error('Residuo del punto di lavoro troppo elevato.');return{x,active,bias,residual};
  }
  function operatingPoint(doc,overrides={}){
    const s=assemble(doc),r=solveOperating(s,overrides),values=Object.fromEntries(s.topo.groups.map(n=>[n.name,r.x[n.index]])),currents=branchCurrents(s,r.x,0,'right',Array(s.N).fill(0));
    for(const c of doc.components.filter(c=>c.type==='I'))currents[c.id]=r.bias[c.id];
    const row={x:0,vin:voltage(s,r.x,doc.probes.input)*(doc.settings.probeScaleInput??1),out:voltage(s,r.x,doc.probes.output)*(doc.settings.probeScaleOutput??1),values,currents,regions:s.nonlinear.length?Semi.evaluate(s,r.x).regions:{},states:Object.fromEntries([...s.stateIndex].map(([id,k])=>[id,r.x[k]])),clipped:r.active.size>0,limits:[...r.active.values()].map(c=>c.id+':'+c.kind)};
    return quantities(doc,{data:[row],nodes:s.topo.groups,newton:s.newton||null,method:'DC · condensatori aperti, induttori in corto'+(s.nonlinear.length?' · Newton':''),bias:r.bias,count:1,maxResidual:r.residual});
  }
  function dcSweep(doc,options={}){
    const sourceID=doc.settings.dcSource||doc.settings.acSource||doc.components.find(c=>['V','I'].includes(c.type))?.id,c=doc.components.find(c=>c.id===sourceID&&['V','I'].includes(c.type)),start=doc.settings.dcStart??(c?.type==='I'?-.001:-5),stop=doc.settings.dcStop??(c?.type==='I'?.001:5),count=doc.settings.dcPoints??101;
    if(!c||!Number.isFinite(start)||!Number.isFinite(stop)||Math.abs(start)>1000||Math.abs(stop)>1000||start===stop||!Number.isInteger(count)||count<2||count>1001)throw new Error('Scansione DC non valida: scegli un generatore, due estremi diversi e 2–1001 punti.');
    const data=[];let maximumResidual=0,nodes;for(let i=0;i<count;i++){if(options.cancelled?.())throw new Error('Calcolo annullato.');const value=start+(stop-start)*i/(count-1),point=operatingPoint(doc,{[sourceID]:value});data.push({...point.data[0],x:value});nodes=point.nodes;maximumResidual=Math.max(maximumResidual,point.maxResidual);if(i%16===0)options.onProgress?.(i/(count-1));}options.onProgress?.(1);
    return{data,nodes,count:data.length,source:sourceID,xUnit:c.type==='I'?'A':'V',method:'Scansione DC · stati stazionari indipendenti',maxResidual:maximumResidual};
  }
  function convergence(doc,result=simulate(doc)){
    const fine=simulate(doc,{refinement:2}),scales=Object.fromEntries(result.nodes.map(n=>[n.name,1e-9]));
    for(const d of fine.data)for(const n of result.nodes)scales[n.name]=Math.max(scales[n.name],Math.abs(d.values[n.name]));
    let k=0,relative=0,absolute=0,node='';
    for(let i=0;i<result.data.length;i++){
      const d=result.data[i];if(i+1<result.data.length&&result.data[i+1].x===d.x)continue;
      while(k+1<fine.data.length&&fine.data[k+1].x<=d.x)k++;
      const a=fine.data[k],b=fine.data[Math.min(k+1,fine.data.length-1)],f=b.x===a.x?0:(d.x-a.x)/(b.x-a.x);
      for(const n of result.nodes){const delta=Math.abs(d.values[n.name]-(a.values[n.name]+f*(b.values[n.name]-a.values[n.name]))),r=delta/scales[n.name];if(r>relative){relative=r;node=n.name;}absolute=Math.max(absolute,delta);}
    }return{relative,absolute,node,coarse:result.count,fine:fine.count};
  }
  function traceReader(doc,trace){
    if(trace.kind==='current'){const c=doc.components.find(c=>c.id===trace.component),pin=trace.terminal;return row=>row.currents?.[trace.component+(pin&&pin!==PINS[c.type][0]?':'+pin:'')];}
    const nodes=topology(doc).nodes,a=trace.positive?nodes[trace.positive]:-1,b=trace.negative?nodes[trace.negative]:-1;
    return row=>(a>=0?row.values['N'+(a+1)]:0)-(b>=0?row.values['N'+(b+1)]:0);
  }
  const traceValue=(doc,row,trace)=>traceReader(doc,trace)(row);
  function complexSolve(real,imag,rhsReal,rhsImag=null){
    const n=real.length,R=real.map(r=>r.slice()),I=imag.map(r=>r.slice()),br=rhsReal.slice(),bi=rhsImag?rhsImag.slice():Array(n).fill(0),scale=R.map((r,i)=>Math.max(...r.map((v,j)=>Math.hypot(v,I[i][j]))));
    for(let k=0;k<n;k++){
      let p=k,best=0;for(let i=k;i<n;i++){const q=scale[i]?Math.hypot(R[i][k],I[i][k])/scale[i]:0;if(q>best){best=q;p=i;}}
      if(best<1e-12)throw new Error('Risposta AC non determinata: verifica vincoli e collegamenti. Anche una risonanza ideale senza perdite può rendere la risposta non finita.');
      [R[k],R[p]]=[R[p],R[k]];[I[k],I[p]]=[I[p],I[k]];[br[k],br[p]]=[br[p],br[k]];[bi[k],bi[p]]=[bi[p],bi[k]];[scale[k],scale[p]]=[scale[p],scale[k]];
      const den=R[k][k]**2+I[k][k]**2;
      for(let i=k+1;i<n;i++){const ar=(R[i][k]*R[k][k]+I[i][k]*I[k][k])/den,ai=(I[i][k]*R[k][k]-R[i][k]*I[k][k])/den;for(let j=k+1;j<n;j++){R[i][j]-=ar*R[k][j]-ai*I[k][j];I[i][j]-=ar*I[k][j]+ai*R[k][j];}br[i]-=ar*br[k]-ai*bi[k];bi[i]-=ar*bi[k]+ai*br[k];}
    }
    const xr=Array(n).fill(0),xi=Array(n).fill(0);
    for(let i=n-1;i>=0;i--){let r=br[i],im=bi[i];for(let j=i+1;j<n;j++){r-=R[i][j]*xr[j]-I[i][j]*xi[j];im-=R[i][j]*xi[j]+I[i][j]*xr[j];}const den=R[i][i]**2+I[i][i]**2;xr[i]=(r*R[i][i]+im*I[i][i])/den;xi[i]=(im*R[i][i]-r*I[i][i])/den;}
    return{real:xr,imag:xi};
  }
  function frequencyGrid(settings){
    const mode=settings.acGrid||'legacy',density=settings.acPoints??50,a=settings.fmin,b=settings.fmax;if(!['legacy','linear','decade','octave'].includes(mode)||![a,b].every(Number.isFinite)||a<=0||b<=a||b>1e9||!Number.isInteger(density)||density<2||density>2000)throw new Error('Griglia AC non valida.');if(mode==='legacy')return Array.from({length:301},(_,i)=>a*(b/a)**(i/300));
    const intervals=mode==='linear'?density-1:Math.ceil((mode==='octave'?Math.log2(b/a):Math.log10(b/a))*density);if(intervals<1||intervals>9999)throw new Error('La griglia AC supera 10 000 punti: riduci densità o intervallo.');
    if(mode==='linear')return Array.from({length:intervals+1},(_,i)=>a+(b-a)*i/intervals);const base=mode==='octave'?2:10,rows=Array.from({length:intervals},(_,i)=>a*base**(i/density));rows.push(b);return rows;
  }
  function bode(doc,options={}){
    const s=assemble(doc),sourceID=doc.settings.acSource||doc.components.find(c=>['V','I'].includes(c.type))?.id,sourceComponent=doc.components.find(c=>c.id===sourceID);
    if(!sourceComponent)throw new Error('Scegli il generatore per l’analisi Bode.');
    const weights=doc.settings.acWeights||{[sourceID]:1},phases=doc.settings.acPhases||{},realWeights={},imagWeights={};for(const[id,weight]of Object.entries(weights)){const phi=(phases[id]||0)*Math.PI/180;realWeights[id]=weight*Math.cos(phi);imagWeights[id]=weight*Math.sin(phi);}
    const data=[],r=rhs(s,0,'right',realWeights),ri=rhs(s,0,'right',imagWeights),node=s.topo.nodes[doc.probes.output],G=s.G.map(row=>row.slice()),E=s.E.map(row=>row.slice());let previous,bias=null;
    if(s.nonlinear.length||!options.ignoreBias&&doc.components.some(c=>c.type==='U'&&c.model!=='ideal')){bias=solveOperating(s);if(s.nonlinear.length){const jac=Semi.evaluate(s,bias.x).jacobian;for(let i=0;i<s.N;i++)for(let j=0;j<s.N;j++)G[i][j]+=jac[i][j];}for(const[row,c]of (options.ignoreBias?[]:bias.active)){G[row].fill(0);G[row][c.column]=1;E[row].fill(0);}}

    const frequencies=options.frequencies||frequencyGrid(doc.settings);if(!frequencies.length||frequencies.some(f=>!Number.isFinite(f)||f<0||f>1e9))throw new Error('Frequenze AC non valide.');
    for(const frequency of frequencies){
      const a=complexSolve(G,E.map(r=>r.map(v=>v*2*Math.PI*frequency)),r,ri);
      let real=(node<0?0:a.real[node])*(doc.settings.probeScaleOutput??1),imag=(node<0?0:a.imag[node])*(doc.settings.probeScaleOutput??1);if(doc.settings.acReference==='input'){const input=s.topo.nodes[doc.probes.input],vr=(input<0?0:a.real[input])*(doc.settings.probeScaleInput??1),vi=(input<0?0:a.imag[input])*(doc.settings.probeScaleInput??1),den=vr*vr+vi*vi;if(!den||!Number.isFinite(den))throw new Error('Il riferimento IN si annulla: scegli un altro nodo per il Bode.');[real,imag]=[(real*vr+imag*vi)/den,(imag*vr-real*vi)/den];}const magnitude=Math.hypot(real,imag);let phase=magnitude===0?NaN:Math.atan2(imag,real)*180/Math.PI;
      if(previous===undefined&&phase>90)phase-=360;if(Number.isFinite(previous)){while(phase-previous>180)phase-=360;while(phase-previous < -180)phase+=360;}previous=phase;
      data.push({x:frequency,real,imag,magnitude,db:magnitude===0?-Infinity:20*Math.log10(magnitude),phase});
    }return{data,nodes:s.topo.groups,bias:bias?.bias||null,warnings:bias?.active.size?['Polarizzazione DC al limite: il piccolo segnale usa i vincoli attivi.']:[],source:sourceID,reference:doc.settings.acReference||'source',unit:doc.settings.acReference!=='input'&&(doc.settings.acWeights?doc.components.find(c=>doc.settings.acWeights[c.id])?.type:sourceComponent.type)==='I'?'Ω':'V/V'};
  }
  function serialize(doc){const errors=validate(doc);if(errors.length)throw new Error(errors[0]);return JSON.stringify(doc,null,2);}
  function parse(text){const doc=Files.readJSON(text),errors=validate(doc);if(errors.length)throw new Error(errors[0]);if(doc.name===undefined)doc.name='Circuito senza titolo';Files.readJSON(JSON.stringify(doc,null,2));return clone(doc);}
  function csv(doc,result){
    if(doc.settings.analysis==='bode')return'\uFEFFfrequenza_Hz,modulo_'+(result.unit==='Ω'?'ohm':'V_V')+',modulo_dB,fase_gradi\r\n'+result.data.map(d=>[d.x,d.magnitude,d.db,d.phase].map(v=>Number.isFinite(v)?v.toExponential(12):'').join(',')).join('\r\n');
    const branches=doc.components.filter(c=>['R','C','L','V','I','U','D','Q','M'].includes(c.type)),reactive=branches.filter(c=>['C','L'].includes(c.type)),traces=doc.traces||[],time=doc.settings.analysis==='time',readers=traces.map(t=>traceReader(doc,t));
    const terminalBranches=branches.filter(c=>['D','Q','M'].includes(c.type)).flatMap(c=>PINS[c.type].slice(1).map(pin=>c.id+':'+pin));
    const abscissa=doc.settings.analysis==='op'?'punto_indice':doc.settings.analysis==='dc'?'DC_'+result.source+'_'+result.xUnit:'tempo_s',headers=[abscissa,'IN_V','OUT_V',...result.nodes.map(n=>n.name+'_V'),...branches.map(c=>'I_'+c.id+'_A'),...terminalBranches.map(id=>'I_'+id.replace(':','_')+'_A'),...branches.map(c=>'P_'+c.id+'_W'),...reactive.map(c=>'E_'+c.id+'_J'),...(time?branches.map(c=>'W_'+c.id+'_J'):[]),...traces.map(t=>t.id+'_'+(t.kind==='current'?'A':'V'))];
    const values=d=>[d.x,d.vin,d.out,...result.nodes.map(n=>d.values[n.name]),...branches.map(c=>d.currents[c.id]),...terminalBranches.map(id=>d.currents[id]),...branches.map(c=>d.powers?.[c.id]),...reactive.map(c=>d.energy?.[c.id]),...(time?branches.map(c=>d.work?.[c.id]):[]),...readers.map(read=>read(d))];
    return'\uFEFF'+headers.join(',')+'\r\n'+result.data.map(d=>values(d).map(v=>Number.isFinite(v)?v.toExponential(12):'').join(',')).join('\r\n');
  }

  function loadedRC(){
    const d=example('rc',{R:100000,C:10e-9});d.name='RC caricato · slide 13–15';
    d.components.find(c=>c.id==='V1').wave={kind:'square',vpp:10,offset:5,frequency:50,level:10,phase:0,duty:50,delay:0};
    for(const[type,id,value,x,y]of [['R','Rg',50,330,300],['C','Cc1',100e-12,410,400],['R','Ro',1e7,800,320],['C','Co',15e-12,920,320]])d.components.push({...component(type,id,x,y),value,rotation:id==='Rg'?0:90});
    d.wires=d.wires.filter(w=>!(w.a==='V1:p'&&w.b==='R1:a'));
    for(const[a,b]of [['V1:p','Rg:a'],['Rg:b','R1:a'],['R1:a','Cc1:a'],['Cc1:b','G1:g'],['C1:a','Ro:a'],['Ro:b','G2:g'],['C1:a','Co:a'],['Co:b','G2:g']])d.wires.push({id:'S'+(d.wires.length+1),a,b});
    d.settings.duration=.03;d.settings.analysis='bode';d.settings.fmin=1;d.settings.fmax=1e6;
    d.traces=[{id:'P1',kind:'voltage',positive:'R1:a',negative:null},{id:'P2',kind:'current',component:'R1'}];
    return d;
  }
  function nonlinearExample(kind){
    const d=blank();d.name={diode:'Diodo · caratteristica e rampa delle slide',rectifier:'Raddrizzatore a diodo con filtro RC',bjt:'BJT NPN · emettitore comune',pnp:'BJT PNP · emettitore comune',mos:'MOSFET NMOS · source comune',pmos:'MOSFET PMOS · source comune'}[kind];
    const add=(type,id,x,y,props={})=>{const c=Object.assign(component(type,id,x,y),props);d.components.push(c);return c;},wire=(a,b)=>d.wires.push({id:'W'+(d.wires.length+1),a,b}),v=add('V','V1',150,280),g=add('G','G1',150,460);wire('V1:n','G1:g');d.probes.input='V1:p';d.settings.acSource='V1';
    if(kind==='diode'||kind==='rectifier'){const diode=add('D','D1',550,280),r=add('R','R1',350,180,{value:500});wire('V1:p','R1:a');wire('R1:b','D1:a');d.probes.output='D1:a';if(kind==='diode'){wire('D1:b','G1:g');Object.assign(v.wave,{kind:'pwl',points:[[0,0],[20,20]],dc:0});Object.assign(d.settings,{duration:20,analysis:'dc',dcSource:'V1',dcStart:0,dcStop:20,dcPoints:201});}
     else{Object.assign(v,{x:170,y:320});Object.assign(g,{x:170,y:470});Object.assign(diode,{x:400,y:220});Object.assign(r,{x:650,y:320,rotation:90});const groundR=add('G','G2',650,470),groundC=add('G','G3',500,470);d.wires=d.wires.filter(w=>w.a!=='V1:p'&&w.b!=='D1:a');wire('V1:p','D1:a');wire('D1:b','R1:a');wire('R1:b','G2:g');r.value=10000;const c=add('C','C1',500,320,{value:10e-6,initial:0,rotation:90});wire('D1:b','C1:a');wire('C1:b','G3:g');Object.assign(v.wave,{kind:'sine',vpp:10,frequency:50,offset:0,dc:0});d.probes.output='D1:b';Object.assign(d.settings,{duration:.08,integration:'adaptive',rtol:1e-5});}d.traces=[{id:'P1',kind:'current',component:'D1'}];}
    else{const sign=['pnp','pmos'].includes(kind)?-1:1,vcc=add('V','Vcc',750,280);Object.assign(vcc.wave,{kind:'dc',level:sign*5,dc:sign*5});wire('Vcc:n','G1:g');Object.assign(v.wave,{kind:'sine',vpp:.02,frequency:1000,offset:sign*(kind==='bjt'||kind==='pnp'?.7:2.5),dc:sign*(kind==='bjt'||kind==='pnp'?.7:2.5)});const r=add('R','R1',620,160,{value:1000});wire('Vcc:p','R1:a');if(kind==='bjt'||kind==='pnp'){const q=add('Q','Q1',500,300,{polarity:sign<0?'p':'n'}),rb=add('R','Rb',320,280,{value:10000});wire('V1:p','Rb:a');wire('Rb:b','Q1:b');wire('Q1:e','G1:g');wire('R1:b','Q1:c');d.probes.output='Q1:c';d.traces=[{id:'P1',kind:'current',component:'Q1'}];}else{const m=add('M','M1',500,300,{polarity:sign<0?'p':'n'});wire('V1:p','M1:g');wire('M1:s','G1:g');wire('R1:b','M1:d');d.probes.output='M1:d';d.traces=[{id:'P1',kind:'current',component:'M1'}];}Object.assign(d.settings,{duration:.003,dcSource:'V1',dcStart:sign<0?-4:0,dcStop:sign<0?0:4,dcPoints:101});}
    return d;
  }
  function example(kind='rc',p={}){
    if(['diode','rectifier','bjt','pnp','mos','pmos'].includes(kind))return nonlinearExample(kind);
    if(kind==='rc-loaded')return loadedRC();
    if(kind==='rl'){const d=example('rc');d.name='RL · corrente e costante di tempo';const c=d.components.find(c=>c.id==='C1');Object.assign(c,{id:'L1',type:'L',value:1,initial:0});d.components.find(c=>c.id==='R1').value=1000;for(const w of d.wires)for(const end of ['a','b'])w[end]=w[end].replace('C1:','L1:');d.probes.output='L1:a';d.settings.duration=.006;d.settings.fmin=1;d.settings.fmax=10000;d.traces=[{id:'P1',kind:'current',component:'L1'}];return d;}
    if(kind==='rlc'){const d=example('rc');d.name='RLC serie · oscillazioni e smorzamento';Object.assign(d.components.find(c=>c.id==='R1'),{value:100,x:350});Object.assign(d.components.find(c=>c.id==='C1'),{value:1e-6,x:750});d.components.push({...component('L','L1',550,200),value:.01});d.wires.find(w=>w.a==='R1:b').b='L1:a';d.wires.push({id:'W5',a:'L1:b',b:'C1:a'});d.settings.duration=.002;d.settings.fmin=10;d.settings.fmax=100000;d.traces=[{id:'P1',kind:'current',component:'L1'}];return d;}

    const d=blank();d.name=({rc:'RC libero',inverting:'Invertente libero',derivative:'Derivatore libero',difference:'Differenze libero'})[kind];
    const add=(type,id,x,y,extra={})=>{const c=Object.assign(component(type,id,x,y),extra);d.components.push(c);return c;};
    const link=(a,b)=>{let n=d.wires.length+1;while(d.wires.some(w=>w.id==='W'+n))n++;d.wires.push({id:'W'+n,a,b});};
    const convert=w=>{const a=Object.assign(wave(),w||{});if(a.kind==='charge')a.kind='step';if(a.kind==='cycle'){a.kind='pulse';a.width=p.switchTime||.002;}if(['discharge','ground'].includes(a.kind)){a.kind='dc';a.level=0;}return a;};
    if(kind==='rc'){
      add('V','V1',170,300,{wave:convert(p.wave1)});add('R','R1',400,200,{value:p.R||10000});add('C','C1',670,300,{rotation:90,value:p.C||100e-9,initial:p.initial||0});add('G','G1',170,470);add('G','G2',670,470);
      for(const [a,b]of[['V1:p','R1:a'],['R1:b','C1:a'],['C1:b','G2:g'],['V1:n','G1:g']])link(a,b);
      d.probes={input:'V1:p',output:'C1:a'};
      if(p.instrument&&p.instrument!=='ideal'){
        if(p.rg>0){add('R','Rg',270,200,{value:p.rg});d.wires=d.wires.filter(w=>!(w.a==='V1:p'&&w.b==='R1:a'));link('V1:p','Rg:a');link('Rg:b','R1:a');}
        if(p.instrument!=='generator'){
          for(const [id,pin,x]of [['CH1','R1:a',350],['CH2','C1:a',800]]){add('R',id+'R',x,380,{rotation:90,value:p.scopeR});link(pin,id+'R:a');link(id+'R:b','G1:g');if(p.scopeC>0){add('C',id+'C',x+90,380,{rotation:90,value:p.scopeC,initial:id==='CH2'?(p.initial||0):p.rg>0?0:source(d.components.find(c=>c.id==='V1').wave,0)});link(pin,id+'C:a');link(id+'C:b','G1:g');}}
        }
        d.probes.input='R1:a';d.settings.acReference='input';d.settings.integration='adaptive';d.settings.rtol=1e-5;
      }
    }else{
      const diff=kind==='difference';
      add('V','V1',160,diff?200:300,{wave:convert(p.wave1||{kind:'sine',vpp:1})});add('R','R1',350,diff?157:190,{value:p.R1||10000});
      add('U','U1',670,310,{model:p.opamp==='physical'?'physical':p.opamp==='ideal'?'ideal':'limited',a0:p.a0||200000,gbw:p.gbw||4e6,rail:p.rail||15,headroom:p.headroom??1.5,...(p.opamp==='physical'?physical(p):{})});
      add('R','Rf',670,120,{value:p.Rf||47000});add('G','G1',160,diff?295:470);
      link('V1:p','R1:a');link('V1:n','G1:g');link('U1:minus','Rf:a');link('Rf:b','U1:out');
      if(kind==='derivative'){add('C','C1',490,190,{value:p.C1||1.5e-9});link('R1:b','C1:a');link('C1:b','U1:minus');}else link('R1:b','U1:minus');
      if(diff){
        add('V','V2',160,440,{wave:convert(p.wave2||{kind:'square',vpp:2,frequency:100})});add('R','R3',350,397,{value:p.R3||10000});add('R','R4',545,460,{rotation:90,value:p.R4||47000});add('G','G2',545,565);add('G','G3',160,565);
        for(const[a,b]of[['V2:p','R3:a'],['R3:b','U1:plus'],['R3:b','R4:a'],['R4:b','G2:g'],['V2:n','G3:g']])link(a,b);
        const v1=d.components.find(c=>c.id==='V1'),v2=d.components.find(c=>c.id==='V2');
        if(p.drive==='v1')v2.wave=convert({kind:'dc',level:0});
        if(p.drive==='v2'){v2.wave=clone(v1.wave);v1.wave=convert({kind:'dc',level:0});}
        if(p.drive==='common')v2.wave=clone(v1.wave);
        if(p.drive==='differential'){v2.wave=clone(v1.wave);v2.wave.vpp/=2;v2.wave.offset/=2;v2.wave.level/=2;v1.wave=clone(v2.wave);v1.wave.polarity=-(v1.wave.polarity??1);}
      }else{add('G','G2',570,470);link('U1:plus','G2:g');}
      d.probes={input:'V1:p',output:'U1:out'};
    }
    d.settings.fmin=p.fmin??d.settings.fmin;d.settings.fmax=p.fmax??d.settings.fmax;d.settings.samples=p.samples||2400;d.settings.acSource='V1';d.settings.duration=p.duration||(kind==='difference'?.02:kind==='rc'?.006:.002);
    if(kind==='derivative'&&!p.wave1){d.components[0].wave.kind='triangle';d.components[0].wave.frequency=500;d.settings.duration=.004;}
    return d;
  }
  return{physical,PINS,NAMES,blank,component,example,validate,diagnostics,issues,validPin,topology,pinLabel,dcValue,source,sourceSlope,assemble,initialVoltages,simulate,quantities,reactiveSummary,operatingPoint,dcSweep,convergence,traceValue,traceReader,frequencyGrid,bode,serialize,parse,csv,clone};
});
