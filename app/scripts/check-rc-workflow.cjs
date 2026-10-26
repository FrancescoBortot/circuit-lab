/* Reproducible local demonstration. These are synthetic observations, never
   represented as a physical laboratory measurement. No external tools/network. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const F=require('../lab-files.js'),R=require('../rc-analysis.js'),M=require('../free-model.js'),C=require('../study-context.js'),X=require('../metrology.js'),N=require('../spice-netlist.js');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'benchmark/rc-workflow');
const doc=M.parse(fs.readFileSync(path.join(root,'esempi/rc-tempo-e-frequenza.json'),'utf8'));
doc.name='RC · verifica con dati sintetici';doc.rcStudy.stamp=C.stamp(doc);
doc.metrologyStudy={...X.defaults(),kind:'rc',stamp:C.stamp(doc),note:'Dati sintetici dimostrativi. Nessuna misura fisica. Contributi aggiuntivi nulli: il bilancio considera le u(V) dichiarate nei punti.'};
const context=C.build(M.serialize(doc)),simulation=M.simulate(doc),budget=X.analyze(doc,doc.metrologyStudy),fit=F.rcResults(doc,context);
assert.ok(!fit.error,fit.error);assert.ok(Math.abs(fit.fit.tau/.001-1)<.01);assert.ok(fit.fit.uTau>0);
const options={date:'2026-10-26 · collaudo riproducibile',rcContext:context,simulation,budget,netlist:N.exportText(doc).text};
const archive=F.archive(doc,options),entries=F.unzip(archive),html=F.report(doc,options);
assert.deepEqual(M.parse(F.projectFromArchive(archive)),doc);
assert.match(html,/Fit RC · dati importati/);assert.match(html,/Bilancio metrologico/);assert.match(html,/Residui · dati − fit/);
assert.ok(entries['rc-misure.csv']&&entries['rc-dati-residui.csv']&&entries['bilancio.csv']);
const rows=R.rows(new TextDecoder().decode(entries['rc-dati-residui.csv']),',').rows;assert.equal(rows.length,fit.fit.count+1);
fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,'relazione.html'),html);fs.writeFileSync(path.join(destination,'laboratorio.zip'),archive);fs.writeFileSync(path.join(destination,'progetto.json'),M.serialize(doc));
for(const name of ['rc-misure.csv','rc-dati-residui.csv','bilancio.csv'])fs.writeFileSync(path.join(destination,name),entries[name]);
const result={source:'synthetic demonstration, no physical measurements',tauSeconds:fit.fit.tau,uTauSeconds:fit.fit.uTau,points:fit.fit.count,archiveEntries:Object.keys(entries),projectReopensExactly:true,completeResiduals:true};
fs.writeFileSync(path.join(destination,'verifica.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(destination,'LEGGIMI.txt'),'Collaudo RC con dati sintetici. Apri relazione.html per leggere schema, fit, residui e bilancio. laboratorio.zip contiene progetto.json e tutti i CSV. Nessuna misura fisica e nessuna connessione esterna. Questa verifica controlla i file generati e la riapertura del loro contenuto; non certifica il download del browser.\n');
console.log(JSON.stringify(result,null,2));
