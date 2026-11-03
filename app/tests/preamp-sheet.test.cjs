const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../preamp-sheet-model.js');
const base={vin:1,frequency:200,duty:99.9,rin:1e5,rf:1e6,cf:200e-12};
test('sheet 1.1: negative pulse at 200 Hz and 99.9 percent high lasts 5 us',()=>{const r=S.calculate(base);assert.ok(Math.abs(r.width-5e-6)<1e-15);assert.ok(Math.abs(r.charge-50e-12)<1e-21);assert.ok(Math.abs(r.ideal-.25)<1e-12);assert.ok(Math.abs(r.tau-200e-6)<1e-15);assert.ok(Math.abs(r.finite-.246900879716673)<1e-12);assert.equal(r.slope,5e9);assert.ok(r.recovery<2e-11);});
test('sheet limits and negative-low duty convention are enforced',()=>{for(const update of [{frequency:501},{duty:100},{duty:99.85},{duty:0},{vin:0},{vin:NaN},{rin:0},{mode:'width',width:2e-6}])assert.throws(()=>S.calculate({...base,...update}));const r=S.calculate({...base,frequency:500,mode:'width',width:2e-6});assert.ok(Math.abs(r.highDuty-99.9)<1e-10);});
test('sheet 1.3 provides 8 or 9 points and marks settings impossible on the generator',()=>{assert.ok(S.plan(base).some(r=>!r.available));for(const n of [8,9]){const rows=S.plan({...base,frequency:500},n);assert.equal(rows.length,n);assert.ok(rows.every(r=>r.available));assert.equal(rows[0].width,2e-6);assert.ok(Math.abs(rows.at(-1).width-10e-6)<1e-20);for(const r of rows)assert.ok(Math.abs(r.ideal/r.charge-5e9)<1e-5);}assert.throws(()=>S.plan(base,7));});
test('charge scales with measured amplitude, not repetition frequency at fixed width',()=>{const r=S.calculate({...base,frequency:500,mode:'width',width:5e-6}),s=S.calculate({...base,mode:'width',width:5e-6}),d=S.calculate({...base,vin:2,mode:'width',width:5e-6});assert.equal(r.charge,s.charge);assert.equal(d.charge,2*s.charge);assert.ok(r.recovery>s.recovery);});
test('finite-pulse prediction agrees with the existing ideal circuit solver',()=>{const L=require('../lab-model.js'),p=L.defaults('preamp');Object.assign(p,{opamp:'ideal',autoTime:false,duration:.001,samples:3000,Rin:base.rin,Rfpre:base.rf,Cfpre:base.cf});Object.assign(p.wave1,{kind:'pulse',level:-1,low:0,width:5e-6,period:.005,delay:20e-6,rise:0,fall:0});const data=L.simulate(p),peak=Math.max(...data.map(r=>r.out)),predicted=S.calculate(base).finite;assert.ok(Math.abs(peak-predicted)<1e-5,`${peak} vs ${predicted}`);});

test('sheet includes DC offset in baseline and maximum without changing pulse charge',()=>{
 const a=S.calculate(base),b=S.calculate({...base,vin:.8,offset:.02});assert.equal(b.baseline,-.2);assert.ok(Math.abs(b.charge-.8*a.charge)<1e-24);assert.equal(b.maximum,b.baseline+b.finite);for(const offset of [NaN,Infinity,1001])assert.throws(()=>S.calculate({...base,offset}));assert.throws(()=>S.calculate({...base,offset:-1000}));
});

