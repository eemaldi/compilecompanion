# Implementation Roadmap

**Fonte normativa:** spec v1.0. Nessuna feature deferred (§20) è pianificata.
Ogni change set (CS) è piccolo, revisionabile e deve superare gli 11 gate di spec §18 prima del merge. I CS che toccano aree ad alto rischio (§18) hanno un **checkpoint di review umana obbligatorio**.

Legenda rischio: **H** alto (area §18 ad alto rischio), **M** medio, **L** basso.

## Fase 0: Fondamenta e decisioni

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-00 | Scaffold monorepo (pnpm, Turborepo, TS strict), `apps/api` NestJS vuoto, `apps/web` Next.js vuoto, `apps/worker`, `packages/shared-kernel`, `packages/platform`, `packages/api-contract` (OpenAPI 3.1 vuoto), Docker, pipeline CI con tutti gli 11 gate (format, lint, typecheck, unit, invariant, integration con Testcontainers, OpenAPI lint, migration check, dependency-cruiser, SAST, secret scanning) | ADR-001, ADR-002, ADR-013 approvati | Platform | nessuna | `GET /health` | smoke test; test che dimostrano che il boundary check fallisce su un import vietato | M | Sì: struttura e regole di boundary |
| CS-01 | Prisma con multiSchema, schemi per modulo, ruoli/grant DB, script di migration validation (apply su DB vuoto + `migrate diff` pulito) | CS-00, ADR-003 | Platform | `0001_schemas_and_roles` | nessuno | I: grant impediscono scrittura cross-schema | H (migration/infra) | Sì |
| CS-02 | Platform kernel: error taxonomy §15 + mapping problem+json, correlationId middleware, `UnitOfWork`, `Clock`, `OutboxWriter` + tabella + relay worker, `IdempotencyStore`, `AuditRecorder` + `audit.audit_entry` append-only (trigger + REVOKE) | CS-01, ADR-004..009 | Platform, Audit | `0002_platform_outbox_idempotency`, `0003_audit_entry` | nessuno di business | U: mapping errori; I: rollback ⇒ nessuna riga outbox/audit; I: UPDATE/DELETE audit rifiutati; I: idempotency replay + `IDEMPOTENCY_CONFLICT`; S: INTERNAL_ERROR senza stack | H (audit, concurrency) | Sì |

## Fase 1: Identità, tenant, catalogo

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-03 | Identity: `User`, adapter Clerk dietro porta `ExternalIdentityVerifier`, provisioning just-in-time, `ActorContext` | CS-02 | Identity | `0004_identity_user` | `GET /me` | U; I: provisioning idempotente con richieste concorrenti; A: nessun import Clerk fuori da infrastructure; S: token invalido ⇒ `AUTHENTICATION_REQUIRED` | H (authentication) | Sì |
| CS-04 | Organization: Organization, Membership, ruoli, `AuthorizationService`, guard NestJS, tenant filter obbligatorio nei repository, audit modifiche permessi | CS-03, ADR-010, OD-012, OD-018 | Organization, Audit | `0005_organization_membership` | `GET /organizations`, `POST /organizations`, `GET/POST /organizations/{id}/memberships`, `PATCH /organizations/{id}/memberships/{mid}` | U: policy; I: AUTH-TENANT-001..003 (cross-tenant ⇒ NOT_FOUND); S: enumeration test; C | H (authorization, tenant isolation) | Sì |
| CS-05 | Protocol Catalog: Game/Product/Protocol + seed iniziale | CS-02, OD-013 | Catalog | `0006_catalog`, `0007_catalog_seed_v1` | `GET /catalog/products`, `GET /catalog/products/{id}/protocols` | U: nessun limite 45; I: seed 6 Product / 45 Protocol; C | L | No (solo verifica dati seed) |

## Fase 2: Event e partecipazione

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-06 | Event: creazione e configurazione in DRAFT (nome, date, plannedRounds, assignmentMode, Product selezionati, visibilità) | CS-04, CS-05, OD-006, OD-016 | Event | `0008_event` | `POST /organizations/{orgId}/events`, `GET /events/{id}`, `PATCH /events/{id}` (If-Match), `GET /organizations/{orgId}/events` | U: EVT-INV-001/002, EVT-POOL-001/002; I: tenant; C | M | No |
| CS-07 | Event lifecycle registrazione: open/close, snapshot del pool, capacità Random Draft, cancel, audit configurazione post-pubblicazione | CS-06, OD-004, OD-009 | Event, Audit | `0009_event_protocol_pool_snapshot` | `POST /events/{id}/registration:open`, `…:close`, `POST /events/{id}:cancel`, `GET /events/{id}/protocol-pool` | U/P: state machine; I: modifica catalogo non altera snapshot (EVT-POOL-004); I: audit | M | No |
| CS-08 | Participation: register (self e admin), check-in, withdraw, cap Random Draft, divieto late registration | CS-07, OD-001 | Participation, Audit | `0010_participant` | `POST /events/{id}/participants` (Idempotency-Key), `POST /events/{id}/participants:admin-add`, `DELETE …/participants/{pid}` (admin, reason), `POST …/participants/{pid}:check-in`, `…:withdraw`, `GET /events/{id}/participants` | U/P: state machine; I: registrazioni concorrenti oltre capacità ⇒ nessuna eccedenza; I: registrazione concorrente al close; I: idempotency | H (concurrency) | Sì |

