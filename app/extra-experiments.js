/* Appendix 1 of SchedaEsperienze2026, parte 3. Circuits use the shared free solver. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model'),require('./bench-model'),require('./measurements'));
  else root.ExtraExperiments=factory(root.FreeModel,root.BenchModel,root.LabMeasurements);
})(globalThis,function(Free,Bench,Measures){
  'use strict';

  const CATALOG=[
    {id:'cmos-nor',type:'cmos-nor',group:'extra',step:'A1.1',page:'10',name:'Porta NOR CMOS',short:'NOR',description:'Monta il primo circuito della figura 9 e misura Y per le quattro combinazioni di A e B.'},
    {id:'cmos-nand',type:'cmos-nand',group:'extra',step:'A1.2',page:'10',name:'Porta NAND CMOS',short:'NAND',description:'Monta il secondo circuito della figura 9. Confronta la tabella di verità con quella del primo circuito.'},
    {id:'precision-rectifier',type:'precision-rectifier',group:'extra',step:'A2',page:'10–11',name:'Raddrizzatore di precisione',short:'|V|',description:'Misura V₁, OUT, V₂ e Vₒ′ nelle due semionde con il TL082 e due diodi.'},
    {id:'bridge-rectifier',type:'bridge-rectifier',group:'extra',step:'A3',page:'11',name:'Ponte a diodi',short:'4D',description:'Segui i percorsi di conduzione e ricostruisci la tensione Vᴮ − Vᴬ ai capi del carico.'},
    {id:'common-source',type:'common-source',group:'extra',step:'A4',page:'12–13',name:'Amplificatore Common Source',short:'CS',description:'Dimensiona la polarizzazione, misura guadagno e resistenze e confronta il circuito con e senza bypass di source.'}
  ];
  const isLogic=type=>['cmos-nor','cmos-nand'].includes(type);
  const is=type=>CATALOG.some(entry=>entry.type===type);
  const wave=(kind,vpp,frequency,offset=0,level=0)=>({kind,vpp,frequency,offset,level,phase:0,duty:50});
  const dc=(level=0)=>wave('dc',0,50,0,level);
  const logicPresets=[['00','A = 0 · B = 0'],['01','A = 0 · B = 1'],['10','A = 1 · B = 0'],['11','A = 1 · B = 1'],['logic','Tutte le combinazioni nel tempo']];
  const PRESETS={
    'cmos-nor':logicPresets,'cmos-nand':logicPresets,
    'precision-rectifier':[['output','OUT · 10 Vpp a 1 kHz'],['v2','Sonda CH2 su V₂'],['aux','Sonda CH2 su Vₒ′']],
    'bridge-rectifier':[['diodes','Quattro diodi · 5 Hz'],['leds','Quattro LED · 5 Hz'],['diodes-fast','Quattro diodi · 10 Hz']],
    'common-source':[['bias','Punto di lavoro · generatore a 0 V'],['gain','Guadagno · 150 mVpp a 10 kHz'],['rin','Resistenza d’ingresso · aggiungi Rᵢ'],['rout','Resistenza d’uscita · aggiungi Rᴸ'],['unbypassed','Guadagno · senza C₃'],['bode','Bode · con C₃']]
  };
  const HINTS={
    'precision-rectifier':{
      output:'Imposta 10 Vpp a 1 kHz. Misura IN e OUT con sonde ×10. Con R₁a = R₁b = R₁c = R₁d e R₂ = R₁a/2, il risultato ideale è |V₁|.',
      v2:'Lascia CH1 su V₁ e collega CH2 al nodo fra R₁b, R₂ e l’anodo di D1. Prendi una lettura per ciascuna semionda.',
      aux:'Lascia CH1 su V₁ e sposta CH2 sull’uscita di U2. Confronta Vₒ′ in entrambe le semionde e identifica il diodo in conduzione.'
    },
    'bridge-rectifier':{
      diodes:'Collega CH1 ad A e CH2 a B. Tieni entrambe le clip di massa al ritorno del generatore. Usa la funzione matematica CH2 − CH1. I 10 Vpp iniziali sono un esempio.',
      leds:'Usa un colore per D1–D2 e un altro per D3–D4. Osserva quale coppia conduce nelle due semionde. Il modello LED usa parametri indicativi.',
      'diodes-fast':'Ripeti fino a 10 Hz e confronta le forme d’onda di A, B e Vᴮ − Vᴬ.'
    },
    'common-source':{
      bias:'Con il segnale a zero, misura Vᴅᴅ, Vɢ, Vᴅ e Vₛ rispetto a GND. Ricava Iᴅ = (Vᴅᴅ − Vᴅ)/Rᴅ. Dimensiona Rᴅ, Rₛ e il partitore per il punto assegnato dal docente.',
      gain:'Misura Vpp a IN e dopo C₂. Il rapporto dà il modulo del guadagno. Confronta anche la fase per verificare l’inversione.',
      rin:'Inserisci Rᵢ da 50–100 kΩ. A 10 kHz misura Vpp prima e dopo Rᵢ e ricava Rᵢₙ ≈ Rᵢ·Vdopo/(Vprima − Vdopo). Rimuovi Rᵢ per le prove successive.',
      rout:'Aggiungi in parallelo Rᴸ da 5–10 kΩ. Confronta OUT a vuoto e sotto carico, allo stesso ingresso. Ricava Rₒᵤₜ ≈ Rᴸ·(Vvuoto/Vcarico − 1).',
      unbypassed:'Togli soltanto C₃. Ripeti la misura del guadagno a 10 kHz e osserva la degenerazione di source.',
      bode:'Verifica la banda passante attorno allo stesso punto di lavoro e confronta il guadagno di metà banda a 10 kHz.'
    }
  };
  function presetHint(type,key){
    if(isLogic(type))return 'Alimenta il CD4007UB a +5 V. Con il multimetro misura Y rispetto a GND per A/B = 00, 01, 10 e 11. Spiega quali MOS conducono in ogni stato.';
    return HINTS[type]?.[key]||'';
  }

  function probes(target='output'){
    const bench=Bench.config({mode:'real',wireR:0});
    for(const channel of bench.channels)channel.kind='probe10';
    bench.channels[1].target=target;
    return bench;
  }

  function defaults(p){
    if(isLogic(p.type))return Object.assign(p,{VDD:5,pKp:8e-4,pVto:1.4,pLambda:.02,wave1:dc(),wave2:dc()});
    if(p.type==='precision-rectifier')return Object.assign(p,{R1a:22e3,R1b:22e3,R1c:22e3,R1d:22e3,R2:11e3,wave1:wave('sine',10,1000),bench:probes()});
    if(p.type==='bridge-rectifier')return Object.assign(p,{R1:2200,bridgeLED:false,ledIs:1.5e-20,ledN:2,wave1:wave('sine',10,5),bench:probes()});
    return Object.assign(p,{VDD:15,RD:8200,RS:1500,R1:220e3,R2:680e3,Ri:68e3,RL:6800,C0:100e-9,C1:100e-9,C2:100e-9,C3:100e-6,
      inputResistor:false,externalLoad:false,bypass:true,wave1:wave('sine',.15,10000),bench:probes(),fmin:1});
  }

  function normalizeTime(p){
    if(p.type==='common-source'&&p.bench?.channels){
      const absent=new Set([!p.bypass&&'C3',!p.inputResistor&&'Ri',!p.externalLoad&&'RL']);
      for(const [i,ch] of p.bench.channels.entries())if(absent.has(ch.target.split(':')[0]))ch.target=i?'output':'input';
    }
    if(!p.autoTime)return p;
    const rates=[p.wave1,...(isLogic(p.type)?[p.wave2]:[])].filter(w=>['sine','square','triangle'].includes(w.kind)).map(w=>w.frequency);
    p.duration=rates.length?Math.min(100,4/Math.min(...rates)):.02;
    return p;
  }

  function fields(p){
    const r=(key,label)=>[key,label,'res',1,1e9,key];
    const c=(key,label)=>[key,label,'cap',1e-12,1,key];
    const vdd=['VDD','Alimentazione Vᴅᴅ','V',.1,20,'VDD'];
    const diode=[['diodeIs','Corrente di saturazione Iₛ','smallCurrent',1e-20,1e-3,'D1'],['diodeN','Fattore di idealità n','',.5,4,'D1']];
    if(isLogic(p.type))return [vdd,['pKp','Parametro kₚ','conductanceFactor',1e-9,1,'M2'],['pVto','Modulo della soglia |VTP|','V',.01,20,'M2'],['pLambda','Modulazione di canale λₚ','V⁻¹',0,1,'M2']];
    if(p.type==='precision-rectifier')return [...['R1a','R1b','R1c','R1d','R2'].map(key=>r(key,'Resistenza '+key)),...diode];
    if(p.type==='bridge-rectifier')return [r('R1','Carico R'),...(p.bridgeLED?[
      ['ledIs','Corrente di saturazione del LED','smallCurrent',1e-20,1e-3,'D1'],['ledN','Fattore di idealità del LED','',.5,4,'D1']
    ]:diode)];
    return [vdd,r('RD','Resistenza di drain Rᴅ'),r('RS','Resistenza di source Rₛ'),r('R1','Resistenza inferiore del partitore R₁'),r('R2','Resistenza superiore del partitore R₂'),
      ...(p.inputResistor?[r('Ri','Resistenza in serie Rᵢ')]:[]),...(p.externalLoad?[r('RL','Resistenza di carico Rᴸ')]:[]),
      c('C0','Disaccoppiamento di alimentazione C₀'),c('C1','Condensatore d’ingresso C₁'),c('C2','Condensatore d’uscita C₂'),...(p.bypass?[c('C3','Bypass di source C₃')]:[])];
  }

  function switches(type){
    if(type==='bridge-rectifier')return [['bridgeLED','Usa quattro LED']];
    if(type==='common-source')return [['inputResistor','Inserisci Rᵢ in serie al generatore'],['externalLoad','Inserisci Rᴸ in parallelo all’uscita'],['bypass','Inserisci il bypass C₃']];
    return [];
  }

  function applyPreset(p,key){
    p.autoTime=true;
    if(isLogic(p.type)){
      if(key==='logic'){
        p.wave1=wave('square',p.VDD,50,p.VDD/2);
        p.wave2=wave('square',p.VDD,100,p.VDD/2);
      }else [p.wave1,p.wave2]=[...key].map(bit=>dc(Number(bit)*p.VDD));
    }else if(p.type==='precision-rectifier'){
      p.wave1=wave('sine',10,1000);
      p.bench=Bench.config(p.bench||probes());
      p.bench.channels[1].target={v2:'R2:a',aux:'U2:out'}[key]||'output';
    }else if(p.type==='bridge-rectifier'){
      p.wave1=wave('sine',p.wave1.vpp||10,key==='diodes-fast'?10:5);
      p.bridgeLED=key==='leds';
    }else{
      p.wave1=key==='bias'?dc():wave('sine',.15,10000);
      p.inputResistor=key==='rin';
      p.externalLoad=key==='rout';
      p.bypass=key!=='unbypassed';
    }
    return {parameters:normalizeTime(p),analysis:key==='bode'?'bode':'time'};
  }

  const MOS=(p,polarity)=>polarity==='n'?{polarity,kp:p.mosKp,vto:p.mosVto,lambda:p.mosLambda}:{polarity,kp:p.pKp,vto:p.pVto,lambda:p.pLambda};
  const groundReturn=(ground,id,x,y)=>ground(id+':b',x,y);

  function logicNetwork(p,{doc,add,link,ground,voltage,label,path,point}){
    const nor=p.type==='cmos-nor';
    const y2=145,y4=nor?270:200,y3=nor?520:465,y1=nor?465:615,xLeft=560,xRight=795;
    voltage('V1',110,290,p.wave1);voltage('V2',110,555,p.wave2);voltage('VDD',970,140,dc(p.VDD));
    add('M','M1',xLeft,y1,MOS(p,'n'));
    add('M','M3',nor?xRight:xLeft,y3,MOS(p,'n'));
    add('M','M2',xLeft,y2,{...MOS(p,'p'),schematicFlipY:true});
    add('M','M4',nor?xLeft:xRight,y4,{...MOS(p,'p'),schematicFlipY:true});
    const a=point(270,220),b=point(385,365),supply=point(584,55),output=point(584,365);
    path('V1:p',point(110,220,false),a,point(270,y2,false),'M2:g');
    path(a,point(270,y1,false),'M1:g');
    path('V2:p',point(110,485,false),point(385,485,false),b,point(385,y4,false),'M4:g');
    path(b,point(440,365,false),point(440,y3,false),'M3:g');
    path('VDD:p',point(970,55,false),supply,'M2:s');
    ground('M1:s',584,y1+115);
    if(nor){
      path('M4:d',output,'M1:d');
      path(output,point(819,365),'M3:d');ground('M3:s',819,y3+115);
    }else{
      path(supply,point(819,55,false),'M4:s');
      path('M2:d',output,'M3:d');path('M4:d',point(819,365,false),output);
    }
    // The series pair can be off at both ends. Give its midpoint a weak DC reference.
    add('R','Rleak',nor?700:795,nor?245:610,{value:1e9,rotation:90});
    const midpoint=point(584,nor?207:540);
    const ends=nor?['M2:d','M4:s']:['M3:s','M1:d'];
    path(ends[0],midpoint,ends[1]);
    path(midpoint,point(nor?700:795,nor?207:540,false),'Rleak:a');
    groundReturn(ground,'Rleak',nor?700:795,nor?335:720);
    add('R','Rref',975,470,{value:10e9,rotation:90});
    path(output,point(975,365,false),'Rref:a');groundReturn(ground,'Rref',975,565);
    doc.probes={input:'M1:g',output:nor?'M1:d':'M3:d'};
    label('M1:g','A');label('M3:g','B');label(doc.probes.output,'Y');label('VDD:p','VDD');
  }

  function precisionNetwork(p,{doc,add,link,ground,voltage,label,path,point}){
    voltage('V1',90,310,p.wave1);
    const input=point(90,170),sum2=point(325,170),v2=point(530,170),sum1=point(795,170),aux=point(530,345),out=point(1020,330);
    for(const [id,x,y] of [['R1a',215,170],['R1b',430,170],['R2',675,170],['R1c',440,65],['R1d',910,170]])add('R',id,x,y,{value:p[id]});
    const diode={is:p.diodeIs,n:p.diodeN};
    add('D','D1',530,260,{...diode,rotation:90});add('D','D2',430,292,{...diode,rotation:180});
    const amp={...Free.physical(p),model:p.opamp,a0:p.a0,gbw:p.gbw,rail:p.rail,headroom:p.headroom};
    add('U','U1',875,330,amp);add('U','U2',408,395,amp);
    path('V1:p',input,'R1a:a');path(input,point(90,65,false),'R1c:a');path('R1c:b',point(795,65,false),sum1);
    path('R1a:b',sum2,'R1b:a');path('R1b:b',v2,'R2:a');path('R2:b',sum1,'R1d:a');
    path('R1d:b',point(1020,170,false),out,'U1:out');path(sum1,point(795,305,false),'U1:minus');
    path(sum2,point(325,292),'D2:b');path('D2:b',point(325,370,false),'U2:minus');
    path(v2,'D1:a');path('D1:b',point(530,292),'D2:a');path('D2:a',aux,point(530,395,false),'U2:out');
    ground('U1:plus',795,445);ground('U2:plus',325,500);
    doc.probes={input:'R1a:a',output:'U1:out'};
    doc.traces=[{id:'P1',kind:'voltage',positive:'R2:a',negative:null},{id:'P2',kind:'voltage',positive:'U2:out',negative:null}];
    label('R1a:a','V1');label('R2:a','V2');label('U2:out','Vo prime');label('U1:out','OUT');
  }

  function bridgeNetwork(p,{doc,add,link,ground,voltage,label,path,point}){
    voltage('V1',125,275,p.wave1);
    const diode=p.bridgeLED?{is:p.ledIs,n:p.ledN,deviceLabel:'LED'}:{is:p.diodeIs,n:p.diodeN};
    const top=point(385,105),bottom=point(385,465),a=point(385,285),b=point(705,285);
    add('D','D1',385,190,{...diode,rotation:90});
    add('D','D3',385,375,{...diode,...(p.bridgeLED?{deviceLabel:'LED · coppia D3–D4'}:{}),rotation:270});
    add('D','D4',705,190,{...diode,...(p.bridgeLED?{deviceLabel:'LED · coppia D3–D4'}:{}),rotation:270});
    add('D','D2',705,375,{...diode,rotation:90});
    add('R','R1',545,285,{value:p.R1});
    path('V1:p',point(125,105,false),top,point(705,105,false),'D4:b');link(top,'D1:a');
    path('V1:n',point(125,465,false),bottom,point(705,465,false),'D2:b');link(bottom,'D3:a');
    path('D1:b',a,'D3:b');link(a,'R1:a');path('D4:a',b,'D2:a');link(b,'R1:b');
    doc.probes={input:'R1:a',output:'R1:b'};
    doc.traces=[
      {id:'P1',kind:'voltage',positive:'R1:b',negative:'R1:a'},
      ...[1,2,3,4].map(i=>({id:'P'+(i+1),kind:'current',component:'D'+i}))
    ];
    label('R1:a','A');label('R1:b','B');label('V1:p','Vg');
  }

  function sourceNetwork(p,{doc,add,link,ground,voltage,label,path,point}){
    voltage('V1',100,365,p.wave1);voltage('VDD',285,155,dc(p.VDD));
    add('M','M3',640,315,MOS(p,'n'));
    const supplyLeft=point(285,65),gate=point(485,315),drain=point(664,225),source=point(664,410),out=point(960,225),supply=point(485,65);
    add('R','R2',485,170,{value:p.R2,rotation:90});
    add('R','R1',485,420,{value:p.R1,rotation:90});
    add('R','RD',664,145,{value:p.RD,rotation:90});
    add('R','RS',664,490,{value:p.RS,rotation:90});
    add('C','C0',150,150,{value:p.C0,rotation:90});
    add('C','C1',375,315,{value:p.C1});add('C','C2',820,225,{value:p.C2});
    path('C0:a',point(150,65,false),supplyLeft,'VDD:p');
    path(supplyLeft,supply,point(664,65,false),'RD:a');
    link(supply,'R2:a');path('R2:b',gate,'R1:a');link(gate,'M3:g');
    path('RD:b',drain,'M3:d');link(drain,'C2:a');
    path('M3:s',source,'RS:a');
    groundReturn(ground,'RS',664,580);groundReturn(ground,'R1',485,540);groundReturn(ground,'C0',150,245);
    const input=point(100,315,false);
    path('V1:p',input);
    if(p.inputResistor){
      add('R','Ri',240,315,{value:p.Ri});
      path(input,'Ri:a');path('Ri:b','C1:a');
    }else link(input,'C1:a');
    link('C1:b',gate);
    if(p.bypass){
      add('C','C3',805,490,{value:p.C3,rotation:90,schematicPolarized:true});
      path(source,point(805,410,false),'C3:a');groundReturn(ground,'C3',805,580);
    }
    const load=p.externalLoad?'RL':'Rref';
    add('R',load,960,350,{value:p.externalLoad?p.RL:10e9,rotation:90});
    path('C2:b',out,load+':a');groundReturn(ground,load,960,455);
    doc.probes={input:p.inputResistor?'Ri:a':'C1:a',output:'C2:b'};
    doc.traces=[{id:'P1',kind:'voltage',positive:'C1:a',negative:null},...['g','d','s'].map((pin,i)=>({id:'P'+(i+2),kind:'voltage',positive:'M3:'+pin,negative:null}))];
    label(doc.probes.input,'IN');label('C2:b','OUT');label('M3:g','G');label('M3:d','D');label('M3:s','S');label('VDD:p','VDD');
  }

  function network(p,build){
    const builder=build(p),{doc,add,link}=builder;
    let junction=0;
    builder.point=(x,y,visible=true)=>add('J','J'+(++junction),x,y,{schematicDecoration:true,schematicJunction:visible}).id+':j';
    builder.path=(...pins)=>pins.slice(1).forEach((pin,i)=>link(pins[i],pin));
    if(isLogic(p.type))logicNetwork(p,builder);
    else if(p.type==='precision-rectifier')precisionNetwork(p,builder);
    else if(p.type==='bridge-rectifier')bridgeNetwork(p,builder);
    else sourceNetwork(p,builder);
    Object.assign(doc.settings,{duration:p.duration,samples:p.samples,fmin:p.fmin,fmax:p.fmax,acSource:'V1',acReference:'source',integration:'adaptive',rtol:1e-5});
    if(p.type==='common-source'){
      // Resolve the probe's fast startup with a 1 nA absolute current tolerance.
      doc.settings.atolI=1e-9;
      const bias=Free.operatingPoint(doc).data[0],read=nodeReader(doc);
      for(const part of doc.components.filter(c=>c.type==='C'))part.initial=read(bias,part.id+':a')-read(bias,part.id+':b');
    }
    const bench=Bench.config(p.bench);
    bench.sourceIds??=isLogic(p.type)?['V1','V2']:['V1'];
    const result=Bench.apply(doc,bench);
    for(const w of result.wires){
      if(w.b==='G1:g'&&/^(?:RE|CE|RO|CO|CC)\d+:b$/.test(w.a))Object.assign(w,{route:'vertical',offset:440});
    }
    // Place the generator resistance in the vertical input lead where it fits.
    const nominalSource=doc.components.find(c=>c.id==='V1'),tap=doc.wires.find(w=>w.a==='V1:p');
    const end=tap&&doc.components.find(c=>c.id===tap.b.split(':')[0]);
    const rg=result.benchSetup?.sourceMap['V1:p']?.split(':')[0];
    if(rg&&end?.type==='J'&&end.x===nominalSource.x&&nominalSource.y-43-end.y>90){
      Object.assign(result.components.find(c=>c.id===rg),{x:end.x,y:(end.y+nominalSource.y-43)/2,rotation:270});
    }
    return result;
  }

  function nodeReader(doc){
    const {nodes}=Free.topology(doc),mapped=doc.benchSetup?.sourceMap||{};
    return (row,pin)=>{
      const index=nodes[mapped[pin]||pin];
      return index<0?0:row.values['N'+(index+1)];
    };
  }

  function sampleReader(p,doc){
    if(!is(p.type))return null;
    const read=nodeReader(doc);
    if(isLogic(p.type))return row=>({
      vin:read(row,'M1:g'),vin2:read(row,'M3:g'),out:read(row,p.type==='cmos-nor'?'M1:d':'M3:d'),
      current:row.currents.M1,ch1:row.vin,ch2:row.out
    });
    if(p.type==='precision-rectifier')return row=>({
      vin:read(row,'R1a:a'),out:read(row,'U1:out'),v2:read(row,'R2:a'),aux:read(row,'U2:out'),ch1:row.vin,ch2:row.out,clipped:row.clipped
    });
    if(p.type==='bridge-rectifier')return row=>({
      vin:read(row,'V1:p'),a:read(row,'R1:a'),b:read(row,'R1:b'),out:read(row,'R1:b')-read(row,'R1:a'),
      ch1:row.vin,ch2:row.out,math:row.out-row.vin,iD1:row.currents.D1,iD2:row.currents.D2,iD3:row.currents.D3,iD4:row.currents.D4
    });
    return row=>({
      clipped:row.clipped,vin:read(row,p.inputResistor?'Ri:a':'C1:a'),out:read(row,'C2:b'),
      afterRi:read(row,'C1:a'),gate:read(row,'M3:g'),drain:read(row,'M3:d'),source:read(row,'M3:s'),current:row.currents.M3,ch1:row.vin,ch2:row.out
    });
  }

  function sourceValues(p,doc,data){
    const q=Free.operatingPoint(doc).data[0],read=nodeReader(doc);
    const vg=read(q,'M3:g'),vd=read(q,'M3:d'),vs=read(q,'M3:s'),vdd=read(q,'VDD:p'),id=q.currents.M3,vgs=vg-vs,vds=vd-vs;
    const saturated=q.regions.M3==='saturazione';
    const gm=saturated?2*id/(vgs-p.mosVto):undefined;
    const go=saturated?p.mosLambda*id/(1+p.mosLambda*vds):undefined;
    const rin=1/(1/p.R1+1/p.R2),rout=saturated?1/(1/p.RD+go/(1+(p.bypass?0:p.RS*(gm+go)))):undefined;
    const values={vg,vd,vs,vdd,id,vgs,vds,region:q.regions.M3,gm,rin,rout};
    const end=data?.at(-1)?.x??0,start=Math.max(0,end-1/p.wave1.frequency),last=data?.filter(row=>row.x>=start);
    if(p.wave1.kind==='sine'&&end>=1/p.wave1.frequency&&last?.length>1){
      const input=Measures.stats(last,'vin').pp,after=Measures.stats(last,'afterRi').pp,out=Measures.stats(last,'out').pp;
      if(input>1e-12)values.ppGain=out/input;
      if(p.inputResistor&&input-after>1e-12)values.rinMeasured=p.Ri*after/(input-after);
    }
    return values;
  }

  function timeValues(p,data,doc){
    if(p.type==='common-source')return sourceValues(p,doc,data);
    const values={};
    if(p.type==='bridge-rectifier'){
      const m=Measures.stats(data,'out');
      return m?{outputMean:m.mean,minimum:m.min,maximum:m.max}:values;
    }
    if(p.type==='precision-rectifier'){
      for(const [key,compare] of [['positive',(a,b)=>a.vin>b.vin],['negative',(a,b)=>a.vin<b.vin]]){
        const peak=data.reduce((a,b)=>compare(a,b)?a:b);
        if(key==='positive'?peak.vin<=0:peak.vin>=0)continue;
        const v2=key==='positive'?-p.R1b/p.R1a*peak.vin:0;
        const ideal=-p.R1d*(peak.vin/p.R1c+v2/p.R2);
        const forward=key==='positive'?-v2*(1/p.R1b+1/p.R2):-peak.vin/p.R1a;
        const drop=p.diodeN*1.380649e-23*300.15/1.602176634e-19*Math.log1p(forward/p.diodeIs);
        values[key]={...peak,ideal,v2Ideal:v2,auxIdeal:v2+(key==='positive'?-drop:drop)};
      }
    }
    return values;
  }

  function metrics(p,values,format){
    const show=(label,value,unit)=>({label,value:format(value,unit)});
    if(isLogic(p.type))return [];
    if(p.type==='bridge-rectifier')return [show('Media di Vᴮ − Vᴬ',values.outputMean,'V'),show('Minimo di Vᴮ − Vᴬ',values.minimum,'V'),show('Massimo di Vᴮ − Vᴬ',values.maximum,'V')];
    if(p.type==='precision-rectifier')return [['positive','Semionda positiva'],['negative','Semionda negativa']].flatMap(([key,label])=>{
      const row=values[key];
      if(!row)return [];
      const pair=(name,a,b)=>({label:label+' · '+name,value:format(a,'V')+' (sim.) / '+format(b,'V')+' (ideale)'});
      return [pair('OUT',row.out,row.ideal),pair('V₂',row.v2,row.v2Ideal),pair('Vₒ′',row.aux,row.auxIdeal)];
    });
    return [show('Vᴅᴅ al punto di lavoro',values.vdd,'V'),show('Vɢ al punto di lavoro',values.vg,'V'),show('Vᴅ al punto di lavoro',values.vd,'V'),show('Vₛ al punto di lavoro',values.vs,'V'),
      show('Vɢₛ al punto di lavoro',values.vgs,'V'),show('Vᴅₛ al punto di lavoro',values.vds,'V'),show('Iᴅ al punto di lavoro',values.id,'A'),
      {label:'Regione al punto di lavoro',value:values.region},show('Rᵢₙ dal partitore',values.rin,'Ω'),show('Rₒᵤₜ stimata a metà banda',values.rout,'Ω'),
      ...(values.ppGain===undefined?[]:[show('Guadagno in modulo · Vpp OUT / IN',values.ppGain,'V/V')]),...(values.rinMeasured===undefined?[]:[show('Rᵢₙ dalla prova con Rᵢ',values.rinMeasured,'Ω')])];
  }

  const sourceResistors=['RD','RS','R1','R2'];
  const resistance=value=>Number.isFinite(value)&&value>=1&&value<=1e9;
  const positive=value=>Number.isFinite(value)&&value>0;
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function designSource(p,target){
    const {id,vds,gain,r1}=target;
    if(![id,vds,gain,r1].every(positive)||r1<=150e3)throw Error('Inserisci Iᴅ, Vᴅₛ e guadagno positivi. Per R₁ scegli un valore sopra 150 kΩ.');
    if(vds>=p.VDD)throw Error('Vᴅₛ deve essere minore di Vᴅᴅ.');
    const overdrive=Math.sqrt(2*id/(p.mosKp*(1+p.mosLambda*vds)));
    if(overdrive>vds)throw Error('Il punto assegnato è fuori dalla regione di saturazione del modello.');
    const gm=2*id/overdrive,go=p.mosLambda*id/(1+p.mosLambda*vds),gd=gm/gain-go;
    if(!(gd>0))throw Error('Il guadagno richiesto supera il limite di piccolo segnale per il punto assegnato.');
    const rd=1/gd,vs=p.VDD-vds-id*rd,vgs=p.mosVto+overdrive,vg=vs+vgs;
    if(!(vs>0&&vg<p.VDD))throw Error('Con questi obiettivi non c’è margine per la polarizzazione. Controlla Vᴅᴅ, Iᴅ, Vᴅₛ e guadagno.');
    const nominal={RD:rd,RS:vs/id,R1:r1,R2:r1*(p.VDD/vg-1)};
    if(Object.values(nominal).some(r=>!resistance(r)))throw Error('Le resistenze richieste superano l’intervallo del modello.');
    return {nominal,vg,vd:vs+vds,vs,vgs,gm,vdd:p.VDD};
  }

  function validateStudy(study){
    if(study===undefined)return;
    if(!record(study)||study.version!==1||!record(study.records))throw Error('Misure delle esperienze extra non valide.');
    for(const [type,value] of Object.entries(study.records)){
      if(!record(value))throw Error('Misure delle esperienze extra non valide.');
      if(isLogic(type)){
        if(!positive(value.vdd)||value.vdd>20||!Array.isArray(value.voltages)||value.voltages.length!==4||
          value.voltages.some(v=>v!==null&&(!Number.isFinite(v)||Math.abs(v)>1000)))throw Error('Misure CMOS non valide.');
      }else if(type==='common-source'){
        if(!record(value.target)||!record(value.nominal)||!record(value.measured)||
          !['id','vds','gain','r1'].every(key=>positive(value.target[key]))||value.target.r1<=150e3||
          !sourceResistors.every(key=>resistance(value.nominal[key])&&(value.measured[key]===null||resistance(value.measured[key])))||
          !positive(value.vdd)||value.vdd>20||!['nominal','measured',null].includes(value.applied))throw Error('Dimensionamento Common Source non valido.');
      }else throw Error('Esperienza extra non riconosciuta.');
    }
  }

  const columns={
    'precision-rectifier':[['vin','V1_V'],['out','OUT_V'],['v2','V2_V'],['aux','Vo_primo_V']],
    'bridge-rectifier':[['vin','Vg_V'],['a','VA_V'],['b','VB_V'],['out','VB_meno_VA_V'],...[1,2,3,4].map(i=>['iD'+i,'I_D'+i+'_A'])],
    'common-source':[['vin','IN_V'],['out','OUT_V'],['afterRi','Dopo_Ri_V'],['gate','VG_V'],['drain','VD_V'],['source','VS_V'],['current','ID_A']]
  };
  return {CATALOG,PRESETS,is,isLogic,designSource,sourceResistors,validateStudy,defaults,normalizeTime,fields,switches,applyPreset,presetHint,network,nodeReader,sampleReader,timeValues,sourceValues,metrics,columns};
});
