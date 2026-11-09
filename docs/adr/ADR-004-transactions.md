# ADR-004: Transazioni cross-module e Unit of Work

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §14, §19 AP-03; CONC-*, OD-017
- **Change set impattati:** CS-02, CS-08, CS-10, CS-11, CS-14, CS-15, CS-17

## Contesto
Start del torneo e finalizzazione del Round devono essere atomici e attraversano più moduli (§14.5). La consistenza ha la precedenza sulla disponibilità (AP-03).

## Decisione
1. **Porta `UnitOfWork`** in `platform`: `uow.run(ctx, async (tx) => …)`. Il transaction context viene passato esplicitamente ai servizi (parametro `tx`) e non tramite AsyncLocalStorage, così le dipendenze transazionali sono visibili nelle firme.
2. **Chi apre la transazione:** l'use case di livello più alto coinvolto (orchestration, oppure Tournament per generate/finalize round). I servizi dei moduli chiamati in una transazione esistente non ne aprono una nuova.
3. **Isolation level:** `READ COMMITTED` più lock espliciti (`SELECT … FOR UPDATE`) sugli aggregate che serializzano l'operazione, più constraint UNIQUE come rete di sicurezza. `SERIALIZABLE` non è usato di default, per evitare retry diffusi.
4. **Ordine di lock canonico**, obbligatorio per prevenire deadlock:
   1. `event.event`
   2. `tournament.tournament_progress`
   3. `tournament.round`
   4. `results.match_result` (ordinati per id)
   5. `assignment.assignment_set`
   6. `participation.participant` (ordinati per id)
5. **Retry:** solo su `40P01` (deadlock) e `40001` (serialization failure), al massimo 3 tentativi con backoff, e solo per operazioni idempotenti (ADR-007).
6. **Finalizzazione del Round (OD-017)**, in un'unica transazione:
   1. lock del Round e delle righe `match_result` del round;
   2. verifica che tutti i match abbiano un outcome definitivo e che zero siano DISPUTED;
   3. `ResultsService.finalizeAllForRound`;
   4. `StandingsService.computeAndSnapshot`;
   5. transizione `FINALIZED` con controllo OCC;
   6. audit e outbox.

   Qualsiasi fallimento esegue il rollback dell'intera transazione.
7. Il dominio non conosce la transazione: riceve dati, restituisce decisioni ed eventi. È l'application layer a persistere.

## Alternative considerate
- **SERIALIZABLE ovunque:** più semplice da ragionare, ma i retry sono frequenti sotto contesa (report concorrenti). Scartata come default; resta disponibile per singoli casi motivati.
- **AsyncLocalStorage:** firme più pulite, ma la dipendenza transazionale diventa implicita. Scartata.
- **Saga/eventi:** consistenza eventuale, incompatibile con AP-03.

## Conseguenze
- (+) Atomicità garantita per le operazioni competitive.
- (−) Le transazioni lunghe in finalizzazione (calcolo standings) tengono i lock. Accettabile per le dimensioni MVP; va misurato in CS-17.

## Enforcement e verifica
- Test di integrazione concorrenti su PostgreSQL reale (Testcontainers) per tutti i casi di §16 Concurrency.
- Test di fault injection: eccezione forzata dopo ogni step ⇒ nessuna scrittura persistita.

## Domande aperte
Nessuna.
