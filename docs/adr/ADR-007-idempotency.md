# ADR-007: Idempotency delle operazioni critiche

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §14.6, §15; IDEM-001..003
- **Change set impattati:** CS-02, CS-08, CS-10, CS-11, CS-14, CS-15, CS-17, CS-19

## Contesto
Il retry della stessa richiesta non deve duplicare effetti. Una chiave riutilizzata con payload diverso deve restituire `IDEMPOTENCY_CONFLICT`.

## Decisione
1. **Header `Idempotency-Key`** (UUID generato dal client). È **obbligatorio** su:
   - create registration;
   - Random Draft e reroll;
   - Tournament Start;
   - Generate Round;
   - report result;
   - Finalize Round;
   - Complete e Terminate Tournament.

   È facoltativo sulle altre mutazioni. Rendere obbligatorio un SHOULD è più restrittivo e non contraddice la spec.
2. **Tabella `platform.idempotency_key`:**
   - chiave primaria: `(actor_id, operation, key)`, dove `operation` è il route template;
   - `request_hash`: SHA-256 del body canonicalizzato più i path param;
   - `status`: `IN_PROGRESS` | `COMPLETED`;
   - `response_status`, `response_body`, `created_at`, `expires_at`.
3. **Flusso:**
   1. nella stessa transazione dell'effetto: `INSERT … ON CONFLICT DO NOTHING`;
   2. se la chiave esiste già con hash diverso ⇒ `IDEMPOTENCY_CONFLICT` (422);
   3. se esiste con stato `COMPLETED` ⇒ si restituisce la risposta memorizzata;
   4. se un'altra transazione la sta processando, la riga è bloccata: si attende il lock e poi si applica il caso 3.
4. La risposta viene salvata nella stessa transazione dell'effetto, quindi chiave ed effetto sono committed insieme o nessuno dei due.
5. TTL di 24 ore; job di purge.
6. L'idempotency è una seconda difesa: i vincoli di dominio (UNIQUE `(event_id, round_number)`, lock su draft e start) restano la protezione primaria anche senza chiave.

## Alternative considerate
- **Idempotency in middleware fuori transazione:** finestra tra effetto e registrazione della chiave. Scartata.
- **Solo vincoli di dominio:** sufficienti per non duplicare, ma il secondo tentativo riceverebbe un errore invece della risposta originale. Scartata come unica difesa.

## Conseguenze
- (+) Retry sicuri da client mobili con rete instabile.
- (−) Il client deve generare e conservare la chiave per ogni intento.

## Enforcement e verifica
- Integrazione: retry ⇒ stessa risposta e un solo effetto.
- Integrazione: payload diverso ⇒ `IDEMPOTENCY_CONFLICT`.
- Integrazione: due richieste simultanee con la stessa chiave ⇒ un solo effetto.
- OpenAPI: l'header è dichiarato `required` sugli endpoint elencati.

## Domande aperte
Nessuna.
