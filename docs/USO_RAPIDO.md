# Circuit Lab · guida rapida

Apri [Circuit Lab online](https://francescobortot.github.io/circuit-lab/), oppure estrai lo ZIP offline e apri `Circuit Lab.html` nel browser. Se hai scaricato i sorgenti, usa `app/dist/Circuit Lab.html`. Il file HTML include codice, stili e worker. Slide e schede di laboratorio non fanno parte del pacchetto. Non richiede account, installazione o Internet. I calcoli non inviano dati.

1. **Esperienze guidate**: scegli RC, invertente, derivatore o differenze; modifica componenti e strumenti cliccandoli o dal pannello a destra.
2. **Circuito da zero**: “Nuovo circuito”, aggiungi componenti, collega i terminali, massa e OUT. Rotella/pulsanti per zoom, trascina lo sfondo per spostarti. Gli incroci fra fili non creano connessioni.
3. **Simulazione**: Transitorio, Bode, Punto DC o Scansione DC. Le impostazioni si modificano nella scheda Simulazione; le sorgenti hanno polarizzazione DC separata dal segnale nel tempo.
4. **Misure**: sonde, cursori A/B, correnti, potenze ed energie. I pannelli RC e Operazionali importano dati sperimentali e mostrano fit/residui con ipotesi esplicite.
5. **Quaderno**: Progetto e copie → Dati, incertezze, relazione e archivio. Modifica i punti in tabella, salva, poi calcola il bilancio. Correzioni e contributi comuni rimangono distinti dai fit precedenti.
6. **Variazioni**: Progetto e copie → Scansioni e tolleranze. Scegli parametro/misura/distribuzione/seme; controlla anche le prove non riuscite. I risultati descrivono dispersione dei componenti, non incertezza sperimentale.
7. **Conserva il lavoro**: scarica JSON o ZIP. La memoria del browser dipende dalla posizione dell’app e può essere cancellata. La relazione HTML si stampa anche come PDF; schema e grafici sono esportabili in SVG.

Gli esempi si trovano in “Parti da un esempio”. Diodi/BJT/MOS hanno modelli didattici a 27 °C con parametri e limiti visibili, non sono chip commerciali certificati.

## Sessioni e prove guidate

1. Scrivi il **nome della sessione** nel campo in alto. Su telefono apri le opzioni **⌄ accanto a Salva** e modifica il nome nel pannello.
2. Scegli un circuito e una **Prova guidata**. Il suo nome resta sopra lo schema anche cambiando pannello. **Personalizzata** indica parametri o analisi diversi dalla selezione iniziale. **Nessuna prova guidata** rimuove l’etichetta senza azzerare il circuito.
3. Le prove vengono conservate nel browser, con l’ultima versione di ciascuna combinazione sessione/circuito/prova. Le opzioni **⌄ → Prove salvate** permettono di riaprirle. Le versioni successive della stessa prova aggiornano la copia; per tenerle in sessioni distinte usa **Altre sessioni e nuova sessione → Inizia**. La nuova sessione parte dai parametri correnti senza modificare le sessioni precedenti.
4. Premi **Salva sessione** per scaricare lo ZIP completo. Contiene una cartella della sessione, identificata anche da un codice breve, e sottocartelle dei circuiti. Ogni nome include **sessione + circuito + prova**. JSON, schema SVG e relazione HTML sono sempre inclusi; CSV e grafici corrispondono alle analisi già calcolate con quei parametri. Una modifica elettrica esclude i risultati precedenti finché non sono ricalcolati.
5. Nei browser compatibili, **Scegli cartella…** collega una destinazione locale: poi **Salva sessione** crea le cartelle e scrive i file. La scelta non esporta nulla finché non premi Salva. Il collegamento vale per l’apertura corrente dell’app. Negli altri browser estrai lo ZIP per ottenere la stessa struttura. Rinominare la sessione genera un nuovo percorso; i vecchi file non vengono cancellati.

Per riaprire una prova da file, estrai lo ZIP e scegli il suo **JSON** con **Apri**. Il manifesto `sessione.json` elenca le prove e non sostituisce i loro progetti. L’importazione dell’intero ZIP di sessione non è prevista. Il salvataggio dell’editor libero resta in **Progetto e copie**.

Lo schema usa più spazio verticale: titolo e nome della prova sono nella sua barra, giornata e descrizione sono nella colonna dei circuiti. La barra tra schema e grafico continua a regolarne l’altezza.

## A cosa serve Analisi

Nelle esperienze guidate apri **Analisi → Che cosa vuoi studiare?**. La scelta aggiorna il grafico e mostra soltanto i relativi controlli:

- **Tempo · Transitorio:** forme d’onda e carica/scarica RC. **Tempo visualizzato** stabilisce la finestra del grafico; disattiva **Durata automatica** per impostarla. I punti minimi sono in **Risoluzione del grafico**.
- **Frequenza · Bode:** guadagno e fase al variare della frequenza, per filtri e banda passante. Scegli frequenza minima e massima; il menu sopra il grafico passa tra modulo in dB e fase in gradi. Il rapporto RC è Vout/V₁, dopo la resistenza del generatore.
- **Ampiezza · VTC**, per gli amplificatori: uscita in Vpp al variare dell’ampiezza sinusoidale d’ingresso, a frequenza fissa. Utile per linearità e saturazione. Offset e frequenza si impostano nella stessa sezione; numero di ampiezze e metodo di calcolo sono in **Risoluzione e calcolo**.

**Come leggere il grafico** spiega assi, curve e riferimento. Nell’amplificatore delle differenze puoi scegliere quale ingresso confrontare con OUT per Bode e VTC; gli ingressi del Transitorio si impostano in **Segnali**. Anche le schede sopra il grafico cambiano analisi e restano sincronizzate con il selettore.

In fondo, **Hai misure di laboratorio?** apre gli strumenti per importare dati e confrontarli con il modello. Il pulsante degli operazionali mostra **Misure operazionali** e **VTC · banda · CMRR** su due righe. In Analisi il riepilogo dei risultati scorre con il contenuto, lasciando più spazio ai controlli. Cambiare sezione riporta il pannello all’inizio; gli errori nei parametri restano visibili e vanno corretti prima di cambiare analisi.

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

## Dalla RC alla relazione

1. Scegli RC nelle esperienze guidate oppure nell’editor libero. Seleziona R o C e apri la spiegazione per prevedere come cambierà la risposta. La formula R·C viene distinta dagli effetti degli strumenti.
2. Premi **Misura τ**. Scegli **Simulazione** oppure **Dati sperimentali**; gli esempi sintetici sono identificati come tali. Seleziona un tratto di sola carica o scarica e premi **Calcola il fit**.
3. Controlla τ, residui e ipotesi. Un errore o una modifica delle impostazioni disabilita la prosecuzione fino al ricalcolo.
4. Con dati importati, **Bilancio e relazione →** apre il quaderno sulla stessa tabella RC. Dichiara i contributi disponibili e calcola il bilancio. Con campioni simulati, **Relazione →** porta direttamente ai file senza assegnare incertezze sperimentali al fit.
5. In **Relazione e file**, apri l’anteprima e poi scarica HTML o ZIP. Il documento include curva RC, fit, residui e parametri; il pacchetto contiene anche `rc-misure.csv` e `rc-dati-residui.csv`. **Torna al fit RC** rilegge lo studio salvato e ricalcola, così le modifiche alla tabella vengono recepite.

Le incertezze del fit con tempi assunti esatti e il bilancio con contributi aggiuntivi sono risultati distinti. Il report ricalcola il fit dai dati e dalle impostazioni salvate; una curva simulata richiede un contesto elettrico attuale. Se manca, invita a riaprire Misura τ anziché allegare risultati superati. Lo scambio SPICE è raccolto in una sezione avanzata chiusa.

Esempio completo con dati sintetici: dalla radice del repository esegui `node app/scripts/check-rc-workflow.cjs`. Il comando genera in locale `app/benchmark/rc-workflow/relazione.html` e `laboratorio.zip`; questi risultati non sono inclusi nel download del codice. La verifica del contenuto dei file è distinta dal collaudo del loro download nel browser nativo.

I test automatici e i rapporti dei confronti numerici sono inclusi nel repository. Per i comandi e i limiti generali leggi il [README](../README.md). Prova apertura, simulazione, download e riapertura del progetto nel tuo browser prima di affidarti alla memoria automatica.
