# Scansioni, tolleranze e dispositivi didattici

## Percorso nell’interfaccia

- Progetto e copie → Scansioni e tolleranze, oppure Simulazione nell’editor libero.
- Scegli parametro, misura, intervallo o distribuzione, numero di prove e seme. Le percentuali sono semilarghezze uniformi oppure u relative standard normali.
- I primi due parametri possono essere correlati; gli altri sono indipendenti. Una tolleranza relativa richiede un nominale non nullo. Per uno zero usa la scansione assoluta.
- Il CSV conserva tutte le prove, anche quelle fallite. I quantili riguardano solo le prove valide; fallimenti frequenti possono alterare la distribuzione osservata.
- I nuovi componenti si aggiungono dal gruppo “Semiconduttori” della libreria. Gli esempi sono nel menu “Parti da un esempio”.

## Modelli supportati

| Famiglia | Parametri | Corrente principale | Limiti |
| --- | --- | --- | --- |
| Diodo | Is, n | Da anodo a catodo | Esponenziale, senza breakdown o capacità intrinseca |
| BJT NPN/PNP | Is, BF, BR | Entrante nel collettore; base/emettitore disponibili | Ebers–Moll statico, senza Early, carica immagazzinata o resistenze interne |
| MOSFET n/p | β=KP·W/L, modulo Vt, λ, Is corpo | Entrante nel drain; source/gate disponibili | Level 1, corpo sul source, γ=0, senza capacità intrinseche |

Temperatura fissa: 27 °C. Le potenze Q includono collettore e base. Le correnti di tutti i terminali del dispositivo sono positive entranti; U mantiene la convenzione uscente già dichiarata. La corrente di gate MOS è zero nel modello. R/C/L esterni possono rappresentare gli effetti aggiunti esplicitamente; non vengono inventati dal simbolo.

L’AC è il Jacobiano del dispositivo al punto di polarizzazione risolto. Il transitorio risolve le equazioni non lineari ad ogni stadio SDIRK2; senza capacità intrinseche la dinamica dei dispositivi è quasi statica. Un fallimento non produce una curva presentata come valida.

## Verifica indipendente

`node app/scripts/benchmark-semiconductors.cjs` confronta **modelli nativi ngspice D/Q/M**, non generatori comportamentali che ricopiano le equazioni dell’app. Sono conservati circuiti JSON, netlist, dati e log in `app/benchmark/semiconductors/`. 11 casi: 5 scansioni DC, MOS con conduzione inversa/diodo di corpo, due AC, due transitori con carico capacitivo e raddrizzatore con filtro. Scarto massimo del filtro: circa 1,63 µV, sotto la soglia dichiarata di 2 mV. Report con hash esatti dei sorgenti.

Riferimento primario dei modelli SPICE e dei parametri: [manuale ufficiale ngspice 47](https://ngspice.sourceforge.io/docs/ngspice-47-manual.pdf), capitoli sui diodi, BJT e MOS Level 1. Circuit Lab implementa autonomamente un sottoinsieme didattico e non carica le librerie del riferimento.

Test: `node --test app/tests/*.test.cjs`. Riferimenti matematici: `node app/scripts/benchmark-math.cjs`. Per rigenerare il singolo file offline: `python3 app/scripts/build-offline.py`.

## Scambio di netlist

Supportati R/C/L/V/I e D/Q/M con soli parametri numerici dichiarati: D richiede Is/N; Q Is/BF/BR; M Level=1, KP/VTO/λ/Is e W/L positive, corpo sul source, γ=0. TNOM/TEMP solo 27 °C. Parametri non supportati vengono rifiutati per riga. I commenti CLAB conservano IN/OUT; una netlist esterna può richiedere la scelta manuale delle sonde. I modelli U generici possono essere esportati verso ngspice ma non reimportati come espressioni. JSON/ZIP è il formato completo.
