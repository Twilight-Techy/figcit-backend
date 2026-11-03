// Staff accounts (E-63): an admin invites, changes roles, removes, suspends and reinstates; each
// takes effect at once (staff routes read the session and the roles as they are now), never on
// the admin's own account, and all of it is on the audit log.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { codeAt, stepAt } from '../src/modules/auth/totp.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let admin: { token: string; userId: string };

const STAFF_APP = 'http://staff.example';

/** Signs in by the emailed code, then sets up and passes the two-step sign-in. */
async function signInAsStaff(email: string): Promise<string> {
  const first = await api.signIn(email);
  const enrol = await api.req<{ secret: string }>('POST', '/auth/mfa/enrol', {
    token: first.token,
  });
  const verified = await api.req<{ accessToken: string }>('POST', '/auth/mfa/verify', {
    token: first.token,
    body: { code: codeAt(enrol.body.secret, stepAt(Date.now())) },
    headers: { 'x-client': 'native' },
  });
  return verified.body.accessToken;
}

const audited = async (userId: string): Promise<string[]> =>
  (
    await api.app.get(PrismaService).auditEvent.findMany({
      where: { targetId: userId, action: { startsWith: 'staff.' } },
      orderBy: { at: 'asc' },
      select: { action: true },
    })
  ).map((a) => a.action);

beforeAll(async () => {
  api = await bootApi({ STAFF_APP_URL: STAFF_APP });
  admin = await api.staff(['admin']);
});

afterAll(async () => {
  await api.close();
});

describe('staff accounts', () => {
  it('invites a new person, who signs in to the staff app and must set up two-step sign-in', async () => {
    const email = `invite-${randomUUID().slice(0, 8)}@example.com`;
    const res = await api.req<{ id: string; roles: string[]; existing: boolean; mfa: boolean }>(
      'POST',
      '/admin/staff',
      { token: admin.token, body: { email, roles: ['content_editor'], reason: 'new editor' } },
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ existing: false, mfa: false });
    expect(res.body.roles).toContain('content_editor');
    const mail = await api.req<{ mail: { to: string; text: string }[] }>(
      'GET',
      `/dev/mailbox?to=${encodeURIComponent(email)}`,
    );
    expect(mail.body.mail.some((m) => m.text.includes(`${STAFF_APP}/sign-in/`))).toBe(true);
    // Signed in but no two-step yet: no staff route.
    const plain = await api.signIn(email);
    expect((await api.req('GET', '/admin/metrics', { token: plain.token })).status).toBe(403);
    const token = await signInAsStaff(email);
    expect((await api.req('GET', '/admin/metrics', { token })).status).toBe(200);
    const again = await api.req('POST', '/admin/staff', {
      token: admin.token,
      body: { email, roles: ['admin'], reason: 'twice' },
    });
    expect(again.status).toBe(400);
  });

  it('makes an existing account staff, and only admins invite', async () => {
    const user = await api.signIn();
    const res = await api.req<{ existing: boolean }>('POST', '/admin/staff', {
      token: admin.token,
      body: { email: user.email, roles: ['safety_reviewer'], reason: 'reviewer' },
    });
    expect(res.body.existing).toBe(true);
    const editor = await api.staff(['content_editor']);
    const refused = await api.req('POST', '/admin/staff', {
      token: editor.token,
      body: { email: 'x@example.com', roles: ['admin'], reason: 'no' },
    });
    expect(refused.status).toBe(403);
  });

  it('applies a role change to the token already in use', async () => {
    const member = await api.staff(['content_editor']);
    expect((await api.req('GET', '/admin/staff', { token: member.token })).status).toBe(403);
    const changed = await api.req('PATCH', `/admin/staff/${member.userId}`, {
      token: admin.token,
      body: { roles: ['admin'] },
    });
    expect(changed.status).toBe(200);
    expect((await api.req('GET', '/admin/staff', { token: member.token })).status).toBe(200);
  });

  it('removes someone from staff: their staff access ends at once', async () => {
    const member = await api.staff(['content_editor']);
    const res = await api.req<{ roles: string[] }>('POST', `/admin/staff/${member.userId}/remove`, {
      token: admin.token,
      body: { reason: 'left the team' },
    });
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['customer']);
    expect((await api.req('GET', '/admin/metrics', { token: member.token })).status).toBe(401);
    expect(await audited(member.userId)).toEqual(['staff.remove']);
  });

  it('suspends an account (no sign-in anywhere) and reinstates it', async () => {
    const member = await api.staff(['safety_reviewer']);
    const path = `/admin/staff/${member.userId}`;
    const suspended = await api.req<{ status: string }>('POST', `${path}/suspend`, {
      token: admin.token,
      body: { reason: 'on leave' },
    });
    expect(suspended.body.status).toBe('suspended');
    expect((await api.req('GET', '/admin/metrics', { token: member.token })).status).toBe(401);
    await expect(api.signIn(member.email)).rejects.toThrow();
    const listed = await api.req<{ items: { id: string; status: string }[] }>(
      'GET',
      '/admin/staff',
      {
        token: admin.token,
      },
    );
    expect(listed.body.items.find((s) => s.id === member.userId)?.status).toBe('suspended');
    const back = await api.req<{ status: string }>('POST', `${path}/reinstate`, {
      token: admin.token,
      body: { reason: 'back from leave' },
    });
    expect(back.body.status).toBe('active');
    const token = await signInAsStaff(member.email);
    expect((await api.req('GET', '/admin/metrics', { token })).status).toBe(200);
    expect(await audited(member.userId)).toEqual(['staff.suspend', 'staff.reinstate']);
  });

  it("never acts on the admin's own account, and asks for a reason", async () => {
    for (const act of ['remove', 'suspend'])
      expect(
        (
          await api.req('POST', `/admin/staff/${admin.userId}/${act}`, {
            token: admin.token,
            body: { reason: 'self' },
          })
        ).status,
      ).toBe(400);
    const other = await api.staff(['content_editor']);
    const noReason = await api.req('POST', `/admin/staff/${other.userId}/suspend`, {
      token: admin.token,
      body: {},
    });
    expect(noReason.status).toBe(400);
  });
});
