# ADR-013: OpenAPI contract-first

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §1, §10; ARCH-STACK-004, *-API-*
- **Change set impattati:** CS-00 e tutti gli endpoint

## Contesto
REST e OpenAPI sono il confine frontend/backend. Nella precedenza normativa i contratti API vengono subito dopo spec e ADR: devono quindi essere artefatti revisionabili, non un sottoprodotto del codice.

## Decisione
1. **Contract-first:** il file sorgente è `packages/api-contract/openapi.yaml` (OpenAPI 3.1), diviso per modulo in `paths/<modulo>/*.yaml` e `components/`, e unito in un bundle in CI.
2. **Generazione dal contract:**
   - tipi TypeScript con `openapi-typescript`;
   - client per `apps/web` con `openapi-fetch`;
   - validazione delle richieste in `apps/api` (schema → validatore, es. Ajv) prima dei controller.
3. **Contract test:** le risposte dell'API in integrazione vengono validate contro lo schema; un test verifica che ogni route Nest abbia un'operazione OpenAPI e viceversa.
4. **Convenzioni:**
   - risorse al plurale;
   - comandi di stato come azioni `POST /resources/{id}:verb` (es. `:start`, `:finalize`);
   - header `Idempotency-Key` (ADR-007) e `If-Match`/`ETag` (ADR-008) dichiarati;
   - errori con lo schema `Problem` (ADR-009);
   - versionamento con prefisso `/v1`.
5. **Lint** con Spectral (ruleset in `tooling/`), più un controllo di breaking change su ogni PR (es. `oasdiff`). Un breaking change richiede una review umana.
6. Ogni CS che aggiunge endpoint modifica prima il contract nello stesso CS; il diff del contract fa parte della review.

## Alternative considerate
- **Code-first da decorator NestJS (`@nestjs/swagger`):** meno duplicazione, ma il contract segue il codice, invertendo la precedenza normativa, e porta decorator nei DTO. Scartata.

## Conseguenze
- (+) Contract revisionabile e stabile; frontend e backend allineati per costruzione.
- (−) Una parte dei DTO viene scritta due volte (schema e tipo applicativo), mitigata dai tipi generati.

## Enforcement e verifica
- Gate CI "OpenAPI contract validation": Spectral, controllo di breaking change, copertura route ↔ operation, validazione delle risposte nei test di integrazione.

## Domande aperte
Nessuna.
