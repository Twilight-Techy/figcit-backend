import { Injectable, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError } from '../../common/errors/errors.js';
import { checkInInputSchema } from '../checkin/checkin.schemas.js';
import { CheckInService } from '../checkin/checkin.service.js';
import { dumpCreateSchema } from '../dump/dump.schemas.js';
import { DumpService } from '../dump/dump.service.js';
import { draftCreateSchema, draftUpdateSchema } from '../express/express.schemas.js';
import { ExpressService } from '../express/express.service.js';
import { practiceCreateSchema, practiceUpdateSchema } from '../practices/practices.schemas.js';
import { PracticesService } from '../practices/practices.service.js';
import { reflectionCreateSchema } from '../reflect/reflect.schemas.js';
import { ReflectService } from '../reflect/reflect.service.js';
import { reminderCreateSchema } from '../notifications/notifications.schemas.js';
import { RemindersService } from '../notifications/reminders.service.js';
import { safetyEventInputSchema, supportPlanInputSchema } from '../safety/safety.schemas.js';
import { SafetyService } from '../safety/safety.service.js';
import { SupportService } from '../safety/support.service.js';
import {
  feedbackInputSchema,
  sessionStartSchema,
  sessionUpdateSchema,
} from '../sessions/sessions.schemas.js';
import { SessionsService } from '../sessions/sessions.service.js';
import { stepsPutSchema, taskCreateSchema, taskUpdateSchema } from '../tasks/tasks.schemas.js';
import { TasksService } from '../tasks/tasks.service.js';
import type { syncOperationSchema, syncResultSchema } from './sync.schemas.js';

type Op = z.infer<typeof syncOperationSchema>;
type Result = z.infer<typeof syncResultSchema>;
type Handler = (userId: string, op: Op) => Promise<unknown>;

/**
 * Offline sync (SYSTEM_DESIGN §8): each queued operation is applied by the module that owns it, with
 * the same validation as its endpoint, in its own transaction. A re-sent operation id is a no-op.
 */
