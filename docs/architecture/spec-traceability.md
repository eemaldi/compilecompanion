# Spec Traceability Matrix

**Fonte normativa:** `docs/specifications/compile-companion-v1.md` (v1.0, Baseline)
**ADR esistenti:** nessuno · **Contratti OpenAPI esistenti:** nessuno · **Codice esistente:** nessuno
**Data baseline matrice:** 2026-11-09

## Convenzioni

- **ID**: stabile, mai riutilizzato. Un requisito rimosso viene marcato `RETIRED`, non rinumerato.
- **Livello**: `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`. Le invarianti elencate in §4 e §16 senza keyword esplicita ("deve", "vale come", "è vietata") sono classificate `MUST`/`MUST NOT` perché la spec le dichiara "non negoziabili" (§4) o "devono essere testate" (§16). Queste righe sono marcate con `†`.
- **Modulo**: owner dell'enforcement (vedi `bounded-contexts.md`). `Platform` = kernel tecnico condiviso (errori, transazioni, outbox, idempotency, boundary check), senza business logic.
- **Enforcement**: `DOM` = invariante nel domain model/aggregate · `APP` = application service (precondizioni, authorization) · `DB` = constraint/indice/trigger PostgreSQL · `TX` = transazione/lock (`SELECT … FOR UPDATE`, advisory lock) · `OCC` = optimistic concurrency (colonna `version`) · `IDEM` = idempotency key · `OBX` = transactional outbox · `ARCH` = boundary check statico (dependency-cruiser/eslint) · `API` = schema OpenAPI/validazione input · `PROC` = processo/review umana.
- **Test**: `U` unit · `P` property-based · `I` integration (PostgreSQL reale) · `C` contract (OpenAPI) · `A` architectural · `E` e2e/API · `S` security.
- **Stato**: `NOT_STARTED` per tutte le righe alla baseline. Valori ammessi: `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED`, `VERIFIED` (test verdi + review umana se richiesta), `BLOCKED(<OD-id>)`.
- Le righe con dipendenza da una decisione aperta riportano il riferimento `OD-xxx` (vedi `open-decisions.md`).

---

## 1. Architettura e stack (§1, §17, §19, §21)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| ARCH-STACK-001 | 1 | Modular monolith, TypeScript end-to-end, monorepo pnpm + Turborepo | MUST† | Platform | ARCH, PROC | A | NOT_STARTED |
| ARCH-STACK-002 | 1 | PostgreSQL primary datastore e source of truth | MUST | Platform | ARCH, PROC | A | NOT_STARTED |
| ARCH-STACK-003 | 1 | Prisma ORM primario; SQL migration/constraint dove Prisma non basta | MUST† | Platform | PROC | I (migration validation) | NOT_STARTED |
| ARCH-STACK-004 | 1, 10 | REST + OpenAPI come confine frontend/backend | MUST | Platform | API, ARCH | C | NOT_STARTED |
| ARCH-STACK-005 | 1 | Clerk solo per authentication; authorization interna | MUST | Identity, Organization | ARCH, APP | A, S | NOT_STARTED |
| ARCH-STACK-006 | 1 | Docker per packaging ed execution | MUST† | Platform | PROC | build CI | NOT_STARTED |
| ARCH-RT-001 | 1 | Funzionamento corretto con REST + refresh/polling | SHOULD | Platform | PROC | E | NOT_STARTED |
| ARCH-RT-002 | 1 | WebSocket/SSE/Redis/queue esterne non dipendenze necessarie del core | MUST NOT | Platform | ARCH | A | NOT_STARTED |
| ARCH-DOM-001 | 1, 19 AP-01 | Domain layer indipendente da Next.js, NestJS, Prisma, Clerk, HTTP, UI, cloud | MUST NOT | Tutti | ARCH | A | NOT_STARTED |
| ARCH-DOM-002 | 2.7 | Tournament Engine implementabile/testabile senza UI, HTTP, cloud | MUST | Tournament | ARCH | A, U | NOT_STARTED |
| ARCH-DOM-003 | 2.7 | Core pairing come funzione/domain service deterministica | SHOULD | Tournament | DOM | P | NOT_STARTED |
| ARCH-OWN-001 | 11 | Nessun modulo scrive tabelle di un altro modulo | MUST NOT | Tutti | ARCH, DB (schema per modulo + grant) | A, I | NOT_STARTED |
| ARCH-OWN-002 | 11 | Cross-module solo via application service, eventi, repository contract approvati | MUST† | Tutti | ARCH | A | NOT_STARTED |
| ARCH-OWN-003 | 11 | Read cross-module via query model senza trasferire ownership | MAY | Tutti | ARCH | A | NOT_STARTED |
| ARCH-AP-002 | 19 AP-02 | Stato competitivo ufficiale in PostgreSQL; cache/read model derivati | MUST† | Platform | ARCH | A | NOT_STARTED |
| ARCH-AP-003 | 19 AP-03 | Consistenza forte su assignment, round, risultati, finalizzazione, standings; errore esplicito preferito ad ambiguità | MUST† | Assignment, Tournament, Results, Standings | TX, OCC, DB | I | NOT_STARTED |
| ARCH-INFRA-001 | 21 | Decisioni infrastrutturali (§21) sostituibili dietro adapter | MUST† | Platform | ARCH | A | NOT_STARTED |
| ARCH-INFRA-002 | 21 | AWS non è decisione normativa; nessuna logica AWS nel dominio | MUST NOT | Tutti | ARCH | A | NOT_STARTED |
| ARCH-AGT-001 | 17.2 | Nessuna introduzione silenziosa di microservizi, GraphQL, NoSQL SoT, event sourcing, CQRS completo, K8s, shared mutable global state | MUST NOT | Platform | ARCH, PROC | A | NOT_STARTED |
| ARCH-GATE-001 | 18 | Ogni change set supera gli 11 engineering gate | MUST† | Platform | PROC (CI) | CI | NOT_STARTED |
| ARCH-GATE-002 | 18 | Review umana per aree ad alto rischio | MUST† | Platform | PROC (CODEOWNERS) | — | NOT_STARTED |

