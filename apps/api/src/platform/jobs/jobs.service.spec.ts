import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../common/config/env.js';
import { dailyTime, JobsService, londonMinute } from './jobs.service.js';

const boss = vi.hoisted(() => ({
  on: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  createQueue: vi.fn(),
  send: vi.fn(),
  fetch: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  work: vi.fn(),
  schedule: vi.fn(),
  supervise: vi.fn(),
}));
const options = vi.hoisted<{ last: Record<string, unknown> }>(() => ({ last: {} }));

vi.mock('pg-boss', () => ({
  PgBoss: vi.fn(function (o: Record<string, unknown>) {
    options.last = o;
    return boss;
  }),
}));

const service = (onDemand: boolean): JobsService =>
  new JobsService({ DATABASE_URL: 'postgres://x', JOBS_ON_DEMAND: onDemand } as Env);
const job = { id: 'j1', data: { id: 'a' } };
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

describe('job times', () => {
  it('reads daily crons and nothing else', () => {
    expect(dailyTime('20 1 * * *')).toBe('01:20');
    expect(dailyTime('* * * * *')).toBeNull();
  });

  it('uses London time, summer and winter', () => {
    expect(londonMinute(new Date('2026-07-01T00:20:00Z'))).toBe('01:20');
    expect(londonMinute(new Date('2026-01-01T01:20:00Z'))).toBe('01:20');
  });
});

describe('JobsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    for (const fn of Object.values(boss)) fn.mockReset().mockResolvedValue(undefined);
    boss.on.mockReturnValue(boss);
    boss.fetch.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls by default', async () => {
    await service(false).runWorker(
      { 'speech.transcribe': vi.fn() },
      { 'reminders.tick': '* * * * *' },
    );
    expect(boss.work).toHaveBeenCalled();
    expect(boss.schedule).toHaveBeenCalled();
    expect(options.last).toMatchObject({ supervise: true, schedule: true });
  });

  describe('on demand', () => {
    it('has nothing polling', async () => {
      await service(true).runWorker(
        { 'speech.transcribe': vi.fn() },
        { 'analytics.rollup': '20 1 * * *' },
      );
      expect(boss.work).not.toHaveBeenCalled();
      expect(boss.schedule).not.toHaveBeenCalled();
      expect(options.last).toMatchObject({
        supervise: false,
        schedule: false,
        registerInstance: false,
        noListenNotify: true,
      });
    });

    it('makes no database calls while idle', async () => {
      const next = vi.fn().mockResolvedValue(null);
      await service(true).runWorker({ 'speech.transcribe': vi.fn() }, {}, next);
      await settle();
      boss.fetch.mockClear();
      next.mockClear();
      await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
      expect(boss.fetch).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('runs a job as soon as it is sent', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const jobs = service(true);
      await jobs.runWorker({ 'speech.transcribe': handler }, {});
      await settle();
      boss.fetch.mockResolvedValueOnce([job]);
      await jobs.send('speech.transcribe', job.data);
      await settle();
      expect(handler).toHaveBeenCalledWith(job.data);
      expect(boss.complete).toHaveBeenCalledWith('speech.transcribe', 'j1');
    });

    it('fails a job that throws, and tries the queue again later', async () => {
      const jobs = service(true);
      await jobs.runWorker({ 'speech.transcribe': vi.fn().mockRejectedValue(new Error('no')) }, {});
      await settle();
      boss.fetch.mockResolvedValueOnce([job]);
      await jobs.send('speech.transcribe', job.data);
      await settle();
      expect(boss.fail).toHaveBeenCalled();
      boss.fetch.mockClear();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(boss.fetch).toHaveBeenCalled();
    });

    it('runs a daily job once, at its time in London', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await service(true).runWorker(
        { 'analytics.rollup': handler },
        { 'analytics.rollup': '20 13 * * *' },
      );
      await vi.advanceTimersByTimeAsync(79 * 60_000);
      expect(handler).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      expect(handler).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('checks reminders on start, then only when one is due', async () => {
      const tick = vi.fn().mockResolvedValue(undefined);
      const next = vi.fn().mockResolvedValue(new Date('2026-01-01T13:00:00Z'));
      await service(true).runWorker({ 'reminders.tick': tick }, {}, next);
      await settle();
      expect(tick).toHaveBeenCalledTimes(1);
      next.mockResolvedValue(null);
      await vi.advanceTimersByTimeAsync(59 * 60_000);
      expect(tick).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      expect(tick).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('wakes for a reminder set while idle', async () => {
      const tick = vi.fn().mockResolvedValue(undefined);
      const jobs = service(true);
      await jobs.runWorker({ 'reminders.tick': tick }, {}, vi.fn().mockResolvedValue(null));
      await settle();
      jobs.scheduleTick(new Date('2026-01-01T12:10:00Z'));
      await vi.advanceTimersByTimeAsync(11 * 60_000);
      expect(tick).toHaveBeenCalledTimes(2);
    });

    it('does the tidying its supervisor would have done', async () => {
      vi.setSystemTime(new Date('2026-01-01T03:00:00Z'));
      await service(true).runWorker({}, {});
      await vi.advanceTimersByTimeAsync(6 * 60_000);
      expect(boss.supervise).toHaveBeenCalledTimes(1);
    });
  });
});
