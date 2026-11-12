import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';

export interface ChatRequest {
  readonly system: string;
  readonly user: string;
  /**
   * The task again, after the user's words: a small model follows what it read last, so a draft
   * that asks a question or gives an order is reworked, not answered (owner review, 12 Nov 2026).
   */
  readonly reminder?: string | undefined;
  readonly schema?: { readonly name: string; readonly schema: unknown };
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
}

export interface ChatResult {
  readonly content: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface DecideRequest {
  readonly system: string;
  readonly user: string;
  /** Single-token option labels; the answer is a probability for each. */
  readonly labels: readonly string[];
  readonly timeoutMs: number;
}

export class AiUnavailable extends Error {
  constructor(readonly reason: 'not_configured' | 'circuit_open' | 'timeout' | 'error') {
    super(reason);
  }
}

const FAILURES_TO_OPEN = 3;

/** A 503 from a model that is still loading: expected after scaling to zero, not a server failing. */
class ModelLoading extends Error {}

const serverError = (status: number): Error =>
  status === 503 ? new ModelLoading() : new Error(`model server ${String(status)}`);

interface TopLogprob {
  readonly token: string;
  readonly logprob: number;
}

/** The labels' share of the probability, renormalised so they sum to 1 (0 when none appear). */
export function labelProbabilities(
  top: readonly TopLogprob[],
  labels: readonly string[],
): Record<string, number> {
  const p: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  for (const t of top) {
    const label = t.token.trim();
    if (label in p) p[label] = (p[label] ?? 0) + Math.exp(t.logprob);
  }
  const total = Object.values(p).reduce((n, x) => n + x, 0);
  return total > 0 ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / total])) : p;
}
/** The schema grammar still allows indentation, which can use up max_tokens before the JSON closes. */
export const COMPACT_JSON =
  'Reply with compact JSON on a single line: no indentation and no line breaks.';
const OPEN_MS = 60_000;

/**
 * Talks to the self-hosted model server over its OpenAI-compatible API with built-in fetch
 * (SYSTEM_DESIGN §4.3.4). A small circuit breaker stops hammering a server that is down.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger('AI');
  private failures = 0;
  private openUntil = 0;

  constructor(@Inject(ENV) private readonly env: Env) {}

  get configured(): boolean {
    return this.env.AI_BASE_URL !== undefined;
  }

  /** Calls are refused for a while after the model server kept failing. */
  get circuitOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  get model(): string {
    return this.env.AI_MODEL;
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.env.AI_TOKEN ? { authorization: `Bearer ${this.env.AI_TOKEN}` } : {}),
    };
  }

  private body(req: ChatRequest, stream: boolean): string {
    return JSON.stringify({
      model: this.env.AI_MODEL,
      messages: [
        { role: 'system', content: req.schema ? `${req.system}\n${COMPACT_JSON}` : req.system },
        {
          role: 'user',
          content: `<user_words>\n${req.user}\n</user_words>${req.reminder ? `\n\n${req.reminder}` : ''}`,
        },
      ],
      ...(req.schema ? { response_format: { type: 'json_schema', json_schema: req.schema } } : {}),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream,
      chat_template_kwargs: { enable_thinking: false },
    });
  }

  private guard(): string {
    const base = this.env.AI_BASE_URL;
    if (!base) throw new AiUnavailable('not_configured');
    if (Date.now() < this.openUntil) throw new AiUnavailable('circuit_open');
    return base.replace(/\/$/, '');
  }

  private failed(error: unknown): AiUnavailable {
    if (error instanceof ModelLoading) return new AiUnavailable('error');
    this.failures += 1;
    if (this.failures >= FAILURES_TO_OPEN) {
      this.openUntil = Date.now() + OPEN_MS;
      // A fresh count once it closes, or one more failure would open it straight away.
      this.failures = 0;
      this.logger.warn('model server failing; circuit open for 60s');
    }
    const timeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return new AiUnavailable(timeout ? 'timeout' : 'error');
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const base = this.guard();
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: this.body(req, false),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      if (!res.ok) throw serverError(res.status);
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      this.failures = 0;
      return {
        content: json.choices?.[0]?.message?.content ?? '',
        inputTokens: json.usage?.prompt_tokens ?? null,
        outputTokens: json.usage?.completion_tokens ?? null,
      };
    } catch (error) {
      throw this.failed(error);
    }
  }

  /**
   * Decision scoring (ADR 0005): the model writes one token, and the probabilities of the option
   * labels among its top alternatives are the answer, renormalised over the labels. No text is
   * generated, so a classification takes a fraction of a second even on CPU.
   */
  async decide(req: DecideRequest): Promise<Record<string, number>> {
    const base = this.guard();
    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.env.AI_MODEL,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: `<user_words>\n${req.user}\n</user_words>` },
          ],
          max_tokens: 1,
          temperature: 0,
          logprobs: true,
          top_logprobs: 40,
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      if (!res.ok) throw serverError(res.status);
      const json = (await res.json()) as {
        choices?: { logprobs?: { content?: { top_logprobs?: TopLogprob[] }[] } }[];
      };
      this.failures = 0;
      return labelProbabilities(
        json.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [],
        req.labels,
      );
    } catch (error) {
      throw this.failed(error);
    }
  }

  /** Streams text deltas (server-sent events from the model server). */
  async *stream(req: ChatRequest): AsyncGenerator<string> {
    const base = this.guard();
    let res: Response;
    try {
      res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: this.body(req, true),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
      if (!res.ok || !res.body) throw serverError(res.status);
    } catch (error) {
      throw this.failed(error);
    }
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const data = line.startsWith('data:') ? line.slice(5).trim() : '';
        if (!data || data === '[DONE]') continue;
        const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] })
          .choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
    this.failures = 0;
  }
}
