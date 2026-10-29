# Breadboard

Scegli un circuito e premi **Breadboard**, accanto a **Schema**. La vista usa gli stessi valori e collegamenti del circuito attivo.

- **Prova:** richiama i preset dell'esperienza.
- **Segnale / Banco completo:** mette in primo piano il percorso del segnale oppure mostra con la stessa evidenza anche alimentazioni, bypass e cablaggio della sezione B. L'attenuazione è soltanto visiva: il circuito rimane completo.
- **Vista:** raccoglie contatti interni, numeri dei pin e schema a colori.
- **Guida al montaggio:** apri i passi 1-4 per componenti, alimentazioni, generatore e sonde. I passi non cambiano il circuito completo usato dal calcolo.
- **Valori sul generatore:** clicca ampiezza o frequenza del canale da modificare. Il pannello si apre sul campo scelto; Invio applica, Annulla o Esc chiudono senza modificare. Lo stesso vale per le tensioni dell'alimentatore.
- **Componente → A/B o pin:** mostra i terminali, i fori e le destinazioni elettricamente collegate. Clicca una destinazione per isolare il percorso fisico; le tratte interne sono tratteggiate e i ponticelli sono continui. Alimentazioni e condensatori di bypass sono ispezionabili nello stesso modo.
- **Valore → Applica:** modifica il valore. Un valore non valido rimane visibile e correggibile prima di cambiare componente o circuito. «Ripristina valore» annulla la modifica ancora da applicare.
- **Pin, filo o rete:** evidenzia i collegamenti e mostra i fori. Un cavo selezionato mostra origine → destinazione e le due estremità. Sfondo, × o Esc deselezionano.
- **Schema e analisi:** torna alla vista Schema e al grafico esistente. La Breadboard non contiene grafici né una seconda finestra per le tracce; lo schermo dello strumento riassume soltanto i collegamenti CH1/CH2.
- **Strumenti:** conserva la scelta fra modello ideale, cavi diretti, sonde ×10 o profili personalizzati.
- **SVG:** esporta il montaggio corrente con i colori. JSON e sessioni conservano i parametri con i comandi ordinari di Circuit Lab.

Verde = IN, viola = IN2, arancio = OUT, nero tratteggiato = ritorni GND, rosso/blu = alimentazioni. Gli altri nodi hanno colori distinti. Sul pannello dell'oscilloscopio CH1 è giallo e CH2 azzurro; la clip di massa parte dal corpo della sonda vicino al puntale. I due estremi del cavo sono cliccabili anche sopra gli incroci.

### R1 nell'invertente

- **A, a4 → CH1:** la striscia a4–e4, un ponticello verso la fila 2 e la striscia a2–e2 collegano R1 al segnale del generatore, inserito in d2.
- **B, a9 → ingresso −, pin 2:** a9 e b9 sono sulla stessa striscia; il ponticello b9 → a13 raggiunge la striscia a13–e13. Il pin 2 dell'operazionale occupa e13 e il terminale A di Rf occupa b13.

R1 è quindi tra il segnale d'ingresso e il nodo di somma. I suoi due capi non sono sulla stessa striscia e non sono cortocircuitati. Gli incroci grafici dei cavi non creano contatti: contano i fori, le strisce interne e le estremità dei ponticelli.

Il generatore mostra **due canali**. Quando uno è inutilizzato appare «Libero». Nel modo comune i due canali riproducono le sorgenti uguali del modello attuale; nel differenziale la fase tiene conto della polarità. Non si mettono in parallelo due uscite fisiche.

## Perimetro tecnico

Sono coperti RC, invertente, VTC/banda, derivatore e differenze, oltre ai circuiti liberi con R/C/L, operazionali e fino a due sorgenti di tensione riferite a massa. Per semiconduttori, generatori di corrente e sorgenti flottanti l'app chiede di usare Schema: manca un profilo fisico verificato per questi casi.

Il montaggio è **generato automaticamente**: i collegamenti si modificano nello schema, mentre sulla breadboard si possono ispezionare ed eseguire le modifiche dei valori. I layout alternativi non vengono ancora disegnati a mano. Il modulo rappresenta 30 file con gruppi da cinque e barre separate; non è una replica certificata di tutti i contatti della basetta fotografata.

Il contenitore è TL082C DIP-8: A usa i pin 1/2/3, V− è il 4 e V+ l'8. B è mostrato con + a GND e uscita in retroazione al −. Le due capacità da 100 nF e il cablaggio di B sono indicazioni fisiche; il modello numerico dell'operazionale resta quello scelto in Circuit Lab. Alimentazioni parametrizzate, assorbimento del chip, compensazione delle sonde e oscillazioni parassite non sono un'emulazione completa dell'hardware.

La visualizzazione non aggiunge di nuovo R/C degli strumenti: i carichi e i risultati rimangono quelli del circuito attivo. Tracce temporali, Bode e VTC restano nei grafici della vista Schema.

## Verifica e manutenzione

`breadboard-model.js` alloca contatti senza sovrapposizioni e verifica la partizione elettrica delle reti. `breadboard-render.js` produce banco e schema dagli stessi identificativi. `breadboard-workbench.js` collega selezioni e modifiche alle API esistenti. Preferenze della vista separate dai parametri scientifici.

Su desktop il contenitore centrale gestisce lo scorrimento verticale; il banco scorre solo in orizzontale quando lo zoom lo richiede. Su schermo piccolo scorre la pagina. Selezione, evidenziazione, piste e zoom non ricostruiscono l'SVG; il montaggio viene rigenerato soltanto quando cambiano i dati necessari al modello fisico. Il pannello dei generatori applica soltanto i campi modificati, conservando la precisione degli altri parametri.

Le tracce di ispezione sono ricavate dal grafo dei contatti fisici, non da scorciatoie disegnate fra componenti. Non attraversano resistenze, condensatori o l'operazionale. La selezione conserva il fuoco da tastiera e non aggiunge operazioni alla cronologia del circuito. Su telefono «Collegamenti ↓» e «↑ Banco» permettono di passare tra basetta e dettagli; il ripristino dello zoom centra la basetta.

Prove: `node --test app/tests/breadboard.test.cjs`; regressioni: `node --test app/tests/*.test.cjs`; percorso RC: `node app/scripts/check-rc-workflow.cjs`. Il pacchetto autonomo include i moduli tramite il builder già esistente.
