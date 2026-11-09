# ADR-012: Algoritmo e funzione obiettivo del pairing

- **Stato:** Draft — non approvabile finché OD-002 non è chiuso
- **Data:** 2026-11-09
- **Approvatore:** —
- **Requisiti spec:** §7, §16 Pairing/Bye; TRN-PAIR-*, TRN-FLT-*, TRN-BYE-*, TRN-RMT-*, OD-002
- **Change set impattati:** CS-12b, CS-14

## Contesto
§7.3 elenca le priorità del pairing in "ordine concettuale" e lascia libero l'algoritmo, a condizione di non alterare le priorità. Alcune regole sono ambigue (OD-002). Questo ADR **non può scegliere la semantica**: propone una formalizzazione che il product owner deve confermare o correggere, e poi fissa l'algoritmo.

## Parte A: formalizzazione da confermare (semantica, OD-002)

Definizioni:
- `group(p)` = record (W, L) dopo l'ultimo Round FINALIZED;
- `rank(p)` = posizione nell'ordinamento della `SeedingPolicy` (standings correnti, con il technical seed come ultimo criterio);
- un pairing completo assegna ogni Participant attivo a esattamente un match o al bye.

**Hard constraint** (mai violati): ogni attivo compare esattamente una volta; nessun self-pairing; al massimo un bye e solo se P è dispari; nessun Participant inventato o escluso.

**Selezione del bye** (proposta), prima del pairing:
1. tra i candidati senza bye precedente (se ne esistono, è obbligatorio: §7.5);
2. scegliere quelli del Record Group più basso;
3. scegliere il rank più basso;
4. se, togliendo quel candidato, il resto non ammette alcun pairing senza rematch mentre togliendo un altro candidato senza bye sì, si passa al candidato successivo.

   Il punto 4 è da confermare: implica che evitare i rematch prevalga sulla scelta del bye "più basso".

**Costo del pairing:** vettore confrontato lessicograficamente, da minimizzare:
1. `R` = numero di rematch (priorità 1 e 6);
2. `D` = Σ |W(a) − W(b)| sui match (priorità 2, 4, 5: accoppiare nello stesso gruppo costa 0, un float di un gruppo costa 1, di due gruppi costa 2);
3. `F` = numero di Participant accoppiati fuori dal proprio gruppo;
4. `S` = Σ, nei soli match intra-gruppo, dello scostamento dal pairing di riferimento per rank nel gruppo (priorità 3).

**Domande da chiudere** (OD-002):
- **(a)** È corretto che, pur di evitare un rematch, si accetti un float di due o più gruppi? La formalizzazione dice di sì (R prima di D). L'alternativa è "float al massimo di un gruppo; se impossibile senza rematch, rematch".
- **(b)** Il pairing di riferimento intra-gruppo per la priorità 3 è "1 contro 2, 3 contro 4" (adiacente) oppure "metà alta contro metà bassa" (1 contro n/2+1, stile Swiss classico)?
- **(c)** Chi float dal gruppo dispari: il rank più basso del gruppo superiore (proposta)?
- **(d)** Il bye è scelto prima del pairing (proposta) o come parte dell'ottimizzazione globale?
- **(e)** Il numero precedente di float (§7.4) è citato "se tale metrica verrà introdotta": confermare che **non** fa parte della v1.

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
OD-002 (a)-(e).
