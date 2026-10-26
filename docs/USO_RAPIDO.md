# Circuit Lab · uso locale

Apri con doppio clic `app/Apri versione portabile.command`, oppure `app/dist/Circuit Lab.html` nel browser. Il file HTML include codice, stili e worker. Slide e schede di laboratorio non fanno parte del pacchetto. Non richiede account, installazione o Internet. I calcoli non inviano dati.

1. **Esperienze guidate**: scegli RC, invertente, derivatore o differenze; modifica componenti e strumenti cliccandoli o dal pannello a destra.
2. **Circuito da zero**: “Nuovo circuito”, aggiungi componenti, collega i terminali, massa e OUT. Rotella/pulsanti per zoom, trascina lo sfondo per spostarti. Gli incroci fra fili non creano connessioni.
3. **Simulazione**: Transitorio, Bode, Punto DC o Scansione DC. Le impostazioni si modificano nella scheda Simulazione; le sorgenti hanno polarizzazione DC separata dal segnale nel tempo.
4. **Misure**: sonde, cursori A/B, correnti, potenze ed energie. I pannelli RC e Operazionali importano dati sperimentali e mostrano fit/residui con ipotesi esplicite.
5. **Quaderno**: Progetto e copie → Dati, incertezze, relazione e archivio. Modifica i punti in tabella, salva, poi calcola il bilancio. Correzioni e contributi comuni rimangono distinti dai fit precedenti.
6. **Variazioni**: Progetto e copie → Scansioni e tolleranze. Scegli parametro/misura/distribuzione/seme; controlla anche le prove non riuscite. I risultati descrivono dispersione dei componenti, non incertezza sperimentale.
7. **Conserva il lavoro**: scarica JSON o ZIP. La memoria del browser dipende dalla posizione dell’app e può essere cancellata. La relazione HTML si stampa anche come PDF; schema e grafici sono esportabili in SVG.

Gli esempi si trovano in “Parti da un esempio”. Diodi/BJT/MOS hanno modelli didattici a 27 °C con parametri e limiti visibili, non sono chip commerciali certificati.

## Percorso consigliato per studiare

Apri un’esperienza guidata o un esempio, fai una prima simulazione e modifica un solo componente alla volta. Prima prevedi il cambiamento, poi confronta le curve e misura con i cursori. Conserva circuito e impostazioni nel JSON.

Nel raddrizzatore con filtro RC: scegli **Transitorio**, IN sul positivo di V1 e OUT sul nodo comune a catodo di D1, R1 e C1. A 50 Hz un periodo dura 20 ms: 80 ms mostrano quattro periodi. Premi **Simula**; confronta la sinusoide IN con OUT e osserva la scarica tra due picchi. Prova poi un altro valore di C1, mantenendo gli altri parametri.

Il pannello **Simulazione** mostra prima i segnali e l’intervallo di osservazione. Le sezioni apribili distinguono:

- **Precisione del calcolo:** punti, metodo e confronto numerico su una griglia più fitta.
- **Confronti e dati sperimentali:** variazioni dei componenti, Monte Carlo delle tolleranze, misure e relazione.
- **Nomi dei nodi:** etichette personali; non creano collegamenti elettrici.
- **Modelli e limiti:** ipotesi fisiche adottate.
- **Energia e riferimenti teorici:** bilancio energetico e grandezze derivate, quando disponibili.

“Aggiorna da solo” ricalcola dopo le modifiche. “Dati parziali · dettagli” spiega eventuali campioni di corrente non disponibili; gli errori che impediscono il calcolo restano visibili. La guida in basso spiega anche i quattro tipi di analisi.

I test automatici e i rapporti dei confronti numerici sono inclusi nel repository. Per i comandi e i limiti generali leggi il [README](../README.md). Prova apertura, simulazione, download e riapertura del progetto nel tuo browser prima di affidarti alla memoria automatica.
