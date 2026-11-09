import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_PREFIX, createApp } from '../app.js';

const bundlePath = createRequire(__filename).resolve('@cc/api-contract/openapi.bundle.yaml');
const contract = parse(readFileSync(bundlePath, 'utf8')) as {
  components: { schemas: Record<string, unknown> };
};

describe('API smoke: GET /v1/health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with a body that satisfies the OpenAPI Health schema', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get(`/${API_PREFIX}/health`)
      .expect(200);
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(contract.components.schemas.Health as object);
    expect(validate(res.body)).toBe(true);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not serve health outside the versioned prefix', async () => {
    await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(404);
  });
});
