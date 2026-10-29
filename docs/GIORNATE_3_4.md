# Giornate 3 e 4 · catena elettronica

Il catalogo delle quattro giornate comprende sette circuiti dedicati al preamplificatore, al formatore e alla catena elettronica completa. Ogni circuito mantiene componenti modificabili, schema, breadboard, analisi, prove guidate e salvataggio della sessione.

## Circuiti e prove

| Giornata | Circuito | Situazioni selezionabili |
| --- | --- | --- |
| 3 | Preamplificatore di carica | Impulsi da 2, 5 e 10 µs; linearità in carica; Bode |
| 3 | Shaper CR–RC | Gradino 0–1 V; Bode; carico con cavi diretti o sonde ×10 |
| 3 | Shaper con buffer di uscita | Buffer inserito/disinserito; Bode; carico diretto |
| 4 | Preamp + shaper senza compensazione | Impulsi da 5 e 10 µs; undershoot; Bode |
| 4 | Shaper compensato | Rpz calcolata, disinserita, dimezzata o raddoppiata; shaping rapido; Bode |
| 4 | Amplificatore non invertente | Senza bias, con bias, saturazione, VTC, Bode |
| 4 | Catena completa | Impulsi da 0,5, 5 e 10 µs; dimensionamento finale; linearità in carica; shaping rapido; Bode |

I componenti iniziali sono esempi: Rin = 100 kΩ, Rf_pre = 1 MΩ, Cf_pre = 200 pF, Rsh1/2 = 10 kΩ e Csh1/2 = 2,2 nF. Il riferimento nominale è τpre = 200 µs. Inserire i valori assegnati e misurati dal proprio gruppo. Quando si apre un nuovo circuito, i blocchi comuni riprendono i componenti già presenti nella sessione; i circuiti già creati mantengono le rispettive impostazioni.

Nel pannello Segnali l’impulso ha livelli, durata, periodo, ritardo e tempi dei fronti modificabili. La durata automatica mostra il transitorio utile; disattivarla per scegliere un’altra finestra. Le misure dei picchi sono riferite alla baseline. Il montaggio reale comprende generatore, sonde e oscilloscopio; per le misure della scheda usare l’accoppiamento DC.

## Linearità in carica

Preamplificatore e catene con preamplificatore offrono Linearità · Q. La scansione usa impulsi negativi isolati con riposo 0 V, fronti istantanei e ritardo 20 µs. Il livello attivo è il valore assoluto del livello corrente, con segno negativo. Le durate e il numero di impulsi si modificano in Analisi. Qin = |Vin|·T/Rin è il riferimento nominale con ingresso a massa virtuale; non è una misura della carica effettiva in presenza di limiti o impedenze aggiuntive.

Il grafico confronta i picchi rispetto alla baseline con un fit lineare non pesato. Il CSV contiene Qin_C, Vout_picco_V, T_s, baseline_V, fit_V e residuo_V. Nessuna incertezza sperimentale è assegnata ai dati simulati. La relazione conserva le condizioni della scansione; il JSON guidato permette di riprenderla. Nei transitori il CSV include anche PRE e SHAPER quando presenti.

## Compensazione e stadio finale

Rpz attesa = Rf_pre·Cf_pre/Csh1. Con Rpz inserita il primo tempo è (Rsh1 ∥ Rpz)·Csh1. Le formule nominali assumono operazionali ideali; il modello predefinito include banda e saturazione. È selezionabile anche il modello fisico semplificato già usato dal progetto.

Senza bias: G = 1 + Rgain/Ri. Con bias: G = 1 + Rgain/Ri + Rgain/Rbias e baseline = −Vref·Rgain/Rbias. Il riferimento è una sorgente DC separata da 5 V. Nella catena i preset dimensionano il guadagno dal massimo simulato dello shaper con impulso da 10 µs, per un’escursione finale di 3 V oppure 1,8 V con baseline −0,9 V. Se i parametri cambiano, riselezionare il preset per ridimensionare lo stadio finale.

## Verifiche

Le verifiche automatiche includono soluzione esponenziale del preamplificatore con impulso finito, risposta t/τ·exp(−t/τ) dello shaper, trasferimento complesso della rete compensata, carico dell’oscilloscopio con/senza buffer, obiettivi DAQ, modello fisico, worker, CSV/relazioni e salvataggio/riapertura. I confronti ngspice preesistenti sono stati rieseguiti sui sorgenti aggiornati. I circuiti del banco restano limitati a 40 componenti di base; le reti generate con gli strumenti ammettono fino a 120 componenti complessivi.
