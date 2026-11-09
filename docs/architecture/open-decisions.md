# Open Decisions

**Fonte normativa:** spec v1.0. Nessun ADR approvato. Nessun contratto OpenAPI esistente.

Il documento separa:

1. decisioni normative già prese (non rinegoziabili senza nuova spec/ADR);
2. dettagli implementativi liberamente decidibili (spec §17.4);
3. decisioni che richiedono ADR o chiarimento della specification;
4. decisioni infrastrutturali intenzionalmente aperte (spec §21).

Gli ID `OD-xxx` sono referenziati dalla colonna Stato di `spec-traceability.md`.

---

## 1. Decisioni normative già prese

Fonte: spec §1, §17.1, §17.2, §19 e `CLAUDE.md`. Un agente non può modificarle.

| Area | Decisione | Rif. |
|---|---|---|
| Architettura | Modular monolith; TypeScript end-to-end; monorepo pnpm + Turborepo | §1, §17.1.21 |
| Frontend/backend | Next.js (web/PWA), NestJS (API), REST + OpenAPI come confine | §1, §17.1.22 |
| Persistenza | PostgreSQL source of truth; Prisma ORM primario; SQL per constraint non esprimibili | §1, §17.1.20 |
| Identità | Clerk solo authentication; authorization interna | §1, §17.1.23-24 |
| Tenancy | Organization proprietaria di ogni Event; isolamento multi-tenant | §2.2, §17.1.18-19 |
| Async | Transactional outbox per eventi asincroni | §1, §12 |
| Real-time | Non MVP; WebSocket/SSE/Redis/queue non dipendenze del core | §1 |
| Cloud | Nessun provider scelto; dominio indipendente dal cloud | §1, §21 |
| Formato | BO1; outcome standard WIN/LOSS; DRAW solo nel modello | §3.10, §3.11, §17.1.1-2 |
| Engine | Record-Based Swiss; priorità di pairing §7.3; bye = WIN; rematch solo se inevitabile | §7, §17.1.3-5 |
| Protocol | 3 Protocol distinti per Participant; unicità globale in Random Draft; duplicati ammessi in Player Selection; Product come unità del pool; snapshot non retroattivo | §4.2, §9, §17.1.6-8, 17 |
| Lock/override | Lock all'avvio; override TO con audit | §5.5, §17.1.9-10 |
| Partecipazione | Niente late registration; drop consentito | §4.1, §17.1.11-12 |
| Round | FINALIZED immutabile e irreversibile; Round N+1 solo dopo FINALIZED(N) | §4.3, §17.1.13-14 |
| Risultati | Conferma opzionale; contestazione possibile prima della finalizzazione | §5.4, §17.1.15-16 |
| Standings | Ordine: W-L, OWR, H2H, SoS secondario, technical seed stabile | §8 |
| Errori | Tassonomia §15, machine-readable | §15 |
| Audit | Append-only, categorie §13, contenuto minimo §13 | §13 |
| Fuori scope | Tutte le feature §20 | §20 |

## 2. Dettagli implementativi liberamente decidibili

Decidibili dall'agente senza ADR, purché non alterino la semantica (spec §17.4). Le scelte proposte sono indicative.

| Tema | Scelta proposta |
|---|---|
| ID | UUID v7 generati applicativamente (ordinabili, non enumerabili) |
| Naming tabelle/colonne | `snake_case`, schema per modulo |
| Rappresentazione outcome | `winner_participant_id` + `kind`, nessuna doppia scrittura WIN/LOSS |
| Win rate | Razionali esatti (numeratore/denominatore interi) nel dominio; arrotondamento solo in presentazione |
| Algoritmo di pairing | Backtracking con pruning o weighted matching, a condizione che superi la suite property-based contro un oracolo brute-force (TRN-PAIR-002) |
| Strutture dati interne, helper, factoring | Libero |
| Libreria property-based | `fast-check` |
| Test DB | Testcontainers PostgreSQL (versione allineata alla produzione) |
| Generazione client OpenAPI per il web | `openapi-typescript` o equivalente |
| Componentizzazione UI | Libero |
| Formato audit `action` | Stringhe namespaced (`tournament.round.finalized`) |
| Caching | Solo se non osservabile semanticamente; non nell'MVP |

## 3. Decisioni che richiedono ADR o chiarimento della specification

### 3.1 Ambiguità della specification (richiedono decisione di prodotto: aggiornamento spec o ADR approvato)

