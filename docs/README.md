# Documentazione di Circuit Lab

## Per il laboratorio

| Ti serve | Guida |
| --- | --- |
| Aprire il simulatore, scegliere una prova e salvare il progetto | [Guida rapida](USO_RAPIDO.md) |
| Montare e controllare un circuito sulla basetta | [Breadboard](BREADBOARD.md) |
| Preparare le prove su preamplificatore, shaper e catena elettronica | [Giornate 3 e 4](GIORNATE_3_4.md) |
| Preparare le prove su diodi, MOSFET e porte logiche | [Giornate 5 e 6](GIORNATE_5_6.md) |
| Misurare τ e interpretare il fit di carica o scarica | [Analisi RC](ANALISI_RC.md) |
| Importare misure di guadagno e fase e stimare il taglio | [Misure in frequenza](ANALISI_FREQUENZA.md) |
| Provare l’importazione o riaprire un circuito pronto | [Esempi CSV e JSON](../app/esempi/) |

## Modelli e verifiche

| Argomento | Riferimento |
| --- | --- |
| Integrazione, worker e confronti numerici | [Motore numerico](FASE_2_MOTORE.md) |
| Guadagno, saturazione e banda degli operazionali | [Modelli degli operazionali](FASE_4_OPERAZIONALI.md) |
| Analisi DC, AC e transitorio | [Analisi e grandezze fisiche](FASE_5_ANALISI.md) |
| Quaderno, incertezze, relazione e scambio di file | [Dati e formati](FASE_6_MISURE_E_FILE.md) |
| Scansioni, tolleranze e modelli D/BJT/MOS | [Tolleranze e semiconduttori](FASE_7_TOLLERANZE_E_DISPOSITIVI.md) |

I casi di riferimento, le netlist e i risultati sintetici sono in [app/benchmark](../app/benchmark/). I comandi di verifica sono in [app/scripts](../app/scripts/), i test in [app/tests](../app/tests/) e il pacchetto offline in [app/dist](../app/dist/).
