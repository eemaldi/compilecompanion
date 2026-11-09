// Migration validation gate (spec §18.8, ADR-003): run via with-postgres.mjs so DATABASE_URL is set.
//  1. apply all migrations on the empty database
//  2. re-applying is a no-op
//  3. status is up to date
//  4. no drift between the database and prisma/schema.prisma
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env['DATABASE_URL']) {
  console.error('DATABASE_URL is required (use scripts/with-postgres.mjs)');
  process.exit(2);
}

const prisma = (...argv) => {
  const r = spawnSync('pnpm', ['exec', 'prisma', ...argv], { cwd: root, encoding: 'utf8' });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  return r;
};

const steps = [
  ['apply on empty database', ['migrate', 'deploy'], /applied|have been successfully applied/i],
  ['re-apply is a no-op', ['migrate', 'deploy'], /No pending migrations/i],
  ['status up to date', ['migrate', 'status'], /Database schema is up to date/i],
  [
    'no drift vs schema.prisma',
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    /No difference detected/i,
  ],
];
for (const [name, argv, expect] of steps) {
  const r = prisma(...argv);
  if (r.status !== 0 || !expect.test(`${r.stdout}${r.stderr}`)) {
    console.error(`MIGRATION VALIDATION FAILED: ${name}`);
    process.exit(1);
  }
  console.log(`ok - ${name}`);
}