Queste toccano la semantica competitiva o funzionale. **L'agente non può risolverle autonomamente** (spec §17.3).

| ID | Tema | Ambiguità concreta | Sezioni | Impatto | Proposta da sottoporre |
|---|---|---|---|---|---|
| OD-001 | Definizione di "Participant attivo" e check-in | La spec usa "attivo" senza definirlo. Un Participant `REGISTERED` non in `CHECKED_IN` all'avvio è attivo? Il check-in è obbligatorio? Cosa succede ai `REGISTERED` non presentati (diventano `WITHDRAWN`? non esiste transizione REGISTERED→DROPPED)? | 3.8, 4.1, 4.2, 5.1, 5.2 | Bloccante per start, Random Draft (P), pairing | Attivo = `CHECKED_IN` dopo l'avvio; check-in obbligatorio prima di READY_TO_START; i non presentati vengono portati a `WITHDRAWN` dal TO con audit prima della chiusura. **RISOLTO 2026-11-09:** attivo = CHECKED_IN che non ha droppato né è stato squalificato. Il check-in è obbligatorio prima dell'avvio. Chi non lo fa passa a **WITHDRAWN** (non DROPPED, che la spec §5.2 ammette solo da CHECKED_IN) quando il TO porta l'Event in READY_TO_START; la transizione è eseguita dal sistema e auditata. Gli eventuali Protocol assegnati a chi esce vengono rilasciati. |
| OD-002 | Funzione obiettivo del pairing | §7.3 elenca priorità in "ordine concettuale" ma (a) le voci 1 e 6 coincidono, (b) non è definito se, per evitare un rematch, sia ammesso un float di più di un gruppo (voce 4 dice "immediatamente inferiore", voce 5 "minimizzare distanza"), (c) "Record Group più basso appropriato" per il bye non è definito, (d) ordine tra "player senza bye precedente" e "gruppo più basso" nella selezione bye, (e) chi viene floatato dal gruppo dispari (seed più basso?), (f) come si confrontano due soluzioni con lo stesso numero di rematch ma diversa distribuzione di float. | 7.3, 7.4, 7.5, 7.6 | Bloccante per il Tournament Engine | Formalizzare un costo lessicografico: (1) n. rematch, (2) somma delle distanze di record dei pairing, (3) n. float, (4) somma degli scarti di seed nel gruppo; bye: escludere chi ha già avuto bye se possibile, poi gruppo più basso, poi seed più basso. Da approvare con esempi worked. **RISOLTO 2026-11-09:** (a) float al massimo di un gruppo, altrimenti rematch; (b) pairing adiacente 1-2, 3-4; (c) scende il rank più basso; (e) float precedenti esclusi dalla v1. (d) bye scelto prima del pairing; evitare i rematch prevale sulla scelta del bye più basso. **OD-002 chiuso.** Formalizzazione in ADR-012. |
| OD-002b | Formule dei tie-break | OWR: i bye contano come avversari? avversari DROPPED inclusi? soglia minima (es. 33%)? H2H "quando applicabile": solo pareggi a 2 o anche gruppi n-way? "secondary Strength of Schedule": è OOWR (win rate degli avversari degli avversari) o altro? | 8 | Bloccante per Standings e per il seeding intra-gruppo | OWR esclude i bye, include avversari droppati con il loro record finale, nessuna soglia; H2H applicato solo se tutti i pari merito si sono affrontati tra loro; SoS = OOWR. **PARZIALE 2026-11-09:** confermato l'ordine OWR > H2H > SoS. **Restano aperte le formule** (bye nell'OWR, avversari droppati, soglia minima, H2H n-way, definizione di SoS). |
| OD-003 | Finalizzazione di risultati non confermati | §5.3 READY_TO_FINALIZE richiede "outcome definitivo"; §5.4 dice che l'assenza di conferma non è un errore. Un Match `REPORTED` non accettato e non contestato conta come definitivo? Quando passa a `FINAL` (alla finalizzazione del round)? Chi può reportare (entrambi i player? un secondo report discordante equivale a dispute? un report può essere corretto dallo stesso player prima dell'accept?) Il TO può inserire o modificare un risultato non contestato? | 5.3, 5.4, 6 | Bloccante per Results e finalizzazione | `REPORTED` non contestato è sufficiente; la finalizzazione del Round porta a `FINAL` tutti i `REPORTED`/`RESOLVED`; un report discordante dell'avversario apre automaticamente una dispute; il TO può reportare per conto dei player con audit. **RISOLTO 2026-11-09:** il Round non si finalizza finché tutti i match non hanno un risultato. Un risultato REPORTED non contestato conta come inserito (la conferma resta opzionale, §5.4). Il TO può inserire il risultato a mano, con audit. Alla finalizzazione tutti i risultati passano a FINAL. **Resta aperto:** se un report discordante dell'avversario apre automaticamente una dispute. |
| OD-004 | Momento dello snapshot del pool | §9.2 richiede che l'Event "conservi la configurazione", §4.2 lega la capacità di registrazione al pool. Quando si congela lo snapshot (apertura registrazione? avvio?) e cosa implica "esplicita modifica del Protocol Pool" a registrazione aperta? | 4.2, 9.2 | Capacità Random Draft, risk snapshot | Snapshot a `REGISTRATION_OPEN`; modifiche di Product successive solo dal TO, auditate, rifiutate se la nuova capacità < iscritti. Congelamento definitivo a `IN_PROGRESS`. |
| OD-005 | Reroll del Random Draft | §13 menziona "reroll" ma la spec non dice quando è consentito, se dopo il lock, né cosa accade agli assignment di un draft precedente. | 9.4, 13, 14.2 | Random Draft | Reroll consentito solo in `PROTOCOL_ASSIGNMENT`, sostituisce atomicamente il draft precedente (status SUPERSEDED), richiede reason, auditato. Mai dopo il lock (usare override). |
| OD-006 | plannedRounds valido | Nessun range definito. Massimo legato al numero di Participant? Modificabile durante il torneo? | 4.1 | Validazione Event | Intero ≥ 1; ≤ 20 (limite tecnico); non modificabile dopo `IN_PROGRESS` senza decisione esplicita. Warning (non errore) se plannedRounds > ⌈log2(P)⌉+1. |
| OD-007 | DRAW in v1 | DRAW esiste nel modello ma il comportamento competitivo non è definito (§7.2). Un TO può registrare DRAW in risoluzione? Come lo tratterebbe il motore? | 3.11, 7.2 | Results, Engine | In v1 l'API rifiuta DRAW (`VALIDATION_ERROR`); il tipo esiste nel dominio ma Engine e Standings rifiutano input con DRAW (`INVALID_STATE_TRANSITION`). |
| OD-008 | Drop durante un Round attivo | Se un player droppa con Round ACTIVE: il match corrente viene giocato/perso a tavolino/lasciato al TO? Self-drop consentito in quali stati? Drop prima dell'avvio = WITHDRAWN? | 4.5, 5.2, 6 | Participation, Results | Il drop ha effetto dal Round successivo; il match corrente resta da reportare (il TO può risolverlo). Self-drop consentito solo in `IN_PROGRESS`; prima dell'avvio si usa WITHDRAWN. |
| OD-009 | Lacune nella state machine Event | "Dopo pubblicazione" (§13) non corrisponde a uno stato. Da quali stati si può andare in `CANCELLED`? Si può riaprire la registration? Condizione di `COMPLETED` (tutti i plannedRounds finalizzati?) e semantica di "early termination" (stato COMPLETED o CANCELLED?). In PLAYER_SELECTION lo stato `PROTOCOL_ASSIGNMENT` è obbligatorio o la selezione avviene già in registrazione? | 5.1, 13 | Event | "Pubblicazione" = uscita da DRAFT; CANCELLED da qualunque stato non terminale; nessuna riapertura in v1; COMPLETED quando l'ultimo planned round è FINALIZED o per early termination del TO (con reason, auditata), che richiede nessun round non FINALIZED; selezione dei Protocol consentita da REGISTRATION_OPEN fino al lock. |
| OD-010 | Lacune nella state machine Round | Chi provoca CREATED → PAIRINGS_READY (stessa operazione di creazione?) Il TO può rigenerare o modificare manualmente pairing prima di ACTIVE (spec §6 elenca "generare pairing" ma non "modificare")? ACTIVE → READY_TO_FINALIZE è automatico all'ultimo risultato o manuale? Torna indietro se viene aperta una dispute? | 5.3, 6 | Tournament | CREATED e PAIRINGS_READY nella stessa TX di generazione; nessuna modifica manuale ai pairing in v1 (richiederebbe override auditato, fuori spec); READY_TO_FINALIZE derivato e reversibile verso ACTIVE se si apre una dispute; FINALIZED solo con comando TO. |
| OD-015 | Origine del technical seed | §8 impone le proprietà del seed ma non come viene assegnato (random all'avvio? ordine di registrazione? valore inserito dal TO?). Serve anche al Round 1. | 8 | Standings, Engine | Permutazione casuale generata all'avvio con seed RNG persistito e auditato; valore persistito per Participant, UNIQUE per Event. **RISOLTO 2026-11-09:** permutazione casuale all'avvio, persistita e mai ricalcolata (ADR-011). |
| OD-016 | Visibilità pubblica degli Event | §6 parla di "eventi pubblici" ma il modello Event non ha un attributo di visibilità. | 3.6, 6 | API pubblica | Aggiungere `visibility: PUBLIC \| UNLISTED` (default UNLISTED); pubblici visibili da REGISTRATION_OPEN. |
| OD-018 | Mappatura ruoli → permessi | OWNER ha tutti i permessi TO? MEMBER cosa può fare? Un player deve essere membro dell'Organization per registrarsi? | 3.3, 6 | Authorization | OWNER ⊇ TO; MEMBER nessun permesso amministrativo; i player **non** richiedono membership (sono User con Participant). **RISOLTO 2026-11-09:** proposta confermata: OWNER ⊇ TO, MEMBER senza permessi amministrativi, i player non richiedono membership. |
| OD-019 | Disqualification durante un Round | Effetto su match corrente e risultati già finalizzati (restano, per §4.5 analogia)? | 4.5, 5.2 | Participation, Results | Risultati finalizzati invariati; match corrente risolto dal TO; escluso dai round successivi. |

### 3.2 Decisioni architetturali che richiedono ADR

| ADR | Titolo | Contenuto da decidere | Bloccante per |
|---|---|---|---|
| ADR-001 | Struttura del monorepo e wiring framework | Layout `apps/` + `packages/modules/*` + `packages/shared-kernel` + `packages/platform`; NestJS solo in `apps/api`; un package per modulo con `contract` pubblico | CS-00 |
| ADR-002 | Layering dei moduli e orchestration layer | Livelli L0-L11 di `module-dependencies.md`, divieto di cicli, use case cross-module in `orchestration` | CS-00 |
| ADR-003 | Data ownership fisica | Schema PostgreSQL per modulo; ruoli DB per schema o client Prisma per schema (Prisma multiSchema); niente FK cross-schema | CS-01 |
| ADR-004 | Transazioni cross-module | Porta `UnitOfWork`, propagazione del transaction context, isolation level (READ COMMITTED + lock espliciti vs SERIALIZABLE), ordine di lock canonico | CS-02 |
| ADR-005 | Audit sincrono in transazione | AuditRecorder scrive nella stessa TX dell'operazione; append-only enforced a DB | CS-02 |
| ADR-006 | Transactional outbox | Schema outbox, relay in-process vs worker separato, at-least-once, dedup consumer | CS-02 |
| ADR-007 | Idempotency | Header `Idempotency-Key`, scope (actor + route + key), hash del payload, TTL, risposta memorizzata, stessa TX dell'effetto | CS-02 |
| ADR-008 | Optimistic concurrency via HTTP | `version` per aggregate, `ETag`/`If-Match`, mapping a `409 CONCURRENT_MODIFICATION` | CS-02 |
| ADR-009 | Formato errori HTTP | RFC 9457 `application/problem+json` esteso con `code` (§15) e `correlationId`; mapping codice → status HTTP | CS-02 |
| ADR-010 | Modello di authorization | `ActorContext`, permessi astratti, policy in Organization, verifica tenant nei repository, NOT_FOUND per risorse cross-tenant | CS-04 |
| ADR-011 | Randomness | CSPRNG per generare un seed, PRNG deterministico seedato (es. xoshiro/PCG) nel dominio, seed persistito per riproducibilità e audit (OD-014) | CS-10 |
| ADR-012 | Algoritmo e funzione obiettivo del pairing | Dopo l'approvazione di OD-002: algoritmo scelto, oracolo di test, limiti di complessità (P max supportato) | CS-12 |
| ADR-013 | Contract-first OpenAPI | OpenAPI scritto a mano (contract-first) vs generato da NestJS decorators; dove vive (`packages/api-contract`); validazione in CI | CS-00 |

Altre decisioni minori con ID già referenziati:

| ID | Tema | Tipo |
|---|---|---|
| OD-011 | Ownership del Match: `Pairing` in Tournament, `MatchResult` in Results (1:1 su `matchId`), bye creato da Results in `openMatches` come `BYE→FINAL`. Proposta in `bounded-contexts.md`; conferma con ADR-003. | ADR |
| OD-012 | Provisioning dell'Organization personale per organizzatori individuali (automatica al primo "crea Event" o esplicita) e chi può creare Organization. | Chiarimento prodotto (minore) **RISOLTO 2026-11-09:** creazione esplicita alla prima azione "diventa organizzatore", l'utente diventa OWNER. |
| OD-013 | Contenuto del catalogo iniziale: nomi e numerazione dei 45 Protocol e assegnazione ai Product. Serve una fonte autorevole fornita dal product owner. | Input dati **RISOLTO 2026-11-09:** ID placeholder in `architecture/catalog-seed-v1.md`; nomi reali da fornire più avanti. |
| OD-014 | Vedi ADR-011. | ADR |
| OD-017 | Finalizzazione come unica TX che coinvolge Tournament, Results, Standings (vedi ADR-004). | ADR |

## 4. Decisioni infrastrutturali intenzionalmente aperte

Restano aperte (spec §21). **Non viene scelto alcun cloud provider.** Ogni elemento deve stare dietro una porta/adapter.

| Tema | Stato | Vincolo per l'MVP |
|---|---|---|
| Production cloud provider | Aperto | Solo Docker image + variabili d'ambiente; nessun SDK cloud nel codice applicativo |
| Selezione servizi AWS | Aperto (AWS non normativo) | Nessuna |
| CI runtime | Aperto | La pipeline deve essere descritta in modo portabile (script `pnpm`/`turbo`); serve Docker per Testcontainers |
| Object storage | Aperto | Non necessario nell'MVP |
| Email provider | Aperto | Non necessario (Notifications fuori MVP core) |
| Queue provider | Aperto | Outbox relay su PostgreSQL; nessuna queue esterna |
| Caching | Aperto | Nessun cache nell'MVP |
| Redis | Aperto | Non adottato |
| Observability backend | Aperto | Log strutturati JSON con correlationId; adapter OpenTelemetry opzionale |
| CDN | Aperto | Nessuno |
| Real-time transport | Aperto | Polling |
| PostgreSQL gestito vs self-hosted, versione | Aperto | Versione minima da fissare in ADR-003 (feature richieste: schemi, partial unique index, `SKIP LOCKED`) |
| Secret management | Aperto | Variabili d'ambiente; nessun secret nel repository; secret scanning in CI |

---

## 5. Valutazione finale

### Esito: **GO WITH BLOCKERS**

La specification è sufficientemente completa per avviare le fondamenta (Fase 0-2 della roadmap). Non sono emersi conflitti tra la spec e la struttura del repository: il repository contiene solo `CLAUDE.md` e la spec, quindi non c'è codice da riconciliare.

**Si può partire subito con:** CS-00 (dopo ADR-001/002/013), CS-01, CS-02, CS-03, CS-05 (dati a parte), CS-06.

### Blocker concreti

| # | Blocker | Blocca | Tipo di risoluzione |
|---|---|---|---|
| B1 | ADR-001, ADR-002, ADR-013 non esistono (struttura monorepo, layering, OpenAPI contract-first) | CS-00 e tutto il resto | Approvazione umana degli ADR proposti in questo pacchetto |
| B2 | ADR-003..009 (schema per modulo, UoW, audit in TX, outbox, idempotency, OCC, formato errori) | CS-01, CS-02 | ADR |
| B5 | OD-002b: formule di OWR, H2H n-way e SoS secondario (l'ordine è già confermato) | CS-16, CS-17 (e seeding intra-gruppo dell'engine) | Aggiornamento spec |
| B6 | OD-003 (residuo): un report discordante apre automaticamente una dispute? | CS-15 | Decisione di prodotto |

Blocker minori (non bloccano il percorso critico iniziale ma vanno chiusi prima del CS indicato): OD-004 (CS-07), OD-005 (CS-10), OD-006 (CS-06), OD-007 (CS-15), OD-008/019 (CS-18), OD-009 (CS-07/19), OD-010 (CS-14), OD-016 (CS-06).

Condizione per passare a **GO**: B1-B2 approvati e B5-B6 risolti prima dell'inizio della Fase 3.
