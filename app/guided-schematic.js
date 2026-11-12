/* Presentation-only layouts. The solver and circuit export keep the complete network. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./free-model.js'),require('./bench-model.js'));
  else root.GuidedSchematic=factory(root.FreeModel,root.BenchModel);
})(globalThis,function(Free,Bench){
  'use strict';

  function layout(network,type,params){
    const doc=Bench.remove(network);
    if(!['diode-iv','half-wave','half-wave-rc','mos-iv','mos-amplifier','nmos-inverter','nmos-nor','nmos-nand','cmos-inverter'].includes(type))return doc;

    const hidden=new Set(['Rref','Rleak','Jout']);
    if(type==='cmos-inverter'||type==='mos-amplifier'&&params.RL===10e6)hidden.add('RL');
    doc.components=doc.components.filter(c=>c.type!=='G'&&!hidden.has(c.id));
    const parts=new Map(doc.components.map(c=>[c.id,c]));
    doc.wires=[];
    delete doc.nodeLabels;
    doc.sheetSchematic=true;
    const probes={...doc.probes};
    const place=(id,x,y,options)=>Object.assign(parts.get(id),{x,y},options);
    const path=(...pins)=>{
      for(let i=1;i<pins.length;i++)doc.wires.push({id:'S'+(doc.wires.length+1),a:pins[i-1],b:pins[i]});
    };
    const point=(x,y,type='J',junction=false)=>{
      const id=type==='J'?'JS'+doc.components.length:'GS'+doc.components.length;
      doc.components.push({...Free.component(type,id,x,y),schematicDecoration:true,schematicJunction:junction});
      return id+(type==='J'?':j':':g');
    };
    const ground=(pin,x,y)=>path(pin,point(x,y,'G'));
    const elbow=(x,y)=>point(x,y);
    const tee=(x,y)=>point(x,y,'J',true);

    if(type==='diode-iv'||type==='half-wave'||type==='half-wave-rc'){
      const characteristic=type==='diode-iv',filter=parts.has('C1'),external=parts.has('RL');
      place('V1',130,230);
      if(characteristic){
        place('R1',325,145);place('D1',520,230,{rotation:90});
        path('V1:p',elbow(130,145),'R1:a');
        path('R1:b',elbow(520,145),'D1:a');
        const common=tee(520,330);
        path('D1:b',common,elbow(130,330),'V1:n');
        ground(common,520,375);
      }else{
        place('D1',285,145);place('R1',filter?570:465,230,{rotation:90});
        const input=elbow(130,145);
        path('V1:p',input,'D1:a');
        const xR=parts.get('R1').x;
        const top=filter?tee(xR,145):elbow(xR,145),bottom=tee(xR,330);
        const bottomLeft=elbow(130,330);
        path('V1:n',bottomLeft);path('R1:a',top);
        path('R1:b',bottom);ground(bottom,xR,375);
        if(filter){
          place('C1',425,230,{rotation:90,schematicPolarized:true});
          const capTop=tee(425,145),capBottom=tee(425,330);
          path('D1:b',capTop,top);path(bottomLeft,capBottom,bottom);
          path(capTop,'C1:a');path('C1:b',capBottom);
          if(external){
            place('RL',725,230,{rotation:90});
            path(top,elbow(725,145),'RL:a');path(bottom,elbow(725,330),'RL:b');
          }
        }else{
          path('D1:b',top);path(bottomLeft,bottom);
        }
        probes.input=input;
      }
    }else if(type==='mos-iv'){
      place('V1',140,300);place('RG',270,215);place('M1',465,215);place('VDD',665,215);
      path('V1:p',elbow(140,215),'RG:a');
      if(parts.has('RM')){
        place('RM',370,320,{rotation:90});
        const gate=tee(370,215);
        path('RG:b',gate,'M1:g');path(gate,'RM:a');ground('RM:b',370,420);
      }else path('RG:b','M1:g');
      path('M1:d',elbow(489,125),elbow(665,125),'VDD:p');
      ground('V1:n',140,400);ground('M1:s',489,360);ground('VDD:n',665,315);
    }else if(type==='mos-amplifier'){
      place('V1',140,285);place('VG',140,465);place('RG',280,380);place('C1',280,200);
      place('M1',500,305);place('RD',524,130,{rotation:90});place('VDD',805,125);place('C2',665,220);
      const gate=tee(390,305),drain=tee(524,220);
      path('V1:p',elbow(140,200),'C1:a');path('C1:b',elbow(390,200),gate,'M1:g');
      path('VG:p',elbow(140,380),'RG:a');path('RG:b',elbow(390,380),gate);
      path('M1:d',drain,'RD:b');path(drain,'C2:a');
      path('RD:a',elbow(524,55),elbow(805,55),'VDD:p');
      ground('V1:n',140,350);ground('VG:n',140,555);ground('M1:s',524,405);ground('VDD:n',805,190);
      if(parts.has('RL')){
        place('RL',825,315,{rotation:90});
        path('C2:b',elbow(825,220),'RL:a');ground('RL:b',825,420);
      }else path('C2:b',elbow(765,220));
    }else{
      const cmos=type==='cmos-inverter',nand=type==='nmos-nand',nor=type==='nmos-nor';
      place('V1',155,nand?435:355);
      place('M1',465,nand?385:305);
      place('VDD',700,135);
      const gateY=parts.get('M1').y;
      const gate=elbow(155,gateY);
      path('V1:p',gate);ground('V1:n',155,parts.get('V1').y+100);
      ground('M1:s',489,gateY+105);ground('VDD:n',700,232);
      if(cmos){
        place('M2',465,150,{rotation:0,schematicFlipY:true});
        const input=tee(335,gateY);
        path(gate,input,'M1:g');path(input,elbow(335,150),'M2:g');
        path('M2:s',elbow(489,70),elbow(700,70),'VDD:p');
        const output=tee(489,228);
        path('M2:d',output,'M1:d');const end=elbow(570,228);path(output,end);probes.output=end;
      }else{
        path(gate,'M1:g');
        place('RD',489,130,{rotation:90});
        path('RD:a',elbow(489,65),elbow(700,65),'VDD:p');
        const output=tee(489,nand?189:220);
        path('RD:b',output,nand?'M3:d':'M1:d');
        const end=elbow(565,parts.get('RD').y+(nand?59:90));
        path(output,end);probes.output=end;
        if(nand){
          place('M3',465,248);place('V2',265,275);
          path('M3:s','M1:d');path('V2:p',elbow(265,248),'M3:g');ground('V2:n',265,351);
        }
        if(nor){
          place('M3',665,305,{schematicFlipX:true});place('V2',870,355);
          path(end,elbow(641,220),'M3:d');ground('M3:s',641,410);
          path('V2:p',elbow(870,305),'M3:g');ground('V2:n',870,455);
        }
      }
      if(nand||nor)doc.sheetProbes={'IN1':'V1:p','IN2':'V2:p',OUT:probes.output};
    }
    doc.probes=probes;
    return doc;
  }

  const hasModelDetails=(doc,type)=>Boolean(doc.benchSetup||doc.components.some(c=>['Rref','Rleak','Jout'].includes(c.id)||c.id==='RL'&&(type==='cmos-inverter'||type==='mos-amplifier'&&c.value===10e6)));
  return {layout,hasModelDetails};
});
