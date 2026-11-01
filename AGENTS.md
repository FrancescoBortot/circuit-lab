# Istruzioni di lavoro per Circuit Lab

## Affidabilità con controlli proporzionati

Mantenere sicurezza, correttezza scientifica e integrità dei dati, evitando lavoro,
attese e consumo di token che non aggiungono evidenza utile.

Prima di modificare il codice, individuare le funzionalità coinvolte e scegliere
i controlli pertinenti. Considerare il comportamento effettivo, non soltanto
l'estensione dei file: una modifica all'interfaccia può alterare unità, parametri,
stato del progetto o risultati e richiedere verifiche più ampie.

| Intervento | Verifiche pertinenti |
| --- | --- |
| Documentazione e istruzioni | Rilettura, collegamenti locali modificati e `git diff --check`. Nessuna ricostruzione o test del simulatore. |
| Testi nell'app e stile | Controlli mirati sulla zona modificata. Collaudo visivo se cambia disposizione, leggibilità o comportamento responsive; accessibilità dei comandi coinvolti. |
| Interazioni e flussi UI | Test dei controller coinvolti e percorso utente modificato; verificare tastiera, focus, annullamento e conservazione dello stato quando pertinenti. Usare il test DOM per modifiche ai flussi condivisi; il browser serve per geometria e API native che il DOM emulato non verifica. |
| Importazione, confronto, salvataggio ed esportazione | Test sui formati, sulle unità e sulla provenienza coinvolti; errori di input e recuperabilità. Provare la riapertura o il download reale quando il relativo comportamento cambia. |
| Motore, modelli elettrici, topologia o analisi numeriche | Test numerici pertinenti e riferimenti indipendenti; allargare ai confronti completi quando cambia il motore condiviso o l'impatto attraversa più modelli. Non sostituire una nuova verifica necessaria con un rapporto precedente. |
| Distribuzione, dipendenze e pubblicazione | Verifica del pacchetto finale, risorse offline e integrità. Alla pubblicazione attendere l'esito dei controlli obbligatori e del deploy; verificare che l'artefatto pubblicato corrisponda a quello collaudato. |

Se l'impatto è incerto, leggere prima dipendenze e test esistenti. Ampliare i
controlli quando emergono errori, cambiamenti trasversali o dubbi concreti.
Non saltare controlli obbligatori, non indebolire soglie e non nascondere errori
per accelerare il lavoro. Dichiarare le verifiche non eseguibili e i loro limiti.

## Evitare duplicazioni

- Usare i test esistenti pertinenti, ad esempio
  `node --test app/tests/study-assistant*.test.cjs` per l'assistente.
  Aggiungere test per comportamenti significativi o regressioni; non per
  riscrivere l'implementazione nei test o per semplici cambi di testo.
- Il comando `node --test app/tests/*.test.cjs` esegue la suite completa;
  `npm test --prefix app/tests/dom` verifica i flussi integrati. Non eseguirli
  entrambi per abitudine dopo ogni piccolo passaggio.
- Verificare ciascun passaggio prima del successivo, soprattutto se richiesto
  dall'utente, usando il controllo più piccolo che dimostri la correttezza.
  Completare poi una verifica integrata delle modifiche che interagiscono.
- Dopo un controllo riuscito, ripeterlo solo se cambiano i suoi input, emerge
  un errore o resta un dubbio motivato. Registrare sinteticamente cosa è stato
  verificato e su quale versione; non riutilizzare evidenze divenute obsolete.
- Riutilizzare dipendenze e strumenti verificati già disponibili. Non reinstallare
  dipendenze, ricompilare ngspice o rigenerare benchmark per modifiche solo UI.
- Preparare il pacchetto finale dopo le modifiche e i controlli sui sorgenti.
  Pubblicare una volta, quando autorizzato nella conversazione; un difetto trovato
  dopo la pubblicazione richiede comunque correzione e nuova verifica.
- La pipeline GitHub attuale esegue controlli completi. Queste istruzioni regolano
  il lavoro locale e non la disabilitano: ottimizzazioni della CI devono essere
  esplicite e preservare la copertura necessaria.

## Uso del tempo e comunicazione

Leggere soltanto file e porzioni rilevanti; raggruppare ricerche indipendenti e
limitare output voluminosi. Durante le attese svolgere lavoro indipendente utile;
evitare interrogazioni frequenti dello stesso stato.

Fornire aggiornamenti brevi quando cambia una decisione, emerge un problema o
si completa una fase significativa. Non narrare ogni comando o ripetere stati
invariati. Nel risultato finale indicare cosa è cambiato, i controlli realmente
eseguiti ed eventuali limiti, senza elenchi di verifiche estranee alla modifica.
