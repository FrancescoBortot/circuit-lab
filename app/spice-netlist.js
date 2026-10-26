/* Data-only ngspice netlist export. No netlist is executed by the application. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'));else root.SpiceNetlist=factory(root.FreeModel);})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';const number=v=>{if(!Number.isFinite(v))throw Error('Parametro SPICE non finito.');return v.toExponential(15);};
  function build(doc){
    const errors=M.issues(doc);if(errors.length)throw new Error(errors[0]);const topo=M.topology(doc),node=ref=>ref&&topo.nodes[ref]>=0?'N'+(topo.nodes[ref]+1):'0',sourceID=doc.settings.acSource||doc.components.find(c=>['V','I'].includes(c.type))?.id,weights=doc.settings.acWeights||{[sourceID]:1},phases=doc.settings.acPhases||{},lines=['Circuit Lab · '+String(doc.name||'Circuito').replace(/[\r\n\0]/g,' '),'* ngspice subset: generated from explicit connections; no hidden ground or leakage.','* Transient initial conditions require UIC. DC bias is separate from the waveform.'],warnings=[];
    if(doc.probes.output)lines.push('* CLAB_OUT '+node(doc.probes.output));if(doc.probes.input)lines.push('* CLAB_IN '+node(doc.probes.input));
    for(const n of topo.groups)if(n.label!==n.name)lines.push('* '+n.name+' = '+n.label.replace(/[\r\n\0]/g,' '));
    const waveform=c=>{const w=c.wave,p=w.polarity??1,low=(w.low||0)*p,high=w.level*p,kind=w.kind;
      if(kind==='dc')return w.dc===undefined?'':`PWL(0 ${number(high)} ${number(doc.settings.duration)} ${number(high)})`;
      if(kind==='sine')return`SIN(${number(w.offset*p)} ${number(w.vpp*p/2)} ${number(w.frequency)} 0 0 ${number(w.phase)})`;
      if(kind==='pulse')return`PULSE(${number(low)} ${number(high)} ${number(w.delay)} ${number(w.rise||0)} ${number(w.fall||0)} ${number(w.width)} ${number(w.period||doc.settings.duration+w.width+(w.rise||0)+(w.fall||0)+.001)})`;
      if(kind==='step'){const rise=w.rise||0;if(w.delay===0&&rise===0)return`PWL(0 ${number(high)} ${number(doc.settings.duration)} ${number(high)})`;const pts=[[0,low],[w.delay,low],[w.delay+rise,high]];if(!rise)warnings.push(c.id+': fronte ideale con due punti alla stessa ascissa.');return'PWL('+pts.map(([t,v])=>number(t)+' '+number(v)).join(' ')+')';}
      if(kind==='pwl')return'PWL('+w.points.map(([t,v])=>number(t)+' '+number(v*p)).join(' ')+')';
      const times=new Set([0,doc.settings.duration]),f=w.frequency;if(f*doc.settings.duration>400)throw Error('Esporta al massimo 400 periodi.');
      for(let k=-2;k<=Math.ceil(f*doc.settings.duration)+2;k++)for(const phase of kind==='square'?[0,w.duty/100]:[.25,.75]){const t=(k+phase-w.phase/360)/f;if(t>0&&t<doc.settings.duration)times.add(t);}
      const points=[];for(const t of [...times].sort((a,b)=>a-b)){if(t>0&&kind==='square'){points.push([t,M.source(w,t,'left')]);}points.push([t,M.source(w,t)]);}if(kind==='square')warnings.push(c.id+': onda quadra ideale, rappresentata da PWL con ascisse ripetute.');return'PWL('+points.map(([t,v])=>number(t)+' '+number(v)).join(' ')+')';
    };
    for(const c of doc.components){const pin=p=>node(c.id+':'+p),id=c.type+'_'+c.id;if(['G','J'].includes(c.type))continue;
      if(['R','C','L'].includes(c.type)){lines.push(`${id} ${pin('a')} ${pin('b')} ${number(c.value)}`+(['C','L'].includes(c.type)?' IC='+number(c.initial):''));continue;}
      if(['V','I'].includes(c.type)){let weight=weights[c.id]||0,phase=(phases[c.id]||0)+(weight<0?180:0);lines.push(`${id} ${pin('p')} ${pin('n')} DC ${number(M.dcValue(c))} AC ${number(Math.abs(weight))} ${number(phase)} ${waveform(c)}`.trim());if(['pulse','step'].includes(c.wave.kind)&&(!(c.wave.rise>0)||c.wave.kind==='pulse'&&!(c.wave.fall>0)))warnings.push(c.id+': i fronti ideali dipendono dalla gestione del passo del motore di destinazione.');continue;}
      if(c.type==='D'){lines.push(`${id} ${pin('a')} ${pin('b')} Model_${c.id}`,`.model Model_${c.id} D(IS=${number(c.is)} N=${number(c.n)} TNOM=27)`);continue;}
      if(c.type==='Q'){lines.push(`${id} ${pin('c')} ${pin('b')} ${pin('e')} Model_${c.id}`,`.model Model_${c.id} ${c.polarity==='p'?'PNP':'NPN'}(IS=${number(c.is)} BF=${number(c.bf)} BR=${number(c.br)} TNOM=27)`);continue;}
      if(c.type==='M'){lines.push(`${id} ${pin('d')} ${pin('g')} ${pin('s')} ${pin('s')} Model_${c.id} W=1u L=1u`,`.model Model_${c.id} ${c.polarity==='p'?'PMOS':'NMOS'}(LEVEL=1 KP=${number(c.kp)} VTO=${number((c.polarity==='p'?-1:1)*c.vto)} LAMBDA=${number(c.lambda)} IS=${number(c.bodyIs)} GAMMA=0 TNOM=27)`);continue;}
      if(c.type==='U'){
        if(c.model==='ideal'){lines.push(`E_${c.id} ${pin('out')} 0 ${pin('plus')} ${pin('minus')} 1e12`);warnings.push(c.id+': amplificatore ideale approssimato con guadagno aperto 1e12.');continue;}
        const z='Z_'+c.id,tau=c.a0/(2*Math.PI*c.gbw),q=M.physical(c),lo=c.model==='physical'?q.negative+c.headroom:-c.rail+c.headroom,hi=c.model==='physical'?q.positive-c.headroom:c.rail-c.headroom,raw=`(${number(c.a0)}*(v(${pin('plus')})-v(${pin('minus')}))-v(${z}))`,force=c.model==='physical'?`max(${number(-tau*q.slew)},min(${number(tau*q.slew)},${raw}))`:raw,limited=`(v(${z})>=${number(hi)} ? min(0,${force})-(v(${z})-${number(hi)}) : (v(${z})<=${number(lo)} ? max(0,${force})-(v(${z})-${number(lo)}) : ${force}))`,initial=Math.max(lo,Math.min(hi,0));
        lines.push(`C_${c.id}state ${z} 0 ${number(tau)} IC=${number(initial)}`,`B_${c.id}state ${z} 0 I=-${limited}`);
        if(c.model==='physical')lines.push(`B_${c.id}out ${pin('out')} 0 I=max(${number(-q.ilimit)},min(${number(q.ilimit)},(v(${pin('out')})-v(${z}))/${number(q.rout)}))`);else lines.push(`E_${c.id}out ${pin('out')} 0 ${z} 0 1`);
        continue;
      }
      throw new Error('Componente non esportabile: '+c.type+'.');
    }
    if(doc.components.some(c=>['D','Q','M'].includes(c.type)))lines.push('.temp 27');
    lines.push('* Model definitions are generic; original JSON is needed for full editing and measurement data.');return{lines,output:node(doc.probes.output),input:node(doc.probes.input),node,prefix:id=>{const c=doc.components.find(c=>c.id===id);if(!c)throw Error('Componente non disponibile.');return c.type+'_'+c.id;},warnings:[...new Set(warnings)]};
  }
  function exportText(doc){const n=build(doc),s=doc.settings;let command;if(s.analysis==='op')command='.op';else if(s.analysis==='dc'){const id=s.dcSource||s.acSource||doc.components.find(c=>['V','I'].includes(c.type))?.id,current=doc.components.find(c=>c.id===id)?.type==='I',start=s.dcStart??(current?-.001:-5),stop=s.dcStop??(current?.001:5),count=s.dcPoints??101;if(start===stop)throw Error('Scansione DC: gli estremi devono essere diversi.');command=`.dc ${n.prefix(id)} ${number(start)} ${number(stop)} ${number((stop-start)/(count-1))}`;}else if(s.analysis==='bode'){const mode=s.acGrid||'legacy';if(mode==='legacy'){const points=Math.max(2,Math.round(300/Math.log10(s.fmax/s.fmin)));command=`.ac dec ${points} ${number(s.fmin)} ${number(s.fmax)}`;n.warnings.push('Griglia storica a 301 punti: la densità SPICE per decade è arrotondata.');}else command=`.ac ${mode==='linear'?'lin':mode==='octave'?'oct':'dec'} ${s.acPoints??50} ${number(s.fmin)} ${number(s.fmax)}`;}else command=`.tran ${number(s.duration/(2*s.samples-1))} ${number(s.duration)} 0 ${number(s.duration/(2*s.samples-1))} uic`;
    const text=n.lines.concat(n.warnings.map(w=>'* '+w),['.options reltol=1e-6 abstol=1e-12 vntol=1e-9',command,'.end']).join('\n')+'\n';if(new TextEncoder().encode(text).length>2000000)throw Error('La netlist supera 2 MB: riduci durata o periodi.');return{text,warnings:n.warnings};
  }
  return{build,exportText};
});
