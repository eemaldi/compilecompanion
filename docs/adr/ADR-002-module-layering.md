# ADR-002: Layering dei moduli e orchestration layer

- **Stato:** Accepted
- **Data:** 2026-11-09
- **Approvatore:** Enrico Emaldi (product owner), 2026-11-09
- **Requisiti spec:** §11, §17.2; ARCH-OWN-001/002, NOTIF-001
- **Change set impattati:** CS-00 e tutti i successivi

## Contesto
I moduli devono collaborare solo tramite application service, eventi o contract approvati, senza dipendenze circolari. Nell'analisi preliminare sono emersi cicli naturali: Event↔Participation, Event↔Assignment, Event↔Tournament, Tournament↔Results, Assignment↔Tournament.

## Decisione
1. **Livelli.** Un modulo a livello *k* può importare solo il `contract` di moduli a livello *< k*. Le dipendenze tra moduli dello stesso livello sono vietate.

   | Livello | Componenti |
   |---|---|
   | L0 | shared-kernel, platform |
   | L1 | identity, catalog, audit |
   | L2 | organization |
   | L3 | event |
   | L4 | participation |
   | L5 | assignment |
   | L6 | results |
   | L7 | standings |
   | L8 | tournament |
   | L9 | orchestration |
   | L10 | apps/api, apps/worker |
   | L11 | apps/web (solo via OpenAPI) |

2. **Orchestration layer** (`packages/orchestration`): contiene soltanto use case che coordinano più moduli in una transazione (`MarkReadyToStart`, `StartTournament`, `CompleteTournament`, `TerminateTournament`) e read facade composte (es. pairing corrente + Protocol dell'avversario). Non possiede tabelle e non contiene invarianti: si limita a leggere fatti e invocare servizi pubblici, che validano le proprie invarianti.
3. **Servizi che ricevono fatti.** Le transizioni Event che dipendono da altri moduli (`markReadyToStart`, `startTournament`, `completeTournament`) ricevono i fatti (`activeParticipantCount`, `assignmentsComplete`, `allPlannedRoundsFinalized`) dall'orchestration, che li legge sotto lock nella stessa transazione (ADR-004).
4. **Tournament → Results.** Results riceve in `openMatches` una copia immutabile di round e partecipanti (reference data, non ownership), quindi non dipende da Tournament.
5. **Standings → Results** soltanto. Tournament usa Standings tramite la porta `SeedingPolicy`.
6. **Audit (L1)** non importa Organization: l'authorization della read API di audit è verificata in `apps/api`/use case prima di chiamare `AuditQueries`.
7. **Notifications** (futuro) sarà soltanto un subscriber dell'outbox: nessun modulo lo importa.
8. Qualsiasi freccia che risale i livelli richiede un nuovo ADR.

## Alternative considerate
- **Eventi asincroni al posto delle chiamate verso livelli superiori:** introdurrebbe consistenza eventuale su start e finalizzazione, in contrasto con AP-03. Scartata.
- **Interfacce invertite** (Event definisce una porta implementata da Participation): elimina il ciclo a livello di import ma mantiene la dipendenza logica circolare. Scartata in favore dell'orchestration esplicita.

## Conseguenze
- (+) Grafo aciclico verificabile; responsabilità di coordinamento visibili in un solo posto.
- (−) Le transizioni dell'Event sono "sicure" solo se invocate dall'orchestration. Mitigazione: i metodi `*(facts)` non sono esposti come endpoint diretti, e i fatti sono rivalidati sotto lock.

## Enforcement e verifica
- dependency-cruiser: regole `no-circular`, livelli (tag per package) e `only-via-index` (import solo da `@cc/<modulo>`).
- Test di architettura in CI che fallisce su violazioni; un test "negativo" in CS-00 dimostra che la regola scatta.

## Domande aperte
Nessuna.
