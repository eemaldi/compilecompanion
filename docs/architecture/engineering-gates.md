# Engineering gates

Fonte: spec §18, ADR-001, ADR-002, ADR-003, ADR-013. Comando unico: `pnpm gates` (opzionale: `pnpm gates arch sast` per un sottoinsieme).

| #   | Gate                              | Comando sottostante                                                 | Strumento                                                                     |
| --- | --------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| -   | Build (prerequisito)              | `pnpm build`                                                        | Turborepo, tsc, Next.js                                                       |
| 1   | Formatting                        | `pnpm format:check`                                                 | Prettier                                                                      |
| 2   | Lint                              | `pnpm lint` + `pnpm lint:root`                                      | ESLint 9 flat, typescript-eslint strict-type-checked                          |
| 3   | TypeScript strict                 | `pnpm typecheck`                                                    | tsc (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ...) |
| 4   | Unit test                         | `pnpm test`                                                         | Vitest                                                                        |
| 5   | Domain isolation / boundary rules | `@cc/shared-kernel` e `@cc/testing` test                            | Vitest + dependency-cruiser API                                               |
| 6   | Integration + smoke               | `@cc/platform test:integration`, `@cc/web smoke`                    | Vitest, PostgreSQL, `next start`                                              |
| 7   | OpenAPI                           | Spectral su bundle, `openapi:check`, test copertura route↔operation | Spectral, Redocly bundle, openapi-typescript                                  |
| 8   | Migration                         | `@cc/platform db:validate`                                          | Prisma `migrate deploy/status/diff`                                           |
| 9   | Boundary architetturali           | `pnpm arch`                                                         | dependency-cruiser                                                            |
| 10  | Static security analysis          | `pnpm sast`                                                         | ESLint + eslint-plugin-security (+ no-eval)                                   |
| 11  | Secret scanning                   | `pnpm secrets`                                                      | secretlint (preset recommend)                                                 |

## PostgreSQL per i gate 6 e 8

`packages/platform/scripts/with-postgres.mjs` sceglie, in ordine: `DATABASE_URL` già impostata; il servizio Docker Compose (`docker compose up -d --wait postgres`, PostgreSQL 16); un cluster locale effimero se esistono i binari PostgreSQL ≥ 16 (`PG_BIN_DIR` per override). Se nessuno è disponibile il gate **fallisce**.

## Come sono provate le regole di boundary

`packages/testing/src/architecture/boundaries.test.ts` costruisce fixture temporanee e le analizza con la stessa configurazione di `pnpm arch`: ogni import vietato (Prisma/NestJS/Clerk/Next/node:http nel domain, domain→infrastructure, application→infrastructure, Prisma fuori da infrastructure, NestJS fuori da `apps/api`, import profondi tra moduli, violazioni dei livelli ADR-002, web→backend, cicli) deve produrre la regola attesa; un fixture ben stratificato deve restare pulito.

## Riproducibilità OpenAPI

`openapi.yaml` (sorgente, ADR-013) → `openapi.bundle.yaml` e `src/generated/schema.d.ts` (committati). `openapi:check` rigenera due volte in directory temporanee, richiede hash identici e uguali ai file committati (drift = errore).

## Scelte e limiti noti

- Le regole `security/detect-non-literal-fs-filename` e `detect-object-injection` sono disattivate solo per test, script, tooling e file di config (non distribuiti, input fidato); restano attive nel codice applicativo.
- Il dev-password `cc_dev_only` di Docker Compose è esplicitamente consentito in secretlint; nessun altro segreto è ammesso.
- Nessun workflow CI è incluso: il runtime CI è una decisione aperta (spec §21). `pnpm gates` è portabile su qualsiasi runner.
- Testcontainers (ADR-001) non è ancora adottato; l'infrastruttura DB dei test è `with-postgres.mjs`.