## 2. Identity (§2.1, §3.1)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| IDN-USER-001 | 3.1 | User con id interno, externalIdentityId, displayName, status, createdAt | MUST† | Identity | DOM, DB | U, I | NOT_STARTED |
| IDN-USER-002 | 3.1 | L'ID Clerk non è primary business identifier | MUST NOT | Identity | DOM, DB (PK interna UUID, `external_identity_id` UNIQUE non-PK) | U, A | NOT_STARTED |
| IDN-USER-003 | 2.1 | Identity non possiede membership né permessi | MUST NOT | Identity | ARCH | A | NOT_STARTED |

## 3. Organization e multi-tenancy (§2.2, §3.2, §3.3, §6, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| ORG-TEN-001 | 2.2, 4.1 | Ogni Event appartiene a esattamente una Organization | MUST | Event | DOM, DB (`organization_id NOT NULL`, immutabile) | U, I | NOT_STARTED |
| ORG-TEN-002 | 2.2 | Organizzatore individuale opera tramite una Organization | MUST† | Organization | APP | I | BLOCKED(OD-012) |
| ORG-TEN-003 | 2.2 | Organization MAY essere invisibile all'utente nell'MVP | MAY | Organization (UI) | — | — | NOT_STARTED |
| ORG-MEM-001 | 3.3 | Membership con userId, organizationId, role, status; ruoli OWNER, TO, MEMBER | MUST† | Organization | DOM, DB | U, I | NOT_STARTED |
| ORG-MEM-002 | 3.3 | Ruoli estendibili senza modifica strutturale | MUST | Organization | DOM (role come value object/lookup) | U | NOT_STARTED |
| AUTH-TENANT-001 | 6, 16 | Ruolo in Organization A non concede permessi in Organization B | MUST NOT | Organization (policy), tutti i moduli | APP, DB (filtro `organization_id` obbligatorio nei repository) | I, S, E | NOT_STARTED |
| AUTH-TENANT-002 | 16 | Membro di A non accede a dati protetti di B | MUST† | Tutti | APP, DB | I, S, E | NOT_STARTED |
| AUTH-TENANT-003 | 16 | Identifier enumeration non bypassa authorization (risposta NOT_FOUND per risorse non visibili) | MUST† | Tutti | APP, API | S, E | NOT_STARTED |
| AUTH-TENANT-004 | 6 | Platform Administrator cross-tenant solo esplicitamente autorizzato e auditato | MUST | Organization, Audit | APP, PROC | — (ruolo futuro, non MVP) | NOT_STARTED |

