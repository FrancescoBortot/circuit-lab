# Circuit Lab

Circuit Lab è un laboratorio di elettronica nel browser, pensato per chi studia fisica o ingegneria all’università. Puoi costruire un circuito, cambiare i componenti, osservare tensioni e correnti e confrontare le misure raccolte in laboratorio con un modello.

L’idea è semplice: prevedere cosa dovrebbe succedere, provarlo e capire da dove arrivano le differenze. Gli esempi guidati aiutano a iniziare; l’editor libero permette di costruire il proprio circuito.

**[Apri Circuit Lab nel browser](https://francescobortot.github.io/circuit-lab/)** · **[Scarica la versione offline](https://github.com/FrancescoBortot/circuit-lab/releases/latest/download/Circuit-Lab-offline.zip)** · **[Guida rapida](docs/USO_RAPIDO.md)**

## Inizia a usarlo

Il modo più semplice è cliccare **Apri Circuit Lab nel browser**. Il sito apre direttamente il simulatore: dovresti vedere l’elenco dei circuiti a sinistra, lo schema al centro e il grafico sotto. Per iniziare scegli **Circuito RC**.

Serve un browser aggiornato con JavaScript abilitato. Non servono account, terminale, Python, Node.js o un’installazione di LTspice. Per modificare gli schemi è comodo usare un computer con mouse o trackpad e tastiera.

I calcoli avvengono nel browser e l’app non invia circuiti o misure a servizi esterni. **Salva comunque una copia JSON del lavoro**, come spiegato più avanti.

<details>
<summary>Vuoi usarlo senza Internet?</summary>

1. Scarica **Circuit-Lab-offline.zip** dalla [versione pronta da usare](https://github.com/FrancescoBortot/circuit-lab/releases/latest/download/Circuit-Lab-offline.zip). È disponibile anche lo [ZIP incluso nel repository](app/dist/Circuit-Lab-offline.zip?raw=true).
2. Cerca il file nella cartella **Download** ed estrailo. Su Windows: clic destro → **Estrai tutto…** → **Estrai**. Su macOS: doppio clic sullo ZIP. Su Linux: **Estrai** nel gestore dei file.
3. Apri la cartella estratta e fai doppio clic su **Circuit Lab.html**. Se si apre un editor, scegli clic destro → **Apri con** e seleziona il browser. Il nome può comparire come **Circuit Lab** se il sistema nasconde `.html`.
4. Controlla che compaiano lo schema RC e il grafico. Gli altri tre file sono `LEGGIMI.txt`, con le istruzioni, `LICENSE.txt`, con la licenza MIT, e `integrita.json`, con i dati di verifica del pacchetto.

Se hai usato **Code → Download ZIP**, hai scaricato anche i sorgenti: estrai lo ZIP e apri **circuit-lab-main → app → dist → Circuit Lab.html**. Su macOS è disponibile anche `app/Apri versione portabile.command`.

La versione scaricata funziona senza Internet. Il sito e il file locale hanno memorie del browser separate: per passare dall’uno all’altro, scarica e riapri il progetto JSON.

</details>

## Come orientarti nell’interfaccia

Con **Schema / Breadboard** scegli il disegno elettrico o il montaggio fisico per ogni esperienza. Il montaggio usa sempre una sola breadboard, anche con più operazionali. La guida al montaggio resta compatta e sempre visibile; **Come leggere la breadboard** apre la spiegazione illustrata di file, contatti e barre. La breadboard mostra cavi colorati, i due canali del generatore, sonde e pin del TL082C; valori e segnali aggiornano lo stesso circuito. [Guida Breadboard](docs/BREADBOARD.md).

Sulla breadboard clicca un componente, poi **A/B** o un **pin**: scegli una destinazione per seguirne il collegamento attraverso strisce interne e ponticelli. **Segnale / Banco completo** regola i dettagli visibili.

| Dove | A cosa serve |
| --- | --- |
| **Elenco a sinistra** | Scegli i circuiti delle sei giornate oppure l’editor libero. |
| **Schema al centro** | Clicca i valori sottolineati per modificarli; trascina i componenti per disporli. |
| **Pannello a destra** | Imposta componenti, segnali e analisi. **Prova guidata** propone configurazioni già pronte. |
| **Grafico** | Cambia analisi, usa zoom e cursori, leggi le grandezze ed esporta i risultati. |
| **Salva sessione / ⌄**, nelle esperienze guidate | Assegna un nome alla sessione, conserva le prove e prepara cartelle con progetti e risultati. |
| **Progetto e copie**, nell’editor libero | Salva o riapri il lavoro; accedi a dati, incertezze, relazione e archivio. |

Nelle esperienze guidate le modifiche aggiornano il calcolo automaticamente. Nell’editor libero usa **Simula**; **Auto** permette di ricalcolare dopo le modifiche. Se l’app mostra un errore, leggilo e correggi la causa prima di interpretare il grafico.

**I miei dati ↔ modello** importa CSV o tabelle incollate, conserva gli originali nel progetto e li confronta con il circuito attuale. Mostra previsione, misure, residui e scarti; esporta CSV e relazione HTML. Il confronto non adatta i parametri né estrapola. L’**Assistente di laboratorio** propone un piano di prova, calcola riferimenti ideali sui valori attuali, confronta ipotesi senza cambiare il circuito e presenta in tabella gli scarti tra due risoluzioni numeriche. [Procedura e significato delle incertezze](docs/USO_RAPIDO.md#confrontare-i-propri-dati-con-qualsiasi-esperienza).

Per deselezionare un componente, **clicca sullo sfondo dello schema o premi Esc**. Nell’editor libero Esc interrompe anche un collegamento iniziato. I valori validi modificati restano conservati.

In **Analisi → Che cosa vuoi studiare?** scegli **Tempo · Transitorio**, **Frequenza · Bode** oppure **Ampiezza · VTC** (per gli amplificatori). Il pannello spiega lo scopo della prova e mostra i relativi controlli. **Come leggere il grafico** chiarisce assi e curve; risoluzione e dettagli del calcolo si aprono su richiesta. In fondo trovi gli strumenti per confrontare il modello con misure raccolte in laboratorio.

**Avanzate · Ingresso e baseline** permette di impostare Vin per tutti i circuiti e scegliere la baseline di OUT: automatica, valore manuale in volt oppure media su un intervallo del transitorio. Per i segnali periodici l’ampiezza è Vpp; per gli impulsi guidati Vin è l’escursione rispetto al riposo. L’intervallo della baseline deve essere crescente e contenuto nel tempo simulato; la media tiene conto dei tempi effettivi dei campioni. La scelta aggiorna letture, quaderno e CSV e si conserva nel progetto JSON. I campioni assoluti restano invariati. Nell’editor libero gli stessi controlli si trovano in **Simulazione**; la baseline riguarda la tensione OUT, mentre i generatori di corrente mantengono le proprie unità.

## Giornate 3 e 4 · catena elettronica

I sette circuiti delle giornate 3 e 4 coprono preamplificatore di carica, shaper CR–RC, buffer finale facoltativo, undershoot, compensazione polo-zero, amplificatore non invertente e catena completa. Ogni voce offre situazioni selezionabili da **Prova guidata**, parametri modificabili, schema e breadboard. Preamplificatore e catena includono la linearità rispetto alla carica iniettata, con fit e residui nel CSV. I valori iniziali sono esempi da sostituire con i componenti del proprio gruppo. [Guida alle giornate 3 e 4](docs/GIORNATE_3_4.md).

## Giornate 5 e 6 · diodi e MOSFET

Le esperienze guidate includono la caratteristica del diodo, i raddrizzatori a semionda, le curve e il punto di lavoro del MOSFET, l’amplificatore nMOS e le porte logiche nMOS e CMOS. Puoi cambiare i parametri del dispositivo, confrontare le misure e salvare le analisi e le tabelle di verità nella sessione. [Guida alle giornate 5 e 6](docs/GIORNATE_5_6.md).

## Prima prova: carica e scarica di una RC

1. Clicca **Circuito RC**. In **Prova guidata**, sopra i campi a destra, scegli **RC ideale · senza strumenti**.
2. Nel pannello **Componenti** imposta **R = 10 kΩ** e **C = 100 nF**. Controlla le unità accanto ai valori: `100 nF` e `100 µF` descrivono circuiti molto diversi.
3. Scegli **Solo scarica** da **Prova guidata** e osserva il transitorio.
4. La previsione è `τ = R · C = 1 ms`. Dopo una costante di tempo resta circa il **36,8%** della tensione iniziale, misurata rispetto al valore finale.
5. Raddoppia R. La costante di tempo dovrebbe diventare **2 ms**: prima fai la previsione, poi confrontala con il grafico.

Per leggere meglio la curva, ingrandisci il grafico, usa i cursori e scegli un intervallo che mostri alcune costanti di tempo. Seleziona **Due cursori** per leggere le differenze tra due istanti.

Apri **Misura τ**, scegli **Simulazione**, seleziona un tratto di sola carica o scarica e premi **Calcola il fit**. Confronta τ ricavata dalla curva con R·C e osserva i residui, cioè gli scarti tra i punti e la curva adattata. Su campioni simulati non viene assegnata un’incertezza sperimentale inventata.

Prova poi ad aggiungere generatore, sonde e oscilloscopio dal pannello dei componenti. Le loro impedenze possono cambiare la risposta: il riferimento del circuito completo può differire da quello della RC ideale.

## Seconda prova: risposta in frequenza e Bode

Con la RC ideale da **10 kΩ e 100 nF**:

1. Seleziona **Bode** sopra il grafico.
2. Imposta un intervallo di frequenze che comprenda il taglio, per esempio **10 Hz–10 kHz**.
3. La previsione è `f_c = 1 / (2πRC) ≈ 159 Hz`. Per la RC ideale a un polo, al taglio il guadagno è circa **−3,01 dB** rispetto al valore a bassa frequenza e la fase è circa **−45°**.
4. Usa il selettore della grandezza per passare da **Modulo (dB)** a **Fase (°)**.
5. Aumenta R oppure C e osserva come il taglio si sposta verso frequenze più basse.

Prima di confrontare due curve, verifica che usino lo stesso riferimento d’ingresso. L’analisi AC descrive il piccolo segnale; per vedere saturazione e forme d’onda nel tempo usa il transitorio.

## Terza prova: amplificatore invertente

1. Scegli **Amplificatore invertente** e mantieni **R₁ = 10 kΩ**, **Rf = 47 kΩ**.
2. Da **Prova guidata** scegli **Ingresso 1 Vpp · 1 kHz**. Il guadagno atteso a bassa frequenza è circa `−Rf/R₁ = −4,7`: l’uscita è invertita e vale circa **4,7 Vpp**.
3. Passa alla prova **Ingresso 10 Vpp · saturazione**. L’uscita richiesta dal modello lineare supera l’escursione disponibile: osserva il taglio dei picchi.
4. Esplora **Bode** per la banda e **VTC** per la relazione tra ampiezza d’ingresso e d’uscita.

Per i segnali periodici l’interfaccia usa **Vpp**, tensione picco-picco. Una sinusoide da 1 Vpp ha ampiezza di picco 0,5 V rispetto al proprio offset. Alimentazioni, modello dell’operazionale e carico influenzano il risultato.

Nel **preamplificatore di carica della terza giornata**, apri **Segnali** per inserire **V_in** (escursione con segno, negativa per la scheda) e **Offset** (livello di riposo). Il livello attivo è offset + V_in. I preset che cambiano soltanto la durata conservano questi valori. Il riepilogo del transitorio calcola **V_max** sulla curva simulata e mostra separatamente baseline e picco rispetto alla baseline. La prova 1.3 permette di inserire |Vin| e offset; la scansione conserva entrambi e, con offset non nullo, attende almeno 20 τpre prima dell’impulso.

Nella prova **1.3 → Misure da fare al banco** scegli se variare frequenza, duty high o width. Con duty fisso 99,9% il piano propone frequenze intere da 100 a 500 Hz; con width e frequenza fissa 500 Hz propone 9 durate da 2 a 10 µs. Il duty a passi di 0,1% permette al massimo 5 durate distinte entro questi limiti: la tabella lo segnala senza duplicare le righe. Ogni riga riporta f, duty, durata, carica e picco nominali, più le letture da effettuare al banco; puoi applicarla al circuito oppure scaricare il piano CSV con le colonne delle misure vuote. La simulazione complessiva Linearità · Q mantiene la propria scansione uniforme in durata, distinta dal piano al banco.

Nel pannello **Analisi → Bode** puoi modificare direttamente **Vpp in ingresso**, scegliendo Vpp o mVpp. Il valore è condiviso con il segnale e conservato nel progetto. La curva Bode mostra il rapporto normalizzato Vout/Vin: nel modello lineare il guadagno resta indipendente dall’ampiezza impostata.

Per gli impulsi, **baseline**, **massimo assoluto** e **picco sopra la baseline** sono grandezze distinte: ΔV = Vmax − Vbase. Riquadri, cursore, linearità, quaderno, verifica numerica e CSV usano il campione prima dell’impulso; il transitorio conserva le tensioni assolute. In un CSV con più impulsi la colonna relativa usa la baseline di ciascun impulso. Per sinusoidi e livelli continui viene indicata separatamente la baseline DC di equilibrio, calcolata dal punto di lavoro del modello: non viene confusa con il campione iniziale. Se manca il tratto di riposo, la baseline non viene sostituita con zero. La scheda 1.3 mostra separatamente la baseline nominale ideale; la simulazione comprende il modello operazionale e gli strumenti scelti.

Nel confronto **Carica**, puoi importare direttamente ΔV oppure scegliere **Massimo assoluto + colonna baseline**: la sottrazione avviene riga per riga, conservando CSV e valori originali. L’eventuale incertezza deve già riferirsi a ΔV e includere la baseline e le sue correlazioni. Anche tabelle di carica in ordine decrescente mantengono l’ordine originale. Il piano 1.3 ha intestazioni fisse, numeri compatti e colonne delle letture nel CSV, separate dalle previsioni nominali.

## Importare misure RC da CSV

Apri **Misura τ → Dati sperimentali → Inserisci o apri dati CSV**. Puoi aprire un file o incollare una tabella. Per una prima prova puoi copiare questi **dati sintetici**, costruiti per una scarica con τ vicina a 1 ms:

```csv
tempo_ms;tensione_V;u_V
0;5;0.02
0.5;3.0327;0.02
1;1.8394;0.02
1.5;1.1157;0.02
2;0.6767;0.02
3;0.2489;0.02
4;0.0916;0.02
```

1. Imposta **Separatore = Punto e virgola**, **Unità tempo CSV = ms**, **Unità tensione CSV = V** e indica che la prima riga contiene i nomi.
2. Associa le colonne: `tempo_ms` al tempo, `tensione_V` alla tensione e `u_V` a **u(V) standard**.
3. Premi **Controlla e usa questi dati**. Controlla l’intervallo e scegli, per esempio, **Inizio = 0**, **Fine = 4**, con unità **ms**.
4. Per questo esempio scegli **Fit delle tensioni**, **Valore finale V∞ → Valore noto** e **V∞ = 0 V**. Premi **Calcola il fit**.
5. Controlla τ, grafico e residui. Una sequenza ordinata di scarti può indicare un modello inadeguato o un tratto scelto male, anche se il valore di τ sembra plausibile.

`u_V` contiene incertezze standard dichiarate per l’esempio. Con misure reali usa i contributi del tuo metodo e dei tuoi strumenti. Puoi lasciare l’incertezza assente quando non la conosci: il programma mostrerà quali risultati non sono disponibili.

Per provare altri formati sono inclusi [esempi CSV e progetti](app/esempi/). La [guida all’analisi RC](docs/ANALISI_RC.md) descrive metodi e ipotesi; la [guida alle misure in frequenza](docs/ANALISI_FREQUENZA.md) tratta importazione AC e confronti di Bode.

## Dal fit al bilancio e alla relazione

Dopo un fit RC valido:

1. Con **dati importati**, premi **Bilancio e relazione →**: il quaderno apre la stessa tabella RC. Dichiara correzioni e contributi disponibili, poi calcola il bilancio.
2. Con una **simulazione**, **Relazione →** porta ai file senza trasformare i campioni numerici in misure sperimentali.
3. Apri **Relazione e file**, controlla l’anteprima e scarica HTML o ZIP. La relazione include curva, fit, residui e parametri del tratto selezionato.
4. Nello ZIP trovi anche `rc-misure.csv` e `rc-dati-residui.csv`. La relazione HTML può essere stampata o salvata in PDF dal browser.
5. Se modifichi la tabella o il circuito, torna al fit e ricalcola prima di esportare risultati aggiornati.

Le incertezze del fit e il bilancio con contributi aggiuntivi hanno ipotesi distinte. Il programma le dichiara; controllale prima di riportare un numero nella relazione. Lasciare vuoto un contributo significa che non è disponibile, mentre scrivere zero significa assumerlo esatto.

## Costruire un circuito nell’editor libero

Per familiarizzare con l’editor puoi partire da un esempio modificabile; per un foglio vuoto usa **Nuovo circuito**.

1. Aggiungi i componenti dalla libreria: per una RC servono generatore di tensione, resistenza, condensatore e massa.
2. Con **Collega**, clicca due terminali per creare un filo. Per una RC: positivo del generatore → R → C → negativo del generatore, con il negativo collegato a massa.
3. Imposta **OUT** sul nodo tra R e C e, se serve, **IN** sul positivo del generatore. Gli incroci dei fili non creano da soli un collegamento.
4. Modifica valori, segnale e condizioni iniziali. Per una carica da zero, imposta una tensione iniziale del condensatore compatibile con il circuito.
5. Scegli l’analisi e premi **Simula**. Risolvi eventuali messaggi su massa, terminali o sonde prima di leggere il risultato.

Il foglio permette anche RLC, generatori di corrente, operazionali e modelli didattici di diodi e transistor. Nei circuiti non lineari, punto di lavoro e modello del componente influiscono anche sulla risposta AC.

## Conservare il lavoro e condividere i risultati

Nelle **esperienze guidate**, scrivi il nome della sessione in alto e scegli una **Prova guidata**. Il nome della prova resta sopra lo schema; **personalizzata** indica che ne hai cambiato parametri o analisi. Le opzioni **⌄ → Prove salvate** permettono di riaprire l’ultima copia di ciascuna combinazione sessione/circuito/prova. Da **Altre sessioni e nuova sessione** puoi iniziarne un’altra mantenendo le precedenti.

**Salva sessione** scarica uno ZIP con una cartella della sessione e sottocartelle dei circuiti. I nomi dei file includono sessione, circuito e prova. Sono inclusi JSON, schema e relazione; CSV e grafici corrispondono alle analisi già calcolate con i parametri salvati. Nei browser compatibili, **⌄ → Scegli cartella…** permette di scegliere una destinazione locale: al successivo salvataggio l’app crea la struttura e scrive i file. Negli altri browser basta estrarre lo ZIP. Per riaprire una prova scegli il suo JSON con **Apri**.

Per una singola copia JSON usa **⌄ → Scarica copia JSON** nelle esperienze guidate oppure **Progetto e copie → Scarica copia JSON** nell’editor libero. Il documento si riapre con **Apri**, anche su un altro computer. Non devi riscaricare il simulatore ogni volta che inizi una nuova esperienza.

| File | A cosa serve |
| --- | --- |
| **Progetto JSON** | Riprendere circuito, impostazioni ed eventuali dati salvati. |
| **ZIP del progetto** | Conservare insieme progetto, relazione e file esportati. |
| **CSV** | Portare dati e risultati in un foglio di calcolo o in un altro strumento. |
| **SVG** | Inserire un grafico vettoriale nella relazione. |
| **Relazione HTML** | Leggere, stampare o salvare in PDF il riepilogo dell’esperienza. |

Il browser può conservare una copia automatica, ma questa dipende dal browser e dall’indirizzo dell’app. **Scarica il JSON prima di chiudere**: cancellare i dati del browser, spostare il file HTML o passare dal sito alla versione locale può rendere indisponibile la copia automatica.

## Usarlo bene: controlli prima di concludere

- Cambia un parametro alla volta e annota la previsione prima di simulare.
- Controlla unità, riferimento IN/OUT e durata osservata. Per una sinusoide scegli un intervallo che mostri più periodi.
- Se un transitorio sembra dipendere troppo dal campionamento, aumenta la risoluzione o usa il confronto di precisione disponibile.
- Distingui incertezza sperimentale, tolleranza dei componenti ed errore numerico: rispondono a domande diverse.
- Usa scansioni e Monte Carlo dopo aver capito il circuito nominale; dichiara distribuzioni e parametri scelti.
- Conserva nel progetto i dati e le impostazioni che hanno prodotto il grafico esportato.

## Percorso di lavoro e confronti

La barra **Costruisci → Simula → Misura → Esporta** collega editor, impostazioni, dati e file. **Confronta curve** conserva un riferimento A con campioni e progetto e lo sovrappone alla simulazione B; A si scarica e si riapre come JSON dedicato. **Versioni** conserva copie nominate e riapre lo ZIP completo della sessione come nuova copia. Le simulazioni vengono ricalcolate dai progetti importati.

Nell’editor **Riordina schema** propone una disposizione con anteprima e Annulla. Le grandezze evidenziate nelle esperienze guidate aprono formula e ipotesi. **Montaggio** permette di riutilizzare profili degli strumenti; l’esportazione LaTeX offre dimensioni, caratteri, orientamento, riquadri e posizione della tabella. Per limiti e istruzioni consulta la [guida rapida](docs/USO_RAPIDO.md#percorso-di-laboratorio-e-confronti).

## Strumenti reali e sorgenti LaTeX

In **Modifica → Montaggio → Reale** puoi includere R del generatore, resistenza dei collegamenti, capacità dei cavi e due canali dell’oscilloscopio. Ogni canale consente collegamento diretto o sonda ×10 e accoppiamento DC/AC. I valori sono modificabili e gli elementi aggiunti compaiono nello schema e nel calcolo. La sonda ×10 usa un equivalente al puntale; in AC è modellata come divisore compensato, senza contare due volte il cavo.

La freccia accanto a **Salva sessione**, oppure **Progetto e copie** nell’editor, offre **File completo per Overleaf** e **Solo blocco CircuitikZ**. Il file completo si copia interamente in `main.tex` su Overleaf; il blocco usa `\resizebox` e `\begin{circuitikz}[american,scale=0.8,transform shape]` come uno schema scritto a mano. Simboli nativi, nodi, etichette e riquadri tratteggiati distinguono circuito, sonde e oscilloscopio. È disponibile anche **Visualizza e copia il codice completo**. Il documento completo affianca la tabella agli schemi compatti; nei montaggi più grandi usa una tabella a tre colonne con parametri in linea. Masse ed elementi ausiliari con specifiche identiche vengono raggruppati; valori e condizioni iniziali differenti restano separati. I sorgenti LaTeX sono inclusi anche negli archivi della relazione e della sessione.

Le grandezze principali hanno un’evidenziazione azzurra: τ, taglio, banda e CMRR. Nel montaggio reale il riferimento RC nominale resta distinto dai tagli della curva completa. Per le ipotesi, le condizioni iniziali e i limiti del modello consulta la [guida rapida](docs/USO_RAPIDO.md#montaggio-reale-e-schema-latex).

## Modelli, stato del progetto e problemi comuni

Circuit Lab è in sviluppo e usa modelli didattici con limiti espliciti. Un operazionale ideale, un modello semplificato e un componente commerciale possono dare risultati diversi. I modelli D/BJT/MOS non riproducono automaticamente un particolare dispositivo reale. Leggi le ipotesi mostrate dall’interfaccia.

**Slide e schede delle giornate di laboratorio non sono distribuite.** Il pacchetto contiene l’applicazione e i materiali del progetto necessari al suo uso.

| Problema | Cosa controllare |
| --- | --- |
| Vedi il codice su GitHub | Usa **Apri Circuit Lab** oppure estrai lo ZIP e apri il file HTML. |
| Il circuito libero non parte | Massa, terminali, sorgente, OUT e messaggio mostrato dall’app. |
| La curva è piatta o sembra tagliata | Scala, durata, frequenza, offset, alimentazioni e modello scelto. |
| Il fit non parte o usa pochi punti | Origine dei dati, colonne/unità, intervallo e tratto senza commutazioni. |
| Il risultato è indicato come superato | Ricalcola il fit dopo le modifiche prima di continuare alla relazione. |
| Manca il progetto precedente | Apri il JSON scaricato; verifica browser e indirizzo usati prima. |

Per segnalare un problema usa le [Issues](https://github.com/FrancescoBortot/circuit-lab/issues): descrivi i passaggi, il risultato atteso e quello osservato. Puoi allegare un progetto di esempio privo di dati personali.

## Licenza

Il codice e la documentazione del progetto sono distribuiti con [licenza MIT](LICENSE). Il pacchetto offline include `LICENSE.txt`; l’avviso completo è conservato anche nel file HTML autonomo.

## Guide per approfondire

- [Uso quotidiano e percorso di studio](docs/USO_RAPIDO.md)
- [Analisi delle misure RC](docs/ANALISI_RC.md)
- [Misure in frequenza e Bode](docs/ANALISI_FREQUENZA.md)
- [Motore numerico e controlli](docs/FASE_2_MOTORE.md)
- [Modelli degli operazionali](docs/FASE_4_OPERAZIONALI.md)
- [Dati, incertezze e relazione](docs/FASE_6_MISURE_E_FILE.md)
- [Tolleranze e semiconduttori](docs/FASE_7_TOLLERANZE_E_DISPOSITIVI.md)

<details>
<summary>Per chi vuole modificare il codice — sezione facoltativa</summary>

Le [istruzioni di lavoro](AGENTS.md) definiscono i controlli proporzionati a ciascun intervento, evitando verifiche duplicate e mantenendo i controlli necessari alla correttezza scientifica e all'integrità dei dati. I comandi qui sotto descrivono la verifica completa, da usare quando pertinente.

Il codice è in `app/` e le guide sono in `docs/`. Servono Python 3 e Node.js 24 per ricostruire e verificare la distribuzione:

```sh
python3 app/scripts/build-offline.py
node --test app/tests/*.test.cjs
npm ci --prefix app/tests/dom --ignore-scripts --no-audit --no-fund
npm test --prefix app/tests/dom
node app/scripts/check-rc-workflow.cjs
```

Per provare i sorgenti sul solo computer:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory app
```

Apri `http://127.0.0.1:8765`. Per preparare il sito esegui `python3 app/scripts/build-site.py`: `_site/` conterrà soltanto l’app e lo ZIP offline.

Il workflow GitHub compila ngspice 47 dal sorgente ufficiale verificato tramite SHA-256, riesegue i confronti numerici e verifica modelli, dati, pacchetto e percorso RC prima di pubblicare su Pages. La versione del riferimento è fissata come nella verifica locale: la versione fornita dal sistema operativo può produrre scarti differenti nei casi non lineari. Per rigenerare localmente tutti i confronti: `CIRCUIT_NGSPICE_BIN=/percorso/ngspice node app/scripts/verify-numerics.cjs`. L’applicazione non richiede ngspice per funzionare. Cache, strumenti compilati, risultati grezzi voluminosi e copie di lavoro restano esclusi dal repository.

Il progetto viene sviluppato con l’assistenza di strumenti di intelligenza artificiale. I controlli automatici accompagnano lo sviluppo; il collaudo nei browser e il riscontro di chi studia restano parte della verifica.

</details>

I modelli degli strumenti dispongono di otto ulteriori confronti locali con ngspice: collegamenti diretti e sonde ×10 in DC/AC, amplificatore delle differenze e scarica con accoppiamento AC. Per rigenerarli: `node app/scripts/benchmark-bench.cjs`. I risultati, con gli hash dei sorgenti verificati, sono in `app/benchmark/instruments/results.json`.

Cinque confronti dedicati verificano preamplificatore, shaper, cascata, compensazione polo-zero e catena completa: `node app/scripts/benchmark-radiation.cjs`. Usano reti e operazionali generici equivalenti con integrazione ngspice indipendente; non validano il TL082 reale né sostituiscono misure di laboratorio. Risultati e provenienza sono in `app/benchmark/radiation/results.json`.

### Interfaccia per lo studente

Il percorso Costruisci, Simula, Misura, Esporta mantiene il contesto del circuito. Include schede dell’esperienza, anteprima delle prove, pannelli di studio riducibili, input con unità, confronto guidato dei dati e quaderno portabile nel JSON. La [guida rapida](docs/USO_RAPIDO.md#interfaccia-per-lo-studio) descrive i comandi.

Il test DOM esegue i controller e il worker reali con linkedom, installato soltanto per lo sviluppo. Verifica input, breadboard, annullamento, importazione, confronto, quaderno e riapertura del JSON. Geometria SVG e API native sono emulate: questo controllo non sostituisce il collaudo visivo su browser, portatile e tablet. La distribuzione offline non incorpora questa dipendenza.

### Miglioramenti a salvataggi e grafici

I grafici della simulazione si scaricano anche con **PNG**. Nel confronto delle misure, **Grafici PNG** e **Grafici SVG** includono modello, punti misurati, legenda e residui, con la vista attualmente selezionata. Ricalcola il confronto dopo aver modificato il circuito.

Ogni salvataggio diretto nella cartella crea una sottocartella `Salvataggio-…` distinta. Una cartella con `SALVATAGGIO-INCOMPLETO.txt` indica una scrittura interrotta. I salvataggi precedenti rimangono disponibili separatamente. Le versioni nominate si possono rimuovere e recuperare; la copia prima dell’ultimo ripristino è scaricabile dal pannello Versioni anche quando l’archivio contiene 24 copie.

Dopo modifiche ai modelli numerici, prima della suite locale completa riesegui `node app/scripts/verify-numerics.cjs` con ngspice 47 disponibile: aggiorna le evidenze e i relativi hash. Le modifiche alla sola interfaccia richiedono i controlli proporzionati indicati in AGENTS.md.

### Navigare negli schemi con dita e trackpad

Tocca o clicca lo schema per attivarlo. Sullo sfondo trascina per spostare la vista; con due dita avvicina o allontana e sposta il centro del gesto per ingrandire e navigare. Con trackpad usa il pinch mentre lo schema è attivo. Sollevando un dito puoi continuare a spostare la vista con quello rimasto. La stessa interazione è disponibile nello **Schema a colori sotto la breadboard**, mantenendo la selezione dei collegamenti con un tocco. Esc o un clic fuori disattivano la navigazione e lasciano scorrere la pagina. Lo zoom non cambia valori o collegamenti del circuito.

### Breadboard al banco

Selezionando un componente si leggono i collegamenti di ogni terminale, compresi
alimentatore e oscilloscopio. Le schede mostrano un riepilogo; destinazioni e
percorsi fisici si aprono a richiesta. I contatti interni sono distinti dai
ponticelli e «Isola selezione» nasconde gli altri cavi senza cambiare il circuito.

«Controllo al banco» raccoglie la lista filtrabile di componenti, alimentazioni,
segnale e sonde. Gli stati Da montare / Montato / Controllato / Da rivedere e le
note sono conferme manuali salvate nel progetto. La guida si può mettere in pausa,
riprendere, consultare per componente o operazione e ricominciare senza cancellare
i controlli. Avanti cambia il passo consultato, non certifica il montaggio.
L'inquadratura del passo mostra insieme gli estremi e mantiene accessibili i
controlli; la consultazione libera permette di tornare al passo corrente.

La scheda «Punti di misura» indica puntale e riferimento GND, l'impostazione
nominale dell'alimentatore o il punto di lavoro DC calcolato dal motore esistente.
Il riferimento DC è distinto dall'ampiezza e dalla forma d'onda. I valori non
calcolabili restano non disponibili. Le letture al banco, in V, conservano data e
riferimento alla registrazione; non sostituiscono campioni della simulazione.
Le modifiche pertinenti al circuito o al montaggio richiedono una nuova verifica:
le osservazioni precedenti rimangono riconoscibili e conservate. Gli spostamenti
puramente grafici non invalidano i controlli.

«Scarica scheda» esporta un HTML autonomo con terminali, fori, collegamenti,
impostazioni, lista di controllo, note, misure e figura del montaggio. Aprendolo
nel browser, «Stampa / Salva in PDF» usa la stampa del dispositivo. Il documento
è una scheda di consultazione: il progetto JSON mantiene lo stato riapribile.

### Riprodurre e verificare un montaggio personale

Nella vista Breadboard, **Riproduci e verifica** apre una basetta indipendente dal
montaggio proposto. Lo schema selezionato resta il riferimento. Si scelgono i
componenti della lista e i due fori dei capi; il TL082 attraversa il canale centrale
con un solo posizionamento della fila superiore. I cavi richiedono due fori,
alimentatore e strumenti un foro per ogni cavo. Si possono trascinare componenti,
cavi, estremità e collegamenti degli strumenti, ruotare il TL082, correggere i
valori nominali e le tensioni dichiarate, annullare e ripristinare le operazioni.

La basetta può avere 30 o 63 file, con barre continue oppure interrotte a metà.
I cinque contatti di ogni mezza fila sono distinti dall'altra metà e dalle file
vicine; le quattro barre sono indipendenti. Un incrocio grafico dei fili non crea
un contatto. I fori già occupati vengono rifiutati senza perdere il montaggio.
Trascinare un componente cambia i suoi contatti fisici: i cavi non lo seguono.

**Verifica montaggio** controlla il cablaggio attuale senza imporre che sia
identico allo schema selezionato. Componenti sostitutivi o aggiuntivi, valori e
alimentazioni diversi, reti alternative e disposizioni differenti non sono
errori di per sé. Il confronto esatto rimane disponibile come informazione
separata, nella voce «Differenze dallo schema».

Gli errori riguardano problemi elettrici rilevati sul montaggio: corti fra uscite
o alimentazioni a potenziale diverso, ritorno del generatore mancante, percorso
passivo interrotto, alimentazione del TL082 assente o invertita e ingressi in uso
lasciati scollegati. I ritorni degli strumenti del banco sono comuni: anche una
clip di massa inserita male può creare un corto. Terminali, fori e, quando
individuabile, il ponticello responsabile sono richiamabili con Mostra punti.

Ponticelli ridondanti, componenti bypassati, rami aggiuntivi lasciati aperti,
elementi separati dal circuito, cavi lunghi e disposizione dei bypass producono
consigli. L'assenza di guasti rilevati in un circuito alternativo non certifica
la sua funzione: questa verifica è strutturale e non simula la sua risposta,
stabilità, dissipazione o limiti dei componenti. Le forme d'onda dell'app
continuano a riferirsi allo schema selezionato. Il profilo supporta R, C non
polarizzati, L e TL082 a 8 pin; usa i collegamenti e i valori dichiarati.

Schema, breadboard e grafici accettano lo zoom graduale con la rotella e il gesto
apri/chiudi di due dita sul trackpad, dopo aver attivato l'area con un clic.
La sensibilità è uniforme, le unità della rotella sono normalizzate e i salti o
le raffiche troppo grandi sono limitati. Il pinch del trackpad è gestito sia
come Ctrl+wheel sia come gesto WebKit, evitando il doppio zoom. Esc o un clic
fuori restituiscono lo scorrimento alla pagina; lo zoom non modifica il circuito.

Il montaggio effettivo viene conservato nel progetto, separatamente da schema,
guida e lista manuale. Esporta/Importa montaggio JSON trasferisce la sola basetta;
un riferimento cambiato viene segnalato e richiede una nuova verifica. Le modifiche
non conservano un precedente esito verde. Annulla gestisce ogni gesto completo;
Esc, cancellazione del puntatore e multitocco non confermano trascinamenti in
anteprima. Il primo estremo di un cavo si conserva durante pan e zoom. Su telefono
la scelta del componente porta alla basetta, con comandi rapidi per i dettagli.
