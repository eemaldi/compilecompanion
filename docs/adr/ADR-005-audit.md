# ADR-005: Audit sincrono e append-only

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §2.10, §10, §13, AP-05; AUD-*
- **Change set impattati:** CS-02 e tutti i CS con operazioni auditate

## Contesto
Le operazioni amministrative e sensibili devono essere auditate; l'audit è append-only e non contiene business logic.

## Decisione
1. `AuditRecorder.record(tx, entry)` scrive su `audit.audit_entry` **nella stessa transazione** dell'operazione. Nessuna operazione auditata può essere committed senza la sua entry, e viceversa.
2. **Schema della entry:**

   | Campo | Tipo |
   |---|---|
   | `id` | uuid v7 |
   | `occurred_at` | timestamptz |
   | `organization_id` | NOT NULL |
   | `event_id` | NULL quando non applicabile |
   | `actor_id` | NOT NULL |
   | `actor_kind` | `USER` \| `SYSTEM` |
   | `action` | testo namespaced, es. `tournament.round.finalized` |
   | `entity_type` | testo |
   | `entity_id` | id |
   | `previous_state` | jsonb |
   | `resulting_state` | jsonb |
   | `reason` | testo, NULL ammesso |
   | `correlation_id` | NOT NULL |

3. Per le azioni nell'elenco `SENSITIVE_ACTIONS` (override assignment, reroll, risoluzione dispute, disqualification, drop amministrativo, rimozione Participant, early termination, modifiche di permission) `reason` è obbligatoria: il controllo è sia nel contract OpenAPI sia nel recorder, che rifiuta.
4. **Append-only a DB:** `REVOKE UPDATE, DELETE, TRUNCATE` al ruolo applicativo e trigger `BEFORE UPDATE OR DELETE` che solleva un'eccezione.
5. `previous_state` e `resulting_state` contengono solo i campi rilevanti, senza segreti né PII non necessaria. Il modulo emittente fornisce uno snapshot serializzato; Audit non lo interpreta.
6. La read API è filtrata per Organization e richiede il permesso `AUDIT_READ` (ADR-010). Non esistono endpoint di scrittura.

## Alternative considerate
- **Audit via outbox (asincrono):** introduce una finestra in cui l'operazione è committed ma l'audit non è ancora scritto, e un rischio di perdita. Scartata.
- **Trigger DB generici sulle tabelle:** non catturano actor, reason e correlation in modo affidabile. Scartata.

## Conseguenze
- (+) Garanzia forte di osservabilità del potere amministrativo.
- (−) La crescita della tabella va gestita con indici `(organization_id, occurred_at)` e `(event_id)`; la retention resta una decisione aperta.

## Enforcement e verifica
- Test di integrazione per ciascuna categoria di §13.
- Test che `UPDATE`/`DELETE` su `audit_entry` falliscono.
- Test che il rollback dell'operazione rimuove anche la entry.

## Domande aperte
- Retention e anonimizzazione (GDPR) dell'audit: fuori MVP, richiederà un ADR dedicato.
