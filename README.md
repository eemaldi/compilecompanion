# Compile Companion

Companion application per Compile focalizzata sulla gestione di tornei. Specification normativa: `docs/specifications/compile-companion-v1.md`. Regole per gli agenti: `AGENTS.md`, `CLAUDE.md`.

## Requisiti

Node ≥ 22 (`.nvmrc`), pnpm 10, PostgreSQL ≥ 16 (via Docker Compose oppure `DATABASE_URL`).

## Avvio locale

```bash
pnpm install
cp .env.example .env
pnpm db:up                 # PostgreSQL 16 (Docker)
pnpm --filter @cc/platform exec prisma migrate deploy
pnpm build
pnpm --filter @cc/api start          # http://localhost:3001/v1/health
pnpm --filter @cc/web dev            # http://localhost:3000
```

## Verifica

`pnpm gates` esegue tutti gli engineering gate (vedi `docs/architecture/engineering-gates.md`).

## ADR

Template: `docs/adr/ADR-000-template.md`; indice: `docs/adr/README.md`.
