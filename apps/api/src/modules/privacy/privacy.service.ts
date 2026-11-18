import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { JobsService } from '../../platform/jobs/jobs.service.js';
import { StorageService } from '../../platform/storage/storage.service.js';
import { GUEST_NOTICE_DAYS } from '../../common/guest/constants.js';
import { InboxService } from '../notifications/inbox.service.js';
import { ExportBuilder } from './export.builder.js';

export const GRACE_DAYS = 30;
const EXPORT_TTL_DAYS = 7;
const DAY = 86_400_000;

/** Export, delete, and the retention schedule (SYSTEM_DESIGN §9.4). */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger('Privacy');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly builder: ExportBuilder,
    private readonly inbox: InboxService,
    private readonly events: DomainEvents,
  ) {}

  async requestExport(userId: string): Promise<{ id: string; status: string }> {
    const running = await this.prisma.exportJob.findFirst({
      where: { userId, status: { in: ['queued', 'running'] } },
      select: { id: true, status: true },
    });
    if (running) return running;
    const recent = await this.prisma.exportJob.count({
      where: { userId, requestedAt: { gt: new Date(Date.now() - DAY) } },
    });
    if (recent >= 3)
      throw new AppError(
        429,
        'rate_limited',
        'You asked for a few exports today',
        'Try again tomorrow.',
      );
    const job = await this.prisma.exportJob.create({
      data: { userId },
      select: { id: true, status: true },
    });
    await this.jobs
      .send('privacy.export', { jobId: job.id }, { singletonKey: job.id })
      .catch((e: unknown) => {
        this.logger.warn({ err: String(e) }, 'export job not queued; worker will pick it up');
      });
    return job;
  }

  /** Worker handler: builds the file and tells the user (inbox). */
  async runExport(jobId: string): Promise<void> {
    const job = await this.prisma.exportJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'done') return;
    await this.prisma.exportJob.update({ where: { id: jobId }, data: { status: 'running' } });
    try {
      const data = await this.builder.build(job.userId);
      const body = Buffer.from(JSON.stringify(data, null, 2));
      const key = `export/${job.userId}/${jobId}.json`;
      await this.storage.put(key, body, 'application/json');
      const expiresAt = new Date(Date.now() + EXPORT_TTL_DAYS * DAY);
      const file = await this.prisma.storedFile.create({
        data: {
          userId: job.userId,
          purpose: 'export',
          storageKey: key,
          contentType: 'application/json',
          sizeBytes: body.length,
          maxBytes: body.length,
          status: 'uploaded',
          uploadedAt: new Date(),
          expiresAt,
        },
      });
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'done', fileId: file.id, completedAt: new Date(), expiresAt },
      });
      await this.inbox.add(job.userId, 'export_ready', { type: 'export', id: jobId });
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorCode: 'build_failed' },
      });
      throw error;
    }
  }

  async exports(userId: string): Promise<
    {
      id: string;
      status: string;
      requestedAt: string;
      completedAt: string | null;
      expiresAt: string | null;
      url: string | null;
    }[]
  > {
    const rows = await this.prisma.exportJob.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: 10,
      include: { file: { select: { storageKey: true, status: true } } },
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        url:
          r.file?.status === 'uploaded' && r.expiresAt && r.expiresAt > new Date()
            ? await this.storage.presignDownload(r.file.storageKey)
            : null,
      })),
    );
  }

  /** A guest space is erased the moment it is deleted: there is no grace period and no way back. */
  async isGuest(userId: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true },
    });
    return row?.isGuest === true;
  }

  /** Soft delete now: signed out everywhere, data hidden. Hard delete after the grace period. */
  async requestDeletion(userId: string): Promise<{ scheduledFor: string }> {
    const scheduledFor = new Date(Date.now() + GRACE_DAYS * DAY);
    await this.prisma.$transaction([
      this.prisma.deletionRequest.upsert({
        where: { userId },
        create: { userId, scheduledFor },
        update: { scheduledFor, cancelledAt: null, requestedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'deleted', deletedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.reminder.updateMany({
        where: { userId },
        data: { active: false, nextRunAt: null },
      }),
      this.prisma.share.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.pushSubscription.deleteMany({ where: { userId } }),
    ]);
    this.events.emit('user.deleted', { userId });
    return { scheduledFor: scheduledFor.toISOString() };
  }

  /**
   * Hard-deletes one account now, files first. The daily purge uses it after the grace period;
   * sign-up uses it straight away for someone under 16 (age rule), as nothing about a child is kept.
   */
  async eraseNow(userId: string): Promise<void> {
    const files = await this.prisma.storedFile.findMany({
      where: { userId },
      select: { storageKey: true },
    });
    for (const f of files) await this.storage.remove(f.storageKey).catch(() => undefined);
    // Deleting the user row cascades every table and destroys the wrapped data key.
    await this.prisma.purge(async (tx) => {
      await tx.safetyEvent.updateMany({ where: { userId }, data: { userId: null } });
      // Engine v2 decisions stay, unlinked (E-05, E-52; O-06 decides retention).
      await tx.decisionRecord.updateMany({ where: { userId }, data: { userId: null } });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  /** Worker (daily): hard-deletes accounts whose grace period ended, files first. */
  async purgeDue(now = new Date()): Promise<number> {
    const due = await this.prisma.deletionRequest.findMany({
      where: { cancelledAt: null, scheduledFor: { lte: now } },
      select: { userId: true },
      take: 100,
    });
    for (const { userId } of due) await this.eraseNow(userId);
    if (due.length) this.logger.log(`purged ${String(due.length)} accounts`);
    return due.length;
  }

  /**
   * Erases one guest space, and only if it is still a guest space that has reached its date. The
   * user row is locked and checked again inside the transaction, so a space that was linked to an
   * email after it was chosen for erasing, an account, or a space not yet due, is left exactly as it
   * is: nothing is deleted and no file is removed. Files go after the transaction has committed,
   * from the keys read inside it. True when it erased.
   */
  async eraseExpiredGuest(userId: string, now = new Date()): Promise<boolean> {
    const keys: string[] = [];
    const erased = await this.prisma.purge(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM users
        WHERE id = ${userId}::uuid AND is_guest = true AND guest_expires_at <= ${now}
        FOR UPDATE`;
      if (locked.length === 0) return false;
      const files = await tx.storedFile.findMany({
        where: { userId },
        select: { storageKey: true },
      });
      keys.push(...files.map((f) => f.storageKey));
      await tx.safetyEvent.updateMany({ where: { userId }, data: { userId: null } });
      // Engine v2 decisions stay, unlinked (E-05, E-52; O-06 decides retention).
      await tx.decisionRecord.updateMany({ where: { userId }, data: { userId: null } });
      await tx.user.delete({ where: { id: userId } });
      return true;
    });
    if (erased) for (const key of keys) await this.storage.remove(key).catch(() => undefined);
    return erased;
  }

  /**
   * Worker (daily): erases the guest spaces that have reached guestExpiresAt, in batches, with
   * eraseExpiredGuest, and drops the sign-up counter rows older than two days. One that fails is
   * logged, left out for the rest of this run and tried again tomorrow, so it cannot block the
   * batch behind it. `between` is a test seam: it runs after a space is chosen and before it is
   * erased.
   */
  async purgeGuests(
    now = new Date(),
    batch = 100,
    between?: (userId: string) => Promise<void>,
  ): Promise<number> {
    let erased = 0;
    const failed: string[] = [];
    // The cap on rounds keeps one run bounded.
    for (let round = 0; round < 1000; round += 1) {
      const due = await this.prisma.user.findMany({
        where: {
          isGuest: true,
          guestExpiresAt: { lte: now },
          ...(failed.length > 0 ? { id: { notIn: failed } } : {}),
        },
        orderBy: [{ guestExpiresAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
        take: batch,
      });
      if (due.length === 0) break;
      for (const { id } of due)
        try {
          await between?.(id);
          if (await this.eraseExpiredGuest(id, now)) erased += 1;
        } catch (e) {
          failed.push(id);
          this.logger.warn({ err: String(e) }, 'guest space not erased; will retry tomorrow');
        }
      // Chosen, but linked or otherwise no longer due: out of this run too, or it would be chosen
      // again for ever.
      for (const { id } of due) if (!failed.includes(id)) failed.push(id);
    }
    await this.prisma.guestSignup.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY) } },
    });
    if (erased) this.logger.log(`erased ${String(erased)} guest spaces`);
    return erased;
  }

  /**
   * Worker (daily): tells each guest space, in its inbox, how long it has left, at 7, 3 and 1 days.
   * One item per user and threshold, however often this runs or whether a day was missed (the
   * smallest threshold reached is the one written). Guests only; an account never has one.
   */
  async notifyGuestsExpiring(now = new Date()): Promise<number> {
    const widest = Math.max(...GUEST_NOTICE_DAYS);
    let written = 0;
    let after: string | undefined;
    for (;;) {
      const page = await this.prisma.user.findMany({
        where: {
          isGuest: true,
          deletedAt: null,
          guestExpiresAt: { gt: now, lte: new Date(now.getTime() + widest * DAY) },
        },
        orderBy: { id: 'asc' },
        take: 200,
        ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        select: { id: true, guestExpiresAt: true },
      });
      for (const g of page) {
        const left = Math.ceil(((g.guestExpiresAt?.getTime() ?? 0) - now.getTime()) / DAY);
        const threshold = Math.min(...GUEST_NOTICE_DAYS.filter((d) => left <= d));
        if (!Number.isFinite(threshold)) continue;
        const refType = `days_${String(threshold)}`;
        const had = await this.prisma.inboxItem.count({
          where: { userId: g.id, kind: 'guest_expiring', refType },
        });
        if (had > 0) continue;
        await this.inbox.add(g.id, 'guest_expiring', { type: refType });
        written += 1;
      }
      if (page.length < 200) break;
      after = page.at(-1)?.id;
    }
    return written;
  }

  /** Worker (nightly): drop what we no longer need (Privacy notice §7). */
  async retention(now = new Date()): Promise<Record<string, number>> {
    const ago = (days: number): Date => new Date(now.getTime() - days * DAY);
    const expiredFiles = await this.prisma.storedFile.findMany({
      where: { expiresAt: { lt: now }, status: { not: 'deleted' } },
      select: { id: true, storageKey: true },
      take: 500,
    });
    for (const f of expiredFiles) await this.storage.remove(f.storageKey).catch(() => undefined);
    const [files, ai, logs, inbox, links, shares] = await Promise.all([
      this.prisma.storedFile.updateMany({
        where: { id: { in: expiredFiles.map((f) => f.id) } },
        data: { status: 'deleted', deletedAt: now },
      }),
      this.prisma.aiCall.deleteMany({ where: { at: { lt: ago(90) } } }),
      this.prisma.notificationLog.deleteMany({ where: { at: { lt: ago(90) } } }),
      this.prisma.inboxItem.deleteMany({ where: { readAt: { lt: ago(90) } } }),
      this.prisma.magicLink.deleteMany({ where: { expiresAt: { lt: ago(1) } } }),
      this.prisma.share.deleteMany({ where: { expiresAt: { lt: ago(30) } } }),
    ]);
    return {
      files: files.count,
      aiCalls: ai.count,
      notificationLogs: logs.count,
      inbox: inbox.count,
      magicLinks: links.count,
      shares: shares.count,
    };
  }
}
