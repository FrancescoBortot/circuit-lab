/* Guided semiconductor experiments built on the free circuit engine. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./bench-model.js'),require('./semiconductors.js'));
  else root.SemiconductorLab=factory(root.FreeModel,root.BenchModel,root.Semiconductors);
})(typeof globalThis!=='undefined'?globalThis:this,function(Free,Bench,Devices){
  'use strict';

  const CATALOG=[
    {id:'diode-iv',type:'diode-iv',day:5,step:'1',name:'Diodo · caratteristica I–V',short:'I–V',description:'Misura la corrente diretta e ricava corrente di saturazione e fattore di idealità.'},
    {id:'half-wave',type:'half-wave',day:5,step:'2.1',name:'Raddrizzatore a semionda',short:'D',description:'Confronta ingresso e uscita con un carico resistivo e misura caduta sul diodo e valore medio.'},
    {id:'half-wave-rc',type:'half-wave-rc',day:5,step:'2.2',name:'Raddrizzatore con filtro RC',short:'D·C',description:'Misura ripple e valore medio al variare del carico e della frequenza.'},
    {id:'mos-iv',type:'mos-iv',day:5,step:'3.1–3.5',name:'nMOS · punto di lavoro e curve',short:'Q',description:'Trova il punto di lavoro e ricava λₙ, kₙ e VTN dalle curve di drain e di trasferimento.'},
    {id:'mos-amplifier',type:'mos-amplifier',day:6,step:'1',name:'Amplificatore nMOS invertente',short:'−gₘ',description:'Verifica la polarizzazione e confronta piccolo segnale, distorsione e curva in ampiezza.'},
    {id:'nmos-inverter',type:'nmos-inverter',day:6,step:'2.1',name:'Inverter nMOS resistivo',short:'¬',description:'Leggi i livelli logici e confronta la resistenza di conduzione con il modello a bassa VDS.'},
    {id:'nmos-nor',type:'nmos-nor',day:6,step:'2.2',name:'Porta NOR nMOS',short:'NOR',description:'Due nMOS in parallelo portano l’uscita a massa quando almeno un ingresso è alto.'},
    {id:'nmos-nand',type:'nmos-nand',day:6,step:'2.2',name:'Porta NAND nMOS',short:'NAND',description:'Due nMOS in serie portano l’uscita a massa quando entrambi gli ingressi sono alti.'},
    {id:'cmos-inverter',type:'cmos-inverter',day:6,step:'2.3',name:'Inverter CMOS',short:'CMOS',description:'Confronta i livelli di uscita con quelli dell’inverter a carico resistivo.'}
  ];
  const DIODE_RANGES=[
    {key:'forward-1u', current:'1–10 µA', resistance:1e6, label:'1 MΩ'},
    {key:'forward-10u', current:'10–100 µA', resistance:100e3, label:'100 kΩ'},
    {key:'forward-100u', current:'0,1–1 mA', resistance:10e3, label:'10 kΩ'},
    {key:'forward-1m', current:'1–10 mA', resistance:1e3, label:'1 kΩ'}
  ];
  const diodeRange=key=>DIODE_RANGES.find(range=>range.key===key);
  const RECTIFIER_R1='R₁ da 56 a 82 kΩ (esempio 68 kΩ).';
  const FILTER_C1='C₁ da 22 a 47 µF (esempio 22 µF), positivo su OUT.';
  const FILTER_LOAD='Rᴸ da 2,2 a 6,8 kΩ (esempio 4,7 kΩ), in parallelo.';
  const MOS_GATE_R='R₁ di protezione da 0,5 a 1 MΩ (esempio 680 kΩ).';
  const MOS_BIAS='Riprendi il punto di lavoro misurato nella quinta giornata. Usa Rᴅ = 10 kΩ e C₁ = C₂ = 100 nF.';
  const logicMeasurements='Prima CH1 su IN1 e CH2 su IN2, con trigger su IN1. Poi sposta CH2 su OUT e annota VOUT per 00, 01, 10 e 11.';
  const PRESET_HINTS={
    'half-wave':{sine:RECTIFIER_R1+' Imposta 10 Vpp a 50 Hz. Misura i picchi di IN e OUT e il valore medio.'},
    'half-wave-rc':{
      probe:RECTIFIER_R1+' '+FILTER_C1+' A 50 Hz, misura media e ripple con la sonda ×10, prima di aggiungere Rᴸ.',
      load:FILTER_LOAD+' A 50 Hz, misura di nuovo media e ripple.',
      fast:'Mantieni lo stesso Rᴸ e la stessa ampiezza della prova a 50 Hz. Passa a 1 kHz e misura di nuovo media e ripple.'
    },
    'mos-iv':{
      qpoint:MOS_GATE_R+' Fissa Vᴅₛ a 7 V e regola Vɢₛ fino a Iᴅ ≈ 0,7 mA. Annota Vɢₛ, Iᴅ e Vᴅₛ.',
      output:'Tieni Vɢₛ al valore del punto di lavoro. Varia Vᴅₛ da 0,2 a 9 V e misura Iᴅ in circa dieci punti, includendo la zona di transizione.',
      transfer:'Tieni Vᴅₛ a 7 V. Varia Vɢₛ da 0,2 V e prendi più punti vicino alla soglia. Fermati al primo limite raggiunto fra 4,5 V e 4 mA di drain.',
      meter:MOS_GATE_R+' Misura la tensione prima e dopo R₁, usando un punto alla volta, e osserva come cambia Iᴅ.'
    },
    'mos-amplifier':{
      small:MOS_BIAS+' Verifica Vᴅₛ e Iᴅ, poi misura IN e OUT con 100 mVpp a 3 kHz.',
      large:'Mantieni la polarizzazione e la frequenza a 3 kHz. A 1 Vpp confronta la forma d’onda con quella di piccolo segnale.',
      vtc:'A 3 kHz misura Vpp in ingresso e in uscita. Sequenza suggerita in mVpp: 100, 150, 200, 300, 450, 600, 800, 1000. Cerca dove OUT si discosta dalla retta.',
      bode:'Verifica il punto di lavoro prima di leggere la risposta di piccolo segnale.'
    },
    'nmos-nor':{logic:logicMeasurements},
    'nmos-nand':{logic:logicMeasurements}
  };
  const COMPONENT_HINTS={
    'half-wave':{R1:RECTIFIER_R1},
    'half-wave-rc':{R1:RECTIFIER_R1,C1:FILTER_C1,RL:FILTER_LOAD},
    'mos-iv':{gateR:MOS_GATE_R}
  };
  const componentHint=(type,key)=>COMPONENT_HINTS[type]?.[key]||'';
  function presetHint(type,key){
    if(type!=='diode-iv')return PRESET_HINTS[type]?.[key]||'';
    const range=diodeRange(key);
    if(!range)return '';
    const reference=key==='forward-1u'?'Valore indicato nella scheda.':'Valore consigliato per partire.';
    return 'R₁ = '+range.label+' in serie al diodo per '+range.current+'. '+reference+
      ' Regola la tensione DC leggendo la corrente. Riporta la tensione a 0 V prima di cambiare resistenza.';
  }
  const PRESETS={
    'diode-iv':[['forward','Curva completa · 1 µA–10 mA'],...DIODE_RANGES.map(r=>[r.key,r.current+' con '+r.label])],
    'half-wave':[['sine','Sinusoide · 10 Vpp · 50 Hz']],
    'half-wave-rc':[['probe','Sonda ×10 · 50 Hz'],['load','Carico esterno · 50 Hz'],['fast','Carico esterno · 1 kHz']],
    'mos-iv':[['qpoint','Punto di lavoro · 7 V, 0,7 mA'],['output','Curva Iᴅ–Vᴅₛ · Vɢₛ fisso'],['transfer','Curva Iᴅ–Vɢₛ · Vᴅₛ fisso'],['meter','Voltmetro da 10 MΩ sul gate']],
    'mos-amplifier':[['small','Piccolo segnale · 100 mVpp · 3 kHz'],['large','Segnale ampio · 1 Vpp · 3 kHz'],['vtc','Curva in ampiezza · 0–1 Vpp'],['bode','Bode attorno al punto di lavoro']],
    'nmos-inverter':[['logic','Quadra · 0–5 V · 50 Hz']],
    'nmos-nor':[['logic','Due ingressi · 50 Hz e 100 Hz']],
    'nmos-nand':[['logic','Due ingressi · 50 Hz e 100 Hz']],
    'cmos-inverter':[['logic','Quadra · 0–5 V · 50 Hz']]
  };
  const TYPES=CATALOG.map(c=>c.type);
  const is=p=>TYPES.includes(typeof p==='string'?p:p?.type);
  const rectifier=p=>['half-wave','half-wave-rc'].includes(p.type);
  const logic=p=>['nmos-inverter','nmos-nor','nmos-nand','cmos-inverter'].includes(p.type);
  const twoInputs=p=>['nmos-nor','nmos-nand'].includes(p.type);
  const mos=p=>p.type==='mos-iv'||p.type==='mos-amplifier'||logic(p);
  const nominalScopeLoad=10e6;
  const outputDcReference=10e9;
  const outputChannel=(channel,pin)=>channel.enabled&&['output',pin,'RL:a'].includes(channel.target);
  const wave=(kind,vpp,frequency,offset=0,level=0)=>({kind,vpp,frequency,offset,level,phase:0,duty:50});
  const range=(count,start,stop)=>Array.from({length:count},(_,i)=>start+(stop-start)*i/(count-1));
  const dc=(doc,overrides)=>Free.operatingPoint(doc,overrides).data[0];
  const analysisOptions=p=>{
    if(p.type==='diode-iv')return [['diodeIV','Caratteristica I–V']];
    if(p.type==='mos-iv')return [['mosOutput','Curva Iᴅ–Vᴅₛ'],['mosTransfer','Curva Iᴅ–Vɢₛ']];
    if(p.type==='mos-amplifier')return [['time','Tempo · Transitorio'],['bode','Frequenza · Bode'],['vtc','Ampiezza · VTC']];
    return [['time','Tempo · Transitorio']];
  };

  function defaults(type,base){
    const p={...Free.clone(base),type,diodeIs:35e-12,diodeN:1.5,R1:type==='diode-iv'?1e3:68e3,C1:22e-6,RL:4.7e3,externalLoad:false,
      wave1:wave(type==='diode-iv'?'dc':'sine',10,50,0,1),wave2:wave('dc',0,100),dcPoints:41};
    if(mos(p))Object.assign(p,{mosKp:1.5e-3,mosVto:1.4,mosLambda:.02,gateR:680e3,drainBias:7,gateMeter:false});
    if(type==='mos-iv')p.wave1=wave('dc',0,50,0,nominalGate(p,.0007));
    if(type==='half-wave-rc')p.bench=probeSetup();
    if(type==='mos-amplifier')Object.assign(p,{wave1:wave('sine',.1,3000),RD:1e4,VDD:14,gateBias:nominalGate(p,.0007),C1:100e-9,C2:100e-9,RL:10e6,sweepMax:1,sweepPoints:11,fmin:1,fmax:1e6});
    if(logic(p))Object.assign(p,{wave1:wave('square',5,50,2.5),wave2:wave('square',5,100,2.5),RD:1e4,VDD:5,pKp:8e-4,pVto:1.4,pLambda:.02});
    return normalizeTime(p);
  }

  function normalizeTime(p){
    const next=Free.clone(p);
    if(next.autoTime&&rectifier(next)){
      const periods=next.type==='half-wave'?3:next.wave1.frequency>=500?64:12;
      next.duration=periods/next.wave1.frequency;
    }
    if(next.autoTime&&next.type==='mos-amplifier')next.duration=4/next.wave1.frequency;
    if(next.autoTime&&logic(next))next.duration=2/Math.min(next.wave1.frequency,twoInputs(next)?next.wave2.frequency:Infinity);
    return next;
  }

  function fields(p){
    if(p.type==='mos-iv')return [
      ['gateR','Resistenza di protezione R₁','res',1,1e9,'RG'],
      ['drainBias','Polarizzazione Vᴅₛ','V',.2,9,'VDD'],
      ...mosFields()
    ];
    if(p.type==='mos-amplifier')return [
      ['gateBias','Polarizzazione del gate','V',0,20,'VG'],
      ['gateR','Resistenza di protezione R₁','res',1,1e9,'RG'],
      ['VDD','Alimentazione Vᴅᴅ','V',.1,30,'VDD'],
      ['RD','Resistenza di drain Rᴅ','res',1,1e9,'RD'],
      ['C1','Condensatore d’ingresso C₁','cap',1e-12,1,'C1'],
      ['C2','Condensatore di uscita C₂','cap',1e-12,1,'C2'],
      ['RL','Carico di uscita Rᴸ','res',1,1e12,'RL'],
      ...mosFields()
    ];
    if(logic(p))return [
      ['VDD','Alimentazione Vᴅᴅ','V',.1,20,'VDD'],
      ...(p.type==='cmos-inverter'?[['pKp','Parametro kₚ','conductanceFactor',1e-9,1,'M2'],['pVto','Modulo della soglia |VTP|','V',.01,20,'M2'],['pLambda','Modulazione di canale λₚ','V⁻¹',0,1,'M2']]:[['RD','Resistenza di pull-up Rᴅ','res',1,1e9,'RD']]),
      ...mosFields()
    ];
    return [
      ['R1',p.type==='diode-iv'?'Resistenza di serie R₁':'Carico resistivo R₁','res',1,1e9,'R1'],
      ...(p.type==='half-wave-rc'?[['C1','Condensatore di filtro C₁','cap',1e-9,1,'C1'],...(p.externalLoad?[['RL','Carico esterno Rᴸ','res',1,1e9,'RL']]:[])]:[]),
      ['diodeIs','Corrente di saturazione Iₛ','smallCurrent',1e-20,1e-3,'D1'],
      ['diodeN','Fattore di idealità n','',.5,4,'D1']
    ];
  }

  function mosFields(){
    return [
      ['mosKp','Parametro kₙ','conductanceFactor',1e-9,1,'M1'],
      ['mosVto','Tensione di soglia VTN','V',.01,20,'M1'],
      ['mosLambda','Modulazione di canale λₙ','V⁻¹',0,1,'M1']
    ];
  }

  function validate(p){
    const errors={};
    for(const [key,, ,min,max] of fields(p))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)errors[key]='Valore fuori dall’intervallo del modello.';
    if(p.type==='half-wave-rc'&&typeof p.externalLoad!=='boolean')errors.externalLoad='Carico esterno non valido.';
    if(p.type==='mos-iv'){
      if(typeof p.gateMeter!=='boolean')errors.gateMeter='Configurazione del voltmetro non valida.';
      if(p.wave1?.kind!=='dc'||p.wave1.level<0||p.wave1.level>4.5)errors['wave1.level']='Scegli una polarizzazione tra 0 e 4,5 V.';
    }
    if(p.type==='mos-amplifier'&&p.sweepMax>1)errors.sweepMax='La prova in ampiezza arriva al massimo a 1 Vpp.';
    if(!Number.isInteger(p.dcPoints)||p.dcPoints<8||p.dcPoints>201)errors.dcPoints='Scegli da 8 a 201 punti.';
    return errors;
  }

  function build(p){
    const doc=Free.blank();
    doc.name=CATALOG.find(c=>c.type===p.type).name;
    const add=(type,id,x,y,params={})=>{
      const part=Object.assign(Free.component(type,id,x,y),params);
      doc.components.push(part);
      return part;
    };
    const link=(a,b)=>doc.wires.push({id:'W'+(doc.wires.length+1),a,b});
    const ground=(pin,x,y)=>{
      const id='G'+(doc.components.filter(c=>c.type==='G').length+1);
      add('G',id,x,y);
      link(pin,id+':g');
      return id;
    };
    const voltage=(id,x,y,w)=>{
      const source=add('V',id,x,y);
      Object.assign(source.wave,Free.clone(w));
      if(w.kind==='ground')Object.assign(source.wave,{kind:'dc',level:0});
      ground(id+':n',x,y+105);
      return source;
    };
    const label=(pin,name)=>{(doc.nodeLabels??={})[pin]=name;};
    return {doc,add,link,ground,voltage,label};
  }

  function network(p,analysis){
    if(p.type==='mos-iv')return mosCurveNetwork(p,analysis);
    if(p.type==='mos-amplifier'||logic(p))return activeNetwork(p);
    const {doc,add,link,ground,voltage,label}=build(p);
    voltage('V1',120,250,p.wave1);
    const diode={is:p.diodeIs,n:p.diodeN};
    if(p.type==='diode-iv'){
      add('R','R1',290,150,{value:p.R1});
      add('D','D1',495,250,{...diode,rotation:90});
      link('V1:p','R1:a');link('R1:b','D1:a');ground('D1:b',495,355);
      doc.probes={input:'V1:p',output:'D1:a'};
      label('D1:a','VD');
      Object.assign(doc.settings,{dcSource:'V1',dcStart:0,dcStop:Math.min(20,diodeBias(p,.01)),dcPoints:p.dcPoints,analysis:'dc'});
      doc.traces=[{id:'P1',kind:'current',component:'D1'}];
    }else{
      add('D','D1',365,150,diode);
      add('R','R1',540,250,{value:p.R1,rotation:90});
      link('V1:p','D1:a');link('D1:b','R1:a');ground('R1:b',540,355);
      if(p.type==='half-wave-rc'){
        add('C','C1',665,250,{value:p.C1,initial:p.initial,rotation:90});
        link('R1:a','C1:a');ground('C1:b',665,355);
        if(p.externalLoad){
          add('R','RL',805,250,{value:p.RL,rotation:90});
          link('C1:a','RL:a');ground('RL:b',805,355);
        }
      }
      doc.probes={input:'V1:p',output:'D1:b'};
      label('D1:b','OUT');
    }
    label('V1:p','IN');
    Object.assign(doc.settings,{duration:p.duration,samples:p.samples,fmin:p.fmin,fmax:p.fmax,acSource:'V1',acReference:'source',integration:'adaptive',rtol:1e-5});
    if(p.type==='diode-iv')return doc;
    const config=Bench.config(p.bench);
    config.sourceIds=['V1'];
    const result=Bench.apply(doc,config);
    for(const wire of result.wires){
      // Return below the shunt symbols so the ground path cannot cover a tip lead.
      if(wire.b==='G1:g'&&/^(?:RE|CE|RO|CO)\d+:b$/.test(wire.a))Object.assign(wire,{route:'vertical',offset:250});
    }
    return result;
  }

  const mosModel=p=>({polarity:'n',kp:p.mosKp,vto:p.mosVto,lambda:p.mosLambda});

  function activeNetwork(p){
    const {doc,add,link,ground,voltage,label}=build(p);
    const amplifier=p.type==='mos-amplifier',cmos=p.type==='cmos-inverter',nand=p.type==='nmos-nand';
    const config=Bench.config(p.bench),real=config.mode==='real';
    const loadIsScope=real&&(cmos||amplifier&&p.RL===nominalScopeLoad);
    voltage('V1',120,nand?400:290,p.wave1);
    voltage('VDD',735,85,wave('dc',0,50,0,p.VDD));
    add('M','M1',465,nand?375:290,mosModel(p));
    ground('M1:s',480,nand?505:425);
    let output='M1:d',loadGround;
    if(amplifier){
      add('C','C1',265,225,{value:p.C1});
      add('C','C2',605,210,{value:p.C2});
      add('R','RG',265,345,{value:p.gateR});
      voltage('VG',120,475,wave('dc',0,50,0,p.gateBias));
      link('V1:p','C1:a');link('C1:b','M1:g');link('VG:p','RG:a');link('RG:b','M1:g');
      link('M1:d','C2:a');
      // The AC-coupled output needs a DC reference until a DC-coupled probe is attached.
      const load=loadIsScope?'Rref':'RL';
      add('R',load,735,325,{value:loadIsScope?outputDcReference:p.RL,rotation:90});
      link('C2:b',load+':a');loadGround=ground(load+':b',735,450);
      output='C2:b';
      label('M1:g','GATE');label('M1:d','DRAIN');
    }else{
      link('V1:p','M1:g');
      if(cmos){
        add('M','M2',465,125,{polarity:'p',kp:p.pKp,vto:p.pVto,lambda:p.pLambda,rotation:180});
        link('V1:p','M2:g');link('M2:s','VDD:p');link('M2:d','M1:d');
        const load=loadIsScope?'Rref':'RL';
        add('R',load,640,285,{value:loadIsScope?outputDcReference:nominalScopeLoad,rotation:90});
        link('M1:d',load+':a');loadGround=ground(load+':b',640,425);
      }
      if(twoInputs(p)){
        voltage('V2',120,105,p.wave2);
        add('M','M3',nand?465:630,nand?230:290,mosModel(p));
        link('V2:p','M3:g');label('V2:p','IN2');
        if(nand){
          link('M3:s','M1:d');output='M3:d';
          // Resolve the floating midpoint when both channels are off.
          add('R','Rleak',620,395,{value:100e6,rotation:90});
          link('M1:d','Rleak:a');ground('Rleak:b',620,505);
        }
        else{link('M3:d','M1:d');ground('M3:s',645,425);}
      }
    }
    if(!cmos){
      add('R','RD',480,105,{value:p.RD,rotation:90});
      link('VDD:p','RD:a');link('RD:b',amplifier?'M1:d':output);
    }
    doc.probes={input:'V1:p',output};
    label('V1:p',twoInputs(p)?'IN1':'IN');label(output,'OUT');
    Object.assign(doc.settings,{duration:p.duration,samples:p.samples,fmin:p.fmin,fmax:p.fmax,acSource:'V1',acReference:'source',integration:'adaptive',rtol:1e-5});
    if(amplifier){
      const bias=dc(doc),topology=Free.topology(doc);
      for(const part of doc.components.filter(c=>c.type==='C'))part.initial=nodeVoltage(topology,bias,part.id+':a')-nodeVoltage(topology,bias,part.id+':b');
    }
    if(loadIsScope){
      // Keep imported channel selections that named the old implicit shunt.
      const legacyTargets={'RL:a':output,'RL:b':'G1:g',[loadGround+':g']:'G1:g'};
      for(const channel of config.channels)channel.target=legacyTargets[channel.target]??channel.target;
      if(config.channels.some(channel=>outputChannel(channel,output)&&channel.coupling==='dc')){
        if(amplifier){
          // Give the open output a terminal while Bench initializes the probe.
          add('J','Jout',735,210);
          link(output,'Jout:j');
        }
        const temporary=new Set(['Rref',loadGround]);
        doc.components=doc.components.filter(c=>!temporary.has(c.id));
        doc.wires=doc.wires.filter(w=>![w.a,w.b].some(pin=>temporary.has(pin.split(':')[0])));
      }
    }
    config.sourceIds=twoInputs(p)?['V1','V2']:['V1'];
    return Bench.apply(doc,config);
  }

  function nodeVoltage(topology,row,pin){
    const index=topology.nodes[pin];
    return index<0?0:row.values[topology.groups[index].name];
  }

  function inherit(p,seeds){
    if(!mos(p))return;
    const previous=seeds.find(q=>q&&mos(q));
    if(previous)for(const key of ['mosKp','mosVto','mosLambda'])p[key]=previous[key];
    if(p.type==='mos-iv')p.wave1.level=Math.min(4.5,nominalGate(p,.0007));
    if(p.type==='mos-amplifier'){
      const source=seeds.find(q=>q?.type==='mos-iv');
      if(source){
        const q=dc(mosCurveNetwork(source));
        Object.assign(p,{mosKp:source.mosKp,mosVto:source.mosVto,mosLambda:source.mosLambda,gateR:source.gateR,gateBias:q.vin,VDD:Math.min(30,q.out+p.RD*q.currents.M1)});
      }else p.gateBias=Math.min(20,nominalGate(p,.0007));
    }
  }

  function mosCurveNetwork(p,analysis){
    const {doc,add,link,ground,voltage,label}=build(p);
    voltage('V1',110,290,p.wave1);
    voltage('VDD',610,260,wave('dc',0,50,0,p.drainBias));
    add('R','RG',270,200,{value:p.gateR});
    add('M','M1',455,200,mosModel(p));
    link('V1:p','RG:a');link('RG:b','M1:g');link('VDD:p','M1:d');
    ground('M1:s',455,355);
    if(p.gateMeter){
      add('R','RM',300,305,{value:10e6,rotation:90});
      link('RG:b','RM:a');ground('RM:b',300,410);
    }
    label('M1:g','GATE');label('M1:d','DRAIN');
    doc.probes={input:'M1:g',output:'M1:d'};
    doc.traces=[{id:'P1',kind:'current',component:'M1'}];
    const transfer=analysis==='mosTransfer';
    const stop=transfer?transferLimit(p):9;
    Object.assign(doc.settings,{analysis:'dc',dcSource:transfer?'V1':'VDD',dcStart:Math.min(.2,stop/10),dcStop:stop,dcPoints:p.dcPoints});
    return doc;
  }

  function nominalGate(p,current){
    const k=p.mosKp*(1+p.mosLambda*p.drainBias),v=p.drainBias;
    const u=Math.sqrt(2*current/k);
    return p.mosVto+(u<=v?u:current/(k*v)+v/2);
  }

  function meterRatio(p){return p.gateMeter?1+p.gateR/10e6:1;}
  function transferLimit(p){return Math.min(4.5,nominalGate(p,.004)*meterRatio(p));}

  function probeSetup(){
    const config=Bench.config({mode:'real',wireR:0});
    for(const channel of config.channels)channel.kind='probe10';
    return config;
  }

  function applyPreset(params,key){
    const p=Free.clone(params);
    if(p.type==='diode-iv'){
      const range=diodeRange(key);
      if(range){p.R1=range.resistance;p.wave1.level=0;}
      if(key==='forward')p.R1=DIODE_RANGES.at(-1).resistance;
    }
    if(rectifier(p)){
      if(['load','fast'].includes(key)&&p.wave1.kind==='sine')p.wave1.frequency=key==='fast'?1000:50;
      else p.wave1=wave('sine',10,key==='fast'?1000:50);
      p.autoTime=true;
      if(p.type==='half-wave-rc'){
        p.externalLoad=key!=='probe';
        p.bench=probeSetup();
      }
    }
    if(p.type==='mos-iv'){
      if(key==='qpoint'||key==='transfer')p.drainBias=7;
      if(key==='qpoint')p.wave1.level=nominalGate(p,.0007);
      p.gateMeter=key==='meter';
      return {parameters:p,analysis:key==='transfer'?'mosTransfer':'mosOutput'};
    }
    if(p.type==='mos-amplifier'){
      p.wave1=wave('sine',key==='large'?1:.1,3000);
      p.autoTime=true;
      if(key==='vtc')p.sweepMax=1;
      return {parameters:normalizeTime(p),analysis:['bode','vtc'].includes(key)?key:'time'};
    }
    if(logic(p)){
      p.wave1=wave('square',5,50,2.5);p.wave2=wave('square',5,100,2.5);
      p.VDD=5;p.autoTime=true;
    }
    return {parameters:normalizeTime(p),analysis:analysisOptions(p)[0][0]};
  }

  function diodeBias(p,current){
    return p.R1*current+p.diodeN*Devices.VT*Math.log1p(current/p.diodeIs);
  }

  function lineFit(rows,x,y){
    const avg=key=>rows.reduce((sum,row)=>sum+key(row),0)/rows.length;
    const mx=avg(x),my=avg(y);
    const variance=avg(row=>(x(row)-mx)**2);
    const slope=avg(row=>(x(row)-mx)*(y(row)-my))/variance;
    return {slope,intercept:my-slope*mx};
  }

  function diodeCurve(p,options){
    const doc=network(p),maxCurrent=Math.min(.01,dc(doc,{V1:20}).currents.D1);
    if(maxCurrent<=1e-6)throw Error('Riduci R₁ per superare 1 µA con la sorgente da 20 V.');
    const currents=range(p.dcPoints,-6,Math.log10(maxCurrent)).map(x=>10**x);
    let maxResidual=0;
    const data=currents.map((current,i)=>{
      const point=Free.operatingPoint(doc,{V1:diodeBias(p,current)}),row=point.data[0];
      maxResidual=Math.max(maxResidual,point.maxResidual);
      options.onProgress?.((i+1)/currents.length);
      return {x:row.out,out:row.currents.D1,source:row.vin};
    });
    options.capture?.({method:'Scansione DC · stati stazionari indipendenti',maxResidual});
    const fit=lineFit(data,row=>row.x,row=>Math.log(row.out));
    const n=1/(fit.slope*Devices.VT),is=Math.exp(fit.intercept);
    return {data:data.map(row=>{
      const linear=Math.exp(fit.slope*row.x+fit.intercept);
      return {...row,linear,residual:row.out-linear};
    }),values:{n,is}};
  }

  function mosCurve(p,analysis,options){
    const doc=mosCurveNetwork(p,analysis),transfer=analysis==='mosTransfer';
    const q=dc(doc),vgs=q.vin,vds=q.out,id=q.currents.M1;
    const scan=Free.dcSweep(doc,options);
    options.capture?.(scan);
    const data=scan.data.map(row=>({x:transfer?row.vin:row.out,out:row.currents.M1,source:row.x}));
    const values={vgs,vds,id,gateSource:p.wave1.level};
    // Two simulated points around the bias, restricted to the saturation region.
    const vd1=Math.max(.2,vds-.2),vd2=Math.min(9,vds+.2);
    const gateDelta=.05,vg1=p.wave1.level-gateDelta,vg2=p.wave1.level+gateDelta;
    if(vd1<vd2&&vg1>=0&&vg2<=transferLimit(p)){
      const near=[dc(doc,{VDD:vd1}),dc(doc,{VDD:vd2}),dc(doc,{V1:vg1}),dc(doc,{V1:vg2})];
      if(near.every(row=>row.regions.M1==='saturazione')){
        const [i1,i2,j1,j2]=near.map(row=>row.currents.M1),slope=(i2-i1)/(vd2-vd1);
        const lambda=slope/(i1-slope*vd1),a=Math.sqrt(j1),b=Math.sqrt(j2);
        const vto=(near[2].vin*b-near[3].vin*a)/(b-a),kp=2*id/((vgs-vto)**2*(1+lambda*vds));
        if([lambda,vto,kp].every(Number.isFinite))Object.assign(values,{lambda,vto,kp,rd:slope>0?1/slope:Infinity});
      }
    }
    return {data,values};
  }

  function simulate(p,options={}){
    const doc=network(p),result=Free.simulate(doc,options);
    options.capture?.(result);
    const topology=Free.topology(doc),in2=doc.benchSetup?.sourceMap['V2:p']||'V2:p';
    return result.data.map(row=>({x:row.x,vin:row.vin,out:row.out,current:row.currents.D1??row.currents.M1,
      ...(twoInputs(p)?{vin2:nodeVoltage(topology,row,in2)}:{})}));
  }

  function periodStats(data,key,start,end){
    let min=Infinity,max=-Infinity,area=0;
    for(let i=1;i<data.length;i++){
      const a=data[i-1],b=data[i],lo=Math.max(start,a.x),hi=Math.min(end,b.x);
      if(hi<=lo)continue;
      const sample=t=>a[key]+(b[key]-a[key])*(t-a.x)/(b.x-a.x);
      const v=sample(lo),w=sample(hi);
      area+=(v+w)/2*(hi-lo);
      min=Math.min(min,v,w);max=Math.max(max,v,w);
    }
    return {min,max,mean:area/(end-start),pp:max-min};
  }

  function timeValues(p,data){
    if(!['sine','square','triangle'].includes(p.wave1.kind))return {};
    const period=1/p.wave1.frequency,end=data.at(-1).x;
    if(end<period*(1-1e-12))return {};
    const start=Math.max(0,end-period),input=periodStats(data,'vin',start,end),output=periodStats(data,'out',start,end);
    const previous=end>=2*period*(1-1e-12)?periodStats(data,'out',Math.max(0,start-period),start):null;
    const settled=Boolean(previous&&Math.max(Math.abs(output.max-previous.max),Math.abs(output.min-previous.min))<Math.max(1e-4,.01*output.pp));
    return {inputMean:input.mean,outputMean:output.mean,ripple:output.pp,drop:input.max-output.max,settled};
  }

  const logicLevel=v=>v<1?'0':v>4?'1':'—';
  function logicValues(p){
    const doc=network(p),two=twoInputs(p),topology=Free.topology(doc),in2=doc.benchSetup?.sourceMap['V2:p']||'V2:p';
    const states=w=>['sine','square','triangle'].includes(w.kind)?[w.offset-w.vpp/2,w.offset+w.vpp/2]:[w.kind==='dc'?w.level:0];
    const truth=states(p.wave1).flatMap(a=>(two?states(p.wave2):[null]).map(b=>{
      const row=dc(doc,{V1:a,...(two?{V2:b}:{})});
      const v2=two?nodeVoltage(topology,row,in2):null;
      return {vin:row.vin,vin2:v2,out:row.out,a:logicLevel(row.vin),b:two?logicLevel(v2):null,level:logicLevel(row.out),current:row.currents.M1};
    }));
    const high=truth.find(row=>row.a==='1'),ron=high?.current>1e-12?high.out/high.current:undefined;
    const overdrive=high?.vin-p.mosVto,predicted=overdrive>0?1/(p.mosKp*overdrive):undefined;
    return {truth,...(p.type==='nmos-inverter'?{ron,predicted,vol:predicted===undefined?undefined:p.VDD*predicted/(p.RD+predicted)}:{})};
  }

  function amplifierValues(p,data){
    const doc=network(p),q=dc(doc),topology=Free.topology(doc),vgs=nodeVoltage(topology,q,'M1:g'),vds=nodeVoltage(topology,q,'M1:d'),id=q.currents.M1;
    const saturated=q.regions.M1==='saturazione';
    const gm=saturated?2*id/(vgs-p.mosVto):undefined;
    const ro=saturated&&p.mosLambda>0?(1+p.mosLambda*vds)/(p.mosLambda*id):Infinity;
    const ac=Free.bode(doc,{frequencies:[p.wave1.frequency]}).data[0];
    const config=doc.benchSetup?.config,probeConductance=config?.channels
      .filter(channel=>outputChannel(channel,'C2:b'))
      .reduce((sum,channel)=>sum+1/(channel.kind==='probe10'?config.probeR:config.scopeR),0)??0;
    const loadConductance=(!config||p.RL!==nominalScopeLoad?1/p.RL:0)+probeConductance;
    const values={vgs,vds,id,gm,gain:gm===undefined?undefined:-gm/(1/p.RD+1/ro+loadConductance),acGain:ac.magnitude,region:q.regions.M1};
    if(p.wave1.kind==='sine'&&data?.at(-1)?.x>=1/p.wave1.frequency){
      const end=data.at(-1).x,start=end-1/p.wave1.frequency;
      const input=periodStats(data,'vin',start,end),output=periodStats(data,'out',start,end);
      if(input.pp>0)values.ppGain=output.pp/input.pp;
    }
    return values;
  }

  function analyze(p,analysis,options={}){
    if(analysis==='diodeIV')return diodeCurve(p,options);
    if(analysis==='mosOutput'||analysis==='mosTransfer')return mosCurve(p,analysis,options);
    if(analysis==='time'){
      const data=simulate(p,options);
      return {data,values:logic(p)?logicValues(p):p.type==='mos-amplifier'?amplifierValues(p,data):timeValues(p,data)};
    }
    throw Error('Analisi non disponibile per questo circuito.');
  }

  function metrics(p,analysis,values,format){
    const show=(label,value,unit)=>({label,value:format(value,unit)});
    if(analysis==='diodeIV')return [show('Iₛ dal fit',values.is,'A'),show('n dal fit',values.n,'')];
    if(analysis==='mosOutput'||analysis==='mosTransfer'){
      const bias=[show('Vɢₛ al punto di lavoro',values.vgs,'V'),show('Vᴅₛ al punto di lavoro',values.vds,'V'),show('Iᴅ al punto di lavoro',values.id,'A')];
      if(p.gateMeter)bias.unshift(show('Tensione a monte di R₁',values.gateSource,'V'));
      return bias.concat(values.kp===undefined?[{label:'Stima dei parametri',value:'Servono punti attorno a Q in saturazione'}]:[
        show('λₙ da due punti',values.lambda,'V⁻¹'),show('rₒ da due punti',values.rd,'Ω'),show('VTN da due punti',values.vto,'V'),show('kₙ ricavato',values.kp,'A/V²')
      ]);
    }
    if(p.type==='mos-amplifier')return [show('Vɢₛ al punto di lavoro',values.vgs,'V'),show('Vᴅₛ al punto di lavoro',values.vds,'V'),show('Iᴅ al punto di lavoro',values.id,'A'),
      {label:'Regione al punto di lavoro',value:values.region},show('Transconduttanza gₘ',values.gm,'S'),show('Guadagno previsto a centro banda',values.gain,'V/V'),show('Modulo a piccolo segnale',values.acGain,'V/V'),
      ...(values.ppGain===undefined?[]:[show('Rapporto Vpp OUT / IN',values.ppGain,'V/V')]),
      ...(values.fitGain===undefined?[]:[show('Pendenza VTC · fino a 0,2 Vpp',values.fitGain,'V/V')])];
    if(logic(p))return p.type==='nmos-inverter'?[show('Rₒₙ da Vᴏʟ / Iᴅ',values.ron,'Ω'),show('Rₒₙ · limite a Vᴅₛ bassa',values.predicted,'Ω'),show('Vᴏʟ prevista da partitore',values.vol,'V')]:[];
    if(values.outputMean===undefined)return [];
    return [show('Media IN · ultimo periodo',values.inputMean,'V'),show('Media OUT · ultimo periodo',values.outputMean,'V'),
      p.type==='half-wave'?show('Differenza dei picchi IN − OUT',values.drop,'V'):show('Ripple OUT · ultimo periodo',values.ripple,'Vpp')];
  }

  function summary(p){
    if(p.type==='diode-iv'||rectifier(p))return [{label:'Modello del diodo',value:'Shockley · 27 °C'}];
    return [{label:'Modello MOSFET',value:'Legge quadratica · 27 °C'}];
  }

  function vtcValues(p,data){
    const small=data.filter(row=>row.x<=.2+1e-12);
    const values=amplifierValues(p);
    if(small.length>=3)values.fitGain=lineFit(small,row=>row.x,row=>row.out).slope;
    return values;
  }

  const isCharacteristic=analysis=>['diodeIV','mosOutput','mosTransfer'].includes(analysis);
  const characteristic=analysis=>({
    diodeIV:{xLabel:'Tensione sul diodo Vᴅ',status:'Caratteristica diretta · fit semilogaritmico'},
    mosOutput:{xLabel:'Tensione drain-source Vᴅₛ',status:'Scansione di drain · Vɢₛ fisso'},
    mosTransfer:{xLabel:'Tensione gate-source Vɢₛ',status:'Scansione di gate · Vᴅₛ fisso'}
  })[analysis];

  function columns(p,analysis){
    if(analysis==='mosOutput'||analysis==='mosTransfer')return [['x',analysis==='mosOutput'?'VDS_V':'VGS_V'],['out','ID_A'],['source','V_generatore_V']];
    return analysis==='diodeIV'?[['x','VD_V'],['out','ID_A'],['source','V_generatore_V'],['linear','ID_fit_A'],['residual','residuo_A']]
      :[['x','tempo_s'],['vin',twoInputs(p)?'IN1_V':'IN_V'],...(twoInputs(p)?[['vin2','IN2_V']]:[]),['out','OUT_V'],['current','ID_A']];
  }

  function csv(p,analysis,data){
    const cols=columns(p,analysis);
    return '\uFEFF'+cols.map(([,label])=>label).join(',')+'\r\n'+data.map(row=>cols.map(([key])=>Number.isFinite(row[key])?row[key].toExponential(12):'').join(',')).join('\r\n');
  }

  function truthCsv(p,rows){
    const two=twoInputs(p);
    return '\uFEFF'+(two?'IN1,IN2,VIN1_V,VIN2_V':'IN,VIN_V')+',OUT,VOUT_V,ID_M1_A\r\n'+rows.map(row=>
      (two?[row.a,row.b,row.vin,row.vin2]:[row.a,row.vin]).concat(row.level,row.out,row.current).join(',')
    ).join('\r\n');
  }

  return {CATALOG,TYPES,PRESETS,is,logic,twoInputs,defaults,inherit,normalizeTime,fields,validate,network,applyPreset,presetHint,componentHint,analysisOptions,simulate,analyze,amplifierValues,vtcValues,metrics,summary,isCharacteristic,characteristic,csv,truthCsv};
});
