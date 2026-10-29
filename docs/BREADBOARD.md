# Breadboard

Scegli un circuito e premi **Breadboard**, accanto a **Schema**. La vista usa gli stessi valori e collegamenti del circuito attivo.

- **Prova:** richiama i preset dell'esperienza.
- **Segnale / Banco completo:** mette in primo piano il percorso del segnale oppure mostra con la stessa evidenza anche alimentazioni, bypass e cablaggio della sezione B. Tutti i cavi rimangono visibili e selezionabili; quelli non evidenziati mantengono almeno il 35% di opacità.
- **Vista:** raccoglie contatti interni, numeri dei pin e schema a colori.
- **Guida al montaggio:** i quattro pulsanti compatti sempre visibili in alto accompagnano i passi 1-4 per componenti, alimentazioni, generatore e sonde. Il primo passo mostra soltanto la basetta e i componenti del circuito, a pieno contrasto. I passi successivi aggiungono alimentazione e bypass, generatore e collegamenti del segnale, infine sonde e oscilloscopio. Cliccare un componente o un terminale conserva il passo corrente; scegliere una destinazione apre il primo passo che contiene il collegamento. L'inquadratura predefinita **Banco intero** rimane uguale passando da una fase all'altra. **Primo piano basetta** ingrandisce la basetta su richiesta in tutti e quattro i passi; i pulsanti − / + regolano lo zoom aggiuntivo. La guida rimane visibile durante lo scorrimento. Il calcolo mantiene sempre il circuito completo; l'SVG esporta il passo e l'inquadratura visualizzati.
- **Valori sul generatore:** clicca ampiezza o frequenza del canale da modificare. Il pannello si apre sul campo scelto; Invio applica, Annulla o Esc chiudono senza modificare. Lo stesso vale per le tensioni dell'alimentatore.
- **Componente → A/B o pin:** mostra i terminali, i fori e le destinazioni elettricamente collegate. Clicca una destinazione per isolare il percorso fisico; le tratte interne sono tratteggiate e i ponticelli sono continui. Alimentazioni e condensatori di bypass sono ispezionabili nello stesso modo.
- **Valore → Applica:** modifica il valore. Un valore non valido rimane visibile e correggibile prima di cambiare componente o circuito. «Ripristina valore» annulla la modifica ancora da applicare.
- **Pin, filo o rete:** evidenzia i collegamenti e mostra i fori. Un cavo selezionato mostra origine → destinazione e le due estremità. Sfondo, × o Esc deselezionano.
- **Schema e analisi:** torna alla vista Schema e al grafico esistente. La Breadboard non contiene grafici né una seconda finestra per le tracce; lo schermo dello strumento riassume soltanto i collegamenti CH1/CH2.
- **Strumenti:** conserva la scelta fra modello ideale, cavi diretti, sonde ×10 o profili personalizzati.
- **SVG:** esporta il montaggio corrente con i colori. JSON e sessioni conservano i parametri con i comandi ordinari di Circuit Lab.

Verde = IN, viola = IN2, arancio = OUT, nero tratteggiato = ritorni GND, rosso/blu = alimentazioni. Gli altri nodi hanno colori distinti. Sul pannello dell'oscilloscopio CH1 è giallo e CH2 azzurro; la clip di massa parte dal corpo della sonda vicino al puntale. I due estremi del cavo sono cliccabili anche sopra gli incroci.

## Come leggere la basetta

Il pulsante **Come leggere la breadboard**, accanto al titolo della guida al montaggio, apre una guida illustrata dentro l’app, disponibile anche offline. **Chiudi** o Esc tornano al montaggio mantenendo selezione, passaggio e zoom.

- Ogni foro ha una coordinata: **e12** significa colonna e, fila 12. Il prefisso **M1:** nei file indica l’unica basetta.
- Sulla stessa fila i cinque fori **a–e** sono collegati tra loro, così come **f–j**. I due gruppi sono separati dal canale centrale. Le file adiacenti non sono collegate.
- **L1, L2, R1 e R2** sono quattro barre laterali indipendenti. Nel modello ciascuna è continua; nessuna è già alimentata o collegata a GND. Sulla basetta reale vanno controllate le eventuali interruzioni.
- I due terminali di un componente vanno in gruppi distinti. Il TL082 attraversa il canale centrale; con la tacca in alto, i pin 1–4 scendono a sinistra e 5–8 risalgono a destra. V− è il pin 4 e V+ l’8.
- Un incrocio tra fili non crea un contatto. Contano le estremità inserite nei fori e le lamelle interne. **Vista → Contatti interni** mostra i gruppi collegati; componente → terminale → destinazione evidenzia il percorso reale.

