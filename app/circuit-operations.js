/* Reversible document transformations. Names annotate nodes; they never wire them. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'));else root.CircuitOperations=factory(root.FreeModel);})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const finish=d=>{const errors=M.validate(d);if(errors.length)throw new Error(errors[0]);return d;};
  function id(d,type){let i=1;while(d.components.some(c=>c.id===type+i))i++;return type+i;}
  function wireId(d){let i=1;while(d.wires.some(w=>w.id==='W'+i))i++;return'W'+i;}
  function renameNode(doc,pin,label){
    if(!M.validPin(doc,pin))throw new Error('Nodo non disponibile.');const d=M.clone(doc),t=M.topology(d),node=t.nodes[pin];if(node<0)throw new Error('La massa mantiene il riferimento 0 V.');
    d.nodeLabels=d.nodeLabels||{};for(const ref of Object.keys(d.nodeLabels))if(t.nodes[ref]===node)delete d.nodeLabels[ref];
    label=label.trim();if(label){if(Object.entries(d.nodeLabels).some(([ref,name])=>name===label&&t.nodes[ref]!==node))throw new Error('Il nome appartiene già a un altro nodo. I nomi non creano collegamenti.');d.nodeLabels[pin]=label;}
    return finish(d);
  }
  function moveGroup(doc,ids,dx,dy){const d=M.clone(doc);if(![dx,dy].every(Number.isFinite))throw new Error('Spostamento non valido.');for(const c of d.components)if(ids.includes(c.id)){c.x+=dx;c.y+=dy;}return finish(d);}
  function duplicateGroup(doc,ids){
    const d=M.clone(doc),map=new Map(),original=d.components.filter(c=>ids.includes(c.id));if(!original.length)throw new Error('Seleziona almeno un componente.');
    for(const c of original){const copy=M.clone(c);copy.id=id(d,c.type);copy.x+=80;copy.y+=80;map.set(c.id,copy.id);d.components.push(copy);}
    const ref=p=>{const [part,pin]=p.split(':');return map.has(part)?map.get(part)+':'+pin:null;};
    for(const w of doc.wires){const a=ref(w.a),b=ref(w.b);if(a&&b)d.wires.push({...M.clone(w),id:wireId(d),a,b});}
    if(d.nodeLabels)for(const [pin,label]of Object.entries(doc.nodeLabels)){const copy=ref(pin);if(copy){let i=2,name;do{name=label.slice(0,19)+'_'+i++;}while(Object.values(d.nodeLabels).includes(name));d.nodeLabels[copy]=name;}}
    return{doc:finish(d),ids:[...map.values()]};
  }
  function removeGroup(doc,ids){
    const d=M.clone(doc),t=M.topology(d),removed=new Set(ids),survives=pin=>!removed.has(pin.split(':')[0]),replacement=pin=>Object.keys(t.nodes).find(ref=>t.nodes[ref]===t.nodes[pin]&&survives(ref))||null;
    if(d.nodeLabels){const labels={};for(const [pin,label]of Object.entries(d.nodeLabels)){const replacement=survives(pin)?pin:t.groups.find(n=>n.index===t.nodes[pin])?.pins.find(survives);if(replacement)labels[replacement]=label;}d.nodeLabels=labels;}
    d.components=d.components.filter(c=>!removed.has(c.id));d.wires=d.wires.filter(w=>survives(w.a)&&survives(w.b));
    for(const key of ['input','output'])if(d.probes[key]&&!survives(d.probes[key]))d.probes[key]=replacement(d.probes[key]);
    d.traces=(d.traces||[]).filter(p=>{if(p.kind==='current')return!removed.has(p.component);if(!survives(p.positive))p.positive=replacement(p.positive);if(p.negative&&!survives(p.negative)){const next=replacement(p.negative);if(!next)return false;p.negative=next;}return Boolean(p.positive);});
    if(d.settings.acPhases)for(const id of ids)delete d.settings.acPhases[id];if(removed.has(d.settings.dcSource))d.settings.dcSource=d.components.find(c=>['V','I'].includes(c.type))?.id||null;
    if(d.settings.acWeights){for(const id of ids)delete d.settings.acWeights[id];if(!Object.values(d.settings.acWeights).some(v=>v!==0))delete d.settings.acWeights;}
    if(removed.has(d.settings.acSource))d.settings.acSource=d.components.find(c=>['V','I'].includes(c.type))?.id||null;
    if(d.settings.acReference==='input'&&!d.probes.input)d.settings.acReference='source';return finish(d);
  }
  function insert(doc,wire,type){
    if(!['R','C','L','J'].includes(type))throw new Error('Componente non inseribile su un filo.');
    const d=M.clone(doc),w=d.wires.find(w=>w.id===wire);if(!w)throw new Error('Filo non disponibile.');
    const a=d.components.find(c=>c.id===w.a.split(':')[0]),b=d.components.find(c=>c.id===w.b.split(':')[0]),c=M.component(type,id(d,type),Math.round((a.x+b.x)/20)*10,Math.round((a.y+b.y)/20)*10);d.components.push(c);
    const end=w.b;w.b=c.id+':'+(type==='J'?'j':'a');w.route='auto';w.offset=0;d.wires.push({id:wireId(d),a:c.id+':'+(type==='J'?'j':'b'),b:end});return{doc:finish(d),id:c.id};
  }
  return{renameNode,moveGroup,duplicateGroup,removeGroup,insert};
});
