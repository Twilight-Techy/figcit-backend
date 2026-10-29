// Writes openapi/openapi.json from the controllers' @Route metadata and zod schemas (DECISIONS B-18).
// The PWA generates its typed client from that file. Run: pnpm openapi:generate
import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod, type Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { z } from 'zod';
import { createApp } from './app.factory.js';
import { loadDotEnv } from './common/config/dotenv.js';
import { loadEnv } from './common/config/env.js';
import { ROUTE_DOC, type RouteDoc } from './common/http/route.js';
import { exampleFor } from './common/openapi/example.js';

const OUT = resolve(import.meta.dirname, '../../../openapi/openapi.json');
const METHODS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

type Json = Record<string, unknown>;

const schemaOf = (s: z.ZodType, io: 'input' | 'output'): Json => {
  const { $schema: _s, ...rest } = z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Json;
  return rest;
};

function join(...parts: (string | string[] | undefined)[]): string {
  const flat = parts.map((x) => (Array.isArray(x) ? (x[0] ?? '') : (x ?? '')));
  const p = `/${flat
    .map((x) => x.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/')}`;
  return p.replace(/:([A-Za-z]+)/g, '{$1}');
}

// Every example is parsed by its own zod schema; the generator fails on any that doesn't fit.
const problems: string[] = [];

function checkedExample(
  schema: z.ZodType,
  io: 'input' | 'output',
  given: unknown,
  where: string,
): unknown {
  const example = given ?? exampleFor(schemaOf(schema, io));
  const result = schema.safeParse(example);
  if (!result.success) {
    const issue = result.error.issues[0];
    problems.push(`${where}: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
  }
  return example;
}

function queryParams(schema: z.ZodType | undefined, given: unknown, where: string): Json[] {
  if (!schema) return [];
  const js = schemaOf(schema, 'input') as {
    properties?: Record<string, Json>;
    required?: string[];
  };
  const example = checkedExample(schema, 'input', given, `${where} query`) as Json;
  return Object.entries(js.properties ?? {}).map(([name, s]) => ({
    name,
    in: 'query',
    required: js.required?.includes(name) ?? false,
    schema: s,
    ...(example[name] === undefined ? {} : { example: example[name] }),
  }));
}

function requestBody(schema: z.ZodType, given: unknown, where: string): Json {
  return {
    required: true,
    content: {
      'application/json': {
        schema: schemaOf(schema, 'input'),
        example: checkedExample(schema, 'input', given, `${where} body`),
      },
    },
  };
}

function okResponse(schema: z.ZodType, given: unknown, where: string): Json {
  return {
    description: 'OK',
    content: {
      'application/json': {
        schema: schemaOf(schema, 'output'),
        example: checkedExample(schema, 'output', given, `${where} response`),
      },
    },
  };
}

function operation(doc: RouteDoc, path: string, where: string): Json {
  const params = [...path.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
  const status = String(doc.status ?? 200);
  const access = doc.access ?? 'user';
  const ex = doc.example ?? {};
  return {
    summary: doc.summary,
    tags: doc.tags ?? [],
    ...(params.length || doc.query
      ? { parameters: [...params, ...queryParams(doc.query, ex.query, where)] }
      : {}),
    ...(doc.body ? { requestBody: requestBody(doc.body, ex.body, where) } : {}),
    responses: {
      [status]:
        status === '204' || !doc.response
          ? { description: 'Done' }
          : okResponse(doc.response, ex.response, where),
      default: {
        description: 'Problem details (RFC 9457)',
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
        },
      },
    },
    security:
      access === 'public'
        ? []
        : access === 'browse'
          ? [{ bearer: [] }, { browse: [] }]
          : [{ bearer: [] }],
    'x-access': access,
    ...(doc.roles?.length ? { 'x-roles': doc.roles } : {}),
    ...(doc.contractOnly ? { 'x-contract-only': true } : {}),
  };
}

async function main(): Promise<void> {
  loadDotEnv();
  const app = await createApp(loadEnv(), { logger: false });
  const paths: Record<string, Record<string, Json>> = {};
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const type = wrapper.metatype as Type | null;
      if (!type) continue;
      const base = Reflect.getMetadata(PATH_METADATA, type) as string | string[] | undefined;
      for (const key of Object.getOwnPropertyNames(type.prototype)) {
        const handler = (type.prototype as Record<string, unknown>)[key];
        if (typeof handler !== 'function') continue;
        const doc = Reflect.getMetadata(ROUTE_DOC, handler) as RouteDoc | undefined;
        const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        if (!doc || !method) continue;
        const path = join(
          'v1',
          base,
          Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined,
        );
        paths[path] = {
          ...paths[path],
          [method]: {
            operationId: `${type.name.replace(/Controller$/, '')}_${key}`,
            ...operation(doc, path, `${method.toUpperCase()} ${path}`),
          },
        };
      }
    }
  }
  if (problems.length) {
    await app.close();
    throw new Error(`Examples that don't match their schema:\n  ${problems.join('\n  ')}`);
  }
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'NUCCESS API',
      version: '1.0.0',
      description: 'Figcit Ltd. Generated from the code; do not edit by hand.',
    },
    servers: [{ url: 'http://localhost:3001' }],
    paths: sorted,
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        browse: { type: 'apiKey', in: 'header', name: 'X-Browse-Token' },
      },
      schemas: {
        Problem: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'integer' },
            code: { type: 'string' },
            detail: { type: 'string' },
            instance: { type: 'string' },
          },
          required: ['type', 'title', 'status', 'code'],
        },
      },
    },
  };
  await writeFile(OUT, `${JSON.stringify(spec, null, 2)}\n`);
  process.stdout.write(`openapi: ${String(Object.keys(sorted).length)} paths → ${OUT}\n`);
  await app.close();
}

await main();