### R1 nell'invertente

- **A, a4 → CH1:** la striscia a4–e4, un ponticello verso la fila 2 e la striscia a2–e2 collegano R1 al segnale del generatore, inserito in d2.
- **B, a9 → ingresso −, pin 2:** a9 e b9 sono sulla stessa striscia; il ponticello b9 → a13 raggiunge la striscia a13–e13. Il pin 2 dell'operazionale occupa e13 e il terminale A di Rf occupa b13.

R1 è quindi tra il segnale d'ingresso e il nodo di somma. I suoi due capi non sono sulla stessa striscia e non sono cortocircuitati. Gli incroci grafici dei cavi non creano contatti: contano i fori, le strisce interne e le estremità dei ponticelli.

Il generatore mostra **due canali**. Quando uno è inutilizzato appare «Libero». Nel modo comune i due canali riproducono le sorgenti uguali del modello attuale; nel differenziale la fase tiene conto della polarità. Non si mettono in parallelo due uscite fisiche.

## Perimetro tecnico

Sono coperti RC, invertente, VTC/banda, derivatore e differenze, oltre ai circuiti liberi con R/C/L, operazionali e fino a due sorgenti di tensione riferite a massa. Per semiconduttori, generatori di corrente e sorgenti flottanti l'app chiede di usare Schema: manca un profilo fisico verificato per questi casi.

Il montaggio è **generato automaticamente**: i collegamenti si modificano nello schema, mentre sulla breadboard si possono ispezionare ed eseguire le modifiche dei valori. I layout alternativi non vengono ancora disegnati a mano. C’è sempre una sola basetta: 30 file per i circuiti piccoli, 63 per quelli più articolati. Gli operazionali occupano posizioni diverse sulla stessa basetta. Se un circuito libero supera la capacità disponibile, compare un messaggio per ridurlo o usare Schema, senza aggiungere basette. Sono rappresentati gruppi da cinque e barre separate; non è una replica certificata di tutti i contatti della basetta fotografata.

Il contenitore è TL082C DIP-8: A usa i pin 1/2/3, V− è il 4 e V+ l'8. B è mostrato con + a GND e uscita in retroazione al −. Le due capacità da 100 nF e il cablaggio di B sono indicazioni fisiche; il modello numerico dell'operazionale resta quello scelto in Circuit Lab. Alimentazioni parametrizzate, assorbimento del chip, compensazione delle sonde e oscillazioni parassite non sono un'emulazione completa dell'hardware.

La visualizzazione non aggiunge di nuovo R/C degli strumenti: i carichi e i risultati rimangono quelli del circuito attivo. Tracce temporali, Bode e VTC restano nei grafici della vista Schema.

## Verifica e manutenzione

`breadboard-model.js` alloca contatti senza sovrapposizioni e verifica la partizione elettrica delle reti. `breadboard-render.js` produce banco e schema dagli stessi identificativi. `breadboard-workbench.js` collega selezioni e modifiche alle API esistenti. Preferenze della vista separate dai parametri scientifici.

Su desktop il contenitore centrale gestisce lo scorrimento verticale; il banco scorre solo in orizzontale quando lo zoom lo richiede. Su schermo piccolo scorre la pagina. Selezione, evidenziazione, piste e zoom non ricostruiscono l'SVG. I passi della guida aggiornano i collegamenti visibili mantenendo inquadratura e zoom scelti, senza modificare i componenti o ricalcolare il cablaggio fisico. Il pannello dei generatori applica soltanto i campi modificati, conservando la precisione degli altri parametri.

Le tracce di ispezione sono ricavate dal grafo dei contatti fisici, non da scorciatoie disegnate fra componenti. Non attraversano resistenze, condensatori o l'operazionale. La selezione conserva il fuoco da tastiera e non aggiunge operazioni alla cronologia del circuito. Su telefono «Collegamenti ↓» e «↑ Banco» permettono di passare tra basetta e dettagli; il ripristino dello zoom centra la basetta.

Prove: `node --test app/tests/breadboard.test.cjs`; regressioni: `node --test app/tests/*.test.cjs`; percorso RC: `node app/scripts/check-rc-workflow.cjs`. Il pacchetto autonomo include i moduli tramite il builder già esistente.
