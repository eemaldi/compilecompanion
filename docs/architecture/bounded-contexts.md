# Bounded Contexts

**Fonte normativa:** spec v1.0 §2, §3, §10, §11, §12. Nessun ADR approvato al momento.
Le scelte marcate **[PROPOSTA]** sono dettagli implementativi (spec §17.4) o richiedono ADR dove indicato (`open-decisions.md`).

## Convenzioni comuni

- Ogni modulo vive in `packages/modules/<module>` (vedi `module-dependencies.md`) con layer `domain` / `application` / `infrastructure` / `api` (contract pubblico).
- Ogni modulo possiede uno **schema PostgreSQL dedicato** **[PROPOSTA, ADR-003]**: `identity`, `organization`, `catalog`, `event`, `participation`, `assignment`, `tournament`, `results`, `standings`, `audit`. Lo schema `platform` contiene outbox e idempotency (infrastruttura, non business).
- Tutte le entità tenant-scoped portano `organization_id` (denormalizzato e immutabile) per permettere il filtro obbligatorio nei repository.
- Riferimenti cross-module sono **solo ID** (value object tipizzati, es. `EventId`), mai FK fisiche verso tabelle di altri schemi **[PROPOSTA]**; l'integrità referenziale cross-module è garantita dall'application service chiamante entro la stessa transazione.
- "Dati leggibili da altri moduli" = esposti tramite **query service read-only** del modulo (`<Module>Queries`), mai tramite accesso diretto alle tabelle.
- Gli eventi elencati sono quelli della spec §12; quelli marcati *(interno)* sono aggiunte proposte, non pubblicate fuori dal modulo senza ADR.
- `actor` = `ActorContext { userId, organizationId?, roles, correlationId }` costruito da Platform/Identity e passato esplicitamente a ogni application service.

---

## 1. Identity

| Voce | Contenuto |
|---|---|
| Responsabilità | Utente applicativo interno; associazione con identità Clerk; stato applicativo dell'utente (§2.1). |
| Aggregate root | `User` |
| Entità / VO | `UserId` (UUID interno), `ExternalIdentityId` (VO opaco, provider-agnostic), `DisplayName`, `UserStatus` (`ACTIVE`, `SUSPENDED` **[PROPOSTA]**). |
| Dati posseduti | `identity.user` |
| Servizi pubblici | `IdentityService.resolveOrProvisionUser(externalIdentityId, profile)`; `IdentityQueries.getUser(userId)`, `getUsersByIds(ids)`. |
| Repository contract | `UserRepository { findById, findByExternalIdentityId, save }` |
| Eventi prodotti | *(interno)* `UserProvisioned` |
| Eventi consumati | nessuno |
| Leggibile da altri | `UserId`, `displayName`, `status`. |
| Dipendenze consentite | `shared-kernel`. Adapter infrastrutturale `ClerkAuthenticationAdapter` implementa la porta `ExternalIdentityVerifier` (solo infrastructure). |
| Dipendenze vietate | Organization, qualsiasi modulo di torneo; Clerk SDK nel domain/application; uso dell'ID Clerk come PK o come identificatore in altri moduli (IDN-USER-002). Non possiede membership né permessi. |

## 2. Organization

| Voce | Contenuto |
|---|---|
| Responsabilità | Tenant; membership; ruoli organizzativi; **policy di authorization tenant-scoped** (decisione "può l'attore X fare l'azione Y nell'Organization Z?"). |
| Aggregate root | `Organization` (contiene `Membership` come entità) **[PROPOSTA]**: membership modificata solo tramite l'aggregate per garantire "almeno un OWNER". |
| Entità / VO | `OrganizationId`, `OrganizationName`, `OrganizationStatus`, `Membership`, `MembershipRole` (VO estendibile: `OWNER`, `TO`, `MEMBER`), `MembershipStatus`, `Permission` (VO, es. `EVENT_MANAGE`, `AUDIT_READ`). |
| Dati posseduti | `organization.organization`, `organization.membership` |
| Servizi pubblici | `OrganizationService.createOrganization`, `addMembership`, `changeMembershipRole`, `ensurePersonalOrganization(userId)` (OD-012); `AuthorizationService.assertPermission(actor, organizationId, permission)` / `can(...)`; `OrganizationQueries.listMembershipsForUser(userId)`. |
| Repository contract | `OrganizationRepository { findById, save }`, `MembershipReadRepository { findActiveByUserAndOrg }` |
| Eventi prodotti | `OrganizationCreated`, `MembershipAdded`, `MembershipRoleChanged` |
| Eventi consumati | nessuno nel core |
| Leggibile da altri | Membership attive e ruoli di un utente (solo via `AuthorizationService`/`OrganizationQueries`). |
| Dipendenze consentite | `shared-kernel`, `IdentityQueries` (validazione esistenza utente), `AuditRecorder`. |
| Dipendenze vietate | Event e moduli di torneo (la policy è espressa su permessi astratti, non su stati di torneo); Clerk organizations come fonte di verità dei ruoli (ARCH-STACK-005). |

