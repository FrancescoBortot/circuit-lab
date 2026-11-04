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
 assert.equal(JSON.stringify({params,doc,data:plot.data}),unchanged);assert.equal(commits,0);plot.destroy();console.log('PASS gentle bounded wheel, Chromium trackpad pinch, WebKit incremental pinch and activation on guided/free/plot controllers without model changes');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
