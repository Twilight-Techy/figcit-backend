import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '../config/env.js';

/** The file `pnpm openapi:generate` writes (never hand-edited). */
const SPEC_PATH = resolve(import.meta.dirname, '../../../../../openapi/openapi.json');

/** Docs are on outside production unless DOCS_ENABLED says otherwise. */
export const docsEnabled = (env: Env): boolean => env.DOCS_ENABLED ?? env.NODE_ENV !== 'production';

/**
 * Serves the generated OpenAPI file as interactive docs: Swagger UI at /docs and the raw spec at
 * /docs/json and /docs/yaml. The page is self-hosted (no CDN) and carries its own CSP; the rest of
 * the API keeps the strict helmet policy. If the spec file is missing, the API still starts.
 */
export async function registerDocs(app: NestFastifyApplication, env: Env): Promise<void> {
  try {
    await access(SPEC_PATH);
  } catch {
    app
      .getHttpAdapter()
      .getInstance()
      .log.warn('docs: openapi/openapi.json not found; /docs is off');
    return;
  }

  await app.register(swagger, {
    mode: 'static',
    specification: { path: SPEC_PATH, baseDir: dirname(SPEC_PATH) },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
    transformSpecification: (spec) => ({ ...spec, servers: [{ url: env.API_URL }] }),
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      persistAuthorization: true,
      tryItOutEnabled: false,
    },
  });
}
