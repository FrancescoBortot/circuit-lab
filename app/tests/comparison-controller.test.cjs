const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../free-model'),L=require('../lab-model'),C=require('../study-context');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function element(){const children=new Map();return{children,textContent:'',innerHTML:'',disabled:false,hidden:false,previousSibling:null,events:{},querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s);},after(other){other.previousSibling=this;},addEventListener(type,fn){this.events[type]=fn;}};}
function qualityHarness(){const nodes=[],events={},frames=[],doc=M.example('rc'),anchor=element();class Tasks{constructor(){Tasks.instance=this;}cancel(){}run(){return new Promise(resolve=>{this.resolve=resolve;});}}
 const editor={active:true,doc,result:{method:'trapezoidal',maxResidual:0,warnings:[]}},document={body:{},createElement(){const e=element();nodes.push(e);return e;},querySelector(s){return s==='.free-canvas-toolbar'?anchor:null;},addEventListener(name,fn){events[name]=fn;}};
 const scope={window:{ModelInfo:require('../model-info'),StudyContext:C,FreeModel:M,LabModel:L,CircuitTasks:Tasks,circuitEditor:editor},document,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>frames.push(fn)};
 vm.runInNewContext(read('model-status.js'),scope);return{editor,quality:nodes[0],events,flush(){while(frames.length)frames.shift()();},tasks:Tasks.instance};}
test('precision verification survives view/assembly edits but is invalidated by an electrical edit',async()=>{
 const h=qualityHarness(),b=h.quality.querySelector('[data-quality-check]'),target=h.quality.querySelector('[data-quality-result]'),click=()=>h.quality.events.click({target:{closest:s=>s==='button'?b:s==='[data-quality-check]'?b:null}});
 const pending=click();h.tasks.resolve({absolute:1e-6,relative:1e-5,node:'OUT',coarse:100,fine:200});await pending;assert.match(target.textContent,/Scarto massimo/);const text=target.textContent;
 h.editor.doc.components[1].x+=50;h.editor.doc.assemblyStudy={version:1,sectionsPerChip:2,records:{}};h.events['circuit-lab-document']();h.flush();assert.equal(target.textContent,text);
 h.editor.doc.components.find(c=>c.type==='R').value*=2;h.events['circuit-lab-document']();h.flush();assert.equal(target.textContent,'');
 const second=click();h.editor.doc.components.find(c=>c.type==='R').value*=2;h.tasks.resolve({absolute:999});await second;assert.doesNotMatch(target.textContent,/999/);
});
function comparisonHarness(){const source=read('comparison-workbench.js'),code=source.slice(source.indexOf(' async function calculate('),source.indexOf(" dialog.addEventListener('click'")),controls=new Map();let resolve;
 const scope={dataset:{raw:'preserved'},revision:0,result:null,resultDoc:null,doc:M.example('rc'),C,L,esc:String,messages:[],plot:{set(){}},residual:{set(){}},clearResult(){scope.revision++;scope.result=null;scope.resultDoc=null;},current:()=>M.clone(scope.doc),status:message=>scope.messages.push(message),tasks:{run:()=>new Promise(r=>{resolve=r;})},$(s){if(!controls.has(s))controls.set(s,element());return controls.get(s);}};
 vm.createContext(scope);vm.runInContext(code,scope);return{scope,finish:r=>resolve(r)};}
const comparisonResult=()=>({stats:{compared:2,outside:0,rms:0,maxAbsolute:0,chi2:null},rows:[],warnings:[],unit:'V',xUnit:'s',kind:'time'});
test('a comparison finishing after a model edit never becomes exportable',async()=>{const {scope:s,finish}=comparisonHarness(),p=s.calculate();s.doc.components.find(c=>c.type==='R').value*=2;finish(comparisonResult());await p;assert.equal(s.result,null);assert.equal(s.dataset.raw,'preserved');assert.match(s.messages.at(-1),/cambiato durante il calcolo/);});
test('view-only changes preserve an in-flight comparison; newer drafts supersede it',async()=>{let {scope:s,finish}=comparisonHarness(),p=s.calculate();s.doc.components[0].x+=100;finish(comparisonResult());await p;assert.equal(s.result.stats.compared,2);assert.equal(s.$('[data-cmp-csv]').disabled,false);
 ({scope:s,finish}=comparisonHarness());p=s.calculate();s.revision++;finish(comparisonResult());await p;assert.equal(s.result,null);
});
