# Compile Companion
## Technical & Functional Specification v1.0

**Status:** Baseline  
**Product:** Compile Companion  
**Primary capability:** Tournament Management  
**Architecture:** Modular Monolith  
**Development model:** Agentic, human-supervised  
**Document role:** Normative source of truth

---

# 0. Purpose and normative language

Compile Companion è una companion application per **Compile**, inizialmente focalizzata sull'organizzazione e gestione di tornei.

Questa specification definisce:

- comportamento funzionale;
- dominio;
- responsabilità dei moduli;
- invarianti;
- autorizzazioni;
- comportamento del Tournament Engine;
- gestione dei Protocol;
- confini API;
- ownership dei dati;
- gestione della concorrenza;
- audit;
- errori;
- proprietà che i test devono garantire.

## 0.1 Normative language

Le parole seguenti hanno significato normativo:

- **MUST**: requisito obbligatorio.
- **MUST NOT**: comportamento vietato.
- **SHOULD**: comportamento fortemente raccomandato. Una deviazione richiede una motivazione tecnica.
- **MAY**: comportamento opzionale.

Un agente autonomo **MUST NOT** convertire autonomamente un MUST/MUST NOT in SHOULD/MAY.

## 0.2 Precedence

In caso di conflitto:

1. questa specification;
2. Architecture Decision Records approvati;
3. API contracts;
4. implementation documentation;
5. codice esistente.

Il comportamento corrente del codice **non prevale** sulla specification.

Una divergenza deve essere trattata come bug oppure proposta di modifica della specification.

---

# 1. System architecture

Compile Companion utilizza un **modular monolith**.

Stack approvato:

- TypeScript end-to-end;
- monorepo;
- pnpm;
- Turborepo;
- Next.js per web frontend e PWA;
- NestJS per backend/API;
- REST;
- OpenAPI come API contract;
- PostgreSQL come primary datastore;
- Prisma come ORM primario;
- SQL migrations/constraints quando Prisma non esprime sufficientemente una regola;
- Clerk per authentication;
- authorization gestita internamente;
- Docker per packaging ed execution;
- transactional outbox per asynchronous domain events;
- cloud provider non definito;
- nessuna dipendenza dal cloud provider nel domain layer.

Real-time non è un requisito MVP.

Il sistema SHOULD funzionare correttamente usando normali request REST e refresh/polling.

WebSocket, SSE, Redis, queue esterne e infrastrutture real-time MUST NOT diventare dipendenze necessarie del core domain.

---

# 2. Bounded Contexts

## 2.1 Identity

Responsabilità:

- rappresentazione dell'utente interno;
- associazione con identità Clerk;
- gestione dello stato applicativo dell'utente.

NON possiede:

- membership;
- permessi su Organization;
- permessi sugli Event.

---

## 2.2 Organization

Responsabilità:

- tenant applicativo;
- ownership degli eventi;
- membership;
- ruoli organizzativi.

Relazione principale:

`User → Membership → Organization → Event`

Un Event MUST appartenere a una Organization.

Anche un organizzatore individuale opera tramite una Organization.

L'Organization MAY essere invisibile all'utente nell'MVP.

---

## 2.3 Protocol Catalog

Responsabilità:

- catalogo Compile;
- Product;
- Protocol;
- appartenenza Protocol → Product;
- disponibilità dei prodotti.

Non conosce i tornei.

Catalogo iniziale:

- Main 1: 12 Protocol;
- Main 2: 12 Protocol;
- Main 3: 12 Protocol;
- Aux 1: 3 Protocol;
- Aux 2: 3 Protocol;
- Aux 3: 3 Protocol.

Il modello MUST supportare futuri Main 4, Aux 4 e altri Product senza modifica strutturale.

---

## 2.4 Event

Responsabilità:

- configurazione torneo;
- lifecycle dell'evento;
- date;
- stato;
- numero pianificato di round;
- configurazione dei Product ammessi;
- modalità di Protocol Assignment.

Event è l'aggregate root principale della gestione torneo.

---

## 2.5 Registration & Participation

Responsabilità:

- registrazioni;
- check-in;
- stato del partecipante;
- drop;
- associazione User/Event.

Late registration dopo l'inizio del torneo è vietata.

---

## 2.6 Protocol Assignment

Responsabilità:

- Player Selection;
- Random Draft;
- validazione delle assegnazioni;
- locking;
- override del TO.

Non possiede il Protocol Catalog.

Referenzia i Protocol definiti dal catalogo.

---

## 2.7 Tournament Engine

Responsabilità:

