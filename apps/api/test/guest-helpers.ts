// Shared by the guest space e2e files (docs/GUEST_SPACE.md).
import type { Api } from './helpers.js';

export interface GuestSession {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; isGuest: boolean; isNew: boolean };
}
export interface Me {
  id: string;
  email: string | null;
  nickname: string | null;
  ageBand: string | null;
  isGuest: boolean;
  guestExpiresAt: string | null;
  detailsDone: boolean;
  tier: string;
}
export const ADULT = { ageBand: '18_plus', acceptTerms: true } as const;
export const NATIVE = { 'x-client': 'native' };
export const DAY = 86_400_000;

/** Every file makes guests from one address: the per-address limits are tested on their own. */
export const MANY = {
  GUEST_SIGNUPS_PER_HOUR: '1000',
  GUEST_SIGNUPS_PER_DAY: '1000',
  // bootApi keeps its overrides in process.env, so the other settings are pinned here too: a test
  // that tightens one must not leave it tightened for the next.
  GUEST_DAILY_CAP: '0',
  GUEST_ALERT_PER_HOUR: '0',
  GUEST_BOT_CHALLENGE: 'false',
  GUEST_LINK_MAILS_PER_ADDRESS: '5',
  TRUST_PROXY_HOPS: '1',
};

export const start = (
  a: Api,
  body: object = ADULT,
): Promise<{ status: number; body: GuestSession; headers: Record<string, unknown> }> =>
  a.req<GuestSession>('POST', '/auth/guest', { body, headers: NATIVE });
