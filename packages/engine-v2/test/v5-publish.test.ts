// Rules Engine v5.0 against the fixed rules every version is checked on before it publishes.
import { describe, expect, it } from 'vitest';
import { publishChecks } from '../src/index.js';
import { ruleset } from './support/v5.js';

describe('Rules Engine v5.0: the publish checks', { timeout: 120_000 }, () => {
  it('breaks none of the fixed rules on the publish sweep', () => {
    const report = publishChecks(ruleset);
    expect(report.counts).toEqual({});
    expect(report.ran).toBeGreaterThan(1000);
  });
});