## 4. Authorization (§6, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| AUTH-PUB-001 | 6 | Anonimo vede eventi pubblici, avvia registration quando permessa, si autentica | MAY | Event, Participation | APP | E | BLOCKED(OD-016) |
| AUTH-PUB-002 | 6 | Anonimo non vede info amministrative, audit, non modifica tornei né assignment altrui | MUST NOT† | Tutti | APP | S, E | NOT_STARTED |
| AUTH-PLY-001 | 6 | Player si registra solo con registration aperta | MUST† | Participation | APP, DOM | U, I | NOT_STARTED |
| AUTH-PLY-002 | 6 | Player seleziona i propri Protocol solo in PLAYER_SELECTION prima del lock | MUST† | Protocol Assignment | APP, DOM | U, I | NOT_STARTED |
| AUTH-PLY-003 | 6 | Player vede propri Protocol e quelli dell'avversario corrente | MAY | Protocol Assignment | APP | E | NOT_STARTED |
| AUTH-PLY-004 | 6 | Player vede il proprio pairing | MAY | Tournament | APP | E | NOT_STARTED |
| AUTH-PLY-005 | 6, 16 | Player reporta/accetta/contesta solo risultati di propri Match | MUST† | Results | APP | U, I, S | NOT_STARTED |
| AUTH-PLY-006 | 6 | Player non modifica risultati altrui, pairing, Round, Protocol dopo lock, configurazione Event | MUST NOT† | Results, Tournament, Assignment, Event | APP | S, E | NOT_STARTED |
| AUTH-PLY-007 | 6 | Player effettua drop quando consentito | MAY | Participation | APP, DOM | U, I | BLOCKED(OD-008) |
| AUTH-TO-001 | 6 | TO con permessi sull'Organization esegue le operazioni di gestione evento elencate in §6 | MUST† | Organization (policy) + moduli | APP | I, E | NOT_STARTED |
| AUTH-TO-002 | 6, 4.3 | TO non modifica Round FINALIZED | MUST NOT | Tournament, Results | DOM, DB | U, I | NOT_STARTED |
| AUTH-TO-003 | 6 | Solo TO/OWNER vedono audit | MUST† | Audit | APP | S | NOT_STARTED |

## 5. Protocol Catalog (§2.3, §3.4, §3.5, §9.1)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| CAT-MOD-001 | 9.1 | Gerarchia Game → Product → Protocol | MUST† | Catalog | DOM, DB (FK) | U, I | NOT_STARTED |
| CAT-MOD-002 | 2.3 | Catalogo iniziale: Main 1-3 (12 Protocol ciascuno), Aux 1-3 (3 ciascuno) | MUST† | Catalog | DB (seed migration) | I | BLOCKED(OD-013) |
| CAT-MOD-003 | 2.3 | Supporto futuri Product senza modifica strutturale | MUST | Catalog | DOM, DB | U | NOT_STARTED |
| CAT-MOD-004 | 3.4 | Product con identità stabile indipendente dal nome | MUST | Catalog | DB (id/code stabili) | U, I | NOT_STARTED |
| CAT-MOD-005 | 3.5 | Protocol appartiene esattamente a un Product | MUST† | Catalog | DB (`product_id NOT NULL` FK) | I | NOT_STARTED |
| CAT-MOD-006 | 3.5 | Nessun massimo di 45 Protocol; numerazione è attributo di catalogo | MUST NOT | Catalog, Assignment | DOM | U, P | NOT_STARTED |
| CAT-MOD-007 | 2.3 | Catalog non conosce i tornei | MUST† | Catalog | ARCH | A | NOT_STARTED |

## 6. Event (§2.4, §3.6, §4.1, §5.1, §9.2, §9.3)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| EVT-INV-001 | 4.1 | Event appartiene a esattamente una Organization | MUST | Event | DOM, DB | U, I | NOT_STARTED |
| EVT-INV-002 | 4.1 | Un solo assignment mode attivo (PLAYER_SELECTION \| RANDOM_DRAFT) | MUST | Event | DOM, DB (enum NOT NULL) | U | NOT_STARTED |
| EVT-INV-003 | 4.1 | Il torneo non inizia senza plannedRounds valido | MUST NOT | Event | DOM, APP | U | BLOCKED(OD-006) |
| EVT-INV-004 | 4.1 | Il torneo non inizia con meno di due Participant attivi | MUST NOT | Event (via Participation query) | APP, TX | U, I | BLOCKED(OD-001) |
| EVT-INV-005 | 2.5, 4.1 | Nessuna late registration dopo l'inizio | MUST NOT | Participation | DOM, TX (lock su Event status) | U, I | NOT_STARTED |
| EVT-SM-001 | 5.1 | State machine DRAFT → REGISTRATION_OPEN → REGISTRATION_CLOSED → PROTOCOL_ASSIGNMENT → READY_TO_START → IN_PROGRESS → COMPLETED; CANCELLED alternativo | MUST† | Event | DOM, OCC | U, P | BLOCKED(OD-009) |
| EVT-SM-002 | 5.1 | READY_TO_START solo con registrazione chiusa, Participant definitivi, 3 Protocol validi per attivo, config valida, ≥2 attivi | MUST† | Event | APP, TX | U, I | NOT_STARTED |
| EVT-SM-003 | 5.1, 5.5 | Ingresso in IN_PROGRESS provoca il lock dei Protocol Assignment nella stessa transazione | MUST† | Event, Assignment | TX, APP | I | NOT_STARTED |
| EVT-SM-004 | 15 | Transizioni non consentite → INVALID_STATE_TRANSITION | MUST† | Event | DOM | U | NOT_STARTED |
| EVT-POOL-001 | 9.2 | TO seleziona uno o più Product | MUST† | Event | DOM (≥1 Product), API | U | NOT_STARTED |
| EVT-POOL-002 | 9.2 | EventProtocolPool = union dei Protocol dei Product selezionati | MUST† | Event | DOM | U, P | NOT_STARTED |
| EVT-POOL-003 | 9.2 | L'Event conserva la configurazione usata (snapshot) | MUST† | Event | DB (snapshot tabelle Event) | I | BLOCKED(OD-004) |
| EVT-POOL-004 | 9.2 | Modifiche al catalogo non alterano tornei iniziati/conclusi | MUST NOT | Event | DB (snapshot) | I | NOT_STARTED |
| EVT-POOL-005 | 9.3 | v1: solo Product completi abilitabili; niente ban/allow-list di singoli Protocol | MUST NOT† | Event | API, DOM | C | NOT_STARTED |
| EVT-POOL-006 | 9.3 | Modello dati che permetta in futuro ban/allow-list/restricted/rotations | SHOULD | Event | DB (pool snapshot per-Protocol) | — | NOT_STARTED |
| EVT-API-001 | 10 | Events API non implementa il pairing | MUST NOT | Event | ARCH | A | NOT_STARTED |
| EVT-CFG-001 | 13 | Modifiche configurazione dopo pubblicazione sono auditate | MUST | Event, Audit | APP | I | BLOCKED(OD-009) |

