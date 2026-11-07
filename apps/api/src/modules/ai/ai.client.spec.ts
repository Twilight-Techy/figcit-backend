import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../common/config/env.js';
import { AiClient, labelProbabilities } from './ai.client.js';

describe('decision scoring', () => {
  it('renormalises the label probabilities and ignores other tokens', () => {
    const p = labelProbabilities(
      [
        { token: 'B', logprob: Math.log(0.6) },
        { token: '**', logprob: Math.log(0.3) },
        { token: ' A', logprob: Math.log(0.1) },
      ],
      ['A', 'B', 'C'],
    );
    expect(p['A']).toBeCloseTo(0.1 / 0.7);
    expect(p['B']).toBeCloseTo(0.6 / 0.7);
    expect(p['C']).toBe(0);
  });

  it('gives every label 0 when none of them appear', () => {
    expect(labelProbabilities([{ token: 'Hello', logprob: 0 }], ['A', 'B'])).toEqual({
      A: 0,
      B: 0,
    });
  });
});

describe('circuit breaker', () => {
  const req = { system: 's', user: 'u', temperature: 0, maxTokens: 1, timeoutMs: 1000 };
  const client = (): AiClient =>
    new AiClient({ AI_BASE_URL: 'http://model.test', AI_MODEL: 'm' } as Env);
  const answering = (status: number): void => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
  };
  const failTimes = async (c: AiClient, n: number): Promise<void> => {
    for (let i = 0; i < n; i += 1) await c.chat(req).catch(() => undefined);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens after three failures in a row', async () => {
    answering(500);
    const c = client();
    await failTimes(c, 3);
    expect(c.circuitOpen).toBe(true);
  });

  it('does not count a model that is still loading', async () => {
    answering(503);
    const c = client();
    await failTimes(c, 10);
    expect(c.circuitOpen).toBe(false);
  });

  it('needs three more failures to open again', async () => {
    vi.useFakeTimers();
    answering(500);
    const c = client();
    await failTimes(c, 3);
    vi.advanceTimersByTime(60_001);
    expect(c.circuitOpen).toBe(false);
    await failTimes(c, 2);
    expect(c.circuitOpen).toBe(false);
    await failTimes(c, 1);
    expect(c.circuitOpen).toBe(true);
  });
});
