import { describe, expect, it } from 'vitest';
import { AccountRequired, GuestLimit, NotEntitled, PROBLEM_CODES } from './errors.js';

describe('NotEntitled', () => {
  it('names the plans that have the feature, not the old Plus (B-10)', () => {
    const e = new NotEntitled('The monthly summary');
    expect(e.status).toBe(402);
    expect(e.detail).toBe('The monthly summary is part of Prime and Premium.');
    expect(new NotEntitled('My fit summary', 'Premium').detail).toBe(
      'My fit summary is part of Premium.',
    );
  });
});

describe('the guest space problems', () => {
  it('account_required and guest_limit are 403 problems with plain words', () => {
    const need = new AccountRequired();
    expect(need).toMatchObject({ status: 403, code: 'account_required' });
    expect(need.detail).toBe('Create an account to use this.');
    const full = new GuestLimit('A guest space keeps up to 20 open tasks.');
    expect(full).toMatchObject({ status: 403, code: 'guest_limit' });
    expect(full.detail).toBe('A guest space keeps up to 20 open tasks.');
  });

  it('are in the catalogue the OpenAPI file lists, with email_has_account', () => {
    for (const code of ['account_required', 'guest_limit', 'email_has_account'])
      expect(Object.keys(PROBLEM_CODES)).toContain(code);
  });
});
