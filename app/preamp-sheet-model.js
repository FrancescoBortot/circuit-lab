/* Third laboratory day, sheet 1.1–1.3. SI inputs; high-state duty in percent. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PreampSheetModel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function calculate({vin,frequency,duty,width,mode='duty',rin,rf,cf,offset=0}){
  for(const [name,n]of Object.entries({vin,frequency,rin,rf,cf}))if(!Number.isFinite(n)||n<=0)throw Error(name+': inserisci un valore positivo.');
  if(!Number.isFinite(offset)||Math.abs(offset)>1000||Math.abs(offset-vin)>1000)throw Error('Offset e livello dell’impulso devono essere tra −1000 e 1000 V.');
  if(frequency>500)throw Error('Scheda 1.3: frequenza non superiore a 500 Hz.');
  const period=1/frequency;
  if(mode==='duty'){if(!Number.isFinite(duty)||duty<=0||duty>99.9)throw Error('Duty high: scegli un valore maggiore di 0 e non oltre 99,9%.');if(Math.abs(duty*10-Math.round(duty*10))>1e-7)throw Error('Il duty high varia a passi di 0,1%. Per durate intermedie usa Width.');width=period*(1-duty/100);}
  else if(mode!=='width')throw Error('Scegli duty high oppure durata diretta.');
  if(!Number.isFinite(width)||width<2e-6-1e-15||width>10e-6+1e-15)throw Error('Scheda 1.3: durata negativa tra 2 e 10 µs.');
  const highDuty=100*(1-width/period);if(highDuty>99.9+1e-10)throw Error('Il limite high 99,9% non permette questa durata alla frequenza scelta. Aumenta la frequenza, fino a 500 Hz.');
  const tau=rf*cf,charge=vin*width/rin,ideal=charge/cf,finite=vin*rf/rin*(-Math.expm1(-width/tau));
  return{offset,baseline:-offset*rf/rin,maximum:-offset*rf/rin+finite,period,width,highDuty,charge,tau,ideal,finite,slope:1/cf,recovery:Math.exp(-(period-width)/tau),shortPulseError:1-finite/ideal};
 }
 function plan(input,count=9){if(![8,9].includes(count))throw Error('La scheda richiede 8 o 9 misure.');return Array.from({length:count},(_,i)=>{const width=2e-6+i*8e-6/(count-1),duty=100*(1-width*input.frequency);try{return{width,duty,...calculate({...input,mode:'width',width}),available:true};}catch(error){return{width,duty,available:false,reason:error.message};}});}
 // Laboratory settings, distinct from the uniform-width numerical scan.
 function measurementPlan(input,count=9,axis='frequency'){
  if(![8,9].includes(count))throw Error('La scheda richiede 8 o 9 misure.');
  if(!['frequency','duty','width'].includes(axis))throw Error('Scegli frequenza, duty high o width.');
  calculate({...input,frequency:500,mode:'width',width:2e-6});
  let settings=[];const warnings=[];
  if(axis==='frequency'){
   const duty=input.duty;
   if(!Number.isFinite(duty)||duty<=0||duty>99.9||Math.abs(duty*10-Math.round(duty*10))>1e-7)throw Error('Duty high fisso: usa passi di 0,1%, fino a 99,9%.');
   const fraction=1-duty/100,min=Math.ceil(fraction/10e-6-1e-9),max=Math.floor(Math.min(500,fraction/2e-6)+1e-9);
   if(max<min)throw Error('Questo duty non permette durate 2–10 µs entro 500 Hz. Usa 99,9% high.');
   const n=Math.min(count,max-min+1);
   settings=Array.from({length:n},(_,i)=>({frequency:n===1?min:Math.round(min+i*(max-min)/(n-1)),duty,mode:'duty'}));
  }else{
   const frequency=input.frequency;
   if(!Number.isFinite(frequency)||frequency<=0||frequency>500)throw Error('Frequenza fissa: scegli un valore positivo, al massimo 500 Hz.');
   if(axis==='width')settings=Array.from({length:count},(_,i)=>({frequency,width:Math.round((2+i*8/(count-1))*10)/10*1e-6,mode:'width'}));
   else{
    for(let tick=999;tick>0;tick--){const duty=tick/10,width=(1-duty/100)/frequency;if(width>=2e-6-1e-15&&width<=10e-6+1e-15)settings.push({frequency,duty,mode:'duty'});}
    if(!settings.length)throw Error('Nessun duty a passi di 0,1% permette 2–10 µs a questa frequenza. Aumenta la frequenza fino a 500 Hz.');
    if(settings.length>count)settings=Array.from({length:count},(_,i)=>settings[Math.round(i*(settings.length-1)/(count-1))]);
   }
  }
  const rows=settings.map((setting,i)=>{
   const width=setting.mode==='width'?setting.width:(1-setting.duty/100)/setting.frequency,duty=setting.mode==='duty'?setting.duty:100*(1-width*setting.frequency);
   try{return{number:i+1,frequency:setting.frequency,duty,width,...calculate({...input,...setting}),available:true};}
   catch(error){return{number:i+1,frequency:setting.frequency,duty,width,available:false,reason:error.message};}
  });
  if(rows.length<count)warnings.push(`Solo ${rows.length} impostazioni distinte realizzabili; ne servono ${count}. Con duty a passi di 0,1% si ottengono al massimo 5 durate tra 2 e 10 µs entro 500 Hz. Per 8–9 misure scegli Frequenza oppure Width.`);
  if(rows.some(row=>!row.available))warnings.push('Alcune durate non sono realizzabili con il limite 99,9% high: scegli 500 Hz oppure varia la frequenza.');
  const available=rows.filter(row=>row.available),spansRange=available.length&&Math.min(...available.map(row=>row.width))<=2e-6+1e-15&&Math.max(...available.map(row=>row.width))>=10e-6-1e-15;
  if(available.length===count&&!spansRange)warnings.push('Il piano non copre tutto l’intervallo 2–10 µs. Per coprirlo scegli duty fisso 99,9% variando la frequenza, oppure Width a 500 Hz.');
  if(available.some(row=>row.period-row.width<10*row.tau))warnings.push('In alcune righe il riposo è inferiore a 10 τ: controlla il recupero della baseline.');
  return{axis,requested:count,rows,warnings,complete:rows.length===count&&rows.every(row=>row.available)&&Boolean(spansRange)};
 }
 function measurementCSV(plan,input){
  const headers=['misura','frequenza_Hz','duty_high_percent','T_low_us','Qin_nominale_pC','picco_meno_baseline_previsto_V','Vin_misurato_V','picco_meno_baseline_misurato_V','Vin_riferimento_V','offset_V','Rin_ohm','Rf_ohm','Cf_pF','stato','baseline_nominale_V','Vmax_nominale_V','baseline_misurata_V','Vmax_assoluto_misurato_V','u_picco_meno_baseline_V'];
  const rows=plan.rows.map(r=>[r.number,r.frequency,r.duty,r.width*1e6,r.available?r.charge*1e12:'',r.available?r.finite:'','','',input.vin,input.offset??0,input.rin,input.rf,input.cf*1e12,r.available?'Realizzabile':r.reason,r.available?r.baseline:'',r.available?r.maximum:'','','','']);
  const cell=value=>{const text=String(value??'');return /[;"\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
  return [headers,...rows].map(row=>row.map(cell).join(';')).join('\n');
 }
 return{calculate,plan,measurementPlan,measurementCSV};
});
