// Actual breadboard and activation controllers; native multi-touch is emulated here.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const bootstrap=fs.readFileSync(path.join(__dirname,'workflow.cjs'),'utf8').split('(async()=>{await flush();assert.ok(env.StudentUI)')[0];
const {env,document,click,flush,waitFor}=new Function('require','__dirname',bootstrap+'\nreturn {env,document,click,flush,waitFor};')(require,__dirname);
function send(el,type,values={}){const e=new env.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:200,clientY:200,pointerType:'touch',...values});el.dispatchEvent(e);return e;}
(async()=>{
 await waitFor(()=>env.GuidedLab.plotSnapshot());click('#appLayout [data-bb-mode="breadboard"]');await flush();
 const viewport=document.querySelector('.bb-schema-viewport'),svg=viewport.querySelector('svg');assert.ok(svg);
 viewport.scrollLeft=500;viewport.scrollTop=300;
 const before=JSON.stringify(env.BreadboardWorkbench.snapshot().doc),width=parseFloat(svg.style.width);
 assert.equal(send(viewport,'wheel',{deltaY:-30}).defaultPrevented,false);
 send(viewport,'pointerdown');send(viewport,'pointerup');assert.equal(viewport.style.touchAction,'none');
 const part=[...svg.querySelectorAll('g[role="button"]')].find(el=>el.textContent.includes('R1')&&el.textContent.includes('100'));assert.ok(part);send(part,'pointerdown');send(viewport,'pointerup');assert.equal(env.BreadboardWorkbench.selectedPart(),'R1');assert.equal(send(viewport,'click',{detail:1}).defaultPrevented,true);
 env.BreadboardWorkbench.selectPart('C1');
 send(viewport,'pointerdown',{clientX:300});send(viewport,'pointerdown',{pointerId:2,clientX:500});
 send(viewport,'pointermove',{clientX:200,clientY:220});send(viewport,'pointermove',{pointerId:2,clientX:600,clientY:220});
 assert.equal(parseFloat(svg.style.width),width*2);assert.ok(Math.abs(viewport.scrollLeft-1400)<1e-9);assert.ok(Math.abs(viewport.scrollTop-780)<1e-9);
 send(viewport,'pointerup',{pointerId:2});send(viewport,'pointermove',{clientX:230,clientY:240});assert.ok(Math.abs(viewport.scrollLeft-1370)<1e-9);send(viewport,'pointerup');
 send(viewport.querySelector('g[role="button"]'),'click');assert.equal(env.BreadboardWorkbench.selectedPart(),'C1');
 assert.equal(JSON.stringify(env.BreadboardWorkbench.snapshot().doc),before);
 assert.equal(send(viewport,'wheel',{deltaY:-10,ctrlKey:true}).defaultPrevented,true);const zoomed=svg.style.width;
 assert.equal(send(viewport,'wheel',{deltaY:-10,metaKey:true}).defaultPrevented,false);assert.equal(svg.style.width,zoomed);
 send(viewport,'pointerdown');send(viewport,'pointerdown',{pointerId:2});send(viewport,'pointercancel');const stopped=svg.style.width;send(viewport,'pointermove',{clientX:800});assert.equal(svg.style.width,stopped);
 send(viewport,'keydown',{key:'Escape'});assert.equal(viewport.style.touchAction,'pan-y');assert.equal(send(viewport,'wheel',{deltaY:-30,ctrlKey:true}).defaultPrevented,false);
 send(viewport,'keydown',{key:'Enter'});assert.equal(viewport.style.touchAction,'none');send(document.getElementById('projectName'),'pointerdown');assert.equal(viewport.style.touchAction,'pan-y');
 console.log('PASS breadboard activation, anchored pinch/pan, one-finger continuation, selection, modifiers, cancellation and unchanged circuit');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
