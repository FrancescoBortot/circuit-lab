# Giornate 5 e 6 · diodi e MOSFET

Apri **Quinta giornata** o **Sesta giornata** nel catalogo. **Prova da caricare** mostra i parametri che cambiano prima di applicarli. I valori iniziali sono esempi a 27 °C. In **Componenti** puoi sostituirli con quelli ricavati al banco.

| Giornata | Esperienza | Risultati |
| --- | --- | --- |
| 5 | Diodo · caratteristica I–V | Grafico semilogaritmico, fit di Iₛ e n, residui nel CSV |
| 5 | Raddrizzatore a semionda | IN e OUT, differenza dei picchi, medie temporali |
| 5 | Raddrizzatore con filtro RC | Medie e ripple con la sonda ×10, con Rᴸ a 50 Hz e con Rᴸ a 1 kHz |
| 5 | nMOS · punto di lavoro e curve | Iᴅ–Vᴅₛ, Iᴅ–Vɢₛ, stima di λₙ, rₒ, VTN e kₙ, carico del voltmetro sul gate |
| 6 | Amplificatore nMOS invertente | Polarizzazione, gₘ, guadagno, transitorio a 100 mVpp o 1 Vpp, Bode e VTC |
| 6 | Inverter nMOS resistivo | Livelli logici, tabella di verità e Rₒₙ |
| 6 | Porte NOR e NAND nMOS | Due ingressi a 50 Hz e 100 Hz, forme d’onda e tabelle di verità |
| 6 | Inverter CMOS | Livelli logici e tabella di verità |

## Quinta giornata

**Diodo.** Il grafico usa Vᴅ ai capi del diodo e corrente Iᴅ in ampere. Il fit non pesato di ln(Iᴅ) contro Vᴅ usa correnti da 1 µA fino a 10 mA, entro 20 V di generatore con la resistenza di serie scelta. La pendenza dà `n = 1/(Vₜ·pendenza)` e l’intercetta dà `Iₛ = exp(intercetta)`. L’approssimazione vale in diretta quando Iᴅ è molto maggiore di Iₛ. La curva e il fit sono simulati. Il modello Shockley omette breakdown, capacità di giunzione e resistenza di serie interna.

**Raddrizzatori.** Le prove partono da 10 Vpp e R₁ = 68 kΩ. Il filtro aggiunge C₁ = 22 µF e mantiene R₁ in parallelo. Il montaggio della prova RC usa generatore da 50 Ω e sonde ×10 equivalenti da 10 MΩ e 12 pF, in DC. Il carico esterno di esempio Rᴸ = 4,7 kΩ si aggiunge in parallelo. La media è l’integrale temporale diviso per il periodo e il ripple è `Vmax − Vmin` nell’ultimo periodo intero. Controlla l’avviso di assestamento quando cambi capacità, frequenza o durata.

**MOSFET.** La prova Q imposta Vᴅₛ = 7 V e cerca Iᴅ = 0,7 mA nel modello. Il voltmetro da 10 MΩ a valle di R₁ abbassa Vɢₛ e quindi Iᴅ. Per la curva di trasferimento la scansione si ferma a 4,5 V di generatore o 4 mA di drain. La stima usa due punti attorno a Q per ciascuna curva, in saturazione. Con pendenza `m = ΔIᴅ/ΔVᴅₛ`, `rₒ = 1/m` e `λₙ = m/(I₁ − m·V₁)`. A Vᴅₛ fissata, l’intercetta sull’asse Vɢₛ della retta per i due punti `(Vɢₛ, √Iᴅ)` stima VTN. Da Q si ricava `kₙ = 2 Iᴅ/[(Vɢₛ − VTN)²(1 + λₙ Vᴅₛ)]`.

## Sesta giornata

