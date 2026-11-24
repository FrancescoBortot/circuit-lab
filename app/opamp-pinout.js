/* TL082C, DIP-8 viewed from above. The two sections share the supply pins. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.OpampPinout=factory();
})(globalThis,function(){
  'use strict';
  const sections={A:{plus:3,minus:2,out:1},B:{plus:5,minus:6,out:7}};
  const terminals={
    plus:{symbol:'+',name:'Ingresso non invertente'},
    minus:{symbol:'−',name:'Ingresso invertente'},
    out:{symbol:'OUT',name:'Uscita'}
  };
  const supply={negative:4,positive:8};
  const sectionsPerChip=(type,saved)=>saved??(type==='precision-rectifier'?2:1);
  function forParts(ids,type,saved){
    const count=sectionsPerChip(type,saved);
    return ids.map((id,i)=>{
      const section=count===2&&i%2===1?'B':'A';
      return {id,section,pins:sections[section]};
    });
  }
  return {sections,terminals,supply,sectionsPerChip,forParts};
});
