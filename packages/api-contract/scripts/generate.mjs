// Deterministic generation of the bundled contract and TS types from openapi.yaml (ADR-013).
// `--check` regenerates twice into temp dirs and fails on non-reproducibility or drift vs committed files.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name) => resolve(root, '../../node_modules/.bin', name);

function generate(outDir) {
  const bundle = join(outDir, 'openapi.bundle.yaml');
  const types = join(outDir, 'schema.d.ts');
  execFileSync(bin('redocly'), ['bundle', join(root, 'openapi.yaml'), '--output', bundle], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  execFileSync(bin('openapi-typescript'), [bundle, '--output', types], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // openapi-typescript embeds nothing environment-specific; normalise newlines defensively.
  for (const f of [bundle, types]) writeFileSync(f, readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  return { bundle, types };
}

const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const committed = {
  bundle: join(root, 'openapi.bundle.yaml'),
  types: join(root, 'src/generated/schema.d.ts'),
};

if (process.argv.includes('--check')) {
  const a = mkdtempSync(join(tmpdir(), 'cc-oas-a-'));
  const b = mkdtempSync(join(tmpdir(), 'cc-oas-b-'));
  try {
    const first = generate(a);
    const second = generate(b);
    let failed = false;
    for (const k of ['bundle', 'types']) {
      if (sha(first[k]) !== sha(second[k])) {
        console.error(`NOT REPRODUCIBLE: ${k} differs between two generations`);
        failed = true;
      }
      if (!existsSync(committed[k]) || sha(first[k]) !== sha(committed[k])) {
        console.error(
          `DRIFT: committed ${k} is stale; run "pnpm --filter @cc/api-contract generate"`,
        );
        failed = true;
      }
    }
    if (failed) process.exit(1);
    console.log(
      `OpenAPI generation reproducible and up to date (bundle sha256 ${sha(first.bundle).slice(0, 12)})`,
    );
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
} else {
  const out = mkdtempSync(join(tmpdir(), 'cc-oas-'));
  try {
    const g = generate(out);
    cpSync(g.bundle, committed.bundle);
    cpSync(g.types, committed.types);
    console.log('Generated openapi.bundle.yaml and src/generated/schema.d.ts');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}
