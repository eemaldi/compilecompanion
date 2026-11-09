import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('bundled contract', () => {
  it('declares OpenAPI 3.1 with the health operation under /v1', () => {
    const text = readFileSync(join(__dirname, '..', 'openapi.bundle.yaml'), 'utf8');
    expect(text).toMatch(/^openapi: 3\.1\.0$/m);
    expect(text).toContain('operationId: getHealth');
    expect(text).toMatch(/- url: \/v1/);
  });
});
