// Single entry point for every engineering gate (spec §18). Runs all gates, reports real exit status,
// and exits non-zero if any gate failed. Nothing is skipped silently.
//   pnpm gates            run everything
//   pnpm gates <id...>    run only the named gates (e.g. `pnpm gates format arch`)
import { spawnSync } from 'node:child_process';

const GATES = [
  { id: 'build', name: 'Build (prerequisite for typed gates)', cmd: 'pnpm build' },
  { id: 'format', name: '1. Formatting', cmd: 'pnpm format:check' },
  { id: 'lint', name: '2. Lint', cmd: 'pnpm lint && pnpm lint:root' },
  { id: 'typecheck', name: '3. TypeScript strict type-check', cmd: 'pnpm typecheck' },
  {
    id: 'unit',
    name: '4. Unit tests (all packages, incl. API and web smoke-in-process)',
    cmd: 'pnpm test',
  },
  {
    id: 'domain',
    name: '5. Domain isolation and boundary-rule tests',
    cmd: 'pnpm --filter @cc/shared-kernel --filter @cc/testing test',
  },
  {
    id: 'integration',
    name: '6. Integration tests (PostgreSQL) + web server smoke',
    cmd: 'pnpm --filter @cc/platform test:integration && pnpm --filter @cc/web smoke',
  },
  {
    id: 'openapi',
    name: '7. OpenAPI validation (lint, reproducible generation, route coverage)',
    cmd: 'pnpm --filter @cc/api-contract lint && pnpm --filter @cc/api-contract openapi:check && pnpm --filter @cc/api test',
  },
  {
    id: 'migrations',
    name: '8. Database migration validation',
    cmd: 'pnpm --filter @cc/platform db:validate',
  },
  { id: 'arch', name: '9. Architectural boundary check', cmd: 'pnpm arch' },
  { id: 'sast', name: '10. Static security analysis', cmd: 'pnpm sast' },
  { id: 'secrets', name: '11. Secret scanning', cmd: 'pnpm secrets' },
];

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !GATES.some((g) => g.id === w));
if (unknown.length > 0) {
  console.error(
    `Unknown gate(s): ${unknown.join(', ')}. Available: ${GATES.map((g) => g.id).join(', ')}`,
  );
  process.exit(2);
}
const selected = wanted.length > 0 ? GATES.filter((g) => wanted.includes(g.id)) : GATES;

const env = {
  ...process.env,
  TURBO_FORCE: 'true',
  NEXT_TELEMETRY_DISABLED: '1',
  CI: process.env.CI ?? '1',
};
const results = [];
for (const gate of selected) {
  console.log(`\n=== ${gate.name} ===\n$ ${gate.cmd}\n`);
  const started = Date.now();
  const r = spawnSync(gate.cmd, { shell: true, stdio: 'inherit', env });
  results.push({ gate, code: r.status ?? 1, seconds: ((Date.now() - started) / 1000).toFixed(1) });
  // The build gate is a prerequisite: if it fails, later typed gates are meaningless but still reported.
}

console.log('\n=== ENGINEERING GATES SUMMARY ===');
for (const { gate, code, seconds } of results) {
  console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${gate.name}  (${seconds}s)`);
}
const failed = results.filter((r) => r.code !== 0);
console.log(failed.length === 0 ? '\nALL GATES PASSED' : `\n${failed.length} GATE(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
