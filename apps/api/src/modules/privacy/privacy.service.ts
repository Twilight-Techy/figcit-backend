import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { JobsService } from '../../platform/jobs/jobs.service.js';
import { StorageService } from '../../platform/storage/storage.service.js';
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
   * Worker (daily): erases the guest spaces that have reached guestExpiresAt, with eraseNow, in
   * batches until none are due, and drops the sign-up counter rows older than two days. A guest
   * space is never extended, so there is nothing to check but the date.
   */
  async purgeGuests(now = new Date(), batch = 100): Promise<number> {
    let erased = 0;
    // Each round erases a batch; a failure on one account is logged and does not stop the rest, and
    // it is tried again tomorrow. The cap on rounds keeps one run bounded.
    for (let round = 0; round < 1000; round += 1) {
      const due = await this.prisma.user.findMany({
        where: { isGuest: true, guestExpiresAt: { lte: now } },
        orderBy: { guestExpiresAt: 'asc' },
        select: { id: true },
        take: batch,
      });
      if (due.length === 0) break;
      let done = 0;
      for (const { id } of due)
        try {
          await this.eraseNow(id);
          done += 1;
        } catch (e) {
          this.logger.warn({ err: String(e) }, 'guest space not erased; will retry');
        }
      erased += done;
      // Nothing erased in a whole round would only repeat itself.
      if (done === 0) break;
    }
    await this.prisma.guestSignup.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - 2 * DAY) } },
    });
    if (erased) this.logger.log(`erased ${String(erased)} guest spaces`);
    return erased;
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
