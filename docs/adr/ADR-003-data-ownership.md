# ADR-003: Data ownership fisica: schema per modulo

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §11, §17.2; ARCH-OWN-001, OD-011
- **Change set impattati:** CS-01 e tutti i CS con migration

## Contesto
"Un modulo MUST NOT scrivere direttamente nelle tabelle possedute da un altro modulo" (§11). Serve un confine fisico, non solo una convenzione.

## Decisione
1. **Uno schema PostgreSQL per modulo:** `identity`, `organization`, `catalog`, `event`, `participation`, `assignment`, `tournament`, `results`, `standings`, `audit`, più `platform` (outbox e idempotency).
2. **Un ruolo DB per modulo** (`cc_<modulo>`) con `USAGE` e DML solo sul proprio schema. Il runtime usa un login role `cc_app` che, per ogni modulo, esegue le query con `SET LOCAL ROLE cc_<modulo>` dentro la transazione condivisa (ADR-004). In questo modo un repository che tenta di scrivere su un altro schema fallisce a DB. `cc_migrator` è l'unico ruolo con DDL.
3. **Prisma multiSchema con un client generato per modulo** (`prisma/<modulo>.prisma`), così il client di un modulo non espone i modelli di un altro. Le migration restano SQL versionate e ordinate in un'unica sequenza (`packages/platform/migrations`), generate da Prisma e completate a mano con constraint, partial index e trigger.
4. **Nessuna foreign key tra schemi diversi.** I riferimenti cross-module sono ID tipizzati. L'esistenza è verificata dall'application service chiamante nella stessa transazione. Le FK interne a uno schema sono obbligatorie.
5. **`organization_id`** denormalizzato e immutabile su ogni tabella tenant-scoped.
6. **Ownership del Match (OD-011):** `tournament.pairing` (chi gioca contro chi, tavolo, bye, `is_rematch`) appartiene a Tournament; `results.match_result` (stato, outcome, report, dispute, resolution, `version`) appartiene a Results, 1:1 tramite `match_id`. Il bye viene creato da `ResultsService.openMatches` direttamente in stato `FINAL` con outcome BYE.
7. **Versione minima PostgreSQL: 16.** Servono schemi, partial unique index, `SKIP LOCKED`, `SET LOCAL ROLE` e trigger.

## Alternative considerate
- **Un ruolo unico con solo lint:** più semplice, ma la violazione non viene bloccata a runtime. Scartata.
- **Database separati per modulo:** impedirebbero le transazioni ACID cross-module richieste da start e finalizzazione. Scartata.
- **FK cross-schema:** darebbero più integrità, ma accoppierebbero le migration tra moduli e permetterebbero cascade cross-module. Scartata.

## Conseguenze
- (+) Violazioni di ownership bloccate dal database.
- (−) `SET LOCAL ROLE` a ogni cambio di modulo dentro la transazione: overhead trascurabile, ma va incapsulato in `platform`.
- (−) L'integrità referenziale cross-module dipende dagli application service; è coperta da test di integrazione.

## Enforcement e verifica
- Test di integrazione: un repository del modulo A che scrive nello schema B fallisce con `permission denied`.
- Migration validation in CI: apply su DB vuoto, `prisma migrate diff` senza drift, verifica dei grant.

## Domande aperte
- Se l'hosting PostgreSQL scelto in futuro non permettesse ruoli multipli o `SET ROLE`, il fallback è "ruolo unico + client Prisma per schema + lint", da registrare con un ADR che sostituisce questo.
