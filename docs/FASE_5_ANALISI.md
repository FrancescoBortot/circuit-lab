# Analisi e grandezze fisiche

La fase 5 aggiunge punto DC, scansione DC, griglie e fasori AC, PULSE/PWL, RL/RLC, correnti/potenze/energie. I dettagli e i limiti sono nel registro `PROBLEMATICHE_E_AVANZAMENTO.md`.

Riproduzione locale:

```sh
node app/scripts/benchmark-math.cjs
node app/scripts/benchmark-spice.cjs
node app/scripts/benchmark-opamp.cjs
node app/scripts/benchmark-analyses.cjs
node --test app/tests/*.test.cjs
python3 app/scripts/build-offline.py
```

Il riferimento indipendente usa esclusivamente ngspice 47 compilato in `app/.tools/`. La simulazione e i benchmark non aprono connessioni. I report conservano hash SHA-256 e dati/log. I modelli U sono comportamentali generici, non chip commerciali certificati.

La netlist usata dai nuovi confronti è un esportatore di dati: nessuna direttiva viene eseguita dall’app. La sua integrazione di import/export nell’interfaccia appartiene alla fase 6.
