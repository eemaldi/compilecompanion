import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIN_POSTGRES_VERSION_NUM } from './database.js';

// Requires DATABASE_URL with migrations applied (pnpm --filter @cc/platform test:integration).
describe('PostgreSQL startup and empty initial migration', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  it('runs a supported PostgreSQL version', async () => {
    const r = await client.query<{ v: number }>(
      `select current_setting('server_version_num')::int as v`,
    );
    expect(r.rows[0]?.v).toBeGreaterThanOrEqual(MIN_POSTGRES_VERSION_NUM);
  });

  it('has applied exactly the empty baseline migration', async () => {
    const r = await client.query<{ migration_name: string; finished_at: Date | null }>(
      'select migration_name, finished_at from _prisma_migrations order by migration_name',
    );
    expect(r.rows.map((x) => x.migration_name)).toEqual(['0000_baseline']);
    expect(r.rows[0]?.finished_at).not.toBeNull();
  });

  it('creates no application tables or schemas yet', async () => {
    const tables = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name <> '_prisma_migrations'`,
    );
    expect(tables.rows).toEqual([]);
  });
});
