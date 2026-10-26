# Analisi RC: dal transitorio al confronto con i dati

Apri **Analisi RC**, sopra il grafico, oppure **Analisi RC · tempo e frequenza** nelle proprietà. Il pannello è disponibile nell’esperienza RC e nei circuiti liberi con condensatori. Tutti i calcoli e la lettura dei file avvengono sul dispositivo, anche offline.

## Percorso essenziale

1. Scegli **Simulazione** e un tratto di carica o scarica, oppure **Dati sperimentali**.
2. Per dati propri, apri **Inserisci o apri dati CSV**. Puoi scegliere un file o incollare righe con tempo e tensione, eventualmente u(V). Imposta colonne, unità, intestazione e separatore; premi **Controlla e usa questi dati**. **Prova un esempio** carica soltanto dati sintetici, identificati come dimostrazione.
3. Scegli l’intervallo e il metodo. **Fit delle tensioni** può stimare il valore finale o usare un valore noto. **Retta dei logaritmi** richiede il valore finale noto.
4. Inserisci eventuali incertezze standard e R/C del confronto. Premi **Calcola il fit**: risultati, curva e residui vengono aggiornati insieme. Su telefono il pannello scorre ai risultati; **↑ Modifica impostazioni** riporta ai campi.
5. Conserva il progetto da **Progetto e copie**. Il JSON include osservazioni originali, testo importato, unità, formato e impostazioni; i risultati sono ricalcolati alla riapertura. Il pannello offre CSV delle misure, CSV dei punti/residui e SVG della curva corrente.

Sono richiesti almeno sei punti originali nell’intervallo. Non si aumentano artificialmente le osservazioni interpolando il grafico. I fronti della simulazione delimitano tratti separati; una singola esponenziale non deve attraversare una commutazione.

## Modelli e incertezze

Il modello è **V(t) = V∞ + A exp[−(t−t₀)/τ]**, con t₀ al primo campione selezionato. Il fit delle tensioni minimizza gli scarti sulle tensioni; per ogni τ risolve A e, se richiesto, V∞ con una regressione lineare pesata. La ricerca di τ avviene in scala logaritmica. Intervalli troppo corti e soluzioni poco identificabili producono avvisi o errori espliciti.

Il metodo logaritmico adatta una retta a **ln(|V−V∞| / 1 V)**; rifiuta zeri e cambi di segno rispetto a V∞. Con incertezze usa u(log V) ≈ u(V)/|V−V∞|: vicino all’asintoto questa approssimazione può diventare inadeguata. Cambiare la sola **Vista logaritmica** modifica il grafico, non il metodo del fit.

Le u(V) possono essere una colonna del CSV o un valore comune. Sono trattate come incertezze standard assolute di osservazioni indipendenti. I tempi sono assunti esatti. Le incertezze dei parametri derivano dalla matrice del modello linearizzato; non vengono riscalate per forzare χ²/ν = 1. Senza u(V), il programma riporta il fit e gli scarti ma non inventa u(τ). Ai campioni della simulazione non viene assegnata un’incertezza sperimentale.

RMS e R² descrivono gli scarti; non certificano il modello fisico. Per dati sperimentali con u(V) sono disponibili χ²/ν e i gradi di libertà. Non sono inclusi errori sui tempi, correlazioni fra punti, bilanci sistematici o incertezza del valore finale quando fissato. Con V∞ stimato, le barre logaritmiche non sono riportate: la trasformazione dipende da un parametro correlato alle osservazioni.

## Confronto tra metodi

La tabella distingue τ = R·C, τ del fit, τ dalla soglia 1/e, taglio della simulazione e τ equivalente = 1/(2πfc). La soglia usa il valore finale scelto: se stimato dal fit, i due risultati sono correlati. L’attraversamento è interpolato fra i punti, senza estrapolare. Se manca, compare “—”.

Il taglio è il primo attraversamento discendente a −3,0103 dB dal guadagno DC dichiarato. È calcolato dal Bode della **simulazione corrente**, non dalle misure AC: per importarle usa **Frequenza · Bode**, descritto in ANALISI_FREQUENZA.md. Nell’esperienza guidata il rapporto è Vout/V₁ dopo Rg, mentre il transitorio è eccitato da Vg. Carico strumentale, resistenza del generatore e reti con più poli possono quindi produrre costanti differenti. Nel foglio libero il riconoscimento automatico di R·C è limitato alla topologia semplice verificata; per altre reti il confronto richiede valori espliciti.

u(R·C) = √[(C uR)² + (R uC)²] richiede indipendenza. Lo scarto normalizzato rispetto al fit viene mostrato solo con le incertezze necessarie e l’ipotesi esplicita di indipendenza di R, C e fit. Non sostituisce un bilancio delle incertezze o una valutazione automatica di compatibilità.

La sovrapposizione sperimentale può traslare soltanto la simulazione di Δt e ΔV, dichiarati. I dati originali restano invariati; fuori dall’intervallo simulato non viene effettuata estrapolazione. Non è ancora prevista una correzione del fattore della sonda.

## Formati ed esempi

CSV: massimo 200 kB e 4 000 punti, delimitatore virgola/punto e virgola/tab, decimale punto o virgola con scelta non ambigua, tempi in s/ms/µs e tensioni in V/mV. Le righe devono avere le stesse colonne e tempi strettamente crescenti: duplicati, formule e numeri non validi vengono segnalati senza riordinare o scartare dati in silenzio. Un’importazione non valida conserva il dataset precedente.

- `app/esempi/rc-scarica-dimostrativa.csv`: undici punti sintetici, τ generativa di 1 ms, offset 0,2 V e u(V) dichiarata di 10 mV. La perturbazione è deterministica e dimostrativa, non una realizzazione casuale con distribuzione certificata.
- `app/esempi/rc-con-fit-dimostrativo.json`: contenuto portabile preparato dal pannello del progetto, con circuito, due sonde e gli stessi dati. È stato riaperto dall’interfaccia tramite testo JSON; non è una prova del download del browser.

## Verifiche e riferimenti

Il blocco temporale aggiungeva 24 test. La suite corrente conta 122 test, inclusa l’analisi AC. Include esponenziali note di carica/scarica con offset, pesatura, covarianza verificata con una formula indipendente, regressione logaritmica contro OLS indipendente, soglia, taglio, formati e round-trip. Le prove dell’interfaccia e i limiti del collaudo sono registrati in `VERIFICHE.md`.

Riferimenti metodologici consultati: [NIST, least squares](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm) e [SciPy, curve_fit: sigma assolute e covarianza locale](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.curve_fit.html). L’implementazione non dipende da SciPy e non è stata confrontata eseguendo SciPy.
