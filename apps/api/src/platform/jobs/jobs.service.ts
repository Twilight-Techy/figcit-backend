import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PgBoss, type Job } from 'pg-boss';
import { ENV, type Env } from '../../common/config/env.js';

/** Every background job type. Handlers live with their module and register in the worker. */
export const QUEUES = [
  'checkin.sustained-red', // SF-2 daily check
  'decisions.replay-sample', // engine v2: replay yesterday's records (DESIGN §7)
  'reminders.tick', // sends due reminders
  'speech.transcribe',
  'dump.sort', // sortDump (Advanced)
  'privacy.export',
  'privacy.purge', // hard delete after the grace period
  'retention.nightly',
  'analytics.rollup',
  'reflect.topic-counts',
  'institutions.aggregate',
  'mail.send',
] as const;
export type QueueName = (typeof QUEUES)[number];

export type JobHandler = (data: Record<string, unknown>) => Promise<void>;

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private boss: PgBoss | undefined;
  private starting: Promise<PgBoss> | undefined;

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Lazily started; the API only sends, the worker also supervises and runs handlers. */
  private async ready(supervise = false): Promise<PgBoss> {
    this.starting ??= (async () => {
      const boss = new PgBoss({
        connectionString: this.env.DATABASE_URL,
        supervise,
        schedule: supervise,
        max: supervise ? 4 : 2,
      });
      boss.on('error', (error: Error) => {
        this.logger.error({ err: error.message }, 'pg-boss error');
      });
      await boss.start();
      for (const name of QUEUES) await boss.createQueue(name);
      this.boss = boss;
      return boss;
    })();
    return this.starting;
  }

  async send(
    name: QueueName,
    data: Record<string, unknown>,
    options: { singletonKey?: string; startAfter?: Date | number } = {},
  ): Promise<void> {
    const boss = await this.ready();
    await boss.send(name, data, { retryLimit: 3, retryBackoff: true, ...options });
  }

  /** Worker only: registers handlers and cron schedules. */
  async runWorker(
    handlers: Partial<Record<QueueName, JobHandler>>,
    schedules: Partial<Record<QueueName, string>>,
  ): Promise<void> {
    const boss = await this.ready(true);
    for (const [name, handler] of Object.entries(handlers) as [QueueName, JobHandler][]) {
      await boss.work<Record<string, unknown>>(
        name,
        { batchSize: 1 },
        async (jobs: Job<Record<string, unknown>>[]) => {
          for (const job of jobs) await handler(job.data);
        },
      );
    }
    for (const [name, cron] of Object.entries(schedules) as [QueueName, string][])
      await boss.schedule(name, cron, {}, { tz: 'Europe/London' });
    this.logger.log(`worker running ${String(Object.keys(handlers).length)} job types`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss?.stop({ graceful: true, timeout: 10_000 });
  }
}
