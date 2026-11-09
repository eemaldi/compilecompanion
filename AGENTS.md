# AGENTS.md: istruzioni normative per gli agenti

Compile Companion è una companion application per Compile, focalizzata sulla gestione di tornei.
Questo file è normativo per ogni agente (e per ogni persona) che modifica il repository. Integra `CLAUDE.md`; in caso di discrepanza prevale la specification.

## 1. Fonti e precedenza

Prima di analizzare, progettare o modificare codice:

1. leggi integralmente `docs/specifications/compile-companion-v1.md` (fonte normativa primaria);
2. leggi gli ADR `Accepted` applicabili (`docs/adr/`; un ADR `Proposed` non autorizza nulla);
3. verifica il contratto OpenAPI (`packages/api-contract/openapi.yaml`);
4. esamina il codice esistente senza assumere che sia corretto.

Ordine di precedenza: specification > ADR approvati > contratti OpenAPI > documentazione implementativa > codice esistente.

MUST e MUST NOT sono obblighi; SHOULD richiede motivazione scritta per ogni deviazione; MAY è opzionale. Non declassare mai un MUST/MUST NOT.

## 2. Regole non negoziabili

Non modificare implicitamente le decisioni elencate in `CLAUDE.md` ("Regole non negoziabili"): modular monolith, TypeScript end-to-end, PostgreSQL come source of truth, REST + OpenAPI come confine frontend/backend, Clerk solo per authentication, authorization interna, Organization proprietaria di ogni Event, isolamento multi-tenant, BO1, WIN/LOSS, Record-Based Swiss Pairing, immutabilità dei Round FINALIZED, audit degli override del TO, indipendenza del domain layer dal cloud provider.

Vietato senza ADR approvato: microservizi, GraphQL, NoSQL come source of truth, Redis, WebSocket/SSE, event sourcing, CQRS completo, Kubernetes, logica cloud-specifica nel dominio, accesso al DB dal frontend, scritture cross-module, invarianti protette solo dalla UI, modifiche retroattive a Round FINALIZED, bypass dell'audit.

## 3. Struttura del repository e direzione delle dipendenze

```
apps/api            NestJS (unico posto dove esiste @nestjs/*): controller, guard, DI
apps/web            Next.js (web + PWA): consuma solo il contratto OpenAPI
packages/shared-kernel   tipi base senza dipendenze runtime (Result, ID, errori); eseguibile in isolamento
packages/platform        porte e adapter tecnici; Prisma schema, migration SQL (packages/platform/migrations)
packages/api-contract    openapi.yaml (sorgente), openapi.bundle.yaml e tipi generati
packages/testing         test di architettura e helper condivisi
packages/modules/<m>     (dal CS-04 in poi) src/{domain,application,contract,infrastructure}, export solo da index.ts
packages/orchestration   (futuro) use case cross-module
tooling/                 tsconfig, eslint, dependency-cruiser, secretlint, script dei gate
docs/{specifications,adr,architecture}
```

Livelli (ADR-002): L0 shared-kernel/platform → L1 identity, catalog, audit → L2 organization → L3 event → L4 participation → L5 assignment → L6 results → L7 standings → L8 tournament → L9 orchestration → L10 apps/api → L11 apps/web (solo via OpenAPI). Un modulo importa solo il `contract` (index) di moduli di livello inferiore. Una freccia verso l'alto richiede un nuovo ADR.

Regole imposte meccanicamente da `pnpm arch` (dependency-cruiser):

- il domain layer non importa NestJS, Next.js, Prisma, Clerk, React, SDK cloud, né API Node di I/O/rete;
- il domain non importa application/infrastructure/contract; application non importa infrastructure;
- Prisma solo in `infrastructure` dei moduli e in `packages/platform`; Clerk solo in `infrastructure`; NestJS solo in `apps/api`;
- nessun import diretto tra implementazioni interne dei moduli (solo via `index`); nessun ciclo;
- `apps/web` non importa backend, moduli, platform o Prisma.

Ogni modulo possiede i propri dati; nessun modulo scrive nelle tabelle di un altro (ADR-003). Il codice di dominio non usa `process`, `Date.now()`, `new Date()` senza argomenti, né `Math.random()` (ESLint): usa le porte Clock/RandomSource.

## 4. Metodo operativo

Prima di implementare: elenca requisiti e invarianti applicabili, moduli coinvolti, dati posseduti, transazioni, rischi di concorrenza, eventi e audit, test necessari; suddividi in change set piccoli e revisionabili.
Durante: TypeScript strict senza disabilitazioni globali; errori applicativi machine-readable (spec §15); transazioni e constraint PostgreSQL per le invarianti critiche; mai validazioni solo frontend; determinismo e riproducibilità; nessuna astrazione prematura e nessuna funzionalità fuori scope (§20).
OpenAPI è contract-first (ADR-013): modifica prima `packages/api-contract`, poi rigenera (`pnpm --filter @cc/api-contract generate`).

## 5. Protocollo in caso di conflitto con la specification

1. interrompi la parte confliggente; 2. indica sezione e regola; 3. descrivi il conflitto; 4. elenca invarianti/contratti alterati; 5. proponi aggiornamento della spec o un ADR (`docs/adr/ADR-000-template.md`); 6. separa le parti non confliggenti; 7. attendi approvazione umana. Non adottare soluzioni pragmatiche che cambiano il comportamento in modo implicito.

## 6. Engineering gate (Definition of Done)

Comando unico: **`pnpm gates`** (dettagli in `docs/architecture/engineering-gates.md`). Esegue: build, formatting, lint, type-check strict, unit test, test di isolamento del dominio e delle regole di boundary, integration test PostgreSQL + smoke web, validazione OpenAPI, validazione migration, boundary check, static security analysis, secret scanning. Un change set non è completo se un gate fallisce; non dichiarare completata una funzionalità senza esito reale dei gate. I gate DB non vengono mai saltati in silenzio: senza PostgreSQL falliscono.

Richiedono review umana: authentication, authorization, tenant isolation, Tournament Engine, Random Draft, Standings, audit, concurrency, migration distruttive, infrastructure secrets, data deletion.

## 7. Report finale obbligatorio

Riepilogo modifiche; file creati/modificati; decisioni; invarianti protette; test ed esito; migration; modifiche OpenAPI; eventi e audit; rischi residui; deviazioni dalla specification; ADR richiesti; istruzioni di verifica manuale.
