const {test}=require('node:test');
const assert=require('node:assert/strict');
const Lab=require('../lab-model'),Board=require('../breadboard-model'),Layout=require('../breadboard-layout');
const Render=require('../breadboard-render'),Guide=require('../breadboard-lab'),EditorRender=require('../breadboard-layout-render');

function mount(type,params=Lab.defaults(type),analysis=Lab.analyses(params)[0][0]){
  const doc=Lab.circuit({experiment:type,circuits:{[type]:params},layouts:{},analysis});
  const before=JSON.stringify(doc);
  const model=Board.create(doc,{semiconductorType:type,channels:params.bench?.mode==='real'?params.bench.channels:undefined});
  assert.equal(JSON.stringify(doc),before);
  return model;
}
function layout(model){
  const reference=Layout.reference(model);
  return {reference,board:Layout.proposed(reference)};
}
function chipPin(model,n){
  return model.devicePins.find(pin=>pin.packageId==='IC1'&&pin.number===n);
}

test('all day-five and day-six presets produce a valid, renderable and equivalent mount',()=>{
  for(const {type} of Lab.semiconductor.CATALOG){
    const presets=[null,...Lab.semiconductor.PRESETS[type].map(([id])=>id)];
    for(const id of presets){
      const params=Lab.defaults(type),trial=id&&Lab.semiconductor.applyPreset(params,id);
      const model=trial?mount(type,trial.parameters,trial.analysis):mount(type,params);
      const {reference,board}=layout(model);
      assert.deepEqual(Board.verify(model),[]);
      const check=Layout.check(board,reference);
      assert.ok(check.correct&&check.equivalent,type+' '+id+' '+JSON.stringify(check.errors));
      assert.match(Render.board(model),/1N4148|CD4007UB/);
      assert.match(Render.schematic(model),/1N4148|CD4007UB/);
      assert.match(EditorRender.objects(board,reference),/1N4148|CD4007UB/);
      assert.ok(Guide.mountingNotes(model).length>=2);
    }
  }
});

test('CD4007UB pins implement the shared gates, bulk rails, and NAND series node from the handout',()=>{
  const cmos=mount('cmos-inverter');
  assert.equal(cmos.parts.length,1);
  assert.equal(cmos.parts[0].type,'DIP14');
  const pin=n=>chipPin(cmos,n);
  assert.equal(pin(6).hole,cmos.pinHoles['M1:g']);
  assert.equal(pin(6).hole,cmos.pinHoles['M2:g']);
  assert.equal(pin(7).node,-1);
  assert.equal(pin(8).node,pin(13).node);
  assert.equal(pin(14).node,cmos.topology.nodes['VDD:p']);
  const curves=mount('mos-iv');
  assert.notEqual(chipPin(curves,14).node,chipPin(curves,8).node);
  assert.equal(Layout.reference(curves).ports.find(p=>p.id==='DC3:positive').voltage,9);
  const nand=mount('nmos-nand'),n=i=>chipPin(nand,i).node;
  assert.equal(n(4),n(8));
  assert.notEqual(n(4),n(7));
  assert.notEqual(n(4),n(5));
  assert.equal(nand.sources.length,2);
  assert.equal(nand.dcSources.length,1);
  assert.ok(nand.original.components.some(c=>c.id==='Rleak'));
  assert.ok(!nand.parts.some(c=>c.id==='Rleak'));
  const {reference,board}=layout(nand);
  assert.equal(Object.keys(board.parts.find(p=>p.kind==='DIP14').holes).length,14);
  const rotated=Layout.rotate(board,'IC1');
  assert.equal(Layout.parse(rotated.parts[0].holes[1]).col,'f');
  assert.equal(Layout.check(rotated,reference).equivalent,false);
  assert.deepEqual(Layout.rotate(rotated,'IC1'),board);
});