## 3. Protocol Catalog

| Voce | Contenuto |
|---|---|
| Responsabilità | Game, Product, Protocol, appartenenza Protocol→Product, disponibilità prodotti. Non conosce i tornei (§2.3). |
| Aggregate root | `Product` (con `Protocol` come entità); `Game` come aggregate di riferimento. |
| Entità / VO | `GameId`, `ProductId`, `ProductCode` (stabile, es. `MAIN_1`), `ProductKind` (`MAIN`, `AUX`, estendibile), `ProtocolId`, `CatalogNumber` (attributo, nessun massimo), `ProtocolName`, `Availability`. |
| Dati posseduti | `catalog.game`, `catalog.product`, `catalog.protocol` |
| Servizi pubblici | `CatalogQueries.listProducts(gameId)`, `getProtocolsForProducts(productIds)` → `ProtocolDescriptor[]` (id, productId, number, name). Scritture solo via migration/seed nella v1 **[PROPOSTA]**. |
| Repository contract | `ProductRepository { findAll, findByIds }` |
| Eventi prodotti | nessuno nella v1 |
| Eventi consumati | nessuno |
| Leggibile da altri | Product e Protocol (pubblici, non tenant-scoped). |
| Dipendenze consentite | `shared-kernel` |
| Dipendenze vietate | Qualsiasi altro modulo. |

## 4. Event

