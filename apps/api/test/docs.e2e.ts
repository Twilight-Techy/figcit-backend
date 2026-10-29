import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

let api: Api;
beforeAll(async () => {
  api = await bootApi();
});
afterAll(() => api.close());

describe('API docs', () => {
  it('serves Swagger UI with its own CSP, self-hosted', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/docs/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.body).not.toMatch(/https?:\/\/(cdn|unpkg)/);
  });

  it('serves the generated spec', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json<{
      openapi: string;
      paths: Record<string, unknown>;
      servers: unknown[];
    }>();
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(10);
    expect(spec.servers).toHaveLength(1);
  });

  it('keeps the strict policy on API routes', async () => {
    const res = await api.app.inject({ method: 'GET', url: '/v1/plans' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });
});
