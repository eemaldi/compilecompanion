# Compile Companion: istruzioni normative per gli agenti

Stai lavorando su Compile Companion, una companion application per Compile focalizzata sulla gestione di tornei.

Prima di analizzare, progettare o modificare il codice:

1. Leggi integralmente `docs/specifications/compile-companion-v1.md`.
2. Tratta quel documento come fonte normativa primaria.
3. Leggi gli ADR approvati applicabili alla modifica.
4. Verifica i contratti OpenAPI interessati.
5. Esamina il codice esistente senza assumere che rappresenti il comportamento corretto.

## Ordine di precedenza

In caso di conflitto, applica questo ordine:

1. specification approvata;
2. ADR approvati;
3. contratti OpenAPI;
4. documentazione implementativa;
5. codice esistente.

Il codice esistente non prevale sulla specification.

## Interpretazione normativa

- MUST indica un requisito obbligatorio.
- MUST NOT indica un comportamento vietato.
- SHOULD indica un requisito fortemente raccomandato. Ogni deviazione deve essere motivata.
- MAY indica un comportamento opzionale.

Non trasformare autonomamente un MUST o MUST NOT in SHOULD o MAY.

## Regole non negoziabili

Non modificare implicitamente:

- modular monolith;
- TypeScript end-to-end;
- PostgreSQL come source of truth;
- REST e OpenAPI come confine frontend/backend;
- Clerk limitato all'autenticazione;
- authorization interna all'applicazione;
- Organization proprietaria di ogni Event;
- isolamento multi-tenant;
- BO1;
- outcome standard WIN/LOSS;
- Record-Based Swiss Pairing;
- priorità funzionali del pairing;
- bye equivalente a una vittoria;
- tre Protocol distinti per Participant;
- unicità globale dei Protocol in Random Draft;
- duplicati tra Participant consentiti in Player Selection;
- lock degli assignment all'avvio del torneo;
- override del TO con audit;
- divieto di late registration;
- possibilità di drop;
- immutabilità dei Round FINALIZED;
- divieto di creare Round N+1 prima della finalizzazione di Round N;
- conferma del risultato opzionale;
- possibilità di contestare prima della finalizzazione;
- Product come unità configurabile del pool nella v1;
- indipendenza del domain layer dal cloud provider.

## Tecnologie e pattern vietati senza ADR approvato

Non introdurre silenziosamente:

- microservizi;
- GraphQL;
- NoSQL come source of truth;
- Redis come requisito del core;
- WebSocket o SSE come requisito del core;
- event sourcing;
- CQRS completo;
- Kubernetes;
- logica AWS-specifica nel dominio;
- accesso diretto al database dal frontend;
- scritture cross-module;
- business invariant protette soltanto dalla UI;
- modifiche retroattive a Round FINALIZED;
- bypass dell'audit;
- correzione automatica di dati incoerenti senza traccia.

## Protocollo in caso di conflitto

Se la richiesta sembra richiedere una violazione della specification:

1. interrompi l'implementazione della parte confliggente;
2. identifica la sezione e la regola coinvolta;
3. descrivi concretamente il conflitto;
4. indica quali invarianti o contratti verrebbero alterati;
5. proponi un aggiornamento della specification oppure un ADR;
6. separa le parti non confliggenti che possono essere implementate;
7. attendi approvazione umana prima di implementare la deviazione.

Non adottare una soluzione pragmatica che modifichi implicitamente il comportamento.

## Boundary architetturali

Il domain layer non deve dipendere da:

- Next.js;
- NestJS;
- Prisma;
- Clerk;
- cloud provider;
- HTTP;
- UI.

Ogni modulo possiede i propri dati. Un modulo non può scrivere direttamente nelle tabelle di un altro modulo.

Le interazioni cross-module devono usare:

- application service pubblici;
- domain o application events;
- repository contract esplicitamente approvati;
- query model read-only quando appropriato.

## Metodo operativo

Prima di implementare:

1. elenca requisiti e invarianti applicabili;
2. indica i moduli coinvolti;
3. identifica i dati posseduti da ciascun modulo;
4. descrivi le transazioni necessarie;
5. individua i rischi di concorrenza;
6. indica eventuali eventi di dominio e audit entry;
7. elenca test unitari, property-based, integration e contract necessari;
8. suddividi il lavoro in change set piccoli e revisionabili.

Durante l'implementazione:

- usa TypeScript strict;
- mantieni gli errori applicativi machine-readable;
- usa transazioni e constraint PostgreSQL per le invarianti critiche;
- evita validazioni esclusivamente frontend;
- preserva determinismo e riproducibilità;
- non creare astrazioni premature per funzionalità deferred;
- non implementare funzionalità fuori scope solo perché il modello potrebbe supportarle in futuro.

## Definition of Done

Ogni change set deve passare:

- formatting;
- lint;
- TypeScript strict type-check;
- unit test;
- test delle invarianti;
- integration test rilevanti;
- validazione OpenAPI;
- validazione delle migration;
- architectural boundary check;
- static security analysis;
- secret scanning.

Le modifiche ad authentication, authorization, tenant isolation, Tournament Engine, Random Draft, Standings, audit, concurrency, migration distruttive, infrastructure secrets o data deletion richiedono review umana.

## Report finale obbligatorio

Al termine di ogni attività restituisci:

1. riepilogo delle modifiche;
2. file creati o modificati;
3. decisioni implementative;
4. invarianti protette;
5. test aggiunti ed esito;
6. migration introdotte;
7. modifiche OpenAPI;
8. eventi e audit prodotti;
9. rischi o limitazioni residue;
10. deviazioni dalla specification;
11. ADR richiesti;
12. istruzioni per verifica manuale.

Non dichiarare completata una funzionalità se i suoi test o gate obbligatori non passano.