- record W-L;
- record groups;
- pairing;
- float;
- rematch avoidance;
- bye;
- seeding;
- generazione dei round.

MUST essere implementabile e testabile senza UI, HTTP o dipendenze cloud.

Il core pairing SHOULD essere una funzione/domain service deterministica dato uno stato di input determinato.

---

## 2.8 Match & Results

Responsabilità:

- match;
- report del risultato;
- contestazioni;
- risoluzione TO;
- finalizzazione del risultato.

---

## 2.9 Standings

Responsabilità:

- ranking;
- Opponents' Win Rate;
- head-to-head;
- secondary Strength of Schedule;
- technical seed.

Standings MUST essere derivabili dai risultati finalizzati.

---

## 2.10 Audit

Responsabilità:

- registrazione immutabile delle operazioni amministrative e sensibili;
- actor;
- timestamp;
- before/after state;
- reason quando prevista.

Audit MUST NOT contenere business logic.

---

## 2.11 Notifications

Responsabilità futura:

- email;
- push notification;
- notifiche applicative.

MUST consumare eventi invece di essere chiamato direttamente dal Tournament Engine.

Non è necessario per l'MVP core.

---

# 3. Domain Model

## 3.1 User

Rappresenta un'identità applicativa.

Attributi concettuali:

- id;
- externalIdentityId;
- displayName;
- status;
- createdAt.

L'ID Clerk MUST NOT essere utilizzato come primary business identifier nel dominio.

---

## 3.2 Organization

Rappresenta il tenant proprietario degli eventi.

Attributi:

- id;
- name;
- status;
- createdAt.

---

## 3.3 Membership

Associa User e Organization.

Contiene almeno:

- userId;
- organizationId;
- role;
- status.

Ruoli iniziali:

- OWNER;
- TO;
- MEMBER.

Il modello MUST permettere l'aggiunta futura di altri ruoli.

---

## 3.4 Product

Rappresenta un prodotto Compile contenente Protocol.

Esempi:

- Main 1;
- Main 2;
- Main 3;
- Aux 1;
- Aux 2;
- Aux 3.

Product MUST avere un'identità stabile indipendente dal nome visualizzato.

---

## 3.5 Protocol

Rappresenta un Protocol giocabile.

Appartiene esattamente a un Product.

La numerazione attuale 1-45 è un attributo di catalogo, non una limitazione del dominio.

Il sistema MUST NOT assumere un massimo di 45 Protocol.

---

## 3.6 Event

Aggregate principale.

Contiene concettualmente:

- organizationId;
- eventName;
- status;
- selectedProducts;
- assignmentMode;
- plannedRounds;
- currentRound;
- startAt;
- registration settings;
- createdBy;
- createdAt.

---

## 3.7 Participant

Rappresenta la partecipazione di un player a uno specifico Event.

Un User MAY partecipare a molti Event.

Participant contiene il proprio stato competitivo indipendentemente dallo User globale.

---

## 3.8 Protocol Assignment

Associazione:

`Participant → Protocol`

Ogni Participant attivo MUST avere esattamente 3 Protocol prima dell'avvio del torneo.

---

## 3.9 Round

Rappresenta un turno del torneo.

Contiene:

- eventId;
- roundNumber;
- lifecycle state;
- pairings;
- timestamps.

---

## 3.10 Match

Rappresenta un singolo BO1.

Contiene:

- roundId;
- playerA;
- playerB oppure BYE;
- reported result;
- reporting actor;
- dispute state;
- resolution;
- lifecycle state.

---

## 3.11 Result

Outcome normali:

- WIN;
- LOSS.

DRAW esiste nel domain model come stato supportato per robustezza ed evoluzione futura, ma non costituisce un outcome normale del ruleset corrente.

La UI standard SHOULD NOT proporre DRAW come normale opzione ai giocatori.

---

# 4. Core Invariants

Queste invarianti sono non negoziabili.

## 4.1 Event invariants

- Un Event MUST appartenere a esattamente una Organization.
- Un Event MUST avere un solo assignment mode attivo.
- Un torneo MUST NOT iniziare senza plannedRounds valido.
- Un torneo MUST NOT iniziare senza almeno due Participant attivi.
- Dopo l'inizio MUST NOT essere accettata late registration.

---

## 4.2 Protocol invariants

Ogni Participant attivo MUST avere esattamente 3 Protocol all'inizio.

I tre Protocol del singolo Participant MUST essere distinti.

Un Protocol assegnato MUST appartenere a un Product abilitato per quell'Event.

### PLAYER_SELECTION

Lo stesso Protocol MAY appartenere a più Participant.