test('frequency plan gives nine convenient generator frequencies and inverse pulse durations',()=>{
 const input={...base,duty:99.9},before=JSON.stringify(input),p=S.measurementPlan(input,9,'frequency');assert.equal(p.complete,true);assert.ok(p.warnings.every(w=>/10 τ/.test(w)));assert.deepEqual(p.rows.map(r=>r.frequency),[100,150,200,250,300,350,400,450,500]);
 for(const row of p.rows){assert.equal(row.available,true);assert.equal(row.duty,99.9);assert.ok(Math.abs(row.frequency*row.width-.001)<1e-14);assert.ok(Math.abs(row.charge-base.vin*row.width/base.rin)<1e-22);}
 assert.ok(Math.abs(p.rows[0].width-10e-6)<1e-15);assert.ok(Math.abs(p.rows.at(-1).width-2e-6)<1e-15);assert.equal(JSON.stringify(input),before);
});
test('duty plan respects the actual 0.1 percent generator steps without fabricating nine rows',()=>{
 const p=S.measurementPlan({...base,frequency:500},9,'duty');assert.equal(p.complete,false);assert.equal(p.rows.length,5);assert.deepEqual(p.rows.map(r=>r.duty),[99.9,99.8,99.7,99.6,99.5]);assert.ok(p.warnings.some(w=>/Solo 5/.test(w)));
 p.rows.forEach((r,i)=>assert.ok(Math.abs(r.width-(i+1)*2e-6)<1e-15));assert.equal(new Set(p.rows.map(r=>r.duty)).size,5);assert.equal(S.measurementPlan(base,8,'duty').rows.length,2);
});
test('width plan offers whole microseconds for nine measurements and marks unavailable short pulses',()=>{
 for(const count of [8,9]){const p=S.measurementPlan({...base,frequency:500},count,'width');assert.equal(p.complete,true);assert.equal(p.rows.length,count);assert.ok(p.rows.every(r=>r.available));for(const r of p.rows)assert.ok(Math.abs(r.width*1e7-Math.round(r.width*1e7))<1e-7);}
 const p=S.measurementPlan({...base,frequency:500},9,'width');p.rows.forEach((r,i)=>assert.ok(Math.abs(r.width-(i+2)*1e-6)<1e-15));
 const limited=S.measurementPlan(base,9,'width');assert.deepEqual(limited.rows.filter(r=>!r.available).map(r=>r.number),[1,2,3]);assert.equal(limited.complete,false);assert.ok(limited.warnings.some(w=>/99,9%/.test(w)));
});
test('measurement plans reject invalid controls and declare partial ranges and incomplete recovery',()=>{
 for(const [update,count,axis]of [[{},7,'frequency'],[{},9,'invalid'],[{duty:99.85},9,'frequency'],[{duty:NaN},9,'frequency'],[{duty:50},9,'frequency'],[{frequency:0},9,'duty'],[{frequency:501},9,'width'],[{frequency:10},9,'duty']])assert.throws(()=>S.measurementPlan({...base,...update},count,axis));
 const p=S.measurementPlan({...base,duty:99.8},9,'frequency');assert.equal(p.complete,false);assert.ok(p.rows.every(r=>r.available&&r.frequency<=500));assert.match(p.warnings.join(' '),/ne couvre|non copre/);
 const slow=S.measurementPlan({...base,rf:1e9},9,'frequency');assert.match(slow.warnings.join(' '),/10 τ/);
});

test('measurement CSV has matching columns, blank readings, raw maxima and explicit baseline values',()=>{
 const input={...base,offset:.02},plan=S.measurementPlan(input,9,'frequency'),csv=S.measurementCSV(plan,input),rows=require('../rc-analysis').rows(csv,';').rows;assert.equal(rows.length,10);assert.equal(rows[0].length,19);for(const row of rows.slice(1)){assert.equal(row.length,19);for(const index of [6,7,16,17,18])assert.equal(row[index],'');assert.equal(Number(row[14]),-.2);assert.ok(Math.abs(Number(row[15])-Number(row[14])-Number(row[5]))<1e-12);}const bad={rows:[{number:1,frequency:500,duty:99.9,width:2e-6,available:false,reason:'limit; "invalid"\nsetting'}]};assert.equal(require('../rc-analysis').rows(S.measurementCSV(bad,input),';').rows[1][13],bad.rows[0].reason);
});
