import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import type { inboxItemSchema } from './notifications.schemas.js';

type Item = z.infer<typeof inboxItemSchema>;

/** What each inbox item says. Text comes from here, never from the user's data. */
interface Copy {
  readonly title: string;
  readonly body: string;
  readonly href: (refId: string | null) => string;
  /** Words that depend on the item's refType (a guest space's days left). */
  readonly text?: (refType: string | null) => { title: string; body: string };
}

/** "days_7" is 7 days left; the sweep writes one item for each of 7, 3 and 1 (GUEST_NOTICE_DAYS). */
const guestDays = (refType: string | null): number =>
  Number(/^days_(\d+)$/.exec(refType ?? '')?.[1] ?? 0);

const COPY: Readonly<Record<string, Copy>> = {
  guest_expiring: {
    title: 'Your guest space is ending',
    body: 'Create an account if you would like to keep what is here.',
    href: () => '/me/guest/',
    text: (refType) => {
      const days = guestDays(refType);
      return {
        title:
          days === 1
            ? 'Your guest space ends tomorrow'
            : days > 1
              ? `Your guest space has ${String(days)} days left`
              : 'Your guest space is ending',
        body: 'Create an account if you would like to keep what is here. If not, nothing else is needed: it clears on its own.',
      };
    },
  },
  reminder_checkin: {
    title: 'Check-in',
    body: 'A gentle check-in is here when you want it.',
    href: () => '/check/?mode=quick',
  },
  reminder_task: {
    title: 'A task reminder',
    body: 'One small step is enough.',
    href: (id) => (id ? `/tasks/detail/?id=${id}` : '/tasks/'),
  },
  reminder_practice: {
    title: 'Practice time',
    body: 'Your practice is here when you are ready.',
    href: (id) => (id ? `/meditate/session/?practice=${id}` : '/meditate/'),
  },
  reminder_recheck: {
    title: 'How are you now?',
    body: 'A quick re-check, if you like.',
    // refId is a legacy check-in id (reminders.assertSubject reads the CheckIn table), never a v5.0
    // decision id, and /check/?recheck= takes a decision id: so open a Quick check-in instead.
    href: () => '/check/?mode=quick',
  },
  reminder_custom: { title: 'Reminder', body: 'A gentle reminder.', href: () => '/reminders/' },
  export_ready: {
    title: 'Your data is ready',
    body: 'Your export is ready to download for 7 days.',
    href: () => '/settings/data/',
  },
  share_viewed: {
    title: 'Your share was opened',
    body: 'Someone opened a report you shared.',
    href: () => '/progress/share/',
  },
  plan_changed: {
    title: 'Your plan changed',
    body: 'See what is included now.',
    href: () => '/plans/',
  },
  support_prompt: {
    title: 'Things have been heavy lately',
    body: 'It might help to talk to someone. Your support options are here whenever you want them.',
    href: () => '/help/',
  },
  pattern_prompt: {
    title: 'This has come up a few times',
    body: 'Want to look at what helps? Only if you like.',
    href: () => '/patterns/',
  },
  account_restored: {
    title: 'Welcome back',
    body: 'Your account will not be deleted. Everything is as you left it.',
    href: () => '/settings/',
  },
  system: { title: 'FigCit', body: 'Something new is here.', href: () => '/home/' },
};

/** An item's title and body: its own words when they depend on the ref, else the kind's. */
function wordsOf(copy: Copy | undefined, refType: string | null): { title: string; body: string } {
  const own = copy?.text?.(refType);
  return { title: own?.title ?? copy?.title ?? '', body: own?.body ?? copy?.body ?? '' };
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async add(
    userId: string,
    kind: string,
    ref: { type?: string; id?: string | null } = {},
  ): Promise<void> {
    await this.prisma.inboxItem.create({
      data: { userId, kind, refType: ref.type ?? null, refId: ref.id ?? null },
    });
  }

  async list(userId: string): Promise<{ items: Item[]; unread: number }> {
    const [rows, unread] = await Promise.all([
      this.prisma.inboxItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.inboxItem.count({ where: { userId, readAt: null } }),
    ]);
    return {
      unread,
      items: rows.map((r) => {
        const copy = COPY[r.kind] ?? COPY['system'];
        return {
          id: r.id,
          kind: r.kind,
          refType: r.refType,
          refId: r.refId,
          ...wordsOf(copy, r.refType),
          href: copy?.href(r.refId) ?? '/home/',
          readAt: r.readAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    };
  }

  async read(userId: string, id: string | null): Promise<void> {
    const res = await this.prisma.inboxItem.updateMany({
      where: { userId, readAt: null, ...(id === null ? {} : { id }) },
      data: { readAt: new Date() },
    });
    if (
      id !== null &&
      res.count === 0 &&
      (await this.prisma.inboxItem.count({ where: { id, userId } })) === 0
    )
      throw new NotFound('inbox item');
  }
}
