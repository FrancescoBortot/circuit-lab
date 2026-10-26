# Fase 4 · operazionali ed esperienze

Checkpoint verificato: 181 test. I modelli precedente e ideale sono conservati per compatibilità. Il modello fisico opzionale è generico, con parametri modificabili.

## Equazioni e convenzioni

Stato interno z, corrente erogata Iout = −i del ramo MNA dell’operazionale:

- z + τ dz/dt = A₀ (V+ − V−), con τ = A₀/(2π GBW).
- Vout = z − Rout Iout, fino al limite di corrente.
- dz/dt limitata in modulo da SR; z limitato tra V_alimentazione− + headroom e V_alimentazione+ − headroom.
- In limitazione di corrente il ramo impone ±Imax nella rete: il carico determina la tensione effettiva. Il limite non è applicato a posteriori al grafico.

Un active set risolve i vincoli in ciascuno stadio implicito. Il residuo viene controllato sulle equazioni attive; il controllo adattivo riconosce z come tensione, separatamente dalle incognite di corrente. Il piccolo segnale usa le equazioni linearizzate senza limiti, con dichiarazione nell’interfaccia.

Non sono inclusi rumore, offset, correnti di bias, CMRR intrinseco, consumo dalle alimentazioni e recupero reale. Le alimentazioni sono parametri indipendenti del componente, non una simulazione dei suoi assorbimenti. Un’uscita forzata da un circuito esterno non equivale alla corrente assorbita dall’alimentatore.

## VTC in ampiezza

Sinusoide con frequenza e offset dichiarati; in differenze l’eccitazione segue l’ingresso dell’analisi. Blocchi di otto periodi, 512 passi/periodo, stato conservato tra blocchi. Due periodi finali sono confrontati su 65 fasi: massimo scarto ≤ 10⁻⁵ × max(1 V, scala osservata) per nodi e stato interno. Massimo 128 periodi, poi errore esplicito. Vpp dall’ultimo periodo campionato; la discretizzazione dei picchi resta una fonte di errore distinta dalla verifica del regime. Non è una curva DC. Si scelgono 11–101 ampiezze.

## Dati sperimentali

Intestazioni CSV: `mode;frequency_Hz;Vin_Vpp;Vout_Vpp;phase_deg;uVin_V;uVout_V;uPhase_deg`.

Modi: `vtc`, `bandwidth`, `v1`, `v2`, `common`, `differential`. Ampiezze Vpp positive; u sono incertezze standard. Per AD, Vin = V2−V1; per AC, Vin è il segnale uguale sui due ingressi. Banda/VTC hanno un riferimento esplicito. Il taglio è il primo attraversamento discendente di G₀/√2, interpolato in log(f); non si presume un passa basso per il derivatore.

G = Vout/Vin; u(G)² = [u(Vout)/Vin]² + [Vout u(Vin)/Vin²]², sotto indipendenza. Da due osservazioni dirette: CMRR = 20 log10(|AD|/|AC|). Per ricostruire AD = (A2−A1)/2 e AC = A1+A2 occorrono le fasi, mantenendo i guadagni complessi; il Jacobiano propaga le u delle ampiezze e delle fasi. Le ipotesi di linearizzazione e indipendenza sono esplicite. Nessun infinito sperimentale viene assegnato in caso di cancellazione.

Il confronto simulato usa la rete corrente, sorgenti di tensione V1/V2 e sonda OUT rispetto a massa. Una sorgente assente o una rete AC non risolvibile lasciano il confronto indisponibile. Il tratteggio è una previsione lineare, anche nel grafico VTC; la VTC non lineare simulata si esegue nell’esperienza guidata.

## Verifica indipendente

`app/scripts/benchmark-opamp.cjs` usa il ngspice 47 ufficiale già compilato localmente. ODE comportamentale con corrente limitata sul condensatore dello stato e uscita a transconduttanza limitata. Dati, netlist, JSON e log in `app/benchmark/opamp-physical/`; hash del motore in `results.json`.

| Caso | Scarto massimo in V |
| --- | ---: |
| Piccolo segnale lineare | 3,41 × 10⁻⁸ |
| Slew rate | 1,50 × 10⁻⁵ |
| Limite di corrente su carico | 3,24 × 10⁻⁴ |
| Alimentazioni asimmetriche | 2,79 × 10⁻⁵ |

Soglia del benchmark: 1 mV, per questi casi e questo modello equivalente. Non è l’incertezza di uno strumento né una garanzia su ogni rete. Restano validi i nove benchmark precedenti e i sette riferimenti matematici.

Riferimenti primari per il significato fisico dei limiti: [TI, caratteristiche di slew rate](https://ti.com/lit/an/sloa039a/sloa039a.pdf), [TI, limiti di swing e corrente sui carichi](https://www.ti.com/lit/ug/tidue75/tidue75.pdf), [manuale ngspice](https://ngspice.sourceforge.io/docs.html). Le equazioni qui sopra definiscono il nostro modello autonomo; non riproducono un macromodello proprietario.