| Voce | Contenuto |
|---|---|
| Responsabilità | Configurazione torneo; lifecycle dell'Event; date; plannedRounds; Product ammessi e **snapshot dell'EventProtocolPool**; assignment mode; orchestrazione delle transizioni di lifecycle (§2.4). Non implementa il pairing (§10). |
| Aggregate root | `Event` |
| Entità / VO | `EventId`, `EventName`, `EventStatus` (state machine §5.1), `AssignmentMode` (`PLAYER_SELECTION` \| `RANDOM_DRAFT`), `PlannedRounds`, `CurrentRound` (proiezione, vedi nota), `RegistrationSettings`, `EventProductConfiguration` (entità: productId selezionati), `ProtocolPoolSnapshot` (VO: insieme di `{protocolId, productId}` fissato alla creazione dell'Event e immutabile, OD-004), `RandomDraftCapacity` (derivato `floor(N/3)`). |
| Dati posseduti | `event.event`, `event.event_product_configuration`, `event.event_protocol_pool` (snapshot) |
| Servizi pubblici | `EventService.createEvent`, `updateConfiguration`, `openRegistration`, `closeRegistration`, `enterProtocolAssignment`, `markReadyToStart(facts)`, `startTournament(facts)`, `completeTournament(facts)`, `cancelEvent` (le transizioni che dipendono da fatti di altri moduli ricevono i fatti dall'orchestration layer, che li legge nella stessa transazione); `EventQueries.getEvent`, `getProtocolPool(eventId)`, `getRegistrationCapacity(eventId)`, `getLifecycleState(eventId)`. |
| Repository contract | `EventRepository { findById(orgScope, id), save(event, expectedVersion) }` |
| Eventi prodotti | `EventCreated`, `RegistrationOpened`, `RegistrationClosed`, `EventReadyToStart`, `TournamentStarted`, `TournamentCompleted`, `EventCancelled` |
| Eventi consumati | nessuno in modo sincrono-critico. `RoundFinalized` MAY essere consumato via outbox per aggiornare `currentRound` come proiezione **[PROPOSTA]**; la fonte autorevole del round corrente resta Tournament. |
| Leggibile da altri | stato lifecycle, organizationId, assignmentMode, plannedRounds, pool snapshot, capacità Random Draft. |
| Dipendenze consentite | `shared-kernel`, `CatalogQueries` (risoluzione Product→Protocol al momento dello snapshot), `AuthorizationService`, `AuditRecorder`. |
| Dipendenze vietate | Participation, Assignment, Tournament, Results, Standings (sono moduli *downstream*: dipendono da Event, non viceversa). Il coordinamento start/ready/complete avviene in `orchestration`. |

> Nota: Event non chiama moduli downstream. Gli use case cross-module (`MarkReadyToStart`, `StartTournament`, `CompleteTournament`) vivono nel layer `orchestration` (vedi `module-dependencies.md` §3), che apre un'unica transazione, prende il lock sull'Event e invoca nell'ordine i servizi pubblici di Participation, Assignment, Tournament ed Event.

## 5. Participation (Registration & Participation)

| Voce | Contenuto |
|---|---|
| Responsabilità | Registrazione, check-in, stato del Participant, withdraw, drop, disqualification, associazione User/Event; enforcement del divieto di late registration e del cap Random Draft (§2.5, §4.2). Assegnazione del **technical seed** (OD-015). |
| Aggregate root | `Participant` |
| Entità / VO | `ParticipantId`, `UserId` (ref), `EventId` (ref), `ParticipantStatus` (`REGISTERED`, `CHECKED_IN`, `WITHDRAWN`, `DROPPED`, `DISQUALIFIED`), `Registration` (entità/metadata: registeredAt, source self/admin), `TechnicalSeed` (VO), `DropInfo` (effectiveAfterRound, reason). |
| Dati posseduti | `participation.participant`, `participation.registration` |
| Servizi pubblici | `ParticipationService.register`, `adminAdd`, `adminRemove`, `checkIn`, `withdraw`, `drop`, `disqualify`, `assignTechnicalSeeds(eventId)` (invocato dall'orchestration a start, OD-015); `ParticipationQueries.listActiveParticipants(eventId, asOfRound?)`, `countActive`, `getParticipantForUser(eventId, userId)`. |
| Repository contract | `ParticipantRepository { findById, findByEventAndUser, listByEvent, countByEventForUpdate, save(p, expectedVersion) }` |
| Eventi prodotti | `ParticipantRegistered`, `ParticipantCheckedIn`, `ParticipantDropped`, `ParticipantDisqualified`; *(interno)* `ParticipantWithdrawn` |
| Eventi consumati | nessuno (lo stato Event viene letto in transazione, non tramite eventi, per evitare race su late registration). |
| Leggibile da altri | elenco Participant attivi, stato, seed, userId. |
| Dipendenze consentite | `shared-kernel`, `EventQueries` (stato, capacità; letto con lock in TX), `IdentityQueries`, `AuthorizationService`, `AuditRecorder`. |
| Dipendenze vietate | Assignment, Tournament, Results, Standings; scrittura di risultati Match (PAR-API-001). |

## 6. Protocol Assignment

| Voce | Contenuto |
|---|---|
| Responsabilità | Player Selection; Random Draft; validazione; lock; override TO (§2.6). Referenzia Protocol del catalogo tramite il pool snapshot dell'Event. |
| Aggregate root | `EventAssignmentSet` **[PROPOSTA]**: un aggregate per Event che contiene gli assignment di tutti i Participant. Motivo: unicità globale Random Draft e lock sono invarianti a livello Event. Persistito come righe per Participant/slot con `version` sull'header. |
| Entità / VO | `ParticipantAssignment` (entità: participantId, 3 slot), `ProtocolTriple` (VO: esattamente 3 `ProtocolId` distinti), `AssignmentLockState` (`EDITABLE` \| `LOCKED`), `RandomDraft` (entità: draftId, seed, generatedAt, generatedBy, status `ACTIVE`/`SUPERSEDED`), `Override` (record di modifica post-lock). Domain service: `RandomDraftAllocator` (puro, RNG iniettato), `AssignmentValidator`. |
| Dati posseduti | `assignment.assignment_set` (header per Event: mode, lock state, version), `assignment.protocol_assignment`, `assignment.random_draft`, `assignment.lock_metadata` |
| Servizi pubblici | `AssignmentService.selectProtocols(actor, participantId, triple)`, `generateRandomDraft(actor, eventId, idempotencyKey)`, `rerollRandomDraft` (OD-005), `overrideAssignment(actor, participantId, triple, reason)`, `validateCompleteness(eventId)`, `lockAll(eventId)` (chiamato solo dall'use case `StartTournament` nella stessa TX); `AssignmentQueries.getAssignment(participantId)`, `getAssignments(participantIds)`. La vista "Protocol dell'avversario corrente" è composta dall'orchestration read facade (Tournament fornisce l'avversario, Assignment i Protocol). |
| Repository contract | `AssignmentSetRepository { loadForUpdate(eventId), save(set, expectedVersion) }` |
| Eventi prodotti | `ProtocolsSelected`, `RandomDraftGenerated`, `ProtocolAssignmentsLocked`, `ProtocolAssignmentOverridden` |
| Eventi consumati | nessuno nel core |
| Leggibile da altri | assignment per Participant; stato lock; completezza. |
| Dipendenze consentite | `shared-kernel`, `EventQueries` (pool snapshot, mode, stato), `ParticipationQueries` (attivi), `AuthorizationService`, `AuditRecorder`, porta `RandomSource`. |
| Dipendenze vietate | `CatalogQueries` diretto per la validazione (il pool è quello snapshot dell'Event, non il catalogo corrente); `EventService` (comandi); Tournament, Results, Standings. |

## 7. Tournament (Tournament Engine)

| Voce | Contenuto |
|---|---|
| Responsabilità | Record W-L, Record Group, pairing, float, rematch avoidance, bye, uso del seeding, generazione/attivazione/finalizzazione dei Round, progressione del torneo (§2.7, §10). |
| Aggregate root | `Round` (per Event e roundNumber). `TournamentProgress` (per Event: ultimo round, stato) **[PROPOSTA]** come aggregate leggero per serializzare la generazione. |
| Entità / VO | `RoundId`, `RoundNumber`, `RoundStatus` (§5.3), `Pairing` (= Match strutturale: matchId, tableNumber, participantA, participantB \| BYE, `isRematch`, `floatInfo`), `RecordWL`, `RecordGroup`. Domain service puri: `SwissPairingEngine.pair(input: PairingInput): PairingResult \| PairingImpossible`, `ByeSelector`, `RecordCalculator`. `PairingInput` = { participanti attivi con seed, storia degli incontri finalizzati, bye precedenti, record } — nessun I/O. |
| Dati posseduti | `tournament.tournament_progress`, `tournament.round`, `tournament.pairing`, `tournament.round_seat` (participantId per round, UNIQUE) |
| Servizi pubblici | `TournamentService.generateNextRound(actor, eventId, idempotencyKey)`, `activateRound(actor, roundId)`, `finalizeRound(actor, roundId, expectedVersion, idempotencyKey)`, `initialize(eventId)` (dall'use case `StartTournament`); `TournamentQueries.getRound`, `getPairingsForRound`, `getMatchParticipants(matchId)`, `getCurrentOpponent(participantId)`, `getProgress(eventId)`. |
| Repository contract | `RoundRepository { findById, findLatestForEvent, insert (UNIQUE event_id, round_number), save(round, expectedVersion) }`, `ProgressRepository { loadForUpdate(eventId) }` |
| Eventi prodotti | `RoundCreated`, `PairingsGenerated`, `RoundActivated`, `RoundReadyToFinalize`, `RoundFinalized` |
| Eventi consumati | nessuno in modo critico; la readiness del Round è verificata in modo sincrono via `ResultsQueries` in TX (non tramite eventi asincroni, AP-03). |
| Leggibile da altri | Round, pairing, partecipanti di un match, stato del round, progressione. |
| Dipendenze consentite | `shared-kernel`, `EventQueries`, `ParticipationQueries`, `ResultsQueries` (stato dei match del round, storia finalizzata), `ResultsService.openMatches`/`finalizeAllForRound` (OD-011), `StandingsService.computeAndSnapshot` e `StandingsQueries` (in finalizzazione, OD-017), porta `SeedingPolicy` (implementata da Standings), `AuthorizationService`, `AuditRecorder`. |
| Dipendenze vietate | Event commands; Assignment; scrittura su tabelle Results/Standings; HTTP/NestJS/Prisma nel domain; librerie Swiss generiche (TRN-RND-008); Notifications. |

## 8. Results (Match & Results)

| Voce | Contenuto |
|---|---|
| Responsabilità | Ciclo di vita del risultato di ciascun Match: report, accept, dispute, resolve, finalizzazione del risultato (§2.8). Il Match strutturale (chi gioca contro chi) è posseduto da Tournament come `Pairing`; Results possiede `MatchResult` 1:1 con `matchId` **[PROPOSTA, OD-011]**. |
| Aggregate root | `MatchResult` |
| Entità / VO | `MatchId` (ref Pairing), `MatchResultStatus` (`PENDING`, `REPORTED`, `DISPUTED`, `RESOLVED`, `FINAL`, `BYE`), `Outcome` (rappresentato come `winnerParticipantId` + `kind: WIN_LOSS \| DRAW \| BYE`; DRAW non accettato da API v1, OD-007), `Report` (reportedBy, reportedAt), `Acceptance`, `Dispute` (openedBy, reason), `Resolution` (resolvedBy, outcome, reason), `Version`. |
| Dati posseduti | `results.match_result` (include copia immutabile di `roundId`, `roundNumber`, `participantA`, `participantB?` ricevuta da Tournament in `openMatches`: reference data, non ownership), `results.match_dispute`, `results.match_resolution` |
| Servizi pubblici | `ResultsService.openMatches(roundId, pairings)` (crea PENDING/BYE, chiamato da Tournament in TX), `report(actor, matchId, outcome, expectedVersion, idempotencyKey)`, `accept`, `dispute`, `resolve(actor, matchId, outcome, reason, expectedVersion)`, `finalizeAllForRound(roundId)` (chiamato da Tournament in TX); `ResultsQueries.getRoundResultSummary(roundId)` (blocker), `getFinalizedResults(eventId)`. |
| Repository contract | `MatchResultRepository { findById, listByRoundForUpdate, save(result, expectedVersion) }` |
| Eventi prodotti | `MatchResultReported`, `MatchResultAccepted`, `MatchResultDisputed`, `MatchDisputeResolved`, `MatchFinalized` |
| Eventi consumati | nessuno |
| Leggibile da altri | stato e outcome dei match; sommario per round; risultati finalizzati per Event. |
| Dipendenze consentite | `shared-kernel`, `EventQueries` (organizationId), `ParticipationQueries` (mappa participant→user per autorizzare il player), `AuthorizationService`, `AuditRecorder`. L'immutabilità post-finalizzazione è garantita dallo stato `FINAL` del `MatchResult` (impostato da `finalizeAllForRound` nella TX di finalizzazione) e da trigger DB. |
| Dipendenze vietate | Tournament (qualsiasi), Standings, Event commands. |

## 9. Standings

| Voce | Contenuto |
|---|---|
| Responsabilità | Ranking, Opponents' Win Rate, head-to-head, Strength of Schedule secondario, technical seed come ultimo tie-break; snapshot finalizzati (§2.9, §8). |
| Aggregate root | `StandingsSnapshot` (per Event e roundNumber, immutabile). |
| Entità / VO | `StandingEntry` (participantId, rank, record, owr, h2h, sos, seed), `TieBreakVector`, `WinRate` (razionale esatto, non float **[PROPOSTA]**). Domain service puro: `StandingsCalculator.compute(finalizedResults, participants, seeds)`; implementazione della porta `SeedingPolicy` usata da Tournament. |
| Dati posseduti | `standings.standings_snapshot`, `standings.standing_entry` |
| Servizi pubblici | `StandingsService.computeAndSnapshot(eventId, roundNumber)` (in TX di finalizzazione), `StandingsQueries.getCurrentStandings(eventId)`, `getSnapshot(eventId, round)`; `SeedingPolicy.orderWithinGroup(...)`. |
| Repository contract | `StandingsSnapshotRepository { insert (UNIQUE event_id, round_number), findLatest }` |
| Eventi prodotti | `StandingsCalculated` |
| Eventi consumati | nessuno in modo critico (calcolo sincrono in finalizzazione). |
| Leggibile da altri | snapshot e standings correnti; ordine di seeding. |
| Dipendenze consentite | `shared-kernel`, `ResultsQueries.getFinalizedResults` (contiene già partecipanti e bye), `ParticipationQueries` (seed, stato). |
| Dipendenze vietate | Tournament (qualsiasi), `ResultsService` (comandi); risultati non finalizzati come input (STD-DER-001). La stessa transazione di finalizzazione può passare a `computeAndSnapshot` i risultati appena portati a FINAL. |

## 10. Audit

| Voce | Contenuto |
|---|---|
| Responsabilità | Registrazione immutabile delle operazioni amministrative/sensibili; lettura per autorizzati. Nessuna business logic (§2.10). |
| Aggregate root | `AuditEntry` (append-only). |
| Entità / VO | `AuditEntryId`, `AuditAction` (enum stringa namespaced, es. `event.registration.opened`), `EntityRef` (type, id), `StateDiff` (previous/resulting JSON), `Reason`, `CorrelationId`, `ActorId`. |
| Dati posseduti | `audit.audit_entry` |
| Servizi pubblici | `AuditRecorder.record(entry)` (sincrono, **nella stessa transazione** dell'operazione auditata **[PROPOSTA, ADR-005]**); `AuditQueries.list(actor, organizationId, filters)` (richiede permesso `AUDIT_READ`). |
| Repository contract | `AuditRepository { append, query }` — nessun metodo update/delete. |
| Eventi prodotti | nessuno |
| Eventi consumati | nessuno nel core (la scrittura sincrona evita finestre in cui un'operazione è committed senza audit). |
| Leggibile da altri | solo tramite API read-only per TO/OWNER. |
| Dipendenze consentite | `shared-kernel`, `AuthorizationService` (solo per query). |
| Dipendenze vietate | Qualsiasi modulo di business; interpretazione del contenuto dei diff. |

## 11. Notifications (adapter futuro, non MVP core)

| Voce | Contenuto |
|---|---|
| Responsabilità | Email, push, notifiche applicative (§2.11). **Non implementato nell'MVP**; documentato solo per fissarne i confini. |
| Aggregate root | n/d nella v1 |
| Dati posseduti | n/d (futuro: preferenze e log di consegna) |
| Servizi pubblici | nessuno |
| Eventi consumati | futuri: `RoundActivated`, `PairingsGenerated`, `MatchResultDisputed`, `TournamentCompleted` via outbox relay. |
| Dipendenze consentite | `shared-kernel`, contract degli eventi. |
| Dipendenze vietate | Essere chiamato direttamente da qualsiasi modulo (NOTIF-001); provider email/push nel domain. |

---

## Orchestration (application layer cross-module, non bounded context)

Contiene **solo** use case che coordinano più moduli in un'unica transazione e read facade composte. Non possiede tabelle, non contiene invarianti di dominio (le invarianti restano nei moduli invocati).

- `MarkReadyToStartUseCase`: lock Event → `ParticipationQueries.countActive` → `AssignmentService.validateCompleteness` → `EventService.markReadyToStart(facts)`.
- `StartTournamentUseCase`: lock Event → ricontrollo fatti → `ParticipationService.assignTechnicalSeeds` → `AssignmentService.lockAll` → `TournamentService.initialize` → `EventService.startTournament(facts)` → audit + outbox, tutto in una TX.
- `CompleteTournamentUseCase` / early termination: `TournamentQueries.getProgress` → `EventService.completeTournament(facts)`.
- `MatchViewFacade`: pairing corrente + Protocol dell'avversario (AUTH-PLY-003/004).

## Platform (kernel tecnico, non bounded context)

Contiene solo meccanismi senza regole di business: `UnitOfWork`/transaction context, `OutboxWriter` + relay, `IdempotencyStore`, error taxonomy e mapping HTTP, `CorrelationId`, `Clock`, `RandomSource`, configurazione. Possiede `platform.outbox_event`, `platform.idempotency_key`.
