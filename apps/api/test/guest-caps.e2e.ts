// Guest space: the caps hold on every path that makes a task, a dump or a dump item, and under
// concurrency (20 open tasks, 50 dumps, 50 items in a dump; common/guest/constants.ts).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/db/prisma.service.js';
import { bootApi, type Api } from './helpers.js';
import { MANY, start } from './guest-helpers.js';

let api: Api;
let prisma: PrismaService;

beforeAll(async () => {
  api = await bootApi(MANY);
  prisma = api.app.get(PrismaService);
});
afterAll(() => api.close());

interface Problem {
  code?: string;
  detail?: string;
}
const open = (userId: string) =>
  prisma.task.count({ where: { userId, status: 'open', deletedAt: null } });

/** A guest with `n` open tasks. */
async function guestWith(n: number) {
  const g = await start(api);
  const token = g.body.accessToken;
  const ids: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const res = await api.req<{ id: string }>('POST', '/tasks', {
      token,
      body: { title: `T${String(i)}` },
    });
    expect(res.status).toBe(201);
    ids.push(res.body.id);
  }
  return { token, userId: g.body.user.id, ids };
}
const expectLimit = (res: { status: number; body: Problem }) => {
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('guest_limit');
};

describe('every way to make a task is capped at 20 open (item 3)', () => {
  it('a check-in with a task typed in (demand.title) is refused at the cap, and stores nothing', async () => {
    const g = await guestWith(20);
    const before = await prisma.checkIn.count({ where: { userId: g.userId } });
    const res = await api.req<Problem>('POST', '/check-ins', {
      token: g.token,
      body: {
        state: { kind: 'grid', energy: 3, mood: 4 },
        demand: { title: 'Sneaky 21st', kind: 'work', timeline: 'T3' },
      },
    });
    expectLimit(res);
    expect(await open(g.userId)).toBe(20);
    expect(await prisma.checkIn.count({ where: { userId: g.userId } })).toBe(before);
  });

  it('a check-in with a task typed in is fine below the cap, and a check-in without one is fine at it', async () => {
    const g = await guestWith(19);
    const withTask = await api.req('POST', '/check-ins', {
      token: g.token,
      body: {
        state: { kind: 'grid', energy: 3, mood: 4 },
        demand: { title: 'The 20th', kind: 'work', timeline: 'T3' },
      },
    });
    expect(withTask.status).toBe(201);
    expect(await open(g.userId)).toBe(20);
    const plain = await api.req('POST', '/check-ins', {
      token: g.token,
      body: { state: { kind: 'grid', energy: 3, mood: 4 } },
    });
    expect(plain.status).toBe(201);
  });

  it('a sync batch applies what fits and rejects the rest with guest_limit, op by op', async () => {
    const g = await guestWith(18);
    const ops = Array.from({ length: 5 }, (_, i) => ({
      id: randomUUID(),
      entity: 'task',
      op: 'create',
      entityId: randomUUID(),
      data: { title: `Offline ${String(i)}` },
      clientUpdatedAt: new Date().toISOString(),
    }));
    const res = await api.req<{ results: { result: string; error: string | null }[] }>(
      'POST',
      '/sync/push',
      { token: g.token, body: { operations: ops } },
    );
    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.result)).toEqual([
      'applied',
      'applied',
      'rejected',
      'rejected',
      'rejected',
    ]);
    expect(res.body.results.slice(2).every((r) => r.error === 'guest_limit')).toBe(true);
    expect(await open(g.userId)).toBe(20);
    // The same ops sent again are duplicates: a rejection is final, not retried into the cap.
    const again = await api.req<{ results: { result: string }[] }>('POST', '/sync/push', {
      token: g.token,
      body: { operations: ops },
    });
    expect(again.body.results.every((r) => r.result === 'duplicate')).toBe(true);
  });

  it('reopening a finished task counts: refused at the cap, allowed below it', async () => {
    const g = await guestWith(20);
    const done = g.ids[0] ?? '';
    expect(
      (await api.req('PATCH', `/tasks/${done}`, { token: g.token, body: { status: 'done' } }))
        .status,
    ).toBe(200);
    expect(
      (await api.req('POST', '/tasks', { token: g.token, body: { title: 'Fills the room' } }))
        .status,
    ).toBe(201);
    expectLimit(
      await api.req<Problem>('PATCH', `/tasks/${done}`, {
        token: g.token,
        body: { status: 'open' },
      }),
    );
    expect(await open(g.userId)).toBe(20);
    // Finish another, and the first can come back.
    await api.req('PATCH', `/tasks/${g.ids[1] ?? ''}`, {
      token: g.token,
      body: { status: 'dropped' },
    });
    expect(
      (await api.req('PATCH', `/tasks/${done}`, { token: g.token, body: { status: 'open' } }))
        .status,
    ).toBe(200);
    expect(await open(g.userId)).toBe(20);
  });

  it('turning a dump item into a task is capped like any task', async () => {
    const g = await guestWith(20);
    const dump = await api.req<{ items: { id: string }[] }>('POST', '/dumps', {
      token: g.token,
      body: { text: 'Call the bank' },
    });
    const item = dump.body.items[0]?.id ?? '';
    expectLimit(
      await api.req<Problem>('POST', `/dump-items/${item}/to-task`, { token: g.token, body: {} }),
    );
    expect(await open(g.userId)).toBe(20);
  });

  it('an account is not capped by any of these', async () => {
    const me = await api.signIn();
    for (let i = 0; i < 22; i += 1)
      expect(
        (await api.req('POST', '/tasks', { token: me.token, body: { title: `T${String(i)}` } }))
          .status,
      ).toBe(201);
    const res = await api.req('POST', '/check-ins', {
      token: me.token,
      body: {
        state: { kind: 'grid', energy: 3, mood: 4 },
        demand: { title: 'Another', kind: 'work', timeline: 'T3' },
      },
    });
    expect(res.status).toBe(201);
  });
});

