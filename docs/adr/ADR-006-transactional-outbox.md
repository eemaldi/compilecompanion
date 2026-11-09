# ADR-006: Transactional outbox

- **Stato:** Proposed
- **Data:** 2026-11-09
- **Approvatore:** —
- **Requisiti spec:** §1, §12, §21; OUT-OBX-001/002, NOTIF-001
- **Change set impattati:** CS-02

## Contesto
Gli eventi che richiedono processing asincrono devono passare da un transactional outbox committed insieme alla transazione business. Queue esterne e Redis non possono essere requisiti del core.

## Decisione
1. **Tabella `platform.outbox_event`:**

   | Campo | Note |
   |---|---|
   | `id` | uuid v7, usato anche come event id |
   | `event_type` | es. `RoundFinalized` |
   | `event_version` | int |
   | `aggregate_type`, `aggregate_id` | |
   | `organization_id` | |
   | `payload` | jsonb |
   | `occurred_at` | |
   | `correlation_id` | |
   | `available_at` | |
   | `attempts` | |
   | `published_at` | NULL finché non consegnato |
   | `last_error` | NULL ammesso |

2. `OutboxWriter.append(tx, event)` è l'unico modo di pubblicare. Gli eventi sono emessi dagli aggregate e raccolti dall'application service.
3. **Relay** in `apps/worker`:
   - polling con `SELECT … FOR UPDATE SKIP LOCKED LIMIT n`;
   - consegna ai subscriber in-process registrati;
   - `published_at` valorizzato a successo;
   - backoff esponenziale sugli errori.

   La consegna è **at-least-once**, ordinata per `aggregate_id` e `occurred_at` ma senza garanzia globale.
4. **Consumer idempotenti:** tabella `platform.consumed_event(consumer, event_id)` con chiave primaria composta.
5. I payload degli eventi sono contratti versionati e definiti nel `contract` del modulo emittente.
6. **Nessuna invariante competitiva dipende da eventi asincroni** (AP-03). Nel MVP i consumer sono solo proiezioni (es. `Event.currentRound`).
7. Il trasporto è sostituibile: la porta `EventPublisher` del relay permetterà in futuro una queue esterna senza toccare i moduli.

## Alternative considerate
- **Pubblicazione diretta dopo il commit:** perde eventi in caso di crash. Scartata.
- **LISTEN/NOTIFY:** utile per ridurre la latenza in futuro, ma non sostituisce la tabella. Rinviato.
- **Relay nel processo API:** ammesso in sviluppo locale; in produzione va in un processo separato per isolare i carichi.

## Conseguenze
- (+) Nessuna perdita né pubblicazione prematura.
- (−) Latenza pari all'intervallo di polling, accettabile senza real-time.

## Enforcement e verifica
- Integrazione: rollback ⇒ nessuna riga outbox.
- Integrazione: relay concorrenti ⇒ ogni evento consegnato almeno una volta e processato una sola volta per consumer.

## Domande aperte
- Retention di `outbox_event` pubblicati (proposta: purge dopo 30 giorni). Non semantica, decidibile in implementazione.
