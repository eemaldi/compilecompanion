import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';

/** Single place where the HTTP surface is configured, shared by main and tests. API versioning per ADR-013: /v1. */
export const API_PREFIX = 'v1';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