**Amplificatore.** Alla prima apertura, se nella sessione è già presente il circuito di caratterizzazione, vengono ripresi il modello, R₁ e il punto di lavoro. Vᴅᴅ è calcolata da `Vᴅₛ + Iᴅ·Rᴅ` entro il campo del modello. I valori di esempio sono Rᴅ = 10 kΩ, C₁ = C₂ = 100 nF, carico di uscita 10 MΩ e frequenza 3 kHz. Il riferimento a centro banda è `−gₘ·(Rᴅ ∥ rₒ ∥ Rᴸ)` in saturazione, con `gₘ = 2Iᴅ/(Vɢₛ − VTN)`. Il rapporto delle ampiezze Vpp è positivo. La VTC confronta le ampiezze a regime con la previsione di piccolo segnale e riporta la pendenza del fit sui campioni fino a 0,2 Vpp quando ce ne sono almeno tre.

**Porte.** I circuiti usano Vᴅᴅ = 5 V. I livelli sono classificati come 0 sotto 1 V e 1 sopra 4 V. Il trattino indica una tensione intermedia. Le tabelle si calcolano in DC ai livelli impostati negli ingressi. I transitori mostrano le commutazioni dei generatori ideali. Il modello MOS è a tre terminali con corpo al source, senza capacità interne o effetto body. Nella NAND il corpo di M3 è quindi riferito al source locale e il nodo intermedio ha un ramo da 100 MΩ verso massa per fissarne il potenziale a canali spenti. Nel CMOS il carico di lettura è 10 MΩ.

## Dati e salvataggi

In **I miei dati ↔ modello** scegli l’analisi e indica le colonne. Per le caratteristiche usa Vᴅ, Vᴅₛ o Vɢₛ sull’asse X e corrente in A, mA o µA sull’asse Y. Il confronto conserva il CSV originale e mostra i residui in ampere. Per la VTC importa coppie di ampiezze picco-picco alla frequenza impostata. Per il transitorio importa i campioni OUT rispetto a GND.

Il JSON riapre il circuito guidato, la prova, i componenti e i dati. Lo ZIP della sessione include anche i CSV calcolati e le tabelle di verità delle prove logiche. Puoi aprire lo schema nell’editor libero ed esportarlo in SPICE.

## Breadboard

Passa da **Schema** a **Breadboard** per vedere il cablaggio di riferimento o montare la prova nella vista **Verifica il mio montaggio**. **Montaggio e misure dalla scheda** riporta i collegamenti e le impostazioni del banco per la prova corrente.

Il 1N4148 ha la fascia sul catodo. Nel raddrizzatore con filtro il positivo dell’elettrolitico va a OUT. I MOSFET delle prove guidate condividono un CD4007UB a 14 pin, da inserire sul canale centrale. I body sono collegati a VSS (pin 7) e VDD (pin 14). Nella NAND M1 è dalla parte di GND e il nodo fra i due transistor resta separato da massa. Nell’inverter CMOS della figura 8 i pin 8 e 13 sono uniti a OUT.

Per la caratterizzazione nMOS il montaggio proposto usa un riferimento ausiliario fisso a 9 V sul pin 14, da verificare in base alle sorgenti disponibili al banco. La scansione di Vᴅₛ agisce sul pin 8. Il montaggio mostra separatamente alimentatore DC, generatore di funzioni e sonde. Il carico equivalente delle sonde, la resistenza del voltmetro e il ramo numerico della NAND appartengono al modello. La guida indica dove inserire gli strumenti reali; i multimetri sono descritti nelle istruzioni di misura.

## Verifiche

Le verifiche automatiche coprono le curve e il punto di lavoro, il ripple, il guadagno, i livelli logici nel transitorio e in DC, il confronto con CSV e la riapertura della sessione. I confronti con ngspice 47 usano parametri equivalenti. Con Rᴸ = 4,7 kΩ a 1 kHz, lo scarto del ripple nell’ultimo periodo è circa 10 µV. A 3 kHz il modulo del guadagno a piccolo segnale è 13,768 V/V in entrambi i calcoli.

Nelle prove I–V si usano multimetri. Per il MOSFET il carico del voltmetro da 10 MΩ si seleziona in **Componenti**. Nell’amplificatore e nell’inverter CMOS il carico nominale da 10 MΩ rappresenta la lettura in modalità ideale. In modalità reale vale il carico delle sonde configurate. Un carico esterno dell’amplificatore di valore diverso resta in parallelo. Se l’uscita dell’amplificatore o dell’inverter CMOS non ha un ritorno DC, il modello la riferisce a massa tramite 10 GΩ.
