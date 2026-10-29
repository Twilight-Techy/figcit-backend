// The version the engine reports (stored with every decision) is the version published.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

describe('version', () => {
  it('ENGINE_VERSION matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
    ) as {
      version: string;
    };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});
