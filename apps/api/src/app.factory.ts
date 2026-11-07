import 'reflect-metadata';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { loadEnv, type Env } from './common/config/env.js';
import { ProblemFilter } from './common/errors/problem.filter.js';
import { docsEnabled, registerDocs } from './common/http/docs.js';

const DEFAULT_BODY_LIMIT = 64 * 1024; // rules §6
const UPLOAD_LIMIT = 25 * 1024 * 1024;
const WORKBOOK_LIMIT = 8 * 1024 * 1024; // local storage driver only (audio uploads in development)

/** Builds the HTTP app. Used by main.ts, the e2e tests and the OpenAPI generator. */
export async function createApp(
  env: Env = loadEnv(),
  options: { logger?: boolean; module?: Type } = {},
): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: DEFAULT_BODY_LIMIT,
    trustProxy: true,
    logger:
      options.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            // Request bodies are never logged; tokens and cookies are redacted (SYSTEM_DESIGN §9.5).
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-browse-token"]',
              'res.headers["set-cookie"]',
            ],
          },
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    options.module ?? AppModule,
    adapter,
    {
      logger: options.logger === false ? false : ['error', 'warn', 'log'],
    },
  );
  const fastify = app.getHttpAdapter().getInstance();

  // The workbook uploads are the JSON bodies allowed to be large (staff only).
  const workbookRoutes = new Set(['/v1/admin/snapshots', '/v1/rulesets/import']);
  fastify.addHook('onRoute', (route) => {
    if (workbookRoutes.has(route.url) && route.method === 'POST') route.bodyLimit = WORKBOOK_LIMIT;
  });

  // Raw bodies for local-storage uploads (any content type), with their own size limit.
  fastify.addContentTypeParser(
    /^(audio|video|image|application\/octet-stream|application\/zip)/,
    { parseAs: 'buffer', bodyLimit: UPLOAD_LIMIT },
    (_req, body, done) => {
      done(null, body);
    },
  );

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'idempotency-key',
      'x-browse-token',
      'x-client',
    ],
    maxAge: 600,
  });
  await app.register(cookie);
  if (env.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      allowList: ['127.0.0.1'],
    });
  }

  if (docsEnabled(env)) await registerDocs(app, env);

  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  return app;
}
