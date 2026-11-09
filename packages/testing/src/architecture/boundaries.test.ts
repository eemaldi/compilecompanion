import { cruise } from 'dependency-cruiser';
import type { ICruiseOptions, IFlattenedRuleSet } from 'dependency-cruiser';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Negative tests: a forbidden import must make the boundary check fail with the expected rule.
// Fixtures are built in a temp dir and cruised with the real production rule set.
const require = createRequire(import.meta.url);
const ruleSet =
  require('../../../../tooling/dependency-cruiser/dependency-cruiser.cjs') as IFlattenedRuleSet & {
    options: ICruiseOptions;
  };

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const STUBS = ['@prisma/client', '@nestjs/common', '@clerk/backend', 'next', 'react', 'pg'];

async function violationsOf(files: Record<string, string>): Promise<string[]> {
  const root = mkdtempSync(join(tmpdir(), 'cc-arch-'));
  roots.push(root);
  const write = (rel: string, content: string) => {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  };
  for (const pkg of STUBS) {
    write(`node_modules/${pkg}/package.json`, JSON.stringify({ name: pkg, main: 'index.js' }));
    write(`node_modules/${pkg}/index.js`, 'module.exports = {};');
  }
  for (const [rel, content] of Object.entries(files)) write(rel, content);
  mkdirSync(join(root, 'apps'), { recursive: true });
  mkdirSync(join(root, 'packages'), { recursive: true });
  // dependency-cruiser reports paths relative to the process cwd, so cruise from inside the fixture.
  const previous = process.cwd();
  process.chdir(root);
  let result: Awaited<ReturnType<typeof cruise>>;
  try {
    result = await cruise(
      ['apps', 'packages'],
      { ruleSet, validate: true, ...ruleSet.options },
      {
        extensions: ['.ts', '.js', '.json'],
      },
    );
  } finally {
    process.chdir(previous);
  }
  const output = result.output as {
    summary: { violations: { rule: { name: string } }[] };
  };
  return [...new Set(output.summary.violations.map((v) => v.rule.name))].sort();
}

const M = (name: string, layer: string, file = 'x.ts') =>
  `packages/modules/${name}/src/${layer}/${file}`;
const INDEX = (name: string) => `packages/modules/${name}/src/index.ts`;

