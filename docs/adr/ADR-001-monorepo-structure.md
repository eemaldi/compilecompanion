# ADR-001: Struttura del monorepo e wiring dei framework

- **Stato:** Proposed
- **Data:** 2026-11-09
- **Approvatore:** —
- **Requisiti spec:** §1, §19 AP-01/AP-06; ARCH-STACK-001, ARCH-DOM-001/002
- **Change set impattati:** CS-00

## Contesto
La spec impone modular monolith, TypeScript end-to-end, pnpm + Turborepo, Next.js, NestJS e un domain layer indipendente da framework, ORM, Clerk e cloud. Serve una struttura che renda questi vincoli verificabili meccanicamente.

## Decisione
```
apps/
  api/        NestJS: controller, guard, DI, mapping HTTP ↔ application service
  worker/     processo Node per il relay dell'outbox (ADR-006)
  web/        Next.js (web + PWA), consuma solo il client OpenAPI generato
packages/
  shared-kernel/   tipi base: ID tipizzati, Result/Either, errori di dominio, VO comuni. Zero dipendenze runtime.
  platform/        porte e implementazioni tecniche: UnitOfWork, OutboxWriter, IdempotencyStore, Clock, RandomSource, logging
  api-contract/    openapi.yaml + client/tipi generati (ADR-013)
  modules/<nome>/  identity, organization, catalog, event, participation, assignment, results, standings, tournament, audit
  orchestration/   use case cross-module (ADR-002)
  testing/         fixture, builder, Testcontainers helper, oracolo di pairing
tooling/           config condivise eslint, tsconfig, dependency-cruiser
```
Ogni `packages/modules/<nome>` ha `src/{domain,application,contract,infrastructure}` ed esporta da `index.ts` solo `contract` (e una factory di wiring per `apps/api`).

- **NestJS solo in `apps/api`.** I package dei moduli non importano `@nestjs/*`. `apps/api` contiene un Nest module per bounded context che istanzia i servizi tramite le factory.
- **Prisma solo in `infrastructure`** dei moduli e in `platform`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; project references per package.
- Node LTS e PostgreSQL fissati in `.nvmrc` / `docker-compose.yml`; immagine Docker multi-stage per `api` e `worker`.

## Alternative considerate
- **Nest module dentro ogni package di modulo:** più vicino alle convenzioni Nest, ma porta decorator e DI nel package e rende i confini meno verificabili. Scartata.
- **Un solo package backend con cartelle per modulo:** più semplice, ma i confini dipenderebbero solo da regole sui path. Scartata: i package rendono espliciti contract ed export.

## Conseguenze
- (+) Domain e application testabili senza framework; confini verificabili dal package manager.
- (+) Struttura prevedibile per gli agenti (AP-06).
- (−) Più boilerplate di wiring in `apps/api`.
- (−) Dieci package di modulo da mantenere fin dall'inizio.

## Enforcement e verifica
- dependency-cruiser (ADR-002) vieta `@nestjs/*`, `next`, `@clerk/*` e SDK cloud in `packages/modules/**` e `@prisma/*` fuori da `infrastructure`.
- CI: `turbo run format lint typecheck test` su tutti i package.

## Domande aperte
Nessuna.