describe('a dump is capped at 50 items for a guest (item 3)', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${String(i)}`).join('\n');

  it('50 lines are fine, 51 and 300 are refused, and nothing is stored for them', async () => {
    const g = await start(api);
    const token = g.body.accessToken;
    expect((await api.req('POST', '/dumps', { token, body: { text: lines(50) } })).status).toBe(
      201,
    );
    expectLimit(await api.req<Problem>('POST', '/dumps', { token, body: { text: lines(51) } }));
    expectLimit(await api.req<Problem>('POST', '/dumps', { token, body: { text: lines(300) } }));
    expect(await prisma.dump.count({ where: { userId: g.body.user.id } })).toBe(1);
  });

  it('adding an item to a dump that has 50 is refused', async () => {
    const g = await start(api);
    const token = g.body.accessToken;
    const dump = await api.req<{ id: string }>('POST', '/dumps', {
      token,
      body: { text: lines(50) },
    });
    expectLimit(
      await api.req<Problem>('POST', `/dumps/${dump.body.id}/items`, {
        token,
        body: { text: 'One more' },
      }),
    );
  });

  it('an account may have a dump of 200 items, as before', async () => {
    const me = await api.signIn();
    expect(
      (await api.req('POST', '/dumps', { token: me.token, body: { text: lines(200) } })).status,
    ).toBe(201);
  });
});

describe('the caps hold under concurrency (item 4)', () => {
  const twelve = <T>(make: (i: number) => Promise<T>) =>
    Promise.all(Array.from({ length: 12 }, (_, i) => make(i)));

  it('12 parallel task creates at 19 open make exactly one more', async () => {
    const g = await guestWith(19);
    const res = await twelve((i) =>
      api.req<Problem>('POST', '/tasks', { token: g.token, body: { title: `Race ${String(i)}` } }),
    );
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(res.filter((r) => r.status === 403 && r.body.code === 'guest_limit')).toHaveLength(11);
    expect(await open(g.userId)).toBe(20);
  });

  it('parallel task creates and dump items turned into tasks share the same 20', async () => {
    const g = await guestWith(18);
    const dump = await api.req<{ items: { id: string }[] }>('POST', '/dumps', {
      token: g.token,
      body: { text: Array.from({ length: 6 }, (_, i) => `job ${String(i)}`).join('\n') },
    });
    const items = dump.body.items.map((i) => i.id);
    const res = await twelve((i) =>
      i < 6
        ? api.req<Problem>('POST', '/tasks', {
            token: g.token,
            body: { title: `Race ${String(i)}` },
          })
        : api.req<Problem>('POST', `/dump-items/${items[i - 6] ?? ''}/to-task`, {
            token: g.token,
            body: {},
          }),
    );
    expect(res.filter((r) => r.status === 201 || r.status === 200)).toHaveLength(2);
    expect(res.filter((r) => r.status === 403 && r.body.code === 'guest_limit')).toHaveLength(10);
    expect(await open(g.userId)).toBe(20);
  });

  it('12 parallel dump creates at 49 make exactly one more', async () => {
    const g = await start(api);
    const token = g.body.accessToken;
    for (let i = 0; i < 49; i += 1)
      expect(
        (await api.req('POST', '/dumps', { token, body: { text: `d${String(i)}` } })).status,
      ).toBe(201);
    const res = await twelve((i) =>
      api.req<Problem>('POST', '/dumps', { token, body: { text: `race ${String(i)}` } }),
    );
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.dump.count({ where: { userId: g.body.user.id } })).toBe(50);
  });

  it('12 parallel items into a dump at 49 make exactly one more', async () => {
    const g = await start(api);
    const token = g.body.accessToken;
    const text = Array.from({ length: 49 }, (_, i) => `l${String(i)}`).join('\n');
    const dump = await api.req<{ id: string }>('POST', '/dumps', { token, body: { text } });
    const res = await twelve((i) =>
      api.req<Problem>('POST', `/dumps/${dump.body.id}/items`, {
        token,
        body: { text: `race ${String(i)}` },
      }),
    );
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.dumpItem.count({ where: { dumpId: dump.body.id } })).toBe(50);
  });

  it('12 parallel reopens at 19 open make exactly one more', async () => {
    const g = await guestWith(20);
    for (const id of g.ids.slice(0, 12))
      await api.req('PATCH', `/tasks/${id}`, { token: g.token, body: { status: 'done' } });
    // 8 open. Fill to 19, then reopen 12 at once.
    for (let i = 0; i < 11; i += 1)
      await api.req('POST', '/tasks', { token: g.token, body: { title: `F${String(i)}` } });
    expect(await open(g.userId)).toBe(19);
    const res = await Promise.all(
      g.ids
        .slice(0, 12)
        .map((id) =>
          api.req<Problem>('PATCH', `/tasks/${id}`, { token: g.token, body: { status: 'open' } }),
        ),
    );
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await open(g.userId)).toBe(20);
  });
});
