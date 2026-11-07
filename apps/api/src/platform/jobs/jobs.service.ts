import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PgBoss, type Job } from 'pg-boss';
import { ENV, type Env } from '../../common/config/env.js';

/** Every background job type. Handlers live with their module and register in the worker. */
export const QUEUES = [
  'checkin.sustained-red', // SF-2 daily check
  'decisions.replay-sample', // engine v2: replay yesterday's records (DESIGN §7)
  'rulesets.explore', // engine v2: a staff explorer run (M7, E-57)
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

const TZ = 'Europe/London';
/** How often the on-demand clock looks at the time. It reads memory only, never the database. */
const CLOCK_MS = 30_000;
/** How long before a failed job, or a failed reminder check, is tried again. */
const RETRY_MS = 5 * 60_000;
/** Clears old pg-boss rows, which its own polling supervisor would otherwise do. */
const TIDY_AT = '03:05';

/** The time of day in London, as `HH:MM`. */
export function londonMinute(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/**
 * pg-boss's timers that would otherwise keep waking the database, even with no workers: its own
 * supervisor and cron, a heartbeat every 30 s, a queue cache and a migration check every 60 s, and a
 * LISTEN connection that reconnects when the database sleeps. A day is the longest it allows.
 */
const QUIET = {
  supervise: false,
  schedule: false,
  registerInstance: false,
  noListenNotify: true,
  queueCacheIntervalSeconds: 86_400,
  bamIntervalSeconds: 86_400,
};

/** `HH:MM` for a daily cron such as `20 1 * * *`; null for anything else. */
export function dailyTime(cron: string): string | null {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(cron);
  return m ? `${(m[2] ?? '').padStart(2, '0')}:${(m[1] ?? '').padStart(2, '0')}` : null;
}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private boss: PgBoss | undefined;
  private starting: Promise<PgBoss> | undefined;
  // On demand only (ADR 0010).
  private handlers: Partial<Record<QueueName, JobHandler>> = {};
  private daily: readonly (readonly [QueueName, string])[] = [];
  private nextTick: () => Promise<Date | null> = () => Promise.resolve(null);
  private tickAt: Date | null = null;
  private ticking = false;
  private lastMinute: string | null = null;
  private clock: NodeJS.Timeout | undefined;
  private readonly draining = new Set<QueueName>();
  private readonly drainAgain = new Set<QueueName>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Lazily started; the API only sends, the worker also supervises and runs handlers. */
  private async ready(supervise = false): Promise<PgBoss> {
    this.starting ??= (async () => {
      const boss = new PgBoss({
        connectionString: this.env.DATABASE_URL,
        supervise,
        schedule: supervise,
        max: supervise ? 4 : 2,
        ...(this.env.JOBS_ON_DEMAND ? QUIET : {}),
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
    if (this.env.JOBS_ON_DEMAND) void this.drain(name);
  }

  /** A reminder is due at `at`: on demand, makes sure the database is looked at by then. */
  scheduleTick(at: Date | null): void {
    if (!this.env.JOBS_ON_DEMAND || !at) return;
    if (!this.tickAt || at < this.tickAt) this.tickAt = at;
  }

  /**
   * Worker only: registers handlers and cron schedules. `nextTick` says when `reminders.tick` is next
   * needed, which on-demand mode uses in place of its every-minute cron.
   */
  async runWorker(
    handlers: Partial<Record<QueueName, JobHandler>>,
    schedules: Partial<Record<QueueName, string>>,
    nextTick: () => Promise<Date | null> = () => Promise.resolve(null),
  ): Promise<void> {
    const boss = await this.ready(true);
    if (this.env.JOBS_ON_DEMAND) {
      this.runOnDemand(handlers, schedules, nextTick);
      return;
    }
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
      await boss.schedule(name, cron, {}, { tz: TZ });
    this.logger.log(`worker running ${String(Object.keys(handlers).length)} job types`);
  }

  /** No polling, so an idle process makes no database queries and the database can sleep. */
  private runOnDemand(
    handlers: Partial<Record<QueueName, JobHandler>>,
    schedules: Partial<Record<QueueName, string>>,
    nextTick: () => Promise<Date | null>,
  ): void {
    this.handlers = handlers;
    this.nextTick = nextTick;
    this.daily = (Object.entries(schedules) as [QueueName, string][]).flatMap(([name, cron]) => {
      const at = dailyTime(cron);
      return at ? [[name, at] as const] : [];
    });
    this.clock = setInterval(() => {
      this.onClock(new Date());
    }, CLOCK_MS);
    this.clock.unref();
    // Whatever a restart left behind.
    for (const name of Object.keys(handlers) as QueueName[]) void this.drain(name);
    void this.tick();
    this.logger.log(`worker on demand, ${String(Object.keys(handlers).length)} job types`);
  }

  private onClock(now: Date): void {
    const minute = londonMinute(now);
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      for (const [name, at] of this.daily) if (at === minute) void this.runDaily(name);
      if (minute === TIDY_AT) void this.tidy();
    }
    if (this.tickAt && now >= this.tickAt) void this.tick();
  }

  private async runDaily(name: QueueName): Promise<void> {
    await this.handlers[name]?.({}).catch((e: unknown) => {
      this.logger.error({ err: String(e), job: name }, 'daily job failed');
    });
  }

  private async tidy(): Promise<void> {
    const boss = await this.ready();
    await boss.supervise().catch((e: unknown) => {
      this.logger.error({ err: String(e) }, 'pg-boss tidy failed');
    });
  }

  /** Sends what's due, then remembers when the next reminder is. */
  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    this.tickAt = null;
    try {
      await this.handlers['reminders.tick']?.({});
      this.tickAt = await this.nextTick();
    } catch (e) {
      this.logger.error({ err: String(e) }, 'reminder check failed');
      this.tickAt = new Date(Date.now() + RETRY_MS);
    } finally {
      this.ticking = false;
    }
  }

  /** Runs a queue's jobs until none are ready. A failure is retried with pg-boss's own limits. */
  private async drain(name: QueueName): Promise<void> {
    const handler = this.handlers[name];
    if (!handler) return;
    if (this.draining.has(name)) {
      this.drainAgain.add(name);
      return;
    }
    this.draining.add(name);
    try {
      const boss = await this.ready();
      do {
        this.drainAgain.delete(name);
        for (;;) {
          const [job] = await boss.fetch<Record<string, unknown>>(name, { batchSize: 1 });
          if (!job) break;
          try {
            await handler(job.data);
            await boss.complete(name, job.id);
          } catch (e) {
            this.logger.error({ err: String(e), job: name }, 'job failed');
            await boss.fail(name, job.id, { error: String(e) });
            setTimeout(() => void this.drain(name), RETRY_MS).unref();
          }
        }
      } while (this.drainAgain.has(name));
    } catch (e) {
      this.logger.error({ err: String(e), job: name }, 'could not run jobs');
    } finally {
      this.draining.delete(name);
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.clock);
    await this.boss?.stop({ graceful: true, timeout: 10_000 });
  }
}
