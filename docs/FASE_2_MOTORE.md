# Fase 2 · motore numerico e verifica

Aggiornamento del 24 ottobre 2026. **156 test superati**, sette confronti matematici e nove confronti esterni superati. Il confronto esterno è registrato in `app/benchmark/ngspice/results.json`; non considerare quel confronto eseguito se il file non è presente o contiene `pass: false`.

## Integrazione adattiva

Nell’editor libero, **Simulazione → Integrazione** permette di scegliere passo fisso o adattivo. Le impostazioni precedenti restano compatibili e conservano il passo fisso finché non viene scelto quello adattivo.

Ogni tentativo confronta un passo SDIRK2 di ampiezza h con due passi h/2. La stima locale è la differenza divisa per tre, coerentemente con l’ordine due nel tratto regolare. Si conserva la soluzione dei due mezzi passi; non viene applicata un’estrapolazione che potrebbe violare i vincoli del circuito.

Lo scarto è normalizzato con `atol + rtol · max(|x precedente|, |x nuovo|)`. I valori predefiniti sono rtol = 10⁻⁴, atol sulle tensioni = 10⁻⁷ V, atol sulle correnti di ramo = 10⁻¹⁰ A; rtol è modificabile nell’interfaccia. I due atol sono impostazioni opzionali del documento. Non sono incertezze strumentali e non garantiscono l’errore globale della curva.

Un passo viene accettato soltanto se il massimo rapporto normalizzato non supera uno. Il passo cresce o diminuisce con un fattore prudente e un esponente 1/3; non attraversa gli eventi delle sorgenti. Gli stati di C/L e gli eventi con due campioni allo stesso istante mantengono le convenzioni precedenti. Il limite massimo del passo dipende anche dai punti richiesti e dai periodi presenti, per rappresentare le sorgenti oltre a controllare la dinamica interna.

I limiti sul numero di tentativi/campioni e sul passo minimo generano un errore esplicito: non viene restituita come completa una curva troncata. Il risultato contiene metodo, scarto locale massimo accettato, passi minimo/massimo, tentativi e rifiuti. Rimangono controllati anche i residui delle equazioni.

## Calcolo separato dall’interfaccia

I modelli locali vengono raccolti da `app/scripts/build_solver.py` in `app/solver-source.js`. L’app avvia un worker da questo codice incorporato, senza richieste di rete né caricamento di modelli esterni. Il pacchetto HTML autonomo contiene anche il worker; la CSP ammette solo worker locali creati da Blob e continua a bloccare le connessioni degli script.

Transitorio e Bode liberi, analisi guidate, confronto di precisione e preparazione delle misure RC/AC usano il processo separato. **Annulla calcolo** termina il processo; un risultato di un calcolo sostituito viene ignorato. Un errore o un annullamento non viene presentato come un nuovo risultato riuscito. Nelle esperienze guidate è disponibile **Ricalcola**.

Il fit dei punti sperimentali resta nel pannello e ha un limite di dimensione dichiarato. La preparazione del contesto numerico può essere annullata dal suo dialogo.

## Controlli riproducibili

```sh
python3 app/scripts/build-offline.py
node --test app/tests/*.test.cjs
node app/scripts/benchmark-math.cjs
node app/scripts/benchmark-spice.cjs
```

L’ultimo comando usa il riferimento di sviluppo in `app/.tools/ngspice-local/bin/ngspice`, oppure il percorso `CIRCUIT_NGSPICE_BIN`. ngspice non viene incluso nell’app e non viene richiamato durante il normale uso nel browser.

`app/benchmark/mathematical-results.json` contiene i confronti con equazioni indipendenti: RC rapida e ordinaria, RL, RLC sottosmorzato, invertente ideale e guadagno complesso a banda finita. `app/tests/adaptive.test.cjs` controlla inoltre tolleranze, fronti, vincoli iniziali, saturazione e rilascio dell’operazionale. `app/tests/solver-worker.test.cjs` verifica equivalenza del risultato, errori espliciti, annullamento e rifiuto dei risultati superati.

Il confronto SPICE usa netlist esplicite, impostazioni e dati grezzi conservati per ogni circuito. Le analisi AC confrontano modelli lineari corrispondenti. L’operazionale del riferimento transitorio ha un polo dominante con uscita bufferizzata; le prove sono a piccolo segnale, senza saturazione. La saturazione è verificata con vincoli e test del motore locale, non mediante quel modello lineare esterno.

Fonti del riferimento: [ngspice ufficiale](https://ngspice.sourceforge.io/download.html) e [metadati Homebrew](https://formulae.brew.sh/api/formula/ngspice.json). Il download di preparazione è stato autorizzato esplicitamente dall’utente. Il tarball 47 è verificato tramite SHA-256 `894e649651f1838a14095e5a5439e7d3aa63e87ede14d283173fda4fcdef675f`. Nessun circuito o misura viene trasmesso.
