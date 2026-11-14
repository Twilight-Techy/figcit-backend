// Staff accounts (E-63): an admin invites, changes roles, removes, suspends and reinstates; each
// takes effect at once (staff routes read the session and the roles as they are now), never on
// the admin's own account, and all of it is on the audit log.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
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

const ownerIs = async (userId: string): Promise<void> => {
  await api.app.get(PrismaService).staffOwner.upsert({
    where: { id: 1 },
    create: { id: 1, userId },
    update: { userId },
  });
};

beforeAll(async () => {
  api = await bootApi({ STAFF_APP_URL: STAFF_APP, OWNER_EMAIL: undefined });
  admin = await api.staff(['admin']);
  // The suite's admin is the Owner (E-64), as OWNER_EMAIL would make the first admin.
  await ownerIs(admin.userId);
});

afterAll(async () => {
  await api.close();
});

describe('staff accounts', () => {
  it('invites a new person, who signs in to the staff app with no two-step sign-in', async () => {
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
    // Staff sign in like anyone else: the two-step sign-in was removed (owner, 14 Nov 2026).
    const plain = await api.signIn(email);
    expect((await api.req('GET', '/admin/metrics', { token: plain.token })).status).toBe(200);
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

  it('keeps Admin, Clinical admin and acting on admins for the Owner (E-64)', async () => {
    const other = await api.staff(['admin']);
    const editor = await api.staff(['content_editor']);
    const asOther = (path: string, body: object, method = 'POST') =>
      api.req(method as 'POST', path, { token: other.token, body });
    // An admin who isn't the Owner manages the ordinary roles…
    expect(
      (await asOther(`/admin/staff/${editor.userId}`, { roles: ['safety_reviewer'] }, 'PATCH'))
        .status,
    ).toBe(200);
    // …but doesn't give or take Admin or Clinical admin,
    expect(
      (await asOther(`/admin/staff/${editor.userId}`, { roles: ['clinical_admin'] }, 'PATCH'))
        .status,
    ).toBe(403);
    const invite = await asOther('/admin/staff', {
      email: `x-${randomUUID().slice(0, 6)}@example.com`,
      roles: ['admin'],
      reason: 'not allowed',
    });
    expect(invite.status).toBe(403);
    // doesn't suspend or remove an admin, and nobody acts on the Owner.
    const third = await api.staff(['admin']);
    expect(
      (await asOther(`/admin/staff/${third.userId}/suspend`, { reason: 'not allowed' })).status,
    ).toBe(403);
    expect(
      (await asOther(`/admin/staff/${admin.userId}/suspend`, { reason: 'not allowed' })).status,
    ).toBe(403);
    // The Owner does.
    const owner = await api.req('PATCH', `/admin/staff/${editor.userId}`, {
      token: admin.token,
      body: { roles: ['clinical_admin'] },
    });
    expect(owner.status).toBe(200);
    const ownerRole = await api.app.get(PrismaService).auditEvent.findFirst({
      where: { targetId: editor.userId, action: 'staff.roles', actorId: admin.userId },
      select: { actorRole: true },
    });
    expect(ownerRole?.actorRole).toBe('owner');
  });

  it('hands ownership to an active admin, and back', async () => {
    const next = await api.staff(['admin']);
    const fresh = `owner-${randomUUID().slice(0, 6)}@example.com`;
    const invited = await api.req<{ id: string }>('POST', '/admin/staff', {
      token: admin.token,
      body: { email: fresh, roles: ['admin'], reason: 'new admin' },
    });
    // An invited admin can take over at once: no two-step sign-in to set up first.
    expect(invited.status).toBe(201);
    const res = await api.req<{ items: { id: string; owner: boolean }[] }>(
      'POST',
      '/admin/staff/owner',
      { token: admin.token, body: { userId: next.userId, reason: 'handing over' } },
    );
    expect(res.status).toBe(200);
    expect(res.body.items.find((m) => m.owner)?.id).toBe(next.userId);
    // The old Owner is an admin now: no longer gives Admin.
    const editor = await api.staff(['content_editor']);
    const refused = await api.req('PATCH', `/admin/staff/${editor.userId}`, {
      token: admin.token,
      body: { roles: ['admin'] },
    });
    expect(refused.status).toBe(403);
    const back = await api.req('POST', '/admin/staff/owner', {
      token: next.token,
      body: { userId: admin.userId, reason: 'handing back' },
    });
    expect(back.status).toBe(200);
  });

  it('sets the first Owner from OWNER_EMAIL only while there is none', async () => {
    const db = api.app.get(PrismaService);
    const email = `boot-${randomUUID().slice(0, 6)}@example.com`;
    // An Owner exists: OWNER_EMAIL changes nothing.
    const kept = await bootApi({ STAFF_APP_URL: STAFF_APP, OWNER_EMAIL: email });
    await kept.close();
    expect((await db.staffOwner.findUnique({ where: { id: 1 } }))?.userId).toBe(admin.userId);
    await db.staffOwner.delete({ where: { id: 1 } });
    const boot = await bootApi({ STAFF_APP_URL: STAFF_APP, OWNER_EMAIL: email });
    await boot.close();
    const owner = await db.staffOwner.findUnique({
      where: { id: 1 },
      select: { user: { select: { email: true, roles: true } } },
    });
    expect(owner?.user.email).toBe(email);
    expect(owner?.user.roles).toContain('admin');
    await ownerIs(admin.userId);
  });

  it('recovers ownership with the server command, on the audit log', () => {
    const api_ = resolve(import.meta.dirname, '..');
    const email = api.app.get(PrismaService).user.findUniqueOrThrow({
      where: { id: admin.userId },
      select: { email: true },
    });
    return email.then(async ({ email: e }) => {
      const other = await api.staff(['admin']);
      await ownerIs(other.userId);
      execFileSync(
        'node',
        [
          '--conditions=development',
          '--import',
          '@swc-node/register/esm-register',
          'src/cli/staff-owner.ts',
          '--email',
          e ?? '',
          '--reason',
          'lost authenticator',
        ],
        { cwd: api_, env: process.env, stdio: 'pipe' },
      );
      const db = api.app.get(PrismaService);
      expect((await db.staffOwner.findUnique({ where: { id: 1 } }))?.userId).toBe(admin.userId);
      const logged = await db.auditEvent.findFirst({
        where: { action: 'staff.owner.recover', targetId: admin.userId },
        select: { reason: true, actorRole: true },
      });
      expect(logged).toMatchObject({ reason: 'lost authenticator', actorRole: 'system' });
    });
  }, 60_000);

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
