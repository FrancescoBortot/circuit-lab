const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../student-tools'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('readings preserve exact sample indices at discontinuities and respect the visible signal and units',()=>{const c={data:[{x:0,out:0,vin:1},{x:1,out:5,vin:2},{x:1,out:0,vin:3}],series:[{key:'out',label:'OUT'}],yUnit:'V',xUnit:'s'},before=JSON.stringify(c),rows=T.readings(c);assert.equal(rows[0].value,5);assert.equal(rows[0].index,1);assert.equal(rows[2].value,1);assert.equal(JSON.stringify(c),before);c.series=[{key:'vin',label:'IN'},{key:'out',label:'OUT',visible:false}];assert.equal(T.readings(c)[0].value,3);const scope={window:{LabModel:require('../lab-model')}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../plot.js'),'utf8'),scope);const plot=Object.create(scope.window.LabPlot.prototype);Object.assign(plot,{data:c.data,toDomain:x=>x,view:[0,1],domain:[0,1],drawCursor(){},syncControls(){}});assert.equal(plot.inspectSample(1),true);assert.equal(plot.cursor.out,5);assert.equal(plot.inspectSample(99),false);});

test('main pulse result cards use the sampled baseline rather than time zero or the global maximum',()=>{
 const config={xUnit:'s',yUnit:'V',pulse:{kind:'pulse',delay:1,period:3},series:[{key:'out',label:'OUT'}],data:[{x:0,out:0},{x:.9,out:-2},{x:1,out:-2},{x:1,out:-2},{x:1.1,out:-1.5},{x:2,out:-2.2}]},rows=T.readings(config);assert.equal(rows[0].label,'Picco − baseline · OUT');assert.equal(rows[0].value,.5);assert.equal(rows[1].value,-2);assert.equal(rows[2].value,-1.5);assert.equal(rows[0].index,4);
});

test('DC-equilibrium baseline stays distinct from an arbitrary initial sinusoidal sample',()=>{const rows=T.readings({data:[{x:0,out:0},{x:1,out:-1.5},{x:2,out:-2.5}],series:[{key:'out',label:'OUT'}],xUnit:'s',yUnit:'V',dcBaseline:{out:-2}});assert.equal(rows[1].value,-2);assert.equal(rows[1].label,'Baseline DC · equilibrio');assert.equal(rows[2].value,2);assert.equal(rows[3].value,-.5);});

test('waveformMetrics extracts rise/fall times, pulse FWHM, periodic frequency and IN-OUT delay',()=>{
 const L=require('../lab-model');
 const shaper=L.defaults('shaper'),shaperData=L.simulate(shaper);
 const shaperMetrics=T.waveformMetrics({xUnit:'s',yUnit:'V',data:shaperData,series:[{key:'vin',label:'IN'},{key:'out',label:'OUT'}]});
 const fwhm=shaperMetrics.find(m=>m.label.includes('FWHM'));
 assert.ok(fwhm&&Math.abs(fwhm.value-2.44639*shaper.Rsh1*shaper.Csh1)<1e-6);
 const inv=L.defaults('inverting'),invData=L.simulate(inv);
 const invMetrics=T.waveformMetrics({xUnit:'s',yUnit:'V',data:invData,wave:inv.wave1,series:[{key:'vin',label:'IN'},{key:'out',label:'OUT'}]});
 const freq=invMetrics.find(m=>m.label.startsWith('Frequenza'));
 const duty=invMetrics.find(m=>m.label.startsWith('Duty cycle'));
 assert.ok(freq&&Math.abs(freq.value-inv.wave1.frequency)<1);
 assert.ok(duty&&Math.abs(duty.value-50)<0.5);
});

test('periodic metrics require regular intervals and preserve ideal discontinuities',()=>{
 const measure=(starts,widths,wave)=>{
  const data=[{x:0,out:0}];
  starts.forEach((x,i)=>{
   const end=x+widths[i];
   data.push({x,out:0},{x,out:1},{x:end,out:1},{x:end,out:0});
  });
  return T.waveformMetrics({data,wave,xUnit:'s',yUnit:'V',series:[{key:'out',label:'OUT'}]});
 };
 const regular=measure([1,6,11],[2,2,2]);
 for(const [label,value] of [['Salita',0],['Discesa',0],['Periodo',5],['Frequenza',.2],['Duty cycle',40]]){
  assert.equal(regular.find(metric=>metric.label.startsWith(label))?.value,value,label);
 }
 const periodic=metrics=>metrics.some(metric=>/^(Periodo|Frequenza|Duty cycle)/.test(metric.label));
 assert.equal(periodic(measure([1,6,12],[2,2,2])),false);
 assert.equal(periodic(measure([1,6,11],[2,3,2])),false);
 assert.equal(periodic(measure([1,6],[2,2])),false);
 assert.equal(periodic(measure([1,6],[2,2],{kind:'square',frequency:.2})),true);
 assert.equal(periodic(measure([1,6,12],[2,2,2],{kind:'square',frequency:.2})),false);
 assert.equal(measure([1],[2]).find(metric=>metric.label.includes('FWHM'))?.value,2);
});

test('LabPlot reference trace freezes current curve, interpolates cursor delta and clears on owner change',()=>{
 const scope={window:{LabModel:require('../lab-model'),LabMeasurements:require('../measurements')}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../plot.js'),'utf8'),scope);
 const plot=Object.create(scope.window.LabPlot.prototype);
 Object.assign(plot,{
  config:{scopeKey:'1:rc',xUnit:'s',yUnit:'V',logX:false,logY:false,series:[{key:'out',label:'OUT'}]},
  data:[{x:0,out:0},{x:1,out:2},{x:2,out:4}],
  series:[{key:'out',label:'OUT'}],
  referenceTrace:null,
  syncControls(){},
  draw(){}
 });
 assert.equal(plot.toggleReference(),true);
 assert.equal(plot.hasActiveReference(),true);
 assert.equal(plot.refAt(0.5),1);
 assert.equal(plot.toggleReference(),false);
 assert.equal(plot.hasActiveReference(),false);
});
