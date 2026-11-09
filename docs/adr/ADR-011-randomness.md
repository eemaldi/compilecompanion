# ADR-011: Randomness riproducibile

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §9.4, §8, §16; PRT-RND-005, STD-SEED-001..003, TRN-PAIR-003, OD-014, OD-015
- **Change set impattati:** CS-10, CS-11

## Contesto
Random Draft e (in base a OD-015) il technical seed richiedono casualità. Il dominio deve restare deterministico e testabile, e le operazioni casuali devono essere auditabili.

## Decisione
1. **Porta `RandomSource`** in `platform`. Il dominio riceve un generatore deterministico, mai `Math.random`.
2. **Seed per operazione:** a ogni Random Draft, reroll o assegnazione del technical seed, l'application service genera un seed a 256 bit con un CSPRNG (`crypto.randomBytes`).
3. Il seed alimenta un PRNG deterministico (**xoshiro256\*\***, implementazione interna con test vector). L'algoritmo è un Fisher–Yates shuffle su un input **ordinato canonicamente** (per `protocolId` e per `participantId`), così l'output dipende solo da seed e insieme di input, non dall'ordine di lettura dal DB.
4. Seed e versione dell'algoritmo (`algorithmVersion`) sono persistiti con il draft (`assignment.random_draft`) e nell'audit entry. Lo stesso seed sullo stesso input riproduce sempre lo stesso risultato.
5. Il seed non è esposto ai player. È visibile solo ai TO tramite audit, per evitare che si possa prevedere un reroll.
6. **Technical seed (OD-015, confermato il 2026-11-09):** una permutazione casuale dei Participant attivi all'avvio, con la stessa procedura. Il valore risultante (intero 1..P) è persistito su `participation.participant.technical_seed` con UNIQUE `(event_id, technical_seed)` e non viene mai ricalcolato.

## Alternative considerate
- **CSPRNG diretto senza seed persistito:** sicuro, ma non riproducibile né verificabile. Scartata.
- **`ORDER BY random()` in SQL:** non riproducibile e dipendente dal DB. Scartata.

## Conseguenze
- (+) Test property-based deterministici; ricostruzione di un draft a scopo di verifica.
- (−) Cambiare algoritmo richiede di incrementare `algorithmVersion`.

## Enforcement e verifica
- Lint: vietati `Math.random` e `crypto` nel `domain`.
- Property test: stesso seed + input permutato ⇒ stesso output; distribuzione uniforme verificata statisticamente con tolleranza.

## Domande aperte
Nessuna. OD-015 è stato confermato il 2026-11-09.