### RANDOM_DRAFT

Lo stesso Protocol MUST NOT appartenere a più Participant nell'intero Event.

La capacità Random Draft è:

`floor(numero Protocol disponibili / 3)`

Il sistema MUST NOT accettare registrazioni oltre la capacità Random Draft dell'Event.

Poiché il Protocol Pool è immutabile dopo la creazione dell'Event (§9.2), anche la capacità Random Draft è fissata alla creazione.

---

## 4.3 Round invariants

Un Participant attivo MUST apparire al massimo una volta per Round.

Un Participant MUST NOT essere accoppiato con sé stesso.

Un Round N+1 MUST NOT esistere mentre Round N non è FINALIZED.

Un Round FINALIZED MUST essere immutabile.

Match e risultati appartenenti a Round FINALIZED MUST essere immutabili, incluso per il TO.

---

## 4.4 Match invariants

Un normale Match MUST avere due Participant differenti.

Un Match BYE MUST avere esattamente un Participant.

WIN di A implica LOSS di B.

LOSS di A implica WIN di B.

Un Match DISPUTED MUST impedire la finalizzazione del Round.

---

## 4.5 Tournament invariants

Un player DROPPED:

- mantiene lo storico;
- mantiene risultati precedenti;
- non partecipa ai Round successivi.

Un bye vale come WIN.

---

# 5. State Machines

## 5.1 Event

Stati:

`DRAFT`

→ `REGISTRATION_OPEN`

→ `REGISTRATION_CLOSED`

→ `PROTOCOL_ASSIGNMENT`

→ `READY_TO_START`

→ `IN_PROGRESS`

→ `COMPLETED`

Stato alternativo:

`CANCELLED`

### READY_TO_START

Raggiungibile solo se:

- registrazione chiusa;
- Participant definitivi;
- tutti i Participant attivi hanno 3 Protocol validi;
- configurazione torneo valida;
- almeno 2 Participant attivi.

### IN_PROGRESS

L'ingresso in questo stato provoca il lock dei Protocol Assignment.

---

## 5.2 Participant

`REGISTERED`

→ `CHECKED_IN`

Da REGISTERED:

→ `WITHDRAWN`

Da CHECKED_IN durante il torneo:

→ `DROPPED`

Eccezionalmente:

→ `DISQUALIFIED`

Un Participant DROPPED o DISQUALIFIED MUST NOT tornare automaticamente attivo.

---

## 5.3 Round

`CREATED`

→ `PAIRINGS_READY`

→ `ACTIVE`

→ `READY_TO_FINALIZE`

→ `FINALIZED`

### READY_TO_FINALIZE

Consentito solo quando:

- tutti i Match hanno outcome definitivo;
- zero Match sono DISPUTED.

### FINALIZED

Irreversibile nella v1.

---

## 5.4 Match

Normale:

`PENDING`

→ `REPORTED`

→ `FINAL`

Alternativa:

`REPORTED`

→ `DISPUTED`

→ `RESOLVED`

→ `FINAL`

BYE:

`BYE`

→ `FINAL`

L'accettazione dell'avversario MAY permettere una transizione immediata REPORTED → FINAL.

L'assenza di conferma non è un errore.

---

## 5.5 Protocol Assignment

`EDITABLE`

→ `LOCKED`

Dopo LOCKED:

- player MUST NOT modificare;
- TO MAY override;
- override MUST generare audit.

---

# 6. Permission Matrix

## Public/Unauthenticated

Può:

- visualizzare eventi pubblici;
- iniziare registration quando permessa;
- autenticarsi.

Non può:

- vedere informazioni amministrative;
- modificare tornei;
- vedere audit;
- gestire Protocol Assignment di altri.

---

## Player

Può:

- registrarsi quando registration è aperta;
- effettuare le azioni di check-in esposte;
- selezionare i propri Protocol in PLAYER_SELECTION prima del lock;
- vedere i propri Protocol;
- vedere i Protocol dell'avversario corrente;
- vedere il proprio pairing;
- reportare il risultato di un proprio Match;
- accettare il risultato;
- contestare il risultato prima della finalizzazione;
- effettuare drop quando consentito.

Non può:

- modificare risultati altrui;
- modificare pairing;
- generare Round;
- modificare Protocol dopo lock;
- modificare Event configuration.

---

## Tournament Organizer

Il TO con permessi sull'Organization può:

- creare Event;
- configurarlo;
- aprire/chiudere registration;
- gestire Participant;
- gestire check-in;
- generare Random Draft;
- modificare Protocol Assignment;
- generare pairing;
- avviare Round;
- risolvere dispute;
- finalizzare Round;
- terminare torneo;
- vedere audit.

