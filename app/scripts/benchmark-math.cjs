/* Closed-form reference equations, separate from MNA assembly/integration. */
const fs=require('node:fs'),path=require('node:path');
const M=require('../free-model.js');
function run(){
  const cases=[],record=(name,actual,expected,tolerance,unit)=>{
    const error=Math.max(...actual.map((p,i)=>Math.abs(p-expected[i])));
    cases.push({name,reference:'independent closed-form equation',samples:actual.length,maxAbsoluteError:error,tolerance,unit,pass:error<=tolerance});
  };
  const rc=M.example('rc');Object.assign(rc.settings,{duration:.006,samples:400,integration:'adaptive',rtol:1e-7});
  for(const tau of [1e-6,.001]){
    rc.components.find(c=>c.type==='C').value=tau/1e4;
    const r=M.simulate(rc);record('RC step · tau='+tau,r.data.map(p=>p.out),r.data.map(p=>5*(-Math.expm1(-p.x/tau))),2e-5,'V');
  }
  const rl=M.clone(rc);Object.assign(rl.components.find(c=>c.type==='C'),{type:'L',value:1});rl.components.find(c=>c.type==='R').value=1000;
  const r=M.simulate(rl);record('RL step',r.data.map(p=>p.out),r.data.map(p=>5*Math.exp(-p.x/.001)),2e-5,'V');
  const rlc=M.clone(rc);rlc.components.find(c=>c.type==='R').value=100;rlc.components.find(c=>c.type==='C').value=1e-6;rlc.components.push(Object.assign(M.component('L','L1'),{value:.01}));rlc.wires.find(w=>w.a==='R1:b').a='L1:b';rlc.wires.push({id:'WL',a:'R1:b',b:'L1:a'});rlc.settings.duration=.002;
  const a=5000,w=Math.sqrt(1e8-a*a),z=M.simulate(rlc);record('RLC underdamped step',z.data.map(p=>p.out),z.data.map(p=>5*(1-Math.exp(-a*p.x)*(Math.cos(w*p.x)+a/w*Math.sin(w*p.x)))),2e-4,'V');
  const inv=M.example('inverting',{opamp:'ideal'}),q=M.simulate(inv);record('Ideal inverting amplifier',q.data.map(p=>p.out),q.data.map(p=>-4.7*.5*Math.sin(2*Math.PI*1000*p.x)),1e-9,'V');
  const amp=M.example('inverting'),b=M.bode(amp),k=4.7,A0=200000,gbw=4e6;
  const expected=b.data.map(p=>{const real=1+(1+k)/A0,imag=p.x*(1+k)/gbw,den=real*real+imag*imag;return{real:-k*real/den,imag:k*imag/den};});
  record('Finite A0 and GBW · real',b.data.map(p=>p.real),expected.map(p=>p.real),1e-8,'V/V');record('Finite A0 and GBW · imaginary',b.data.map(p=>p.imag),expected.map(p=>p.imag),1e-8,'V/V');
  const report={referenceType:'mathematical, not an external SPICE run',method:'SDIRK2 fixed/adaptive as declared in each document',cases,pass:cases.every(c=>c.pass)};
  const destination=path.join(__dirname,'../benchmark/mathematical-results.json');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module){const report=run();for(const c of report.cases)console.log(`${c.pass?'PASS':'FAIL'} ${c.name}: ${c.maxAbsoluteError} ${c.unit} (limit ${c.tolerance})`);if(!report.pass)process.exitCode=1;}
module.exports={run};
