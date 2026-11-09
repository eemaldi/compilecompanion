# ADR-010: Modello di authorization e tenant isolation

- **Stato:** Proposed
- **Data:** 2026-11-09
- **Approvatore:** —
- **Requisiti spec:** §2.1, §2.2, §3.3, §6, §16; AUTH-*, ORG-*, IDN-USER-002, OD-012, OD-018
- **Change set impattati:** CS-03, CS-04 e tutti gli endpoint

## Contesto
Clerk è limitato all'authentication e l'authorization è interna. Il ruolo in una Organization non concede nulla in un'altra, e l'enumerazione degli identificatori non deve aggirare i controlli.

## Decisione
1. **Authentication:**
   - `apps/api` verifica il JWT Clerk tramite l'adapter `ClerkTokenVerifier`, che implementa la porta `ExternalIdentityVerifier`;
   - Identity risolve o crea (just-in-time) lo `User` interno da `externalIdentityId`;
   - dei claim Clerk si usa solo il `sub`: ruoli e organization di Clerk sono ignorati.
2. **`ActorContext { userId, correlationId }`** viene passato esplicitamente a ogni application service. Le membership non sono nel context: si leggono quando servono, così una modifica di ruolo ha effetto subito.
3. **Permessi astratti**, definiti in Organization:
   - `EVENT_CREATE`, `EVENT_MANAGE`, `PARTICIPANT_MANAGE`, `ASSIGNMENT_MANAGE`, `TOURNAMENT_RUN`, `DISPUTE_RESOLVE`, `AUDIT_READ`, `MEMBERSHIP_MANAGE`.

   Mapping v1:
   - OWNER = tutti;
   - TO = tutti tranne `MEMBERSHIP_MANAGE`;
   - MEMBER = nessuno.

   I ruoli sono una tabella di mapping, estendibile senza modifiche strutturali (ORG-MEM-002). Mapping confermato dal product owner il 2026-11-09 (OD-018).
4. **Azioni da player:** sono autorizzate in base alla *relazione* con la risorsa, non alla membership. Esempi: "è il Participant di questo match", "è lo User di questo Participant". Un player non deve essere membro dell'Organization (OD-018, confermato).
5. **Dove si controlla:** nell'application service, sempre. I guard Nest fanno solo l'authentication. Ogni use case dichiara il permesso richiesto e chiama `AuthorizationService.assertPermission(actor, organizationId, permission)`.
6. **Tenant scoping dei repository:** i metodi di lettura e scrittura di dati tenant-scoped richiedono un `OrgScope` (ricavato dalla risorsa e verificato) e aggiungono sempre `WHERE organization_id = $scope`. Per accedere per id si risolve prima la risorsa con lo scope.
7. **NOT_FOUND vs FORBIDDEN:**
   - risorsa inesistente, oppure di un tenant in cui l'attore non ha alcuna relazione ⇒ `NOT_FOUND`;
   - risorsa visibile ma azione non permessa ⇒ `FORBIDDEN`.

   In questo modo un ID valido di un altro tenant non è distinguibile da un ID inesistente (AUTH-TENANT-003).
8. **Eventi pubblici (OD-016):** le letture anonime passano da query dedicate che espongono solo campi pubblici. Non c'è uno scope bypass generico.
9. **Organization personale (OD-012):** proposta di creazione esplicita, una sola volta, alla prima azione "diventa organizzatore", con l'utente come OWNER. Confermato il 2026-11-09.
10. **Platform Administrator:** non implementato nella v1. Nessun bypass di tenant nel codice.
11. **Row-Level Security PostgreSQL:** non adottata nel MVP. Lo scoping a livello di repository più i test a matrice sono ritenuti sufficienti; RLS è candidata come difesa in profondità in un ADR futuro.

## Alternative considerate
- **Clerk Organizations come fonte dei ruoli:** viola §1 (Clerk solo authentication). Scartata.
- **Authorization solo nei guard:** facile da dimenticare su nuovi use case e non vale per chiamate interne. Scartata.
- **RLS subito:** robusta, ma complica `SET LOCAL ROLE` (ADR-003) e Prisma. Rinviata.

## Conseguenze
- (+) Isolamento verificabile; nessuna dipendenza da Clerk per i permessi.
- (−) Una query in più sulle membership per richiesta (indicizzata `(user_id, organization_id)`).

## Enforcement e verifica
- Test a matrice generato dalle route OpenAPI: per ogni endpoint, attore di un altro tenant ⇒ 404; attore senza permesso ⇒ 403.
- Lint: vietato importare `@clerk/*` fuori dall'adapter.
- Test: claim di ruolo Clerk falsificati non hanno effetto.

## Domande aperte
Nessuna. OD-012 e OD-018 sono stati confermati il 2026-11-09.
