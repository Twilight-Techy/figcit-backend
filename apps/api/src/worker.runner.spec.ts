import { describe, expect, it, vi } from 'vitest';
import type { ModuleRef } from '@nestjs/core';
import type { PrismaService } from './common/db/prisma.service.js';
import type { JobsService } from './platform/jobs/jobs.service.js';
import { PrivacyService } from './modules/privacy/privacy.service.js';
import { WorkerRunner } from './worker.runner.js';

describe('the worker schedule', () => {
  it('runs the guest purge daily, and the purge calls purgeGuests and the expiring notices', async () => {
    const privacy = {
      purgeGuests: vi.fn().mockResolvedValue(0),
      notifyGuestsExpiring: vi.fn().mockResolvedValue(0),
    };
    const refs = {
      get: (type: unknown) => (type === PrivacyService ? privacy : {}),
    } as unknown as ModuleRef;
    let handlers: Record<string, (d: Record<string, unknown>) => Promise<void> | void> = {};
    let schedules: Record<string, string> = {};
    const jobs = {
      runWorker: (h: typeof handlers, s: typeof schedules) => {
        handlers = h;
        schedules = s;
        return Promise.resolve();
      },
    } as unknown as JobsService;
    await new WorkerRunner(jobs, {} as PrismaService, refs).onApplicationBootstrap();
    expect(schedules['privacy.purge-guests']).toMatch(/^\d+ \d+ \* \* \*$/);
    await handlers['privacy.purge-guests']?.({});
    expect(privacy.purgeGuests).toHaveBeenCalledOnce();
    expect(privacy.notifyGuestsExpiring).toHaveBeenCalledOnce();
  });
});
