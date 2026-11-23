const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../student-tools'),D=require('../comparison-data');
test('CSV hints are proposals with explicit columns and units, preserving the original table',()=>{const raw='tempo_ms;Vout_mV;u_mV\n0;0;1\n1;2;1',h=T.columnHints(raw.split('\n')[0].split(';'),'time');assert.equal(h.xColumn,0);assert.equal(h.yColumn,1);assert.equal(h.xUnit,'ms');assert.equal(h.yUnit,'mV');assert.equal(h.sigmaColumn,2);const parsed=D.parse(raw,{delimiter:';',xUnit:h.xUnit,yUnit:h.yUnit,sigmaColumn:h.sigmaColumn});assert.equal(parsed.raw,raw);assert.equal(parsed.points[1].x,.001);assert.equal(parsed.points[1].y,.002);const ac=T.columnHints(['freq_kHz','gain_dB','fase_deg'],'bode');assert.equal(ac.xUnit,'kHz');assert.equal(ac.yUnit,'dB');assert.equal(ac.phaseColumn,2);});

test('CSV unit hints never confuse milli and mega prefixes',()=>{assert.equal(T.columnHints(['freq_mHz','gain_dB'],'bode').xUnit,undefined);assert.equal(T.columnHints(['tempo_Ms','Vout_MV'],'time').xUnit,undefined);assert.equal(T.columnHints(['tempo_ms','Vout_MV'],'time').yUnit,undefined);assert.equal(T.columnHints(['freq_MHz','gain_dB'],'bode').xUnit,'MHz');});

test('semiconductor and Bode examples infer the documented current and gain units',()=>{
 for(const [kind,headers,expected] of [
  ['diodeIV',['VD_V','ID_mA','u_ID_mA'],[0,1,2,'V','mA']],
  ['mosOutput',['u_ID_mA','ID_mA','V_DS_mV'],[2,1,0,'mV','mA']],
  ['mosTransfer',['VDS_V','V_GS_V','ID_uA'],[1,2,null,'V','µA']],
  ['bode',['frequenza_Hz','guadagno_V_V','u_guadagno_V_V','fase_deg'],[0,1,2,'Hz','V/V']]
 ]){
  const {xColumn,yColumn,sigmaColumn,xUnit,yUnit}=T.columnHints(headers,kind);
  assert.deepEqual([xColumn,yColumn,sigmaColumn,xUnit,yUnit],expected,kind);
 }
 const raw='VD_V,ID_mA,u_ID_mA\n0.4,0.001,0.0002\n0.5,0.012,0.002';
 const {points}=D.parse(raw,{kind:'diodeIV',...T.columnHints(raw.split('\n')[0].split(','),'diodeIV')});
 assert.equal(points[0].x,.4);
 assert.equal(points[0].y,1e-6);
 assert.ok(Math.abs(points[0].sigma-2e-7)<1e-18);
});
