# Misure in frequenza della RC

Apri **Analisi RC** sopra il grafico oppure **Analisi RC · tempo e frequenza** nelle proprietà. Nel pannello scegli **Frequenza · Bode**. **Tempo · τ e fit** riporta al transitorio. I due insiemi di dati sono conservati nello stesso progetto, senza sostituirsi.

## Un percorso completo

1. Apri **Inserisci o apri dati CSV** e scegli un file locale, oppure incolla la tabella. **Prova un esempio** inserisce undici misure sintetiche, esplicitamente identificate come dimostrazione.
2. Indica il contenuto: **Frequenza, Vin e Vout** oppure **Frequenza e guadagno**. Scegli separatori, intestazione, colonne e unità. La fase è facoltativa, con convenzione Vout − Vin.
3. Se fornisci Vin e Vout, usa la stessa convenzione per entrambe: picco-picco, RMS o picco. Le colonne delle incertezze sono facoltative; per propagare quelle dei due canali occorre dichiarare l’ipotesi di indipendenza.
4. Premi **Controlla e usa questi dati**. Indica dove è misurata Vin: sul generatore, dopo Rg o su un altro riferimento. Il confronto con la simulazione richiede lo stesso riferimento d’ingresso. Una sorgente AC di corrente non è un riferimento V/V.
5. Imposta l’intervallo in Hz e il guadagno a bassa frequenza G₀ per leggere il taglio. Premi **Analizza i dati**. Il pannello mostra lettura dai punti, fit, modulo, fase e tabella dei confronti. **Residui del confronto** permette di scegliere modulo/fase e fit/simulazione.
6. Da **Progetto e copie** conserva il JSON. Il pannello offre CSV delle misure, CSV dei dati/residui e SVG del Bode. Un messaggio di download richiesto non certifica che il browser abbia scritto il file.

I grafici mostrano insieme dati e modelli. Il modulo è in dB, l’asse delle frequenze è logaritmico. La lettura del cursore indica la misura originale più vicina in log(f), con la sua frequenza, senza inventare punti sperimentali sulla curva. **Vista completa** ripristina l’intervallo del grafico.

## Lettura del taglio e fit sono metodi distinti

Il taglio dai punti è il primo attraversamento discendente di **20 log₁₀(G₀) − 3,0103 dB**. Il valore G₀ è dichiarato dall’utente: non è sostituito con il massimo osservato. L’interpolazione è lineare nei dB rispetto a log(f), fra due osservazioni reali; la tabella riporta le frequenze che racchiudono l’attraversamento. Fuori dall’intervallo non si estrapolano i punti. In presenza di più attraversamenti compare un avviso.

Il fit RC usa **G(f) = G₀ / √[1 + (f/fc)²]** e stima liberamente due parametri, G₀ e fc, minimizzando gli scarti del modulo in dB. Il G₀ inserito per la lettura non vincola il fit. Servono almeno quattro frequenze; dati soltanto piatti o su un’asintotica possono non identificare entrambi i parametri. Un fit non identificabile viene segnalato; dati e lettura del taglio rimangono disponibili.

La fase prevista dal modello è −atan(f/fc). Non entra nel fit del modulo: il suo confronto con i punti è utile per riconoscere limiti del modello. Una τ equivalente = 1/(2πfc) va interpretata come costante fisica della rete soltanto quando il modello a un polo è appropriato. I residui e gli avvisi non sostituiscono questa verifica.

La tabella distingue il taglio letto dai punti, quello del fit, quello della simulazione e le τ equivalenti; riporta anche l’ultima τ del fit nel tempo quando il circuito associato coincide. Occorre verificare che dati temporali e AC appartengano alla stessa esperienza. Non viene emesso un verdetto automatico di compatibilità.

## Incertezze e fase

Le frequenze sono assunte esatte. Gli errori del modulo sono trattati come indipendenti fra punti. Per Vin/Vout, con indipendenza esplicita, la propagazione al primo ordine è:

**u(GdB) = (20/ln 10) √[(uVin/Vin)² + (uVout/Vout)²].**

Per un guadagno lineare fornito direttamente, u(GdB) ≈ (20/ln 10) u(G)/G. Se i dati sono già in dB, la colonna u(G) deve essere in dB. La fase e la sua u devono condividere l’unità scelta, gradi o radianti. Errori relativi di ampiezza oltre il 20% producono un avviso sull’approssimazione locale.

