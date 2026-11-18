// Guest space: the purge erases only guest spaces that have really reached their date, whatever
// happens between choosing them and erasing them (item 5).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { PrivacyService } from '../src/modules/privacy/privacy.service.js';
import { StorageService } from '../src/platform/storage/storage.service.js';
import { bootApi, type Api } from './helpers.js';
import { MANY, start } from './guest-helpers.js';

let api: Api;
let prisma: PrismaService;
let privacy: PrivacyService;

beforeAll(async () => {
  api = await bootApi(MANY);
  prisma = api.app.get(PrismaService);
  privacy = api.app.get(PrivacyService);
});
afterAll(() => api.close());

const NOW = new Date('2032-03-01T03:10:00Z');
/** A guest space whose date has passed, with a file of its own. */
async function expired(): Promise<{ id: string; key: string }> {
  const g = await start(api);
  const id = g.body.user.id;
  await prisma.user.update({
    where: { id },
    data: { guestExpiresAt: new Date(NOW.getTime() - 1000) },
  });
  const key = `guest-purge/${randomUUID()}`;
  await prisma.storedFile.create({
    data: {
      userId: id,
      purpose: 'transcription_input',
      storageKey: key,
      contentType: 'audio/webm',
      maxBytes: 10,
    },
  });
  return { id, key };
}

describe('purgeGuests does not erase an account that was linked after it was chosen', () => {
  it('leaves the account and its files alone, and carries on with the rest', async () => {
    const remove = vi.spyOn(api.app.get(StorageService), 'remove');
    const victim = await expired();
    const other = await expired();
    const email = `linked-${randomUUID()}@example.test`;
    // Between choosing the guest spaces and erasing them, the victim confirms an email.
    const between = async (id: string): Promise<void> => {
      if (id !== victim.id) return;
      await prisma.user.update({
        where: { id },
        data: { email, emailVerifiedAt: new Date(), isGuest: false, guestExpiresAt: null },
      });
    };
    const erased = await privacy.purgeGuests(NOW, 100, between);
    expect(erased).toBeGreaterThanOrEqual(1);
    const kept = await prisma.user.findUnique({ where: { id: victim.id } });
    expect(kept).toMatchObject({ email, isGuest: false });
    expect(await prisma.storedFile.count({ where: { userId: victim.id } })).toBe(1);
    expect(remove).not.toHaveBeenCalledWith(victim.key);
    // The other guest space was erased, and its file removed after the erase.
    expect(await prisma.user.findUnique({ where: { id: other.id } })).toBeNull();
    expect(remove).toHaveBeenCalledWith(other.key);
    remove.mockRestore();
  });

  it('erases an expired guest space, with its files after the commit', async () => {
    const g = await expired();
    const erased = await privacy.eraseExpiredGuest(g.id, NOW);
    expect(erased).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: g.id } })).toBeNull();
  });
});

describe('only an expired guest space can go through this path', () => {
  it('refuses an account, a guest space not yet due, and one with a null date', async () => {
    const account = await api.signIn();
    await prisma.user.update({
      where: { id: account.userId },
      data: { guestExpiresAt: new Date(NOW.getTime() - DAYS) },
    });
    expect(await privacy.eraseExpiredGuest(account.userId, NOW)).toBe(false);
    const notDue = await start(api);
    expect(await privacy.eraseExpiredGuest(notDue.body.user.id, new Date())).toBe(false);
    const noDate = await start(api);
    await prisma.user.update({
      where: { id: noDate.body.user.id },
      data: { guestExpiresAt: null },
    });
    expect(await privacy.eraseExpiredGuest(noDate.body.user.id, NOW)).toBe(false);
    for (const id of [account.userId, notDue.body.user.id, noDate.body.user.id])
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
  });
});

const DAYS = 86_400_000;

describe('a guest space that cannot be erased does not stop the others', () => {
  it('skips it for this run, goes on, and stops', async () => {
    const stuck = await Promise.all([expired(), expired()]);
    const fine = await Promise.all([expired(), expired(), expired()]);
    const real = privacy.eraseExpiredGuest.bind(privacy);
    const spy = vi.spyOn(privacy, 'eraseExpiredGuest').mockImplementation(async (id, now) => {
      if (stuck.some((s) => s.id === id)) throw new Error('this one will not erase');
      return real(id, now);
    });
    try {
      // A batch of 2: the two that fail fill the first batch, and must not block the next.
      const erased = await privacy.purgeGuests(NOW, 2);
      expect(erased).toBeGreaterThanOrEqual(3);
      for (const f of fine)
        expect(await prisma.user.findUnique({ where: { id: f.id } })).toBeNull();
      for (const s of stuck)
        expect(await prisma.user.findUnique({ where: { id: s.id } })).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
    // Tomorrow, when it works again, they go.
    await privacy.purgeGuests(NOW, 2);
    for (const s of stuck) expect(await prisma.user.findUnique({ where: { id: s.id } })).toBeNull();
  });
});