Il TO MUST NOT modificare un Round FINALIZED.

Il fatto che un utente sia TO in Organization A MUST NOT concedere permessi in Organization B.

---

## Platform Administrator

Ruolo operativo futuro.

Può avere accesso amministrativo cross-tenant, ma tali operazioni MUST essere esplicitamente autorizzate e auditabili.

---

# 7. Tournament Engine Specification

## 7.1 Tournament model

Compile Companion usa un modello:

**Record-Based Swiss Pairing**

Il record principale è espresso come:

`W-L`

Il sistema MUST NOT utilizzare una generica implementazione Swiss le cui regole possano divergere da questa specification.

---

## 7.2 Record Groups

All'inizio:

`0-0`

Dopo Round 1:

- `1-0`;
- `0-1`.

Dopo Round 2:

- `2-0`;
- `1-1`;
- `0-2`.

Il processo continua conseguentemente.

DRAW, qualora introdotto in uno scenario eccezionale, richiede un record esteso `W-D-L`.

Il comportamento competitivo dei DRAW non deve essere inventato dagli agenti. Se diventa necessario, richiede una modifica della specification.

---

## 7.3 Pairing priority

Il Tournament Engine minimizza le violazioni in questo ordine concettuale:

1. evitare rematch;
2. mantenere i player nello stesso Record Group;
3. rispettare seeding/tie-break all'interno del gruppo;
4. quando necessario effettuare float verso il gruppo immediatamente inferiore;
5. minimizzare la distanza tra record;
6. accettare rematch solo quando non esiste una soluzione valida senza rematch.

L'implementazione MAY utilizzare backtracking, matching oppure un algoritmo equivalente.

La scelta algoritmica non può alterare le priorità funzionali.

---

## 7.4 Floating

Quando un Record Group contiene un numero dispari di Participant, uno dei player deve essere spostato nel gruppo immediatamente inferiore.

Il Tournament Engine SHOULD scegliere il float che produce il miglior pairing globale rispettando:

- avoidance dei rematch;
- seeding;
- numero precedente di float, se tale metrica verrà introdotta.

Un player MUST NOT essere artificialmente trasformato in vincitore o perdente per effettuare il float.

Il float riguarda unicamente il pairing.

---

## 7.5 Bye

Quando il numero totale di Participant attivi è dispari viene prodotto un bye.

Il bye:

- vale come WIN;
- non ha opponent;
- diventa automaticamente FINAL;
- influenza il record come vittoria.

Selezione prioritaria:

1. Record Group più basso appropriato;
2. player senza bye precedente;
3. tie-break/seeding più basso.

Un player MUST NOT ricevere un secondo bye se esiste un Participant eleggibile che non ha mai ricevuto bye.

---

## 7.6 Rematch

Il Tournament Engine MUST evitare rematch quando esiste una soluzione valida senza rematch.

Un rematch MAY essere prodotto solo quando necessario per ottenere un pairing completo compatibile con le altre invarianti.

Se prodotto, SHOULD essere identificabile come pairing eccezionale.

---

# 8. Standings and Seeding

Ordinamento v1:

1. migliore record W-L;
2. Opponents' Win Rate;
3. Head-to-Head quando applicabile;
4. secondary Strength of Schedule;
5. stable technical seed.

Il technical seed:

- MUST essere stabile;
- MUST NOT cambiare per refresh;
- MUST NOT dipendere dall'ordine di lettura del database;
- MUST consentire un ordinamento totale e riproducibile.

Il sistema MUST essere progettato per consentire in futuro l'introduzione di true competitive seeding e criteri Head-to-Head più sofisticati.

Il Tournament Engine non deve dipendere dall'implementazione concreta futura del seeding.

---

# 9. Protocol Pool Specification

## 9.1 Catalog

Gerarchia:

`Game → Product → Protocol`

Versione iniziale:

`Compile`

con:

- Main 1;
- Main 2;
- Main 3;
- Aux 1;
- Aux 2;
- Aux 3.

Ogni Product produce un set di Protocol.

---

## 9.2 Event Pool

Alla creazione dell'Event il TO seleziona uno o più Product.

La selezione dei Product MUST NOT essere modificata dopo la creazione dell'Event, in nessuno stato e da nessun attore.

Il sistema calcola:

`EventProtocolPool = union(Protocols of selected Products)`

L'EventProtocolPool MUST essere calcolato e conservato come snapshot alla creazione dell'Event.

