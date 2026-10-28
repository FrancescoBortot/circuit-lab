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

Per riaprire una prova da file, estrai lo ZIP e scegli il suo **JSON** con **Apri**. Il manifesto `sessione.json` elenca le prove e non sostituisce i loro progetti. Per riaprire tutto lo ZIP usa **Versioni → Riapri ZIP di sessione**: viene creata una nuova copia, senza sovrascrivere la sessione precedente; le analisi vengono ricalcolate. Il salvataggio dell’editor libero resta in **Progetto e copie**.

Lo schema usa più spazio verticale: titolo e nome della prova sono nella sua barra, giornata e descrizione sono nella colonna dei circuiti. La barra tra schema e grafico continua a regolarne l’altezza.

Per togliere l’evidenziazione di un componente, **clicca sullo sfondo dello schema oppure premi Esc**. Vale anche per l’editor libero, dove Esc interrompe anche un collegamento iniziato. Deselezionare conserva i valori validi modificati; interrompere un trascinamento ripristina la posizione precedente. Nell’editor libero un valore non valido resta da correggere prima di chiudere la sua modifica, così non viene perso.

## A cosa serve Analisi

Nelle esperienze guidate apri **Analisi → Che cosa vuoi studiare?**. La scelta aggiorna il grafico e mostra soltanto i relativi controlli:

- **Tempo · Transitorio:** forme d’onda e carica/scarica RC. **Tempo visualizzato** stabilisce la finestra del grafico; disattiva **Durata automatica** per impostarla. I punti minimi sono in **Risoluzione del grafico**.
- **Frequenza · Bode:** guadagno e fase al variare della frequenza, per filtri e banda passante. Scegli frequenza minima e massima; il menu sopra il grafico passa tra modulo in dB e fase in gradi. Il rapporto RC è Vout/V₁, dopo la resistenza del generatore.
- **Ampiezza · VTC**, per gli amplificatori: uscita in Vpp al variare dell’ampiezza sinusoidale d’ingresso, a frequenza fissa. Utile per linearità e saturazione. Offset e frequenza si impostano nella stessa sezione; numero di ampiezze e metodo di calcolo sono in **Risoluzione e calcolo**.

**Come leggere il grafico** spiega assi, curve e riferimento. Nell’amplificatore delle differenze puoi scegliere quale ingresso confrontare con OUT per Bode e VTC; gli ingressi del Transitorio si impostano in **Segnali**. Anche le schede sopra il grafico cambiano analisi e restano sincronizzate con il selettore.

In fondo, **Hai misure di laboratorio?** apre gli strumenti per importare dati e confrontarli con il modello. Il pulsante degli operazionali mostra **Misure operazionali** e **VTC · banda · CMRR** su due righe. In Analisi il riepilogo dei risultati scorre con il contenuto, lasciando più spazio ai controlli. Cambiare sezione riporta il pannello all’inizio; gli errori nei parametri restano visibili e vanno corretti prima di cambiare analisi.

## Leggere le curve con calma

La legenda distingue **Ingresso · V₁** (tratteggio) e **Uscita · OUT** (linea continua); i campioni di linea hanno gli stessi colori e tratteggi del grafico. Un clic nasconde o mostra la curva; il nome barrato indica una curva nascosta. Deve restarne visibile almeno una. Nell’editor libero le etichette principali sono **Ingresso · IN** e **Uscita · OUT**.

Nel **Transitorio guidato**, **Riproduci** sposta il cursore dell’1% dell’intervallo visibile per passo, lasciando i numeri fermi per **1 s**. **Ogni passo** permette di scegliere da 0,25 a 2 s. **Pausa** mantiene la lettura ferma anche passando il mouse sul grafico; un clic sul grafico riprende il posizionamento libero. **← Passo**, **Passo →** e **Inizio** consentono la lettura manuale. Dopo uno zoom, i passi seguono il tratto ingrandito. Il tempo fisico e i dati della simulazione restano invariati: questa è una lettura rallentata, non una simulazione in tempo reale. Cambiare analisi, intervenire sul grafico o lasciare la scheda ferma la riproduzione.

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

## Montaggio reale e schema LaTeX

Nel pannello **Modifica**, la riga **Montaggio** apre **Ideale / Reale**. Vale sia per le esperienze guidate sia per l’editor libero.

1. Scegli **Reale** e indica quali generatori hanno R in serie.
2. Per ciascun canale scegli il nodo, il collegamento diretto o la sonda ×10, e l’accoppiamento DC/AC. Disattiva i canali non collegati.
3. Apri **Valori degli strumenti e dei collegamenti** per modificare le specifiche. I valori iniziali sono R_G = 50 Ω, R_O = 1 MΩ, C_O = 20 pF, C_AC = 20 nF, R_E = 10 MΩ, C_E = 12 pF, cavo = 90 pF/m e R per filo = 0,05 Ω.
4. Premi **Applica al circuito**: gli elementi diventano R e C espliciti, inclusi nel calcolo e nelle esportazioni. Clicca un elemento aggiunto per riconoscerne la funzione. Usa zoom e trascinamento nei montaggi più densi.