@Injectable()
export class SyncService {
  private readonly handlers: Readonly<Record<string, Handler>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ModuleRef,
  ) {
    const svc = <T>(t: Type<T>): T => this.refs.get(t, { strict: false });
    const withId = (op: Op): Record<string, unknown> => ({ ...op.data, id: op.entityId });
    this.handlers = {
      'check_in:create': (u, op) =>
        svc(CheckInService).create(
          u,
          checkInInputSchema.parse({ ...withId(op), origin: 'offline' }),
        ),
      'task:create': (u, op) =>
        svc(TasksService).create(
          u,
          taskCreateSchema.parse({ ...withId(op), clientUpdatedAt: op.clientUpdatedAt }),
        ),
      'task:update': (u, op) =>
        svc(TasksService).update(
          u,
          op.entityId,
          taskUpdateSchema.parse({ ...op.data, clientUpdatedAt: op.clientUpdatedAt }),
        ),
      'task:delete': (u, op) => svc(TasksService).remove(u, op.entityId),
      'task_steps:update': (u, op) =>
        svc(TasksService).putSteps(u, op.entityId, stepsPutSchema.parse(op.data)),
      'session:create': (u, op) =>
        svc(SessionsService).start(
          u,
          sessionStartSchema.parse({ ...withId(op), origin: 'offline' }),
        ),
      'session:update': (u, op) =>
        svc(SessionsService).update(u, op.entityId, sessionUpdateSchema.parse(op.data)),
      'feedback:create': (u, op) =>
        svc(SessionsService).feedback(u, op.entityId, feedbackInputSchema.parse(op.data)),
      'dump:create': (u, op) =>
        svc(DumpService).create(u, dumpCreateSchema.parse({ ...withId(op), origin: 'offline' })),
      'reflection:create': (u, op) =>
        svc(ReflectService).create(
          u,
          reflectionCreateSchema.parse({ ...withId(op), origin: 'offline' }),
        ),
      'draft:create': (u, op) => svc(ExpressService).create(u, draftCreateSchema.parse(withId(op))),
      'draft:update': (u, op) =>
        svc(ExpressService).update(
          u,
          op.entityId,
          draftUpdateSchema.parse({ ...op.data, clientUpdatedAt: op.clientUpdatedAt }),
        ),
      'practice:create': (u, op) =>
        svc(PracticesService).create(u, practiceCreateSchema.parse(withId(op))),
      'practice:update': (u, op) =>
        svc(PracticesService).update(
          u,
          op.entityId,
          practiceUpdateSchema.parse({ ...op.data, clientUpdatedAt: op.clientUpdatedAt }),
        ),
      'practice:delete': (u, op) => svc(PracticesService).remove(u, op.entityId),
      'reminder:create': (u, op) =>
        svc(RemindersService).create(u, reminderCreateSchema.parse(withId(op))),
      'reminder:delete': (u, op) => svc(RemindersService).remove(u, op.entityId),
      'support_plan:update': (u, op) =>
        svc(SupportService).savePlan(
          u,
          supportPlanInputSchema.parse({ ...op.data, clientUpdatedAt: op.clientUpdatedAt }),
        ),
      'safety_event:create': (u, op) =>
        svc(SafetyService).record({
          userId: u,
          ...safetyEventInputSchema.parse({ ...op.data, origin: 'offline' }),
        }),
    };
  }

  static readonly ENTITIES = [
    'check_in',
    'task',
    'task_steps',
    'session',
    'feedback',
    'dump',
    'reflection',
    'draft',
    'practice',
    'reminder',
    'support_plan',
    'safety_event',
  ] as const;

  async push(userId: string, ops: readonly Op[]): Promise<Result[]> {
    const results: Result[] = [];
    for (const op of ops) results.push(await this.applyOne(userId, op));
    return results;
  }

  private async applyOne(userId: string, op: Op): Promise<Result> {
    const seen = await this.prisma.syncOperation.findUnique({ where: { id: op.id } });
    if (seen)
      return {
        id: op.id,
        result: seen.userId === userId ? 'duplicate' : 'rejected',
        entityId: op.entityId,
        error: null,
      };
    const handler = this.handlers[`${op.entity}:${op.op}`];
    let result: Result['result'] = 'applied';
    let error: string | null = null;
    if (!handler) {
      result = 'rejected';
      error = `unsupported ${op.entity}:${op.op}`;
    } else {
      try {
        await handler(userId, op);
      } catch (e) {
        result = 'rejected';
        error =
          e instanceof AppError
            ? e.code
            : e instanceof Error && e.name === 'ZodError'
              ? 'invalid_input'
              : 'failed';
      }
    }
    await this.prisma.syncOperation.create({
      data: {
        id: op.id,
        userId,
        entity: op.entity,
        entityId: op.entityId,
        op: op.op,
        resultCode: result,
      },
    });
    return { id: op.id, result, entityId: op.entityId, error };
  }

  /** What changed since the cursor, for a second device. Codes and ids only; detail is fetched per screen. */
  async pull(
    userId: string,
    since: Date,
  ): Promise<{
    cursor: string;
    changes: Record<string, { id: string; updatedAt: string; deleted: boolean }[]>;
  }> {
    const cursor = new Date();
    const pick = (rows: { id: string; updatedAt: Date; deletedAt?: Date | null }[]) =>
      rows.map((r) => ({
        id: r.id,
        updatedAt: r.updatedAt.toISOString(),
        deleted: Boolean(r.deletedAt),
      }));
    const changed = { userId, updatedAt: { gt: since, lte: cursor } };
    const created = { userId, createdAt: { gt: since, lte: cursor } };
    const [tasks, drafts, practices, reminders, checkIns, reflections, dumps] = await Promise.all([
      this.prisma.task.findMany({
        where: changed,
        select: { id: true, updatedAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.draft.findMany({
        where: changed,
        select: { id: true, updatedAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.practice.findMany({
        where: changed,
        select: { id: true, updatedAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.reminder.findMany({
        where: changed,
        select: { id: true, updatedAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.checkIn.findMany({
        where: created,
        select: { id: true, createdAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.reflection.findMany({
        where: created,
        select: { id: true, createdAt: true, deletedAt: true },
        take: 500,
      }),
      this.prisma.dump.findMany({
        where: created,
        select: { id: true, createdAt: true, deletedAt: true },
        take: 500,
      }),
    ]);
    const asUpdated = (rows: { id: string; createdAt: Date; deletedAt: Date | null }[]) =>
      pick(rows.map((r) => ({ id: r.id, updatedAt: r.createdAt, deletedAt: r.deletedAt })));
    return {
      cursor: cursor.toISOString(),
      changes: {
        tasks: pick(tasks),
        drafts: pick(drafts),
        practices: pick(practices),
        reminders: pick(reminders),
        checkIns: asUpdated(checkIns),
        reflections: asUpdated(reflections),
        dumps: asUpdated(dumps),
      },
    };
  }
}
