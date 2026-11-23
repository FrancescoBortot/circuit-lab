# Esempi per Circuit Lab

Per riaprire un progetto `.json`, scaricalo e usa **Apri** nella barra in alto. Per confrontare un file `.csv` con il modello di un’esperienza, apri il circuito corrispondente e premi **Importa e confronta misure** (oppure **I miei dati ↔ modello** in vista Breadboard). Per i fit specifici della RC puoi usare anche **Misura τ**. Tutti i file `.csv` contengono dati sintetici dimostrativi.

| Giornata | File | Esercizio |
| --- | --- | --- |
| 1 | [rc-scarica-dimostrativa.csv](rc-scarica-dimostrativa.csv) | Importa una scarica con incertezze sulla tensione e stima τ. |
| 1 | [rc-bode-dimostrativo.csv](rc-bode-dimostrativo.csv) | Importa misure in frequenza della RC e stima il taglio. |
| 1 | [rc-con-fit-dimostrativo.json](rc-con-fit-dimostrativo.json) | Riapri un progetto con dati sintetici e impostazioni del fit di scarica. |
| 1 | [rc-tempo-e-frequenza.json](rc-tempo-e-frequenza.json) | Prova analisi nel tempo e in frequenza nello stesso circuito RC. |
| 1 | [rc-con-misure.json](rc-con-misure.json) | Osserva tensione e corrente con le sonde dell’editor libero. |
| 1 | [rc-caricato-slide.json](rc-caricato-slide.json) | Esamina la risposta in frequenza della RC con generatore, cavo e sonda rappresentati nello schema. |
| 1 | [invertente-libero.json](invertente-libero.json) | Simula un amplificatore invertente nell’editor libero e varia la resistenza di retroazione. |
| 2 | [derivatore-bode-dimostrativo.csv](derivatore-bode-dimostrativo.csv) | Confronta la risposta in frequenza (guadagno e fase) del derivatore con il modello attuale. |
| 3 | [preamp-linearita-carica.csv](preamp-linearita-carica.csv) | Confronta la scansione di linearità in carica ($\Delta V = V_{\max} - V_{\text{base}}$ rispetto a $Q_{\text{in}}$) del preamplificatore (prova 1.3). |
| 4 | [shaper-polo-zero.json](shaper-polo-zero.json) | Riapri la cascata preamplificatore + shaper CR–RC con compensazione polo-zero $R_{pz}$. |
| 5 | [diodo-caratteristica-iv.csv](diodo-caratteristica-iv.csv) | Importa una caratteristica diretta $I_D(V_D)$ del diodo e confrontala in scala semilogaritmica col modello di Shockley. |
| 5 | [mosfet-uscita-id-vds.csv](mosfet-uscita-id-vds.csv) | Importa una curva di uscita $I_D(V_{DS})$ dell’nMOS al punto di lavoro nominale e leggi i residui in ampere. |
| 6 | [inverter-cmos.json](inverter-cmos.json) | Riapri l’inverter CMOS della sesta giornata con livelli logici e tabella di verità DC. |

[Guida rapida](../../docs/USO_RAPIDO.md) · [Analisi RC](../../docs/ANALISI_RC.md) · [Misure in frequenza](../../docs/ANALISI_FREQUENZA.md) · [Giornate 3 e 4](../../docs/GIORNATE_3_4.md) · [Giornate 5 e 6](../../docs/GIORNATE_5_6.md)
