const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../free-model'),L=require('../lab-model'),C=require('../study-context');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function element(){const children=new Map();return{children,textContent:'',innerHTML:'',disabled:false,hidden:false,previousSibling:null,events:{},setAttribute(){},append(...nodes){for(const n of nodes)n.parentNode=this;},querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s);},after(other){other.previousSibling=this;},addEventListener(type,fn){this.events[type]=fn;}};}
function comparisonHarness(){const source=read('comparison-workbench.js'),code=source.slice(source.indexOf(' async function calculate('),source.indexOf(" dialog.addEventListener('click'")),controls=new Map();let resolve;
 const scope={dataset:{raw:'preserved'},revision:0,result:null,resultDoc:null,doc:M.example('rc'),C,L,esc:String,messages:[],plot:{set(){}},residual:{set(){}},clearResult(){scope.revision++;scope.result=null;scope.resultDoc=null;},current:()=>M.clone(scope.doc),status:message=>scope.messages.push(message),tasks:{run:()=>new Promise(r=>{resolve=r;})},$(s){if(!controls.has(s))controls.set(s,element());return controls.get(s);}};
 vm.createContext(scope);vm.runInContext(code,scope);return{scope,finish:r=>resolve(r)};}
const comparisonResult=()=>({stats:{compared:2,outside:0,rms:0,maxAbsolute:0,chi2:null},rows:[],warnings:[],unit:'V',xUnit:'s',kind:'time'});
test('a comparison finishing after a model edit never becomes exportable',async()=>{const {scope:s,finish}=comparisonHarness(),p=s.calculate();s.doc.components.find(c=>c.type==='R').value*=2;finish(comparisonResult());await p;assert.equal(s.result,null);assert.equal(s.dataset.raw,'preserved');assert.match(s.messages.at(-1),/cambiato durante il calcolo/);});
test('view-only changes preserve an in-flight comparison; newer drafts supersede it',async()=>{let {scope:s,finish}=comparisonHarness(),p=s.calculate();s.doc.components[0].x+=100;finish(comparisonResult());await p;assert.equal(s.result.stats.compared,2);assert.equal(s.$('[data-cmp-csv]').disabled,false);
 ({scope:s,finish}=comparisonHarness());p=s.calculate();s.revision++;finish(comparisonResult());await p;assert.equal(s.result,null);
});
