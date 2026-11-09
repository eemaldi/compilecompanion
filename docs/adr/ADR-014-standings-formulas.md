# ADR-014: Formule degli standings

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner). Delega esplicita: "usa una formula standard".
- **Requisiti spec:** §8, §2.9; STD-ORD-001, STD-DER-001, STD-SEED-001..003, OD-002b
- **Change set impattati:** CS-12a (SeedingPolicy), CS-16, CS-17

## Contesto
§8 fissa l'ordine dei criteri: record W-L, Opponents' Win Rate, Head-to-Head, Strength of Schedule secondario, technical seed. Non definisce però le formule. Il product owner ha chiesto di adottare le formule standard del gioco competitivo Swiss.

## Decisione
Si adottano le definizioni Swiss più diffuse (es. Magic Tournament Rules), adattate al BO1 senza DRAW. Tutti i valori sono **razionali esatti**; l'arrotondamento avviene solo in presentazione. Il calcolo usa **solo i Round FINALIZED**.

1. **Match points (MP):** 3 per WIN; il bye vale WIN (§7.5). Con BO1 e senza DRAW, ordinare per MP equivale a ordinare per record W-L.
2. **Match win % di un giocatore (MWP):** `max(1/3, MP / (3 × round giocati))`. I round giocati includono i round con bye.
3. **Opponents' Win Rate (OWR):** media aritmetica degli MWP dei suoi avversari.
   - I bye **non** sono avversari e non entrano nella media.
   - Gli avversari droppati o squalificati contano con il loro record al momento dell'uscita (round giocati fino ad allora).
   - Il floor di 1/3 si applica all'MWP di ciascun avversario.
   - Senza avversari (solo bye), OWR = 1/3.
4. **Head-to-Head:** si applica a un insieme di giocatori pari merito su MP e OWR solo se **ogni coppia** dell'insieme si è affrontata. In quel caso si ordina per vittorie negli scontri diretti interni all'insieme. Altrimenti il criterio non separa nessuno e si passa al successivo. Se restano sotto-insiemi ancora pari, la regola si riapplica ricorsivamente.
5. **Strength of Schedule secondario:** OOWR, cioè la media degli OWR dei propri avversari (bye esclusi, stessa regola sui droppati).
6. **Technical seed:** intero univoco per Event (ADR-011). Il valore più basso è il migliore; garantisce l'ordinamento totale.
7. **Seeding nel pairing:** la `SeedingPolicy` usata dal Tournament Engine applica questo stesso ordinamento. Al Round 1 decide solo il technical seed.
8. **Snapshot:** a ogni finalizzazione si persistono rank, MP, MWP, OWR e OOWR (come numeratore e denominatore) per ciascun Participant.

## Alternative considerate
- **Nessun floor:** penalizza troppo chi ha affrontato giocatori poi droppati presto. Scartata in favore dello standard.
- **Buchholz (somma dei punti degli avversari):** standard negli scacchi, meno diffuso nei giochi di carte. Scartata.

## Conseguenze
- (+) Formule note ai giocatori; risultati riproducibili.
- (−) Il floor di 1/3 va spiegato nella UI degli standings.

## Enforcement e verifica
- Property test: ordinamento totale; stessi risultati in ordine diverso ⇒ stesso output; ricalcolo uguale allo snapshot.
- Golden test con esempi calcolati a mano: H2H a 2 e a 3 giocatori, droppati, bye, floor.

## Domande aperte
Nessuna.
