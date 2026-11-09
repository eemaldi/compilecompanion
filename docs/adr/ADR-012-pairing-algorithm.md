# ADR-012: Algoritmo e funzione obiettivo del pairing

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §7, §16 Pairing/Bye; TRN-PAIR-*, TRN-FLT-*, TRN-BYE-*, TRN-RMT-*, OD-002
- **Change set impattati:** CS-12b, CS-14

## Contesto
§7.3 elenca le priorità del pairing in "ordine concettuale" e lascia libero l'algoritmo, a condizione di non alterare le priorità. Alcune regole sono ambigue (OD-002). Questo ADR **non può scegliere la semantica**: propone una formalizzazione che il product owner deve confermare o correggere, e poi fissa l'algoritmo.

## Parte A: formalizzazione (semantica, OD-002 chiuso il 2026-11-09)

Definizioni:
- `group(p)` = record (W, L) dopo l'ultimo Round FINALIZED;
- `rank(p)` = posizione nell'ordinamento della `SeedingPolicy` (standings correnti secondo ADR-014, con il technical seed come ultimo criterio);
- un pairing completo assegna ogni Participant attivo a esattamente un match o al bye.

**Hard constraint** (mai violati): ogni attivo compare esattamente una volta; nessun self-pairing; al massimo un bye e solo se P è dispari; nessun Participant inventato o escluso.

**Selezione del bye**, eseguita prima del pairing (decisione (d)):
1. tra i candidati senza bye precedente (se ne esistono, è obbligatorio: §7.5);
2. scegliere quelli del Record Group più basso;
3. scegliere il rank più basso;
4. se, togliendo quel candidato, il resto non ammette alcun pairing senza rematch mentre togliendo un altro candidato senza bye sì, si passa al candidato successivo.

   Confermato: evitare i rematch ha la precedenza sulla scelta del bye "più basso". La verifica del punto 4 usa lo stesso vincolo di float descritto sotto.

**Decisioni di prodotto ricevute (2026-11-09, OD-002):**
- **(a)** Il float scende **al massimo di un gruppo**. Se non esiste un pairing senza rematch rispettando questo limite, si accetta il rematch.
- **(b)** Il pairing di riferimento dentro un gruppo è **adiacente**: rank 1 contro 2, 3 contro 4, e così via.
- **(c)** Da un gruppo dispari scende il Participant con il **rank più basso** del gruppo.
- **(d)** Il bye si sceglie **prima** del pairing, con la regola di selezione descritta sopra, incluso il punto 4.
- **(e)** Il numero di float precedenti **non** fa parte della v1.

**Vincolo di float (hard, conseguenza di (a)):** si numerano da 0 i Record Group *non vuoti*, in ordine decrescente di record (`gidx`). Ogni match deve avere `|gidx(a) − gidx(b)| ≤ 1`. Il vincolo usa i gruppi non vuoti perché, se un gruppo intermedio è vuoto, il gruppo "immediatamente inferiore" è il successivo non vuoto. Il vincolo è sempre soddisfacibile: accoppiando i Participant consecutivi nell'ordine per (gruppo, rank) si ottiene sempre un pairing valido. Quindi non genera mai `PAIRING_IMPOSSIBLE` se P ≥ 2.

**Costo del pairing:** vettore confrontato lessicograficamente, da minimizzare, sui pairing che rispettano il vincolo di float:
1. `R`: numero di rematch (priorità 1 e 6; per (a) il rematch si accetta solo dentro il vincolo di float);
2. `F`: numero di match tra gruppi diversi (priorità 2 e 4);
3. `Fr`: preferenza per far scendere il rank più basso (decisione (c)). Si confronta il vettore dei rank dei Participant che scendono, ordinato per gruppo, preferendo rank più bassi;
4. `S`: scostamento dal pairing adiacente dentro il gruppo (decisione (b), priorità 3). Si misura come Σ |rank(a) − rank(b)| − 1 sui match dello stesso gruppo; il pairing 1-2, 3-4 ha `S = 0`.

La priorità 5 (minimizzare la distanza fra record) è assorbita dal vincolo di float: con distanza massima di un gruppo, ridurre la distanza equivale a ridurre `F`.

OD-002 è chiuso.

## Parte B: algoritmo (decidibile dopo la Parte A)

**Proposta:** ricerca esatta con branch & bound sul vettore di costo:
- ordinamento dei Participant per (gruppo, rank);
- ricorsione che accoppia il primo non assegnato con i candidati in ordine di costo incrementale;
- pruning con un lower bound sul costo residuo.

È deterministica (ordinamenti totali, nessuna iterazione su strutture non ordinate). È adatta alle dimensioni MVP (fino a circa 128 Participant); oltre, si passa a weighted matching (Edmonds/blossom) con pesi che codificano il vettore lessicografico.

**Oracolo di test:** enumerazione esaustiva di tutti i pairing completi per P ≤ 10. Property-based con fast-check:
- il costo dell'engine è uguale al costo minimo dell'oracolo;
- tutti gli hard constraint e tutte le proprietà di §16 Pairing e Bye sono rispettati;
- la stessa input produce lo stesso output (determinismo).

**Output:** `PairingResult { matches[], bye?, cost, rematchFlags }` oppure `PAIRING_IMPOSSIBLE` (es. P < 2).

## Conseguenze
- (+) Le priorità diventano verificabili meccanicamente contro un oracolo.
- (−) Ogni risposta alle domande (a)-(e) cambia i risultati dei tornei: è una decisione di prodotto.

## Enforcement e verifica
- Suite property-based obbligatoria in CI.
- Esempi worked (5-8 scenari) approvati dal product owner come golden test.

## Domande aperte
Nessuna. Gli esempi worked (5-8 scenari) vanno prodotti e validati nella review di CS-12b.
