// Guest space (docs/GUEST_SPACE.md): a real account with no email, kept for 30 days at most.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi();
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

describe('the guest columns', () => {
  it('an ordinary account is not a guest and has no expiry', async () => {
    const me = await api.signIn();
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: me.userId },
      select: { isGuest: true, guestExpiresAt: true },
    });
    expect(row).toEqual({ isGuest: false, guestExpiresAt: null });
  });

  it('keeps one row per guest space made, by a keyed address hash and the time', async () => {
    const row = await prisma.guestSignup.create({ data: { addrHash: 'a'.repeat(64) } });
    expect(row.createdAt).toBeInstanceOf(Date);
    await prisma.guestSignup.delete({ where: { id: row.id } });
  });
});
