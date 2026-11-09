import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { err, ok } from './index.js';

// ARCH-DOM-001: this package runs with no framework, ORM, HTTP or I/O available.
describe('shared-kernel is executable in isolation', () => {
  it('builds success and failure results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('X')).toEqual({ ok: false, error: 'X' });
  });

  it('declares no runtime dependencies', async () => {
    const { readFile } = await import('node:fs/promises');
    const pkg = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});
