# Architecture Decision Records

Precedenza normativa (spec §0.2): specification > **ADR approvati** > OpenAPI > documentazione implementativa > codice.

Un ADR è vincolante solo con stato `Accepted`. Gli ADR `Proposed` non autorizzano implementazioni che dipendono dalla decisione.
Un ADR non può modificare la semantica della specification: se lo fa, richiede anche un aggiornamento della spec (§23).

Stati: `Proposed` → `Accepted` | `Rejected`; `Accepted` → `Superseded by ADR-xxx`.
Approvazione: cambio di stato a `Accepted` con nome dell'approvatore e data, in un commit dedicato.

| ADR | Titolo | Stato | Blocca |
|---|---|---|---|
| [ADR-001](ADR-001-monorepo-structure.md) | Struttura del monorepo e wiring dei framework | Proposed | CS-00 |
| [ADR-002](ADR-002-module-layering.md) | Layering dei moduli e orchestration layer | Proposed | CS-00 |
| [ADR-003](ADR-003-data-ownership.md) | Data ownership fisica: schema per modulo | Proposed | CS-01 |
| [ADR-004](ADR-004-transactions.md) | Transazioni cross-module e Unit of Work | Proposed | CS-02 |
| [ADR-005](ADR-005-audit.md) | Audit sincrono e append-only | Proposed | CS-02 |
| [ADR-006](ADR-006-transactional-outbox.md) | Transactional outbox | Proposed | CS-02 |
| [ADR-007](ADR-007-idempotency.md) | Idempotency delle operazioni critiche | Proposed | CS-02 |
| [ADR-008](ADR-008-optimistic-concurrency.md) | Optimistic concurrency via HTTP | Proposed | CS-02 |
| [ADR-009](ADR-009-error-format.md) | Formato degli errori HTTP | Proposed | CS-02 |
| [ADR-010](ADR-010-authorization.md) | Modello di authorization e tenant isolation | Proposed | CS-04 |
| [ADR-011](ADR-011-randomness.md) | Randomness riproducibile | Proposed | CS-10, CS-11 |
| [ADR-012](ADR-012-pairing-algorithm.md) | Algoritmo e funzione obiettivo del pairing | Proposed | CS-12b |
| [ADR-013](ADR-013-openapi-contract-first.md) | OpenAPI contract-first | Proposed | CS-00 |

Template: [ADR-000-template.md](ADR-000-template.md).