## 7. Participation (§2.5, §3.7, §4.5, §5.2)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| PAR-INV-001 | 3.7 | Participant per Event distinto da User; User MAY partecipare a molti Event | MUST† | Participation | DB (UNIQUE `event_id,user_id`) | I | NOT_STARTED |
| PAR-SM-001 | 5.2 | REGISTERED → CHECKED_IN; REGISTERED → WITHDRAWN; CHECKED_IN → DROPPED (durante torneo); → DISQUALIFIED (eccezionale) | MUST† | Participation | DOM, OCC | U, P | BLOCKED(OD-001) |
| PAR-SM-002 | 5.2 | DROPPED/DISQUALIFIED non tornano automaticamente attivi | MUST NOT | Participation | DOM | U | NOT_STARTED |
| PAR-INV-002 | 4.5 | Player DROPPED mantiene storico e risultati, non partecipa ai Round successivi | MUST† | Participation, Tournament | DOM | U, I | BLOCKED(OD-008) |
| PAR-INV-003 | 4.2, 9.2 | In RANDOM_DRAFT nessuna registrazione oltre floor(N/3) senza modifica del pool | MUST NOT | Participation (query Event pool) | TX, DB | I (concorrente) | NOT_STARTED |
| PAR-API-001 | 10 | Participants API non scrive risultati Match | MUST NOT | Participation | ARCH | A | NOT_STARTED |
| PAR-AUD-001 | 13 | Aggiunta/rimozione amministrativa, disqualification, drop amministrativo auditati con reason | MUST | Participation, Audit | APP | I | NOT_STARTED |

