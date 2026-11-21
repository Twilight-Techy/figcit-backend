// The tester survey (owner, 21 Nov 2026): asked after a few check-ins or at sign-out, put off with
// "Not now" at most twice, answered with five taps, summed up for staff, and testimonials shown
// publicly only once the person agreed and staff approved.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

let api: Api;
beforeAll(async () => {
  api = await bootApi();
});
afterAll(() => api.close());

type State = { answered: boolean; dueAfterUse: boolean; answers: { overall: number } | null };
type Summary = {
  responses: number;
  questions: Record<string, { average: number | null; counts: number[] }>;
  items: { id: string; testimonial: string | null; testimonialStatus: string | null }[];
};
const answers = {
  navigation: 4,
  checkIn: 5,
  fit: 3,
  accuracy: 4,
  overall: 5,
  askedAt: 'after_use',
};

describe('tester survey', () => {
  it('is due only after three check-ins, and "Not now" puts it off', async () => {
    const { token } = await api.signIn();
    const state = async (): Promise<State> =>
      (await api.req<State>('GET', '/me/survey', { token })).body;
    expect(await state()).toMatchObject({ answered: false, dueAfterUse: false, answers: null });
    for (let i = 0; i < 3; i += 1) {
      const res = await api.req('POST', '/check-ins', {
        token,
        body: { state: { kind: 'grid', energy: 3, mood: 3 } },
      });
      expect(res.status).toBe(201);
    }
    expect((await state()).dueAfterUse).toBe(true);
    const later = await api.req<State>('POST', '/me/survey/later', { token });
    expect(later.body.dueAfterUse).toBe(false);
  });

  it('saves the answers, sums them up for staff, and publishes approved testimonials', async () => {
    const { token } = await api.signIn();
    const words = `FigCit helped me start my day ${String(Date.now())}`;
    const saved = await api.req<State>('PUT', '/me/survey', {
      token,
      body: {
        ...answers,
        comment: '  ',
        testimonial: words,
        testimonialPublic: true,
        testimonialName: 'Ana',
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      answered: true,
      dueAfterUse: false,
      answers: { overall: 5 },
    });

    const staff = await api.staff(['content_editor']);
    const summary = await api.req<Summary>('GET', '/admin/survey', { token: staff.token });
    expect(summary.body.responses).toBeGreaterThanOrEqual(1);
    expect(summary.body.questions['overall']?.counts[4]).toBeGreaterThanOrEqual(1);
    const mine = summary.body.items.find((i) => i.testimonial === words);
    expect(mine?.testimonialStatus).toBe('pending');

    const shown = async (): Promise<string[]> =>
      (await api.req<{ items: { text: string }[] }>('GET', '/testimonials')).body.items.map(
        (t) => t.text,
      );
    expect(await shown()).not.toContain(words);
    const ok = await api.req('PATCH', `/admin/survey/${mine?.id ?? ''}/testimonial`, {
      token: staff.token,
      body: { status: 'approved' },
    });
    expect(ok.status).toBe(200);
    expect(await shown()).toContain(words);
  });

  it('never publishes words the person kept private, even if approved', async () => {
    const { token } = await api.signIn();
    const words = `Private words ${String(Date.now())}`;
    await api.req('PUT', '/me/survey', {
      token,
      body: { ...answers, askedAt: 'logout', testimonial: words, testimonialPublic: false },
    });
    const staff = await api.staff(['content_editor']);
    const summary = await api.req<Summary>('GET', '/admin/survey', { token: staff.token });
    const mine = summary.body.items.find((i) => i.testimonial === words);
    await api.req('PATCH', `/admin/survey/${mine?.id ?? ''}/testimonial`, {
      token: staff.token,
      body: { status: 'approved' },
    });
    const items = (await api.req<{ items: { text: string }[] }>('GET', '/testimonials')).body.items;
    expect(items.map((t) => t.text)).not.toContain(words);
  });

  it('refuses answers outside 1 to 5, and staff routes to non-staff', async () => {
    const { token } = await api.signIn();
    const bad = await api.req('PUT', '/me/survey', { token, body: { ...answers, overall: 6 } });
    expect(bad.status).toBe(400);
    const notStaff = await api.req('GET', '/admin/survey', { token });
    expect(notStaff.status).toBe(403);
  });
});
