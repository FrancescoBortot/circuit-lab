Aggiornamento della fase 7: il parser ora accetta anche il sottoinsieme numerico D/Q/M a 27 °C, rifiutando parametri non rappresentati. Per i dettagli correnti leggere `FASE_7_TOLLERANZE_E_DISPOSITIVI.md`. Il testo seguente documenta il checkpoint della fase 6.

# Quaderno sperimentale e file locali

Accesso: Progetto e copie → Dati, incertezze, relazione e archivio.

I pannelli Tempo/Frequenza/Operazionali mantengono le proprie ipotesi. Il quaderno aggiunge un bilancio con correzioni e correlazioni esplicite, salvate in `metrologyStudy`. Le u sono standard k=1; nessun intervallo di copertura viene dedotto automaticamente. Le incertezze comuni non sono trattate come rumore indipendente ad ogni punto.

La propagazione segue la forma con covarianze del [JCGM 100:2008, §5.2](https://www.bipm.org/documents/20126/2071204/JCGM_100_2008_E.pdf). Non è una certificazione metrologica: identificabilità, linearizzazione e completezza dei contributi devono essere valutate per l’esperimento.

Le tabelle modificabili conservano raw e originalPoints nel JSON. L’HTML della relazione è statico, offline e stampabile; lo ZIP usa CRC32 per rilevare corruzioni accidentali, non una firma di autenticità. Supportati solo archivi Circuit Lab non compressi fino a 8 MB. Nessun file viene estratto su percorsi del computer: il JSON viene validato in memoria prima dell’apertura.

Le netlist sono dati. Importazione volutamente limitata R/C/L/V/I; i modelli U comportamentali possono essere esportati verso ngspice, ma non reimportati tramite espressioni. Per lo scambio completo usare JSON/ZIP. Il parser non esegue direttive, non legge include e non carica librerie.

Verifiche e limiti nel registro `PROBLEMATICHE_E_AVANZAMENTO.md`. Test: `node --test app/tests/*.test.cjs`. Esempio di relazione e ZIP in `app/benchmark/phase6-demo/`.