## 8. Protocol Assignment (§2.6, §3.8, §4.2, §5.5, §9.4, §14.2, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| PRT-INV-001 | 3.8, 4.2 | Ogni Participant attivo ha esattamente 3 Protocol all'inizio | MUST | Assignment | DOM, APP (check a READY_TO_START), DB (`slot ∈ {1,2,3}`, UNIQUE `participant_id,slot`) | U, P, I | NOT_STARTED |
| PRT-INV-002 | 4.2 | I 3 Protocol di un Participant sono distinti | MUST | Assignment | DOM, DB (UNIQUE `participant_id,protocol_id`) | U, P, I | NOT_STARTED |
| PRT-INV-003 | 4.2 | Protocol assegnato appartiene a un Product abilitato per l'Event | MUST | Assignment | DOM (verifica su pool snapshot), DB (FK composita su snapshot pool) | U, P, I | NOT_STARTED |
| PRT-SEL-001 | 4.2 | PLAYER_SELECTION: stesso Protocol MAY appartenere a più Participant | MAY | Assignment | DOM (nessun vincolo globale) | U, P | NOT_STARTED |
| PRT-RND-001 | 4.2 | RANDOM_DRAFT: stesso Protocol MUST NOT appartenere a più Participant nell'Event | MUST NOT | Assignment | DOM, DB (UNIQUE parziale `event_id,protocol_id` WHERE mode=RANDOM_DRAFT) | U, P, I | NOT_STARTED |
| PRT-RND-002 | 4.2, 9.4 | Capacità = floor(N/3); valido solo se 3P ≤ N | MUST† | Assignment | DOM | U, P | NOT_STARTED |
| PRT-RND-003 | 15 | Pool insufficiente → PROTOCOL_POOL_INSUFFICIENT con required/available/participant/maximum count | MUST† | Assignment | DOM | U, C | NOT_STARTED |
| PRT-RND-004 | 2.6 | Random Draft generato dal TO | MUST† | Assignment | APP | S | NOT_STARTED |
| PRT-RND-005 | 9.4 | Randomness con sorgente iniettabile e riproducibile (seed persistito) | MUST† | Assignment | DOM (porta RNG) | U, P | BLOCKED(OD-014) |
| PRT-LCK-001 | 5.5 | EDITABLE → LOCKED all'avvio del torneo | MUST† | Assignment | DOM, TX | I | NOT_STARTED |
| PRT-LCK-002 | 5.5 | Dopo LOCKED il player non modifica | MUST NOT | Assignment | DOM, APP | U, I | NOT_STARTED |
| PRT-LCK-003 | 5.5 | Dopo LOCKED il TO MAY override | MAY | Assignment | APP | I | NOT_STARTED |
| PRT-LCK-004 | 5.5, 13 | Ogni override genera audit con reason | MUST | Assignment, Audit | APP, TX | I | NOT_STARTED |
| PRT-LCK-005 | 5.5, 4.2 | L'override preserva 3 distinti, pool, unicità RANDOM_DRAFT | MUST† | Assignment | DOM, DB | U, I | NOT_STARTED |
| PRT-AUD-001 | 13 | Generazione/reroll Random Draft auditata | MUST | Assignment, Audit | APP, TX | I | BLOCKED(OD-005) |
| PRT-ERR-001 | 15 | Violazione regole di assignment → PROTOCOL_ASSIGNMENT_CONFLICT; < 3 Protocol → VALIDATION_ERROR | MUST† | Assignment | DOM | U, C | NOT_STARTED |

## 9. Tournament Engine: Round, pairing, float, bye, rematch (§4.3, §5.3, §7, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| TRN-RND-001 | 4.3, 16 | Ogni Participant attivo appare esattamente una volta per Round (bye incluso) | MUST | Tournament | DOM, DB (UNIQUE `round_id,participant_id` su seat table) | U, P, I | NOT_STARTED |
| TRN-RND-002 | 4.3 | Nessuno è accoppiato con sé stesso | MUST NOT | Tournament | DOM, DB (CHECK `a <> b`) | U, P | NOT_STARTED |
| TRN-RND-003 | 4.3, 16 | Round N+1 non esiste mentre Round N non è FINALIZED | MUST NOT | Tournament | DOM, TX, DB | U, I | NOT_STARTED |
| TRN-RND-004 | 4.3, 5.3 | Round FINALIZED immutabile, irreversibile | MUST | Tournament | DOM, DB (trigger reject UPDATE/DELETE) | U, I | NOT_STARTED |
| TRN-RND-005 | 5.3 | State machine CREATED → PAIRINGS_READY → ACTIVE → READY_TO_FINALIZE → FINALIZED | MUST† | Tournament | DOM, OCC | U, P | BLOCKED(OD-010) |
| TRN-RND-006 | 22.13 | Generazione Round usa esclusivamente stato finalizzato | MUST† | Tournament | APP (input solo da Round FINALIZED) | U, I | NOT_STARTED |
| TRN-RND-007 | 22.5 | Round contiene tutti e soli i Participant attivi | MUST† | Tournament | DOM | P | BLOCKED(OD-001) |
| TRN-RND-008 | 7.1 | Nessuna implementazione Swiss generica divergente dalla spec | MUST NOT | Tournament | PROC, ARCH (nessuna lib Swiss esterna) | P | NOT_STARTED |
| TRN-REC-001 | 7.1, 7.2 | Record W-L; Record Group 0-0, poi per (W,L) | MUST† | Tournament | DOM | U | NOT_STARTED |
| TRN-REC-002 | 7.2 | DRAW richiederebbe W-D-L; comportamento competitivo non inventato | MUST NOT | Tournament, Results | DOM (DRAW rifiutato dal motore) | U | BLOCKED(OD-007) |
| TRN-PAIR-001 | 7.3 | Ordine priorità: (1) no rematch, (2) stesso Record Group, (3) seeding nel gruppo, (4) float al gruppo inferiore, (5) minima distanza record, (6) rematch solo se inevitabile | MUST† | Tournament | DOM | P | BLOCKED(OD-002) |
| TRN-PAIR-002 | 7.3 | Algoritmo libero (backtracking, matching…) ma non altera le priorità | MAY | Tournament | DOM | P (oracle brute-force su istanze piccole) | NOT_STARTED |
| TRN-PAIR-003 | 16 | Generazione deterministica a parità di input e seed tecnico | MUST† | Tournament | DOM (nessuna iterazione su Map/Set non ordinati, nessun clock/RNG implicito) | P | NOT_STARTED |
| TRN-PAIR-004 | 15 | Pairing impossibile → PAIRING_IMPOSSIBLE; nessun Participant inventato o scartato | MUST NOT | Tournament | DOM | U, P | NOT_STARTED |
| TRN-FLT-001 | 7.4 | Gruppo dispari → un player float al gruppo immediatamente inferiore | MUST† | Tournament | DOM | U, P | NOT_STARTED |
| TRN-FLT-002 | 7.4 | Scelta del float che massimizza il pairing globale (rematch, seeding) | SHOULD | Tournament | DOM | P | BLOCKED(OD-002) |
| TRN-FLT-003 | 7.4 | Il float non altera il record del player | MUST NOT | Tournament | DOM | U, P | NOT_STARTED |
| TRN-BYE-001 | 7.5 | Bye prodotto se i Participant attivi sono dispari; massimo un bye per Round | MUST† | Tournament | DOM, DB (UNIQUE parziale bye per round) | U, P, I | NOT_STARTED |
| TRN-BYE-002 | 7.5, 4.5 | Bye vale come WIN, senza opponent, senza report, automaticamente FINAL | MUST† | Tournament, Results, Standings | DOM | U, I | BLOCKED(OD-011) |
| TRN-BYE-003 | 7.5 | Selezione: Record Group più basso appropriato → senza bye precedente → seeding più basso | MUST† | Tournament | DOM | P | BLOCKED(OD-002) |
| TRN-BYE-004 | 7.5 | Nessun secondo bye se esiste un eleggibile senza bye | MUST NOT | Tournament | DOM | P | NOT_STARTED |
| TRN-RMT-001 | 7.6 | Rematch evitato se esiste soluzione valida senza rematch | MUST | Tournament | DOM | P (oracle) | NOT_STARTED |
| TRN-RMT-002 | 7.6 | Rematch prodotto solo se necessario per pairing completo | MAY | Tournament | DOM | P | NOT_STARTED |
| TRN-RMT-003 | 7.6 | Rematch identificabile come pairing eccezionale | SHOULD | Tournament | DOM, DB (flag `is_rematch`) | U | NOT_STARTED |
| TRN-API-001 | 10 | Tournament API: generate round/pairings, activate, finalize, standings | MUST† | Tournament | API | C | NOT_STARTED |