Future modifiche al catalogo MUST NOT modificare retroattivamente i tornei già iniziati o conclusi.

---

## 9.3 Product configuration

Nella v1 il TO abilita/disabilita solamente Product completi.

Ban o inclusione/esclusione di singoli Protocol NON fanno parte della v1.

Il modello dati SHOULD rendere possibile introdurre in futuro:

- Protocol ban;
- Protocol allow-list;
- restricted Protocol;
- Product rotations.

---

## 9.4 Random Draft

Dato:

`P = numero Participant attivi`

`N = numero Protocol nell'EventProtocolPool`

Random Draft è valido solo se:

`3P ≤ N`

Capacità:

`maxParticipants = floor(N / 3)`

Ogni Protocol può essere utilizzato una sola volta.

Il sorteggio MUST essere atomico.

Un fallimento MUST produrre zero assegnazioni parziali.

---

# 10. API Boundaries

REST è il protocollo applicativo.

OpenAPI è il contratto machine-readable.

## Identity / Organization

Responsabile di:

- current user;
- memberships;
- organizations;
- organization roles.

---

## Events

Responsabile di:

- create/update Event;
- configuration;
- registration lifecycle;
- tournament lifecycle.

MUST NOT implementare il pairing.

---

## Participants

Responsabile di:

- registration;
- check-in;
- drop;
- participant status.

MUST NOT scrivere direttamente risultati Match.

---

## Protocol Catalog

Read API per:

- Product;
- Protocol;
- catalog availability.

---

## Protocol Assignment

Responsabile di:

- Player Selection;
- Random Draft;
- lock;
- TO override.

---

## Tournament

Responsabile di:

- generate next Round;
- generate pairings;
- activate Round;
- finalize Round;
- retrieve standings.

---

## Results

Responsabile di:

- report;
- accept;
- dispute;
- resolve dispute.

---

## Audit

Read-only per utenti autorizzati.

Audit entries MUST NOT essere modificabili tramite normale API.

---

# 11. Data Ownership per Module

Ogni modulo è proprietario dei propri dati.

## Identity owns

- User.

## Organization owns

- Organization;
- Membership.

## Catalog owns

- Game;
- Product;
- Protocol.

## Event owns

- Event;
- EventProductConfiguration.

## Participation owns

- Participant;
- Registration;
- participation status.

## Protocol Assignment owns

- ProtocolAssignment;
- draft metadata;
- lock metadata.

## Tournament owns

- Round;
- Pairing;
- tournament progression.

## Results owns

- MatchResult;
- dispute;
- resolution.

## Standings owns

- derived standings;
- finalized ranking snapshots.

## Audit owns

- AuditEntry.

---

Un modulo MUST NOT scrivere direttamente nelle tabelle possedute da un altro modulo.

Cross-module operations devono avvenire tramite:

- public application services;
- domain/application events;
- repository contracts esplicitamente approvati.

Read cross-module MAY essere implementato tramite query model ottimizzati purché non trasferiscano ownership.

---

# 12. Domain Events

Gli eventi rappresentano fatti già avvenuti.

Naming SHOULD utilizzare past tense.

Eventi iniziali:

### Organization
- OrganizationCreated
- MembershipAdded
- MembershipRoleChanged

### Event
- EventCreated
- RegistrationOpened
- RegistrationClosed
- EventReadyToStart
- TournamentStarted
- TournamentCompleted
- EventCancelled

### Participant
- ParticipantRegistered
- ParticipantCheckedIn
- ParticipantDropped
- ParticipantDisqualified

### Protocol Assignment
- ProtocolsSelected
- RandomDraftGenerated
- ProtocolAssignmentsLocked
- ProtocolAssignmentOverridden

### Tournament
- RoundCreated
- PairingsGenerated
- RoundActivated
- RoundReadyToFinalize
- RoundFinalized

### Results
- MatchResultReported
- MatchResultAccepted
- MatchResultDisputed
- MatchDisputeResolved
- MatchFinalized

### Standings
- StandingsCalculated

Gli eventi che richiedono processing asincrono MUST essere pubblicati tramite transactional outbox.

Una transazione business e il relativo outbox event MUST essere committed insieme.

---

# 13. Audit Requirements

Audit è obbligatorio almeno per:

- Event configuration changes dopo pubblicazione;
- apertura/chiusura registration;
- aggiunta/rimozione amministrativa Participant;
- TO override di Protocol Assignment;
- generazione/reroll Random Draft;
- TO resolution di dispute;
- disqualification;
- manual drop amministrativo;
- tournament start;
- Round finalization;
- tournament early termination;
- modifiche di permission;
- operazioni platform administrator.

