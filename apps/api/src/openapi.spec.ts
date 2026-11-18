import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Operation {
  'x-requires-account'?: boolean;
  responses: Record<string, { description?: string }>;
}
const spec = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../openapi/openapi.json'), 'utf8'),
) as { paths: Record<string, Record<string, Operation>> };

describe('what needs an account, in the OpenAPI file', () => {
  const GUARDED: readonly [string, string][] = [
    ['post', '/v1/billing/checkout'],
    ['post', '/v1/billing/cancel'],
    ['post', '/v1/institutions/join'],
    ['post', '/v1/shares'],
    ['post', '/v1/auth/password'],
    ['post', '/v1/drafts/{id}/assist'],
    ['post', '/v1/ai/parse-need'],
    ['post', '/v1/speech/transcriptions'],
    ['post', '/v1/files/uploads'],
    ['post', '/v1/tasks/{id}/break-down'],
  ];

  it.each(GUARDED)('%s %s says so, and documents the 403 account_required', (method, path) => {
    const op = spec.paths[path]?.[method];
    expect(op?.['x-requires-account']).toBe(true);
    expect(op?.responses['403']?.description).toContain('account_required');
  });

  it('a route a guest can use does not', () => {
    expect(spec.paths['/v1/tasks']?.['post']?.['x-requires-account']).toBeUndefined();
    expect(spec.paths['/v1/plans']?.['get']?.['x-requires-account']).toBeUndefined();
  });
});
