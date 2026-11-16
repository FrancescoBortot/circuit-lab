# Circuit Lab

**Laboratorio di elettronica nel browser per studenti universitari di fisica e ingegneria.**

Simula le esperienze delle sei giornate, costruisci un circuito da zero o confronta le misure del banco con il modello.

**[Apri Circuit Lab](https://francescobortot.github.io/circuit-lab/)** · **[Scarica lo ZIP offline](https://francescobortot.github.io/circuit-lab/Circuit-Lab-offline.zip)**

## Come iniziare

- **Online.** Apri Circuit Lab in un browser aggiornato con JavaScript attivo.
- **Offline.** Scarica ed estrai `Circuit-Lab-offline.zip`. Apri `Circuit Lab.html` con il browser. Se hai già scaricato il repository, il file è in `app/dist/`. [Copia dello ZIP nel repository](app/dist/Circuit-Lab-offline.zip?raw=true).

Basta il browser. Calcoli e dati restano sul dispositivo. Le schede e le slide delle esperienze sono fornite dal corso.

| Se vuoi… | Apri | Cosa puoi fare |
| --- | --- | --- |
| Simulare una prova della scheda | **Prove della scheda**, nel pannello a destra | Applica subito la configurazione scelta. Se il pannello è chiuso, premi **Prove e parametri**. |
| Cambiare il circuito o il segnale | **Componenti** o **Segnali** | Inserisci i valori con le unità. Nelle esperienze guidate il grafico si aggiorna in automatico. |
| Scegliere cosa osservare | **Analisi** | Usa **Transitorio** per le forme d’onda, **Bode** per guadagno e fase, **VTC** per la risposta al variare dell’ampiezza in ingresso. |
| Fare una previsione | **Assistente di laboratorio**, sopra lo schema | Consulta formule e ipotesi. Varia un parametro nel confronto delle previsioni. |
| Costruire un circuito tuo | **Editor libero**, nell’elenco a sinistra | Parti da un esempio o da un foglio vuoto. |

## Prima prova · scarica di un circuito RC

1. Scegli **Circuito RC** e apri **Prove della scheda**. Seleziona **RC ideale · senza strumenti**, poi **Solo scarica**.
2. In **Componenti** imposta **R = 10 kΩ** e **C = 100 nF**. La costante di tempo attesa è **τ = R·C = 1 ms**.
3. Nel **Transitorio**, porta il cursore a 1 ms e leggi **OUT**. Lo scarto dal valore finale è circa il **36,8%** dello scarto iniziale.
4. Apri **Misura τ → Simulazione**. Seleziona un tratto di sola scarica e premi **Calcola il fit**. Confronta τ con R·C e guarda i residui, cioè gli scarti tra i punti e la curva del fit.
5. Passa a **Bode** e cerca il taglio a **circa 159 Hz**. Per questa RC ideale il modulo al taglio è circa −3 dB e la fase è circa −45°.

Per esercitarti con dati sintetici, torna al **Transitorio**. Apri **Misura τ → Dati sperimentali → Inserisci o apri dati CSV → Prova un esempio**, poi premi **Calcola il fit**. Per importare le tue misure e calcolare il bilancio delle incertezze, segui la [procedura RC](docs/USO_RAPIDO.md#fit-e-bilancio-specifici-della-rc).

## Le sei giornate

| Giornata | Esperienze | Un confronto da provare |
| --- | --- | --- |
| 1 | Circuito RC e amplificatore invertente | Scarica RC con cavo diretto e con sonda ×10 |
| 2 | VTC e banda dell’invertente, derivatore e amplificatore delle differenze | Bode dell’invertente ideale e a banda finita |
| 3 | Preamplificatore di carica, shaper CR–RC e buffer di uscita | Shaper con e senza buffer |
| 4 | Undershoot, compensazione polo-zero, stadio finale e catena completa | Uscita dello shaper prima e dopo l’inserimento di Rpz |
| 5 | Caratteristica I–V del diodo, raddrizzatori, curve e punto di lavoro nMOS | Ripple del raddrizzatore con filtro RC al variare di carico e frequenza |
| 6 | Amplificatore nMOS, inverter nMOS e CMOS, porte NOR e NAND | Livelli di uscita degli inverter con lo stesso ingresso |

Apri il confronto guidato dal pannello di destra. La legenda indica che cosa rappresentano A e B. Nei confronti e nel transitorio puoi regolare le scale per divisione di **CH1**, **CH2** e dell’asse orizzontale. Per confrontare due ampiezze a vista, usa la stessa scala verticale. **Auto** ripristina la vista completa. [Guida ai confronti](docs/USO_RAPIDO.md#confronti-guidati-nelle-sei-giornate).

Nella terza giornata, la prova **1.3 · Verifica della linearità** include la scansione in carica e il piano delle misure al banco. Usa il picco rispetto alla baseline, **ΔV = Vmax − Vbase**. [Prova 1.3](docs/USO_RAPIDO.md#preamplificatore--13-verifica-della-linearità).

## Dal montaggio alle misure

1. Scegli **Breadboard → Costruzione guidata** per vedere dove inserire componenti e cavi. Usa **Controllo al banco** per annotare le verifiche. Con **Riproduci e verifica** puoi ricostruire il tuo montaggio e controllarne il cablaggio. Le simulazioni si riferiscono allo schema attivo.
2. Apri **Dove mettere i puntali** e scegli la misura. Segui i punti numerati sul disegno. Per salvare una lettura del multimetro, inserisci valore e unità e premi **Annota nel quaderno**.
3. Accanto al grafico premi **Importa e confronta misure**. In vista Breadboard il comando è **I miei dati ↔ modello**. Carica un CSV o incolla una tabella. Verifica analisi, separatore, colonne e unità, poi premi **Controlla e salva i miei dati**.
4. Verifica che segnali, strumenti e riferimenti corrispondano al banco. Premi **Confronta col modello attuale** e leggi i residui. Ricalcola il confronto se modifichi il circuito.

Usa i valori misurati dal tuo gruppo e controlla le ipotesi del modello. Per includere le impedenze del generatore e delle sonde, scegli **Montaggio → Reale**. Quando disponibile, **Modello completo** mostra sullo schema gli equivalenti usati nel calcolo. [Impostazioni degli strumenti](docs/USO_RAPIDO.md#montaggio-reale-e-schema-latex).

## Costruire un circuito libero

1. Apri **Editor libero → Nuovo circuito**. Aggiungi i componenti dalla libreria.
2. Con **Collega**, clicca due terminali per creare un filo. Per una diramazione, collega più fili allo stesso terminale oppure aggiungi una **Giunzione**.
3. Collega la **massa (GND)** e assegna **OUT** al nodo da osservare. Assegna **IN** se ti serve un riferimento di ingresso.
4. Imposta il segnale e scegli l’analisi in **Simulazione**. Premi **Simula**. Usa **Auto** per ricalcolare dopo le modifiche.

## Salvare, riaprire ed esportare

| Ti serve… | Usa |
| --- | --- |
| Riprendere una prova o trasferirla su un altro dispositivo | **⌄ → Scarica copia JSON**. Nell’editor libero usa **Progetto e copie → Scarica copia JSON**. Per recuperarla, premi **Apri** e scegli il file. |
| Archiviare una sessione guidata | Dai un nome alla sessione in alto, poi premi **Salva sessione**. Lo ZIP raccoglie i progetti, gli schemi, le relazioni e i risultati già calcolati. |
| Inserire uno schema o un grafico nella relazione | Usa **Scarica schema** per il PNG dello schema. Per il grafico usa **PNG** o **SVG**. |
| Consegnare dati e relazione | Esporta i dati in **CSV**. Da **Relazione e file** scarica la relazione HTML e aprila nel browser per stamparla o salvarla in PDF. |

**Scarica il JSON prima di chiudere.** Il sito e il file offline usano memorie locali separate. Per riaprire una prova da uno ZIP, estrailo e seleziona il JSON della prova. [Gestione delle sessioni](docs/USO_RAPIDO.md#sessioni-e-prove-guidate).

## Guide ed esempi

| Argomento | Dove trovare le istruzioni |
| --- | --- |
| Comandi, quaderno e percorso di lavoro | [Guida rapida](docs/USO_RAPIDO.md) |
| Fori, barre e collegamenti della breadboard | [Come leggere la basetta](docs/BREADBOARD.md#come-leggere-la-basetta) |
| Fit RC e misure in frequenza | [Analisi RC](docs/ANALISI_RC.md#modelli-e-incertezze) · [Misure in frequenza](docs/ANALISI_FREQUENZA.md) |
| Preamplificatore, shaping e catena completa | [Giornate 3 e 4](docs/GIORNATE_3_4.md#circuiti-e-prove) |
| Diodi, MOSFET e porte logiche | [Giornate 5 e 6](docs/GIORNATE_5_6.md) |
| File con cui esercitarsi | [Esempi CSV e progetti JSON](app/esempi/) |
| Modelli, formati e verifiche | [Indice della documentazione](docs/) |

## Licenza e segnalazioni

Circuit Lab è distribuito con [licenza MIT](LICENSE). Per segnalare un problema, indica il circuito, i passaggi da ripetere e il risultato che ottieni. [Issues di Circuit Lab](https://github.com/FrancescoBortot/circuit-lab/issues).

<details>
<summary>Sviluppo e verifiche</summary>

Il codice è in `app/`. Le verifiche numeriche confrontano il simulatore con soluzioni indipendenti e con ngspice 47. [Motore numerico](docs/FASE_2_MOTORE.md) · [Istruzioni per contribuire](AGENTS.md) · [Controlli di pubblicazione](.github/workflows/pages.yml).

Esegui questo comando dalla radice del repository per provare i sorgenti in locale.

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory app
```

Poi apri `http://127.0.0.1:8765`.

</details>
