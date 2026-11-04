const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(){const env={window:{}},handlers={},changes=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../canvas-interaction.js'),'utf8'),env);let active=true,touching=false,begun=0;const target={clientHeight:600,getBoundingClientRect:()=>({left:10,top:20,width:800,height:600}),addEventListener:(t,f)=>handlers[t]=f,removeEventListener:t=>delete handlers[t]};const control=env.window.CanvasInteraction.installZoom(target,{active:()=>active,touching:()=>touching,begin:()=>begun++,zoom:(factor,e)=>changes.push({factor,...e})});return{changes,handlers,control,get begun(){return begun;},activate:v=>active=v,touch:v=>touching=v,send(type,data={}){const e={timeStamp:1000,clientX:400,clientY:300,deltaY:0,preventDefault(){this.defaultPrevented=true;},...data};handlers[type]?.(e);return e;}};}
test('wheel zoom is gentle, reversible and normalized for pixels, lines and pages',()=>{
 const h=harness();h.send('wheel',{deltaY:-100});const f=h.changes[0].factor;assert.ok(f>1&&f<1.09);h.send('wheel',{deltaY:100,timeStamp:1300});assert.ok(Math.abs(f*h.changes[1].factor-1)<1e-12);
 const pixels=harness(),lines=harness();pixels.send('wheel',{deltaY:-48});lines.send('wheel',{deltaY:-3,deltaMode:1});assert.equal(pixels.changes[0].factor,lines.changes[0].factor);
 h.send('wheel',{deltaY:-999,deltaMode:2,timeStamp:1600});assert.ok(h.changes.at(-1).factor<1.09);
});
test('huge wheel bursts have a bounded speed and no deferred zoom tail',()=>{
 const h=harness();for(let i=0;i<1000;i++)h.send('wheel',{deltaY:-10000,timeStamp:1000});assert.ok(h.changes.reduce((v,c)=>v*c.factor,1)<=Math.exp(.080001));
 for(let i=1;i<=100;i++)h.send('wheel',{deltaY:-10000,timeStamp:1000+i*10});assert.ok(h.changes.reduce((v,c)=>v*c.factor,1)<=Math.exp(1.080001));assert.equal(h.begun,1);
});
test('trackpad pinch is accepted only in an active view and stays anchored; browser modifiers are preserved',()=>{
 const h=harness();h.activate(false);assert.ok(!h.send('wheel',{deltaY:-10,ctrlKey:true}).defaultPrevented);assert.equal(h.changes.length,0);h.activate(true);assert.equal(h.send('wheel',{deltaY:-2,ctrlKey:true}).defaultPrevented,true);assert.ok(h.changes[0].factor>1);assert.equal(h.changes[0].clientX,400);assert.equal(h.changes[0].clientY,300);
 for(const k of ['metaKey','altKey'])assert.ok(!h.send('wheel',{deltaY:-100,[k]:true,timeStamp:1400}).defaultPrevented);assert.equal(h.changes.length,1);h.control.destroy();assert.equal(Object.keys(h.handlers).length,0);
});
test('Safari pinch uses incremental scale, avoids duplicate wheel zoom and respects touch ownership',()=>{
 const h=harness();assert.equal(h.send('gesturestart',{scale:1}).defaultPrevented,true);h.send('gesturechange',{scale:1.1,timeStamp:1016});assert.ok(Math.abs(h.changes[0].factor-1.1**.7)<1e-12);h.send('wheel',{deltaY:-100,ctrlKey:true,timeStamp:1020});assert.equal(h.changes.length,1);h.send('gestureend');
 h.touch(true);h.send('gesturestart',{scale:1,timeStamp:1500});h.send('gesturechange',{scale:2,timeStamp:1600});assert.equal(h.changes.length,1);h.send('gestureend');h.activate(false);assert.ok(!h.send('gesturestart').defaultPrevented);
});
test('invalid zoom deltas do not corrupt the next gesture',()=>{
 const h=harness();h.send('wheel',{deltaY:NaN});h.send('wheel',{deltaY:Infinity});h.send('gesturestart',{scale:1});h.send('gesturechange',{scale:0});h.send('gesturechange',{scale:NaN});assert.equal(h.changes.length,0);h.send('gesturechange',{scale:1.05,timeStamp:1200});assert.ok(Number.isFinite(h.changes[0].factor));
});
test('a lost WebKit gesture end cannot leave wheel zoom stuck after leaving and returning to a view',()=>{
 const h=harness();h.send('gesturestart',{scale:1,timeStamp:1000});h.send('gesturechange',{scale:1.05,timeStamp:1016});h.activate(false);h.activate(true);h.send('wheel',{deltaY:-20,timeStamp:1500});assert.equal(h.changes.length,2);assert.ok(h.changes[1].factor>1);
});