Con una sonda ×10, C_E comprende già sonda, cavo e oscilloscopio: la lunghezza del cavo non viene aggiunta di nuovo. In AC la sonda usa un divisore compensato; IN/OUT mostrano la lettura riferita al puntale, mentre tensioni nodali, correnti e potenze restano quelle fisiche. Un canale disattivato lascia una sonda virtuale senza carico. Le masse dei canali sono comuni.

Le capacità degli strumenti partono dalla tensione iniziale nominale del nodo, ripartita sul divisore della sonda; C_AC parte da 0 V. Nell’editor libero puoi modificare questi valori. Riapplicare la configurazione ricrea gli elementi aggiunti e sostituisce le loro eventuali modifiche manuali. Se ne hai cambiato i collegamenti, l’app impedisce una riconfigurazione che perderebbe tali modifiche: usa Annulla o rimuovi prima i nuovi collegamenti.

**τ, frequenze di taglio e CMRR** hanno uno sfondo azzurro. Con gli strumenti reali τ = R·C e il taglio RC sono riferimenti nominali; i tagli ricavati dal Bode sono a −3 dB rispetto al massimo nell’intervallo visualizzato. Il CMRR comprende il montaggio e il carico degli strumenti, allo stesso punto di lavoro DC; non comprende il CMRR intrinseco del chip.

Per il LaTeX apri la **freccia accanto a Salva sessione** (oppure **Progetto e copie** nell’editor). **File completo per Overleaf** scarica il codice da copiare interamente in `main.tex`: preambolo e pacchetti sono già inclusi. **Solo blocco CircuitikZ** scarica `\resizebox{\textwidth}{!}{...}` con `\begin{circuitikz}[american,scale=0.8,transform shape]`, da incollare dopo `\begin{document}` nella tua relazione; aggiungi prima `\usepackage[american]{circuitikz}` e `\usepackage{graphicx}` nel preambolo. Puoi anche aprire **Visualizza e copia il codice completo** e premere **Copia per Overleaf**. La tabella è facoltativa nel file completo; negli schemi compatti è a fianco, altrimenti segue lo schema con tre colonne e parametri in linea. Masse, resistenze dei collegamenti e componenti degli strumenti vengono raggruppati soltanto quando hanno specifiche identiche. I valori diversi restano separati. I riquadri rossi delimitano il circuito, quelli grigi l’oscilloscopio e quelli blu sonde/cavi. Le sonde DC equivalenti restano dichiarate come tali. Gli ZIP includono `schema.tex` e `schema-circuitikz.tex`.

Il montaggio reale è un modello concentrato di laboratorio: non include induttanze parassite, rumore o propagazione nei cavi. Tutti i calcoli e la generazione dei file restano sul dispositivo.


## Percorso di laboratorio e confronti

La barra **Costruisci → Simula → Misura → Esporta** porta ai controlli e alle analisi pertinenti, in entrambi gli ambienti. Le grandezze evidenziate nelle esperienze guidate si possono premere anche da tastiera per leggere formula, ipotesi e riferimenti.

**Confronta curve** conserva A con tutti i campioni e il progetto. Modifica il circuito, ricalcola e premi **Confronta con la curva attuale B**: le curve condividono assi e unità; l’interpolazione riguarda solo il disegno e non estrapola fuori dagli intervalli originali. I parametri di A e B sono consultabili. A resta storica anche dopo modifiche; scarica il suo JSON e riaprilo con **Riapri curva A** per trasferirlo a un altro browser. Per cambiare analisi o unità conserva un riferimento compatibile.

**Versioni** conserva copie nominate del progetto (massimo 24 per browser/origine) e le esporta come JSON. Riaprire una versione conserva prima il progetto corrente. Le copie browser non sostituiscono i file sul disco. **Riapri ZIP di sessione** valida tutte le prove prima dell’importazione e ricrea una nuova sessione; CSV e grafici del pacchetto originale restano nell’archivio sul disco, mentre l’app ricalcola i risultati dai progetti.

Nell’editor libero **Riordina schema** prepara un’anteprima di allineamento e percorsi dei fili. **Applica disposizione** è annullabile con il normale Annulla. Il metodo riduce gli attraversamenti, ma non garantisce una disposizione ottimale di ogni circuito; controlla l’anteprima. I punti elettricamente connessi restano gli stessi.

In **Montaggio** puoi salvare fino a 20 **profili di strumentazione**, con specifiche e modalità dei canali. Caricare un profilo compila i campi senza applicarlo: controlla i punti misurati e premi **Applica al circuito**. I profili appartengono al browser; i valori effettivamente applicati sono conservati nel JSON del circuito.

Nell’esportazione LaTeX scegli dimensioni dei simboli, caratteri, orientamento, riquadri e posizione della tabella. Il file completo include queste scelte; il blocco CircuitikZ conserva dimensioni e riquadri, mentre larghezza e orientamento dipendono dalla relazione che lo ospita.


**Misura segue il contesto attivo:** in RC/Transitorio propone τ e fit; in RC/Bode propone taglio e fase; negli operazionali propone ampiezze/VTC oppure banda/fase. I pannelli RC non vengono proposti sui circuiti con operazionale. Nell’editor libero le sonde richiedono un circuito completo; l’inserimento di dati sperimentali resta distinto. Le letture del cursore sono sopra il grafico. La croce in alto nei pannelli rimane visibile anche scorrendo Esporta.