test('the checker distinguishes reversed diode and electrolytic from an equivalent board',()=>{
  const {reference,board}=layout(mount('half-wave-rc'));
  const diode=Layout.check(Layout.rotate(board,'D1'),reference);
  assert.equal(diode.equivalent,false);
  assert.ok(diode.suggestions.some(d=>d.code==='reversed-reference'));
  const capacitor=Layout.check(Layout.rotate(board,'C1'),reference);
  assert.equal(capacitor.correct,false);
  assert.ok(capacitor.errors.some(d=>d.code==='reversed-reference'||d.code==='reversed-capacitor'));
});

test('guided MOS verification flags missing supplies, open output and shorts to either rail',()=>{
  const amplifier=layout(mount('mos-amplifier'));
  const characterization=layout(mount('mos-iv'));
  for(const {board,reference} of [amplifier,characterization]){
    const missing=Layout.edit(board,next=>{next.leads=next.leads.filter(l=>l.port!=='DC2:positive');});
    const check=Layout.check(missing,reference);
    assert.equal(check.correct,false);
    assert.ok(check.errors.some(d=>d.code==='missing-port'));
    if(reference.experiment==='mos-amplifier')assert.ok(check.errors.some(d=>d.code==='floating-input'));
  }
  const {board,reference}=layout(mount('cmos-inverter')),chip=board.parts.find(part=>part.kind==='DIP14');
  const connected=(board,a,b)=>{const graph=Layout.graph(board);return graph.find(a)===graph.find(b);};
  const remove=wire=>Layout.edit(board,next=>{next.wires=next.wires.filter(w=>w.id!==wire.id);});
  const bridge=board.wires.find(wire=>!connected(remove(wire),chip.holes[8],chip.holes[13]));
  assert.ok(bridge);
  const open=Layout.check(remove(bridge),reference);
  assert.equal(open.correct,false);
  assert.ok(open.errors.some(d=>d.code==='open'));
  const occupied=Layout.occupied(board);
  const freeAt=pin=>Layout.groups(board).find(group=>group.includes(chip.holes[pin])).find(hole=>!occupied.has(hole));
  for(const pin of [7,14]){
    const short=Layout.edit(board,next=>next.wires.push({id:'W200',a:freeAt(8),b:freeAt(pin),color:'#123456'}));
    const check=Layout.check(short,reference);
    assert.equal(check.correct,false);
    assert.ok(check.errors.some(d=>d.code==='short'));
  }
  const movedProbe=Layout.edit(board,next=>{next.leads.find(l=>l.port==='OSC2:tip').hole=freeAt(14);});
  assert.equal(Layout.check(movedProbe,reference).correct,true);
});

test('the CD4007UB checker evaluates gate swing against its absolute input limits',()=>{
  const p=Lab.defaults('nmos-inverter');p.VDD=1;
  const {board,reference}=layout(mount(p.type,p));
  const check=Layout.check(board,reference);
  assert.equal(check.equivalent,true);
  assert.equal(check.correct,false);
  assert.match(check.errors.find(d=>d.code==='gate-voltage-limit').text,/0…5 V.*−?0\.5…1\.5 V/);
});

test('saved oscilloscope settings cannot attach probes to a guided I–V measurement',()=>{
  for(const type of ['diode-iv','mos-iv']){
    const p=Lab.defaults(type);
    const clean=mount(type,p);
    p.bench={mode:'real',channels:[{enabled:true,target:'input',kind:'probe10',coupling:'dc',length:1},{enabled:true,target:'output',kind:'probe10',coupling:'dc',length:1}]};
    const loaded=mount(type,p);
    assert.deepEqual(loaded.original,clean.original);
    assert.deepEqual(loaded.channels,[]);
    assert.doesNotMatch(Render.board(loaded),/data-bb-instrument="scope"/);
    assert.match(Render.board(loaded),/Misure in continua/);
    assert.ok(Layout.reference(loaded).ports.every(port=>!port.id.startsWith('OSC')));
  }
});