## 10. Match & Results (§3.10, §3.11, §4.4, §5.4, §14.4, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| RES-INV-001 | 4.4 | Match normale con due Participant differenti | MUST | Tournament (pairing) | DOM, DB (CHECK) | U | NOT_STARTED |
| RES-INV-002 | 4.4 | Match BYE con esattamente un Participant | MUST | Tournament | DOM, DB (CHECK) | U | NOT_STARTED |
| RES-INV-003 | 4.4, 16 | WIN di A ⇔ LOSS di B (outcome memorizzato una sola volta come `winner`) | MUST† | Results | DOM, DB (rappresentazione non ridondante) | U, P | NOT_STARTED |
| RES-INV-004 | 4.4, 16 | Match DISPUTED impedisce finalizzazione del Round | MUST | Results, Tournament | TX | I | NOT_STARTED |
| RES-INV-005 | 3.10 | Match è BO1 | MUST† | Results | DOM | U | NOT_STARTED |
| RES-OUT-001 | 3.11 | Outcome normali WIN/LOSS; DRAW nel modello ma non normale | MUST† | Results | DOM, API | U, C | BLOCKED(OD-007) |
| RES-OUT-002 | 3.11 | UI standard non propone DRAW ai giocatori | SHOULD NOT | Web | UI | E | NOT_STARTED |
| RES-SM-001 | 5.4 | PENDING → REPORTED → FINAL; REPORTED → DISPUTED → RESOLVED → FINAL; BYE → FINAL | MUST† | Results | DOM, OCC | U, P | BLOCKED(OD-003) |
| RES-SM-002 | 5.4, 16 | Accettazione avversario MAY portare REPORTED → FINAL; accepted non richiede altre conferme | MAY | Results | DOM | U | NOT_STARTED |
| RES-SM-003 | 5.4, 16 | Assenza di conferma non è un errore; risultato può esistere senza acceptance | MUST† | Results | DOM | U | BLOCKED(OD-003) |
| RES-DSP-001 | 6 | Player contesta prima della finalizzazione | MAY | Results | DOM, APP | U, I | NOT_STARTED |
| RES-DSP-002 | 16 | Nessuna dispute aperta su Round FINALIZED | MUST NOT† | Results | DOM, TX | I | NOT_STARTED |
| RES-DSP-003 | 13, 6 | Risoluzione dispute solo TO, auditata con reason | MUST | Results, Audit | APP, TX | I, S | NOT_STARTED |
| RES-IMM-001 | 4.3 | Risultati di Round FINALIZED immutabili anche per il TO | MUST | Results | DOM, DB (trigger) | U, I | NOT_STARTED |
| RES-ERR-001 | 15 | Operazione bloccata da dispute → RESULT_DISPUTED | MUST† | Results | DOM | U, C | NOT_STARTED |
| RES-API-001 | 10 | Results API: report, accept, dispute, resolve | MUST† | Results | API | C | NOT_STARTED |

