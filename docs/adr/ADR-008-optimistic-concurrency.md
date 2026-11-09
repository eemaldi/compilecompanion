# ADR-008: Optimistic concurrency via HTTP

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §14.4, §14.5, §15; CONC-RES-001/002
- **Change set impattati:** CS-02, CS-06, CS-09, CS-11, CS-15, CS-17

## Contesto
Report, accept e dispute concorrenti devono usare optimistic concurrency. Chi opera su una versione obsoleta deve ricevere un conflict e il silent overwrite è vietato.

## Decisione
1. Ogni aggregate mutabile ha una colonna `version integer NOT NULL`, incrementata a ogni modifica: Event, Participant, EventAssignmentSet, Round, MatchResult, Membership.
2. Il repository salva con `UPDATE … SET …, version = version + 1 WHERE id = $1 AND version = $expected`. Zero righe aggiornate ⇒ `CONCURRENT_MODIFICATION`.
3. **HTTP:** le GET restituiscono `ETag: "<version>"` (strong). Le mutazioni su risorse esistenti richiedono `If-Match`.
   - Header mancante ⇒ `428 Precondition Required` con codice `VALIDATION_ERROR`.
   - Versione diversa ⇒ `409` con codice `CONCURRENT_MODIFICATION`.
4. Le operazioni che serializzano su un aggregate (start, generate, finalize) usano anche il lock pessimistico di ADR-004. L'OCC garantisce che l'utente stia agendo sullo stato che ha visto.
5. Nel body le risorse espongono anche `version`, per i client che non leggono gli header.

## Alternative considerate
- **Last-write-wins:** vietato dalla spec.
- **Solo lock pessimistico:** previene le corruzioni, ma non segnala all'utente che ha agito su dati vecchi (§14.4 richiede il conflict). Scartata.
- **Timestamp come versione:** soggetto a collisioni. Scartata.

## Conseguenze
- (+) Nessun overwrite silenzioso; semantica standard di HTTP.
- (−) Il client deve gestire il 409 con un refresh (coerente con §15 CONCURRENT_MODIFICATION).

## Enforcement e verifica
- Integrazione: due report concorrenti con la stessa versione ⇒ uno riesce, l'altro riceve 409.
- Contract test: ogni mutazione su risorsa esistente dichiara `If-Match`.

## Domande aperte
Nessuna.
