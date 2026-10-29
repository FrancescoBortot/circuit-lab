/* A physical view of the existing electrical document. No independent solver. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./bench-model.js'));else root.BreadboardModel=factory(root.FreeModel,root.BenchModel);})(typeof globalThis!=='undefined'?globalThis:this,function(M,Bench){
 'use strict';
 const palette={ground:'#263747',input:'#16804d',input2:'#9552cc',output:'#e36c16',negative:'#2867d8',positive:'#d93545',feedback:'#ad7828',channel1:'#b99500',channel2:'#009fce'};
 const extraColors=['#007f89','#c24379','#617819','#7058ae','#b44e22','#2c7cba'];
 const pinNames={1:'OUT A',2:'− A',3:'+ A',4:'V−',5:'+ B',6:'− B',7:'OUT B',8:'V+'};
 const columns='abcdefghij',clone=M.clone;
 function groups(module){const a=[];for(let r=1;r<=30;r++)for(const c of ['abcde','fghij'])a.push([...c].map(k=>`${module}:${k}${r}`));for(const rail of ['L1','L2','R1','R2'])a.push(Array.from({length:25},(_,i)=>`${module}:${rail}.${i+1}`));return a;}
 function group(hole){const[m,h]=hole.split(':');return /^[a-j]/.test(h)?m+':strip'+(columns.indexOf(h[0])<5?'L':'R')+h.slice(1):m+':'+h.split('.')[0];}
 function localPoint(hole){const[,h]=hole.split(':');if(/^[a-j]/.test(h)){const c=columns.indexOf(h[0]);return{x:c<5?70+c*18:230+(c-5)*18,y:46+(Number(h.slice(1))-1)*14};}const[r,n]=h.split('.');return{x:{L1:20,L2:40,R1:330,R2:350}[r],y:46+(Number(n)-1)*14};}
 function create(input,options={}){
  const original=clone(input),doc=original.benchSetup?Bench.remove(original):clone(original),errors=M.validate(doc);if(errors.length)throw Error(errors[0]);
  if(!doc.components.length)return{empty:true,doc,original,topology:M.topology(doc),modules:[],parts:[],wires:[],nets:[],sources:[],channels:[],contacts:[],groups:[],pinHoles:{},devicePins:[],occupied:[]};
  const unsupported=doc.components.filter(c=>!['R','C','L','U','V','G','J'].includes(c.type));if(unsupported.length)throw Error('Breadboard: '+unsupported.map(c=>c.id).join(', ')+' richiede un profilo fisico verificato. Usa lo schema.');
  const sources=doc.components.filter(c=>c.type==='V');if(sources.length>2)throw Error('Il banco dispone di due uscite del generatore. Riduci le sorgenti a due.');
  const topology=M.topology(doc),nodes=topology.nodes,nets=[],byNode=new Map(),owner=new Map(),occupied=new Map(),pinHoles={},parts=[],modules=[],jumpers=[],contacts=[],devicePins=[];
  if(sources.some(c=>nodes[c.id+':n']!==-1))throw Error('Il generatore del banco ha ritorni comuni: collega i negativi a GND nello schema. Per sorgenti flottanti usa Schema.');
  const indices=[...new Set(Object.values(nodes))];
  for(const index of indices){const refs=Object.keys(nodes).filter(k=>nodes[k]===index),input2=doc.components.find(c=>c.id==='V2')?.id+':p';let name,indexColor;
   if(index<0){name='GND';indexColor=palette.ground;}else if(doc.probes.output&&nodes[doc.probes.output]===index){name='OUT';indexColor=palette.output;}else if(doc.probes.input&&nodes[doc.probes.input]===index){name='IN';indexColor=palette.input;}else if(nodes[input2]===index){name='IN2';indexColor=palette.input2;}else if(refs.some(r=>r.endsWith(':minus'))){name='Σ−';indexColor=palette.feedback;}else if(refs.some(r=>r.endsWith(':plus'))){name='Σ+';indexColor='#008c94';}else{name='N'+(index+1);indexColor=extraColors[nets.length%extraColors.length];}
   const net={id:'net:'+index,index,name,color:indexColor,refs,groups:[]};nets.push(net);byNode.set(index,net);
  }
  function module(){const id='M'+(modules.length+1);modules.push({id,groups:groups(id)});return id;}
  module();
  function tryPlace(id,type,locations,netMap,extra={}){
   const pending=new Map();for(const[pin,hole]of Object.entries(locations)){const key=group(hole),net=netMap[pin];if(occupied.has(hole)||owner.has(key)&&owner.get(key)!==net||pending.has(key)&&pending.get(key)!==net)return false;
    const capacity=key.match(/:[LR][12]$/)?25:5,used=[...occupied.keys()].filter(h=>group(h)===key).length+Object.values(locations).filter(h=>group(h)===key).length;if(used>capacity-2)return false;pending.set(key,net);
   }
   for(const[pin,hole]of Object.entries(locations)){owner.set(group(hole),netMap[pin]);occupied.set(hole,id+':'+pin);pinHoles[id+':'+pin]=hole;}
   parts.push({id,type,holes:locations,...extra});return true;
  }
  const amps=doc.components.filter(c=>c.type==='U');
  for(const c of amps){let success=false;for(let m=0;m<20&&!success;m++){if(!modules[m])module();const id=modules[m].id,locations={plus:`${id}:e14`,minus:`${id}:e13`,out:`${id}:e12`},vplus='supply:'+c.id+':+',vminus='supply:'+c.id+':−',spare='spare:'+c.id;
    const physical={1:locations.out,2:locations.minus,3:locations.plus,4:`${id}:e15`,5:`${id}:f15`,6:`${id}:f14`,7:`${id}:f13`,8:`${id}:f12`};
    const targets={out:nodes[c.id+':out'],minus:nodes[c.id+':minus'],plus:nodes[c.id+':plus'],4:vminus,5:-1,6:spare,7:spare,8:vplus};
    success=tryPlace(c.id,'U',{...locations,4:physical[4],5:physical[5],6:physical[6],7:physical[7],8:physical[8]},targets,{component:c,physical});
    if(success){const q=M.physical(c);nets.push({id:vplus,index:vplus,name:c.id+' V+',color:palette.positive,refs:[],groups:[],voltage:q.positive},{id:vminus,index:vminus,name:c.id+' V−',color:palette.negative,refs:[],groups:[],voltage:q.negative},{id:spare,index:spare,name:c.id+' B',color:'#6b7a8c',refs:[],groups:[]});for(const[n,h]of Object.entries(physical))devicePins.push({component:c.id,number:Number(n),name:pinNames[n],hole:h,node:n==='1'?targets.out:n==='2'?targets.minus:n==='3'?targets.plus:targets[n]});}
   }if(!success)throw Error('Spazio insufficiente per '+c.id+'.');
  }
  const hints={R1:['a4','a9'],Rf:['b13','b6'],C1:['c9','c20'],R3:['h4','h9'],R4:['i9','i22']};
  for(const c of doc.components.filter(c=>['R','C','L'].includes(c.type))){const ns={a:nodes[c.id+':a'],b:nodes[c.id+':b']};let success=false;
   if(hints[c.id])success=tryPlace(c.id,c.type,{a:'M1:'+hints[c.id][0],b:'M1:'+hints[c.id][1]},ns,{component:c});
   for(let m=0;m<20&&!success;m++){if(!modules[m])module();for(const r of [4,8,20,24,28,2,6,10,18,22,26]){if(tryPlace(c.id,c.type,{a:modules[m].id+':e'+r,b:modules[m].id+':f'+r},ns,{component:c})){success=true;break;}}}
   if(!success)throw Error('Spazio insufficiente per '+c.id+'.');
  }
  const netOf=ref=>nodes[ref];
  function freeHole(key){const m=modules.find(m=>m.id===key.split(':')[0]);return m?.groups.find(g=>group(g[0])===key)?.find(h=>!occupied.has(h));}
  function occupy(hole,node,id){if(occupied.has(hole)||owner.has(group(hole))&&owner.get(group(hole))!==node)throw Error('Contatto occupato: '+hole);owner.set(group(hole),node);occupied.set(hole,id);return hole;}
  function anchor(node,id,prefer=null){let hole;
   if(prefer&&!occupied.has(prefer)&&(!owner.has(group(prefer))||owner.get(group(prefer))===node))hole=prefer;
   if(!hole)for(const[key,n]of owner)if(n===node&&(hole=freeHole(key)))break;
   if(!hole)for(let m=0;m<20&&!hole;m++){if(!modules[m])module();for(const g of modules[m].groups){const key=group(g[0]);if(!owner.has(key)){hole=g[0];break;}}}
   if(!hole)throw Error('Nessun contatto libero per '+id+'.');return occupy(hole,node,id);
  }
  for(const c of doc.components.filter(c=>['V','G','J'].includes(c.type)))for(const pin of M.PINS[c.type]){const ref=c.id+':'+pin,n=netOf(ref),sourceIndex=sources.findIndex(s=>s.id===c.id),preferred=c.type==='V'&&pin==='p'?`M1:${sourceIndex===0?'d':'g'}2`:n===-1?`M1:L2.${contacts.filter(c=>c.node===-1).length+1}`:null,hole=anchor(n,ref,preferred);pinHoles[ref]=hole;contacts.push({id:ref,ref,hole,node:n,kind:c.type==='V'?'source':'reference',component:c.id});}
  const supplied=options.channels||[{enabled:true,target:doc.probes.input,label:'CH1'},{enabled:true,target:doc.probes.output,label:'CH2'}],channels=[];
  supplied.forEach((ch,i)=>{let target=ch.target==='input'?doc.probes.input:ch.target==='output'?doc.probes.output:ch.target==='input2'?(doc.components.some(c=>c.id==='R3')?'R3:a':sources[1]?.id+':p'):ch.target;if(!ch.enabled||!M.validPin(doc,target))return;const n=netOf(target),hole=anchor(n,'OSC:CH'+(i+1)+':tip'),ground=topology.ground?anchor(-1,'OSC:CH'+(i+1)+':ground','M1:L2.'+(15+i)):null;channels.push({id:'CH'+(i+1),target,hole,ground,node:n,color:i?palette.channel2:palette.channel1,kind:ch.kind||'ideal',coupling:ch.coupling||'dc'});});
  for(const part of parts.filter(p=>p.type==='U')){
   for(const polarity of ['+','−']){const n='supply:'+part.id+':'+polarity,hole=anchor(n,'PSU:'+part.id+polarity,part.physical[polarity==='+'?8:4].split(':')[0]+(polarity==='+'?':R1.1':':L1.1'));contacts.push({id:'PSU:'+part.id+polarity,hole,node:n,kind:'supply',component:part.id});}
   const m=part.physical[8].split(':')[0];for(const[id,pole,row]of [['Cd+',8,6],['Cd−',4,23]]){const n='supply:'+part.id+':'+(pole===8?'+':'−'),ref=part.physical[pole],col=pole===8?'h':'c',pin=col+ref.match(/\d+$/)[0],groundHole=anchor(-1,part.id+id+':b',`${m}:${col}${row}`),hot=anchor(n,part.id+id+':a',`${m}:${pin}`);parts.push({id:part.id+'.'+id,type:'C',holes:{a:hot,b:groundHole},auxiliary:true,component:{value:1e-7}});}
  }
  if(amps.length){const hole=anchor(-1,'PSU:GND','M1:L2.20');contacts.push({id:'PSU:GND',hole,node:-1,kind:'supply-ground'});}
  // Join distinct strips of the same net using real, unoccupied holes.
  const allNets=new Map(nets.map(n=>[n.index,n]));if(ownerHasGround()&&!allNets.has(-1)){const ground={id:'net:-1',index:-1,name:'GND',color:palette.ground,refs:[],groups:[]};nets.unshift(ground);allNets.set(-1,ground);}
  function ownerHasGround(){return[...owner.values()].includes(-1);}
  for(const n of nets){n.groups=[...owner].filter(([,v])=>v===n.index).map(([k])=>k);if(!n.groups.length)continue;const connected=[n.groups[0]],remaining=n.groups.slice(1);
   while(remaining.length){let best=null;for(const a of connected)for(const b of remaining){const ah=freeHole(a),bh=freeHole(b);if(!ah||!bh)continue;const ap=localPoint(ah),bp=localPoint(bh),cost=Math.abs(ap.x-bp.x)+Math.abs(ap.y-bp.y)+(a.split(':')[0]===b.split(':')[0]?0:1000);if(!best||cost<best.cost)best={a,b,ah,bh,cost};}if(!best)throw Error('Contatti insufficienti sulla rete '+n.name+'.');const id='W'+(jumpers.length+1);occupy(best.ah,n.index,id+':a');occupy(best.bh,n.index,id+':b');jumpers.push({id,a:best.ah,b:best.bh,node:n.index,net:n.id,color:n.color});connected.push(best.b);remaining.splice(remaining.indexOf(best.b),1);}
  }
  const result={doc,original,topology,modules,parts,wires:jumpers,nets,sources:clone(sources),channels,contacts,pinHoles,devicePins,groups:modules.flatMap(m=>m.groups),occupied:[...occupied.keys()],instrumentConfig:options.instrumentConfig||original.benchSetup?.config||null,modelMode:options.modelMode||'ideal'};
  const mismatches=verify(result);if(mismatches.length)throw Error('Montaggio non equivalente: '+mismatches[0]);return result;
 }
 function verify(model){if(model.empty)return[];const parent=new Map(),find=h=>{if(!parent.has(h))parent.set(h,h);if(parent.get(h)!==h)parent.set(h,find(parent.get(h)));return parent.get(h)},join=(a,b)=>parent.set(find(a),find(b));for(const g of model.groups)for(const h of g)join(g[0],h);for(const w of model.wires)join(w.a,w.b);const refs=Object.keys(model.topology.nodes),errors=[];for(let i=0;i<refs.length;i++)for(let j=i+1;j<refs.length;j++){const a=refs[i],b=refs[j];if((model.topology.nodes[a]===model.topology.nodes[b])!==(find(model.pinHoles[a])===find(model.pinHoles[b])))errors.push(a+' / '+b);}return errors;}
 return{create,verify,palette,pinNames,localPoint,group,clone};
});