## 11. Standings e seeding (§2.9, §8)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| STD-DER-001 | 2.9, 22.12 | Standings derivabili e riproducibili dai soli risultati finalizzati | MUST | Standings | DOM (funzione pura) | P (ricalcolo == snapshot) | NOT_STARTED |
| STD-ORD-001 | 8 | Ordinamento: record W-L, OWR, H2H, SoS secondario, technical seed | MUST† | Standings | DOM | U, P | BLOCKED(OD-002b) |
| STD-SEED-001 | 8 | Technical seed stabile, non cambia per refresh | MUST | Standings / Participation | DB (valore persistito) | I | BLOCKED(OD-015) |
| STD-SEED-002 | 8 | Technical seed non dipende dall'ordine di lettura DB | MUST NOT | Standings | DOM | P (shuffle input) | NOT_STARTED |
| STD-SEED-003 | 8 | Ordinamento totale e riproducibile | MUST | Standings | DOM, DB (UNIQUE seed per event) | P | NOT_STARTED |
| STD-EXT-001 | 8 | Design estendibile a competitive seeding e H2H avanzato; Engine indipendente dall'implementazione concreta | MUST | Standings, Tournament | ARCH (porta `SeedingPolicy`) | A | NOT_STARTED |
| STD-SNP-001 | 11 | Standings possiede finalized ranking snapshots | MUST† | Standings | DB | I | NOT_STARTED |

## 12. Audit (§2.10, §10, §13)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| AUD-REC-001 | 13 | Audit obbligatorio per le 13 categorie elencate in §13 | MUST† | Audit + moduli emittenti | APP, TX (stessa transazione) | I | NOT_STARTED |
| AUD-REC-002 | 13 | AuditEntry contiene timestamp, organizationId, eventId?, actorId, action, entityType, entityId, previous, resulting, correlationId | MUST | Audit | DB (NOT NULL), DOM | U, I | NOT_STARTED |
| AUD-REC-003 | 13 | Reason disponibile per operazioni amministrative sensibili | MUST | Audit, moduli | API (reason required), DOM | C, U | NOT_STARTED |
| AUD-IMM-001 | 13 | Append-only; applicazione non aggiorna né cancella | MUST / MUST NOT | Audit | DB (REVOKE UPDATE/DELETE, trigger) | I | NOT_STARTED |
| AUD-API-001 | 10 | Audit read-only via API per autorizzati; non modificabile | MUST NOT | Audit | API | C, S | NOT_STARTED |
| AUD-ARC-001 | 2.10 | Audit senza business logic | MUST NOT | Audit | ARCH | A | NOT_STARTED |
| AUD-ARC-002 | 17.2, AP-05 | Nessun bypass dell'audit per convenience | MUST NOT | Tutti | ARCH, PROC | A, I | NOT_STARTED |

## 13. Domain events e outbox (§12)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| OUT-EVT-001 | 12 | Eventi = fatti avvenuti, naming past tense | SHOULD | Tutti | PROC, lint naming | A | NOT_STARTED |
| OUT-EVT-002 | 12 | Catalogo eventi iniziali §12 | MUST† | Moduli emittenti | DOM | U | NOT_STARTED |
| OUT-OBX-001 | 12 | Eventi asincroni pubblicati via transactional outbox | MUST | Platform | OBX | I | NOT_STARTED |
| OUT-OBX-002 | 12 | Transazione business e outbox committed insieme | MUST | Platform | TX | I (rollback → nessun evento) | NOT_STARTED |
| NOTIF-001 | 2.11 | Notifications consuma eventi, non chiamato dal Tournament Engine | MUST | Notifications (futuro) | ARCH | A | NOT_STARTED |