Il fit usa le u dichiarate come valori assoluti. La covarianza deriva dal modello linearizzato, senza riscalare le incertezze per ottenere χ²/ν = 1. I gradi di libertà sono N−2. Senza u(G), sono disponibili parametri e RMS degli scarti, ma non vengono inventate incertezze sperimentali.

u(fc) dalla lettura dei punti richiede u del modulo dei due punti, u(G₀) e l’ipotesi di indipendenza del riferimento. Lasciare u(G₀) vuota significa che non è disponibile; zero significa che G₀ è assunto esatto. Se G₀ è stato stimato dagli stessi punti, l’indipendenza in generale non vale. La propagazione non comprende incertezza delle frequenze, errore dell’interpolazione o correlazioni. La τ equivalente propaga la sola u(fc).

La fase misurata viene riportata su un ramo continuo, iniziando in [−180°, 180°); gli originali rimangono nel progetto e nel CSV dei dati. Punti radi possono nascondere avvolgimenti. I residui di fase sono riportati in [−180°, 180°). Non sono incluse u della fase prevista, correlazioni fra canali, errori sistematici condivisi o un bilancio strumentale completo.

## Simulazione e dati originali

Nella RC guidata il Bode è riferito a **Vout/V₁ dopo Rg**; nel foglio libero alla **sorgente AC scelta**, con gli altri generatori azzerati. Il solo nome della sonda IN non cambia il riferimento del calcolo. Se il riferimento delle misure è diverso, sovrapposizione, residui rispetto alla simulazione e suo taglio vengono esclusi. Controlla inoltre che la sorgente AC scelta corrisponda effettivamente a Vin delle tue misure.

La simulazione è confrontata solo nel suo intervallo di frequenze. Non vengono modificati punti, ampiezze o fase per far coincidere le curve. Un carico con più dinamiche può richiedere un modello diverso dal fit RC proposto.

CSV: massimo 200 kB, 4 000 osservazioni, una riga di intestazione facoltativa e colonne coerenti. Frequenze positive e strettamente crescenti; unità Hz/kHz/MHz. Guadagni positivi in V/V oppure finiti in dB; ampiezze in V/mV. Le colonne opzionali devono essere complete. Formule, frequenze ripetute/decrescenti e numeri non validi sono rifiutati senza riordinare o eliminare righe in silenzio. Le intestazioni estese specifiche dei vari strumenti non sono riconosciute automaticamente: prepara una tabella numerica regolare.

Il JSON conserva testo originale, unità, formato, convenzione delle ampiezze, riferimenti, punti normalizzati, incertezze e intervallo. Vin/Vout importate restano disponibili anche in unità SI; il CSV dei punti esporta queste ampiezze e i risultati derivati. I risultati sono ricalcolati dal dataset alla riapertura. Il limite complessivo del progetto resta 1 MB: un secondo dataset troppo grande viene rifiutato prima di sostituire quello corrente.

## Esempi e verifiche

- `app/esempi/rc-bode-dimostrativo.csv`: undici punti sintetici, generati con fc = 160 Hz e G₀ = 0,96, con perturbazione deterministica; non sono dati di un montaggio reale né una realizzazione casuale certificata.
- `app/esempi/rc-tempo-e-frequenza.json`: circuito libero con due sonde, dataset temporale e dataset AC dimostrativi. Contenuto preparato dal pannello, salvato come artefatto locale e riaperto dall’interfaccia tramite testo JSON; non è una prova del download del browser.

La suite conta 122 test: 19 nuovi su formati AC, fase, fit, identificabilità, incertezze, interpolazione e conservazione dei dati. Le risposte RC sono verificate con equazioni indipendenti; le covarianze e la propagazione del taglio sono confrontate con derivate numeriche indipendenti. Le prove effettive dell’interfaccia e le verifiche ancora aperte sono in `VERIFICHE.md`.

Riferimenti: [Analog Devices, filtri RC e definizione del taglio](https://wiki.analog.com/university/courses/engineering_discovery/lab_5), [NIST, propagazione e covarianze](https://physics.nist.gov/cuu/Uncertainty/combination.html). Il simulatore non carica questi siti: i collegamenti sono documentazione facoltativa. I calcoli usano solo i file locali inclusi.