## Fase 3: Protocol Assignment e avvio

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-09 | Player Selection: selezione propria tripla, validazione distinti/pool, lettura propri Protocol | CS-08 | Assignment | `0011_assignment` (constraint UNIQUE partecipante/slot/protocol) | `PUT /participants/{pid}/protocols` (If-Match), `GET /participants/{pid}/protocols` | U/P: PRT-INV-001..003, PRT-SEL-001; I: Protocol fuori pool rifiutato a DB e dominio; S: player non modifica la tripla altrui | M | No |
| CS-10 | Random Draft atomico: allocator puro con RNG seedato, generazione e reroll, capacità, errore `PROTOCOL_POOL_INSUFFICIENT`, audit | CS-09, ADR-011, OD-005 | Assignment, Audit | `0012_random_draft` (UNIQUE parziale `(event_id, protocol_id)` per RANDOM_DRAFT, tabella draft) | `POST /events/{id}/random-draft` (Idempotency-Key), `POST /events/{id}/random-draft:reroll` (reason) | P: §16 Protocol Assignment su pool e P variabili; I: doppio draft concorrente; I: fault injection ⇒ zero assegnazioni parziali; I: idempotency | H (Random Draft) | Sì |
| CS-11 | Ready/Start: `MarkReadyToStart`, `StartTournament` (orchestration), assegnazione technical seed, lock assignment, inizializzazione Tournament; override TO post-lock | CS-10, OD-015 | Orchestration, Event, Participation, Assignment, Tournament (solo `tournament_progress`), Audit | `0013_tournament_progress`, `0014_participant_seed` | `POST /events/{id}:mark-ready`, `POST /events/{id}:start` (Idempotency-Key, If-Match), `PUT /participants/{pid}/protocols:override` (reason) | I: doppio start concorrente; I: start con <2 attivi o assignment incompleti ⇒ errore; I: registrazione concorrente allo start ⇒ rifiutata; I: lock ⇒ player rifiutato, TO override auditato; P: seed totale e stabile | H (concurrency, audit) | Sì |

## Fase 4: Tournament Engine (dominio puro)

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-12a | Record e Record Group, `RecordCalculator`, porta `SeedingPolicy` (implementazione provvisoria: solo technical seed) | CS-00, OD-001 | Tournament (domain) | nessuna | nessuno | U | M | No |
| CS-12b | `SwissPairingEngine` + `ByeSelector`: funzione pura, deterministica, con oracolo brute-force per P ≤ 10 | CS-12a, OD-002, ADR-012 | Tournament (domain) | nessuna | nessuno | P: tutte le proprietà §16 Pairing e Bye, determinismo, nessun rematch se evitabile (vs oracolo), float verso il basso, nessun Participant inventato/scartato, `PAIRING_IMPOSSIBLE`; simulazione di tornei completi 2..64 player | H (Tournament Engine) | Sì: revisione delle regole con esempi worked |