Ogni AuditEntry MUST contenere:

- timestamp;
- organizationId;
- eventId quando applicabile;
- actorId;
- action;
- entityType;
- entityId;
- previous state rilevante;
- resulting state rilevante;
- correlation/request identifier.

Reason MUST essere disponibile per operazioni amministrative sensibili.

AuditEntry MUST essere append-only.

La normale applicazione MUST NOT aggiornare o cancellare AuditEntry esistenti.

---

# 14. Concurrency Rules

## 14.1 General

Il fatto che due richieste arrivino simultaneamente MUST NOT permettere di violare un'invariante.

Validazioni esclusivamente frontend sono insufficienti.

Le invarianti critiche devono essere protette da:

- database constraints;
- transaction;
- locking;
- optimistic concurrency;
- oppure combinazione equivalente.

---

## 14.2 Random Draft

Random Draft MUST essere transazionale.

Due richieste concorrenti MUST NOT creare:

- due draft attivi;
- Protocol duplicati;
- assegnazioni parziali.

---

## 14.3 Round generation

Per un Event e round number deve esistere al massimo un Round.

Due richieste concorrenti "Generate next round" MUST produrre un solo Round effettivo.

---

## 14.4 Results

Concurrent report/dispute/accept operations devono utilizzare optimistic concurrency oppure meccanismo equivalente.

L'utente deve ricevere conflict quando opera su una versione obsoleta.

Silent overwrite è vietato.

---

## 14.5 Round Finalization

Finalizzazione MUST verificare atomicamente:

- tutti i Match risolti;
- zero dispute;
- nessuna modifica concorrente;
- standings calculable.

Se una condizione fallisce, l'intera finalizzazione fallisce.

---

## 14.6 Idempotency

Operazioni critiche SHOULD supportare idempotency.

Almeno:

- create registration;
- Random Draft;
- Tournament Start;
- Generate Round;
- report result;
- Finalize Round;
- Complete Tournament.

Retry della stessa richiesta non deve duplicare effetti.

---

# 15. Error Taxonomy

Gli errori applicativi devono essere machine-readable.

Ogni errore contiene almeno:

- error code;
- safe message;
- correlation identifier quando disponibile.

## VALIDATION_ERROR

Input sintatticamente o semanticamente invalido.

Esempi:

- plannedRounds negativo;
- meno di 3 Protocol selezionati;
- Product inesistente.

---

## AUTHENTICATION_REQUIRED

Nessuna identità valida.

---

## FORBIDDEN

Utente autenticato ma non autorizzato.

---

## NOT_FOUND

Risorsa inesistente o non visibile all'utente.

---

## INVALID_STATE_TRANSITION

L'operazione non è consentita nello stato corrente.

Esempio:

tentativo di generare Round 3 mentre Round 2 è ACTIVE.

---

## PROTOCOL_POOL_INSUFFICIENT

Random Draft impossibile.

Deve fornire almeno:

- requiredProtocolCount;
- availableProtocolCount;
- participantCount;
- maximumParticipantCount.

---

## PROTOCOL_ASSIGNMENT_CONFLICT

Violazione delle regole di assignment.

---

## PAIRING_IMPOSSIBLE

Il Tournament Engine non riesce a produrre un pairing valido rispettando le invarianti hard.

MUST NOT inventare o scartare Participant per procedere.

---

## RESULT_DISPUTED

Operazione bloccata da contestazione aperta.

---

## ROUND_NOT_FINALIZABLE

Round non finalizzabile.

La risposta SHOULD specificare i blocker.

---

## CONCURRENT_MODIFICATION

La risorsa è cambiata dall'ultima lettura.

Il client deve refreshare lo stato prima di un nuovo tentativo.

---

## IDEMPOTENCY_CONFLICT

Una idempotency key è stata riutilizzata con payload semanticamente diverso.

---

## INTERNAL_ERROR

Errore non previsto.

MUST NOT esporre stack trace o informazioni sensibili al client.

---

# 16. Test Invariants

Queste proprietà devono essere testate automaticamente.

## Protocol Assignment

Per ogni Random Draft valido:

- ogni Participant riceve esattamente 3 Protocol;
- nessun Participant riceve duplicati;
- nessun Protocol appare su due Participant;
- tutti i Protocol appartengono ai Product dell'Event.

Property-based testing SHOULD coprire differenti pool e quantità di Participant.

---

## Player Selection

- ogni Participant ha 3 Protocol distinti;
- duplicati tra Participant sono ammessi;
- Protocol fuori pool sono impossibili.

