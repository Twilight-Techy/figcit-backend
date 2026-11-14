import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ENV, type Env } from '../../common/config/env.js';
import { sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { SafetyService, type SafetyMatch } from '../safety/safety.service.js';
import { AiClient, AiUnavailable } from './ai.client.js';
import type { DecisionTask, JsonTask, TextTask } from './ai.tasks.js';
import { scrub } from './text.js';

export interface AiCaller {
  readonly userId?: string | undefined;
  readonly browseToken?: string | undefined;
  /** Express assists count against the free daily allowance. */
  readonly allowance?: 'assist' | 'standard';
}

export type AiResult<O> =
  | {
      readonly blocked: false;
      readonly data: O;
      readonly source: 'ai' | 'fallback';
      readonly limited: boolean;
    }
  | { readonly blocked: true; readonly match: SafetyMatch };

export type TextEvent =
  | { readonly type: 'delta'; readonly text: string }
  | {
      readonly type: 'done';
      readonly text: string;
      readonly source: 'ai' | 'fallback';
      readonly replaced: boolean;
      readonly limited: boolean;
    };

const STANDARD_DAILY = 100;
const BROWSE_DAILY = 20;
const PLUS_ASSIST_DAILY = 200;
type Outcome = 'ok' | 'fallback' | 'timeout' | 'invalid' | 'circuit_open' | 'not_entitled';

/**
 * Every AI call goes through here: safety screen first, scrub, per-user daily limits, the model
 * call, schema and business checks, and the rule-based fallback. Logs `ai_calls` without text.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly client: AiClient,
    private readonly prisma: PrismaService,
    private readonly safety: SafetyService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private hash(caller: AiCaller): string | null {
    if (caller.userId) return sha256(`user:${caller.userId}`);
    if (caller.browseToken) return sha256(`browse:${caller.browseToken}`);
    return null;
  }

  private async withinLimit(task: string, caller: AiCaller): Promise<boolean> {
    const userHash = this.hash(caller);
    if (!userHash) return true;
    let limit = caller.userId ? STANDARD_DAILY : BROWSE_DAILY;
    if (caller.allowance === 'assist' && caller.userId) {
      limit = (await this.entitlements.paid(caller.userId))
        ? PLUS_ASSIST_DAILY
        : this.env.ASSIST_DAILY_ALLOWANCE;
    }
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.aiCall.count({
      where: {
        userHash,
        at: { gte: since },
        ...(caller.allowance === 'assist'
          ? { task: { in: ['simplify', 'rewrite', 'draft', 'structure', 'script'] } }
          : { task }),
      },
    });
    return used < limit;
  }

  private log(
    task: { name: string; promptVersion: string },
    caller: AiCaller,
    outcome: Outcome,
    started: number,
    tokens?: { inputTokens: number | null; outputTokens: number | null },
  ): void {
    void this.prisma.aiCall
      .create({
        data: {
          task: task.name,
          userHash: this.hash(caller),
          model: outcome === 'ok' ? this.client.model : null,
          promptVersion: task.promptVersion,
          outcome,
          latencyMs: Date.now() - started,
          inputTokens: tokens?.inputTokens ?? null,
          outputTokens: tokens?.outputTokens ?? null,
        },
      })
      .catch(() => undefined);
  }

  private static reason(error: unknown): Outcome {
    if (error instanceof AiUnavailable)
      return error.reason === 'timeout'
        ? 'timeout'
        : error.reason === 'circuit_open'
          ? 'circuit_open'
          : 'fallback';
    return 'invalid';
  }

  async json<I, O>(task: JsonTask<I, O>, input: I, caller: AiCaller): Promise<AiResult<O>> {
    const raw = task.text(input);
    const match = await this.safety.check([raw]);
    if (match) return { blocked: true, match };
    const started = Date.now();
    if (!(await this.withinLimit(task.name, caller))) {
      this.log(task, caller, 'not_entitled', started);
      return { blocked: false, data: task.fallback(input), source: 'fallback', limited: true };
    }
    if (!this.client.configured) {
      this.log(task, caller, 'fallback', started);
      return { blocked: false, data: task.fallback(input), source: 'fallback', limited: false };
    }
    const schema = task.schema(input);
    try {
      const res = await this.client.chat({
        system: task.system(input),
        user: scrub(raw, task.maxChars),
        reminder: task.reminder,
        schema: { name: task.name, schema: z.toJSONSchema(schema) },
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        timeoutMs: Math.min(task.timeoutMs, this.env.AI_TIMEOUT_MS * 3),
      });
      const parsed = schema.safeParse(JSON.parse(res.content));
      const data = parsed.success ? (task.clean?.(parsed.data, input) ?? parsed.data) : null;
      if (data !== null && task.check(data, input)) {
        this.log(task, caller, 'ok', started, res);
        return { blocked: false, data, source: 'ai', limited: false };
      }
      this.log(task, caller, 'invalid', started, res);
    } catch (error) {
      this.log(task, caller, AiService.reason(error), started);
    }
    return { blocked: false, data: task.fallback(input), source: 'fallback', limited: false };
  }

  /** Whether a call would reach the model now (the staff Simulator, E-61). */
  status(): { configured: boolean; circuitOpen: boolean; model: string | null } {
    const configured = this.client.configured;
    return {
      configured,
      circuitOpen: this.client.circuitOpen,
      model: configured ? this.client.model : null,
    };
  }

  /** A classification by decision scoring (ADR 0005), with the same screen, limits and fallback. */
  async decide<I, O>(task: DecisionTask<I, O>, input: I, caller: AiCaller): Promise<AiResult<O>> {
    const raw = task.text(input);
    const match = await this.safety.check([raw]);
    if (match) return { blocked: true, match };
    const started = Date.now();
    if (!(await this.withinLimit(task.name, caller))) {
      this.log(task, caller, 'not_entitled', started);
      return { blocked: false, data: task.fallback(input), source: 'fallback', limited: true };
    }
    if (!this.client.configured) {
      this.log(task, caller, 'fallback', started);
      return { blocked: false, data: task.fallback(input), source: 'fallback', limited: false };
    }
    try {
      const p = await this.client.decide({
        system: task.system(input),
        user: scrub(raw, task.maxChars),
        labels: task.labels(input),
        timeoutMs: task.timeoutMs,
      });
      const data = task.decode(p, input);
      if (task.check(data, input)) {
        this.log(task, caller, 'ok', started);
        return { blocked: false, data, source: 'ai', limited: false };
      }
      this.log(task, caller, 'invalid', started);
    } catch (error) {
      this.log(task, caller, AiService.reason(error), started);
    }
    return { blocked: false, data: task.fallback(input), source: 'fallback', limited: false };
  }

  /** Screens first; returns the match, or null when the text may go on to `stream`. */
  screen(texts: readonly string[]): Promise<SafetyMatch | null> {
    return this.safety.check(texts);
  }

  /** Streams a text task. Checks run on the full text; a failed check replaces it with the fallback. */
  async *stream<I>(task: TextTask<I>, input: I, caller: AiCaller): AsyncGenerator<TextEvent> {
    const started = Date.now();
    const fallback = (limited: boolean): TextEvent => ({
      type: 'done',
      text: task.fallback(input),
      source: 'fallback',
      replaced: false,
      limited,
    });
    if (!(await this.withinLimit(task.name, caller))) {
      this.log(task, caller, 'not_entitled', started);
      yield fallback(true);
      return;
    }
    if (!this.client.configured) {
      this.log(task, caller, 'fallback', started);
      yield fallback(false);
      return;
    }
    let text = '';
    try {
      for await (const delta of this.client.stream({
        system: task.system(input),
        user: scrub(task.text(input), task.maxChars),
        reminder: task.reminder,
        temperature: task.temperature,
        maxTokens: task.maxTokens,
        timeoutMs: task.timeoutMs,
      })) {
        text += delta;
        yield { type: 'delta', text: delta };
      }
    } catch (error) {
      this.log(task, caller, AiService.reason(error), started);
      yield { ...fallback(false), replaced: text.length > 0 } as TextEvent;
      return;
    }
    if (task.check(text, input)) {
      this.log(task, caller, 'ok', started);
      yield { type: 'done', text: text.trim(), source: 'ai', replaced: false, limited: false };
    } else {
      this.log(task, caller, 'invalid', started);
      yield {
        type: 'done',
        text: task.fallback(input),
        source: 'fallback',
        replaced: true,
        limited: false,
      };
    }
  }
}
