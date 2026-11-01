import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { PrivacyService } from '../src/modules/privacy/privacy.service.js';
import { SustainedService } from '../src/modules/safety/sustained.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;
let privacy: PrivacyService;

beforeAll(async () => {
  api = await bootApi();
  prisma = api.app.get(PrismaService);
  privacy = api.app.get(PrivacyService);
});
afterAll(() => api.close());

const local = (url: string) => url.replace(/^https?:\/\/[^/]+/, '');

describe('files', () => {
  it('uploads through a signed link and serves it back to its owner only', async () => {
    const { token } = await api.signIn();
    const intent = await api.req<{ fileId: string; upload: { url: string } }>(
      'POST',
      '/files/uploads',
      { token, body: { purpose: 'practice_audio', contentType: 'audio/mpeg', sizeBytes: 5 } },
    );
    expect(intent.status).toBe(201);
    const put = await api.app.inject({
      method: 'PUT',
      url: local(intent.body.upload.url),
      headers: { 'content-type': 'audio/mpeg' },
      payload: Buffer.from('hello'),
    });
    expect(put.statusCode).toBe(204);
    const tampered = await api.app.inject({
      method: 'PUT',
      url: local(intent.body.upload.url).replace(/s=[^&]+/, 's=xxxxxxxxxxxxxxxx'),
      headers: { 'content-type': 'audio/mpeg' },
      payload: Buffer.from('x'),
    });
    expect(tampered.statusCode).toBe(403);
    const link = await api.req<{ url: string }>('GET', `/files/${intent.body.fileId}/url`, {
      token,
    });
    const got = await api.app.inject({ method: 'GET', url: local(link.body.url) });
    expect(got.body).toBe('hello');
    expect(got.headers['content-type']).toBe('audio/mpeg');
    const other = await api.signIn();
    expect(
      (await api.req('GET', `/files/${intent.body.fileId}/url`, { token: other.token })).status,
    ).toBe(404);
    expect(
      (
        await api.req('POST', '/files/uploads', {
          token,
          body: { purpose: 'practice_audio', contentType: 'text/html', sizeBytes: 5 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api.req('POST', '/files/uploads', {
          token,
          body: { purpose: 'voice_note', contentType: 'audio/webm', sizeBytes: 50 * 1024 * 1024 },
        })
      ).status,
    ).toBe(413);
  });
});

describe('privacy', () => {
  it('exports all data, decrypted, and links to it', async () => {
    const { token } = await api.signIn();
    await api.req('POST', '/tasks', { token, body: { title: 'Secret task title' } });
    await api.req('POST', '/check-ins', {
      token,
      body: { state: { kind: 'grid', energy: 3, mood: 3 }, ownWords: 'my own words here' },
    });
    const job = await api.req<{ id: string }>('POST', '/me/export', { token });
    expect(job.status).toBe(202);
    await privacy.runExport(job.body.id);
    const list = await api.req<{ items: { status: string; url: string }[] }>('GET', '/me/exports', {
      token,
    });
    expect(list.body.items[0]?.status).toBe('done');
    const file = await api.app.inject({ method: 'GET', url: local(list.body.items[0]?.url ?? '') });
    const data = JSON.parse(file.body) as {
      tasks: { title: string }[];
      checkIns: { need: { ownWords: string } }[];
    };
    expect(data.tasks[0]?.title).toBe('Secret task title');
    expect(data.checkIns[0]?.need.ownWords).toBe('my own words here');
    expect(file.body).not.toContain('Enc"');
    const inbox = await api.req<{ items: { kind: string }[] }>('GET', '/inbox', { token });
    expect(inbox.body.items[0]?.kind).toBe('export_ready');
  });

  it('deletes softly, restores on magic-link sign-in in the grace period, and purges after it', async () => {
    const me = await api.signIn();
    expect(
      (await api.req('DELETE', '/me', { token: me.token, body: { confirm: 'yes' } })).status,
    ).toBe(400);
    const del = await api.req<{ scheduledFor: string }>('DELETE', '/me', {
      token: me.token,
      body: { confirm: 'delete my account' },
    });
    expect(del.status).toBe(202);
    expect([401, 404]).toContain((await api.req('GET', '/me', { token: me.token })).status);
    const back = await api.signIn(me.email);
    expect((await api.req('GET', '/me', { token: back.token })).status).toBe(200);
    const inbox = await api.req<{ items: { kind: string }[] }>('GET', '/inbox', {
      token: back.token,
    });
    expect(inbox.body.items[0]?.kind).toBe('account_restored');

    const decided = await api.req<{ id: string }>('POST', '/decisions', {
      token: back.token,
      body: { state: { kind: 'grid', energy: 3, mood: 3 } },
    });
    expect(decided.status).toBe(201);
    await api.req('DELETE', '/me', { token: back.token, body: { confirm: 'delete my account' } });
    await api.req('POST', '/check-ins', {
      token: back.token,
      body: { state: { kind: 'grid', energy: 1, mood: 1 }, ownWords: 'I want to die' },
    });
    await prisma.deletionRequest.update({
      where: { userId: me.userId },
      data: { scheduledFor: new Date(Date.now() - 1000) },
    });
    const purged = await privacy.purgeDue();
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.count({ where: { id: me.userId } })).toBe(0);
    // The engine v2 decision stays for the compliance trail, with no account link (E-52).
    const kept = await prisma.decisionRecord.findUniqueOrThrow({ where: { id: decided.body.id } });
    expect(kept.userId).toBeNull();
  });

  it('runs retention without error', async () => {
    const removed = await privacy.retention();
    expect(removed).toHaveProperty('aiCalls');
  });
});

describe('SF-2', () => {
  it('flags a week of Very Constrained once', async () => {
    const { token, userId } = await api.signIn();
    for (let i = 0; i < 4; i += 1)
      await api.req('POST', '/check-ins', {
        token,
        body: { state: { kind: 'grid', energy: 1, mood: 1 } },
      });
    const recs = await prisma.recommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    await Promise.all(
      recs.map((r, i) =>
        prisma.recommendation.update({
          where: { id: r.id },
          data: { createdAt: new Date(Date.now() - (6.5 - i * 2) * 86_400_000) },
        }),
      ),
    );
    const sustained = api.app.get(SustainedService);
    expect(await sustained.run()).toBeGreaterThanOrEqual(1);
    const inbox = await api.req<{ items: { kind: string; href: string }[] }>('GET', '/inbox', {
      token,
    });
    expect(inbox.body.items[0]).toMatchObject({ kind: 'support_prompt', href: '/help/' });
    await sustained.run();
    expect(await prisma.safetyEvent.count({ where: { userId, trigger: 'sustained' } })).toBe(1);
  });
});