## Fase 5: Round, risultati, finalizzazione, standings

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-13 | Results base: `openMatches` (PENDING/BYE→FINAL), stato match, query | CS-11, OD-011 | Results | `0015_match_result` | `GET /matches/{id}` | U: bye FINAL senza report; RES-INV-003 | M | No |
| CS-14 | Generate next round + activate: lettura stato finalizzato, invocazione engine, persistenza round/pairing/seat, `openMatches` | CS-12b, CS-13, OD-010 | Tournament, Results, Audit | `0016_round_pairing` (UNIQUE `(event_id, round_number)`, UNIQUE `(round_id, participant_id)`, CHECK a≠b, bye unico) | `POST /events/{id}/rounds` (Idempotency-Key), `POST /rounds/{id}:activate`, `GET /events/{id}/rounds`, `GET /rounds/{id}/pairings`, `GET /me/events/{id}/current-match` | I: doppio generate concorrente ⇒ un Round; I: round N+1 con N non FINALIZED ⇒ `INVALID_STATE_TRANSITION`; I: idempotency; P: round persistito == output engine | H (Tournament Engine, concurrency) | Sì |
| CS-15 | Report/accept/dispute/resolve con OCC, autorizzazione player/TO, audit risoluzione | CS-14, OD-003, OD-007 | Results, Audit | `0017_match_dispute_resolution` | `POST /matches/{id}/result` (If-Match, Idempotency-Key), `POST /matches/{id}/result:accept`, `…:dispute`, `…:resolve` (TO, reason) | U/P: state machine match; I: report concorrenti ⇒ uno vince, l'altro `CONCURRENT_MODIFICATION`; S: player estraneo ⇒ FORBIDDEN/NOT_FOUND; C | H (concurrency, authorization) | Sì |
| CS-16 | Standings: `StandingsCalculator` puro (OWR, H2H, SoS, seed), sostituzione della `SeedingPolicy` provvisoria | CS-13, OD-002b | Standings | `0018_standings_snapshot` | nessuno (esposto in CS-17) | P: ordinamento totale, invariante all'ordine di input, ricalcolo == snapshot; U: esempi worked approvati | H (Standings) | Sì |
| CS-17 | Finalize round atomico: verifica blocker, `finalizeAllForRound`, `computeAndSnapshot`, trigger immutabilità, `ROUND_NOT_FINALIZABLE` con blocker, audit | CS-15, CS-16, OD-017 | Tournament, Results, Standings, Audit | `0019_finalized_immutability_triggers` | `POST /rounds/{id}:finalize` (If-Match, Idempotency-Key), `GET /events/{id}/standings`, `GET /events/{id}/standings/rounds/{n}` | I: dispute durante finalizzazione; I: finalize simultaneo; I: UPDATE su round/risultati FINALIZED rifiutato anche via SQL applicativo; I: nessuna dispute su round FINALIZED; I: idempotency | H (concurrency, immutabilità) | Sì |

## Fase 6: Fine torneo e operazioni amministrative

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-18 | Drop (self/admin) e disqualification durante il torneo; esclusione dai round successivi | CS-17, OD-008, OD-019 | Participation, Audit | nessuna o `0020_participant_drop_info` | `POST /participants/{pid}:drop`, `POST /participants/{pid}:disqualify` (TO, reason) | U: nessun ritorno automatico ad attivo; I: drop durante round ACTIVE; P: round successivo esclude droppati e conserva storico | M | No |
| CS-19 | Complete tournament ed early termination | CS-17, OD-009 | Orchestration, Event, Tournament, Audit | nessuna | `POST /events/{id}:complete` (Idempotency-Key), `POST /events/{id}:terminate` (reason) | I: complete con round non FINALIZED rifiutato; I: idempotency; I: audit | M | No |
| CS-20 | Audit read API | CS-02, CS-04 | Audit | indice di query | `GET /organizations/{orgId}/audit-entries` | S: solo TO/OWNER; S: cross-tenant ⇒ NOT_FOUND; C: nessun endpoint di scrittura | H (audit) | Sì |

## Fase 7: Verifica end-to-end e frontend MVP

| CS | Obiettivo | Dipendenze | Moduli | Migration | Endpoint | Test | Rischio | Review umana |
|---|---|---|---|---|---|---|---|---|
| CS-21 | Suite e2e "Definition of Correctness" (§22): torneo completo via API in entrambe le modalità, matrice multi-tenant su tutti gli endpoint, matrice permessi §6 | CS-18..20 | Tutti | nessuna | nessuno nuovo | E, S, P (simulazione) | H | Sì |
| CS-22 | Web: shell Next.js, auth Clerk lato client, client OpenAPI generato, viste TO (event, partecipanti, assignment, round, dispute, standings) | CS-21 | apps/web | nessuna | consumati | E (Playwright) su flussi TO | M | No |
| CS-23 | Web: viste player (registrazione, check-in, selezione Protocol, pairing corrente, Protocol avversario, report/accept/dispute, drop), polling | CS-22 | apps/web | nessuna | consumati | E (Playwright); verifica che nessuna invariante sia solo UI | M | No |

## Percorso critico

`CS-00 → CS-01 → CS-02 → CS-03 → CS-04 → CS-06 → CS-07 → CS-08 → CS-09 → CS-10 → CS-11 → CS-14 → CS-15 → CS-17 → CS-21`

Parallelizzabili: CS-05 (dopo CS-02); CS-12a/12b (dopo CS-00, in parallelo alle fasi 1-3, subordinati a OD-002); CS-16 (dominio puro, dopo OD-002b); CS-20 (dopo CS-04).

## Fuori roadmap (deferred, §20)

Nessun CS per: ban/allow-list di Protocol, competitive seeding avanzato, app mobile nativa, pagamenti, ranking globale, leghe, Top N playoff, real-time, chat, streaming, push, offline-first, import/export avanzati, API pubbliche, webhooks, multi-game, BO3/BO5, regole DRAW, Notifications, Platform Administrator.