---

## Pairing

Per ogni Round:

- ogni Participant attivo appare esattamente una volta, incluso eventuale bye;
- nessuno affronta sé stesso;
- massimo un bye;
- rematch assente se esiste soluzione valida senza rematch;
- pairing favorisce stesso record;
- floating avviene verso record inferiore quando necessario;
- Round generation è deterministica quando input e seed tecnico sono identici.

---

## Bye

- vale come WIN;
- non possiede opponent;
- non richiede report;
- viene finalizzato automaticamente;
- un secondo bye non viene assegnato se esiste candidato senza bye.

---

## Results

- WIN A implica LOSS B;
- LOSS A implica WIN B;
- solo player del Match o TO autorizzato può intervenire;
- dispute blocca finalizzazione;
- accepted result non richiede altra conferma;
- un risultato può esistere senza explicit acceptance.

---

## Round lifecycle

- Round N+1 non può essere creato prima di FINALIZED(N);
- FINALIZED è irreversibile;
- nessun risultato di Round FINALIZED può cambiare;
- nessuna dispute può essere aperta su Round FINALIZED.

---

## Multi-tenancy

- membro Organization A non può accedere a dati protetti di Organization B;
- TO A non può modificare Event B;
- identifier enumeration non deve bypassare authorization.

---

## Concurrency

Integration test MUST coprire almeno:

- doppio Random Draft;
- doppio Tournament Start;
- doppio Generate Round;
- result report concorrenti;
- dispute durante finalizzazione;
- Finalize Round simultaneo;
- retry con idempotency key.

I test di concorrenza devono usare PostgreSQL reale o ambiente semanticamente equivalente.

---

# 17. Agentic Development Rules

Questa sezione è normativa.

## 17.1 Agents MUST NOT reinterpret

Un agente MUST NOT autonomamente modificare:

1. BO1 in BO3 o altro formato.
2. WIN/LOSS come outcome standard.
3. struttura Record-Based Swiss.
4. priorità fondamentali del pairing.
5. bye = WIN.
6. 3 Protocol per Participant.
7. unicità globale nel Random Draft.
8. duplicati consentiti tra player in Player Selection.
9. Protocol lock all'avvio.
10. possibilità TO di override Protocol con audit.
11. assenza di late join.
12. possibilità di drop.
13. immutabilità di Round FINALIZED.
14. impossibilità di creare Round N+1 prima di finalizzare N.
15. conferma risultato opzionale.
16. possibilità di contestare prima della finalizzazione.
17. Product come unità configurabile del Protocol Pool v1.
18. Organization come proprietaria dell'Event.
19. isolamento multi-tenant.
20. PostgreSQL come source of truth.
21. modular monolith come architecture style.
22. REST/OpenAPI come boundary frontend/backend.
23. Clerk limitato all'authentication.
24. authorization come responsabilità interna.
25. cloud provider independence del domain layer.

---

## 17.2 Agents MUST NOT introduce silently

Un agente non può introdurre senza ADR/review:

- microservizi;
- GraphQL;
- NoSQL come source of truth;
- Redis come requisito core;
- WebSocket come requisito core;
- event sourcing;
- CQRS completo;
- Kubernetes;
- AWS-specific logic nel domain;
- direct database access dal frontend;
- cross-module table writes;
- shared mutable global state;
- business invariants solo nel frontend;
- bypass dell'audit per convenience;
- auto-correction di dati incoerenti senza traccia;
- modifica retroattiva di Round FINALIZED.

---

## 17.3 Agent change protocol

Quando una richiesta sembra richiedere la violazione della specification, l'agente MUST:

1. fermare l'implementazione della parte confliggente;
2. identificare la regola coinvolta;
3. descrivere il conflitto;
4. proporre una modifica della specification o ADR;
5. attendere approvazione umana prima di implementare la deviazione.

L'agente MUST NOT "risolvere pragmaticamente" un conflitto modificando implicitamente il comportamento.

---

## 17.4 Agent freedom

Gli agenti possono decidere autonomamente dettagli implementativi che non alterano la semantica.

Esempi:

- naming locale;
- factoring di funzioni;
- private helper;
- ottimizzazioni query equivalenti;
- strutture dati interne;
- algoritmi di matching equivalenti;
- componentizzazione UI;
- caching non osservabile semanticamente;
- test aggiuntivi;
- refactoring che preservano boundary e comportamento.

---

# 18. Required Engineering Gates

Ogni change set prodotto autonomamente deve superare:

