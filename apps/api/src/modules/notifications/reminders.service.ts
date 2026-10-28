import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { nextOccurrence, parseRule } from '../../common/time/rrule.js';
import type { ReminderCreate, ReminderDto, reminderUpdateSchema } from './notifications.schemas.js';

const MAX = 100;
type Row = Prisma.ReminderGetPayload<object>;

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const toDto = (r: Row, c: UserCipher): ReminderDto => ({
  id: r.id,
  subjectType: r.subjectType,
  subjectId: r.subjectId,
  label: c.decOpt(r.labelEnc),
  at: iso(r.at),
  rrule: r.rrule,
  style: r.style,
  active: r.active,
  nextRunAt: iso(r.nextRunAt),
  lastSentAt: iso(r.lastSentAt),
});

/** The next time a reminder should fire, or null when it's done. */
export function nextRun(
  r: { at: Date | null; rrule: string | null },
  after: Date,
  timeZone: string,
): Date | null {
  const rule = parseRule(r.rrule);
  if (rule) return nextOccurrence(rule, after, timeZone);
  return r.at && r.at > after ? r.at : null;
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private async tz(userId: string): Promise<string> {
    return (
      await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      })
    ).timezone;
  }

  async list(userId: string): Promise<ReminderDto[]> {
    const rows = await this.prisma.reminder.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ nextRunAt: { sort: 'asc', nulls: 'last' } }],
    });
    const c = await this.crypto.forUser(userId);
    return rows.map((r) => toDto(r, c));
  }

  private async assertSubject(
    userId: string,
    type: ReminderCreate['subjectType'],
    id: string | undefined,
  ): Promise<void> {
    if (!id) return;
    const count =
      type === 'task'
        ? await this.prisma.task.count({ where: { id, userId } })
        : type === 'practice'
          ? await this.prisma.practice.count({ where: { id, userId } })
          : type === 'recheck'
            ? await this.prisma.checkIn.count({ where: { id, userId } })
            : 1;
    if (!count) throw new NotFound(type);
  }

  async create(userId: string, input: ReminderCreate): Promise<ReminderDto> {
    const c = await this.crypto.forUser(userId);
    if (input.id) {
      const existing = await this.prisma.reminder.findFirst({ where: { id: input.id, userId } });
      if (existing) return toDto(existing, c);
    }
    if (
      (await this.prisma.reminder.count({ where: { userId, deletedAt: null, active: true } })) >=
      MAX
    )
      throw new BadInput(`You can keep up to ${String(MAX)} reminders.`);
    await this.assertSubject(userId, input.subjectType, input.subjectId);
    const now = new Date();
    const at = input.at
      ? new Date(input.at)
      : input.inMinutes
        ? new Date(now.getTime() + input.inMinutes * 60_000)
        : null;
    if (at && at <= now && !input.rrule) throw new BadInput('Choose a time in the future.');
    const rrule = input.rrule ?? null;
    const row = await this.prisma.reminder.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        subjectType: input.subjectType,
        subjectId: input.subjectId ?? null,
        labelEnc: c.encOpt(input.label),
        at,
        rrule,
        localTime: parseRule(rrule)?.minutes ?? null,
        style: input.style,
        nextRunAt: nextRun({ at, rrule }, now, await this.tz(userId)),
      },
    });
    return toDto(row, c);
  }

  async update(
    userId: string,
    id: string,
    input: z.infer<typeof reminderUpdateSchema>,
  ): Promise<ReminderDto> {
    const before = await this.prisma.reminder.findFirst({ where: { id, userId, deletedAt: null } });
    if (!before) throw new NotFound('reminder');
    const c = await this.crypto.forUser(userId);
    const at = input.at !== undefined ? (input.at ? new Date(input.at) : null) : before.at;
    const rrule = input.rrule !== undefined ? input.rrule : before.rrule;
    const active = input.active ?? before.active;
    const row = await this.prisma.reminder.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { labelEnc: c.encOpt(input.label) } : {}),
        ...(input.style !== undefined ? { style: input.style } : {}),
        at,
        rrule,
        active,
        localTime: parseRule(rrule)?.minutes ?? null,
        nextRunAt: active ? nextRun({ at, rrule }, new Date(), await this.tz(userId)) : null,
      },
    });
    return toDto(row, c);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.prisma.reminder.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date(), active: false, nextRunAt: null },
    });
    if (res.count === 0) throw new NotFound('reminder');
  }
}