describe('architectural boundary checks fail on forbidden imports', () => {
  it.each([
    [
      'Prisma',
      "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
      'domain-framework-free',
    ],
    [
      'NestJS',
      "import { Injectable } from '@nestjs/common'; export const i = Injectable;",
      'domain-framework-free',
    ],
    ['Clerk', "import * as c from '@clerk/backend'; export const c2 = c;", 'domain-framework-free'],
    ['Next.js', "import n from 'next'; export const n2 = n;", 'domain-framework-free'],
    ['node:http', "import * as h from 'node:http'; export const h2 = h;", 'domain-no-node-io'],
  ])('domain importing %s is rejected', async (_name, source, rule) => {
    expect(await violationsOf({ [M('event', 'domain')]: source })).toContain(rule);
  });

  it('shared-kernel (pure domain base) importing Prisma is rejected', async () => {
    const v = await violationsOf({
      'packages/shared-kernel/src/x.ts':
        "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
    });
    expect(v).toContain('domain-framework-free');
  });

  it('domain importing infrastructure of the same module is rejected', async () => {
    const v = await violationsOf({
      [M('event', 'domain')]:
        "import { repo } from '../infrastructure/repo'; export const r = repo;",
      [M('event', 'infrastructure', 'repo.ts')]: 'export const repo = 1;',
    });
    expect(v).toContain('domain-no-outer-layers');
  });

  it('application importing infrastructure is rejected', async () => {
    const v = await violationsOf({
      [M('event', 'application')]:
        "import { repo } from '../infrastructure/repo'; export const r = repo;",
      [M('event', 'infrastructure', 'repo.ts')]: 'export const repo = 1;',
    });
    expect(v).toContain('application-no-infrastructure');
  });

  it('Prisma outside infrastructure/platform is rejected, inside is accepted', async () => {
    const bad = await violationsOf({
      [M('event', 'application')]:
        "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
    });
    expect(bad).toContain('prisma-only-in-infrastructure');
    const good = await violationsOf({
      [M('event', 'infrastructure')]:
        "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
      'packages/platform/src/db.ts':
        "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
    });
    expect(good).not.toContain('prisma-only-in-infrastructure');
  });

  it('NestJS outside apps/api is rejected, inside apps/api is accepted', async () => {
    const bad = await violationsOf({
      [M('event', 'application')]:
        "import { Injectable } from '@nestjs/common'; export const i = Injectable;",
    });
    expect(bad).toContain('nestjs-only-in-api');
    const good = await violationsOf({
      'apps/api/src/a.ts':
        "import { Injectable } from '@nestjs/common'; export const i = Injectable;",
    });
    expect(good).toEqual([]);
  });

  it('direct import of another module internals is rejected, import via index is accepted', async () => {
    const files = {
      [INDEX('organization')]: 'export const o = 1;',
      [M('organization', 'domain')]: 'export const d = 1;',
    };
    const deep = await violationsOf({
      ...files,
      [M('event', 'application')]:
        "import { d } from '../../../organization/src/domain/x'; export const e = d;",
    });
    expect(deep).toContain('module-internals-private-cross-module');
    const viaIndex = await violationsOf({
      ...files,
      [M('event', 'application')]:
        "import { o } from '../../../organization/src/index'; export const e = o;",
    });
    expect(viaIndex).toEqual([]);
  });

  it('an app importing module internals is rejected', async () => {
    const v = await violationsOf({
      [M('event', 'domain')]: 'export const d = 1;',
      'apps/api/src/a.ts':
        "import { d } from '../../../packages/modules/event/src/domain/x'; export const a = d;",
    });
    expect(v).toContain('module-internals-private-outside');
  });

  it('module level rules (ADR-002): upward and same-level imports are rejected, downward accepted', async () => {
    const base = {
      [INDEX('participation')]: 'export const p = 1;',
      [INDEX('identity')]: 'export const i = 1;',
      [INDEX('catalog')]: 'export const c = 1;',
    };
    const upward = await violationsOf({
      ...base,
      [M('event', 'application')]:
        "import { p } from '../../../participation/src/index'; export const e = p;",
    });
    expect(upward).toContain('layer-event-no-same-or-higher-level');
    const sameLevel = await violationsOf({
      ...base,
      [M('identity', 'application')]:
        "import { c } from '../../../catalog/src/index'; export const e = c;",
    });
    expect(sameLevel).toContain('layer-identity-no-same-or-higher-level');
    const downward = await violationsOf({
      ...base,
      [M('participation', 'application')]:
        "import { i } from '../../../identity/src/index'; export const e = i;",
    });
    expect(downward).toEqual([]);
  });

  it('module importing orchestration is rejected', async () => {
    const v = await violationsOf({
      'packages/orchestration/src/index.ts': 'export const o = 1;',
      [M('event', 'application')]:
        "import { o } from '../../../../orchestration/src/index'; export const e = o;",
    });
    expect(v).toContain('modules-no-orchestration');
  });

  it('web accessing the database or backend code is rejected', async () => {
    const v = await violationsOf({
      'apps/web/app/a.ts':
        "import { PrismaClient } from '@prisma/client'; export const p = PrismaClient;",
      'apps/web/app/b.ts':
        "import { p } from '../../../packages/platform/src/index'; export const b = p;",
      'packages/platform/src/index.ts': 'export const p = 1;',
    });
    expect(v).toContain('web-only-via-openapi');
  });

  it('circular dependencies are rejected', async () => {
    const v = await violationsOf({
      'packages/shared-kernel/src/a.ts': "import { b } from './b'; export const a = b;",
      'packages/shared-kernel/src/b.ts': "import { a } from './a'; export const b = a;",
    });
    expect(v).toContain('no-circular');
  });

  it('a well-layered fixture has no violations', async () => {
    const v = await violationsOf({
      'packages/shared-kernel/src/index.ts': 'export const k = 1;',
      [M('event', 'domain')]:
        "import { k } from '../../../../shared-kernel/src/index'; export const d = k;",
      [M('event', 'application')]: "import { d } from '../domain/x'; export const a = d;",
      [M('event', 'infrastructure')]:
        "import { PrismaClient } from '@prisma/client'; import { a } from '../application/x'; export const i = [PrismaClient, a];",
      [INDEX('event')]: "export { a } from './application/x';",
    });
    expect(v).toEqual([]);
  });
});