1. formatting;
2. lint;
3. TypeScript strict type-check;
4. unit tests;
5. domain invariant tests;
6. integration tests rilevanti;
7. OpenAPI contract validation;
8. database migration validation quando applicabile;
9. architectural boundary checks;
10. security/static analysis;
11. secret scanning.

Per modifiche ad alto rischio è richiesta review umana.

Aree ad alto rischio:

- authentication;
- authorization;
- tenant isolation;
- Tournament Engine;
- Random Draft;
- Standings;
- migrations distruttive;
- audit;
- concurrency;
- secrets/infrastructure;
- data deletion.

---

# 19. Architectural Principles

## AP-01: Domain before infrastructure

Tournament rules MUST NOT dipendere da Next.js, NestJS, Prisma, Clerk o cloud provider.

---

## AP-02: PostgreSQL is authoritative

Lo stato competitivo ufficiale risiede in PostgreSQL.

Cache e read models sono derivati.

---

## AP-03: Strong consistency for competitive state

Si privilegia consistenza rispetto a disponibilità per:

- Protocol Assignment;
- Round generation;
- results;
- finalization;
- standings.

Un errore esplicito è preferibile a uno stato competitivo ambiguo.

---

## AP-04: Immutable competitive history

La finalizzazione crea una boundary temporale.

Dopo FINALIZED, il passato competitivo non viene riscritto.

---

## AP-05: Audit administrative power

Il TO possiede poteri elevati prima della finalizzazione.

L'esercizio di tali poteri deve essere osservabile e auditabile.

---

## AP-06: Agent-readable architecture

La struttura del repository deve privilegiare:

- convenzioni;
- responsabilità singole;
- dependency direction esplicita;
- invarianti eseguibili;
- contratti machine-readable;
- errori tipizzati;
- comportamento deterministico.

Ridurre il numero di righe di codice non è una priorità rispetto alla chiarezza architetturale.

---

# 20. Deferred Features

Esplicitamente fuori scope v1:

- ban di singoli Protocol;
- true competitive seeding avanzato;
- native mobile app;
- payments;
- global ranking;
- leagues/seasons;
- playoff Top N;
- real-time infrastructure avanzata;
- chat;
- streaming;
- push notifications;
- offline-first;
- imports/exports avanzati;
- public developer API;
- webhooks esterni;
- multiple game systems;
- BO3/BO5;
- regole competitive complete per DRAW.

La presenza di questi elementi nel modello futuro non costituisce autorizzazione a implementarli nell'MVP.

---

# 21. Open Infrastructure Decisions

Le seguenti decisioni sono intenzionalmente lasciate aperte:

- production cloud provider;
- AWS service selection;
- CI runtime;
- production object storage;
- email provider;
- queue provider;
- caching solution;
- Redis adoption;
- production observability backend;
- CDN;
- real-time transport.

AWS è un possibile target futuro ma NON è ancora una decisione architetturale normativa.

Tutte le implementazioni devono mantenere tali elementi sostituibili dietro boundary/adapters quando applicabile.

---

# 22. Definition of Correctness

Un torneo Compile Companion è considerato corretto quando:

1. solo Participant validi possono partecipare;
2. ogni Participant parte con un Protocol Assignment valido;
3. il Protocol Pool corrisponde ai Product scelti dal TO;
4. Random Draft non produce Protocol duplicati;
5. ogni Round contiene tutti e soli i Participant attivi;
6. pairing rispetta le regole Record-Based Swiss;
7. bye e float rispettano le priorità definite;
8. ogni Match produce uno stato coerente;
9. ogni dispute viene risolta prima della finalizzazione;
10. la finalizzazione è atomica;
11. il Round finalizzato è immutabile;
12. Standings sono riproducibili dai risultati;
13. la generazione del Round successivo usa esclusivamente stato finalizzato;
14. tenant differenti rimangono isolati;
15. operazioni amministrative sensibili sono auditabili;
16. retry e concorrenza non producono duplicazioni o stati impossibili.

Questa definizione ha precedenza su convenience UI e ottimizzazioni tecniche.

---

# 23. Baseline Decision

Con l'approvazione di questo documento:

**Technical & Functional Specification v1.0 diventa la baseline normativa di Compile Companion.**

Nuove funzionalità possono estendere il sistema, ma non modificare implicitamente le invarianti qui definite.

Una modifica semantica richiede almeno uno dei seguenti:

- nuova versione della specification;
- ADR esplicitamente approvato;
- aggiornamento umano delle regole normative.

Gli agenti implementano la specification.

**Gli agenti non definiscono autonomamente le regole del prodotto.**