import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { localParts } from '../../common/time/timeline.js';
import { RecommendationService } from '../recommendation/recommendation.service.js';
import { InboxService } from './inbox.service.js';
import { decide, PUSH_TEXT, type Category, type Decision } from './policy.js';
import { PushService } from './push.service.js';
import { nextRun } from './reminders.service.js';

const BATCH = 200;
const CATEGORY: Readonly<Record<string, Category>> = {
  checkin: 'checkin',
  task: 'tasks',
  practice: 'practices',
  recheck: 'recheck',
  custom: 'custom',
};

const USER_SELECT = {
  timezone: true,
  deletedAt: true,
  preferences: {
    select: {
      notificationStyle: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      inWorship: true,
      inWorshipUntil: true,
      notifyCategories: true,
    },
  },
} satisfies Prisma.UserSelect;
type DueReminder = Prisma.ReminderGetPayload<{ include: { user: { select: typeof USER_SELECT } } }>;

/** Runs every minute in the worker (`reminders.tick`): pushes what may be pushed, inboxes the rest. */
@Injectable()
export class DispatcherService {
  private readonly logger = new Logger('Reminders');

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly inbox: InboxService,
    private readonly recs: RecommendationService,
  ) {}

  async tick(now = new Date()): Promise<{ sent: number; held: number }> {
    const due = await this.prisma.reminder.findMany({
      where: { active: true, deletedAt: null, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: BATCH,
      include: { user: { select: USER_SELECT } },
    });
    let sent = 0;
    for (const r of due) if (!r.user.deletedAt && (await this.deliver(r, now))) sent += 1;
    if (due.length)
      this.logger.log(`reminders: ${String(sent)} pushed, ${String(due.length - sent)} to inbox`);
    return { sent, held: due.length - sent };
  }

  private async policy(r: DueReminder, category: Category, now: Date): Promise<Decision> {
    const p = r.user.preferences;
    const tz = r.user.timezone;
    const dayStart = new Date(now.getTime() - localParts(now, tz).minutes * 60_000);
    const [taskNudgesToday, state] = await Promise.all([
      this.prisma.notificationLog.count({
        where: { userId: r.userId, category: 'tasks', result: 'sent', at: { gte: dayStart } },
      }),
      this.recs.currentState(r.userId, now),
    ]);
    return decide({
      now,
      timeZone: tz,
      category,
      style: p?.notificationStyle ?? 'gentle',
      categories: p?.notifyCategories ?? ['checkin', 'tasks', 'practices', 'recheck'],
      quietStart: p?.quietHoursStart ?? null,
      quietEnd: p?.quietHoursEnd ?? null,
      inWorship: p?.inWorship ?? false,
      inWorshipUntil: p?.inWorshipUntil ?? null,
      taskNudgesToday,
      light: state.known ? state.light : null,
    });
  }

  /** Pushes or inboxes one reminder and schedules its next run. True when a device took it. */
  private async deliver(r: DueReminder, now: Date): Promise<boolean> {
    const category = CATEGORY[r.subjectType] ?? 'custom';
    const decision = await this.policy(r, category, now);
    const silent = r.style === 'silent' || r.user.preferences?.notificationStyle === 'silent';
    const delivered =
      decision === 'sent' ? await this.push.send(r.userId, { ...PUSH_TEXT[category], silent }) : 0;
    // Held, or no device took it: it waits quietly in the inbox (missed is never a failure; MD-5).
    if (delivered === 0)
      await this.inbox.add(r.userId, `reminder_${r.subjectType}`, {
        type: r.subjectType,
        id: r.subjectId,
      });
    await this.prisma.notificationLog.create({
      data: {
        userId: r.userId,
        reminderId: r.id,
        category,
        channel: delivered ? 'push' : 'inbox',
        result: decision === 'sent' && !delivered ? 'inboxed' : decision,
      },
    });
    await this.prisma.reminder.update({
      where: { id: r.id },
      data: {
        lastSentAt: now,
        nextRunAt: nextRun(r, new Date(now.getTime() + 60_000), r.user.timezone),
        ...(r.rrule ? {} : { active: false }),
      },
    });
    return delivered > 0;
  }
}
