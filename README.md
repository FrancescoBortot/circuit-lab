# Circuit Lab

Circuit Lab è un laboratorio di elettronica nel browser, pensato per chi studia fisica o ingegneria all’università. Puoi costruire un circuito, cambiare i componenti e osservare come variano tensioni, correnti e risposta in frequenza. Puoi anche importare le misure raccolte in laboratorio e confrontarle con il modello.

L’idea è semplice: prevedere cosa dovrebbe succedere, provarlo nella simulazione e capire da dove arrivano le differenze. Gli esempi guidati aiutano a iniziare; l’editor libero permette di disegnare il proprio circuito.

**[Scarica il pacchetto offline](app/dist/Circuit-Lab-offline.zip?raw=true)** · **[Guida rapida](docs/USO_RAPIDO.md)**

## Scarica e apri Circuit Lab

Per iniziare serve un computer con un browser aggiornato, per esempio Chrome, Firefox, Edge o Safari, con JavaScript abilitato.

1. Clicca **[Scarica il pacchetto offline](app/dist/Circuit-Lab-offline.zip?raw=true)**. Il file si chiama `Circuit-Lab-offline.zip`: cercalo nella cartella **Download** del computer. Se GitHub mostra prima la pagina del file, usa il pulsante di download in alto a destra, indicato da una freccia verso il basso.
2. **Estrai lo ZIP.** Su Windows: clic destro sul file → **Estrai tutto…** → **Estrai**. Su macOS: doppio clic sullo ZIP. Su Linux: usa **Estrai** nel gestore dei file. Otterrai una normale cartella con i file dell’applicazione.
3. Apri quella cartella e fai doppio clic su **Circuit Lab.html**. Se il computer lo apre con un editor, usa clic destro → **Apri con** e scegli il browser. Il nome potrebbe comparire come **Circuit Lab** se il sistema nasconde l’estensione `.html`.
4. **Controlla l’avvio:** dovresti vedere il nome Circuit Lab, l’elenco dei circuiti a sinistra, uno schema elettrico e il grafico. Scegli **Circuito RC** per la prima prova.

Il file da aprire è **Circuit Lab.html**. Gli altri due file nello ZIP sono `LEGGIMI.txt`, con le istruzioni, e `integrita.json`, con i dati di verifica del pacchetto.

**Accesso al download:** finché la repository è privata, devi accedere a GitHub con un account autorizzato per scaricare il pacchetto. Dopo il download, l’app funziona senza account e senza Internet. Per usarla non servono terminale, Python, Node.js o un’installazione di LTspice.

<details>
<summary>Hai usato Code → Download ZIP invece del collegamento qui sopra?</summary>

Hai scaricato l’intero progetto, che contiene anche il codice e le guide. Estrai lo ZIP, apri la cartella `circuit-lab-main`, poi **app → dist → Circuit Lab.html**.

Su macOS puoi anche usare `app/Apri versione portabile.command`. Il file HTML è il punto di ingresso comune ai diversi sistemi operativi.

</details>

## Cosa puoi fare

| Se vuoi… | Parti da… |
| --- | --- |
| Capire carica, scarica e costante di tempo | Circuito RC e pannello **Misura τ** |
| Studiare guadagno, fase e frequenza di taglio | Risposta in frequenza e diagrammi di Bode |
| Esplorare invertente, derivatore e amplificatore delle differenze | Esperienze guidate con operazionali |
| Disegnare un circuito personale | **Nuovo circuito**: componenti, fili, massa e sonde |
| Analizzare misure sperimentali | Importazione CSV, fit, residui e incertezze dichiarate |
| Conservare o presentare i risultati | Progetti JSON/ZIP, tabelle CSV, grafici SVG e relazione HTML |

L’editor libero offre transitorio, analisi AC, punto di lavoro e scansione DC. Include R, C, L, generatori, operazionali e modelli didattici di diodi e transistor. Scansioni dei parametri e Monte Carlo permettono di esplorare le tolleranze dei componenti.

## Una prima prova: quanto impiega una RC a scaricarsi?

