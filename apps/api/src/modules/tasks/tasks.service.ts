import { Injectable } from '@nestjs/common';
import { orderTasks, type Driver, type Light, type TimelineCode } from '@figcit/engine';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { nextOccurrence, parseRule } from '../../common/time/rrule.js';
import { timelineFor } from '../../common/time/timeline.js';
import { AiService } from '../ai/ai.service.js';
import { breakDownTask } from '../ai/ai.tasks.js';
import { RecommendationService } from '../recommendation/recommendation.service.js';
import { RulesService } from '../rules/rules.service.js';
import { TASK_SELECT, liveTimeline, toTaskDto } from './tasks.mapper.js';
import type {
  breakDownResponseSchema,
  orderedSchema,
  orderInputSchema,
  orderResultSchema,
  stepsPutSchema,
  TaskCreate,
  TaskDto,
  TaskUpdate,
} from './tasks.schemas.js';

const MAX_ACTIVE = 500;
const STRAINED = new Set<Light>(['amber', 'red']);

function updateData(
  input: TaskUpdate,
  cipher: { enc(t: string): Uint8Array<ArrayBuffer> },
): Prisma.TaskUncheckedUpdateInput {
  return {
    ...(input.title !== undefined ? { titleEnc: cipher.enc(input.title) } : {}),
    ...(input.kind !== undefined ? { type: input.kind } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
    ...(input.timeline !== undefined ? { timelineCode: input.timeline } : {}),
    ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {}),
    ...(input.puttingOff !== undefined ? { puttingOff: input.puttingOff } : {}),
    ...(input.drivers !== undefined ? { nucripceTags: input.drivers } : {}),
    ...(input.snoozedUntil !== undefined
      ? { snoozedUntil: input.snoozedUntil ? new Date(input.snoozedUntil) : null }
      : {}),
    ...(input.planSlot !== undefined ? { planSlot: input.planSlot } : {}),
    ...(input.planDate !== undefined
      ? { planDate: input.planDate ? new Date(input.planDate) : null }
      : {}),
    ...planBlock(input),
    ...(input.skipped ? { skipCount: { increment: 1 } } : {}),
    ...adaptData(input),
  };
}

/** The task's block in Plan your time; off the day plan, it has no block either. */
function planBlock(input: TaskUpdate): Prisma.TaskUncheckedUpdateInput {
  if (input.planDate === null) return { planStart: null, planMinutes: null };
  return {
    ...(input.planStart !== undefined ? { planStart: input.planStart } : {}),
    ...(input.planMinutes !== undefined ? { planMinutes: input.planMinutes } : {}),
  };
}

/** What Adapt changed on the task: its pace and the library codes for where and how. */
function adaptData(input: TaskUpdate): Prisma.TaskUncheckedUpdateInput {
  return {
    ...(input.stepMinutes !== undefined ? { stepMinutes: input.stepMinutes } : {}),
    ...(input.breakMinutes !== undefined ? { breakMinutes: input.breakMinutes } : {}),
    ...(input.adaptCodes !== undefined ? { adaptCodes: [...new Set(input.adaptCodes)] } : {}),
  };
}

