// Communication cards the person wrote (S117): kept per account, encrypted, up to 50, never
// another person's.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
beforeAll(async () => {
  api = await bootApi();
});
afterAll(() => api.close());

type Card = { id: string; text: string; createdAt: string };

describe('own communication cards', () => {
  it('adds, lists oldest first, changes and deletes a card', async () => {
    const { token } = await api.signIn();
    const a = await api.req<Card>('POST', '/comm-cards', {
      token,
      body: { text: 'I need a minute' },
    });
    expect(a.status).toBe(201);
    await api.req('POST', '/comm-cards', { token, body: { text: '  Please write it down  ' } });
    const list = await api.req<{ items: Card[] }>('GET', '/comm-cards', { token });
    expect(list.body.items.map((c) => c.text)).toEqual(['I need a minute', 'Please write it down']);
    const changed = await api.req<Card>('PATCH', `/comm-cards/${a.body.id}`, {
      token,
      body: { text: 'I need five minutes' },
    });
    expect(changed.body.text).toBe('I need five minutes');
    expect((await api.req('DELETE', `/comm-cards/${a.body.id}`, { token })).status).toBe(204);
    const after = await api.req<{ items: Card[] }>('GET', '/comm-cards', { token });
    expect(after.body.items.map((c) => c.text)).toEqual(['Please write it down']);
  });

  it('keeps the words encrypted', async () => {
    const { token, userId } = await api.signIn();
    await api.req('POST', '/comm-cards', { token, body: { text: 'Too loud in here' } });
    const row = await api.app.get(PrismaService).commCard.findFirstOrThrow({ where: { userId } });
    expect(Buffer.from(row.textEnc).toString('utf8')).not.toContain('Too loud');
  });

  it("never shows, changes or deletes someone else's card", async () => {
    const owner = await api.signIn();
    const other = await api.signIn();
    const card = await api.req<Card>('POST', '/comm-cards', {
      token: owner.token,
      body: { text: 'Mine' },
    });
    expect(
      (await api.req<{ items: Card[] }>('GET', '/comm-cards', { token: other.token })).body.items,
    ).toEqual([]);
    const id = card.body.id;
    expect(
      (await api.req('PATCH', `/comm-cards/${id}`, { token: other.token, body: { text: 'x' } }))
        .status,
    ).toBe(404);
    expect((await api.req('DELETE', `/comm-cards/${id}`, { token: other.token })).status).toBe(404);
  });

  it('refuses an empty card, a very long one, and a 51st', async () => {
    const { token, userId } = await api.signIn();
    expect((await api.req('POST', '/comm-cards', { token, body: { text: '   ' } })).status).toBe(
      400,
    );
    expect(
      (await api.req('POST', '/comm-cards', { token, body: { text: 'x'.repeat(141) } })).status,
    ).toBe(400);
    const prisma = api.app.get(PrismaService);
    await prisma.commCard.createMany({
      data: Array.from({ length: 50 }, () => ({ userId, textEnc: Buffer.from('x') })),
    });
    const res = await api.req<{ detail: string }>('POST', '/comm-cards', {
      token,
      body: { text: 'One more' },
    });
    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/up to 50/);
  });
});
