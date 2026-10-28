import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './common/db/prisma.service.js';
import { JobsService } from './platform/jobs/jobs.service.js';
import { DispatcherService } from './modules/notifications/dispatcher.service.js';
import { PrivacyService } from './modules/privacy/privacy.service.js';
import { SustainedService } from './modules/safety/sustained.service.js';

/** Registers every job handler and schedule (times are Europe/London). */
@Injectable()
export class WorkerRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger('Worker');

  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
    private readonly dispatcher: DispatcherService,
    private readonly privacy: PrivacyService,
    private readonly sustained: SustainedService,
  ) {}

  /** Rebuilds the 7-day reflection counts so old topics stop counting towards RF-2. */
  async topicCounts(): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE user_topic_counts t SET count_7d = (
        SELECT COUNT(*) FROM reflections r
        WHERE r.user_id = t.user_id AND r.topic_tag = t.topic_tag AND r.deleted_at IS NULL
          AND r.saved_for_later = false AND r.created_at > now() - interval '7 days')`;
  }

  /** Picks up exports whose queue message was lost (e.g. requested while the worker was down). */
  async sweepExports(): Promise<void> {
    const queued = await this.prisma.exportJob.findMany({
      where: { status: 'queued', requestedAt: { lt: new Date(Date.now() - 60_000) } },
      select: { id: true },
      take: 20,
    });
    for (const j of queued) await this.privacy.runExport(j.id);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.jobs.runWorker(
      {
        'reminders.tick': async () => {
          await this.dispatcher.tick();
          await this.sweepExports();
        },
        'checkin.sustained-red': async () => {
          await this.sustained.run();
        },
        'privacy.export': async (data) => {
          if (typeof data['jobId'] === 'string') await this.privacy.runExport(data['jobId']);
        },
        'privacy.purge': async () => {
          await this.privacy.purgeDue();
        },
        'retention.nightly': async () => {
          this.logger.log({ removed: await this.privacy.retention() }, 'retention');
        },
        'reflect.topic-counts': () => this.topicCounts(),
      },
      {
        'reminders.tick': '* * * * *',
        'checkin.sustained-red': '15 6 * * *',
        'privacy.purge': '30 3 * * *',
        'retention.nightly': '0 3 * * *',
        'reflect.topic-counts': '45 2 * * *',
      },
    );
  }
}
