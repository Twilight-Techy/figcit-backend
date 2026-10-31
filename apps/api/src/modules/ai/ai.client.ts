import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env.js';

export interface ChatRequest {
  readonly system: string;
  readonly user: string;
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

export class AiUnavailable extends Error {
  constructor(readonly reason: 'not_configured' | 'circuit_open' | 'timeout' | 'error') {
    super(reason);
  }
}

const FAILURES_TO_OPEN = 3;
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
        { role: 'user', content: `<user_words>\n${req.user}\n</user_words>` },
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
    this.failures += 1;
    if (this.failures >= FAILURES_TO_OPEN) {
      this.openUntil = Date.now() + OPEN_MS;
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
      if (!res.ok) throw new Error(`model server ${String(res.status)}`);
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
      if (!res.ok || !res.body) throw new Error(`model server ${String(res.status)}`);
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