/** Tasks, steps, break-down and the state-aware order (M08, S20–S22, S127). */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly rules: RulesService,
    private readonly ai: AiService,
    private readonly recs: RecommendationService,
  ) {}

  private async ctx(userId: string): Promise<{
    cipher: Awaited<ReturnType<CryptoService['forUser']>>;
    snapshot: Awaited<ReturnType<RulesService['current']>>['snapshot'];
    tz: string;
    now: Date;
  }> {
    const [cipher, { snapshot }, user] = await Promise.all([
      this.crypto.forUser(userId),
      this.rules.current(),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    ]);
    return { cipher, snapshot, tz: user.timezone, now: new Date() };
  }

  private async row(userId: string, id: string) {
    const row = await this.prisma.task.findFirst({
      where: { id, userId, deletedAt: null },
      select: TASK_SELECT,
    });
    if (!row) throw new NotFound('task');
    return row;
  }

  async get(userId: string, id: string): Promise<TaskDto> {
    const c = await this.ctx(userId);
    return toTaskDto(await this.row(userId, id), c.cipher, c.snapshot, c.now, c.tz);
  }

  async list(
    userId: string,
    q: { status: 'open' | 'done' | 'dropped' | 'all'; includeSnoozed: boolean; limit: number },
  ): Promise<TaskDto[]> {
    const c = await this.ctx(userId);
    const rows = await this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(q.status === 'all' ? {} : { status: q.status }),
        ...(q.includeSnoozed || q.status !== 'open'
          ? {}
          : { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: c.now } }] }),
      },
      orderBy:
        q.status === 'done'
          ? [{ doneAt: 'desc' }]
          : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: q.limit,
      select: TASK_SELECT,
    });
    return rows.map((r) => toTaskDto(r, c.cipher, c.snapshot, c.now, c.tz));
  }

  async create(userId: string, input: TaskCreate): Promise<TaskDto> {
    if (input.id) {
      const existing = await this.prisma.task.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (existing) return this.get(userId, existing.id);
    }
    const c = await this.ctx(userId);
    if (
      (await this.prisma.task.count({ where: { userId, status: 'open', deletedAt: null } })) >=
      MAX_ACTIVE
    )
      throw new BadInput(`You can keep up to ${String(MAX_ACTIVE)} open tasks.`);
    const timeline: TimelineCode | null =
      input.timeline ??
      (input.dueAt
        ? timelineFor(new Date(input.dueAt), c.now, c.tz)
        : input.recurrenceRule
          ? 'TR'
          : 'T6');
    const row = await this.prisma.task.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        titleEnc: c.cipher.enc(input.title),
        type: input.kind ?? null,
        timelineCode: timeline,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        recurrenceRule: input.recurrenceRule ?? null,
        puttingOff: input.puttingOff,
        nucripceTags: input.drivers,
        source: input.source,
        planSlot: input.planSlot ?? null,
        clientUpdatedAt: input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : c.now,
        steps: {
          create: input.steps.map((text, position) => ({ position, textEnc: c.cipher.enc(text) })),
        },
      },
      select: TASK_SELECT,
    });
    return toTaskDto(row, c.cipher, c.snapshot, c.now, c.tz);
  }

  async update(userId: string, id: string, input: TaskUpdate): Promise<TaskDto> {
    const before = await this.row(userId, id);
    const c = await this.ctx(userId);
    const existing = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      select: { clientUpdatedAt: true },
    });
    const clientAt = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : c.now;
    // Last write wins by the client's clock for offline edits (SYSTEM_DESIGN §8).
    if (existing.clientUpdatedAt > clientAt)
      return toTaskDto(before, c.cipher, c.snapshot, c.now, c.tz);
    const data = {
      ...updateData(input, c.cipher),
      clientUpdatedAt: clientAt,
      ...this.statusChange(before, input.status, c.now, c.tz),
    };
    const row = await this.prisma.task.update({ where: { id }, data, select: TASK_SELECT });
    if (input.status === 'done' && before.recurrenceRule && data.status === 'open')
      await this.prisma.taskStep.updateMany({ where: { taskId: id }, data: { doneAt: null } });
    return toTaskDto(row, c.cipher, c.snapshot, c.now, c.tz);
  }

  /** Done on a recurring task rolls it to the next occurrence instead of closing it. */
  private statusChange(
    before: { status: string; recurrenceRule: string | null; dueAt: Date | null },
    status: TaskUpdate['status'],
    now: Date,
    tz: string,
  ): Prisma.TaskUncheckedUpdateInput {
    if (!status || status === before.status) return {};
    if (status !== 'done') return { status, doneAt: null };
    const rule = parseRule(before.recurrenceRule);
    if (rule)
      return {
        status: 'open',
        doneAt: null,
        dueAt: nextOccurrence(
          rule,
          new Date(Math.max(now.getTime(), before.dueAt?.getTime() ?? 0) + 60_000),
          tz,
        ),
        skipCount: 0,
        planSlot: null,
      };
    return { status: 'done', doneAt: now };
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.prisma.task.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('task');
  }

  async putSteps(
    userId: string,
    id: string,
    input: z.infer<typeof stepsPutSchema>,
  ): Promise<TaskDto> {
    await this.row(userId, id);
    const c = await this.ctx(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.taskStep.deleteMany({ where: { taskId: id } });
      await tx.taskStep.createMany({
        data: input.steps.map((s, position) => ({
          ...(s.id ? { id: s.id } : {}),
          taskId: id,
          position,
          textEnc: c.cipher.enc(s.text),
          source: s.source,
          doneAt: s.done ? c.now : null,
          later: s.later,
          adaptCodes: [...new Set(s.adaptCodes)],
        })),
      });
      await tx.task.update({ where: { id }, data: { clientUpdatedAt: c.now } });
    });
    return this.get(userId, id);
  }

  async breakDown(
    userId: string,
    id: string,
    opts: { save: boolean; replace: boolean },
  ): Promise<z.infer<typeof breakDownResponseSchema>> {
    const row = await this.row(userId, id);
    const c = await this.ctx(userId);
    const timeline = liveTimeline(row, c.now, c.tz);
    const stepCap = c.snapshot.timelines.find((t) => t.code === timeline)?.stepCap ?? 8;
    const light = (await this.currentLight(userId)).light;
    const title = c.cipher.dec(row.titleEnc);
    const res = await this.ai.json(
      breakDownTask,
      { title, kind: row.type ?? undefined, stepCap, strained: STRAINED.has(light) },
      { userId },
    );
    // A task title is the user's own; if it trips the safety screen we still offer template steps.
    const out = res.blocked
      ? breakDownTask.fallback({ title: '', stepCap, strained: true })
      : res.data;
    const source = res.blocked ? 'fallback' : res.source;
    const save = opts.save && (opts.replace || row.steps.length === 0);
    if (save) {
      await this.prisma.$transaction([
        this.prisma.taskStep.deleteMany({ where: { taskId: id } }),
        this.prisma.taskStep.createMany({
          data: out.steps.map((s, position) => ({
            taskId: id,
            position,
            textEnc: c.cipher.enc(s.text),
            source: source === 'ai' ? 'ai' : 'template',
          })),
        }),
      ]);
    }
    return {
      steps: out.steps,
      estimatedDemand: out.estimatedDemand,
      source,
      saved: save,
      task: await this.get(userId, id),
    };
  }

  async currentLight(userId: string): Promise<{ light: Light; known: boolean }> {
    const { light, known } = await this.recs.currentState(userId);
    return { light, known };
  }

  /** Browse: the order of tasks kept on the phone, from what ordering reads (E-59). */
  async order(input: z.infer<typeof orderInputSchema>): Promise<z.infer<typeof orderResultSchema>> {
    const { snapshot } = await this.rules.current();
    return {
      items: orderTasks(input.tasks, input.light, snapshot).map((o) => ({
        id: o.id,
        whyNow: o.whyNow,
        whyNowText: o.whyNowText,
        onlyIfMust: o.onlyIfMust,
      })),
    };
  }

  async ordered(userId: string): Promise<z.infer<typeof orderedSchema>> {
    const [tasks, { light, known }, { snapshot }] = await Promise.all([
      this.list(userId, { status: 'open', includeSnoozed: false, limit: 200 }),
      this.currentLight(userId),
      this.rules.current(),
    ]);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const order = orderTasks(
      tasks.map((t) => ({
        id: t.id,
        timeline: t.timeline,
        drivers: t.drivers as Driver[],
        stepsLeft: t.steps.filter((s) => !s.done).length,
        puttingOff: t.puttingOff,
        skipCount: t.skipCount,
        planSlot: t.planSlot,
      })),
      light,
      snapshot,
    );
    return {
      light,
      lightKnown: known,
      items: order.flatMap((o) => {
        const t = byId.get(o.id);
        return t
          ? [{ ...t, whyNow: o.whyNow, whyNowText: o.whyNowText, onlyIfMust: o.onlyIfMust }]
          : [];
      }),
    };
  }
}
