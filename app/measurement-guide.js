/* The suggested probe connections refer to circuit terminals, never fixed breadboard coordinates. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./breadboard-model'),require('./breadboard-render'));
 else root.MeasurementGuide=factory(root.BreadboardModel,root.BreadboardRender);
})(globalThis,function(B,R){
 'use strict';
 const point=(ref,label,role)=>({ref,label,role});
 const voltage=(id,title,red,redLabel,black='V1:n',blackLabel='GND',detail='')=>({
  id,title,mode:'Multimetro · V DC',units:'V',detail,
  points:[point(red,redLabel,'Rosso'),point(black,blackLabel,'COM')]
 });
 const current=(id,title,red,redLabel,black,blackLabel,detail)=>({
  id,title,mode:'Multimetro · A DC · in serie',units:'A',detail,
  points:[point(red,redLabel,'Rosso'),point(black,blackLabel,'COM')],series:true
 });
 const scope=(id,title,one,two,detail,labels=['IN','OUT'])=>({
  id,title,mode:'Oscilloscopio',detail,points:[point(one,labels[0],'CH1'),point(two,labels[1],'CH2'),point('V1:n','GND comune','Masse')]
 });
 const component=(part,parameter,unit)=>({
  id:'value-'+part,title:'Misura '+part,mode:'Multimetro · '+(unit==='Ω'?'resistenza':'capacità'),units:unit,parameter,
  detail:'Misura il componente prima di montarlo. Se è già montato, spegni l’alimentazione e scollega almeno un terminale.'+(unit==='F'?' Scarica il condensatore prima della misura.':''),
  points:[point(part+':a',part+' · terminale 1','Rosso'),point(part+':b',part+' · terminale 2','COM')]
 });
 const voltGround=(id,title,ref,label,detail='')=>voltage(id,title,ref,label,'V1:n','GND',detail);
 const simpleScope=(input='R1:a',output='U1:out')=>scope('waveforms','Visualizza ingresso e uscita',input,output,'Collega le clip di massa a GND.');
 const logicScope=(out)=>scope('logic-levels','Leggi i livelli logici','M1:g',out,'Usa la quadra 0–5 V. Leggi i livelli nei tratti stabili con l’oscilloscopio.');
 const modeCommon=(id,title,text,points)=>({id,title,mode:'Generatore e oscilloscopio',detail:text,points});
 const shaper=(type)=>[
  scope('shaper-steps',type==='shaper-buffer'?'Misura sullo shaper con o senza buffer':'Misura il gradino dello shaper','V1:p','@out',
   type==='shaper-buffer'?'CH2 segue OUT. Con il buffer collegalo a Uout. Senza buffer collegalo al nodo di Csh2.':'Leggi il massimo, il tempo al picco e il ritorno verso la baseline.')
 ];
 const chain=()=>[
  scope('preamp-shaper','Segui PRE → SHAPER','Upre:out','Csh2:a','CH1 legge l’uscita del preamplificatore, che entra nello shaper. CH2 legge il picco, l’undershoot e la tensione a 10 tempi di shaping.', ['PRE','SHAPER'])
 ];
 const compensate=()=>({
  id:'rpz',title:'Collega la compensazione Rpz',mode:'Montaggio · a tensioni spente',
  detail:'Collega Rpz in parallelo a Csh1, fra le due file evidenziate.',
  points:[point('Csh1:a','Csh1 · lato PRE','1'),point('Csh1:b','Csh1 · lato shaper','2')]
 });
 const bias=()=>voltGround('bias','Verifica il riferimento di bias','Vbias:p','Vbias','Misura il riferimento in continua prima della resistenza di bias.');
 const differential=[
  modeCommon('gain-a1','Misura A₁ · V₂ a massa','Porta V₂ a GND. Collega il generatore a V₁ e osserva V₁ e OUT.',
   [point('R1:a','V₁','AFG / CH1'),point('R3:a','V₂','A GND'),point('U1:out','OUT','CH2'),point('V1:n','GND','Masse')]),
  modeCommon('gain-a2','Misura A₂ · V₁ a massa','Porta V₁ a GND. Collega il generatore a V₂ e osserva V₂ e OUT.',
   [point('R1:a','V₁','A GND'),point('R3:a','V₂','AFG / CH1'),point('U1:out','OUT','CH2'),point('V1:n','GND','Masse')]),
  modeCommon('common','Misura il modo comune','Sdoppia l’uscita dello stesso generatore verso V₁ e V₂. CH1 legge il segnale comune, CH2 legge OUT.',
   [point('R1:a','V₁','AFG / CH1'),point('R3:a','V₂','Stesso AFG'),point('U1:out','OUT','CH2'),point('V1:n','GND','Masse')])
 ];
 const gates=(out)=>[
  scope('logic-inputs','Osserva i due ingressi','M1:g','M3:g','Tieni il trigger su CH1 (IN1) e individua gli intervalli corrispondenti ai quattro stati.',['IN1','IN2']),
  scope('logic-output','Sposta CH2 da IN2 a OUT','M1:g',out,'Lascia CH1 e il trigger su IN1. Sposta soltanto la punta di CH2 da IN2 a OUT.',['IN1','OUT'])
 ];
 const cmosGate=(out)=>[
  voltGround('supply','Controlla l’alimentazione del CD4007UB','VDD:p','VDD · pin 14','Verifica +5 V fra pin 14 e pin 7.'),
  voltGround('input-a','Verifica l’ingresso A','M1:g','A · pin 6'),
  voltGround('input-b','Verifica l’ingresso B','M3:g','B · pin 3'),
  voltGround('truth','Misura Y per 00, 01, 10 e 11',out,'Y','Usa il multimetro. Collega COM a GND e registra Y per ogni coppia di livelli A/B.')
 ];
 const plans={
  'cmos-nor':()=>cmosGate('M1:d'),
  'cmos-nand':()=>cmosGate('M3:d'),
  'precision-rectifier':()=>[
   scope('main','Raddrizzamento · V₁ e OUT','R1a:a','U1:out','Sonde ×10. Usa 10 Vpp e 1 kHz e leggi i valori al centro di ciascuna semionda.',['V₁','OUT · U1']),
   scope('node-v2','Misura il nodo V₂','R1a:a','R2:a','Mantieni CH1 e il trigger su V₁. Sposta CH2 su V₂.',['V₁','V₂']),
   scope('aux','Misura l’uscita Vₒ′ di U2','R1a:a','U2:out','Sposta CH2 su U2 e confronta Vₒ′ con V₂ nelle due semionde.',['V₁','Vₒ′ · U2'])
  ],
  'bridge-rectifier':()=>[
   component('R1','R1','Ω'),
   scope('bridge-ab','Misura A e B e calcola CH2 − CH1','R1:a','R1:b','Collega entrambe le masse al ritorno del generatore. Usa CH2 − CH1 per Vᴮ − Vᴬ ai capi del carico flottante.',['A','B'])
  ],
  'common-source':p=>[
   ...['RD','RS','R1','R2'].map(id=>component(id,id,'Ω')),
   voltGround('bias-vdd','Punto di lavoro · Vᴅᴅ','VDD:p','VDD','Porta il segnale a zero e misura la tensione di alimentazione.'),
   voltGround('bias-g','Punto di lavoro · Vɢ','M3:g','Gate · pin 3','Lascia COM a massa.'),
   voltGround('bias-d','Punto di lavoro · Vᴅ','M3:d','Drain · pin 5','Ricava Iᴅ = (Vᴅᴅ − Vᴅ)/Rᴅ.'),
   voltGround('bias-s','Punto di lavoro · Vₛ','M3:s','Source · pin 4','Ricava Vɢₛ = Vɢ − Vₛ, Vᴅₛ = Vᴅ − Vₛ e verifica Iᴅ con Vₛ/Rₛ.'),
   scope('gain','Misura guadagno e inversione',p.inputResistor?'Ri:a':'C1:a','C2:b','Usa 100–200 mVpp a circa 10 kHz. Collega CH2 dopo C₂ e confronta fase e Vpp.'),
   ...(p.inputResistor?[scope('rin','Misura a monte e a valle di Rᵢ','Ri:a','C1:a','Usa sonde ×10 e la stessa impostazione del generatore. Dopo la misura rimuovi Rᵢ.',['Prima di Rᵢ','Dopo Rᵢ'])]:[]),
   ...(p.externalLoad?[scope('rout','Ripeti la misura di OUT con Rᴸ','C1:a','C2:b','Confronta OUT con la lettura senza carico mantenendo lo stesso ingresso. Dopo la misura rimuovi Rᴸ.')]:[])
  ],
  rc:()=>[
   component('R1','R','Ω'),component('C1','C','F'),
   scope('direct','Scarica con cavi diretti','R1:a','C1:a','Collega CH1 direttamente a IN e CH2 a OUT. Misura il tempo di discesa a 1/e.'),
   scope('probe','Scarica con sonde ×10','R1:a','C1:a','Collega le sonde ×10 agli stessi nodi e confronta il tempo di scarica.')
  ],
  inverting:()=>[component('R1','R1','Ω'),component('Rf','Rf','Ω'),simpleScope()],
  derivative:()=>[component('C1','C1','F'),simpleScope()],
  difference:()=>[component('R3','R3','Ω'),component('R4','R4','Ω'),...differential],
  preamp:()=>[
   component('Rin','Rin','Ω'),component('Rfpre','Rfpre','Ω'),component('Cfpre','Cfpre','F'),
   scope('pulse','Misura l’impulso sul preamplificatore','Rin:a','Upre:out','Leggi con CH1 l’ampiezza effettiva in ingresso. Con CH2 misura il picco rispetto alla baseline.',['IN del preamplificatore','PRE'])
  ],
  shaper:()=>[component('Rsh1','Rsh1','Ω'),component('Csh1','Csh1','F'),component('Rsh2','Rsh2','Ω'),component('Csh2','Csh2','F'),...shaper('shaper')],
  'shaper-buffer':()=>shaper('shaper-buffer'),
  'preamp-shaper':()=>chain(),
  'pz-shaper':()=>[compensate(),...chain()],
  noninverting:p=>[simpleScope('V1:p','Ufinal:out'),...(p.biasEnabled?[bias()]:[])],
  'detector-chain':p=>[...(p.pzEnabled?[compensate()]:[]),...chain(),
   scope('shaper-out','Segui SHAPER → OUT','Csh2:a','Ufinal:out','Confronta il picco dello shaper e quello in uscita dallo stadio finale rispetto alle rispettive baseline.',['SHAPER','OUT']),
   ...(p.biasEnabled?[bias()]:[])],
  'diode-iv':()=>[
   voltage('diode-v','Tensione ai capi del diodo Vᴅ','D1:a','Anodo','D1:b','Catodo','Collega il voltmetro in parallelo al diodo.'),
   current('diode-i','Corrente nella maglia Iᴅ','V1:p','Lato + alimentatore','R1:a','Lato R₁',
    'A tensione spenta, interrompi il ramo tra il + dell’alimentatore e R₁. Con il voltmetro sul diodo, qui l’amperometro legge anche la corrente assorbita dal voltmetro.')
  ],
  'half-wave':()=>[
   voltGround('mean-in','Tensione media in ingresso','D1:a','IN'),voltGround('mean-out','Tensione media in uscita','D1:b','OUT'),
   simpleScope('D1:a','D1:b')
  ],
  'half-wave-rc':()=>[
   voltGround('mean-out','Componente continua dopo il filtro','D1:b','OUT'),
   scope('ripple','Misura il ripple','D1:a','D1:b','CH2 legge il ripple ai capi del condensatore. Usa la stessa posizione anche con Rᴸ e quando passi a 1 kHz.')
  ],
  'mos-iv':()=>[
   voltage('vds','Tensione drain–source Vᴅₛ','M1:d','Drain · pin 8','M1:s','Source · pin 7'),
   current('id','Corrente di drain Iᴅ','VDD:p','Lato + dell’alimentatore di drain','M1:d','Lato drain · pin 8',
    'A tensione spenta, apri il ramo di alimentazione del drain. Se il voltmetro resta sul drain, la lettura include anche la sua corrente.'),
   voltage('gate-before','Tensione a monte di R₁','RG:a','R₁ · lato generatore','M1:s','Source · pin 7','Annota anche la corrente di drain a questa posizione.'),
   voltage('gate-after','Tensione gate–source Vɢₛ','M1:g','Gate · pin 6','M1:s','Source · pin 7','Sposta solo il rosso a valle di R₁. Il voltmetro da 10 MΩ carica il gate. Confronta anche Iᴅ.')
  ],
  'mos-amplifier':()=>[
   voltage('q-gate','Punto di lavoro · Vɢₛ','M1:g','Gate · pin 6','M1:s','Source · pin 7','Controlla la polarizzazione prima di attivare la sinusoide.'),
   voltGround('q-supply','Punto di lavoro · Vᴅᴅ','RD:a','Vᴅᴅ · sopra Rᴅ','Misura Vᴅᴅ e la tensione al drain. Ricava Iᴅ = (Vᴅᴅ − Vᴅ) / Rᴅ.'),
   voltage('q-drain','Punto di lavoro · Vᴅₛ','M1:d','Drain · pin 8 · prima di C₂','M1:s','Source · pin 7','Ricava Iᴅ da (Vᴅᴅ − Vᴅ) / Rᴅ usando le letture in continua.'),
   scope('amp-out','Misura le ampiezze picco-picco','C1:a','C2:b','CH2 va dopo C₂. Parti con 100 mVpp a 3 kHz.')
  ],
  'nmos-inverter':()=>[logicScope('M1:d')],
  'cmos-inverter':()=>[logicScope('M1:d')],
  'nmos-nor':()=>gates('M1:d'),
  'nmos-nand':()=>gates('M3:d')
 };
 function forCircuit(params){return plans[params.type]?.(params)||[];}
 function boardPoints(model,step){
  if(!model||model.empty)return null;
  const geometry=R.geometry(model),occupied=new Set(model.occupied);
  const strip=hole=>model.groups.find(group=>group.includes(hole));
  const probe=hole=>strip(hole)?.find(candidate=>!occupied.has(candidate))||null;
  const resolve=ref=>ref==='@out'?model.doc.probes.output:ref;
  if(step.series){
   const [from,to]=step.points.map(p=>resolve(p.ref));
   const terminals=B.terminalList(model);
   const end=ref=>terminals.find(t=>t.ref===ref||t.schematicRef===ref);
   const a=end(from),b=end(to);
   if(!a||!b)return null;
   const trace=B.trace(model,a.ref,b.ref);
   const insertion=trace?.segments.find(segment=>segment.kind==='wire');
   const cables=model.connections||R.connections(model);
   const cable=insertion?cables.find(c=>c.kind==='wire'&&c.id===insertion.id):cables.find(c=>c.kind==='contact'&&c.id===from);
   if(!cable)return null;
   const [red,com]=insertion?[insertion.a,insertion.b].map(hole=>({hole,point:geometry.point(hole)})):
    [{label:'Capo del cavo dal + alimentatore',point:cable.a.point},{hole:cable.b.hole,point:cable.b.point}];
   const detail=insertion?'Rimuovi il ponticello fra '+red.hole+' e '+com.hole+'.':
    'Scollega il cavo dal foro '+com.hole+'. Collega il suo capo libero al rosso e il COM al foro indicato.';
   return {points:[{...step.points[0],...red},{...step.points[1],...com}],cable,detail};
  }
  return {points:step.points.map(p=>{
   const ref=resolve(p.ref),hole=model.pinHoles[ref];
   if(!hole)return p;
   const available=step.parameter?hole:probe(hole),target=available||hole;
   return {...p,hole:target,point:geometry.point(target),sameStrip:!available};
  })};
 }
 return {forCircuit,boardPoints};
});
