import { Injectable, Logger } from '@nestjs/common';
import { compileSnapshot, type Snapshot } from '@figcit/engine';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError } from '../../common/errors/errors.js';

const LIMIT = 4;

/**
 * Serves rule snapshots from Postgres, cached in memory by version (bounded). The published one is
 * re-read at most every 30 s, so a publish reaches every instance without a restart.
 */
@Injectable()
export class RulesService {
  private readonly logger = new Logger('Rules');
  private readonly byVersion = new Map<string, { snapshot: Snapshot; hash: string }>();
  private published: { version: string; checkedAt: number } | undefined;

  constructor(private readonly prisma: PrismaService) {}

  private remember(version: string, snapshot: Snapshot, hash: string): void {
    this.byVersion.set(version, { snapshot, hash });
    compileSnapshot(snapshot);
    if (this.byVersion.size > LIMIT) {
      const oldest = this.byVersion.keys().next().value;
      if (oldest !== undefined && oldest !== version) this.byVersion.delete(oldest);
    }
  }

  async current(): Promise<{ snapshot: Snapshot; hash: string; version: string }> {
    const fresh = this.published && Date.now() - this.published.checkedAt < 30_000;
    if (fresh && this.published) {
      const hit = this.byVersion.get(this.published.version);
      if (hit) return { ...hit, version: this.published.version };
    }
    const row = await this.prisma.ruleSnapshot.findFirst({
      where: { status: 'published' },
      select: { version: true, hash: true, json: true },
    });
    if (!row)
      throw new AppError(
        503,
        'no_snapshot',
        'FigCit is getting ready',
        'No published rule snapshot yet.',
      );
    if (!this.byVersion.has(row.version)) {
      this.remember(row.version, row.json as unknown as Snapshot, row.hash);
      this.logger.log(`loaded snapshot ${row.version}`);
    }
    this.published = { version: row.version, checkedAt: Date.now() };
    const hit = this.byVersion.get(row.version);
    if (!hit) throw new AppError(503, 'no_snapshot', 'FigCit is getting ready');
    return { ...hit, version: row.version };
  }

  async byVersionOrCurrent(version: string | undefined): Promise<Snapshot> {
    if (version) {
      const hit = this.byVersion.get(version);
      if (hit) return hit.snapshot;
      const row = await this.prisma.ruleSnapshot.findUnique({
        where: { version },
        select: { json: true, hash: true },
      });
      if (row) {
        this.remember(version, row.json as unknown as Snapshot, row.hash);
        return row.json as unknown as Snapshot;
      }
    }
    return (await this.current()).snapshot;
  }

  invalidate(): void {
    this.published = undefined;
  }
}
