# Catalog seed v1 (placeholder)

**Stato:** placeholder approvato dal product owner il 2026-11-09 (OD-013). I nomi reali dei Protocol verranno forniti più avanti.
**Uso:** fonte dati per la seed migration del CS-05 (`0007_catalog_seed_v1`). Non è normativo sulla semantica, che resta definita dalla spec §2.3, §3.4, §3.5, §9.1.

## Game

| Code | Nome |
|---|---|
| COMPILE | Compile |

## Product

| Code (identità stabile) | Kind | Nome visualizzato | Protocol |
|---|---|---|---|
| MAIN-1 | MAIN | Main 1 | 12 |
| MAIN-2 | MAIN | Main 2 | 12 |
| MAIN-3 | MAIN | Main 3 | 12 |
| AUX-1 | AUX | Aux 1 | 3 |
| AUX-2 | AUX | Aux 2 | 3 |
| AUX-3 | AUX | Aux 3 | 3 |

Totale: 6 Product, 45 Protocol.

## Protocol

- `Code` è l'identità stabile di catalogo.
- `Nome visualizzato` è provvisorio: oggi coincide con il code e verrà sostituito dai nomi reali senza cambiare il code.
- `Catalog number` è un attributo di catalogo (§3.5), non un limite di dominio. **Assunzione:** progressivo 1-45 nell'ordine della tabella; va corretto quando arriva la numerazione ufficiale.

| Code | Product | Catalog number | Nome visualizzato |
|---|---|---|---|
| MAIN-1-01 | MAIN-1 | 1 | MAIN-1-01 |
| MAIN-1-02 | MAIN-1 | 2 | MAIN-1-02 |
| MAIN-1-03 | MAIN-1 | 3 | MAIN-1-03 |
| MAIN-1-04 | MAIN-1 | 4 | MAIN-1-04 |
| MAIN-1-05 | MAIN-1 | 5 | MAIN-1-05 |
| MAIN-1-06 | MAIN-1 | 6 | MAIN-1-06 |
| MAIN-1-07 | MAIN-1 | 7 | MAIN-1-07 |
| MAIN-1-08 | MAIN-1 | 8 | MAIN-1-08 |
| MAIN-1-09 | MAIN-1 | 9 | MAIN-1-09 |
| MAIN-1-10 | MAIN-1 | 10 | MAIN-1-10 |
| MAIN-1-11 | MAIN-1 | 11 | MAIN-1-11 |
| MAIN-1-12 | MAIN-1 | 12 | MAIN-1-12 |
| MAIN-2-01 | MAIN-2 | 13 | MAIN-2-01 |
| MAIN-2-02 | MAIN-2 | 14 | MAIN-2-02 |
| MAIN-2-03 | MAIN-2 | 15 | MAIN-2-03 |
| MAIN-2-04 | MAIN-2 | 16 | MAIN-2-04 |
| MAIN-2-05 | MAIN-2 | 17 | MAIN-2-05 |
| MAIN-2-06 | MAIN-2 | 18 | MAIN-2-06 |
| MAIN-2-07 | MAIN-2 | 19 | MAIN-2-07 |
| MAIN-2-08 | MAIN-2 | 20 | MAIN-2-08 |
| MAIN-2-09 | MAIN-2 | 21 | MAIN-2-09 |
| MAIN-2-10 | MAIN-2 | 22 | MAIN-2-10 |
| MAIN-2-11 | MAIN-2 | 23 | MAIN-2-11 |
| MAIN-2-12 | MAIN-2 | 24 | MAIN-2-12 |
| MAIN-3-01 | MAIN-3 | 25 | MAIN-3-01 |
| MAIN-3-02 | MAIN-3 | 26 | MAIN-3-02 |
| MAIN-3-03 | MAIN-3 | 27 | MAIN-3-03 |
| MAIN-3-04 | MAIN-3 | 28 | MAIN-3-04 |
| MAIN-3-05 | MAIN-3 | 29 | MAIN-3-05 |
| MAIN-3-06 | MAIN-3 | 30 | MAIN-3-06 |
| MAIN-3-07 | MAIN-3 | 31 | MAIN-3-07 |
| MAIN-3-08 | MAIN-3 | 32 | MAIN-3-08 |
| MAIN-3-09 | MAIN-3 | 33 | MAIN-3-09 |
| MAIN-3-10 | MAIN-3 | 34 | MAIN-3-10 |
| MAIN-3-11 | MAIN-3 | 35 | MAIN-3-11 |
| MAIN-3-12 | MAIN-3 | 36 | MAIN-3-12 |
| AUX-1-01 | AUX-1 | 37 | AUX-1-01 |
| AUX-1-02 | AUX-1 | 38 | AUX-1-02 |
| AUX-1-03 | AUX-1 | 39 | AUX-1-03 |
| AUX-2-01 | AUX-2 | 40 | AUX-2-01 |
| AUX-2-02 | AUX-2 | 41 | AUX-2-02 |
| AUX-2-03 | AUX-2 | 42 | AUX-2-03 |
| AUX-3-01 | AUX-3 | 43 | AUX-3-01 |
| AUX-3-02 | AUX-3 | 44 | AUX-3-02 |
| AUX-3-03 | AUX-3 | 45 | AUX-3-03 |

## Regole per la seed migration

- La chiave primaria interna è un UUID; `code` è UNIQUE e non cambia mai.
- La seed è idempotente: `INSERT … ON CONFLICT (code) DO UPDATE` sul solo nome visualizzato.
- Le modifiche successive al catalogo non toccano gli snapshot del pool degli Event già creati (EVT-POOL-004).
