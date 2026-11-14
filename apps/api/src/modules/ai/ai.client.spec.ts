import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../common/config/env.js';
import { AiClient, labelFromText, labelProbabilities } from './ai.client.js';

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

describe('the reminder after the user words', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comes after the user words, so the model reads the task last', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const c = new AiClient({ AI_BASE_URL: 'http://model.test', AI_MODEL: 'm' } as Env);
    await c.chat({
      system: 's',
      user: 'answer me',
      reminder: 'Do the task.',
      temperature: 0,
      maxTokens: 1,
      timeoutMs: 1000,
    });
    const body = JSON.parse((fetch.mock.calls[0]?.[1] as { body: string }).body) as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[1]?.content).toBe(
      '<user_words>\nanswer me\n</user_words>\n\nDo the task.',
    );
  });
});

describe('a hosted OpenAI-style API (AI_PROVIDER=openai)', () => {
  const env = { AI_BASE_URL: 'https://api.test/openai', AI_MODEL: 'm', AI_PROVIDER: 'openai' };
  const sent = (): Record<string, unknown> => {
    const call = vi.mocked(fetch).mock.calls[0];
    return JSON.parse(call?.[1]?.body as string) as Record<string, unknown>;
  };
  const reply = (content: string): void => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
        ),
    );
  };
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for JSON mode with the schema in the prompt, and nothing llama-only', async () => {
    reply('{"a":1}');
    await new AiClient(env as Env).chat({
      system: 'Sort it.',
      user: 'x',
      schema: { name: 's', schema: { type: 'object' } },
      temperature: 0,
      maxTokens: 50,
      timeoutMs: 1000,
    });
    const body = sent();
    expect(body['response_format']).toEqual({ type: 'json_object' });
    expect(body['chat_template_kwargs']).toBeUndefined();
    const messages = body['messages'] as { content: string }[];
    expect(messages[0]?.content).toContain('"type":"object"');
  });

  it('decides by the label the model names', async () => {
    reply(' B.');
    const p = await new AiClient(env as Env).decide({
      system: 'Pick.',
      user: 'x',
      labels: ['A', 'B'],
      timeoutMs: 1000,
    });
    expect(p).toEqual({ A: 0, B: 1 });
    expect(sent()['logprobs']).toBeUndefined();
  });

  it('sends the reasoning effort when set', async () => {
    reply('A');
    await new AiClient({ ...env, AI_REASONING_EFFORT: 'none' } as Env).decide({
      system: 'Pick.',
      user: 'x',
      labels: ['A', 'B'],
      timeoutMs: 1000,
    });
    expect(sent()['reasoning_effort']).toBe('none');
  });

  it('gives no answer when the model names no label', () => {
    expect(labelFromText('maybe', ['A', 'B'])).toEqual({ A: 0, B: 0 });
  });
});
