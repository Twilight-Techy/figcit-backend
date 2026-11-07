import { Injectable, Logger, type OnApplicationBootstrap, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from './common/db/prisma.service.js';
import { JobsService } from './platform/jobs/jobs.service.js';
import { AnalyticsService } from './modules/analytics/analytics.service.js';
import { DecisionsService } from './modules/decisions/decisions.service.js';
import { ExplorationsService } from './modules/decisions/explorations.service.js';
import { InstitutionsService } from './modules/institutions/institutions.service.js';
import { DispatcherService } from './modules/notifications/dispatcher.service.js';
import { PrivacyService } from './modules/privacy/privacy.service.js';
import { SustainedService } from './modules/safety/sustained.service.js';
import { SpeechService } from './modules/speech/speech.service.js';

/** Registers every job handler and schedule (times are Europe/London). */
@Injectable()
export class WorkerRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger('Worker');

  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
    private readonly refs: ModuleRef,
  ) {}

  private svc<T>(type: Type<T>): T {
    return this.refs.get(type, { strict: false });
  }

  private get dispatcher(): DispatcherService {
    return this.svc(DispatcherService);
  }

  private get privacy(): PrivacyService {
    return this.svc(PrivacyService);
  }

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
          await this.svc(ExplorationsService).sweep();
        },
        'checkin.sustained-red': async () => {
          await this.svc(SustainedService).run();
        },
        'rulesets.explore': async (data) => {
          if (typeof data['id'] === 'string') await this.svc(ExplorationsService).run(data['id']);
        },
        'decisions.replay-sample': async () => {
          this.logger.log(await this.svc(DecisionsService).replaySample(), 'decision replay');
        },
        'privacy.export': async (data) => {
          if (typeof data['jobId'] === 'string') await this.privacy.runExport(data['jobId']);
        },
        'speech.transcribe': async (data) => {
          if (typeof data['id'] === 'string') await this.svc(SpeechService).transcribe(data['id']);
        },
        'privacy.purge': async () => {
          await this.privacy.purgeDue();
        },
        'retention.nightly': async () => {
          this.logger.log({ removed: await this.privacy.retention() }, 'retention');
          this.logger.log(
            { removed: await this.svc(ExplorationsService).cleanup() },
            'explorations retention',
          );
        },
        'reflect.topic-counts': () => this.topicCounts(),
        'institutions.aggregate': async () => {
          await this.svc(InstitutionsService).aggregate();
        },
        'analytics.rollup': async () => {
          await this.svc(AnalyticsService).rollup();
        },
      },
      {
        'reminders.tick': '* * * * *',
        'checkin.sustained-red': '15 6 * * *',
        'decisions.replay-sample': '50 4 * * *',
        'privacy.purge': '30 3 * * *',
        'retention.nightly': '0 3 * * *',
        'reflect.topic-counts': '45 2 * * *',
        'analytics.rollup': '20 1 * * *',
        'institutions.aggregate': '40 1 * * *',
      },
      async () => {
        const next = await this.prisma.reminder.findFirst({
          where: { active: true, deletedAt: null, nextRunAt: { not: null } },
          orderBy: { nextRunAt: 'asc' },
          select: { nextRunAt: true },
        });
        return next?.nextRunAt ?? null;
      },
    );
  }
}
