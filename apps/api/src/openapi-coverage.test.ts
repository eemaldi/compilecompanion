import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

// ADR-013 contract test: every Nest route has an OpenAPI operation and vice versa.
const bundlePath = createRequire(__filename).resolve('@cc/api-contract/openapi.bundle.yaml');
const contract = parse(readFileSync(bundlePath, 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'];

function nestRoutes(): string[] {
  const controllers = Reflect.getMetadata(
    MODULE_METADATA.CONTROLLERS,
    AppModule,
  ) as (new () => object)[];
  const routes: string[] = [];
  for (const controller of controllers) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[name] as object;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const path = `/${[base, sub].filter((p) => p !== '/').join('/')}`.replace(/\/+/g, '/');
      routes.push(`${RequestMethod[method].toLowerCase()} ${path.replace(/:(\w+)/g, '{$1}')}`);
    }
  }
  return routes.sort();
}

function contractOperations(): string[] {
  return Object.entries(contract.paths)
    .flatMap(([path, item]) =>
      Object.keys(item)
        .filter((k) => HTTP_METHODS.includes(k))
        .map((m) => `${m} ${path}`),
    )
    .sort();
}

describe('OpenAPI contract coverage', () => {
  it('maps Nest routes and contract operations one-to-one', () => {
    expect(nestRoutes()).toEqual(contractOperations());
  });
});