1. Clicca **Circuito RC** nell’elenco a sinistra. Nel menu **Prova guidata**, sopra i campi a destra, scegli **RC ideale · senza strumenti**.
2. Nel pannello **Componenti**, imposta **R = 10 kΩ** e **C = 100 nF**, controllando le unità accanto ai valori. Puoi aprire i campi anche cliccando i valori sottolineati nello schema. Poi scegli **Solo scarica** dal menu **Prova guidata**.
3. La previsione è `τ = R · C = 1 ms`. Dopo una costante di tempo la tensione dovrebbe essere circa il 36,8% di quella iniziale.
4. Osserva il grafico e apri **Misura τ** per confrontare previsione e curva.
5. Raddoppia R: prima di guardare il risultato, prova a prevedere come cambierà il tempo di scarica.

Quando aggiungi generatore, sonde e oscilloscopio, confronta il risultato con il modello del circuito completo: questi elementi possono cambiare la risposta rispetto alla RC ideale.

## Salva il progetto, poi riaprilo

Da **Progetto e copie → Scarica copia JSON** ottieni un file con circuito, parametri, impostazioni ed eventuali dati di misura. Per riprendere il lavoro usa **Apri** e scegli quel file. Puoi trasferirlo anche su un altro computer.

Il browser conserva una copia automatica quando possibile, ma può perderla se cancelli i dati del browser, cambi browser o sposti l’applicazione. Per conservare il lavoro, scarica il JSON prima di chiudere.

CSV e SVG servono a portare dati e grafici in una relazione. Dal quaderno puoi preparare una relazione HTML da stampare o salvare in PDF. I calcoli e le misure rimangono sul dispositivo; i collegamenti esterni si aprono solo quando li scegli.

## Modelli, risultati e limiti

Circuit Lab è uno strumento didattico in sviluppo. I componenti seguono i modelli descritti nell’interfaccia: un operazionale ideale, un modello semplificato e un componente reale possono dare risultati diversi. I modelli di diodi e transistor hanno parametri e limiti espliciti; non rappresentano automaticamente un particolare componente commerciale.

Il confronto numerico a risoluzione maggiore aiuta a valutare la simulazione. Per stimare un’incertezza sperimentale servono invece dati e ipotesi sul metodo di misura e sugli strumenti. Prima di usare un risultato nella relazione, controlla unità, riferimenti d’ingresso e condizioni del modello.

I file distribuiti contengono l’applicazione, gli esempi e la documentazione del progetto. **Slide e schede delle giornate di laboratorio non sono incluse.**

## Se qualcosa non funziona

- **Vedi il codice anziché l’app:** scarica ed estrai lo ZIP, poi apri il file HTML con il browser. La pagina del codice su GitHub non avvia il simulatore.
- **Il circuito libero non parte:** controlla che ci siano una massa, una sorgente e una sonda OUT collegata al nodo da misurare. Leggi il messaggio mostrato dall’app.
- **Il grafico sembra inatteso:** verifica unità, scala degli assi, durata osservata e riferimento del segnale. Cambia un parametro alla volta.
- **Non trovi il lavoro precedente:** apri la copia JSON salvata sul computer.

Per segnalare un problema descrivi cosa volevi ottenere, i passaggi per riprodurlo e il risultato osservato. Se utile, allega un progetto JSON senza dati personali.

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

## Sviluppo e verifiche

Il codice dell’applicazione è in `app/`; la documentazione è in `docs/`. L’interfaccia usa HTML, CSS e JavaScript e il calcolo avviene in un worker locale.

Dalla radice del repository, con **Python 3** e **Node.js 24**, puoi ricostruire il pacchetto e lanciare i test:

```sh
python3 app/scripts/build-offline.py
node --test app/tests/*.test.cjs
```

Per una prova via HTTP sul solo computer:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory app
```

Apri quindi `http://127.0.0.1:8765`. L’avvio normale della versione portabile passa direttamente dal file HTML.

I test coprono modelli numerici, progetti, analisi dei dati e pacchetto offline. I rapporti di confronto con ngspice sono inclusi; per rigenerarli serve un’installazione separata di ngspice, indicata con `CIRCUIT_NGSPICE_BIN`. Cache, strumenti compilati, risultati grezzi voluminosi e copie di lavoro restano esclusi dal repository.

Il progetto viene sviluppato con l’assistenza di strumenti di intelligenza artificiale. I controlli automatici accompagnano lo sviluppo; il collaudo nei browser e il riscontro di chi studia restano parte della verifica.

</details>
