// Actual view controllers with wheel/pinch events; device hardware is not emulated.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const bootstrap=fs.readFileSync(path.join(__dirname,'workflow.cjs'),'utf8').split('(async()=>{await flush();assert.ok(env.StudentUI)')[0];
const {env,document,waitFor}=new Function('require','__dirname',bootstrap+'\nreturn {env,document,waitFor};')(require,__dirname);
function send(el,type,values={}){const e=new env.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:300,clientY:180,timeStamp:1000,...values});el.dispatchEvent(e);return e;}
function stage(){const box=document.createElement('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');box.append(svg);document.body.append(box);return svg;}
(async()=>{
 await waitFor(()=>env.GuidedLab.plotSnapshot());
 const guidedSvg=stage(),freeSvg=stage(),plotSvg=stage();plotSvg.id='zoom-test-plot';let commits=0;
 const guided=new env.LabDiagram(guidedSvg,{layout:()=>commits++,select(){}}),free=new env.FreeCanvas(freeSvg,{move:()=>commits++,view(){}}),plot=new env.LabPlot(plotSvg,()=>{});
 const params=env.LabModel.defaults('rc'),doc=env.FreeModel.example('rc'),config=env.GuidedLab.plotSnapshot();guided.render(params);free.render(doc,null,'select',null);plot.set(config);
 const unchanged=JSON.stringify({params,doc,data:plot.data});
 for(const [svg,read]of [[guidedSvg,()=>1/guided.view.k],[freeSvg,()=>free.view.w],[plotSvg,()=>plot.view[1]-plot.view[0]]]){
  const before=read();assert.ok(!send(svg,'wheel',{deltaY:-10000,ctrlKey:true}).defaultPrevented);assert.equal(read(),before);
  send(svg,'keydown',{key:'Enter'});assert.equal(send(svg,'wheel',{deltaY:-10000,ctrlKey:true}).defaultPrevented,true);const changed=read();assert.ok(changed<before&&before/changed<1.09);
  for(let i=0;i<100;i++)send(svg,'wheel',{deltaY:-10000,ctrlKey:true});assert.equal(read(),changed,'same-timestamp event burst cannot cause a mega zoom');
  send(svg,'gesturestart',{scale:1,timeStamp:2000});send(svg,'gesturechange',{scale:1.05,timeStamp:2016});assert.ok(read()<changed,'WebKit pinch reaches the actual view');send(svg,'gestureend',{timeStamp:2020});
  send(svg,'keydown',{key:'Escape'});const inactive=read();assert.ok(!send(svg,'wheel',{deltaY:-10,ctrlKey:true,timeStamp:3000}).defaultPrevented);assert.equal(read(),inactive);
 }
 assert.equal(JSON.stringify({params,doc,data:plot.data}),unchanged);assert.equal(commits,0);
 console.log('PASS gentle bounded wheel, Chromium trackpad pinch, WebKit incremental pinch and activation on guided/free/plot controllers without model changes');
 const time=[{x:0,vin:-1,out:0},{x:1,vin:0,out:.012},{x:2,vin:0,out:0}];
 const series=[{key:'vin',label:'Ingresso',color:'#16804d'},{key:'out',label:'Uscita',color:'#e36c16'}];
 plot.set({data:time,series,xUnit:'s',xLabel:'Tempo',yUnit:'V',scope:true});
 assert.equal(plot.geometry.traceY.get('vin'),plot.geometry.traceY.get('out'));
 plot.splitButton.click();
 assert.equal(plotSvg.querySelector('[data-y-axis="A"]').textContent,'A · V');
 assert.equal(plotSvg.querySelector('[data-y-axis="B"]').textContent,'B · mV');
 plot.inspectSample(1);
 const marker=plotSvg.querySelector('#zoom-test-plot-cursor circle[fill="#e36c16"]');
 assert.equal(Number(marker.getAttribute('cy')),plot.geometry.traceY.get('out')(.012));
 const outAxis=plot.axisControls.querySelector('[data-trace-key="out"]');
 outAxis.value='A';send(outAxis,'change');
 assert.equal(plotSvg.querySelector('[data-y-axis="B"]'),null);
 outAxis.value='B';send(outAxis,'change');
 plot.updateSeries([{...series[0],visible:false},series[1]]);
 assert.equal(plotSvg.querySelector('[data-y-axis="A"]'),null);
 assert.equal(plotSvg.querySelector('[data-y-axis="B"]').textContent,'B · mV');
 plot.fit();
 assert.equal(plot.interactionActive,false);
 plot.timePan.value='0';send(plot.timePan,'input');
 assert.deepEqual(Array.from(plot.view),[0,1]);
 plot.timePan.value='1000';send(plot.timePan,'input');
 assert.deepEqual(Array.from(plot.view),[1,2]);
 const pan=send(plotSvg,'wheel',{deltaX:-100,deltaY:0});
 assert.equal(pan.defaultPrevented,true);
 assert.ok(plot.view[0]<1);
 assert.equal(plot.cursor.x,1);
 plot.scopeControls.querySelector('[data-time-zoom="fit"]').click();
 assert.deepEqual(Array.from(plot.view),[0,2]);
 plot.set({data:time,series,xUnit:'Hz',xLabel:'Frequenza',yUnit:'V'});
 assert.equal(plot.scopeControls.hidden,true);
 plot.clear();
 assert.equal(plotSvg.children.length,0);
 plot.destroy();
 console.log('PASS independent scales, trace assignment, cursor coordinates, keyboard-accessible time range and inactive horizontal wheel');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
