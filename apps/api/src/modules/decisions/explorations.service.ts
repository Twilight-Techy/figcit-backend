import { Injectable, Logger } from '@nestjs/common';
import type { EngineExploration, ExplorationKind, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, NotFound } from '../../common/errors/errors.js';
import { JobsService } from '../../platform/jobs/jobs.service.js';
import type {
  compareBodySchema,
  exploreBodySchema,
  ExplorationDto,
  gridBodySchema,
  impactBodySchema,
} from './decisions.schemas.js';
import { EngineToolsService } from './engine-tools.service.js';
import { GridService } from './grid.service.js';

type Requests = {
  explore: z.infer<typeof exploreBodySchema>;
  compare: z.infer<typeof compareBodySchema>;
  impact: z.infer<typeof impactBodySchema>;
  grid: z.infer<typeof gridBodySchema>;
};
type Request = Requests[keyof Requests];

const KEEP_DAYS = 7;
const LOST_AFTER_MS = 60_000;

/**
 * Explorer runs as jobs (M7, DESIGN §8, E-57). The API checks the request, stores it and queues it;
 * the worker runs it off the API's event loop (ENGINEERING_RULES §6) and stores the result; staff
 * poll `GET /v1/rulesets/explorations/{id}`. Results are kept 7 days.
 */
@Injectable()
export class ExplorationsService {
  private readonly logger = new Logger('Explorations');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: EngineToolsService,
    private readonly grids: GridService,
    private readonly jobs: JobsService,
  ) {}

  async queue<K extends ExplorationKind>(
    kind: K,
    label: string,
    request: Requests[K],
    requestedBy: string,
  ): Promise<ExplorationDto> {
    await this.tools.check(kind, label, request);
    const row = await this.prisma.engineExploration.create({
      data: { kind, label, request: request as Prisma.InputJsonValue, requestedBy },
    });
    // A lost message is picked up by `sweep()` (as exports are).
    await this.jobs
      .send('rulesets.explore', { id: row.id }, { singletonKey: row.id })
      .catch((e: unknown) => {
        this.logger.warn(
          { err: String(e) },
          'exploration not queued; the worker sweep will run it',
        );
      });
    return dto(row);
  }

  async get(id: string): Promise<ExplorationDto> {
    const row = await this.prisma.engineExploration.findUnique({ where: { id } });
    if (!row) throw new NotFound('exploration');
    return dto(row);
  }

  /** Worker: runs one exploration. A request the engine can't serve fails without a retry. */
  async run(id: string, now = new Date()): Promise<void> {
    const claimed = await this.prisma.engineExploration.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'running', startedAt: now },
    });
    if (claimed.count === 0) return; // done, failed, or another worker has it
    const row = await this.prisma.engineExploration.findUniqueOrThrow({ where: { id } });
    try {
      const result = await this.compute(row.kind, row.label, row.request as Request);
      await this.prisma.engineExploration.update({
        where: { id },
        data: { status: 'done', result: result as Prisma.InputJsonValue, finishedAt: new Date() },
      });
    } catch (e) {
      const message = e instanceof AppError ? (e.detail ?? e.title) : 'The explorer failed.';
      if (!(e instanceof AppError)) this.logger.error({ err: String(e), id }, 'exploration failed');
      await this.prisma.engineExploration.update({
        where: { id },
        data: { status: 'failed', error: message.slice(0, 500), finishedAt: new Date() },
      });
    }
  }

  /** Worker: runs explorations whose queue message was lost, and drops week-old results. */
  async sweep(now = new Date()): Promise<void> {
    const lost = await this.prisma.engineExploration.findMany({
      where: { status: 'queued', createdAt: { lt: new Date(now.getTime() - LOST_AFTER_MS) } },
      select: { id: true },
      take: 5,
    });
    for (const e of lost) await this.run(e.id);
  }

  async cleanup(now = new Date()): Promise<number> {
    const { count } = await this.prisma.engineExploration.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } },
    });
    return count;
  }

  private compute(kind: ExplorationKind, label: string, request: Request): Promise<unknown> {
    switch (kind) {
      case 'explore':
        return this.tools.explore(label, request as Requests['explore']);
      case 'compare':
        return this.tools.compare(label, request as Requests['compare']);
      case 'impact':
        return this.tools.impact(label, request as Requests['impact']);
      case 'grid':
        return this.grids.grid(label, request as Requests['grid']);
    }
  }
}

function dto(row: EngineExploration): ExplorationDto {
  const result = row.status === 'done' ? row.result : null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    label: row.label,
    request: row.request as Record<string, unknown>,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    explore: row.kind === 'explore' ? (result as ExplorationDto['explore']) : null,
    compare: row.kind === 'compare' ? (result as ExplorationDto['compare']) : null,
    impact: row.kind === 'impact' ? (result as ExplorationDto['impact']) : null,
    grid: row.kind === 'grid' ? (result as ExplorationDto['grid']) : null,
  };
}