## 14. Concorrenza e idempotency (§14, §16)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| CONC-GEN-001 | 14.1 | Richieste simultanee non violano invarianti | MUST NOT | Tutti | DB, TX, OCC | I | NOT_STARTED |
| CONC-GEN-002 | 14.1 | Validazioni solo frontend insufficienti | MUST NOT† | Tutti | APP, DOM | A, I | NOT_STARTED |
| CONC-RND-001 | 9.4, 14.2 | Random Draft atomico e transazionale; fallimento ⇒ zero assegnazioni parziali | MUST | Assignment | TX | I (fault injection) | NOT_STARTED |
| CONC-RND-002 | 14.2, 16 | Draft concorrenti non creano due draft attivi né Protocol duplicati | MUST NOT | Assignment | TX (lock su Event/draft row), DB (UNIQUE) | I (concorrente) | NOT_STARTED |
| CONC-START-001 | 16 | Doppio Tournament Start produce un solo avvio | MUST† | Event | OCC/TX, IDEM | I | NOT_STARTED |
| CONC-ROUND-001 | 14.3 | Al massimo un Round per (Event, roundNumber) | MUST† | Tournament | DB (UNIQUE `event_id,round_number`) | I | NOT_STARTED |
| CONC-ROUND-002 | 14.3 | Due "Generate next round" concorrenti ⇒ un solo Round | MUST | Tournament | DB, TX | I | NOT_STARTED |
| CONC-RES-001 | 14.4 | Report/dispute/accept con optimistic concurrency; versione obsoleta ⇒ CONCURRENT_MODIFICATION | MUST† | Results | OCC (`If-Match`/`version`) | I, C | NOT_STARTED |
| CONC-RES-002 | 14.4 | Silent overwrite vietato | MUST NOT | Results | OCC | I | NOT_STARTED |
| CONC-FIN-001 | 14.5 | Finalizzazione verifica atomicamente: Match risolti, zero dispute, nessuna modifica concorrente, standings calcolabili; altrimenti fallisce interamente | MUST | Tournament, Results, Standings | TX (lock Round + match rows), OCC | I | BLOCKED(OD-017) |
| CONC-FIN-002 | 15 | ROUND_NOT_FINALIZABLE con elenco blocker | SHOULD | Tournament | DOM | U, C | NOT_STARTED |
| CONC-FIN-003 | 16 | Dispute durante finalizzazione e Finalize simultaneo coperti da test | MUST | Tournament, Results | — | I | NOT_STARTED |
| IDEM-001 | 14.6 | Idempotency per create registration, Random Draft, Start, Generate Round, report result, Finalize Round, Complete Tournament | SHOULD | Platform + moduli | IDEM (tabella chiavi, stessa TX) | I | NOT_STARTED |
| IDEM-002 | 14.6 | Retry non duplica effetti | MUST† | Platform | IDEM | I | NOT_STARTED |
| IDEM-003 | 15 | Chiave riutilizzata con payload diverso ⇒ IDEMPOTENCY_CONFLICT | MUST† | Platform | IDEM (hash payload) | I, C | NOT_STARTED |
| CONC-TEST-001 | 16 | Test di concorrenza su PostgreSQL reale o equivalente | MUST | Platform | PROC (Testcontainers) | I | NOT_STARTED |

## 15. Errori (§15)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| ERR-FMT-001 | 15 | Errori machine-readable con code, safe message, correlationId | MUST† | Platform | API (schema errore unico) | C | NOT_STARTED |
| ERR-FMT-002 | 15 | Tassonomia: VALIDATION_ERROR, AUTHENTICATION_REQUIRED, FORBIDDEN, NOT_FOUND, INVALID_STATE_TRANSITION, PROTOCOL_POOL_INSUFFICIENT, PROTOCOL_ASSIGNMENT_CONFLICT, PAIRING_IMPOSSIBLE, RESULT_DISPUTED, ROUND_NOT_FINALIZABLE, CONCURRENT_MODIFICATION, IDEMPOTENCY_CONFLICT, INTERNAL_ERROR | MUST† | Platform | DOM (error union), API | U, C | NOT_STARTED |
| ERR-INT-001 | 15 | INTERNAL_ERROR non espone stack trace né dati sensibili | MUST NOT | Platform | APP (exception filter) | S | NOT_STARTED |

## 16. Tournament lifecycle end-to-end (§13, §14.6, §22)

| ID | § | Requisito sintetico | Livello | Modulo | Enforcement | Test | Stato |
|---|---|---|---|---|---|---|---|
| TRN-LIFE-001 | 6, 13 | TO termina torneo (normale o early termination auditata) | MUST† | Event, Tournament | APP, TX | I | BLOCKED(OD-009) |
| TRN-LIFE-002 | 13 | Tournament start e Round finalization auditati | MUST | Event, Tournament, Audit | TX | I | NOT_STARTED |
| TRN-LIFE-003 | 22 | Definition of Correctness (16 punti) verificata da suite e2e di torneo completo | MUST† | Tutti | — | E, P (simulazione tornei) | NOT_STARTED |

---

## Copertura

- Requisiti tracciati: 174 righe (28 bloccate da decisioni aperte).
- Righe bloccate da decisioni aperte: vedi colonna Stato; elenco in `open-decisions.md` §3.
- Ogni nuovo change set MUST aggiornare la colonna Stato delle righe che tocca.
