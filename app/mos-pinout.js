/* CD4007UB terminal assignments for the circuit actually wired in sheet 3. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MosPinout=factory();
})(globalThis,function(){
  'use strict';
  const names={g:'Gate',d:'Drain',s:'Source'};
  const standard={M1:{g:6,d:8,s:7},M2:{g:6,d:13,s:14},M3:{g:3,d:5,s:4}};
  // In figure 9, M3 and M4 are wired with the opposite drain/source assignment.
  const cmos={...standard,M3:{g:3,d:4,s:5},M4:{g:3,d:2,s:1}};
  const cmosGates=['cmos-nor','cmos-nand'];
  const forCircuit=type=>cmosGates.includes(type)?cmos:standard;

  function transistors(doc,type){
    const pinout=forCircuit(type);
    const ids=new Set(doc.components.filter(part=>part.type==='M').map(part=>part.id));
    return Object.keys(pinout).filter(id=>ids.has(id)).map(id=>({
      id,
      pins:Object.entries(pinout[id]).map(([terminal,number])=>({terminal,number,name:names[terminal]}))
    }));
  }

  function packageLabels(doc,type){
    const result={};
    for(const {id,pins} of transistors(doc,type))for(const {name,number} of pins){
      const label=result[number]??={name,parts:[]};
      label.parts.push(id);
    }
    const body={7:'VSS / body nMOS',14:'VDD / body pMOS'};
    return Object.fromEntries(Object.entries(result).map(([number,label])=>[
      number,[label.parts.join('/')+' · '+label.name,body[number]].filter(Boolean).join(' · ')
    ]));
  }
  return {forCircuit,transistors,packageLabels,terminalName:terminal=>names[terminal]};
});
