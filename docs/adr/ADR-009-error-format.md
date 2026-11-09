# ADR-009: Formato degli errori HTTP

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §15; ERR-FMT-001/002, ERR-INT-001
- **Change set impattati:** CS-02 e tutti gli endpoint

## Contesto
Gli errori devono essere machine-readable, con codice, messaggio sicuro e correlation id. INTERNAL_ERROR non deve esporre dettagli sensibili.

## Decisione
1. **Formato RFC 9457 `application/problem+json`** esteso:
   ```json
   {
     "type": "https://compilecompanion.app/errors/round-not-finalizable",
     "title": "Round not finalizable",
     "status": 409,
     "code": "ROUND_NOT_FINALIZABLE",
     "detail": "<messaggio sicuro>",
     "correlationId": "…",
     "details": { "blockers": [ { "matchId": "…", "reason": "DISPUTED" } ] }
   }
   ```
   `code` è il campo normativo; `type` e `title` sono informativi.
2. **Mapping codice → status HTTP:**

   | Codice | Status |
   |---|---|
   | VALIDATION_ERROR | 400 (422 per errori semantici) |
   | AUTHENTICATION_REQUIRED | 401 |
   | FORBIDDEN | 403 |
   | NOT_FOUND | 404 |
   | INVALID_STATE_TRANSITION | 409 |
   | PROTOCOL_POOL_INSUFFICIENT | 409 |
   | PROTOCOL_ASSIGNMENT_CONFLICT | 409 |
   | PAIRING_IMPOSSIBLE | 409 |
   | RESULT_DISPUTED | 409 |
   | ROUND_NOT_FINALIZABLE | 409 |
   | CONCURRENT_MODIFICATION | 409 |
   | IDEMPOTENCY_CONFLICT | 422 |
   | INTERNAL_ERROR | 500 |

3. **Campi `details` obbligatori per codice:**
   - `PROTOCOL_POOL_INSUFFICIENT`: `requiredProtocolCount`, `availableProtocolCount`, `participantCount`, `maximumParticipantCount`;
   - `ROUND_NOT_FINALIZABLE`: `blockers[]`;
   - `VALIDATION_ERROR`: `fieldErrors[]`.
4. **Gli errori di dominio sono valori**, non eccezioni: union discriminata `DomainError` in `shared-kernel`. Solo `apps/api` li traduce in HTTP. Le eccezioni non previste diventano INTERNAL_ERROR con il solo correlation id, mentre stack e dettagli finiscono nei log.
5. `correlationId` viene dall'header `X-Request-Id` se valido, altrimenti è generato. È propagato nei log, nell'audit e nell'outbox.
6. La regola su `FORBIDDEN` e `NOT_FOUND` per le risorse di altri tenant è definita in ADR-010.

## Alternative considerate
- **Formato proprietario `{error:{code,message}}`:** equivalente ma non standard. Scartata.

## Conseguenze
- (+) Client e test possono fare branching su `code`; formato stabile.

## Enforcement e verifica
- Schema `Problem` unico in OpenAPI, referenziato da tutte le risposte 4xx/5xx.
- Test di sicurezza: un'eccezione forzata ⇒ nessuno stack nella risposta.
- Unit test: mapping completo dei 13 codici.

## Domande aperte
- Il dominio `compilecompanion.app` in `type` è un placeholder: va sostituito con un URI stabile qualsiasi, anche non risolvibile.
