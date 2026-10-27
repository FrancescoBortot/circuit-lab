/* Editable vector schematic and component specifications, entirely local.
   User text is escaped; exports never enable shell escape or external input. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./lab-model.js'));else root.LatexExport=factory(root.FreeModel,root.LabModel);})(typeof globalThis!=='undefined'?globalThis:this,function(M,L){
 'use strict';
 const special={'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','~':'\\textasciitilde{}','^':'\\textasciicircum{}'};
 const unicode={'Ω':'\\ensuremath{\\Omega}','µ':'\\ensuremath{\\mu}','μ':'\\ensuremath{\\mu}','τ':'\\ensuremath{\\tau}','β':'\\ensuremath{\\beta}','Δ':'\\ensuremath{\\Delta}','×':'\\ensuremath{\\times}','→':'\\ensuremath{\\rightarrow}','−':'-','·':' / ','∥':' // ','°':'\\ensuremath{^{\\circ}}','₁':'1','₂':'2','₃':'3','₄':'4','₀':'0','⁻':'-','⁺':'+','∞':'\\ensuremath{\\infty}'};
 function escape(value){return Array.from(String(value??'')).map(ch=>special[ch]||unicode[ch]||(/[\x20-\x7e]/.test(ch)?ch:/[\r\n\t]/.test(ch)?' ':ch.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/^[A-Za-z]+$/)?.[0]||'[U+'+ch.codePointAt(0).toString(16).toUpperCase()+']')).join('');}
 const f=n=>{const v=Math.abs(n)<1e-9?0:n;return Number(v.toFixed(5)).toString();},coord=p=>'('+f(p.x/60)+','+f(-p.y/60)+')';
 function value(n,unit=''){
  if(!Number.isFinite(n))return'non disponibile';const [m,e]=n.toExponential(5).split('e'),exp=Number(e),number=exp>=-2&&exp<=3?Number(n.toPrecision(6)).toString():Number(m)+'\\times10^{'+exp+'}';
  const symbol={ohm:'\\Omega',F:'\\mathrm{F}',H:'\\mathrm{H}',V:'\\mathrm{V}',A:'\\mathrm{A}',Hz:'\\mathrm{Hz}',s:'\\mathrm{s}'}[unit]||'\\mathrm{'+unit+'}';
  return'\\ensuremath{'+number+(unit?'\\, '+symbol:'')+'}';
 }
 const pins={R:{a:[-44,0],b:[44,0]},C:{a:[-34,0],b:[34,0]},L:{a:[-44,0],b:[44,0]},V:{p:[0,-43],n:[0,43]},I:{p:[0,-43],n:[0,43]},U:{plus:[-52,25],minus:[-52,-25],out:[60,0]},G:{g:[0,-22]},J:{j:[0,0]},D:{a:[-44,0],b:[44,0]},Q:{c:[20,-42],b:[-46,0],e:[20,42]},M:{d:[24,-42],g:[-46,0],s:[24,42]}};
 function port(d,ref){const[id,pin]=ref.split(':'),c=d.components.find(c=>c.id===id),[x,y]=pins[c.type][pin],a=c.rotation*Math.PI/180,scale=d._symbolScale||1;let dx=0,dy=0;if(['Q','M'].includes(c.type)){if(['b','g'].includes(pin))dx=-1;else dy=['c','d'].includes(pin)?-1:1;}else if(['V','I','G'].includes(c.type))dy=pin==='n'?1:-1;else if(c.type!=='J')dx=['a','plus','minus','g'].includes(pin)?-1:1;return{x:c.x+scale*(x*Math.cos(a)-y*Math.sin(a)),y:c.y+scale*(x*Math.sin(a)+y*Math.cos(a)),dx:Math.round(dx*Math.cos(a)-dy*Math.sin(a)),dy:Math.round(dx*Math.sin(a)+dy*Math.cos(a))};}
 function route(d,w){if(d._printRoutes?.[w.id])return d._printRoutes[w.id];const a=port(d,w.a),b=port(d,w.b),s={x:a.x+a.dx*20,y:a.y+a.dy*20},t={x:b.x+b.dx*20,y:b.y+b.dy*20},points=[a,s],o=w.offset||0;if((!w.route||w.route==='auto')&&!o&&((a.dx&&b.dx&&a.y===b.y)||(a.dy&&b.dy&&a.x===b.x)))return[a,b];if(w.route==='horizontal')points.push({x:(s.x+t.x)/2+o,y:s.y},{x:(s.x+t.x)/2+o,y:t.y});else if(w.route==='vertical')points.push({x:s.x,y:(s.y+t.y)/2+o},{x:t.x,y:(s.y+t.y)/2+o});else if(a.dx&&b.dx){const x=(a.dx===b.dx?(a.dx>0?Math.max(s.x,t.x)+50:Math.min(s.x,t.x)-50):(s.x+t.x)/2)+o;points.push({x,y:s.y},{x,y:t.y});}else if(a.dy&&b.dy){const y=(s.y+t.y)/2+o;points.push({x:s.x,y},{x:t.x,y});}else if(a.dx)points.push({x:s.x+o,y:t.y},t);else points.push({x:t.x,y:s.y+o},t);return points.concat(t,b);}
 function specifications(c){
  if(['R','C','L'].includes(c.type))return[value(c.value,{R:'ohm',C:'F',L:'H'}[c.type]),...(['C','L'].includes(c.type)?['Iniziale '+value(c.initial,c.type==='C'?'V':'A')]:[])];
  if(['V','I'].includes(c.type)){const w=c.wave,u=c.type==='V'?'V':'A',rows=['Forma: '+escape(w.kind),'DC: '+value(M.dcValue(c),u)];if(['sine','square','triangle'].includes(w.kind))rows.push('Picco-picco: '+value(w.vpp,u),'Frequenza: '+value(w.frequency,'Hz'),'Offset: '+value(w.offset,u),'Fase: '+value(w.phase)+' gradi');else if(w.kind==='pwl')rows.push(w.points.length+' punti PWL; dati completi nel JSON');else rows.push('Livello: '+value(w.level,u),'Ritardo: '+value(w.delay,'s'));if(w.polarity!==undefined&&w.polarity!==1)rows.push('Moltiplicatore del segnale: '+value(w.polarity));if(w.kind==='pulse')rows.push('Livello basso: '+value(w.low||0,u),'Periodo: '+(w.period>0?value(w.period,'s'):'impulso singolo'),'Larghezza: '+value(w.width,'s'),'Salita/discesa: '+value(w.rise||0,'s')+' / '+value(w.fall||0,'s'));return rows;}
  if(c.type==='U'){const q=M.physical(c);return['Modello: '+escape(c.model),'A0: '+value(c.a0),'GBW: '+value(c.gbw,'Hz'),...(c.model==='ideal'?[]:['Alimentazioni: '+value(c.model==='physical'?q.negative:-c.rail,'V')+' / '+value(c.model==='physical'?q.positive:c.rail,'V'),'Margine: '+value(c.headroom,'V')]),...(c.model==='physical'?['Slew rate: '+value(q.slew,'V/s'),'R uscita: '+value(q.rout,'ohm'),'Limite corrente: '+value(q.ilimit,'A')]:[])];}
  if(c.type==='D')return['Is: '+value(c.is,'A'),'n: '+value(c.n)];if(c.type==='Q')return[escape(c.polarity==='p'?'PNP':'NPN'),'Is: '+value(c.is,'A'),'BF/BR: '+value(c.bf)+' / '+value(c.br)];if(c.type==='M')return[escape(c.polarity==='p'?'PMOS':'NMOS'),'KP: '+value(c.kp,'A/V^2'),'Vt: '+value(c.vto,'V'),'lambda: '+value(c.lambda,'1/V')];return[c.type==='G'?'Riferimento 0 V':'Nodo elettrico'];
 }

 // Electrical references stay canonical. The printed layout separates
 // components, series lead resistors and instrument blocks.
 function drawing(doc){const d=M.clone(doc),b=d.benchSetup;d._symbolScale=1.4;if(!b)return d;
  // Expand only the printed layout. Electrical values and terminal identities stay intact.
  for(const c of d.components){c.x*=1.6;c.y*=1.6;}
  const original=d.components.filter(c=>!b.parts.includes(c.id)),min=Math.min(...original.map(c=>c.x))-850,max=Math.max(...original.map(c=>c.x))+300;
  for(const c of d.components.filter(c=>c.benchRole?.startsWith('R_G'))){const source=Object.entries(b.sourceMap).find(([,ref])=>ref===c.id+':b')?.[0],base=b.baseWires.find(w=>w.a===source||w.b===source),target=base&&(base.a===source?base.b:base.a);if(source&&target){const v=d.components.find(p=>p.id===source.split(':')[0]);c.x=Math.min(v.x+145,port(d,target).x-260);c.y=port(d,target).y;c.rotation=0;}}
  // Insert each lead resistor on a straight section of its actual original path.
  // Split the path at the resistor pins, avoiding U-turns through its own symbol.
  d._printRoutes={};d._printDots=[];
  for(const c of d.components.filter(c=>c.benchRole?.startsWith('Collegamento '))){const first=d.wires.find(w=>w.id===c.benchRole.slice(13)),last=d.wires.find(w=>w.a===c.id+':b');if(!first||!last)continue;
   const to=d.components.find(p=>p.id===last.b.split(':')[0]),start=port(d,first.a),minimum=88*d._symbolScale+24;
   let path=to?.type==='G'?[start,{x:start.x+start.dx*180,y:start.y+start.dy*180}]:route(d,{...first,b:last.b});
   const longest=points=>points.slice(1).map((p,i)=>({i,a:points[i],b:p,length:Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)})).reduce((a,z)=>a.length>=z.length?a:z);
   let segment=longest(path);if(segment.length<minimum){path=route(d,{...first,b:last.b,route:'vertical',offset:-220});segment=longest(path);}
   if(segment.length<minimum)continue;
   const {a}=segment,end=segment.b,dx=Math.sign(end.x-a.x),dy=Math.sign(end.y-a.y);c.x=(a.x+end.x)/2;c.y=(a.y+end.y)/2;c.rotation=dx>0?0:dx<0?180:dy>0?90:270;
   d._printRoutes[first.id]=path.slice(0,segment.i+1).concat(port(d,c.id+':a'));if(to?.type!=='G')d._printRoutes[last.id]=[port(d,c.id+':b'),...path.slice(segment.i+1)];
  }
  for(let i=0;i<2;i++){const ch=b.config.channels[i];if(!ch.enabled)continue;const tag='CH'+(i+1),parts=d.components.filter(c=>c.benchRole?.startsWith(tag+' ')),tip=b.probes[i?'output':'input'],at=M.validPin(d,tip)?port(d,tip):{y:200},y=at.y,base=i?max:min;
   for(const c of parts){const kind=c.id.match(/^[A-Z]+/)[0],left=i===0;c.rotation=['RP','CP','CA'].includes(kind)?(left?180:0):90;
    if(['RE','CE'].includes(kind)){c.x=base+(kind==='RE'?(left?400:80):(left?540:220));c.y=y+190;}
    else if(kind==='RP'||kind==='CP'){c.x=base+(left?540:60);c.y=y+(kind==='CP'?-90:90);}
    else if(kind==='CA'){c.x=base+(left?260:400);c.y=y;}
    else if(kind==='CC'){c.x=base+(left?450:200);c.y=y+190;}
    else{c.x=base+(kind==='RO'?(left?50:550):(left?200:700));c.y=y+190;}
   }
  }
  // Original routes retain their direction/offset. Lead paths are split above;
  // direct instrument shunts share a horizontal bus with explicit junction dots.
  for(const w of d.wires)if(b.wires.includes(w.id)){delete w.route;delete w.offset;
   const from=d.components.find(c=>c.id===w.a.split(':')[0]),to=d.components.find(c=>c.id===w.b.split(':')[0]);
   if(!from?.benchRole?.startsWith('CH')&&to?.benchRole?.startsWith('CH')&&['RO','CO','CC','RE','CE'].includes(to.id.match(/^[A-Z]+/)[0])&&w.b.endsWith(':a')){const a=port(d,w.a),z=port(d,w.b);d._printRoutes[w.id]=[a,{x:z.x,y:a.y},z];d._printDots.push({x:z.x,y:a.y});}
  }return d;
 }
 function mathLabel(c){const n=c.benchRole?.match(/^CH(\d)/)?.[1],kind=c.id.match(/^[A-Z]+/)?.[0];if(c.benchRole?.startsWith('R_G'))return 'R_{G,'+c.id.replace(/\D/g,'')+'}';if(c.benchRole?.startsWith('Collegamento'))return 'R_{w,'+c.id.replace(/\D/g,'')+'}';if(n&&['RO','CO','CA','RE','CE','RP','CP','CC'].includes(kind)){const letters={RO:'R',CO:'C',CA:'C',RE:'R',CE:'C',RP:'R',CP:'C',CC:'C'},indices={RO:'O',CO:'O',CA:'AC',RE:'E',CE:'E',RP:'p',CP:'p',CC:'s'};return letters[kind]+'_{'+indices[kind]+','+n+'}';}if(c.id==='Rf')return 'R_f';const m=c.id.match(/^([A-Za-z]+)(\d+)$/);return m?'\\mathrm{'+m[1]+'}_{'+m[2]+'}':'\\mathrm{'+escape(c.id)+'}';}
 function engineering(n,unit){if(!n)return value(n,unit);const e=Math.max(-12,Math.min(9,3*Math.floor(Math.log10(Math.abs(n))/3))),prefix={'-12':'p','-9':'n','-6':'\\mu','-3':'m','0':'','3':'k','6':'M','9':'G'}[e],number=Number((n/10**e).toPrecision(4));return '\\ensuremath{'+number+'\\, '+(prefix?'\\mathrm{'+prefix+'}':'')+(unit==='ohm'?'\\Omega':'\\mathrm{'+unit+'}')+'}';}
 function shownValue(c){if(['R','C','L'].includes(c.type))return engineering(c.value,{R:'ohm',C:'F',L:'H'}[c.type]);if(['V','I'].includes(c.type)){const w=c.wave;return w.kind==='pwl'?'PWL':value(['dc','step','pulse'].includes(w.kind)?w.level*(w.polarity??1):w.vpp,c.type==='V'?'V':'A')+(['sine','square','triangle'].includes(w.kind)?' pp':'');}return '';}
 function symbol(c,names,index,d){const refs=pin=>'('+names.get(c.id+':'+pin)+')',name='part'+index,label='$'+mathLabel(c)+'$',center=coord(c);let out=[];
  if(['R','C','L','D','V','I'].includes(c.type)){
   const source=['V','I'].includes(c.type),kind=c.type==='V'?(c.wave.kind==='sine'?'sV':'V'):c.type==='I'?'I':c.type,from=source?(c.type==='V'?'n':'p'):'a',to=source?(c.type==='V'?'p':'n'):'b';
   const wireLabel=c.benchRole?.startsWith('Collegamento '),stacked=wireLabel||c.type==='I'||(c.benchRole?.startsWith('CH')&&c.rotation===90),labelSide=wireLabel&&c.rotation===0&&d.components.some(o=>o!==c&&Math.abs(o.x-c.x)<150&&o.y>c.y&&o.y-c.y<100)?'l^':'l_',caption=stacked?'\\shortstack{'+(wireLabel?'\\normalsize ':'')+label+'\\\\[-1pt]\\normalsize '+shownValue(c)+'}':label;out.push('\\draw '+refs(from)+' to['+kind+(c.type==='V'&&kind==='V'?',invert':'')+',name='+name+','+labelSide+'={'+caption+'}'+(!stacked&&shownValue(c)?',a^={\\normalsize '+shownValue(c)+'}':'')+'] '+refs(to)+';');
  }else if(c.type==='G'){if(d.wires.some(w=>w.a===c.id+':g'||w.b===c.id+':g'))out.push('% Massa '+c.id+': indicata dai simboli ground locali.');else out.push('\\draw '+refs('g')+' node[ground,rotate='+(-c.rotation)+'] {};');}
  else if(c.type==='J')out.push('\\fill '+refs('j')+' circle (1.5pt);');
  else{
   const type=c.type==='U'?'op amp':c.type==='Q'?(c.polarity==='p'?'pnp':'npn'):(c.polarity==='p'?'pmos':'nmos'),anchors=c.type==='U'?{plus:'+',minus:'-',out:'out'}:c.type==='Q'?{c:'C',b:'B',e:'E'}:{d:'D',g:'G',s:'S'};
   out.push('\\node['+type+',rotate='+(-c.rotation)+(['Q','M'].includes(c.type)&&c.polarity==='p'?',yscale=-1':'')+'] ('+name+') at '+center+' {};');
   for(const[pin,anchor]of Object.entries(anchors))out.push('\\draw '+refs(pin)+' -- ('+name+'.'+anchor+'); % '+c.id+':'+pin);
   out.push('\\node[anchor=south,font=\\large] at '+coord({x:c.x,y:c.y-75*(d._symbolScale||1)})+' {'+label+'};');
   if(c.type==='U')out.push('% Alimentazioni e modello di '+c.id+': '+specifications(c).map(v=>v.replace(/\n/g,' ')).join('; '));
   if(c.type==='M')out.push('% Corpo del MOS collegato internamente a S nel modello simulato.');
  }return out.join('\n');
 }
 function groups(d){const out=[],add=(label,color,parts)=>{if(!parts.length)return;out.push({label,color,parts:parts.map(c=>c.id),minX:Math.min(...parts.map(c=>c.x))-(color==='red'?85:110),maxX:Math.max(...parts.map(c=>c.x))+(color==='red'?140:80),minY:Math.min(...parts.map(c=>c.y))-160,maxY:Math.max(...parts.map(c=>c.y))+140});};
  const main=d.components.filter(c=>!c.benchRole&&!['V','I','G','J'].includes(c.type));if(d.benchSetup)for(const c of d.components.filter(c=>c.benchRole?.startsWith('Collegamento '))){const w=d.benchSetup.baseWires.find(w=>w.id===c.benchRole.slice(13));if(w&&![w.a,w.b].some(pin=>['V','I'].includes(d.components.find(p=>p.id===pin.split(':')[0])?.type)))main.push(c);}add(main.some(c=>c.type==='L')&&main.some(c=>c.type==='C')?'Circuito RLC':main.some(c=>c.type==='U')?'Circuito con operazionale':'Circuito','red',main);
  if(d.benchSetup)for(let i=0;i<2;i++){const ch=d.benchSetup.config.channels[i];if(!ch.enabled)continue;const tag='CH'+(i+1),parts=d.components.filter(c=>c.benchRole?.startsWith(tag+' ')),kind=c=>c.id.match(/^[A-Z]+/)[0];if(ch.kind==='probe10'&&ch.coupling==='dc')add('Sonda 10x + '+tag+' (equivalente)','blue',parts);else{add('Oscilloscopio '+tag+(ch.coupling==='ac'?' / AC':''),'gray',parts.filter(c=>['RO','CO','CA'].includes(kind(c))));add(ch.kind==='probe10'?'Sonda 10x / '+tag:'Cavo / '+tag,'blue',parts.filter(c=>!['RO','CO','CA'].includes(kind(c))));}}
  if(d.benchSetup)for(const box of out.filter(g=>g.color!=='red')){const channel=box.label.includes('CH2')?'output':'input',ref=d.benchSetup.probes[channel];if(M.validPin(d,ref))box.minY=Math.min(box.minY,port(d,ref).y-50);}
  return out;
 }
 function parts(input){const source=input.mode==='free'?M.parse(JSON.stringify(input)):L.parse(L.serialize(input)),canonical=source.mode==='free'?source:L.circuit(source),d=drawing(canonical),refs=d.components.flatMap(c=>M.PINS[c.type].map(pin=>c.id+':'+pin)),names=new Map(refs.map((pin,i)=>[pin,'p'+i])),boxes=groups(d);
  let picture='\\begin{circuitikz}[american,scale=0.8,transform shape]\n\\tikzset{font=\\Large,line width=.65pt}\n\\ctikzset{bipoles/length=1.4cm}\n';picture+='% NODI: coordinate modificabili, in centimetri.\n'+refs.map(pin=>'\\coordinate ('+names.get(pin)+') at '+coord(port(d,pin))+'; % '+pin).join('\n')+'\n';
  if(!refs.length)picture+='\\node at (0,0) {Circuito vuoto};\n';picture+='\n% RIQUADRI: circuito, oscilloscopi, sonde e cavi.\n';for(const b of boxes)picture+='\\draw[dashed,'+b.color+(b.color==='red'?',thick':'')+'] '+coord({x:b.minX,y:b.maxY})+' rectangle '+coord({x:b.maxX,y:b.minY})+';\n\\node[text='+b.color+',font=\\large] at '+coord({x:(b.minX+b.maxX)/2,y:b.minY-25})+' {'+escape(b.label)+'};\n';
  picture+='\n% COLLEGAMENTI: le masse locali sono lo stesso riferimento a 0 V.\n';const ground=ref=>d.components.find(c=>c.id===ref.split(':')[0])?.type==='G';for(const w of d.wires){picture+='% Connessione '+w.id+': '+w.a+' -> '+w.b+'\n';if(ground(w.a)||ground(w.b)){if(ground(w.a)&&ground(w.b))continue;const ref=ground(w.a)?w.b:w.a,p=port(d,ref),end={x:p.x+p.dx*35,y:p.y+p.dy*35};picture+='\\draw ('+names.get(ref)+') -- '+coord(end)+' node[ground] {};\n';continue;}const points=route(d,w);picture+='\\draw ('+names.get(w.a)+')'+points.slice(1,-1).map(p=>' -- '+coord(p)).join('')+' -- ('+names.get(w.b)+');\n';}
  picture+='\n% COMPONENTI: simboli nativi CircuitikZ, etichetta e valore.\n'+d.components.map((c,i)=>symbol(c,names,i,d)).join('\n')+'\n';const degree=new Map();for(const w of d.wires)for(const p of [w.a,w.b])degree.set(p,(degree.get(p)||0)+1);picture+='\n% PUNTI DI CONNESSIONE: gli incroci senza punto non collegano i fili.\n';for(const[p,n]of degree)if(n>1&&!ground(p))picture+='\\filldraw ('+names.get(p)+') circle (1.5pt);\n';
  for(const p of d._printDots||[])picture+='\\filldraw '+coord(p)+' circle (1.5pt);\n';
  picture+='\n% LETTURE: CH1/CH2 quando il canale e collegato, IN/OUT altrimenti.\n';for(const[i,k,label]of [[0,'input','IN'],[1,'output','OUT']])if(d.probes[k]){const ch=d.benchSetup?.config.channels[i],part=d.components.find(c=>c.benchRole?.startsWith('CH'+(i+1)+' ')&&/^RO|^RE/.test(c.id)),pin=part?part.id+':a':d.probes[k],at=port(d,pin);if(ch?.enabled){const end={x:at.x+(i?135:-135),y:at.y-60};picture+='\\draw ('+names.get(pin)+') |- '+coord(end)+' node[draw,circle,fill=white,inner sep=2pt] {CH'+(i+1)+'};\n';}else picture+='\\node[anchor=south west,text=blue,font=\\large] at ('+names.get(d.probes[k])+') {'+label+'};\n';if(d.settings[i?'probeScaleOutput':'probeScaleInput']>1)picture+='% '+label+': lettura al puntale = tensione del nodo x '+d.settings[i?'probeScaleOutput':'probeScaleInput']+'.\n';}
  for(const[pin,label]of Object.entries(d.nodeLabels||{}))picture+='\\node[anchor=north east,font=\\large] at ('+names.get(pin)+') {'+escape(label)+'};\n';picture+='\\end{circuitikz}\n';
  const rows=canonical.components.map(c=>({id:c.id,label:mathLabel(c),description:escape(M.NAMES[c.type])+(c.benchRole?'\\newline '+escape(c.benchRole):''),specs:specifications(c)}));return{source,doc:canonical,drawDoc:d,picture,rows,groups:boxes};
 }
 const packages='\\usepackage[american]{circuitikz}\n\\usepackage{graphicx,tabularx,longtable,array}\n';
 const instructions='% CODICE PRONTO PER OVERLEAF / CIRCUITIKZ\n% Per inserirlo in una relazione esistente, aggiungi nel preambolo:\n% \\usepackage[american]{circuitikz}\n% \\usepackage{graphicx}\n% Solo per la tabella: \\usepackage{tabularx,longtable,array}\n% Incolla il blocco seguente nel corpo, dopo \\begin{document}.\n';
 function figure(doc){return instructions+'\\noindent\n\\resizebox{\\textwidth}{!}{%\n'+parts(doc).picture+'}\\par\n';}
 function tableRows(doc){
  const rows=[],grouped=new Map();
  for(const c of doc.components){
   const role=c.benchRole||'',kind=c.type==='G'?'Masse':role.startsWith('Collegamento ')?'Resistenze dei collegamenti':role.replace(/^CH\d\s*[·/]\s*/,'');
   const specs=specifications(c),key=(c.type==='G'||role.startsWith('Collegamento ')||/^CH\d/.test(role))?JSON.stringify([c.type,kind,c.value??null,c.initial??null,specs]):null;
   if(key&&grouped.has(key)){grouped.get(key).components.push(c);continue;}
   const row={components:[c],description:kind||M.NAMES[c.type],specs};rows.push(row);if(key)grouped.set(key,row);
  }
  return rows.map(r=>{const cs=r.components,lead=cs.every(c=>c.benchRole?.startsWith('Collegamento ')),numbers=cs.map(c=>Number(c.id.replace(/\D/g,''))),range=lead&&cs.length>3&&numbers.every((n,i)=>n===numbers[0]+i),labels=range?'$'+mathLabel(cs[0])+'\\ldots '+mathLabel(cs.at(-1))+'$':cs.map(c=>'$'+mathLabel(c)+'$').join(',\\allowbreak ');
   let specs=r.specs;if(cs[0].type==='V'||cs[0].type==='I'){const w=cs[0].wave;if(w.kind==='dc')specs=specs.filter((v,i)=>i!==1&&!(w.delay===0&&v.startsWith('Ritardo:')));}
   return{labels,description:escape(r.description)+(cs.length>1?' ('+cs.length+')':''),specs:specs.join('; '),ids:cs.map(c=>c.id)};
  });
 }
 function body(doc,{table=true}={}){const p=parts(doc),compact=tableRows(p.doc),side=table&&p.rows.length<=10&&p.rows.reduce((n,r)=>n+r.specs.length,0)<=32,fit=(width)=>'\\begingroup\n\\setbox0=\\hbox{\\resizebox{'+width+'}{!}{%\n'+p.picture+'}}%\n\\ifdim\\dimexpr\\ht0+\\dp0\\relax>.7\\textheight\n  \\resizebox{!}{.7\\textheight}{\\box0}%\n\\else\\box0\\fi\n\\endgroup\n';
  const header='Elementi & Funzione & Parametri \\\\ \\hline\n',rows=compact.map(r=>'% Componenti: '+r.ids.join(', ')+'\n'+r.labels+' & '+r.description+' & '+r.specs+' \\\\ \\hline').join('\n');
  let out='';if(side){const short=compact.map(r=>r.labels+' & '+r.specs+' \\\\ \\hline').join('\n');out+='\\noindent\\begin{minipage}[t]{.62\\linewidth}\\vspace{0pt}\\centering\n'+fit('\\linewidth')+'\\end{minipage}\\hfill\\begin{minipage}[t]{.35\\linewidth}\\vspace{0pt}\\scriptsize\n\\begin{tabularx}{\\linewidth}{@{}>{\\raggedright\\arraybackslash}p{.25\\linewidth}>{\\raggedright\\arraybackslash}X@{}}\nElemento & Parametri \\\\ \\hline\n'+short+'\n\\end{tabularx}\n\\end{minipage}\n';}
  else{out+='\\noindent\n'+fit('\\textwidth');if(table)out+='\\par\\medskip\n{\\footnotesize\\setlength{\\tabcolsep}{4pt}\\renewcommand{\\arraystretch}{1.12}\n\\begin{longtable}{@{}>{\\raggedright\\arraybackslash}p{.17\\linewidth}>{\\raggedright\\arraybackslash}p{.26\\linewidth}>{\\raggedright\\arraybackslash}p{\\dimexpr.57\\linewidth-16pt\\relax}@{}}\n'+header+'\\endfirsthead\n'+header+'\\endhead\n'+rows+'\n\\end{longtable}}\n';}
  if(p.doc.benchSetup)out+='\\par\\smallskip{\\footnotesize Le resistenze dei collegamenti sono esplicite nello schema; i valori uguali sono raggruppati nella tabella. Tutti i simboli di massa indicano lo stesso riferimento a 0 V.}\\par\n% Le sonde DC sono rappresentate dall equivalente R_E parallelo C_E.\n';return out;
 }
 function fragment(doc,{table=false}={}){return instructions+(table?body(doc,{table:true}):figure(doc).slice(instructions.length));}
 function exportText(doc,{table=true}={}){return'% Pronto per Overleaf: copia TUTTO questo file in main.tex.\n% Nessuna immagine o file esterno richiesto.\n\\documentclass[a4paper,landscape,10pt]{article}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[margin=12mm]{geometry}\n'+packages+'\\pagestyle{empty}\n\\begin{document}\n\\section*{'+escape(doc.name||'Circuito')+'}\n'+body(doc,{table})+'\\end{document}\n';}
 return{escape,value,port,route,parts,groups,tableRows,figure,fragment,exportText};
});
