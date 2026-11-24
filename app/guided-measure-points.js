/* Measurement labels for the appendix traces, shared by plot and schematic. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model'));
  else root.GuidedMeasurePoints=factory(root.FreeModel);
})(globalThis,function(Free){
  'use strict';
  function voltage(key,symbol,detail,ref,defaultVisible=true){
    return {key,label:symbol,detail,locations:[{ref,symbol}],defaultVisible,dash:key==='out'?undefined:'5 4'};
  }

  function describe(p,doc){
    const probe=doc.benchSetup?.probes||doc.probes;
    let traces;
    switch(p.type){
      case 'precision-rectifier':
        traces=[
          voltage('vin','V₁','Ingresso su R1a','R1a:a'),
          voltage('out','OUT','Uscita di U1','U1:out'),
          voltage('v2','V₂','Ingresso di R2 · lato D1','R2:a'),
          voltage('aux','Vₒ′','Uscita di U2','U2:out')
        ];
        break;
      case 'bridge-rectifier':
        traces=[
          voltage('vin','Vɢ','Uscita del generatore','V1:p'),
          voltage('a','Vᴬ','Morsetto A di R1','R1:a'),
          voltage('b','Vᴮ','Morsetto B di R1','R1:b'),
          {key:'out',label:'Vᴮ − Vᴬ',detail:'Ai capi di R1 · B meno A',locations:[],relatedKeys:['a','b']}
        ];
        break;
      case 'common-source':
        traces=[
          voltage('vin','IN',p.inputResistor?'Prima di Rᵢ':'Prima di C₁',probe.input),
          voltage('out','OUT','Dopo C₂',probe.output),
          ...(p.inputResistor?[voltage('afterRi','Dopo Rᵢ','Ingresso di C₁','C1:a')]:[]),
          voltage('gate','Vɢ','Gate di M3 · pin 3','M3:g',false),
          voltage('drain','Vᴅ','Drain di M3 · pin 5','M3:d',false),
          voltage('source','Vₛ','Source di M3 · pin 4','M3:s',false)
        ];
        break;
      case 'cmos-nor':
      case 'cmos-nand':
        traces=[
          voltage('vin','A','Ingresso su Gate M1/M2 · pin 6','M1:g'),
          voltage('vin2','B','Ingresso su Gate M3/M4 · pin 3','M3:g'),
          voltage('out','Y','Uscita della porta',probe.output)
        ];
        break;
      default:return [];
    }
    const byRef=new Map(traces.flatMap(trace=>trace.locations.map(({ref,symbol})=>[ref,symbol])));
    // Use the physical tip even when an AC-coupled reading is taken inside the scope model.
    const tips={input:probe.input,output:probe.output,input2:'V2:p'};
    const channelTraces=(doc.benchSetup?.config.channels||[]).flatMap((channel,i)=>{
      if(!channel.enabled)return [];
      const ref=tips[channel.target]||channel.target,symbol='CH'+(i+1);
      const [id,pin]=ref.split(':'),part=doc.components.find(c=>c.id===id);
      const target=byRef.get(ref)||id+' · '+Free.pinLabel(part.type,pin);
      return [{key:'ch'+(i+1),label:symbol+' su '+target,target,
        detail:'Lettura simulata · '+(channel.kind==='probe10'?'sonda ×10':'cavo diretto')+' · '+channel.coupling.toUpperCase(),
        locations:[{ref,symbol}],defaultVisible:i===1&&p.type==='precision-rectifier'&&ref!==probe.output}];
    });
    if(p.type==='bridge-rectifier'&&channelTraces.length===2){
      traces.push({key:'math',label:'CH2 − CH1',detail:channelTraces[1].target+' meno '+channelTraces[0].target,
        locations:[],relatedKeys:['ch1','ch2'],defaultVisible:false});
    }
    return [...traces,...channelTraces];
  }

  function markers(traces,diagram){
    const groups=new Map();
    for(const trace of traces)for(const point of trace.locations){
      const ref=diagram.benchSetup?.sourceMap[point.ref]||point.ref;
      if(!Free.validPin(diagram,ref))continue;
      const group=groups.get(ref)||[];
      group.push({key:trace.key,symbol:point.symbol,label:trace.label,detail:trace.detail});
      groups.set(ref,group);
    }
    return groups;
  }
  return {describe,markers};
});
