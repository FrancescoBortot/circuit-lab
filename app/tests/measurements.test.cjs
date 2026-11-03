const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../measurements.js');
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('weighted mean and RMS follow time, not the number of samples',()=>{
 const data=[{x:0,y:0},{x:.01,y:.01},{x:.02,y:.02},{x:1,y:1}],s=M.stats(data,'y');
 near(s.mean,.5);near(s.rms,1/Math.sqrt(3));near(s.pp,1);near(s.coverage,1);
});
test('clipped intervals interpolate the boundaries and accept reversed cursors',()=>{
 const data=[{x:0,y:0},{x:1,y:1}],s=M.stats(data,'y',.8,.2);
 near(s.mean,.5);near(s.min,.2);near(s.max,.8);near(s.rms,Math.sqrt(.28));
 assert.equal(M.stats(data,'y',.5,.5),null);
});
test('one-sided event samples have zero integration weight at a jump',()=>{
 const data=[{x:0,y:0},{x:1,y:0},{x:1,y:2},{x:2,y:2}],s=M.stats(data,'y');
 near(s.mean,1);near(s.rms,Math.sqrt(2));near(s.pp,2);
 assert.equal(M.nearest(data,1).y,2);
});
test('undefined currents leave a gap and report actual measurement coverage',()=>{
 const s=M.stats([{x:0,y:NaN},{x:1,y:2},{x:2,y:2}],'y');
 near(s.mean,2);near(s.rms,2);near(s.coverage,.5);
});
test('RMS of a resolved sinusoid includes its DC offset',()=>{
 const data=Array.from({length:10001},(_,i)=>({x:i/10000,y:3+2*Math.sin(2*Math.PI*i/10000)})),s=M.stats(data,'y');
 near(s.mean,3);near(s.rms,Math.sqrt(11),1e-7);near(s.pp,4);
});

test('pulse baseline is the last resting sample, with absolute and relative extrema kept distinct',()=>{
 const wave={kind:'pulse',delay:1,period:3},data=[{x:0,out:0},{x:1,out:-2},{x:1,out:-2},{x:1.1,out:-1.5},{x:2,out:-2.2},{x:4,out:-1.9},{x:4,out:-1.9},{x:4.1,out:-1.2}];
 const m=M.pulse(data,'out',wave);near(m.baseline,-2);near(m.maximum,-1.5);near(m.peak,.5);near(m.trough,-.2);assert.equal(m.maxIndex,3);assert.equal(m.baselineIndex,1);const second=M.pulse(data,'out',wave,4.1);near(second.baseline,-1.9);near(second.peak,.7);assert.equal(M.pulse([{x:2,out:1}],'out',wave),null);assert.equal(M.pulse(data,'out',{kind:'sine'}),null);
});
